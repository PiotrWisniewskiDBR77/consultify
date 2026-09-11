import { readFileSync } from 'node:fs'; import { randomUUID } from 'node:crypto';
const S='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/646e7b40-15a2-49d1-b55f-c3d22cf9b27c/scratchpad';
const O=JSON.parse(readFileSync(`${S}/sesja-staging-owner.json`,'utf8'));
const c=async(m,p,b)=>{const r=await fetch(O.base+p,{method:m,headers:{Authorization:'Bearer '+O.token,'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});const t=await r.text();return{s:r.status,t};};
for(const init of ['b650401b-b520-5532-9ce9-f21307bd3fe8','4e7a8762-62e6-52b5-985b-536a4d9185aa']){
  const rid=randomUUID();
  const a=await c('POST',`/api/initiatives/runtime-v1/initiatives/${init}/raid-items/${rid}`,
    {expectedVersion:0,clientRequestId:'ODBIOR2-'+randomUUID(),type:'RISK',title:'ODBIOR2- RAID sonda',description:null,status:'OPEN',probability:'LOW',severity:'LOW',ownerId:null,dueDate:null,mitigationPlan:null,linkedItems:[]});
  console.log(`DODAJ init=${init.slice(0,8)} raid=${rid.slice(0,8)} -> ${a.s} ${a.t.slice(0,200)}`);
  if(a.s===201||a.s===200){
    const j=JSON.parse(a.t); const v=j.aggregateVersion??1;
    const dup=await c('POST',`/api/initiatives/runtime-v1/initiatives/${init}/raid-items/${rid}`,
      {expectedVersion:0,clientRequestId:'ODBIOR2-'+randomUUID(),type:'RISK',title:'ODBIOR2- duplikat',description:null,status:'OPEN',probability:'LOW',severity:'LOW',ownerId:null,dueDate:null,mitigationPlan:null,linkedItems:[]});
    console.log(`  DUPLIKAT -> ${dup.s} ${dup.t.slice(0,160)}`);
    const u=await c('PATCH',`/api/initiatives/runtime-v1/initiatives/${init}/raid-items/${rid}`,
      {expectedVersion:v,clientRequestId:'ODBIOR2-'+randomUUID(),title:'ODBIOR2- RAID ZMIENIONA',description:null,status:null,probability:null,severity:null,ownerId:null,dueDate:null,mitigationPlan:null});
    console.log(`  ZMIEN -> ${u.s} ${u.t.slice(0,160)}`);
    const v2=(()=>{try{return JSON.parse(u.t).aggregateVersion??v+1}catch{return v+1}})();
    const d=await c('DELETE',`/api/initiatives/runtime-v1/initiatives/${init}/raid-items/${rid}`,
      {expectedVersion:v2,clientRequestId:'ODBIOR2-'+randomUUID()});
    console.log(`  USUN -> ${d.s} ${d.t.slice(0,160)}`);
    break;
  }
}
