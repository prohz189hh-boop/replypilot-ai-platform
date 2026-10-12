import {NextResponse} from 'next/server';
import {z} from 'zod';
import {actor,body,failure,localOnly} from '@/lib/http';
import {whatsappSnapshot,configureWhatsApp,simulateIncoming,deliverSimulated,simulateReceipt,whatsappTakeover,whatsappStaffReply} from '@reply/database/whatsapp';
export async function GET(request:Request){try{localOnly(request);return NextResponse.json(whatsappSnapshot(await actor()),{headers:{'Cache-Control':'private, no-store'}});}catch(e){return failure(e);}}
export async function POST(request:Request){
 try{const user=await actor(),input=z.object({action:z.enum(['configure','incoming','deliver','receipt','takeover','reply']),data:z.unknown()}).parse(await body(request));let result:unknown;
 switch(input.action){
  case 'configure':result=configureWhatsApp(user,input.data);break;
  case 'incoming':result=await simulateIncoming(user,input.data);break;
  case 'deliver':result=deliverSimulated(user,input.data);break;
  case 'receipt':result=simulateReceipt(user,input.data);break;
  case 'takeover':result=whatsappTakeover(user,input.data);break;
  case 'reply':result=whatsappStaffReply(user,input.data);break;
 }
 return NextResponse.json({ok:true,result},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){return failure(e);}
}
