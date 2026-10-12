import {beforeAll,afterAll,it,expect} from 'vitest';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
import {readFileSync,readdirSync} from 'node:fs';
let pg:PGlite;let orgA:string,orgB:string,p1:string,p2:string,orderId:string;
const userA='11111111-1111-4111-a111-111111111111',userB='22222222-2222-4222-a222-222222222222';
async function asUser(user:string){await pg.exec(`reset role;set role authenticated;set request.jwt.claim.sub='${user}';`);}
async function scalar(sql:string,params:unknown[]=[]){return (await pg.query<{result:string}>(sql,params)).rows[0].result;}
beforeAll(async()=>{
 pg=new PGlite({extensions:{btree_gist}});
 await pg.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;grant usage on schema storage to authenticated;grant select,insert on storage.objects to authenticated;
 insert into auth.users values('${userA}'),('${userB}');`);
 for(const file of readdirSync('supabase/migrations').sort())await pg.exec(readFileSync('supabase/migrations/'+file,'utf8'));
 await asUser(userA);orgA=await scalar("select public.rp_onboard('Cloud A','electronics','bad','IQD') result");
 await asUser(userB);orgB=await scalar("select public.rp_onboard('Cloud B','electronics','en','IQD') result");
 await asUser(userA);
 const draft={name:'Cloud laptop',description:'Synthetic',price:100,currency:'IQD',stock:2,specs:{RAM:'16GB'},category:'Laptop'};
 p1=await scalar('select public.rp_save_product($1,$2) result',[orgA,draft]);p2=await scalar('select public.rp_save_product($1,$2) result',[orgA,{...draft,name:'Cloud mouse',stock:1}]);
},30000);
afterAll(async()=>{await pg?.close();});
it('onboards once and rejects cross-tenant writes and reads',async()=>{
 await asUser(userB);expect((await pg.query('select * from public.products')).rows).toHaveLength(0);
 await expect(pg.query('select public.rp_save_product($1,$2)',[orgA,{name:'Attack',price:1,stock:1,currency:'IQD'}])).rejects.toThrow('permission');
 await expect(pg.exec("select public.rp_onboard('Again','retail','en','USD')")).rejects.toThrow('already exists');
 await expect(pg.exec(`update subscriptions set status='active' where org_id='${orgB}'`)).rejects.toThrow('permission');
});
it('reserves a multi-item order atomically, deduplicates and rejects stale edits',async()=>{
 await asUser(userA);const key='33333333-3333-4333-a333-333333333333';const items=[{productId:p1,quantity:1},{productId:p2,quantity:1}];
 orderId=await scalar('select public.rp_request_order($1,$2,$3,$4,$5) result',[orgA,key,'Synthetic Buyer',items,'pickup']);
 expect(await scalar('select public.rp_request_order($1,$2,$3,$4,$5) result',[orgA,key,'Synthetic Buyer',items,'pickup'])).toBe(orderId);
 await expect(pg.query('select public.rp_request_order($1,$2,$3,$4,$5)',[orgA,key,'Other Buyer',items,'pickup'])).rejects.toThrow('already used');
 await pg.query('select public.rp_update_order($1,$2,$3)',[orgA,orderId,'confirmed']);
 expect((await pg.query<{stock:number}>('select stock from products where id=$1',[p1])).rows[0].stock).toBe(1);
 expect((await pg.query<{stock:number}>('select stock from products where id=$1',[p2])).rows[0].stock).toBe(0);
 await expect(pg.query('select public.rp_save_product($1,$2)',[orgA,{id:p1,version:0,name:'Cloud laptop',price:100,stock:2,currency:'IQD'}])).rejects.toThrow('changed');
});
it('rolls back all reservations on insufficient stock and releases only once',async()=>{
 const pending=await scalar('select public.rp_request_order($1,$2,$3,$4,$5) result',[orgA,'44444444-4444-4444-a444-444444444444','Synthetic Buyer',[{productId:p1,quantity:1},{productId:p2,quantity:1}],'pickup']);
 await expect(pg.query('select public.rp_update_order($1,$2,$3)',[orgA,pending,'confirmed'])).rejects.toThrow('Insufficient');
 expect((await pg.query<{stock:number}>('select stock from products where id=$1',[p1])).rows[0].stock).toBe(1);
 await pg.query('select public.rp_update_order($1,$2,$3)',[orgA,orderId,'cancelled']);await pg.query('select public.rp_update_order($1,$2,$3)',[orgA,orderId,'cancelled']);
 expect((await pg.query<{stock:number}>('select stock from products where id=$1',[p1])).rows[0].stock).toBe(2);
});
it('restricts private storage paths to the owning tenant and existing product',async()=>{
 await pg.query('insert into storage.objects(bucket_id,name) values($1,$2)',['replypilot-products',`${orgA}/${p1}/test.webp`]);
 await asUser(userB);expect((await pg.query('select * from storage.objects')).rows).toHaveLength(0);
 await expect(pg.query('insert into storage.objects(bucket_id,name) values($1,$2)',['replypilot-products',`${orgA}/${p1}/forged.webp`])).rejects.toThrow('row-level');
});
it('blocks staff catalog changes and enforces expired subscriptions inside RPCs',async()=>{
 await pg.exec('reset role');
 await pg.query("update organization_members set org_id=$1,role='staff' where user_id=$2",[orgA,userB]);
 await asUser(userB);
 expect((await pg.query('select * from products')).rows).toHaveLength(2);
 await expect(pg.query('select public.rp_save_product($1,$2)',[orgA,{name:'Staff forged',price:1,stock:1,currency:'IQD'}])).rejects.toThrow('permission');
 await expect(pg.query('insert into storage.objects(bucket_id,name) values($1,$2)',['replypilot-products',`${orgA}/${p1}/staff.webp`])).rejects.toThrow('row-level');
 await pg.exec('reset role');await pg.query("update subscriptions set trial_end=now()-interval '1 day' where org_id=$1",[orgA]);
 await asUser(userA);
 await expect(pg.query('select public.rp_save_product($1,$2)',[orgA,{name:'Expired',price:1,stock:1,currency:'IQD'}])).rejects.toThrow('inactive');
});
