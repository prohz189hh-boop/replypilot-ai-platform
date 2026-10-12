import {afterEach,it,expect,vi} from 'vitest';
import {zipSync,strToU8} from 'fflate';
import {hasCredential,artifactHasCredential} from '../scripts/audit-secrets.mjs';
import {boundedJson} from '../packages/security/request';
import {containsPrivateCredential,safeErrorText} from '../packages/security/secrets';
import {failure} from '../apps/web/lib/http';
import {AppError} from '../packages/shared';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
afterEach(()=>vi.unstubAllEnvs());
it('detects credential canaries and encoded configured values without returning them',()=>{
 const key='AQ.'+'a'.repeat(45);expect(hasCredential(Buffer.from(key))).toBe(true);
 const secret='test-private-credential';vi.stubEnv('GEMINI_API_KEY',secret);
 for(const value of [secret,Buffer.from(secret).toString('base64'),encodeURIComponent(secret)]){
  expect(hasCredential(Buffer.from(value),[secret])).toBe(true);expect(containsPrivateCredential(value)).toBe(true);expect(safeErrorText(value).includes(secret)).toBe(false);
 }
 expect(hasCredential('GEMINI_API_KEY=')).toBe(false);
});
it('never serializes provider exceptions or credential-bearing application errors',async()=>{
 const secret='test-private-credential';vi.stubEnv('GEMINI_API_KEY',secret);
 for(const error of [new Error('upstream '+secret),new AppError('bad '+secret,400)]){
  const response=failure(error),text=await response.text();expect(text.includes(secret)).toBe(false);expect(response.headers.get('cache-control')).toContain('no-store');
 }
});
it('rejects oversized streams even when content length is missing or understated',async()=>{
 for(const headers of [new Headers(),new Headers({'content-length':'1'})]){
  const request=new Request('http://localhost',{method:'POST',headers,body:'x'.repeat(65_000)});
  await expect(boundedJson(request)).rejects.toThrow('too large');
 }
 const r=new Request('http://localhost',{method:'POST',body:JSON.stringify({ok:true})});expect(await boundedJson(r)).toEqual({ok:true});
});
it('keeps private environment files untracked and provider modules marked server-only',()=>{
 for(const file of ['.env.local','.env.cloud-test']){
  expect(execFileSync('git',['ls-files','--',file]).toString().trim()).toBe('');
  expect(()=>execFileSync('git',['check-ignore','-q',file])).not.toThrow();
 }
 for(const file of ['packages/ai/index.ts','packages/ai/conversation.ts'])expect(readFileSync(file,'utf8').startsWith("import 'server-only';")).toBe(true);
});

it('inspects compressed trace archives and embedded browser reports',()=>{
 const secret='private-artifact-canary';const zip=zipSync({'trace.json':strToU8(JSON.stringify({hidden:secret}))});
 expect(artifactHasCredential(zip,[secret])).toBe(true);
 expect(artifactHasCredential(Buffer.from('data:application/zip;base64,'+Buffer.from(zip).toString('base64')),[secret])).toBe(true);
 expect(artifactHasCredential(zipSync({'trace.json':strToU8('safe data')}),[secret])).toBe(false);
});
