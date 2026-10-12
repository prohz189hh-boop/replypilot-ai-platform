import {createHash,randomBytes} from 'node:crypto';
import {z} from 'zod';
import {all,get,run,id,now,transaction,audit,rateLimit} from './local';
import {requireRole} from './auth';
import {organization} from './business';
import {entitlement,requireFeature} from '../billing';
import {type Actor,type Conversation,invariant} from '../shared';
import {startConversation,customerMessage,staffReply,updateConversation} from './messaging';
import {MockWhatsAppAdapter,signWebhook,verifyWebhook} from '../channels/whatsapp';
type Integration={org_id:string;account_id:string;secret:string;connected:number;automatic:number;daily_limit:number;simulated_cost_micros:number;daily_budget_micros:number};
type Outbox={id:string;org_id:string;conversation_id:string;message_id:string;status:string;attempts:number;next_attempt_at:string|null;provider_id:string|null};
function integration(orgId:string){const r=get<Integration>('SELECT * FROM whatsapp_integrations WHERE org_id=?',orgId);invariant(r,'Configure the WhatsApp simulator first.',409);return r;}
export function whatsappSnapshot(actor:Actor){
 const org=organization(actor),config=get<Integration>('SELECT * FROM whatsapp_integrations WHERE org_id=?',org.id);
 return {mode:'simulation',liveSending:false,config:config?{connected:!!config.connected,automatic:!!config.automatic,dailyLimit:config.daily_limit,simulatedCostMicros:config.simulated_cost_micros,dailyBudgetMicros:config.daily_budget_micros}:null,
  contacts:all("SELECT w.customer_ref,w.conversation_id,w.last_inbound_at,w.opted_out,w.consent_at,c.locale,c.paused FROM whatsapp_contacts w JOIN conversations c ON c.id=w.conversation_id AND c.org_id=w.org_id WHERE w.org_id=? ORDER BY w.last_inbound_at DESC LIMIT 50",org.id),
  messages:all("SELECT m.id,m.conversation_id,m.role,m.body,m.provider,m.created_at,o.id outbox_id,o.status delivery_status,o.attempts,o.error_code,o.next_attempt_at FROM messages m JOIN whatsapp_contacts w ON w.org_id=m.org_id AND w.conversation_id=m.conversation_id LEFT JOIN whatsapp_outbox o ON o.org_id=m.org_id AND o.message_id=m.id WHERE m.org_id=? AND m.role!='note' AND m.kind='sent' ORDER BY m.created_at DESC,m.rowid DESC LIMIT 100",org.id),
  usage:get<{attempts:number;cost_micros:number}>("SELECT COUNT(*) attempts,COALESCE(SUM(cost_micros),0) cost_micros FROM whatsapp_attempts WHERE org_id=? AND substr(created_at,1,10)=?",org.id,now().slice(0,10)),
 };
}
export function configureWhatsApp(actor:Actor,input:unknown){
 requireRole(actor,['owner']);const org=organization(actor);
 const d=z.object({connected:z.boolean(),automatic:z.boolean(),fictionalData:z.literal(true),dailyLimit:z.number().int().min(1).max(200),simulatedCostMicros:z.number().int().min(0).max(1000000).default(0),dailyBudgetMicros:z.number().int().min(0).max(100000000).default(0)}).parse(input);
 if(d.automatic)requireFeature(org,'automatic');
 transaction(()=>{
  run('INSERT INTO whatsapp_integrations(org_id,account_id,secret,connected,automatic,daily_limit,simulated_cost_micros,daily_budget_micros) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(org_id) DO UPDATE SET connected=excluded.connected,automatic=excluded.automatic,daily_limit=excluded.daily_limit,simulated_cost_micros=excluded.simulated_cost_micros,daily_budget_micros=excluded.daily_budget_micros',org.id,'sim_'+id(),randomBytes(32).toString('hex'),Number(d.connected),Number(d.automatic),d.dailyLimit,d.simulatedCostMicros,d.dailyBudgetMicros);
  audit(org.id,actor.id,'whatsapp.simulation_configured',org.id);
 });
}
const wireSchema=z.object({object:z.literal('whatsapp_business_account'),entry:z.array(z.object({changes:z.array(z.object({field:z.literal('messages'),value:z.object({metadata:z.object({phone_number_id:z.string()}),messages:z.array(z.object({id:z.string().min(1).max(100),from:z.string().regex(/^synthetic-[a-zA-Z0-9_-]{1,50}$/),timestamp:z.string().regex(/^\d{1,12}$/),type:z.literal('text'),text:z.object({body:z.string().trim().min(1).max(2000)})})).length(1)})})).length(1)})).length(1)});
export async function receiveSimulatedWebhook(accountId:string,raw:string,signature:string){
 invariant(Buffer.byteLength(raw)<=64000,'Webhook too large.',413);
 const config=get<Integration>('SELECT * FROM whatsapp_integrations WHERE account_id=?',accountId);
 invariant(config&&verifyWebhook(raw,signature,config.secret),'Invalid webhook signature.',401);
 invariant(config.connected,'WhatsApp simulation is disconnected.',409);
 const value=wireSchema.parse(JSON.parse(raw)).entry[0].changes[0].value;
 invariant(value.metadata.phone_number_id===accountId,'Webhook account mismatch.',403);
 const incoming=value.messages[0],receivedAt=new Date(Number(incoming.timestamp)*1000);
 invariant(Number.isFinite(receivedAt.getTime())&&receivedAt.getTime()<=Date.now()+60000,'Invalid message timestamp.');
 const fingerprint=createHash('sha256').update(JSON.stringify(incoming)).digest('hex');
 const event=transaction(()=>{
  const existing=get<{fingerprint:string;status:string;conversation_id:string;message_id:string}>('SELECT * FROM whatsapp_events WHERE org_id=? AND event_id=?',config.org_id,incoming.id);
  if(existing){invariant(existing.fingerprint===fingerprint,'Webhook ID already used.',409);return {...existing,duplicate:true};}
  let contact=get<{conversation_id:string}>('SELECT conversation_id FROM whatsapp_contacts WHERE org_id=? AND customer_ref=?',config.org_id,incoming.from);
  if(!contact){const c=startConversation(config.org_id,{name:incoming.from});contact={conversation_id:c.id};run('INSERT INTO whatsapp_contacts(org_id,customer_ref,conversation_id,last_inbound_at) VALUES(?,?,?,?)',config.org_id,incoming.from,c.id,receivedAt.toISOString());}
  else run('UPDATE whatsapp_contacts SET last_inbound_at=MAX(last_inbound_at,?) WHERE org_id=? AND customer_ref=?',receivedAt.toISOString(),config.org_id,incoming.from);
  const command=incoming.text.body.trim().toUpperCase();
  if(command==='STOP'||command==='START'){
   // Newer consent wins; at equal timestamps STOP wins conservatively.
   run('UPDATE whatsapp_contacts SET opted_out=?,consent_at=? WHERE org_id=? AND customer_ref=? AND (consent_at IS NULL OR consent_at<? OR (consent_at=? AND ?=1))',Number(command==='STOP'),receivedAt.toISOString(),config.org_id,incoming.from,receivedAt.toISOString(),receivedAt.toISOString(),Number(command==='STOP'));
   const contactState=get<{opted_out:number}>('SELECT opted_out FROM whatsapp_contacts WHERE org_id=? AND customer_ref=?',config.org_id,incoming.from)!;
   if(contactState.opted_out)run("UPDATE whatsapp_outbox SET status='cancelled',error_code='customer_opted_out',next_attempt_at=NULL WHERE org_id=? AND conversation_id=? AND status IN ('queued','failed')",config.org_id,contact.conversation_id);
   audit(config.org_id,'synthetic-customer',command==='STOP'?'whatsapp.stop_received':'whatsapp.start_received',contact.conversation_id);
  }
  const messageId=id();run('INSERT INTO whatsapp_events(org_id,event_id,fingerprint,status,conversation_id,message_id,created_at,error_code,received_at) VALUES(?,?,?,?,?,?,?,?,?)',config.org_id,incoming.id,fingerprint,'processing',contact.conversation_id,messageId,now(),null,receivedAt.toISOString());
  return {conversation_id:contact.conversation_id,message_id:messageId,status:'processing',duplicate:false};
 });
 if(event.duplicate)return {duplicate:true,conversationId:event.conversation_id};
 try{
  const c=get<Conversation>('SELECT * FROM conversations WHERE org_id=? AND id=?',config.org_id,event.conversation_id)!;
  const withinWindow=Date.now()-receivedAt.getTime()<86400000;
  const consent=get<{opted_out:number;consent_at:string|null}>('SELECT opted_out,consent_at FROM whatsapp_contacts WHERE org_id=? AND conversation_id=?',config.org_id,c.id)!;
  const consentCommand=/^(STOP|START)$/i.test(incoming.text.body.trim());
  await customerMessage(c,{body:incoming.text.body,requestId:event.message_id},!!config.automatic&&withinWindow&&!consent.opted_out&&!consentCommand);
  transaction(()=>{
   const current=get<{consent_at:string|null}>('SELECT consent_at FROM whatsapp_contacts WHERE org_id=? AND conversation_id=?',config.org_id,c.id)!;
   enqueueConversation(config.org_id,c.id,current.consent_at!==consent.consent_at);
   run("UPDATE whatsapp_events SET status='processed' WHERE org_id=? AND event_id=?",config.org_id,incoming.id);
  });
  return {duplicate:false,conversationId:c.id};
 }catch(error){run("UPDATE whatsapp_events SET status='failed',error_code='processing_failed' WHERE org_id=? AND event_id=?",config.org_id,incoming.id);throw error;}
}
function enqueueConversation(orgId:string,conversationId:string,cancel=false){
 const consent=get<{opted_out:number}>('SELECT opted_out FROM whatsapp_contacts WHERE org_id=? AND conversation_id=?',orgId,conversationId)!;
 const status=cancel||consent.opted_out?'cancelled':'queued';
 for(const message of all<{id:string}>("SELECT id FROM messages WHERE org_id=? AND conversation_id=? AND kind='sent' AND role IN ('assistant','staff')",orgId,conversationId))
  run("INSERT OR IGNORE INTO whatsapp_outbox(id,org_id,conversation_id,message_id,status,created_at) VALUES(?,?,?,?,?,?)",id(),orgId,conversationId,message.id,status,now());
}
export async function simulateIncoming(actor:Actor,input:unknown){
 requireRole(actor,['owner','manager','staff']);const org=organization(actor),config=integration(org.id);rateLimit('whatsapp-in:'+org.id,60);
 const d=z.object({eventId:z.uuid(),customerRef:z.string().regex(/^synthetic-[a-zA-Z0-9_-]{1,50}$/),body:z.string().trim().min(1).max(2000),timestamp:z.number().int().positive().optional()}).parse(input);
 const prior=get<{received_at:string|null}>('SELECT received_at FROM whatsapp_events WHERE org_id=? AND event_id=?',org.id,d.eventId);
 // A retry that omits timestamp reuses the original envelope time, never extending its service window.
 const timestamp=d.timestamp??(prior?.received_at?Math.floor(new Date(prior.received_at).getTime()/1000):Math.floor(Date.now()/1000));
 const raw=JSON.stringify({object:'whatsapp_business_account',entry:[{changes:[{field:'messages',value:{metadata:{phone_number_id:config.account_id},messages:[{id:d.eventId,from:d.customerRef,timestamp:String(timestamp),type:'text',text:{body:d.body}}]}}]}]});
 const result=await receiveSimulatedWebhook(config.account_id,raw,signWebhook(raw,config.secret));
 if(!result.duplicate){for(const out of all<{id:string}>("SELECT id FROM whatsapp_outbox WHERE org_id=? AND conversation_id=? AND status='queued'",org.id,result.conversationId)){
  try{deliverSimulated(actor,{id:out.id});}catch{run("UPDATE whatsapp_outbox SET error_code='delivery_blocked' WHERE org_id=? AND id=?",org.id,out.id);}
 }}
 return result;
}
export function deliverSimulated(actor:Actor,input:unknown){
 requireRole(actor,['owner','manager','staff']);const org=organization(actor);
 const d=z.object({id:z.uuid(),fail:z.boolean().default(false)}).parse(input);
 return transaction(()=>{
  const config=integration(org.id),out=get<Outbox>('SELECT * FROM whatsapp_outbox WHERE org_id=? AND id=?',org.id,d.id);
  invariant(out,'Outgoing message not found.',404);
  if(['sent','delivered','read'].includes(out.status))return {status:out.status};
  invariant(config.connected,'WhatsApp simulation is disconnected.',409);
  invariant(out.status!=='cancelled','Delivery was cancelled.',409);
  invariant(entitlement(org).active,'Subscription inactive.',403);
  invariant(out.attempts<3,'Delivery retry limit reached.',409);
  invariant(!out.next_attempt_at||new Date(out.next_attempt_at)<=new Date(),'Retry is not due yet.',429);
  const contact=get<{customer_ref:string;last_inbound_at:string;opted_out:number}>('SELECT * FROM whatsapp_contacts WHERE org_id=? AND conversation_id=?',org.id,out.conversation_id)!;
  invariant(!contact.opted_out,'Customer opted out of messaging.',409);
  invariant(Date.now()-new Date(contact.last_inbound_at).getTime()<86400000,'The 24-hour service window is closed. Templates are disabled.',409);
  const message=get<{body:string;provider:string;role:string}>('SELECT body,provider,role FROM messages WHERE org_id=? AND id=?',org.id,out.message_id)!;
  const c=get<Conversation>('SELECT * FROM conversations WHERE org_id=? AND id=?',org.id,out.conversation_id)!;
  if(message.provider!=='human')invariant(config.automatic&&!c.paused&&!org.paused&&org.ai_mode==='automatic'&&entitlement(org).automatic,'Automation is paused. Staff can reply manually.',409);
  const used=get<{n:number;cost:number}>("SELECT COUNT(*) n,COALESCE(SUM(cost_micros),0) cost FROM whatsapp_attempts WHERE org_id=? AND substr(created_at,1,10)=?",org.id,now().slice(0,10))!;
  invariant(used.n<config.daily_limit,'Daily WhatsApp attempt limit reached.',429);
  invariant(used.cost+config.simulated_cost_micros<=config.daily_budget_micros,'Simulated spending limit reached.',403);
  run('INSERT INTO whatsapp_attempts VALUES(?,?,?,?,?,?)',id(),org.id,out.id,config.simulated_cost_micros,d.fail?'failed':'sent',now());
  const providerId=d.fail?null:new MockWhatsAppAdapter().send(out.id,contact.customer_ref,message.body).id;
  run('UPDATE whatsapp_outbox SET status=?,attempts=attempts+1,provider_id=?,error_code=?,next_attempt_at=? WHERE org_id=? AND id=?',d.fail?'failed':'sent',providerId,d.fail?'simulated_transport_failure':null,d.fail?new Date(Date.now()+1000*2**out.attempts).toISOString():null,org.id,out.id);
  return {status:d.fail?'failed':'sent'};
 });
}
export function simulateReceipt(actor:Actor,input:unknown){
 requireRole(actor,['owner','manager','staff']);const org=organization(actor),d=z.object({id:z.uuid(),status:z.enum(['delivered','read'])}).parse(input);
 const out=get<Outbox>('SELECT * FROM whatsapp_outbox WHERE org_id=? AND id=?',org.id,d.id);invariant(out,'Outgoing message not found.',404);
 invariant(['sent','delivered','read'].includes(out.status),'Message has not been sent.',409);
 if(out.status!=='read')run('UPDATE whatsapp_outbox SET status=? WHERE org_id=? AND id=?',d.status,org.id,d.id);
}
export function whatsappTakeover(actor:Actor,input:unknown){
 const d=z.object({conversationId:z.uuid(),paused:z.boolean()}).parse(input);const org=organization(actor);
 invariant(get('SELECT 1 FROM whatsapp_contacts WHERE org_id=? AND conversation_id=?',org.id,d.conversationId),'WhatsApp contact not found.',404);
 updateConversation(actor,{id:d.conversationId,paused:d.paused,status:'open'});
}
export function whatsappStaffReply(actor:Actor,input:unknown){
 const d=z.object({conversationId:z.uuid(),body:z.string().trim().min(1).max(4000)}).parse(input);const org=organization(actor);
 invariant(get('SELECT 1 FROM whatsapp_contacts WHERE org_id=? AND conversation_id=?',org.id,d.conversationId),'WhatsApp contact not found.',404);
 transaction(()=>{
  invariant(!get<{opted_out:number}>('SELECT opted_out FROM whatsapp_contacts WHERE org_id=? AND conversation_id=?',org.id,d.conversationId)!.opted_out,'Customer opted out of messaging.',409);
  staffReply(actor,d);enqueueConversation(org.id,d.conversationId);
 });
}
