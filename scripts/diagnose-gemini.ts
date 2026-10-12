// Explicit, one-request synthetic diagnostic. Run with Node's react-server condition.
import {existsSync} from 'node:fs';
import {randomUUID,randomBytes} from 'node:crypto';
import {register,actorForToken,login} from '../packages/database/auth';
import {onboard,saveProduct,organization,catalogForAI} from '../packages/database/business';
import {run,get,closeDatabase} from '../packages/database/local';
import {generateSyntheticReply} from '../packages/ai/conversation';
import {providerErrorCode} from '../packages/security/secrets';
if(!process.argv.includes('--run-once'))throw new Error('Requires explicit --run-once opt-in.');
if(existsSync('.env.local'))process.loadEnvFile('.env.local');
if(process.env.AI_PROVIDER!=='gemini'||process.env.GEMINI_SYNTHETIC_DATA_ONLY!=='true')throw new Error('Synthetic Gemini configuration required.');
process.env.REPLYPILOT_LOCAL_DEV='1';
const email='diagnostic-'+randomUUID()+'@example.test',password=randomBytes(24).toString('hex');
try{
 const initial=actorForToken(register({email,password,name:'Synthetic diagnostic owner'}));
 onboard(initial,{name:'Synthetic diagnostic shop',industry:'electronics',locale:'en',currency:'IQD'});
 const actor=actorForToken(login({email,password}));
 saveProduct(actor,{name:'Synthetic Diagnostic Laptop',price:100,currency:'IQD',stock:2,specs:{RAM:'16GB'}});
 run("UPDATE organizations SET ai_provider='gemini',synthetic_data=1 WHERE id=?",actor.org_id!);
 const before=get<{n:number}>('SELECT COUNT(*) n FROM provider_calls')!.n;
 const result=await generateSyntheticReply('What is the price of Synthetic Diagnostic Laptop?',catalogForAI(actor.org_id!),'en',organization(actor),false);
 const count=get<{n:number}>('SELECT COUNT(*) n FROM provider_calls')!.n-before;
 const call=get('SELECT status,error_code,total_tokens,elapsed_ms,headers_ms,http_status,failure_phase FROM provider_calls ORDER BY rowid DESC LIMIT 1');
 console.log(JSON.stringify({provider:result.provider,answer:result.answer,attempts:count,diagnostic:call},null,2));
 if(result.provider!=='gemini')process.exitCode=1;
}catch(error){console.log(JSON.stringify({error:providerErrorCode(error)}));process.exitCode=1;}
finally{closeDatabase();}
