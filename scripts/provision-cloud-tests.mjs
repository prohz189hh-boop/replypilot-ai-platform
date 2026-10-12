import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,existsSync,copyFileSync} from 'node:fs';
process.loadEnvFile('.env.local');
if(existsSync('.env.cloud-test'))process.loadEnvFile('.env.cloud-test');
if(process.env.SUPABASE_PROJECT_REF!=='kjwmyvyjqyildwndkqoc'||process.env.SUPABASE_URL!=='https://kjwmyvyjqyildwndkqoc.supabase.co'||!process.env.SUPABASE_TEST_ADMIN_KEY)throw new Error('Expected ReplyPilot development project and test-only admin credential.');
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_TEST_ADMIN_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
mkdirSync('work',{recursive:true});
const file='work/cloud-fixtures.json';if(existsSync(file))copyFileSync(file,`work/cloud-fixtures-${Date.now()}.json`);
const fixtures=[];
for(const suffix of ['a','b']){
 const email=`replypilot-supported-${suffix}-${Date.now()}@example.test`,password=randomBytes(24).toString('hex');
 const {data,error}=await admin.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{test_fixture:true}});
 if(error)throw new Error(`Supported test provisioning failed: ${error.code||error.status}`);
 fixtures.push({id:data.user.id,email,password});writeFileSync(file,JSON.stringify(fixtures),{mode:0o600});
}
console.log('Created two synthetic users through Supabase Auth Admin API. Credentials saved only in ignored work/.');
