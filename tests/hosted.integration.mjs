// Opt-in: creates two disposable Supabase test accounts, tests only their own
// new workspaces, then removes them through the app's account deletion flow.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
if (process.env.FIELDPROOF_HOSTED_TEST !== 'disposable-accounts') throw new Error('Explicit disposable-account opt-in required.');
const origin='https://fieldproof.sidharthmonangi.chatgpt.site';
const config=Object.fromEntries(fs.readFileSync('.env.local','utf8').split(/\r?\n/).filter(line=>/^[A-Z_]+=/.test(line)).map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1).trim()]}));
const admin=createClient(config.SUPABASE_URL,config.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const label='fieldproof-check-'+randomUUID();
let checks=0;
function check(value,expected,description){assert.deepEqual(value,expected,description);checks++;console.log('PASS',description);}
async function account(suffix){
 const email=label+'-'+suffix+'@example.test',password=randomUUID()+randomUUID();
 const created=await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{fixture:'disposable-fieldproof-check'}});
 if(created.error) throw new Error('Temporary account creation failed: '+created.error.status);
 const jar=new Map();
 const client=createServerClient(config.SUPABASE_URL,config.SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...jar].map(([name,value])=>({name,value})),setAll:values=>values.forEach(({name,value})=>jar.set(name,value))}});
 const signed=await client.auth.signInWithPassword({email,password});
 if(signed.error) throw new Error('Temporary account sign-in failed: '+signed.error.status);
 return {id:created.data.user.id,email,jar};
}
async function call(user,path,body,method){
 const headers={Origin:origin};
 if(user) headers.Cookie=[...user.jar].map(([name,value])=>name+'='+value).join('; ');
 if(body && !(body instanceof FormData)) headers['Content-Type']='application/json';
 const response=await fetch(origin+path,{method:method||(body?'POST':'GET'),headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20000)});
 for(const cookie of response.headers.getSetCookie()){
  const pair=cookie.split(';')[0],at=pair.indexOf('=');if(user)user.jar.set(pair.slice(0,at),pair.slice(at+1));
 }
 const bytes=Buffer.from(await response.arrayBuffer());
 let data;try{data=JSON.parse(bytes.toString())}catch{data=null}
 return {status:response.status,data,bytes};
}
const a=await account('a'),b=await account('b');
const bootA=await call(a,'/api/bootstrap'),bootB=await call(b,'/api/bootstrap');
check(bootA.status,200,'account A verified session');check(bootB.status,200,'account B verified session');
check(bootA.data.workspace.id!==bootB.data.workspace.id,true,'independent real authentication accounts get separate workspaces');
check((await call(null,'/api/export')).status,401,'anonymous backup blocked');
const caseId=randomUUID();let version=0;
const operation=(type,payload={})=>({id:randomUUID(),caseId,baseVersion:version,type,payload});
check((await call(a,'/api/operations',operation('create',{name:'Disposable fictional applicant',phone:'+91 00000 00000',location:'Fictional test property',purpose:'Home construction',amount:600000,income:25000,notes:'Disposable hosted verification fixture.',consent:true,consentAt:null}))).status,200,'hosted case creation');version++;
check((await call(a,'/api/account',{confirmation:'DELETE MY ACCOUNT'})).status,409,'nonempty workspace prevents account deletion');
const bytes=Buffer.from('%PDF-1.4\nDisposable fictional verification attachment\n%%EOF');
const form=new FormData();form.set('file',new Blob([bytes],{type:'application/pdf'}),'disposable-fictional.pdf');form.set('kind','income');form.set('operation',JSON.stringify(operation('upload')));
check((await call(a,'/api/files',form)).status,200,'hosted attachment write');version++;
const populated=await call(a,'/api/bootstrap'),file=populated.data.files.find(file=>file.caseId===caseId);
assert.ok(file,'Uploaded file returned by bootstrap');
check((await call(a,'/api/files/'+file.id)).bytes.equals(bytes),true,'hosted attachment read matches uploaded bytes');
check((await call(b,'/api/files/'+file.id)).status,404,'other real account cannot read attachment');
check((await call(b,'/api/bootstrap')).data.cases.length,0,'other real account cannot list case');
check((await call(b,'/api/operations',operation('archive'))).status,404,'other real account cannot modify case');
const backup=await call(a,'/api/export');check(backup.status,200,'hosted workspace backup');
check(backup.data.records.cases.length,1,'backup contains only test account case');
check(createHash('sha256').update(Buffer.from(backup.data.attachments[0].base64,'base64')).digest('hex'),backup.data.attachments[0].sha256,'backup attachment checksum');
check((await call(b,'/api/export')).data.attachments.length,0,'other account backup cannot leak attachment');
const recovery={id:randomUUID(),confirmation:'RESTORE AS DRAFTS',backup:backup.data};
check((await call(a,'/api/restore',recovery)).status,200,'hosted backup recovery');
check((await call(a,'/api/restore',recovery)).status,200,'recovery retry uses receipt');
const recovered=(await call(a,'/api/bootstrap')).data;
check(recovered.cases.length,2,'recovery retry does not create duplicates');
const copy=recovered.cases.find(record=>record.id!==caseId);
check(copy.status,'draft','recovered case is a new draft');check(copy.data.consent,false,'recovered consent requires a fresh check');
const copyFile=recovered.files.find(file=>file.caseId===copy.id);
check((await call(a,'/api/files/'+copyFile.id)).bytes.equals(bytes),true,'recovered attachment bytes match backup');
check((await call(b,'/api/files/'+copyFile.id)).status,404,'other account cannot read recovered attachment');
check((await call(a,'/api/operations',{id:randomUUID(),caseId:copy.id,baseVersion:1,type:'archive',payload:{}})).status,200,'recovered disposable case archive');
check((await call(a,'/api/purge',{action:'purge',caseId:copy.id,version:2,confirmation:'DELETE '+copy.ref})).status,200,'recovered disposable case cleanup');
check((await call(null,'/api/status')).status,200,'public health check');

check((await call(a,'/api/operations',operation('archive'))).status,200,'disposable case archive');version++;
const record=(await call(a,'/api/bootstrap')).data.cases[0];
check((await call(a,'/api/purge',{action:'purge',caseId,version,confirmation:'DELETE '+record.ref})).status,200,'disposable case purge');
check((await call(a,'/api/files/'+file.id)).status,404,'purged file is no longer reachable');
check((await call(a,'/api/health')).data.pendingFileCleanup,0,'hosted attachment cleanup completed');
for(const user of [a,b]){
 assert.ok(user.email.startsWith(label+'-'),'Only this run\'s disposable accounts may be deleted');
 check((await call(user,'/api/account',{confirmation:'DELETE MY ACCOUNT'})).status,200,'disposable account deletion through hosted app');
 check((await call(user,'/api/bootstrap')).status,401,'deleted account cannot reopen workspace');
 const removed=await admin.auth.admin.getUserById(user.id);
 check(!!removed.error,true,'Supabase confirms disposable user removed');
}
const result={checkedAt:new Date().toISOString(),origin,checks,passed:true,method:'Two disposable real Supabase password sessions; UI GitHub sign-in verified separately.'};
fs.mkdirSync('../work',{recursive:true});fs.writeFileSync('../work/hosted-verification.json',JSON.stringify(result,null,2));
console.log('Hosted integration checks passed:',checks);
