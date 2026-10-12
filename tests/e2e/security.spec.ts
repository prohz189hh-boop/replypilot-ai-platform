import {test,expect} from '@playwright/test';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {hasCredential} from '../../scripts/audit-secrets.mjs';
const privateValues=()=>['.env.local','.env.cloud-test'].flatMap(file=>existsSync(file)?Object.entries(parseEnv(readFileSync(file,'utf8'))).filter(([name,value])=>/(?:API_KEY|ADMIN_KEY|SECRET|PASSWORD|TOKEN)$/.test(name)&&!!value&&value.length>=12).map(([,value])=>value):[]);
test('production browser bundles contain no configured credential',()=>{
 const secrets=privateValues(),root=path.resolve('apps/web/.next/static');let count=0;
 const scan=(dir:string)=>{for(const entry of readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())scan(file);else{expect(hasCredential(readFileSync(file),secrets),'Credential audit failed in '+path.relative(root,file)).toBe(false);count++;}}};
 scan(root);expect(count).toBeGreaterThan(0);
});
test('AI APIs require authorization and tenant capabilities without exposing configuration',async({page,browser,request})=>{
 const secrets=privateValues(),headers={Origin:'http://127.0.0.1:3100'};
 const safe=async(response:Awaited<ReturnType<typeof request.get>>)=>{const text=await response.text();expect(hasCredential(Buffer.from(text),secrets)).toBe(false);return JSON.parse(text);};
 const unauth=await request.post('/api/workspace',{headers,data:{action:'suggest',data:{conversationId:crypto.randomUUID(),requestId:crypto.randomUUID()}}});expect(unauth.status()).toBe(401);await safe(unauth);
 const diagnostic=await request.post('/api/demo',{headers,data:{question:'RTX 4060',locale:'en',gemini:true}});expect(diagnostic.status()).toBe(401);await safe(diagnostic);
 async function setup(client:typeof page.request,email:string){expect((await client.post('/api/auth',{headers,data:{action:'register',name:'Security owner',email,password:'Fictional-Security-2026'}})).ok()).toBe(true);expect((await client.post('/api/workspace',{headers,data:{action:'onboard',data:{name:'Security shop',industry:'electronics',locale:'en',currency:'IQD'}}})).ok()).toBe(true);return safe(await client.get('/api/workspace'));}
 const a=await setup(page.request,'security-a@example.test');
 const ordinary=await page.request.post('/api/demo',{headers,data:{question:'RTX 4060',locale:'en',gemini:true}});expect(ordinary.status()).toBe(403);await safe(ordinary);
 const other=await browser.newContext();const otherPage=await other.newPage();const b=await setup(otherPage.request,'security-b@example.test');
 const session=await (await request.post('/api/chat/'+a.org.id,{headers,data:{action:'start',data:{name:'Synthetic customer'}}})).json();
 const attack=await otherPage.request.post('/api/workspace',{headers,data:{action:'suggest',data:{conversationId:session.id,requestId:crypto.randomUUID()}}});expect(attack.status()).toBe(404);await safe(attack);
 const tokenAttack=await request.post('/api/chat/'+b.org.id,{headers:{...headers,Authorization:'Bearer '+session.token},data:{action:'message',conversationId:session.id,data:{body:'RTX 4060',requestId:crypto.randomUUID()}}});expect(tokenAttack.status()).toBe(404);await safe(tokenAttack);
 const missing=await request.post('/api/chat/'+a.org.id,{headers,data:{action:'message',conversationId:session.id,data:{body:'RTX 4060',requestId:crypto.randomUUID()}}});expect(missing.status()).toBe(404);await safe(missing);
 const malformed=await request.post('/api/demo',{headers:{...headers,'Content-Type':'application/json'},data:'{' });expect(malformed.status()).toBe(400);await safe(malformed);
 const oversized=await request.post('/api/demo',{headers,data:{question:'x'.repeat(65000),locale:'en'}});expect(oversized.status()).toBe(413);await safe(oversized);
 await safe(await request.get('/api/chat/'+a.org.id));await page.goto('/dashboard');await expect(page.getByRole('heading',{name:/Your business/})).toBeVisible();expect(hasCredential(await page.content(),secrets)).toBe(false);await other.close();
});
