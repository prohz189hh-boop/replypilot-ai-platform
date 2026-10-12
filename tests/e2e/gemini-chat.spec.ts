import {test,expect} from '@playwright/test';
test('opted-in synthetic customer chat uses live Gemini in English, Sorani and Badini',async({page})=>{
 test.skip(process.env.RUN_GEMINI_E2E!=='true','Explicit synthetic provider opt-in.');
 test.setTimeout(180000);
 const headers={Origin:'http://127.0.0.1:3100'};
 expect((await page.request.post('/api/auth',{headers,data:{action:'register',name:'Synthetic AI Owner',email:'synthetic-ai@example.test',password:'Fictional-AI-Password-2026'}})).ok()).toBe(true);
 const act=(action:string,data:unknown)=>page.request.post('/api/workspace',{headers,data:{action,data}});
 expect((await act('onboard',{name:'Synthetic Gemini Shop',industry:'electronics',locale:'en',currency:'IQD'})).ok()).toBe(true);
 expect((await act('product.save',{name:'Fictional Atlas Laptop',price:1450000,currency:'IQD',stock:3,specs:{GPU:'RTX 4060',RAM:'16GB'}})).ok()).toBe(true);
 expect((await act('settings',{name:'Synthetic Gemini Shop',locale:'en',aiMode:'automatic',paused:false,policies:'',hours:'',aiProvider:'gemini',syntheticData:true})).ok()).toBe(true);
 const org=(await (await page.request.get('/api/workspace')).json()).org.id;
 await page.goto('/chat/'+org);await expect(page.getByText(/fictional messages only/)).toBeVisible();
 await page.getByLabel('Your name').fill('Fictional Customer');await page.getByRole('button',{name:'Start conversation'}).click();
 for(const [locale,question] of [['en','Do you have RTX 4060?'],['ckb','تکایە RTX 4060 هەیە؟'],['bad','بهایێ RTX 4060 چەندە؟'],['auto','ez dixwazim laptop RTX 4060 bikirim']]){
  await page.getByLabel('Chat language').selectOption(locale);await page.getByLabel('Customer message').fill(question);
  const response=page.waitForResponse(r=>r.url().includes('/api/chat/')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Send message'}).click();const result=await (await response).json();
  const last=result.messages.filter((m:{role:string})=>m.role==='assistant').at(-1);
  expect.soft(last.provider,locale+' live provider').toBe('gemini');expect(last.body).toContain('Fictional Atlas Laptop');
  if(locale!=='en')expect(last.body).toMatch(/[\u0600-\u06ff]/u);
  if(locale==='auto'){expect(result.locale).toBe('bad');await expect(page.locator('main')).toHaveAttribute('dir','rtl');}
 }
 await page.screenshot({path:'work/gemini-chat.png',fullPage:true});
});
