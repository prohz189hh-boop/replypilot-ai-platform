import 'server-only';
import type {Organization} from '../shared';
export type ProviderUsage={inputTokens?:number;outputTokens?:number;totalTokens?:number};
export type ProviderTiming={elapsedMs:number;headersMs:number|null;httpStatus:number|null;phase:'before_headers'|'response'|'validation'};
// Implementations must durably reserve each attempt before allowing any network call.
// Never construct this interface from browser-supplied callbacks or usage values.
export interface ProviderRuntime {
 begin(model:string,promptVersion:string):Promise<string>;
 finish(id:string,model:string,usage:ProviderUsage,errorCode:string|undefined,timing:ProviderTiming):Promise<void>;
 refreshConsent(org:Organization):Promise<Organization>;
}
export function providerTransport(fetcher:typeof fetch=globalThis.fetch){
 const start=performance.now();
 let headersMs:number|null=null,httpStatus:number|null=null,phase:ProviderTiming['phase']='before_headers';
 const fetch:typeof globalThis.fetch=async(input,init)=>{
  const response=await fetcher(input,init);
  headersMs=Math.max(0,Math.round(performance.now()-start));httpStatus=response.status;phase='response';
  return response;
 };
 return {fetch,validated:()=>{phase='validation';},timing:():ProviderTiming=>({elapsedMs:Math.max(0,Math.round(performance.now()-start)),headersMs,httpStatus,phase})};
}
