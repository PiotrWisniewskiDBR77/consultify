// ODBIÓR 2 (60051310d7) — B-1..B-4 na REKORDACH ZASTANYCH (nie nowo utworzonych!).
// Zarzut do dowodu 00:10: zadanie utworzone przez POST /api/tasks ma projectId=null,
// więc MEMBER nie ma tam roli projektowej -> 403 pada z powodu "missing capability",
// a nie z powodu predykatu własności. Dziura z §4 otwierała się WYŁĄCZNIE tam,
// gdzie wołający ma rolę .scoped w TYM SAMYM projekcie co obiekt.
import { readFileSync, writeFileSync } from 'node:fs';
const S='/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/646e7b40-15a2-49d1-b55f-c3d22cf9b27c/scratchpad';
const O=JSON.parse(readFileSync(`${S}/sesja-staging-owner.json`,'utf8'));
const M=JSON.parse(readFileSync(`${S}/sesja-staging-member.json`,'utf8'));
const BASE=O.base; let fivexx=[]; const log=[];
function p(s){console.log(s);log.push(s);}
async function call(s,m,path,body,quiet){
  const h={'Authorization':`Bearer ${s.token}`}; if(body!==undefined)h['Content-Type']='application/json';
  const t0=Date.now();
  const r=await fetch(BASE+path,{method:m,headers:h,body:body===undefined?undefined:JSON.stringify(body)});
  const ms=Date.now()-t0; let j=null; try{j=await r.json();}catch{}
  if(r.status>=500){fivexx.push(`${m} ${path} -> ${r.status} ${j?.correlationId||''}`);}
  if(!quiet)p(`${(s.role||'?').padEnd(6)} ${m.padEnd(6)} ${path.slice(0,72).padEnd(74)} -> ${r.status}${j?.code?' '+j.code:''}${j?.error&&!j?.code?' '+String(j.error).slice(0,40):''} (${ms}ms)`);
  return {status:r.status,json:j,ms};
}
const PROJ='6174636d-1c52-5e45-9fb2-1b6e5b5b7c9e';
// --- 0. rozpoznanie: zadania Northwind, kto reporterem/wykonawcą
const all=await call(O,'GET','/api/tasks');
const rows=all.json?.tasks||all.json?.data||all.json||[];
p(`  ZADAN: ${Array.isArray(rows)?rows.length:'?'}`);
const me=O.user.id;
const reporterNotAssignee=rows.filter(t=>(t.reporterId===me||t.createdBy===me||t.reporter_id===me)&&t.assigneeId!==me);
const assigneeMe=rows.filter(t=>t.assigneeId===me);
p(`  jako REPORTER ale NIE wykonawca: ${reporterNotAssignee.length} | jako WYKONAWCA: ${assigneeMe.length}`);
const projIds=[...new Set(rows.map(t=>t.projectId).filter(Boolean))];
p(`  projekty w zadaniach: ${JSON.stringify(projIds)}`);
// --- 1. rola projektowa daniela
for(const pid of projIds.slice(0,3)){
  const mem=await call(O,'GET',`/api/projects/${pid}/members`,undefined,true);
  const list=mem.json?.members||mem.json?.data||mem.json||[];
  const d=Array.isArray(list)?list.find(x=>x.userId===M.user.id||x.user_id===M.user.id||x.id===M.user.id):null;
  p(`  projekt ${pid}: czlonkow=${Array.isArray(list)?list.length:'?'} rola daniela=${d?(d.projectRole||d.role):'BRAK'}`);
}
// --- 2. rekord kanoniczny: zadanie w projekcie gdzie daniel ma role, NIE nalezace do daniela
const cel=rows.find(t=>t.id==='f9c386c1-8b09-5276-a5a0-4452f1e283b8')||rows.find(t=>t.projectId&&t.assigneeId&&t.assigneeId!==M.user.id&&t.reporterId!==M.user.id);
p(`\n== CEL (zastany, cudzy dla MEMBER-a): ${cel?.id} "${cel?.title}" projectId=${cel?.projectId} assignee=${cel?.assigneeId} status=${cel?.status}`);
const przed={title:cel.title,assigneeId:cel.assigneeId,status:cel.status,priority:cel.priority};
p(`\n== B-1..B-3: MEMBER (daniel) na CUDZYM ZASTANYM zadaniu w projekcie, gdzie ma role .scoped`);
const b1=await call(M,'PUT',`/api/tasks/${cel.id}`,{title:'ODBIOR2- PROBA MEMBER B-1'});
const b2=await call(M,'POST',`/api/tasks/${cel.id}/assign`,{assigneeId:M.user.id});
const b3=await call(M,'POST',`/api/tasks/${cel.id}/block`,{reason:'ODBIOR2- proba B-3'});
const b3b=await call(M,'PUT',`/api/tasks/${cel.id}/status`,{status:'blocked'});
const b4=await call(M,'DELETE',`/api/tasks/${cel.id}`);
const b5=await call(M,'POST',`/api/tasks/${cel.id}/reassign`,{fromAssigneeId:przed.assigneeId,toAssigneeId:M.user.id});
const b6=await call(M,'POST',`/api/tasks/${cel.id}/unassign`,{});
const po=await call(O,'GET',`/api/tasks/${cel.id}`);
const d=po.json?.task||po.json?.data||po.json;
p(`  STAN WIERSZA PO PROBACH: title="${d?.title}" assignee=${d?.assigneeId} status=${d?.status}`);
const nietkniety = d?.title===przed.title && d?.assigneeId===przed.assigneeId && d?.status===przed.status;
p(`  WIERSZ NIETKNIETY: ${nietkniety?'TAK':'NIE !!! REGRESJA'}`);
p(`  WERDYKT B-1 (PUT): ${b1.status===403?'DZIALA (403 '+(b1.json?.code||'')+')':'REGRESJA '+b1.status}`);
p(`  WERDYKT B-2 (assign): ${b2.status===403?'DZIALA (403 '+(b2.json?.code||'')+')':'REGRESJA '+b2.status}`);
p(`  WERDYKT B-3 (block): ${b3.status===403?'DZIALA (403 '+(b3.json?.code||'')+')':'REGRESJA '+b3.status}`);
// --- 3. kontrola pozytywna: MEMBER na WLASNYM zadaniu
const wlasne=rows.find(t=>t.assigneeId===M.user.id);
p(`\n== KONTROLA POZYTYWNA: MEMBER na WLASNYM zadaniu ${wlasne?.id} "${wlasne?.title}"`);
if(wlasne){
  const przedW={title:wlasne.title,status:wlasne.status};
  const w1=await call(M,'PUT',`/api/tasks/${wlasne.id}`,{title:'ODBIOR2- MEMBER wlasne'});
  const w2=await call(M,'GET',`/api/tasks/${wlasne.id}`);
  const dw=w2.json?.task||w2.json?.data||w2.json;
  p(`  po zapisie title="${dw?.title}"  -> ${w1.status===200&&dw?.title==='ODBIOR2- MEMBER wlasne'?'DZIALA (200 + zapis)':'PROBLEM '+w1.status}`);
  const r1=await call(M,'PUT',`/api/tasks/${wlasne.id}`,{title:przedW.title});
  p(`  przywrocenie tytulu: ${r1.status}`);
}
// --- 4. B-4: OWNER-reporter otwiera karte zadania, ktorego NIE jest wykonawca — na ZASTANYCH
p(`\n== B-4: GET /api/my-work/personal-tasks/<id> dla ZASTANYCH zadan (OWNER reporter, nie wykonawca)`);
let ok=0,bad=0; const bledy=[];
const probka=reporterNotAssignee.slice(0,12);
for(const t of probka){
  const g=await call(O,'GET',`/api/my-work/personal-tasks/${t.id}`,undefined,true);
  if(g.status===200)ok++;else{bad++;bledy.push(`${t.id} -> ${g.status} ${g.json?.code||''}`);}
}
p(`  probka ${probka.length} zadan (reporter, nie wykonawca): 200 = ${ok}, inne = ${bad}`);
if(bledy.length)p('  NIEUDANE: '+bledy.slice(0,5).join(' | '));
// pelny przelot po WSZYSTKICH
let ok2=0,bad2=0;
for(const t of rows){const g=await call(O,'GET',`/api/my-work/personal-tasks/${t.id}`,undefined,true); if(g.status===200)ok2++;else{bad2++;}}
p(`  PELNY PRZELOT po ${rows.length} zadaniach: 200 = ${ok2}, nie-200 = ${bad2}  (PRZED: 8/46 otwieralo sie)`);
p(`\n5xx w sondzie: ${fivexx.length} ${fivexx.join(' ; ')}`);
writeFileSync(process.env.OUT||'/dev/stdout',log.join('\n')+'\n');
