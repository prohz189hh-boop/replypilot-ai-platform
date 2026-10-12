import {it,expect,vi} from 'vitest';
import {providerTransport} from '../packages/ai/provider-runtime';
it('distinguishes missing headers, HTTP responses and output validation without storing request data',async()=>{
 const secret='synthetic-private-transport-canary';
 const rejected=providerTransport(vi.fn().mockRejectedValue(new DOMException(secret,'TimeoutError')));
 await expect(rejected.fetch('https://example.test',{headers:{authorization:secret}})).rejects.toThrow();
 expect(rejected.timing()).toMatchObject({headersMs:null,httpStatus:null,phase:'before_headers'});
 expect(JSON.stringify(rejected.timing())).not.toContain(secret);
 const success=providerTransport(vi.fn().mockResolvedValue(new Response(secret,{status:200})));
 await success.fetch('https://example.test');expect(success.timing()).toMatchObject({httpStatus:200,phase:'response'});
 success.validated();expect(success.timing().phase).toBe('validation');expect(success.timing().elapsedMs).toBeGreaterThanOrEqual(0);
 expect(JSON.stringify(success.timing())).not.toContain(secret);
});
