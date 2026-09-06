import pg from 'pg';
const ORG='cc9db573-260f-4a19-927f-f3cc1fbaea38';
const USER='76015d70-9117-444f-97a6-4f5eda9d7ad5';
const PROJ='11111111-2222-4333-8444-555555555555';
const answers = (nazwa) => ({
  items: [
    { id:'i1', text:'Doświadczony zespół wdrożeniowy robotyki', quadrant:'strengths', impact:'high', proposalStatus:'accepted', evidenceStatus:'confirmed' },
    { id:'i2', text:'Rosnący popyt na automatyzację w DACH', quadrant:'opportunities', impact:'high', proposalStatus:'accepted', evidenceStatus:'confirmed' },
  ],
  tensions: [
    { id:'t1', title:'Moce wdrożeniowe vs popyt', type:'attack', linkedItemIds:['i1','i2'], linkedCorrelationIds:[], insight:`${nazwa}: popyt rośnie szybciej niż moce.` },
  ],
  recommendedMoves: [
    { id:'m1', title:'Uruchomić pilota w DACH', category:'quick-win', rationale:'Popyt rośnie, zespół wdrożeniowy jest niewykorzystany.', linkedTensionIds:['t1'], linkedItemIds:['i1'], expectedImpact:'high', estimatedEffort:'medium', firstStep:'Wybrać klienta pilotażowego', ownerRole:'Dyrektor sprzedaży', tradeoff:{chosen:'Pilot w DACH', deferred:'Rozwój produktu', cost:'Dług produktowy +1Q'}, rejectedAlternative:{option:'Wejście przez partnera', reason:'Utrata kontroli nad wdrożeniem'} },
  ],
});
const SESJE = [
  ['t1t1-swot-dach','dynamic-swot','SWOT — ekspansja DACH 2026','APPROVED'],
  ['t1t1-swot-serwis','dynamic-swot','SWOT — model serwisowy po wdrożeniu','APPROVED'],
  ['t1t1-swot-portfel','dynamic-swot','SWOT — portfel produktowy robotyki','APPROVED'],
  ['t1t1-swot-kadry','dynamic-swot','SWOT — kompetencje zespołu wdrożeń','REVIEW'],
  ['t1t1-swot-marza','dynamic-swot','SWOT — marża na projektach pod klucz','DRAFT'],
];
const c = new pg.Client({connectionString:'postgres://postgres:noc@127.0.0.1:54400/consultify_noc'});
await c.connect();
for (const [id,type,name,status] of SESJE) {
  await c.query(
    `INSERT INTO tool_sessions (id, organization_id, project_id, tool_type, name, status,
       completion_percent, confidence_avg, answers_json, dod_status, version, created_by, updated_by,
       created_at, updated_at, approved_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,4.5,$8,'passed',1,$9,$9,NOW() - interval '20 days', NOW() - interval '3 days', $10)
     ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status, answers_json=EXCLUDED.answers_json,
       completion_percent=EXCLUDED.completion_percent, confidence_avg=EXCLUDED.confidence_avg`,
    [id, ORG, PROJ, type, name, status, status==='DRAFT'?45:100, JSON.stringify(answers(name)), USER,
     status==='APPROVED' ? new Date(Date.now()-3*864e5) : null]
  );
}
const r = await c.query(`SELECT status, count(*) FROM tool_sessions WHERE organization_id=$1 GROUP BY 1`,[ORG]);
console.log(r.rows);
await c.end();
