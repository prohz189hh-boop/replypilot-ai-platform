import {beforeEach,afterAll,it,expect} from 'vitest';
import {mkdirSync,mkdtempSync} from 'node:fs';
import path from 'node:path';
import {register,actorForToken,login} from '../packages/database/auth';
import {onboard,saveProduct,addMember} from '../packages/database/business';
import {closeDatabase,get,run,id} from '../packages/database/local';
import {configureWhatsApp,simulateIncoming,whatsappSnapshot,whatsappTakeover,whatsappStaffReply,deliverSimulated,simulateReceipt,receiveSimulatedWebhook} from '../packages/database/whatsapp';
import {signWebhook,verifyWebhook,verifyChallenge,OfficialWhatsAppAdapter} from '../packages/channels/whatsapp';
import type {Actor} from '../packages/shared';
let owner:Actor,other:Actor;
const password='Fictional-WhatsApp-2026';
const config={connected:true,automatic:true,fictionalData:true,dailyLimit:30,simulatedCostMicros:0,dailyBudgetMicros:0};
const input=()=>({eventId:id(),customerRef:'synthetic-buyer',body:'ez dixwazim laptop RTX 4060 bikirim',timestamp:Math.floor(Date.now()/1000)});
beforeEach(()=>{
 closeDatabase();mkdirSync('work',{recursive:true});process.env.REPLYPILOT_LOCAL_DEV='1';process.env.REPLYPILOT_DATA_DIR=mkdtempSync(path.resolve('work/whatsapp-'));
 const setup=(email:string)=>{const a=actorForToken(register({email,password,name:'Synthetic Owner'}));onboard(a,{name:'Synthetic Shop',industry:'electronics',locale:'en',currency:'IQD'});return actorForToken(login({email,password}));};
 owner=setup('wa-a@example.test');other=setup('wa-b@example.test');
 saveProduct(owner,{name:'Atlas Laptop RTX 4060',price:1000000,stock:3,currency:'IQD'});
 run("UPDATE organizations SET ai_mode='automatic' WHERE id=?",owner.org_id!);configureWhatsApp(owner,config);configureWhatsApp(other,config);
});
afterAll(()=>closeDatabase());
it('verifies exact raw-body signatures, challenges and disabled live transport',()=>{
 const raw='{"test":true}',signed=signWebhook(raw,'test-secret');expect(verifyWebhook(raw,signed,'test-secret')).toBe(true);
 expect(verifyWebhook(raw+' ',signed,'test-secret')).toBe(false);expect(verifyWebhook(raw,'sha256=x','test-secret')).toBe(false);
 expect(verifyChallenge('subscribe','token','123','token')).toBe('123');expect(()=>verifyChallenge('subscribe','other','123','token')).toThrow();
 expect(()=>new OfficialWhatsAppAdapter().send('id','recipient','body')).toThrow('disabled');
});
it('runs Romanized Badini through catalog, mock AI, usage and simulated delivery exactly once',async()=>{
 const data=input();const r=await simulateIncoming(owner,data);expect((await simulateIncoming(owner,data)).duplicate).toBe(true);
 const snapshot=whatsappSnapshot(owner);expect(snapshot.contacts).toHaveLength(1);
 const reply=get<{body:string;provider:string}>("SELECT body,provider FROM messages WHERE org_id=? AND role='assistant'",owner.org_id!)!;
 expect(reply.provider).toBe('mock');expect(reply.body).toContain('کاتەلۆگێ');expect(reply.body).toContain('Atlas Laptop RTX 4060');
 expect(get<{locale:string}>('SELECT locale FROM conversations WHERE id=?',r.conversationId)?.locale).toBe('bad');
 expect(get<{n:number}>('SELECT COUNT(*) n FROM usage_records')?.n).toBe(1);
 expect(get<{status:string;attempts:number}>('SELECT status,attempts FROM whatsapp_outbox')).toEqual({status:'sent',attempts:1});
 expect(JSON.stringify(snapshot)).not.toContain('secret');
 await expect(simulateIncoming(owner,{...data,body:'Different text'})).rejects.toThrow('already used');
});
it('isolates accounts, statistics, conversations and outgoing message actions',async()=>{
 await simulateIncoming(owner,input());const out=get<{id:string}>('SELECT id FROM whatsapp_outbox')!;
 expect(whatsappSnapshot(other).contacts).toEqual([]);expect(whatsappSnapshot(other).messages).toEqual([]);
 expect(()=>deliverSimulated(other,{id:out.id})).toThrow('not found');expect(()=>simulateReceipt(other,{id:out.id,status:'read'})).toThrow('not found');
 const a=get<{account_id:string}>('SELECT account_id FROM whatsapp_integrations WHERE org_id=?',owner.org_id!)!;
 await expect(receiveSimulatedWebhook(a.account_id,'{}','sha256='+'0'.repeat(64))).rejects.toThrow('signature');
});
it('honors automatic off and human takeover, while attributing staff replies honestly',async()=>{
 configureWhatsApp(owner,{...config,automatic:false});const r=await simulateIncoming(owner,input());expect(get('SELECT id FROM whatsapp_outbox')).toBeUndefined();
 configureWhatsApp(owner,config);whatsappTakeover(owner,{conversationId:r.conversationId,paused:true});
 await simulateIncoming(owner,input());expect(get('SELECT id FROM usage_records')).toBeUndefined();
 whatsappStaffReply(owner,{conversationId:r.conversationId,body:'Synthetic staff reply'});const out=get<{id:string}>('SELECT id FROM whatsapp_outbox')!;
 expect(get<{provider:string}>("SELECT provider FROM messages WHERE role='staff'")?.provider).toBe('human');
 expect(deliverSimulated(owner,{id:out.id}).status).toBe('sent');simulateReceipt(owner,{id:out.id,status:'read'});simulateReceipt(owner,{id:out.id,status:'delivered'});
 expect(get<{status:string}>('SELECT status FROM whatsapp_outbox')?.status).toBe('read');
});
it('enforces the service window before AI generation and before manual delivery',async()=>{
 const r=await simulateIncoming(owner,{...input(),timestamp:Math.floor(Date.now()/1000)-86401});expect(get('SELECT id FROM usage_records')).toBeUndefined();
 whatsappStaffReply(owner,{conversationId:r.conversationId,body:'Too late'});const out=get<{id:string}>('SELECT id FROM whatsapp_outbox')!;
 expect(()=>deliverSimulated(owner,{id:out.id})).toThrow('24-hour');expect(get('SELECT id FROM whatsapp_attempts')).toBeUndefined();
});
it('bounds retry attempts and enforces backoff without duplicate sends',async()=>{
 configureWhatsApp(owner,{...config,automatic:false});const r=await simulateIncoming(owner,input());whatsappStaffReply(owner,{conversationId:r.conversationId,body:'Retry me'});const out=get<{id:string}>('SELECT id FROM whatsapp_outbox')!;
 expect(deliverSimulated(owner,{id:out.id,fail:true}).status).toBe('failed');expect(()=>deliverSimulated(owner,{id:out.id})).toThrow('not due');
 run('UPDATE whatsapp_outbox SET next_attempt_at=NULL WHERE id=?',out.id);expect(deliverSimulated(owner,{id:out.id}).status).toBe('sent');
 deliverSimulated(owner,{id:out.id});expect(get<{n:number}>('SELECT COUNT(*) n FROM whatsapp_attempts')?.n).toBe(2);
});
it('blocks simulated spending and daily limits, and denies staff configuration changes',async()=>{
 configureWhatsApp(owner,{...config,automatic:false,simulatedCostMicros:100,dailyBudgetMicros:0});const r=await simulateIncoming(owner,input());whatsappStaffReply(owner,{conversationId:r.conversationId,body:'Budget test'});const out=get<{id:string}>('SELECT id FROM whatsapp_outbox')!;
 expect(()=>deliverSimulated(owner,{id:out.id})).toThrow('spending');
 configureWhatsApp(owner,{...config,automatic:false,dailyLimit:1});deliverSimulated(owner,{id:out.id,fail:true});run('UPDATE whatsapp_outbox SET next_attempt_at=NULL WHERE id=?',out.id);expect(()=>deliverSimulated(owner,{id:out.id})).toThrow('Daily');
 const staff=actorForToken(register({email:'wa-staff@example.test',password,name:'Staff'}));addMember(owner,{email:staff.email,role:'staff'});
 expect(()=>configureWhatsApp(actorForToken(login({email:staff.email,password})),config)).toThrow('permission');
});
