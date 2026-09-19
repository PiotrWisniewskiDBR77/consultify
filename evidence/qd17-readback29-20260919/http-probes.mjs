// QD17 READBACK-29 — instrument A: odczyty HTTP paczek SERVEROWYCH wdrożenia 29
// na ŻYWYM stagingu (deployment 31). ZERO zapisów: tylko GET. Reguła 10: hasło z
// DOSTEP.md w runtime, nigdy w pliku/logu.
import fs from 'node:fs';

const BASE = 'https://staging.consultify.ai';
const OUT = '/Users/piotrwisniewski/Developer/qoder-wt/consultify-d/evidence/qd17-readback29-20260919/http-na-zywo.txt';

function creds(rel) {
  const d = fs.readFileSync(process.env.HOME + rel, 'utf8');
  const email = (d.match(/E-?mail:\s*`?([^\s`]+@[^\s`]+)`?/i) || [])[1];
  const pass = process.env.CTO_TEST_PASSWORD || (d.match(/Has[łl]o[^:\n]*:\s*`([^`]+)`/i) || [])[1];
  if (!email || !pass) throw new Error('PARSE_FAIL ' + rel);
  return { email, pass };
}

const { email, pass } = creds('/Developer/cto-codex/irina-20260914/DOSTEP.md');
const lr = await fetch(BASE + '/api/auth/login', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email, password: pass }),
});
const lj = await lr.json();
const T = lj.token || lj.accessToken;
if (!T) throw new Error('LOGIN_FAIL ' + lr.status);

const lines = [];
const log = (s) => { lines.push(s); };

log('# QD17 READBACK-29 — instrument A: HTTP GET na żywym stagingu');
log(`# baza=${BASE}  konto=irina (ADMIN, org aktywna=Northwind — BEZ switch-organization, zero zapisów)`);
log(`# login HTTP=${lr.status}`);

async function probe(label, url, opts = {}) {
  const r = await fetch(BASE + url, { headers: { authorization: 'Bearer ' + T }, ...opts });
  const txt = await r.text();
  let j = null; try { j = JSON.parse(txt); } catch { /* nie-JSON */ }
  const pick = opts.pick ? opts.pick(j, txt) : '';
  log(`[${label}] GET ${url} -> HTTP ${r.status}${pick ? '  ' + pick : ''}`);
  return { status: r.status, json: j, raw: txt };
}

function arr(j) {
  if (Array.isArray(j)) return j;
  for (const k of ['data', 'items', 'results', 'projects', 'initiatives', 'meetings', 'tasks', 'reports', 'decks', 'sessions', 'members']) {
    if (j && Array.isArray(j[k])) return j[k];
    if (j && j.data && Array.isArray(j.data[k])) return j.data[k];
  }
  return [];
}
const firstId = (a) => (a[0] && (a[0].id || a[0].uuid || a[0].projectId || a[0].initiativeId || a[0].meetingId || a[0].reportId || a[0].deckId || a[0].sessionId || a[0].artifactId)) || null;

// --- 0. tożsamość wdrożenia -------------------------------------------------
const h = await probe('A0-health', '/api/health', { pick: (j) => `gitSha=${j?.gitSha} db=${j?.database} redis=${j?.redis}` });
const LIVE_SHA = h.json?.gitSha;

// --- 1. D-15 teams: usunięty legacy router ---------------------------------
await probe('A1a-teams-control', '/api/teams', { pick: (j, t) => `n=${arr(j).length}` });
await probe('A1b-teams-legacy-members', '/api/teams/00000000-0000-4000-8000-000000000000/members', { pick: () => 'oczekiwane 404 (ścieżka tylko legacy)' });

// --- 2. MTG-2 protokół spotkania -------------------------------------------
const MID = 'c0f1e001-7a11-4f01-9c01-0f0a1b2c3e01';
const ml = await probe('A2a-meeting-list', '/api/meeting', { pick: (j) => `n=${arr(j).length}` });
const midLive = firstId(arr(ml.json)) || MID;
await probe('A2b-meeting-protocol', `/api/meeting/${MID}/protocol`, { pick: (j) => `klucze=${j && typeof j === 'object' ? Object.keys(j).slice(0, 12).join(',') : typeof j}` });
await probe('A2c-meeting-protocol-live', `/api/meeting/${midLive}/protocol`, { pick: (j) => `klucze=${j && typeof j === 'object' ? Object.keys(j).slice(0, 12).join(',') : typeof j}` });

// --- 3. K-26 my-work: cykle statusów kanban --------------------------------
await probe('A3a-mywork-tasks', '/api/my-work/tasks', { pick: (j) => `n=${arr(j).length}` });
await probe('A3b-mywork-personal', '/api/my-work/personal-tasks', { pick: (j) => `n=${arr(j).length}` });

// --- 4. D-16 project-members: email ukryty przed członkami -----------------
const PID = '6174636d-c4f2-552d-9a5a-d2695738f9bc';
const pm = await probe('A4a-project-members', `/api/project-members/${PID}`, {
  pick: (j) => {
    const a = arr(j);
    const zEmailem = a.filter((x) => x && typeof x.email === 'string' && x.email.length > 0).length;
    return `n=${a.length} wierszy-z-polem-email=${zEmailem}`;
  },
});
await probe('A4b-project-roles', `/api/project-members/${PID}/roles/available`, { pick: (j) => `n=${arr(j).length}` });

// --- 5. PMO-1b / inicjatywy ------------------------------------------------
const il = await probe('A5a-initiatives', '/api/initiatives', { pick: (j) => `n=${arr(j).length}` });
const iidLive = firstId(arr(il.json)) || 'cf84cf02-2e86-4458-8743-2a787a5527b1';
await probe('A5b-initiative-detail', `/api/initiatives/${iidLive}`, {
  pick: (j, t) => {
    const pl = (t.match(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g) || []).length;
    return `tytul=${(j?.data?.title || j?.title || '').toString().slice(0, 40)} polskie-znaki-w-odpowiedzi=${pl}`;
  },
});
await probe('A5c-capacity-org', '/api/initiatives/capacity', { pick: (j) => `klucze=${j && typeof j === 'object' ? Object.keys(j).slice(0, 8).join(',') : typeof j}` });
await probe('A5d-capacity-initiative', `/api/initiatives/${iidLive}/capacity`, { pick: (j) => `klucze=${j && typeof j === 'object' ? Object.keys(j).slice(0, 8).join(',') : typeof j}` });
log('# UWAGA PMO-1b: jedyna trasa SLA to POST /api/initiatives/stage-sla/tick (mutująca) — NIE wywołana (zero zapisów).');

// --- 6. A7-M1 / DEC-537 runtime-v1 ----------------------------------------
const rt = await probe('A6a-runtime-initiatives', '/api/initiatives/runtime-v1/initiatives', {
  pick: (j) => {
    const a = arr(j);
    // wiersz ma kształt { version, initiative, updatedAt } — pola DEC-537 są w `initiative`
    const pick = (x) => (x && x.initiative ? x.initiative : x) || {};
    const zScorem = a.filter((x) => pick(x).priorityScore !== undefined && pick(x).priorityScore !== null).length;
    const zrodla = [...new Set(a.map((x) => pick(x).prioritySource).filter(Boolean))];
    const score = a.map((x) => pick(x).priorityScore);
    return `n=${a.length} wierszy-z-priorityScore=${zScorem} score=${JSON.stringify(score)} prioritySource=${zrodla.join('|') || '-'}`;
  },
});
await probe('A6b-capacity-roles', '/api/initiatives/runtime-v1/capacity-roles', { pick: (j) => `n=${arr(j).length}` });
await probe('A6c-capacity-scenarios', '/api/initiatives/runtime-v1/capacity-scenarios', { pick: (j) => `n=${arr(j).length}` });
await probe('A6d-plan-scenarios', '/api/initiatives/runtime-v1/plan-scenarios', { pick: (j) => `n=${arr(j).length}` });
await probe('A6e-plannable', '/api/initiatives/runtime-v1/planning/plannable-initiatives', { pick: (j) => `n=${arr(j).length}` });

// --- 7. A2 legacy reports -> builder document shape ------------------------
const ar = await probe('A7a-audit-reports', '/api/audits/reports', {
  pick: (j) => {
    const a = arr(j);
    return `n=${a.length} z-reportBuilderDocument=${a.filter((x) => x && x.reportBuilderDocument !== undefined).length}`;
  },
});
const arId = firstId(arr(ar.json));
if (arId) {
  await probe('A7b-audit-report-detail', `/api/audits/reports/${arId}`, {
    pick: (j) => `klucze=${j && typeof j === 'object' ? Object.keys(j).slice(0, 10).join(',') : '-'} data.klucze=${j?.data && typeof j.data === 'object' ? Object.keys(j.data).slice(0, 10).join(',') : '-'}`,
  });
} else log('[A7b-audit-report-detail] POMINIĘTE — brak wiersza na liście');
const mr = await probe('A7c-mgmt-reports-history', '/api/management-reports/history', { pick: (j) => `n=${arr(j).length}` });
const mrId = firstId(arr(mr.json));
if (mrId) {
  await probe('A7d-mgmt-report-detail', `/api/management-reports/${mrId}`, {
    pick: (j) => `klucze=${j && typeof j === 'object' ? Object.keys(j).slice(0, 10).join(',') : '-'}`,
  });
} else log('[A7d-mgmt-report-detail] POMINIĘTE — brak wiersza na liście');

// --- 8. RD-2 v2 deck artifact shell + 64401abc version/publish -------------
const dl = await probe('A8a-decks', '/api/presentations/decks', { pick: (j) => `n=${arr(j).length}` });
const deckId = firstId(arr(dl.json));
if (deckId) {
  await probe('A8b-deck-detail', `/api/presentations/decks/${deckId}`, {
    pick: (j) => `klucze=${j && typeof j === 'object' ? Object.keys(j).slice(0, 14).join(',') : '-'} artifactLifecycle=${j?.artifactLifecycle !== undefined || j?.data?.artifactLifecycle !== undefined}`,
  });
  await probe('A8c-deck-versions', `/api/presentations/decks/${deckId}/versions`, { pick: (j) => `n=${arr(j).length}` });
} else log('[A8b/A8c] POMINIĘTE — brak decków');
await probe('A8d-workcanvas-drafts', '/api/work-canvas/drafts', { pick: (j) => `n=${arr(j).length}` });
await probe('A8e-public-artifact-brak-tokena', '/api/public/artifacts/00000000-0000-4000-8000-000000000000', { pick: () => 'kontrola: trasa zamontowana (404/403 = brak tokena, nie brak trasy)' });

// --- 9. IS-2a pełne kolumny sesji wywiadu ----------------------------------
const is = await probe('A9-interview-sessions', '/api/interview/sessions', {
  pick: (j) => {
    const a = arr(j);
    const k = a[0] ? Object.keys(a[0]) : [];
    // dyskryminator IS-2a: `sessionRuntimeStatus` na tej trasie emituje WYŁĄCZNIE
    // mapInterviewSessionFullColumnsRow (InterviewController.ts:2681)
    const full = k.includes('sessionRuntimeStatus');
    return `n=${a.length} INTERVIEW_SESSIONS_FULL_COLUMNS=${full ? 'ON (sessionRuntimeStatus obecny)' : 'OFF'} klucze-wiersza=${k.join(',')}`;
  },
});

// --- 10. i18n bundles (DEC-461) --------------------------------------------
for (const lng of ['en', 'pl']) {
  const r = await fetch(`${BASE}/locales/${lng}/translation.json`);
  const t = await r.text();
  log(`[A10-locale-${lng}] GET /locales/${lng}/translation.json -> HTTP ${r.status}  bajty=${t.length}`);
}

log('');
log(`# gitSha na żywo = ${LIVE_SHA}`);
log('# koniec — wszystkie wywołania to GET (zero zapisów)');

fs.writeFileSync(OUT, lines.join('\n') + '\n');
console.log(lines.join('\n'));
