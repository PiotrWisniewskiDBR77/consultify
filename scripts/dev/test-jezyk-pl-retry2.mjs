/**
 * TEST-JEZYK — DOGRYWKA PL #2 (naprawa dogrywki #1: `[role="tab"]` nie łapał
 * zakładek zbudowanych jako zwykłe `<button>` bez ARIA — 8 z 11 modułów
 * dostało pustą kolejność EN, więc nic się nie kliknęło w PL). Naprawa:
 * per-moduł okno współrzędnych (empirycznie zmierzone 09.09 -
 * `_check-tabfilter2.mjs`/`_check-org.mjs`, evidence poza repo w scratchpadzie
 * tej sesji) zamiast jednego uniwersalnego selektora. Klik po INDEKSIE
 * (pozycja w DOM, niezależna od języka), nie po tekście.
 *
 * TRZECI i OSTATNI cykl przełączenia języka w tej paczce (dogrywka #1 zrobiła
 * drugi i wróciła do EN) — kończy się z powrotem na EN.
 *
 * Użycie: node scripts/dev/test-jezyk-pl-retry2.mjs
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

// top/left w px — okno pasa zakładek Menu2, zmierzone empirycznie per moduł.
const MODULES_TABS = [
  { id: '02-my-work', route: '/my-work', tabs: ['Ideas', 'Notebook', 'Inbox', 'Calendar', 'Tasks', 'Decisions', 'Vaults'], top: [55, 75], left: [65, 1000] },
  { id: '03-interview', route: '/interview', tabs: ['Inbox', 'Sessions', 'Assigned', 'Templates', 'Insights', 'Initiatives'], top: [55, 75], left: [65, 1000] },
  { id: '05-assessment', route: '/assessment/overview', tabs: ['Library', 'Processes', 'Insights', 'Reports', 'Initiatives'], top: [55, 75], left: [65, 1000] },
  { id: '06-initiatives', route: '/initiatives', tabs: ['Plan', 'Load'], top: [55, 75], left: [65, 1000] },
  { id: '07-execution', route: '/execution', tabs: ['Dashboard', 'Deliveries', 'Work', 'Resources', 'Decisions & risks', 'Reports'], top: [55, 75], left: [65, 1000] },
  { id: '08-results', route: '/results/kpi', tabs: ['OKR', 'ROI', 'Management reports'], top: [55, 75], left: [65, 1000] },
  { id: '09-finance', route: '/finance', tabs: ['Analysis', 'Models', 'Prediction', 'Enterprise valuation'], top: [55, 75], left: [65, 1000] },
  { id: '11-audits', route: '/audit-programs', tabs: ['Library', 'Sessions', 'Conclusions', 'Reports', 'Initiatives'], top: [55, 75], left: [65, 1000] },
  { id: '13-organization', route: '/organization/profile', tabs: ['Scale', 'Markets & systems'], top: [185, 210], left: [400, 1000] },
];
const SUBNAV = [
  { id: '14-admin', route: '/admin', items: ['Invitations', 'Roles & Permissions'] },
  { id: '15-settings', route: '/settings/profile', items: ['Security'] },
];

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

async function czytajBoczna(p) {
  return p.evaluate(() => {
    const out = [];
    document.querySelectorAll('button, a').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.left < 260) {
        const t = (el.innerText || '').trim();
        if (t) out.push(t);
      }
    });
    return out;
  });
}

async function klijnijBoczna(p, idx) {
  return p.evaluate((i) => {
    const out = [];
    document.querySelectorAll('button, a').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.left < 260) {
        const t = (el.innerText || '').trim();
        if (t) out.push(el);
      }
    });
    const el = out[i];
    if (!el) return false;
    el.click();
    return true;
  }, idx);
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

// KROK 1 (EN): kolejność zakładek + bocznej nawigacji.
const kolejnoscEN = {};
for (const mod of MODULES_TABS) {
  await p.goto(`${BASE}${mod.route}`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1800);
  kolejnoscEN[mod.id] = await czytajPasek(p, mod.top, mod.left);
  console.log('EN', mod.id, JSON.stringify(kolejnoscEN[mod.id]));
}
const kolejnoscBocznaEN = {};
for (const mod of SUBNAV) {
  await p.goto(`${BASE}${mod.route}`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1800);
  kolejnoscBocznaEN[mod.id] = await czytajBoczna(p);
  console.log('EN boczna', mod.id, JSON.stringify(kolejnoscBocznaEN[mod.id].slice(0, 40)));
}

// KROK 2: przełącz na PL (trzeci i ostatni cykl w paczce).
await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /Polski|Polish/i }).first().click({ timeout: 6000 });
await p.waitForTimeout(1200);
await p.reload({ waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1500);

// KROK 3: zakładki PL po indeksie.
for (const mod of MODULES_TABS) {
  await p.goto(`${BASE}${mod.route}`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1800);
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
      await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(dir, `${screenId}.png`), fullPage: false });
      const innerText = await p.evaluate(() => document.body.innerText || '');
      fs.writeFileSync(path.join(dir, `${screenId}.txt`), innerText, 'utf8');
      raport.naprawione.push({ modul: mod.id, ekran: screenId, url: p.url() });
      console.log('[retry2]', mod.id, screenId, '->', p.url());
    } catch (e) {
      raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: String(e.message || e).slice(0, 200) });
      console.log('[retry2] BLAD', mod.id, screenId, String(e.message || e).slice(0, 150));
    }
  }
}

// KROK 4: boczna nawigacja PL po indeksie.
for (const mod of SUBNAV) {
  await p.goto(`${BASE}${mod.route}`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1800);
  const kolejEN = kolejnoscBocznaEN[mod.id] || [];
  const dir = path.join(OUT, 'pl', mod.id);
  fs.mkdirSync(dir, { recursive: true });
  for (const item of mod.items) {
    const idx = kolejEN.indexOf(item);
    const screenId = `03-subnav-${slug(item)}`;
    if (idx === -1) {
      raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: `"${item}" brak w EN kolejności bocznej` });
      continue;
    }
    try {
      const klik = await klijnijBoczna(p, idx);
      if (!klik) throw new Error(`brak elementu PL o indeksie ${idx}`);
      await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(dir, `${screenId}.png`), fullPage: false });
      const innerText = await p.evaluate(() => document.body.innerText || '');
      fs.writeFileSync(path.join(dir, `${screenId}.txt`), innerText, 'utf8');
      raport.naprawione.push({ modul: mod.id, ekran: screenId, url: p.url() });
      console.log('[retry2]', mod.id, screenId, '->', p.url());
    } catch (e) {
      raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: String(e.message || e).slice(0, 250) });
      console.log('[retry2] BLAD', mod.id, screenId, String(e.message || e).slice(0, 180));
    }
  }
}

// KROK 5: przywróć EN.
await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /English|Angielski/i }).first().click({ timeout: 6000 });
await p.waitForTimeout(1200);
await p.reload({ waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1500);
fs.mkdirSync(path.join(OUT, 'en', '00-przywrocenie'), { recursive: true });
await p.screenshot({ path: path.join(OUT, 'en', '00-przywrocenie', '04-po-dogrywce2-en.png'), fullPage: false });
const bodyTxt = await p.evaluate(() => document.body.innerText || '');
fs.writeFileSync(path.join(OUT, 'en', '00-przywrocenie', '04-po-dogrywce2-en.txt'), bodyTxt, 'utf8');

await b.close();

raport.koniec = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'pl-retry2-raport.json'), JSON.stringify(raport, null, 1));
console.log(`\nDOGRYWKA #2 GOTOWA. Naprawione: ${raport.naprawione.length}  Dalej N/A: ${raport.dalejNA.length}`);
console.log('Dalej N/A:', JSON.stringify(raport.dalejNA, null, 1));
