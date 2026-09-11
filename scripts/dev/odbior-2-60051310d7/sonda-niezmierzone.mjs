// ODBIÓR 2 — pozycje NIEZMIERZONE z §9 poprzedniego odbioru, na żywym stagingu.
// Zapisy wyłącznie odwracalne, prefiks ODBIOR2-, sprzątane na końcu.
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
const S='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/646e7b40-15a2-49d1-b55f-c3d22cf9b27c/scratchpad';
const O=JSON.parse(readFileSync(`${S}/sesja-staging-owner.json`,'utf8'));
const M=JSON.parse(readFileSync(`${S}/sesja-staging-member.json`,'utf8'));
const BASE=O.base; const log=[]; const fivexx=[];
const p=s=>{console.log(s);log.push(s);};
async function call(s,m,path,body,quiet){
  const h={'Authorization':`Bearer ${s.token}`}; if(body!==undefined)h['Content-Type']='application/json';
  const t0=Date.now();
  const r=await fetch(BASE+path,{method:m,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
  const ms=Date.now()-t0; let j=null,txt=null; try{txt=await r.text();j=JSON.parse(txt);}catch{}
  if(r.status>=500)fivexx.push(`${m} ${path} -> ${r.status} ${j?.correlationId||j?.error?.correlationId||''}`);
  if(!quiet)p(`${(s.role||'?').padEnd(6)} ${m.padEnd(6)} ${path.slice(0,80).padEnd(82)} -> ${r.status} ${(j?.code||j?.error?.code||'')} (${ms}ms)`);
  return {status:r.status,json:j,txt,ms};
}
// ---------- 1. RAID runtime-v1: dodaj / zmień / usuń / 409 duplikat ----------
p('== §9.1 RAID runtime-v1 (dodaj/zmień/usuń, 409 duplikat) ==');
const agg=await call(O,'GET','/api/initiatives/runtime-v1/initiatives');
const aggs=agg.json?.initiatives||agg.json?.items||[];
const wpis=aggs.find(x=>String(x.initiative?.initiativeId||'').startsWith('initiative-'))||aggs[0];
const initId=wpis?.initiative?.initiativeId;
const initVer=wpis?.version;
p(`  wybrany agregat: ${initId} wersja=${initVer} stan=${wpis?.initiative?.lifecycleState}`);
p(`  agregatów runtime-v1: ${Array.isArray(aggs)?aggs.length:'?'} | wybrany: ${initId}`);
const raidId=randomUUID();
const crid=()=>'ODBIOR2-'+randomUUID();
const c1=await call(O,'POST',`/api/initiatives/runtime-v1/initiatives/${initId}/raid-items/${raidId}`,
  {expectedVersion:0,clientRequestId:crid(),type:'RISK',title:'ODBIOR2- RAID sonda',description:'odwracalna sonda odbioru',status:'OPEN',probability:'LOW',severity:'LOW'});
p(`  DODAJ -> ${c1.status} ${JSON.stringify(c1.json).slice(0,160)}`);
const ver=c1.json?.aggregateVersion??1;
// duplikat: ten sam aggregateId, expectedVersion 0 (CAS musi odmówić)
const c2=await call(O,'POST',`/api/initiatives/runtime-v1/initiatives/${initId}/raid-items/${raidId}`,
  {expectedVersion:0,clientRequestId:crid(),type:'RISK',title:'ODBIOR2- RAID duplikat',status:'OPEN'});
p(`  DUPLIKAT (expectedVersion=0 na istniejącym) -> ${c2.status} ${JSON.stringify(c2.json).slice(0,160)}`);
const u1=await call(O,'PATCH',`/api/initiatives/runtime-v1/initiatives/${initId}/raid-items/${raidId}`,
  {expectedVersion:ver,clientRequestId:crid(),title:'ODBIOR2- RAID sonda ZMIENIONA'});
p(`  ZMIEN -> ${u1.status} ${JSON.stringify(u1.json).slice(0,160)}`);
const ver2=u1.json?.aggregateVersion??ver+1;
const d1=await call(O,'DELETE',`/api/initiatives/runtime-v1/initiatives/${initId}/raid-items/${raidId}`,
  {expectedVersion:ver2,clientRequestId:crid()});
p(`  USUN -> ${d1.status} ${JSON.stringify(d1.json).slice(0,160)}`);
// ---------- 2. "Zatwierdz" - bramka + odmowa ----------
p('\n== §9.2 „Zatwierdź" (bramka definicji) — OWNER i odmowa dla MEMBER ==');
const g1=await call(O,'GET',`/api/initiatives/runtime-v1/initiatives/${initId}/gates/definition/readiness`);
p(`  gotowosc bramki: ${g1.status} ${JSON.stringify(g1.json).slice(0,220)}`);
const gm=await call(M,'POST',`/api/initiatives/runtime-v1/initiatives/${initId}/gates/definition/decisions`,
  {expectedVersion:initVer,clientRequestId:crid(),decisionId:'ODBIOR2-'+randomUUID(),outcome:'APPROVED',rationale:'ODBIOR2 sonda odmowy'});
p(`  MEMBER zatwierdza -> ${gm.status} ${String(gm.txt).slice(0,240)}`);
const go=await call(O,'POST',`/api/initiatives/runtime-v1/initiatives/${initId}/gates/definition/decisions`,
  {expectedVersion:initVer,clientRequestId:crid(),decisionId:'ODBIOR2-'+randomUUID(),outcome:'APPROVED',rationale:'ODBIOR2 sonda zatwierdzenia'});
p(`  OWNER zatwierdza -> ${go.status} ${String(go.txt).slice(0,240)}`);
// ---------- 3. Zasoby: obciazenie ----------
p('\n== §9.3 Zasoby — obciążenie ==');
for(const path of ['/api/execution/resources','/api/execution/resource-allocations','/api/v8/execution/resources',
  '/api/execution/execution-cases/bulk','/api/execution/cases']){
  const r=await call(O,'GET',path,undefined,true);
  p(`  ${path.padEnd(48)} -> ${r.status} ${String(r.txt).slice(0,120).replace(/\s+/g,' ')}`);
}
// ---------- 4. Ocena: powiazania ----------
p('\n== §9.4 Ocena — „dodaj powiązanie" ==');
const oc=await call(O,'GET','/api/assessments');
const ocId=(oc.json?.assessments||[])[0]?.id;
p(`  ocena: ${ocId}`);
for(const path of [`/api/assessments/${ocId}/linked-items`,`/api/assessments/${ocId}/links`,`/api/assessments/${ocId}/relations`]){
  const r=await call(O,'GET',path,undefined,true);
  p(`  ${path.padEnd(58)} -> ${r.status} ${String(r.txt).slice(0,110).replace(/\s+/g,' ')}`);
}
// ---------- 5. Close card ----------
p('\n== §9.5 „Close card" — realna zmiana statusu ==');
const ac=await call(O,'GET','/api/action-cards');
const cards=ac.json?.cards||ac.json?.data||ac.json||[];
const karta=(Array.isArray(cards)?cards:[]).find(c=>String(c.status||'').toLowerCase()==='open')||cards[0];
p(`  UWAGA: zamkniecie karty jest NIEODWRACALNE przez API (brak trasy reopen; actionCardService.ts:201-222 nie przyjmuje pola status) — nie powtarzam zapisu.`);
const POMIN_CLOSE=true;
p(`  karta ${karta?.id} status=${karta?.status}`);
if(karta&&!POMIN_CLOSE){
  for(const [m,path,body] of [['POST',`/api/action-cards/${karta.id}/close`,{reason:'ODBIOR2- sonda'}],
    ['PATCH',`/api/action-cards/${karta.id}`,{status:'closed'}]]){
    const r=await call(O,m,path,body,true);
    p(`  ${m} ${path.padEnd(58)} -> ${r.status} ${String(r.txt).slice(0,120).replace(/\s+/g,' ')}`);
    if(r.status===200||r.status===201){
      const chk=await call(O,'GET',`/api/action-cards/${karta.id}`,undefined,true);
      const dd=chk.json?.card||chk.json?.data||chk.json;
      p(`     -> status po zapisie: ${dd?.status}`);
      // przywrocenie
      const rb=await call(O,'PATCH',`/api/action-cards/${karta.id}`,{status:karta.status},true);
      p(`     -> przywrocenie do "${karta.status}": ${rb.status}`);
      break;
    }
  }
}
// ---------- 6. czasy + megatrendy ----------
p('\n== §6 czasy API i megatrendy ==');
for(const path of ['/api/initiatives','/api/decisions','/api/tasks']){
  const a=await call(O,'GET',path,undefined,true); const b=await call(O,'GET',path,undefined,true);
  p(`  ${path.padEnd(20)} ${a.status} ${a.ms} ms / ${b.ms} ms  (prog 3000 ms)`);
}
const mg=await call(O,'GET','/api/megatrends/baseline?industry=Industrial%20Manufacturing',undefined,true);
const mgr=mg.json?.items||mg.json?.megatrends||mg.json?.data||mg.json||[];
p(`  megatrendy: ${mg.status}, wierszy=${Array.isArray(mgr)?mgr.length:'?'}, „automotive" w odpowiedzi: ${/automotive/i.test(mg.txt||'')?'TAK':'NIE'}`);
p(`\n5xx w tej sondzie: ${fivexx.length} ${fivexx.join(' ; ')}`);
writeFileSync(process.env.OUT||'/dev/stdout',log.join('\n')+'\n');
