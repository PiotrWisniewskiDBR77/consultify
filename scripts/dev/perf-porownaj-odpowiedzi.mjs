/**
 * Porownanie ODPOWIEDZI API przed/po naprawie wydajnosciowej.
 * [ODMROZENIE 06_EXECUTION DEC-453]
 *
 * Sens: naprawa ma zmieniac liczbe zapytan, a NIE tresc odpowiedzi. Ten skrypt
 * zrzuca odpowiedzi (ADMIN i MEMBER) do pliku; drugi przebieg po naprawie
 * porownuje bajt w bajt po normalizacji pol czasowych.
 *
 * node scripts/dev/perf-porownaj-odpowiedzi.mjs --out <plik.json>
 * node scripts/dev/perf-porownaj-odpowiedzi.mjs --porownaj <przed.json> <po.json>
 */
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const API = getArg('api', 'http://127.0.0.1:4174');

// pola zmienne z natury (czas serwera, identyfikatory korelacji) — nie roznica semantyczna
const POLA_ZMIENNE = /^(generatedAt|timestamp|serverTime|now|requestId|correlationId|asOf|_ts)$/;
function normalizuj(x) {
  if (Array.isArray(x)) return x.map(normalizuj);
  if (x && typeof x === 'object') {
    const out = {};
    for (const k of Object.keys(x).sort()) {
      if (POLA_ZMIENNE.test(k)) continue;
      out[k] = normalizuj(x[k]);
    }
    return out;
  }
  return x;
}

const tryb = args.indexOf('--porownaj');
if (tryb >= 0) {
  const a = JSON.parse(fs.readFileSync(path.resolve(args[tryb + 1]), 'utf8'));
  const b = JSON.parse(fs.readFileSync(path.resolve(args[tryb + 2]), 'utf8'));
  let zgodne = 0;
  const roznice = [];
  for (const klucz of Object.keys(a)) {
    const x = JSON.stringify(normalizuj(a[klucz]));
    const y = JSON.stringify(normalizuj(b[klucz] ?? null));
    if (x === y) zgodne += 1;
    else roznice.push({ klucz, dlugoscPrzed: x.length, dlugoscPo: y.length });
  }
  console.log(`ZGODNE: ${zgodne}/${Object.keys(a).length}`);
  if (roznice.length) {
    console.log('ROZNICE:');
    for (const r of roznice) console.log(`  ${r.klucz}  ${r.dlugoscPrzed} -> ${r.dlugoscPo}`);
    process.exitCode = 1;
  } else {
    console.log('Brak roznic semantycznych.');
  }
} else {
  const login = async (email, password) => {
    const r = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return (await r.json()).token;
  };
  const konta = {
    admin: await login('audyt@dbr77.local', 'AudytDBR77!2026'),
    member: await login('member@dbr77.local', 'AudytDBR77!2026'),
  };

  const SCIEZKI = [
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
    '/api/organizations/current',
    '/api/my-work/personal-tasks',
  ];

  // wachlarz per execution-case — tam mieszka autoryzacja per agregat
  const r0 = await fetch(`${API}/api/initiatives/runtime-v1/execution-cases`, {
    headers: { Authorization: `Bearer ${konta.admin}` },
  });
  const j0 = await r0.json();
  for (const c of (j0.cases || []).slice(0, 5)) {
    SCIEZKI.push(`/api/initiatives/runtime-v1/execution-cases/${c.executionCaseId}/work`);
    SCIEZKI.push(`/api/initiatives/runtime-v1/execution-cases/${c.executionCaseId}/allocations`);
  }

  const zrzut = {};
  for (const [rola, token] of Object.entries(konta)) {
    for (const sciezka of SCIEZKI) {
      const r = await fetch(`${API}${sciezka}`, { headers: { Authorization: `Bearer ${token}` } });
      let tresc;
      try {
        tresc = await r.json();
      } catch {
        tresc = null;
      }
      zrzut[`${rola} ${sciezka}`] = { status: r.status, tresc };
    }
  }
  const OUT = path.resolve(getArg('out', 'evidence/perf-realizacja-dbr77/odpowiedzi.json'));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(zrzut, null, 2));
  console.log(`Zapisano ${Object.keys(zrzut).length} odpowiedzi: ${OUT}`);
}
