import {test,expect} from '@playwright/test';
test('customer language preference survives reload and auto detection can be restored',async({page})=>{
 const headers={Origin:'http://127.0.0.1:3100'};
 expect((await page.request.post('/api/auth',{headers,data:{action:'register',name:'Language owner',email:'language-owner@example.test',password:'Fictional-Language-2026'}})).ok()).toBe(true);
 expect((await page.request.post('/api/workspace',{headers,data:{action:'onboard',data:{name:'Language shop',industry:'electronics',locale:'en',currency:'IQD'}}})).ok()).toBe(true);
 const {org}=await (await page.request.get('/api/workspace')).json();
 await page.goto('/chat/'+org.id);await page.getByLabel('Your name').fill('Synthetic language buyer');await page.getByRole('button',{name:'Start conversation'}).click();
 await page.getByLabel('Chat language').selectOption('bad');await expect(page.getByLabel('Chat language')).toBeEnabled();
 await page.reload();await expect(page.getByLabel('Chat language')).toHaveValue('bad');await expect(page.locator('main')).toHaveAttribute('dir','rtl');
 await page.getByLabel('Customer message').fill('Hello, can you help me?');await page.getByRole('button',{name:'Send message'}).click();await expect(page.locator('.message.customer')).toHaveCount(1);
 await page.reload();await expect(page.getByLabel('Chat language')).toHaveValue('bad');
 expect((await page.request.post('/api/chat/'+org.id,{headers,data:{action:'language',conversationId:crypto.randomUUID(),data:{locale:'ar'}}})).status()).toBe(404);
 await page.getByLabel('Chat language').selectOption('auto');await expect(page.getByLabel('Chat language')).toBeEnabled();await page.reload();await expect(page.getByLabel('Chat language')).toHaveValue('auto');
 await page.getByLabel('Customer message').fill('Hello, can you help me?');await page.getByRole('button',{name:'Send message'}).click();await expect(page.locator('.message.customer')).toHaveCount(2);await expect(page.locator('main')).toHaveAttribute('dir','ltr');
 await page.getByLabel('Customer message').fill('slav chawa yi');await page.getByRole('button',{name:'Send message'}).click();await expect(page.locator('.message.customer')).toHaveCount(3);await expect(page.locator('main')).toHaveAttribute('dir','rtl');await page.reload();await expect(page.locator('main')).toHaveAttribute('dir','rtl');await expect(page.getByLabel('Chat language')).toHaveValue('auto');
});
