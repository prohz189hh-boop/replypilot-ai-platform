import {beforeEach,afterAll,it,expect,vi} from 'vitest';
import {mkdirSync,mkdtempSync} from 'node:fs';
import path from 'node:path';
vi.mock('ai',async importOriginal=>({...await importOriginal<typeof import('ai')>(),generateText:vi.fn()}));
import {generateText} from 'ai';
import {GeminiProvider} from '../packages/ai';
import {closeDatabase,all} from '../packages/database/local';
import {demoProducts} from '../packages/database/business';
import type {Product} from '../packages/shared';
const catalog=demoProducts.map((p,i)=>({...p,id:'demo-'+i,org_id:'demo',created_at:''})) as Product[];
beforeEach(()=>{
 closeDatabase();mkdirSync('work',{recursive:true});process.env.REPLYPILOT_DATA_DIR=mkdtempSync(path.resolve('work/provider-'));
 process.env.REPLYPILOT_LOCAL_DEV='1';process.env.GEMINI_API_KEY='fake-unit-test-only';process.env.GEMINI_MODEL='gemini-3.8-flash';process.env.GEMINI_SYNTHETIC_DATA_ONLY='true';vi.mocked(generateText).mockReset();
});
afterAll(()=>closeDatabase());
it('records successful provider tokens without persisting prompts or credentials',async()=>{
 vi.mocked(generateText).mockResolvedValue({output:{ids:['demo-0'],handoff:false},usage:{inputTokens:100,outputTokens:20,totalTokens:120}} as never);
 const result=await new GeminiProvider().select('RTX 4060',catalog,'bad');expect(result.products[0].name).toBe('Atlas Gaming 15');
 const rows=all<{status:string;total_tokens:number;paid_reference_usd:number}>('SELECT * FROM provider_calls');expect(rows[0].status).toBe('succeeded');expect(rows[0].total_tokens).toBe(120);expect(rows[0].paid_reference_usd).toBeCloseTo(.00015);expect(JSON.stringify(rows)).not.toContain('fake-unit');expect(JSON.stringify(rows)).not.toContain('RTX');
});
it('rejects invented or cross-catalog model identifiers',async()=>{
 vi.mocked(generateText).mockResolvedValue({output:{ids:['another-tenant-product'],handoff:false},usage:{inputTokens:20,outputTokens:5,totalTokens:25}} as never);
 await expect(new GeminiProvider().select('RTX 4060',catalog,'en')).rejects.toThrow('unverified');expect(all<{status:string}>('SELECT status FROM provider_calls')[0].status).toBe('failed');
});
it('records provider failures with unknown usage and never stores provider error text',async()=>{
 vi.mocked(generateText).mockRejectedValue(Object.assign(new Error('Sensitive request details'),{statusCode:429}));
 await expect(new GeminiProvider().select('RTX 4060',catalog,'en')).rejects.toThrow();
 const record=all<{status:string;total_tokens:null;error_code:string}>('SELECT * FROM provider_calls')[0];expect(record.status).toBe('failed');expect(record.total_tokens).toBeNull();expect(record.error_code).toBe('429');expect(JSON.stringify(record)).not.toContain('Sensitive');
});
