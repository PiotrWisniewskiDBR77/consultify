/**
 * Liczba round-tripow do bazy na jedno zadanie — mierzona licznikiem
 * `pg_stat_database.xact_commit`. [ODMROZENIE 06_EXECUTION DEC-453]
 *
 * Dlaczego akurat tak, po odrzuceniu dwoch innych przyrzadow:
 *  - `dbQueryCount` z performanceMetrics.middleware.ts loguje sie DOPIERO powyzej
 *    10 zapytan, wiec po naprawie „brak wpisu" nie odroznia „jest 8" od
 *    „metryka umarla";
 *  - parsowanie `docker logs` gubilo wiersze przy wiekszym ruchu i oddawalo
 *    ciche zera (zmierzone: te same endpointy raz 64, raz 0);
 *  - `pg_stat_statements` wymaga restartu kontenera wspoldzielonego z innymi
 *    robotnikami — nie ruszam.
 *
 * `xact_commit` liczy zatwierdzone transakcje bazy. Kazde zapytanie sterownika w
 * autocommit to jedna transakcja, wiec przyrost licznika wokol jednego zadania
 * HTTP jest miara liczby round-tripow. Liczy tylko TE baze, wiec praca innych
 * robotnikow na innych bazach tego samego serwera nie zaklóca pomiaru.
 *
 * ROZGRZEWKA jest obowiazkowa: pierwsze zadanie po restarcie API placi za DDL
 * `ensureProjectRoleTemplateSchema`, odczyt `information_schema` i seed szablonow
 * rol. Bez rozgrzewki ten sam endpoint pokazywal 15 albo 5 zaleznie od miejsca
 * w kolejce pomiaru.
 *
 * node scripts/dev/perf-transakcje-pg.mjs --out <plik.json>
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const API = getArg('api', 'http://127.0.0.1:4174');
const KONTENER = getArg('kontener', 'consultify-pg18');
const BAZA = getArg('baza', 'consultify_kopia_perf');
const POWTORZ = Number(getArg('powtorz', '5'));
const OUT = path.resolve(getArg('out', 'evidence/perf-realizacja-dbr77/transakcje.json'));

function licznikTransakcji() {
  const out = execFileSync(
    'docker',
    [
      'exec',
      KONTENER,
      'psql',
      '-U',
      'postgres',
      '-t',
      '-A',
      '-c',
      // `stats_fetch_consistency=none` — bez tego psql zamraza migawke statystyk
      // na czas transakcji i licznik potrafi oddac te sama wartosc dwa razy pod
      // rzad (widzielismy wtedy „0 zapytan" dla zadania, ktore odpowiadalo 200).
      `SET stats_fetch_consistency='none'; SELECT xact_commit FROM pg_stat_database WHERE datname='${BAZA}'`,
    ],
    { encoding: 'utf8' }
  );
  const wiersze = String(out)
    .split('\n')
    .map((x) => x.trim())
    .filter((x) => /^\d+$/.test(x));
  return Number(wiersze[wiersze.length - 1]);
}

const zaloguj = async (email, haslo) => {
  const r = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: haslo }),
  });
  return (await r.json()).token;
};
const token = await zaloguj('audyt@dbr77.local', 'AudytDBR77!2026');

const SCIEZKI = [
  '/api/initiatives/runtime-v1/execution-cases',
  '/api/initiatives/runtime-v1/management-signals',
  '/api/initiatives/runtime-v1/interventions',
  '/api/initiatives/runtime-v1/capacity-options',
  '/api/initiatives/runtime-v1/report-definitions',
  '/api/initiatives/runtime-v1/report-runs',
  '/api/initiatives/runtime-v1/execution-cases/demo-story-20260826-execution-oee/work',
  '/api/initiatives/runtime-v1/execution-cases/demo-story-20260826-execution-oee/allocations',
  '/api/v8/execution-control/manager/lanes/action-queue/problems',
  '/api/v8/execution-control/manager/lanes/blockers/problems',
  '/api/v8/execution-control/capacity/leveling-alerts',
  '/api/v8/execution-control/capacity/timeline',
  '/api/v8/execution-control/budget/overspend-signals',
  '/api/execution-control/capacity/resource-plan',
  '/api/tasks',
  '/api/raid',
  '/api/report-builder/definitions',
  '/api/organizations/current',
];

const pobierz = (sciezka) =>
  fetch(`${API}${sciezka}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) =>
    r.text().then(() => r.status)
  );

// rozgrzewka — patrz naglowek
for (const sciezka of SCIEZKI) {
  await pobierz(sciezka);
  await pobierz(sciezka);
}
await new Promise((r) => setTimeout(r, 1500));

const wyniki = [];
for (const sciezka of SCIEZKI) {
  const proby = [];
  let status = null;
  for (let i = 0; i < POWTORZ; i += 1) {
    const przed = licznikTransakcji();
    status = await pobierz(sciezka);
    await new Promise((r) => setTimeout(r, 700));
    proby.push(licznikTransakcji() - przed);
  }
  const posortowane = [...proby].sort((a, b) => a - b);
  const mediana = posortowane[Math.floor(posortowane.length / 2)];
  wyniki.push({ sciezka, status, mediana, proby });
  console.log(`${String(mediana).padStart(4)}  [${proby.join(',')}]  ${status}  ${sciezka}`);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ api: API, baza: BAZA, kiedy: new Date().toISOString(), wyniki }, null, 2));
console.log(`\nZapisano: ${OUT}`);
