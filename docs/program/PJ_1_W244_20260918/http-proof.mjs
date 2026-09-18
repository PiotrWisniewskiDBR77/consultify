import fs from 'node:fs';
const API='http://127.0.0.1:4214/api';
const password=fs.readFileSync('/Users/piotrwisniewski/Developer/cto-codex/irina-20260914/DOSTEP.md','utf8').match(/Hasło tymczasowe:\s*`([^`]+)`/)?.[1];
if(!password)throw Error('Missing runtime password');
const login=await fetch(`${API}/auth/login`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'james.whitfield@northwind.example',password})});
if(!login.ok)throw Error(`Login ${login.status}`);const {token}=await login.json();
const rows=[];
for(const id of ['6174636d-c4f2-552d-9a5a-d2695738f9bc','ac3c5d4c-2c4c-4af6-9516-314e0d962402','ae6cfbae-1ba8-5328-9048-d86f2a52a09e']){
 const res=await fetch(`${API}/projects/${id}`,{headers:{authorization:`Bearer ${token}`,'accept-language':'en'}});const body=await res.json();
 const tasksResponse=await fetch(`${API}/tasks?projectId=${encodeURIComponent(id)}`,{headers:{authorization:`Bearer ${token}`}});const tasks=await tasksResponse.json();
 rows.push({id,status:res.status,body,tasksStatus:tasksResponse.status,tasks});
 console.log(JSON.stringify({tasksStatus:tasksResponse.status,array:Array.isArray(tasks),count:Array.isArray(tasks)?tasks.length:null,projects:Array.isArray(tasks)?[...new Set(tasks.map(t=>t.project_id??t.projectId))]:[]}));
 console.log(JSON.stringify({id,status:res.status,name:body.name,team:body.team?.length,initiatives:body.initiatives?.length,documents:body.documents?.length,tasks:body.tasks?.length??'not in response'}));
}
fs.writeFileSync('docs/program/PJ_1_W244_20260918/http-records.json',JSON.stringify(rows,null,2));
if(rows.some(r=>r.status!==200))throw Error('Project GET failed');

const missingProject=await fetch(`${API}/initiatives`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify({title:'PJ-1 missing-project negative proof',name:'PJ-1 missing-project negative proof',sourceType:'manual'})});
const missingBody=await missingProject.json();
fs.writeFileSync('docs/program/PJ_1_W244_20260918/project-required.json',JSON.stringify({status:missingProject.status,body:missingBody},null,2));
console.log(JSON.stringify({missingProjectStatus:missingProject.status,code:missingBody.code}));
if(missingProject.status!==400||missingBody.code!=='INITIATIVE_PROJECT_REQUIRED')throw Error('Project requirement not proven');
