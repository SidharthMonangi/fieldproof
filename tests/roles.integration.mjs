import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
const base='http://127.0.0.1:8788';const suffix=randomUUID();let count=0;
const who=(id)=>({'oai-authenticated-user-id':id,'oai-authenticated-user-email':id+'@example.test','oai-authenticated-user-full-name':id,'oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'});
async function call(id,path,body){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...who(id),'Content-Type':'application/json'},body:body && path !== "/api/sources" ?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
function check(actual,expected){assert.equal(actual,expected);count++;}
const admin='admin-'+suffix,officer='officer-'+suffix,reviewer='reviewer-'+suffix,outsider='outside-'+suffix;
const a=await call(admin,'/api/bootstrap');check(a.status,200);
for(const [id,role] of [[officer,'officer'],[reviewer,'reviewer']]){check((await call(admin,'/api/workspace',{action:'invite',email:id+'@example.test',role})).status,200);const b=await call(id,'/api/bootstrap');check(b.data.user.role,role);check(b.data.user.workspaceId,a.data.user.workspaceId);}
check((await call(officer,'/api/sources',{})).status,403);check((await call(reviewer,'/api/sources',{})).status,403);
check((await call(officer,'/api/workspace',{action:'rename',name:'Unauthorized'})).status,403);
const outside=await call(outsider,'/api/bootstrap');assert.notEqual(outside.data.user.workspaceId,a.data.user.workspaceId);count++;
check((await fetch(base+'/api/bootstrap')).status,401);
console.log(`${count} real-server account and permission checks passed using fictional identities.`);

