import 'server-only';
// Never return a secret match or its value to a caller or diagnostic sink.
export function containsPrivateCredential(text:string){
 const values=['GEMINI_API_KEY','SUPABASE_TEST_ADMIN_KEY','SUPABASE_SERVICE_ROLE_KEY'].map(name=>process.env[name]).filter((v):v is string=>!!v&&v.length>=12);
 return values.some(value=>[value,encodeURIComponent(value),Buffer.from(value).toString('base64')].some(encoded=>text.includes(encoded)))||/AIza[0-9A-Za-z_-]{30,}|AQ\.[0-9A-Za-z_-]{35,}|sb_secret_[0-9A-Za-z_-]{15,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text);
}
export function safeErrorText(text:string){return containsPrivateCredential(text)?'The request could not be completed safely.':text;}

export function providerErrorCode(error:unknown){
 const e=error as {statusCode?:unknown;name?:unknown}|null;
 if(typeof e?.statusCode==='number'&&Number.isInteger(e.statusCode)&&e.statusCode>=100&&e.statusCode<=599)return String(e.statusCode);
 return e?.name==='AbortError'||e?.name==='TimeoutError'?'timeout':'validation_or_provider_error';
}
