import {createHmac,timingSafeEqual} from 'node:crypto';
import {invariant} from '../shared';
export function signWebhook(raw:string,secret:string){return 'sha256='+createHmac('sha256',secret).update(raw).digest('hex');}
export function verifyWebhook(raw:string,signature:string|null,secret:string){
 if(!signature||!/^sha256=[a-f0-9]{64}$/i.test(signature)||!secret)return false;
 return timingSafeEqual(Buffer.from(signWebhook(raw,secret).slice(7),'hex'),Buffer.from(signature.slice(7),'hex'));
}
export function verifyChallenge(mode:string|null,token:string|null,challenge:string|null,expected:string){
 invariant(mode==='subscribe'&&!!expected&&!!token&&Buffer.byteLength(token)===Buffer.byteLength(expected)&&timingSafeEqual(Buffer.from(token),Buffer.from(expected))&&!!challenge&&challenge.length<500,'Webhook verification failed.',403);return challenge;
}
export function textPayload(to:string,body:string){return {messaging_product:'whatsapp',recipient_type:'individual',to,type:'text',text:{preview_url:false,body}};}
export interface WhatsAppAdapter {kind:'mock'|'meta-disabled';send(idempotencyKey:string,to:string,body:string):{id:string};}
export class MockWhatsAppAdapter implements WhatsAppAdapter {
 kind='mock' as const;
 send(idempotencyKey:string,to:string,body:string){invariant(to&&body,'A recipient and message are required.');return {id:'mock_'+idempotencyKey};}
}
export class OfficialWhatsAppAdapter implements WhatsAppAdapter {
 kind='meta-disabled' as const;
 send(idempotencyKey:string,to:string,body:string):never {void idempotencyKey;void to;void body;throw new Error('Live Meta sending is disabled.');}
}
