/**
 * Harness POMIAROWY modułu Realizacja (06_EXECUTION) na kopii danych DBR77.
 * [ODMROZENIE 06_EXECUTION DEC-453]
 *
 * Mierzy dla każdej zakładki:
 *  - czas do pełnego renderu (nawigacja -> networkidle -> widoczna treść),
 *  - listę wywołań API z czasem trwania (page.on request/response),
 *  - liczbę wywołań i najcięższe endpointy.
 *
 * Użycie:
 *   node scripts/dev/perf-realizacja-dbr77.mjs --out evidence/perf-realizacja-dbr77/przed.json
 *   [--role admin|member] [--shots <katalog>]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const getArg = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const BASE = getArg('base', 'http://127.0.0.1:3194');
const ROLE = getArg('role', 'admin');
const OUT = path.resolve(getArg('out', 'evidence/perf-realizacja-dbr77/pomiar.json'));
const SHOTS = getArg('shots', '');
const ONLY = getArg('only', '').split(',').filter(Boolean);
// --zimny: swiezy kontekst (pusty localStorage) per ekran — tak wchodzi wlasciciel
const ZIMNY = args.includes('--zimny');
// jeden przebieg to szum — kazdy ekran mierzymy POWTORZ razy i bierzemy MEDIANE
const POWTORZ = Number(getArg('powtorz', '3'));

const CREDS = {
  admin: { email: 'audyt@dbr77.local', password: 'AudytDBR77!2026' },
  member: { email: 'member@dbr77.local', password: 'AudytDBR77!2026' },
};

// Zakładki modułu Realizacja (ExecutionHub: summary|list|work|resources|control|reports)
const EKRANY_ADMIN = [
  { id: 'kokpit', tab: 'summary', nazwa: 'Kokpit' },
  { id: 'realizacje', tab: 'list', nazwa: 'Realizacje' },
  { id: 'praca', tab: 'work', nazwa: 'Praca' },
  { id: 'zasoby', tab: 'resources', nazwa: 'Zasoby' },
  { id: 'decyzje', tab: 'control', nazwa: 'Decyzje i ryzyka' },
  { id: 'raporty', tab: 'reports', nazwa: 'Raporty' },
];
const EKRANY_MEMBER = [
  { id: 'praca', tab: 'work', nazwa: 'Praca (MEMBER)' },
  { id: 'realizacje', tab: 'list', nazwa: 'Realizacje (MEMBER)' },
];

const ekrany = (ROLE === 'member' ? EKRANY_MEMBER : EKRANY_ADMIN).filter(
  (e) => ONLY.length === 0 || ONLY.includes(e.id)
);

const browser = await chromium.launch();

// --- zbieranie wywołań API ---
let zbieraj = false;
let wywolania = [];
let ostatniRuchGlobal = Date.now();
const starty = new Map();
const bledy = [];

const { email, password } = CREDS[ROLE];

async function nowaSesja() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  podepnij(page);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 90000 });
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.getByRole('button', { name: /log in|zaloguj|sign in/i }).click();
  await page.waitForTimeout(3000);
  return { context, page };
}

function podepnij(page) {
page.on('request', (req) => {
  if (!zbieraj) return;
  if (!req.url().includes('/api/')) return;
  starty.set(req, Date.now());
});
page.on('response', async (res) => {
  if (!zbieraj) return;
  const req = res.request();
  if (!req.url().includes('/api/')) return;
  const t0 = starty.get(req);
  if (!t0) return;
  ostatniRuchGlobal = Date.now();
  wywolania.push({
    url: req.url().replace(BASE, ''),
    metoda: req.method(),
    status: res.status(),
    ms: Date.now() - t0,
  });
});
page.on('requestfailed', (req) => {
  if (zbieraj && req.url().includes('/api/')) {
    bledy.push(`FAILED ${req.method()} ${req.url().replace(BASE, '')} :: ${req.failure()?.errorText}`);
  }
});
}

let sesja = await nowaSesja();
let page = sesja.page;

const wyniki = [];
for (const ekran of ekrany) {
 const przebiegi = [];
 for (let powt = 0; powt < POWTORZ; powt += 1) {
  if (ZIMNY) {
    // swiezy kontekst => pusty localStorage (zaden persist Zustand nie podaje danych z cache)
    await sesja.context.close();
    sesja = await nowaSesja();
    page = sesja.page;
  } else {
    // reset na neutralny ekran, żeby każdy pomiar liczył pełne wejście na zakładkę
    await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(1200);
  }

  wywolania = [];
  starty.clear();
  zbieraj = true;
  const t0 = Date.now();
  ostatniRuchGlobal = t0;
  let msNetworkidle = null;
  let timeout = false;
  try {
    await page.goto(`${BASE}/execution?tab=${ekran.tab}`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    msNetworkidle = Date.now() - t0;
  } catch (e) {
    timeout = true;
    msNetworkidle = Date.now() - t0;
  }
  // pełny render = networkidle + widoczna treść (tabela / karty)
  let msTresc = null;
  try {
    await page
      .locator('table tbody tr, [role="row"], [data-testid*="card"], [class*="grid"] > div')
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });
    msTresc = Date.now() - t0;
  } catch {
    msTresc = null;
  }
  // FAKTYCZNY koniec: brak NOWEGO wywołania /api/ przez CISZA ms (twardy limit 60 s).
  // Bez tego pomiar ucina ogon wachlarza, który leci po `networkidle`.
  const CISZA = 3000;
  const LIMIT = 60000;
  while (Date.now() - ostatniRuchGlobal < CISZA && Date.now() - t0 < LIMIT) {
    await page.waitForTimeout(250);
  }
  zbieraj = false;
  const msPelny = ostatniRuchGlobal - t0;

  const agg = new Map();
  for (const w of wywolania) {
    // zbij po wzorcu ścieżki (bez id/query)
    const wzor = w.url.split('?')[0].replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/g, '/:id');
    const cur = agg.get(wzor) || { wzor, n: 0, msSuma: 0, msMax: 0 };
    cur.n += 1;
    cur.msSuma += w.ms;
    cur.msMax = Math.max(cur.msMax, w.ms);
    agg.set(wzor, cur);
  }
  const top = [...agg.values()].sort((a, b) => b.n - a.n || b.msSuma - a.msSuma);

  let wierszy = null;
  try {
    wierszy = await page.locator('table tbody tr').count();
  } catch {}

  if (SHOTS) {
    fs.mkdirSync(path.resolve(SHOTS), { recursive: true });
    await page.screenshot({
      path: path.join(path.resolve(SHOTS), `${ROLE}-${ekran.id}.png`),
      fullPage: false,
    });
  }

  przebiegi.push({
    msNetworkidle,
    msTresc,
    msPelny,
    timeout,
    liczbaWywolan: wywolania.length,
    wierszyWTabeli: wierszy,
    najwolniejsze: [...wywolania].sort((a, b) => b.ms - a.ms).slice(0, 8),
    topWzorce: top,
    bledy: [...bledy],
  });
  bledy.length = 0;
 }

 const mediana = (pole) => {
   const v = przebiegi.map((x) => x[pole]).filter((x) => typeof x === 'number').sort((a, b) => a - b);
   return v.length ? v[Math.floor(v.length / 2)] : null;
 };
 wyniki.push({
   id: ekran.id,
   nazwa: ekran.nazwa,
   rola: ROLE,
   powtorzen: przebiegi.length,
   msTrescMediana: mediana('msTresc'),
   msPelnyMediana: mediana('msPelny'),
   msTrescWszystkie: przebiegi.map((x) => x.msTresc),
   liczbaWywolanMediana: mediana('liczbaWywolan'),
   wierszyWTabeli: przebiegi[0]?.wierszyWTabeli ?? null,
   timeouty: przebiegi.filter((x) => x.timeout).length,
   bledy: przebiegi.flatMap((x) => x.bledy),
   topWzorce: przebiegi[przebiegi.length - 1]?.topWzorce ?? [],
 });
 console.log(
   `${ROLE}/${ekran.id.padEnd(12)} tresc(mediana)=${String(mediana('msTresc')).padStart(6)}ms  [${przebiegi.map((x) => x.msTresc).join(', ')}]  wywolan=${mediana('liczbaWywolan')}  wierszy=${przebiegi[0]?.wierszyWTabeli}`
 );
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({ base: BASE, rola: ROLE, kiedy: new Date().toISOString(), wyniki }, null, 2));
console.log(`\nZapisano: ${OUT}`);

await sesja.context.close().catch(() => {});
await browser.close();
