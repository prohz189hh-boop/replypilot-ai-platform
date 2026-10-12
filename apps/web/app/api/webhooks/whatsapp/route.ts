import {NextResponse} from 'next/server';
// No public ingress or live sending until Meta authorization and cloud queue deployment are reviewed.
export function GET(){return NextResponse.json({error:'Live WhatsApp webhooks are disabled. Use the authenticated local simulator.'},{status:503,headers:{'Cache-Control':'no-store'}});}
export const POST=GET;
