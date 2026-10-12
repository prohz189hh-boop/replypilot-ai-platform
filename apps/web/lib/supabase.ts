import {cookies} from 'next/headers';
import {createServerClient} from '@supabase/ssr';
import {invariant} from '@reply/shared';
export async function cloudClient(){
 const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
 invariant(url&&key,'Cloud development configuration missing.',503);
 const jar=await cookies();
 return createServerClient(url,key,{cookieOptions:{name:'rp_cloud',httpOnly:true,sameSite:'lax',secure:url.startsWith('https:')&&process.env.REPLYPILOT_LOCAL_DEV!=='1',path:'/'},cookies:{getAll:()=>jar.getAll(),setAll:(values)=>{for(const {name,value,options} of values)jar.set(name,value,options);}}});
}
export async function cloudActor(){
 const client=await cloudClient();
 const {data,error}=await client.auth.getUser();
 invariant(!error&&data.user,'Cloud sign-in required.',401);
 return {client,user:data.user};
}
