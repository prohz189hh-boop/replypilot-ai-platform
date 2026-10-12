import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync,existsSync,readdirSync,lstatSync} from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {pathToFileURL} from 'node:url';
import {unzipSync} from 'fflate';
const credentialPatterns=[/AIza[0-9A-Za-z_-]{30,}/, /AQ\.[0-9A-Za-z_-]{35,}/, /sb_secret_[0-9A-Za-z_-]{15,}/, /gh[pousr]_[0-9A-Za-z]{20,}/, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/];
export function hasCredential(bytes,secrets=[]){
 const data=Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes);
 if(secrets.some(secret=>secret.length>=12&&[secret,Buffer.from(secret).toString('base64'),encodeURIComponent(secret)].some(value=>data.includes(Buffer.from(value)))))return true;
 return credentialPatterns.some(pattern=>pattern.test(data.toString('utf8')));
}
export function artifactHasCredential(bytes,secrets=[],depth=0){
 const data=Buffer.from(bytes);if(hasCredential(data,secrets))return true;
 if(depth>3)throw new Error('Archive nesting limit reached; audit incomplete.');
 if(data.length>=4&&data.readUInt32LE(0)===0x04034b50){
  let total=0;const entries=unzipSync(data,{filter(file){total+=file.originalSize;if(total>128*1024*1024)throw new Error('Archive size limit reached; audit incomplete.');return true;}});
  return Object.values(entries).some(value=>artifactHasCredential(value,secrets,depth+1));
 }
 for(const match of data.toString('utf8').matchAll(/data:application\/zip;base64,([A-Za-z0-9+/=]+)/g))if(artifactHasCredential(Buffer.from(match[1],'base64'),secrets,depth+1))return true;
 return false;
}
export function auditSecrets(root=process.cwd(),{history=true,requireBuild=true}={}){
 const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:256*1024*1024});
 const findings=[],secrets=[];
 for(const name of ['.env.local','.env.cloud-test']){
  const file=path.join(root,name);if(!existsSync(file))continue;
  const values=parseEnv(readFileSync(file,'utf8'));
  for(const [key,value] of Object.entries(values)){
   if(/NEXT_PUBLIC_.*(?:KEY|SECRET|PASSWORD|TOKEN)/.test(key))findings.push({scope:'configuration',location:name,reason:'Public-prefixed credential variable'});
   if(/(?:API_KEY|ADMIN_KEY|SECRET|PASSWORD|TOKEN)$/.test(key)&&value.length>=12)secrets.push(value);
  }
  if(spawnSync('git',['check-ignore','-q',name],{cwd:root}).status!==0)findings.push({scope:'configuration',location:name,reason:'Secret file is not ignored'});
 }
 const tracked=git('ls-files','--cached','--others','--exclude-standard','-z').toString().split('\0').filter(Boolean);
 let trackedCount=0,historyCount=0,buildCount=0;
 const scan=(bytes,scope,location)=>{if(artifactHasCredential(bytes,secrets))findings.push({scope,location,reason:'Credential signature or configured secret match (value withheld)'});};
 for(const file of tracked){
  if(/(^|\/)\.env(?:\.|$)/.test(file)&&!file.endsWith('.env.example'))findings.push({scope:'tracked',location:file,reason:'Tracked environment file'});
  const full=path.join(root,file);if(existsSync(full)&&lstatSync(full).isFile()){scan(readFileSync(full),'tracked',file);trackedCount++;}
 }
 scan(git('diff','--cached','--no-ext-diff'),'staged','index diff');
 if(history){
  const objects=git('rev-list','--objects','--all').toString().trim().split('\n').map(line=>{const i=line.indexOf(' ');return {oid:i<0?line:line.slice(0,i),name:i<0?'(object)':line.slice(i+1)};});
  const batch=spawnSync('git',['cat-file','--batch'],{cwd:root,input:objects.map(o=>o.oid).join('\n')+'\n',maxBuffer:256*1024*1024});
  if(batch.status!==0)throw new Error('Git history scan failed; no content is logged.');
  let offset=0;
  for(const object of objects){const end=batch.stdout.indexOf(10,offset);const [,type,size]=batch.stdout.subarray(offset,end).toString().split(' ');const length=Number(size);if(!Number.isFinite(length))throw new Error('Invalid Git object framing');offset=end+1;
   if(type==='blob'){scan(batch.stdout.subarray(offset,offset+length),'history',object.oid+':'+object.name);historyCount++;}offset+=length+1;
  }
 }
 function walk(dir){if(!existsSync(dir))return;for(const entry of readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.isFile()){scan(readFileSync(full),'generated',path.relative(root,full));buildCount++;}}}
 for(const dir of ['apps/web/public','public','apps/web/.next','test-results','playwright-report'])walk(path.join(root,dir));
 if(requireBuild&&!existsSync(path.join(root,'apps/web/.next/BUILD_ID')))findings.push({scope:'generated',location:'apps/web/.next',reason:'Production build missing; bundle check incomplete'});
 return {ok:findings.length===0,trackedCount,historyCount,buildCount,findings};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{const result=auditSecrets();console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;}
 catch{console.error('Secret audit could not finish. No credential values were logged.');process.exitCode=1;}
}
