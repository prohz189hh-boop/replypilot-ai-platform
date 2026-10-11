import { NextResponse } from 'next/server';
import { actor,failure,localOnly } from '@/lib/http';
import { organization,products,productCount } from '@reply/database/business';
export const runtime='nodejs';
export async function GET(request:Request){
  try {
    localOnly(request);
    const org=organization(await actor());
    const params=new URL(request.url).searchParams;
    const query=(params.get('q')||'').slice(0,200);
    const archived=params.get('archived')==='true';
    const total=productCount(org.id,query,archived);
    const pages=Math.max(1,Math.ceil(total/100));
    const page=Math.min(pages,Math.max(1,Math.floor(Number(params.get('page'))||1)));
    return NextResponse.json({products:products(org.id,query,page,archived),total,page,pages});
  }catch(error){return failure(error);}
}
