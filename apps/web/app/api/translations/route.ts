import { NextResponse } from 'next/server';
import { z } from 'zod';
import { actor,body,failure,localOnly } from '@/lib/http';
import { translationReviews,submitTranslation,reviewTranslation } from '@reply/database/translations';
export async function GET(request:Request){try{localOnly(request);return NextResponse.json({reviews:translationReviews(await actor())});}catch(error){return failure(error);}}
export async function POST(request:Request){try{const user=await actor();const input=z.object({action:z.enum(['submit','review']),data:z.unknown()}).parse(await body(request));if(input.action==='submit')return NextResponse.json({id:submitTranslation(user,input.data)});reviewTranslation(user,input.data);return NextResponse.json({ok:true});}catch(error){return failure(error);}}
