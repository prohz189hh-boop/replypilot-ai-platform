import {beforeEach,afterAll,it,expect,vi} from 'vitest';
import {mkdirSync,mkdtempSync} from 'node:fs';
import path from 'node:path';
vi.mock('ai',async original=>({...await original<typeof import('ai')>(),generateText:vi.fn()}));
import {generateText} from 'ai';
import {closeDatabase,run,get,id} from '../packages/database/local';
import {register,actorForToken} from '../packages/database/auth';
import {onboard,saveProduct} from '../packages/database/business';
import {startConversation,suggest} from '../packages/database/messaging';
import {validateGroundedReply} from '../packages/ai/conversation';
let org:string,cid:string;
beforeEach(()=>{
 closeDatabase();mkdirSync('work',{recursive:true});process.env.REPLYPILOT_DATA_DIR=mkdtempSync(path.resolve('work/conversation-'));
 Object.assign(process.env,{REPLYPILOT_LOCAL_DEV:'1',AI_PROVIDER:'gemini',GEMINI_SYNTHETIC_DATA_ONLY:'true',GEMINI_API_KEY:'unit-test-only',GEMINI_MODEL:'gemini-3.8-flash'});
 vi.mocked(generateText).mockReset();
 const actor=actorForToken(register({name:'Synthetic Owner',email:'fiction@example.test',password:'Synthetic-Password-2026'}));
 onboard(actor,{name:'Synthetic Shop',industry:'electronics',locale:'en',currency:'IQD'});
 org=get<{org_id:string}>('SELECT org_id FROM members WHERE user_id=?',actor.id)!.org_id;
 saveProduct({...actor,org_id:org,role:'owner'},{name:'Synthetic RTX Laptop',price:100,currency:'IQD',stock:2,specs:{GPU:'RTX 4060'}});
 run("UPDATE organizations SET ai_provider='gemini',synthetic_data=1 WHERE id=?",org);
 cid=startConversation(org,{name:'Fictional Buyer',locale:'en'}).id;
});
afterAll(()=>{closeDatabase();vi.unstubAllEnvs();});
const result=(reply='Here is {{P1_NAME}} at {{P1_PRICE}}.')=>({output:{reply,confidence:.95,handoff:false},usage:{inputTokens:50,outputTokens:20,totalTokens:70}} as never);
it('generates grounded replies, persists provider attribution and deduplicates',async()=>{
 vi.mocked(generateText).mockResolvedValue(result());const request=id();
 expect(await suggest(org,cid,'RTX 4060','en',request)).toContain('Synthetic RTX Laptop');
 await suggest(org,cid,'RTX 4060','en',request);expect(generateText).toHaveBeenCalledTimes(1);
 expect(get<{provider:string}>('SELECT provider FROM usage_records')?.provider).toBe('gemini');
});
it('reserves the last quota slot before the provider call and rejects duplicate in-flight work',async()=>{
 for(let i=0;i<29;i++)run('INSERT INTO usage_records VALUES(?,?,?,?,?,?,?,?)',id(),org,'2026-10',id(),'old','mock',0,new Date().toISOString());
 let finish!:(value:never)=>void;vi.mocked(generateText).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const request=id(),pending=suggest(org,cid,'RTX 4060','en',request);
 await expect(suggest(org,cid,'RTX 4060','en',request)).rejects.toThrow('in progress');
 await expect(suggest(org,cid,'RTX 4060','en',id())).rejects.toThrow('quota');
 await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));finish(result());await pending;expect(generateText).toHaveBeenCalledTimes(1);
});
it('never sends workspace content without synthetic consent',async()=>{
 run('UPDATE organizations SET synthetic_data=0 WHERE id=?',org);
 await expect(suggest(org,cid,'RTX 4060','en',id())).rejects.toThrow('synthetic');expect(generateText).not.toHaveBeenCalled();
});
it('falls back on invented facts and preserves measured token usage',async()=>{
 vi.mocked(generateText).mockResolvedValue(result('Only 999 dollars for {{P1_NAME}}.'));
 expect(await suggest(org,cid,'RTX 4060','en',id())).not.toContain('999');
 expect(get<{provider:string,tokens:number}>('SELECT provider,tokens FROM usage_records')).toMatchObject({provider:'mock-fallback',tokens:70});
});
it('retries a temporary 503 once and records both attempts',async()=>{
 vi.mocked(generateText).mockRejectedValueOnce(Object.assign(new Error('unavailable'),{statusCode:503})).mockResolvedValueOnce(result());
 await suggest(org,cid,'RTX 4060','en',id());expect(generateText).toHaveBeenCalledTimes(2);
 expect(get<{n:number}>('SELECT COUNT(*) n FROM provider_calls')?.n).toBe(2);
});
it('does not retry 429 and records unknown provider usage honestly',async()=>{
 vi.mocked(generateText).mockRejectedValue(Object.assign(new Error('limited'),{statusCode:429}));
 await suggest(org,cid,'RTX 4060','en',id());expect(generateText).toHaveBeenCalledTimes(1);
 expect(get<{error_code:string;total_tokens:null}>('SELECT error_code,total_tokens FROM provider_calls')).toEqual({error_code:'429',total_tokens:null});
});
it('rejects stale catalog facts after a provider call',async()=>{
 let finish!:(value:never)=>void;vi.mocked(generateText).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=suggest(org,cid,'RTX 4060','en',id());await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));run('UPDATE products SET version=version+1,price=999 WHERE org_id=?',org);
 finish(result());await expect(pending).rejects.toThrow('Catalog changed');expect(get('SELECT id FROM usage_records')).toBeUndefined();
});
it('does not publish a generated reply after consent is withdrawn',async()=>{
 let finish!:(value:never)=>void;vi.mocked(generateText).mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=suggest(org,cid,'RTX 4060','en',id());await vi.waitFor(()=>expect(finish).toBeTypeOf('function'));run('UPDATE organizations SET synthetic_data=0 WHERE id=?',org);
 finish(result());await expect(pending).rejects.toThrow('withdrawn');expect(get('SELECT id FROM usage_records')).toBeUndefined();
});
it('supports Arabic-script dialect prose and rejects unknown facts and wrong script',()=>{
 for(const locale of ['ckb','bad'] as const)expect(validateGroundedReply('بەرهەم {{P1_NAME}}', {P1_NAME:'RTX 4060'},locale)).toContain('RTX 4060');
 expect(()=>validateGroundedReply('Hello {{MISSING}}',{},'en')).toThrow('Unknown');
 expect(()=>validateGroundedReply('Latin only',{},'bad')).toThrow('script');
});

it('does not call the provider after quota exhaustion or for a foreign conversation',async()=>{
 for(let i=0;i<30;i++)run('INSERT INTO usage_records VALUES(?,?,?,?,?,?,?,?)',id(),org,'2026-10',id(),'old','mock',0,new Date().toISOString());
 await expect(suggest(org,cid,'RTX 4060','en',id())).rejects.toThrow('quota');expect(generateText).not.toHaveBeenCalled();
 run('DELETE FROM usage_records WHERE org_id=?',org);
 await expect(suggest(org,id(),'RTX 4060','en',id())).rejects.toThrow('not found');expect(generateText).not.toHaveBeenCalled();
});
it('keeps credentials out of provider prompts and refuses injected secret output',async()=>{
 const secret='private-credential-canary';vi.stubEnv('GEMINI_API_KEY',secret);
 await expect(suggest(org,cid,'RTX 4060 '+secret,'en',id())).rejects.toThrow('Unsafe');expect(generateText).not.toHaveBeenCalled();
 vi.mocked(generateText).mockResolvedValue(result('Here is {{P1_NAME}} '+secret));
 const reply=await suggest(org,cid,'RTX 4060','en',id());expect(reply.includes(secret)).toBe(false);
 expect(JSON.stringify(vi.mocked(generateText).mock.calls[0][0].prompt).includes(secret)).toBe(false);
 expect(get<{provider:string}>('SELECT provider FROM usage_records')?.provider).toBe('mock-fallback');
 vi.unstubAllEnvs();
});
it('records only safe diagnostics when the provider error contains a credential',async()=>{
 const secret='private-credential-canary';vi.stubEnv('GEMINI_API_KEY',secret);
 vi.mocked(generateText).mockRejectedValue(Object.assign(new Error('upstream '+secret),{statusCode:secret}));
 const reply=await suggest(org,cid,'RTX 4060','en',id());expect(reply.includes(secret)).toBe(false);
 expect(JSON.stringify(get('SELECT * FROM provider_calls')).includes(secret)).toBe(false);vi.unstubAllEnvs();
});

it('waits for durable provider reservation and stops when accounting rejects it',async()=>{
 const {generateSyntheticReply}=await import('../packages/ai/conversation');
 const {catalogForAI}=await import('../packages/database/business');
 const {organization}=await import('../packages/database/business');
 const actor=actorForToken((await import('../packages/database/auth')).login({email:'fiction@example.test',password:'Synthetic-Password-2026'}));
 const business=organization(actor),catalog=catalogForAI(org);
 const runtime={begin:vi.fn().mockRejectedValue(new Error('Cloud daily limit reached')),finish:vi.fn(),refreshConsent:vi.fn()};
 await expect(generateSyntheticReply('RTX 4060',catalog,'en',business,true,runtime)).rejects.toThrow('Cloud daily limit');
 expect(generateText).not.toHaveBeenCalled();expect(runtime.finish).not.toHaveBeenCalled();
});
