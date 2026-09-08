/**
 * Pomiar SEKWENCYJNY endpointów Realizacji: czas + liczba zapytań SQL.
 * [ODMROZENIE 06_EXECUTION DEC-453]
 *
 * Sekwencyjnie (jedno żądanie naraz), bo licznik `dbQueryCount` w
 * performanceMetrics.middleware.ts jest globalnym callbackiem — przy
 * równoległych żądaniach przypisałby zapytania do złego żądania.
 *
 * node scripts/dev/perf-endpointy-dbr77.mjs --out evidence/perf-realizacja-dbr77/endpointy-przed.json
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const API = getArg('api', 'http://127.0.0.1:4174');
const LOG = path.resolve(getArg('log', 'api.log'));
const OUT = path.resolve(getArg('out', 'evidence/perf-realizacja-dbr77/endpointy.json'));
const POWTORZ = Number(getArg('powtorz', '3'));

const login = async (email, password) => {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const j = await r.json();
  return j.token;
};

const token = await login('audyt@dbr77.local', 'AudytDBR77!2026');

const ENDPOINTY = [
  '/api/initiatives/runtime-v1/execution-cases',
  '/api/initiatives/runtime-v1/management-signals',
  '/api/initiatives/runtime-v1/interventions',
  '/api/initiatives/runtime-v1/capacity-options',
  '/api/initiatives/runtime-v1/report-definitions',
  '/api/initiatives/runtime-v1/report-runs',
  '/api/v8/execution-control/manager/lanes/action-queue/problems',
  '/api/v8/execution-control/manager/lanes/blockers/problems',
  '/api/v8/execution-control/manager/lanes/people-change/problems',
  '/api/v8/execution-control/manager/lanes/risk/problems',
  '/api/v8/execution-control/manager/lanes/decisions/problems',
  '/api/v8/execution-control/capacity/leveling-alerts',
  '/api/v8/execution-control/capacity/timeline',
  '/api/v8/execution-control/timeline-warnings',
  '/api/v8/execution-control/budget/overspend-signals',
  '/api/execution-control/capacity/resource-plan',
  '/api/tasks',
  '/api/raid',
  '/api/report-builder/definitions',
  '/api/action-cards',
];

// dociągnij listę execution-cases, żeby zmierzyć wachlarz per-case
let caseIds = [];
try {
  const r = await fetch(`${API}/api/initiatives/runtime-v1/execution-cases`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const j = await r.json();
  const arr = Array.isArray(j) ? j : j.data || j.cases || j.items || [];
  caseIds = arr
    .map((c) => c.executionCaseId || c.id || c.caseId)
    .filter(Boolean)
    .slice(0, 5);
} catch {}
for (const id of caseIds) {
  ENDPOINTY.push(`/api/initiatives/runtime-v1/execution-cases/${id}/work`);
  ENDPOINTY.push(`/api/initiatives/runtime-v1/execution-cases/${id}/allocations`);
}

// czytaj dbQueryCount dopisany do api.log po żądaniu
const czytajOgonLogu = (odBajtu) => {
  const st = fs.statSync(LOG);
  if (st.size <= odBajtu) return { tekst: '', koniec: st.size };
  const fd = fs.openSync(LOG, 'r');
  const buf = Buffer.alloc(st.size - odBajtu);
  fs.readSync(fd, buf, 0, buf.length, odBajtu);
  fs.closeSync(fd);
  return { tekst: buf.toString('utf8'), koniec: st.size };
};

const wyniki = [];
for (const ep of ENDPOINTY) {
  const czasy = [];
  let sql = null;
  let status = null;
  for (let i = 0; i < POWTORZ; i++) {
    const przed = fs.statSync(LOG).size;
    const t0 = Date.now();
    const r = await fetch(`${API}${ep}`, { headers: { Authorization: `Bearer ${token}` } });
    await r.text();
    czasy.push(Date.now() - t0);
    status = r.status;
    // metryka trafia do logu chwilę po odpowiedzi
    await new Promise((res) => setTimeout(res, 350));
    const { tekst } = czytajOgonLogu(przed);
    // UWAGA: log ma kody ANSI (\x1b[33m) — zawieraja CYFRY, wiec \D* je ucina.
    const m = [...tekst.matchAll(/(?:High DB query count|Performance metric)[\s\S]*?(\{[^\n]*\})/g)];
    for (const mm of m) {
      try {
        const j = JSON.parse(mm[1]);
        if (String(j.path || '').split('?')[0] === ep) sql = j.dbQueryCount ?? sql;
      } catch {}
    }
  }
  const median = [...czasy].sort((a, b) => a - b)[Math.floor(czasy.length / 2)];
  wyniki.push({ endpoint: ep, status, msMediana: median, msWszystkie: czasy, sqlZapytan: sql });
  console.log(
    `${String(sql ?? '?').padStart(4)} SQL  ${String(median).padStart(5)}ms  [${status}]  ${ep}`
  );
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ api: API, kiedy: new Date().toISOString(), wyniki }, null, 2));
console.log(`\nZapisano: ${OUT}`);
