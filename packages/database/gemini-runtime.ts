import 'server-only';
import {get,rateLimit} from './local';
import {startProviderCall,finishProviderCall} from './provider-usage';
import {type Organization,invariant} from '../shared';
import type {ProviderRuntime} from '../ai/provider-runtime';
export const localGeminiRuntime:ProviderRuntime={
 async begin(model,version){
  rateLimit('gemini:'+new Date().toISOString().slice(0,10),Math.min(100,Math.max(1,Number(process.env.GEMINI_MAX_CALLS_PER_DAY)||30)),86400000);
  return startProviderCall(model,version);
 },
 async finish(id,model,usage,errorCode,timing){finishProviderCall(id,model,usage,errorCode,timing);},
 async refreshConsent(org){
  const current=get<Organization>('SELECT * FROM organizations WHERE id=?',org.id);
  invariant(current?.ai_provider==='gemini'&&current.synthetic_data===1,'Gemini consent was withdrawn.',409);
  return current;
 }
};
