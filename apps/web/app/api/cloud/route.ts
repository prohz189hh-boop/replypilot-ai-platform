import {NextResponse} from 'next/server';
import {z} from 'zod';
import {body,failure,localOnly} from '@/lib/http';
import {detectLanguage} from '@reply/localization';
import {cloudActor,cloudClient} from '@/lib/supabase';
import {rateLimit} from '@reply/database/local';
import {invariant,productSchema,localeSchema,industries} from '@reply/shared';
export const runtime='nodejs';
const reply=(data:unknown)=>NextResponse.json(data,{headers:{'Cache-Control':'private, no-store'}});
export async function GET(request:Request){
 try{
  localOnly(request);const {client,user}=await cloudActor();
  const membership=await client.from('organization_members').select('org_id,role').eq('user_id',user.id).maybeSingle();
  invariant(!membership.error,'Cloud membership could not be loaded.',502);
  if(!membership.data)return reply({user:{id:user.id,email:user.email},org:null});
  const orgId=membership.data.org_id;
  const params=new URL(request.url).searchParams;
  if(params.has('conversation')){
   const conversation=z.uuid().parse(params.get('conversation'));
   const found=await client.from('conversations').select('id').eq('org_id',orgId).eq('id',conversation).maybeSingle();
   invariant(!found.error,'Cloud conversation could not be loaded.',502);invariant(found.data,'Conversation not found.',404);
   let query=client.from('messages').select('id,role,body,kind,provider,created_at').eq('org_id',orgId).eq('conversation_id',conversation).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(51);
   if(params.has('before')){
    const cursor=z.object({at:z.iso.datetime({offset:true}),id:z.uuid()}).parse(JSON.parse(Buffer.from(params.get('before')!,'base64url').toString()));
    query=query.or(`created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`);
   }
   const result=await query;invariant(!result.error,'Cloud history could not be loaded.',502);
   const rows=(result.data||[]).slice(0,50),last=rows.at(-1);
   return reply({messages:rows.reverse(),nextCursor:result.data!.length>50&&last?Buffer.from(JSON.stringify({at:last.created_at,id:last.id})).toString('base64url'):null});
  }
  const results=await Promise.all([
   client.from('organizations').select('*').eq('id',orgId).single(),
   client.from('products').select('*,categories(name)').eq('org_id',orgId).order('created_at',{ascending:false}).limit(100),
   client.from('orders').select('*,order_items(*)').eq('org_id',orgId).order('created_at',{ascending:false}).limit(100),
   client.from('subscriptions').select('*').eq('org_id',orgId).single(),
   client.rpc('rp_dashboard_summary',{p_org:orgId}),
   client.from('conversations').select('id,status,locale,preferred_locale,paused,updated_at,customers(display_name)').eq('org_id',orgId).order('updated_at',{ascending:false}).limit(100)
  ]);
  invariant(results.every(r=>!r.error),'Cloud workspace could not be loaded.',502);
  return reply({user:{id:user.id,email:user.email},role:membership.data.role,org:results[0].data,products:results[1].data,orders:results[2].data,subscription:results[3].data,summary:results[4].data,conversations:results[5].data});
 }catch(error){return failure(error);}
}
export async function POST(request:Request){
 try{
  const input=z.object({action:z.string(),data:z.unknown()}).parse(await body(request));
  if(['login','register','logout','refresh'].includes(input.action)){
   rateLimit('cloud-auth',30);const client=await cloudClient();
   if(input.action==='logout'){const {error}=await client.auth.signOut();invariant(!error,'Sign out failed.',502);return reply({ok:true});}
   if(input.action==='refresh'){const {error}=await client.auth.refreshSession();invariant(!error,'Cloud sign-in required.',401);return reply({ok:true});}
   const credentials=z.object({email:z.email(),password:z.string().min(12).max(128)}).parse(input.data);
   const result=input.action==='login'?await client.auth.signInWithPassword(credentials):await client.auth.signUp(credentials);
   invariant(!result.error,input.action==='login'?'Cloud sign-in failed. Check your credentials and email confirmation.':'Cloud registration failed. Check the details or try later.',400);
   return reply({ok:true,confirmationRequired:!result.data.session});
  }
  const {client,user}=await cloudActor();rateLimit('cloud:'+user.id,120);
  if(input.action==='onboard'){
   const d=z.object({name:z.string().min(2).max(100),industry:z.enum(industries),locale:localeSchema,currency:z.enum(['IQD','USD','EUR'])}).parse(input.data);
   const result=await client.rpc('rp_onboard',{p_name:d.name,p_industry:d.industry,p_locale:d.locale,p_currency:d.currency});
   invariant(!result.error,'Could not create cloud workspace. You may already have one.',400);return reply({id:result.data});
  }
  const membership=await client.from('organization_members').select('org_id').eq('user_id',user.id).single();invariant(membership.data,'Create a cloud workspace first.',409);
  const orgId=membership.data.org_id;let result;
  switch(input.action){
   case 'conversation.intake':{
    const d=z.object({requestId:z.uuid(),name:z.string().trim().min(2).max(100),body:z.string().trim().min(1).max(2000)}).parse(input.data);
    result=await client.rpc('rp_intake_conversation',{p_org:orgId,p_request:d.requestId,p_name:d.name,p_body:d.body,p_locale:detectLanguage(d.body,'en').locale});break;
   }
   case 'conversation.reply':{
    const d=z.object({conversationId:z.uuid(),requestId:z.uuid(),body:z.string().trim().min(1).max(4000),note:z.boolean()}).parse(input.data);
    result=await client.rpc('rp_reply_conversation',{p_org:orgId,p_conversation:d.conversationId,p_request:d.requestId,p_body:d.body,p_note:d.note});break;
   }
   case 'conversation.control':{
    const d=z.object({conversationId:z.uuid(),paused:z.boolean(),status:z.enum(['open','unread','resolved']),locale:localeSchema.nullable()}).parse(input.data);
    result=await client.rpc('rp_control_conversation',{p_org:orgId,p_conversation:d.conversationId,p_paused:d.paused,p_status:d.status,p_locale:d.locale});break;
   }
   case 'product.save':result=await client.rpc('rp_save_product',{p_org:orgId,p_data:productSchema.parse(input.data)});break;
   case 'order.request':{
    const d=z.object({requestId:z.uuid(),customerName:z.string().min(2).max(100),items:z.array(z.object({productId:z.uuid(),variantId:z.uuid().optional(),quantity:z.number().int().min(1).max(100)})).min(1).max(20),fulfillment:z.enum(['pickup','delivery_request'])}).parse(input.data);
    result=await client.rpc('rp_request_order',{p_org:orgId,p_request:d.requestId,p_customer:d.customerName,p_items:d.items,p_fulfillment:d.fulfillment});break;
   }
   case 'order.update':{const d=z.object({id:z.uuid(),status:z.enum(['confirmed','processing','ready','completed','cancelled'])}).parse(input.data);result=await client.rpc('rp_update_order',{p_org:orgId,p_order:d.id,p_status:d.status});break;}
   default:throw new Error('Unsupported action');
  }
  if(result.error){const safe=['Product changed; refresh before saving','Insufficient stock','Invalid order transition','Product limit reached','Subscription inactive','Order request ID already used'];invariant(false,safe.includes(result.error.message)?result.error.message:'Cloud operation was rejected. Check your permissions and data.',409);}
  return reply({ok:true,id:result.data});
 }catch(error){return failure(error);}
}
