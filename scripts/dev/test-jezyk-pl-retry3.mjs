/**
 * TEST-JEZYK — DOGRYWKA PL #3 (dokończenie: interview/assessment/execution
 * zwróciły pustą kolejność EN w dogrywce #2 — najpewniej wolniejsza
 * odpowiedź stagingu, nie błąd selektora (te same trasy dały poprawny wynik
 * w osobnym sprawdzeniu chwilę wcześniej). Dłuższe oczekiwanie + networkidle.
 * Dodatkowo: Organization/„Markets & systems" (indeks przesunął się po
 * kliknięciu „Scale" — czytamy kolejność OSOBNO dla KAŻDEJ zakładki, nie raz
 * na start modułu).
 *
 * CZWARTY i OSTATNI cykl przełączenia języka w tej paczce.
 * Użycie: node scripts/dev/test-jezyk-pl-retry3.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(ROOT, 'evidence/test-jezyk-dane-0909/jezyk');

const BASE = 'https://staging.consultify.ai';
const SECRETS_PATH = path.join(process.env.HOME, 'Developer/consultify-secrets/northwind-konta-STAGING.txt');
const SECRETS = fs.readFileSync(SECRETS_PATH, 'utf8');
const EMAIL = SECRETS.match(/james\.whitfield@northwind\.example/)[0];
const HASLO = SECRETS.match(/Wspólne hasło[^:]*:\s*(\S+)/)[1];

const MODULES_TABS = [
  { id: '03-interview', route: '/interview', tabs: ['Inbox', 'Sessions', 'Assigned', 'Templates', 'Insights', 'Initiatives'], top: [55, 75], left: [65, 1000] },
  { id: '05-assessment', route: '/assessment/overview', tabs: ['Library', 'Processes', 'Insights', 'Reports', 'Initiatives'], top: [55, 75], left: [65, 1000] },
  { id: '07-execution', route: '/execution', tabs: ['Dashboard', 'Deliveries', 'Work', 'Resources', 'Decisions & risks', 'Reports'], top: [55, 75], left: [65, 1000] },
];
const ORG = { id: '13-organization', route: '/organization/profile', tab: 'Markets & systems', top: [185, 210], left: [400, 1000] };

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function czytajPasek(p, top, left) {
  return p.evaluate(
    ([t0, t1, l0, l1]) => {
      const out = [];
      document.querySelectorAll('button, [role="tab"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top >= t0 && r.top <= t1 && r.left >= l0 && r.left <= l1 && r.width > 0) {
          const t = (el.innerText || '').trim();
          if (t && t.length < 40 && !t.includes('\n')) out.push(t);
        }
      });
      return out;
    },
    [top[0], top[1], left[0], left[1]]
  );
}
async function klijnijPoIndeksie(p, top, left, idx) {
  return p.evaluate(
    ([t0, t1, l0, l1, i]) => {
      const out = [];
      document.querySelectorAll('button, [role="tab"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top >= t0 && r.top <= t1 && r.left >= l0 && r.left <= l1 && r.width > 0) {
          const t = (el.innerText || '').trim();
          if (t && t.length < 40 && !t.includes('\n')) out.push(el);
        }
      });
      const el = out[i];
      if (!el) return false;
      el.click();
      return true;
    },
    [top[0], top[1], left[0], left[1], idx]
  );
}

const raport = { start: new Date().toISOString(), naprawione: [], dalejNA: [] };
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const p = await c.newPage();

await p.goto(`${BASE}/login`, { waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(2500);
await p.locator('input[type="email"]').first().fill(EMAIL);
await p.locator('input[type="password"]').first().fill(HASLO);
await p.locator('input[type="password"]').first().press('Enter');
await p.waitForURL((u) => !String(u).includes('/login'), { timeout: 40000 });
await p.waitForTimeout(2000);
await p.evaluate(() => {
  const K = 'consultify-storage';
  const r = localStorage.getItem(K);
  const o = r ? JSON.parse(r) : { state: {}, version: 0 };
  o.state = { ...(o.state || {}), theme: 'light' };
  localStorage.setItem(K, JSON.stringify(o));
});
await p.reload({ waitUntil: 'load', timeout: 60000 });
await p.waitForTimeout(1500);

const kolejnoscEN = {};
for (const mod of MODULES_TABS) {
  await p.goto(`${BASE}${mod.route}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await p.waitForTimeout(3000);
  kolejnoscEN[mod.id] = await czytajPasek(p, mod.top, mod.left);
  console.log('EN', mod.id, JSON.stringify(kolejnoscEN[mod.id]));
  if (kolejnoscEN[mod.id].length === 0) {
    await p.waitForTimeout(2000);
    kolejnoscEN[mod.id] = await czytajPasek(p, mod.top, mod.left);
    console.log('EN (2. proba)', mod.id, JSON.stringify(kolejnoscEN[mod.id]));
  }
}

await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /Polski|Polish/i }).first().click({ timeout: 6000 });
await p.waitForTimeout(1200);
await p.reload({ waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1500);

for (const mod of MODULES_TABS) {
  await p.goto(`${BASE}${mod.route}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const kolejEN = kolejnoscEN[mod.id] || [];
  const dir = path.join(OUT, 'pl', mod.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const tabName of mod.tabs) {
    const idx = kolejEN.indexOf(tabName);
    const screenId = `02-tab-${slug(tabName)}`;
    if (idx === -1) {
      raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: `"${tabName}" brak w EN kolejności ${JSON.stringify(kolejEN)}` });
      continue;
    }
    try {
      const klik = await klijnijPoIndeksie(p, mod.top, mod.left, idx);
      if (!klik) throw new Error(`brak elementu PL o indeksie ${idx}`);
      await p.waitForTimeout(1600);
      await p.screenshot({ path: path.join(dir, `${screenId}.png`), fullPage: false });
      const innerText = await p.evaluate(() => document.body.innerText || '');
      fs.writeFileSync(path.join(dir, `${screenId}.txt`), innerText, 'utf8');
      raport.naprawione.push({ modul: mod.id, ekran: screenId, url: p.url() });
      console.log('[retry3]', mod.id, screenId, '->', p.url());
    } catch (e) {
      raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: String(e.message || e).slice(0, 200) });
      console.log('[retry3] BLAD', mod.id, screenId, String(e.message || e).slice(0, 150));
    }
  }
}

// Organization: czytaj kolejność DOPIERO po wejściu (świeży odczyt), klik na Markets & systems.
{
  await p.goto(`${BASE}${ORG.route}`, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  await p.waitForTimeout(2500);
  const kolej = await czytajPasek(p, ORG.top, ORG.left);
  console.log('PL organization kolejność', JSON.stringify(kolej));
  const idx = kolej.indexOf(kolej.length === 3 ? kolej[2] : -1); // fallback: trzeci element paska (Identity/Scale/Markets...)
  const realIdx = kolej.length >= 3 ? 2 : -1;
  const dir = path.join(OUT, 'pl', ORG.id);
  fs.mkdirSync(dir, { recursive: true });
  const screenId = '02-tab-markets-systems';
  if (realIdx === -1) {
    raport.dalejNA.push({ modul: ORG.id, ekran: screenId, powod: `pasek PL ma tylko ${kolej.length} pozycji: ${JSON.stringify(kolej)}` });
  } else {
    try {
      const klik = await klijnijPoIndeksie(p, ORG.top, ORG.left, realIdx);
      if (!klik) throw new Error(`brak elementu PL o indeksie ${realIdx}`);
      await p.waitForTimeout(1600);
      await p.screenshot({ path: path.join(dir, `${screenId}.png`), fullPage: false });
      const innerText = await p.evaluate(() => document.body.innerText || '');
      fs.writeFileSync(path.join(dir, `${screenId}.txt`), innerText, 'utf8');
      raport.naprawione.push({ modul: ORG.id, ekran: screenId, url: p.url() });
      console.log('[retry3]', ORG.id, screenId, '->', p.url());
    } catch (e) {
      raport.dalejNA.push({ modul: ORG.id, ekran: screenId, powod: String(e.message || e).slice(0, 200) });
    }
  }
}

await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /English|Angielski/i }).first().click({ timeout: 6000 });
await p.waitForTimeout(1200);
await p.reload({ waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1500);
fs.mkdirSync(path.join(OUT, 'en', '00-przywrocenie'), { recursive: true });
await p.screenshot({ path: path.join(OUT, 'en', '00-przywrocenie', '05-po-dogrywce3-en.png'), fullPage: false });

await b.close();
raport.koniec = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'pl-retry3-raport.json'), JSON.stringify(raport, null, 1));
console.log(`\nDOGRYWKA #3 GOTOWA. Naprawione: ${raport.naprawione.length}  Dalej N/A: ${raport.dalejNA.length}`);
console.log('Dalej N/A:', JSON.stringify(raport.dalejNA, null, 1));
