import {invariant} from '../shared';
export async function boundedJson(request:Request,maxBytes=64_000){
 const length=request.headers.get('content-length');
 if(length!==null)invariant(/^\d+$/.test(length)&&Number(length)<=maxBytes,'Request too large.',413);
 const reader=request.body?.getReader();if(!reader)return JSON.parse('');
 const chunks:Uint8Array[]=[];let total=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){await reader.cancel();invariant(false,'Request too large.',413);}chunks.push(value);}
 }finally{reader.releaseLock();}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
