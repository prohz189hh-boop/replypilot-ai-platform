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
 await pg.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
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

it('aggregates the whole tenant and only completed merchandise, separated by currency',async()=>{
 await pg.exec('reset role');
 await pg.query("insert into products(org_id,name,price_minor,currency,stock,archived) select $1,'Aggregate fixture '||n,1,'IQD',case when n<=5 then 2 else 10 end,n>101 from generate_series(1,103) n",[orgA]);
 const customer=(await pg.query<{id:string}>('select id from customers where org_id=$1 limit 1',[orgA])).rows[0].id;
 for(const [status,currency,price] of [['completed','USD',125],['completed','IQD',1000],['cancelled','USD',999],['confirmed','USD',999]] as const){
  const order=(await pg.query<{id:string}>("insert into orders(org_id,customer_id,status,fulfillment,currency,idempotency_key,shipping_minor) values($1,$2,$3,'pickup',$4,gen_random_uuid(),999) returning id",[orgA,customer,status,currency])).rows[0].id;
  await pg.query('insert into order_items(org_id,order_id,product_id,product_name,quantity,unit_price_minor) values($1,$2,$3,$4,2,$5)',[orgA,order,p1,'Synthetic item',price]);
 }
 await asUser(userA);
 const summary=(await pg.query<{s:{activeProducts:number;lowStock:number;orders:number;pendingOrders:number;completedOrders:number;sales:unknown[]}}>('select rp_dashboard_summary($1) s',[orgA])).rows[0].s;
 expect(summary).toEqual({activeProducts:103,lowStock:7,orders:6,pendingOrders:2,completedOrders:2,sales:[{currency:'IQD',amount:2000},{currency:'USD',amount:250}]});
 await expect(pg.query('select rp_dashboard_summary($1)',[orgB])).rejects.toThrow('permission');
 await pg.exec("reset role;set role anon;");await expect(pg.query('select rp_dashboard_summary($1)',[orgA])).rejects.toThrow('permission');
 await pg.exec('reset role');await pg.query('update organization_members set org_id=$1 where user_id=$2',[orgB,userB]);await asUser(userB);
 expect((await pg.query<{s:{activeProducts:number;sales:unknown[]}}>('select rp_dashboard_summary($1) s',[orgB])).rows[0].s).toMatchObject({activeProducts:0,sales:[]});
 await expect(pg.query('select rp_dashboard_summary($1)',[orgA])).rejects.toThrow('permission');
});

let cloudConversation:string;
it('creates cloud inbox intake idempotently without exposing a customer bearer token',async()=>{
 await pg.exec('reset role');await pg.query("update subscriptions set trial_end=now()+interval '1 day' where org_id=$1",[orgA]);await asUser(userA);
 cloudConversation='88888888-8888-4888-a888-888888888888';
 const args=[orgA,cloudConversation,'Synthetic inbox buyer','slav chawa yi','bad'];
 expect(await scalar('select rp_intake_conversation($1,$2,$3,$4,$5) result',args)).toBe(cloudConversation);
 expect(await scalar('select rp_intake_conversation($1,$2,$3,$4,$5) result',args)).toBe(cloudConversation);
 expect((await pg.query('select id from messages where conversation_id=$1',[cloudConversation])).rows).toHaveLength(1);
 await expect(pg.query('select rp_intake_conversation($1,$2,$3,$4,$5)',[orgA,cloudConversation,'Synthetic inbox buyer','Changed body','bad'])).rejects.toThrow('already used');
 expect((await pg.query<{token_hash:string}>('select token_hash from conversations where id=$1',[cloudConversation])).rows[0].token_hash).toBe('disabled');
});
it('denies cross-tenant inbox reads, mutations and anonymous execution',async()=>{
 await asUser(userB);expect((await pg.query('select id from conversations')).rows).toHaveLength(0);expect((await pg.query('select id from messages')).rows).toHaveLength(0);
 await expect(pg.query('select rp_reply_conversation($1,$2,$3,$4,$5)',[orgA,cloudConversation,'99999999-9999-4999-a999-999999999999','Attack',false])).rejects.toThrow('permission');
 await expect(pg.query('select rp_reply_conversation($1,$2,$3,$4,$5)',[orgB,cloudConversation,'99999999-9999-4999-a999-999999999999','Attack',false])).rejects.toThrow('not found');
 await expect(pg.query('select rp_control_conversation($1,$2,$3,$4,$5)',[orgA,cloudConversation,true,'resolved','ar'])).rejects.toThrow('permission');
 await expect(pg.query("insert into messages(org_id,conversation_id,role,body) values($1,$2,'staff','Attack')",[orgA,cloudConversation])).rejects.toThrow('permission');
 await pg.exec('reset role;set role anon');await expect(pg.query('select rp_reply_conversation($1,$2,$3,$4,$5)',[orgA,cloudConversation,'99999999-9999-4999-a999-999999999999','Attack',false])).rejects.toThrow('permission');
});
it('persists human replies, private notes, takeover and language preference without duplicate messages',async()=>{
 await asUser(userA);const args=[orgA,cloudConversation,'99999999-9999-4999-a999-999999999999','Fictional human response',false];
 await pg.query('select rp_reply_conversation($1,$2,$3,$4,$5)',args);await pg.query('select rp_reply_conversation($1,$2,$3,$4,$5)',args);
 await expect(pg.query('select rp_reply_conversation($1,$2,$3,$4,$5)',[...args.slice(0,3),'Conflicting response',false])).rejects.toThrow('already used');
 await pg.query('select rp_reply_conversation($1,$2,$3,$4,$5)',[orgA,cloudConversation,'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa','Private synthetic note',true]);
 expect((await pg.query("select id from messages where conversation_id=$1 and provider='human'",[cloudConversation])).rows).toHaveLength(2);
 await pg.query('select rp_control_conversation($1,$2,$3,$4,$5)',[orgA,cloudConversation,true,'resolved','ckb']);
 expect((await pg.query('select paused,status,locale,preferred_locale from conversations where id=$1',[cloudConversation])).rows[0]).toEqual({paused:true,status:'resolved',locale:'ckb',preferred_locale:'ckb'});
 await pg.query('select rp_control_conversation($1,$2,$3,$4,$5)',[orgA,cloudConversation,false,'open',null]);
 expect((await pg.query('select preferred_locale from conversations where id=$1',[cloudConversation])).rows[0]).toEqual({preferred_locale:null});
 expect(JSON.stringify((await pg.query('select action,target_id from audit_events where org_id=$1',[orgA])).rows)).not.toContain('Private synthetic note');
 await pg.exec('reset role');await pg.query("update subscriptions set trial_end=now()-interval '1 day' where org_id=$1",[orgA]);await asUser(userA);
 await expect(pg.query('select rp_intake_conversation($1,$2,$3,$4,$5)',[orgA,'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb','Expired intake','Test message','en'])).rejects.toThrow('inactive');
 await pg.query('select rp_reply_conversation($1,$2,$3,$4,$5)',[orgA,cloudConversation,'cccccccc-cccc-4ccc-accc-cccccccccccc','Human help after expiry',false]);
});

it('keeps cloud provider accounting server-only and reserves retries without double authorization',async()=>{
 await pg.exec('reset role');await pg.query("update subscriptions set trial_end=now()+interval '1 day' where org_id=$1",[orgA]);
 await pg.query("update ai_configurations set provider='gemini',synthetic_data=true,daily_call_limit=2 where org_id=$1",[orgA]);
 const request='dddddddd-dddd-4ddd-addd-dddddddddddd',attempt='eeeeeeee-eeee-4eee-aeee-eeeeeeeeeeee',retry='ffffffff-ffff-4fff-afff-ffffffffffff';
 const args=[userA,orgA,cloudConversation,request,attempt];
 await asUser(userA);await expect(pg.query('select rp_reserve_ai_attempt($1,$2,$3,$4,$5)',args)).rejects.toThrow('permission');
 await expect(pg.query('select * from private.ai_attempts')).rejects.toThrow('permission');
 await pg.exec('reset role;set role service_role');
 await expect(pg.query('select rp_reserve_ai_attempt($1,$2,$3,$4,$5)',[userB,...args.slice(1)])).rejects.toThrow('permission');
 await pg.query('select rp_reserve_ai_attempt($1,$2,$3,$4,$5)',args);
 await expect(pg.query('select rp_reserve_ai_attempt($1,$2,$3,$4,$5)',args)).rejects.toThrow('already reserved');
 await expect(pg.query('select rp_reserve_ai_attempt($1,$2,$3,$4,$5)',[...args.slice(0,4),retry])).rejects.toThrow('Retry unavailable');
 await pg.query("select rp_finish_ai_attempt($1,null,null,null,'503')",[attempt]);
 await pg.query('select rp_reserve_ai_attempt($1,$2,$3,$4,$5)',[...args.slice(0,4),retry]);
 await pg.query('select rp_finish_ai_attempt($1,10,5,15,null)',[retry]);
 await expect(pg.query('select rp_finish_ai_attempt($1,0,0,0,null)',[retry])).rejects.toThrow('Pending');
 await expect(pg.query('select rp_reserve_ai_attempt($1,$2,$3,gen_random_uuid(),gen_random_uuid())',args.slice(0,3))).rejects.toThrow('Daily');
 await pg.exec('reset role');expect((await pg.query('select total_tokens from private.ai_attempts where id=$1',[attempt])).rows[0]).toEqual({total_tokens:null});
 expect((await pg.query('select id from private.ai_requests where org_id=$1',[orgA])).rows).toHaveLength(1);
});

it('enforces cloud trial quota, consent, human takeover and tenant boundaries inside the worker RPC',async()=>{
 await pg.exec('reset role');await pg.query('update ai_configurations set daily_call_limit=30 where org_id=$1',[orgA]);
 await pg.query("update private.ai_attempts set created_at=now()-interval '2 days' where org_id=$1",[orgA]);
 await pg.query("insert into private.ai_requests(id,org_id,conversation_id,actor_id,period_start) select gen_random_uuid(),$1,$2,$3,(select (trial_end-interval '7 days')::date from subscriptions where org_id=$1) from generate_series(1,29)",[orgA,cloudConversation,userA]);
 await pg.exec('set role service_role');
 await expect(pg.query('select rp_reserve_ai_attempt($1,$2,$3,gen_random_uuid(),gen_random_uuid())',[userA,orgA,cloudConversation])).rejects.toThrow('quota');
 await expect(pg.query('select rp_reserve_ai_attempt($1,$2,$3,gen_random_uuid(),gen_random_uuid())',[userB,orgB,cloudConversation])).rejects.toThrow('Conversation');
 await pg.exec('reset role');await pg.query('update conversations set paused=true where id=$1',[cloudConversation]);await pg.exec('set role service_role');
 await expect(pg.query('select rp_reserve_ai_attempt($1,$2,$3,gen_random_uuid(),gen_random_uuid())',[userA,orgA,cloudConversation])).rejects.toThrow('paused');
 await pg.exec('reset role');await pg.query('update conversations set paused=false where id=$1',[cloudConversation]);await pg.query('update ai_configurations set synthetic_data=false where org_id=$1',[orgA]);await pg.exec('set role service_role');
 await expect(pg.query('select rp_reserve_ai_attempt($1,$2,$3,gen_random_uuid(),gen_random_uuid())',[userA,orgA,cloudConversation])).rejects.toThrow('consent');
 await pg.exec('reset role;set role anon');await expect(pg.query("select rp_finish_ai_attempt(gen_random_uuid(),0,0,0,null)")).rejects.toThrow('permission');
});
