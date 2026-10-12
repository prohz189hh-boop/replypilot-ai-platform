import {NextResponse} from 'next/server';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {cloudActor} from '@/lib/supabase';
import {failure,localOnly} from '@/lib/http';
import {invariant} from '@reply/shared';
import {sanitizeImage} from '@reply/database/uploads';
export async function POST(request:Request){
 try{
  localOnly(request);invariant(request.headers.get('origin')===process.env.REPLYPILOT_ORIGIN,'Request origin not allowed.',403);
  const {client,user}=await cloudActor();
  const form=await request.formData();const productId=z.uuid().parse(form.get('productId'));const file=form.get('image');
  invariant(file instanceof File&&file.size<=3*1024*1024,'Choose an image up to 3 MB.');
  const member=await client.from('organization_members').select('org_id,role').eq('user_id',user.id).single();invariant(member.data&&['owner','manager'].includes(member.data.role),'Image permission denied.',403);
  const bytes=await sanitizeImage(Buffer.from(await file.arrayBuffer()),file.type);
  const path=member.data.org_id+'/'+productId+'/'+randomUUID()+'.webp';
  const result=await client.storage.from('replypilot-products').upload(path,bytes,{contentType:'image/webp',upsert:false});invariant(!result.error,'Image upload rejected.',400);
  return NextResponse.json({path},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return failure(error);}
}
export async function GET(request:Request){
 try{
  localOnly(request);const {client}=await cloudActor();const path=new URL(request.url).searchParams.get('path');invariant(path&&path.length<300,'Image path required.');
  const {data,error}=await client.storage.from('replypilot-products').download(path);invariant(!error&&data,'Image not found.',404);
  return new Response(data,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 }catch(error){return failure(error);}
}
