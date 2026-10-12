import type {ProviderTiming} from '../ai/provider-runtime';
import { id,now,run } from './local';
export function startProviderCall(model:string,promptVersion:string){
  const callId=id();
  run('INSERT INTO provider_calls(id,provider,model,prompt_version,status,created_at) VALUES(?,?,?,?,?,?)',callId,'gemini',model,promptVersion,'pending',now());
  return callId;
}
export function finishProviderCall(callId:string,model:string,usage:{inputTokens?:number;outputTokens?:number;totalTokens?:number},errorCode?:string,timing?:ProviderTiming){
  // A published paid-price comparison, never a claim about the actual Google invoice or billing tier.
  const multiplier=new Date().getUTCFullYear()>=2027?2:1;
  const reference=model==='gemini-3.8-flash'&&usage.inputTokens!==undefined&&usage.outputTokens!==undefined
    ? (usage.inputTokens*.75+usage.outputTokens*3.75)*multiplier/1_000_000:null;
  run('UPDATE provider_calls SET status=?,input_tokens=?,output_tokens=?,total_tokens=?,paid_reference_usd=?,error_code=?,completed_at=? WHERE id=?',errorCode?'failed':'succeeded',usage.inputTokens??null,usage.outputTokens??null,usage.totalTokens??null,reference,errorCode??null,now(),callId);
  if(timing)run('UPDATE provider_calls SET elapsed_ms=?,headers_ms=?,http_status=?,failure_phase=? WHERE id=?',timing.elapsedMs,timing.headersMs,timing.httpStatus,timing.phase,callId);
}
