import { readFileSync } from 'node:fs';
const S='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/646e7b40-15a2-49d1-b55f-c3d22cf9b27c/scratchpad';
const O=JSON.parse(readFileSync(`${S}/sesja-staging-owner.json`,'utf8'));
const g=async p=>{const t0=Date.now();const r=await fetch(O.base+p,{headers:{Authorization:'Bearer '+O.token}});let j=null;try{j=await r.json()}catch{};return{s:r.status,j,ms:Date.now()-t0}};
const arr=x=>Array.isArray(x)?x:(x?.data||x?.items||x?.tasks||x?.decisions||x?.initiatives||x?.notifications||x?.ideas||x?.notebooks||x?.cards||x?.results||[]);
for(const [nazwa,path] of [
 ['zadania','/api/tasks'],['decyzje','/api/decisions'],['powiadomienia','/api/notifications'],
 ['inicjatywy','/api/initiatives'],['runtime-v1','/api/initiatives/runtime-v1/initiatives'],
 ['pomysly','/api/my-work/ideas'],['notatniki','/api/my-work/notebooks'],
 ['karty-dzialania','/api/action-cards'],['wnioski','/api/interview/insights'],
 ['sesje-wywiadu','/api/interview/sessions'],['wzorce','/api/interview/templates'],
 ['oceny','/api/assessments'],['audyty','/api/audit-programs'],
]){
 const r=await g(path); const a=arr(r.j);
 console.log(`${nazwa.padEnd(16)} ${path.padEnd(46)} ${r.s} n=${Array.isArray(a)?a.length:'?'} ${r.ms}ms  ${Array.isArray(a)&&a[0]?JSON.stringify({id:a[0].id,t:(a[0].title||a[0].name||a[0].subject||'').slice(0,40)}):JSON.stringify(r.j).slice(0,110)}`);
}
