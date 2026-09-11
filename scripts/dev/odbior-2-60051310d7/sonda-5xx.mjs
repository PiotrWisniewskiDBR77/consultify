import { readFileSync } from 'node:fs';
const S='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/646e7b40-15a2-49d1-b55f-c3d22cf9b27c/scratchpad';
const O=JSON.parse(readFileSync(`${S}/sesja-staging-owner.json`,'utf8'));
const c=async(m,p,b)=>{const r=await fetch(O.base+p,{method:m,headers:{Authorization:'Bearer '+O.token,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});const t=await r.text();return{s:r.status,t};};
const all=await c('GET','/api/tasks'); const rows=JSON.parse(all.t).tasks||JSON.parse(all.t);
const bezProjektu=rows.filter(t=>!t.projectId);
console.log(`zadan: ${rows.length}, bez projektu: ${bezProjektu.length}`);
const cel=rows.find(t=>t.id==='4e448f41-d7f0-54ba-bfd2-38eab1fa5cc2')||bezProjektu[0];
console.log(`Z-1 cel: ${cel?.id} "${cel?.title}" projectId=${cel?.projectId}`);
const przed={assigneeId:cel.assigneeId};
const r=await c('POST',`/api/tasks/${cel.id}/assign`,{assigneeId:O.user.id});
console.log(`POST /api/tasks/${cel.id}/assign -> ${r.s} ${r.t.slice(0,200)}`);
if(r.s===200){const rb=await c('POST',`/api/tasks/${cel.id}/${przed.assigneeId?'assign':'unassign'}`,przed.assigneeId?{assigneeId:przed.assigneeId}:{});console.log(`  przywrocenie -> ${rb.s}`);}
