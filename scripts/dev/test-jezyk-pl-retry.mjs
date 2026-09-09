/**
 * TEST-JEZYK — DOGRYWKA PL (naprawa błędu przyrządu z pierwszego przebiegu).
 *
 * Pierwszy przebieg (`test-jezyk-master-zrzuty.mjs`) szukał zakładek Menu 2 po
 * ANGIELSKIEJ nazwie (`getByRole('tab', {name: 'Analysis'})`) — po przełączeniu
 * konta na PL te przyciski nie istnieją pod angielską nazwą, więc 49 z 51
 * ekranów PL (zakładki Menu2 + boczna nawigacja Admin/Settings) wyszło jako
 * N/A "Timeout" — to NIE jest defekt produktu, to pomyłka przyrządu (szukał
 * złej etykiety). Naprawa: pozycja zakładki w pasku (DOM order) jest
 * NIEZALEŻNA od języka, więc najpierw odczytujemy kolejność zakładek PO
 * ANGIELSKU (przed przełączeniem), a w PL klikamy po INDEKSIE, nie po tekście.
 *
 * Jeden dodatkowy cykl przełączenia EN->PL->EN (drugi w tej paczce — pierwszy
 * przebieg już zrobił jeden pełny cykl i wrócił do EN; to jest DRUGI, bo
 * pierwszy PL nie zmierzył realnych zakładek). Nadpisuje WYŁĄCZNIE ekrany
 * `02-tab-*` i `03-subnav-*` w `evidence/.../jezyk/pl/<modul>/` — ekrany
 * 01-menu1/90/91 z pierwszego przebiegu zostają (były poprawne).
 *
 * Użycie: node scripts/dev/test-jezyk-pl-retry.mjs
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
  { id: '02-my-work', route: '/my-work', tabs: ['Ideas', 'Notebook', 'Inbox', 'Calendar', 'Tasks', 'Decisions', 'Vaults'] },
  { id: '03-interview', route: '/interview', tabs: ['Inbox', 'Sessions', 'Assigned', 'Templates', 'Insights', 'Initiatives'] },
  { id: '04-tools', route: '/discovery-tools', tabs: ['Library', 'Sessions', 'Insights', 'Reports', 'Initiatives'] },
  { id: '05-assessment', route: '/assessment/overview', tabs: ['Library', 'Processes', 'Insights', 'Reports', 'Initiatives'] },
  { id: '06-initiatives', route: '/initiatives', tabs: ['Plan', 'Load'] },
  { id: '07-execution', route: '/execution', tabs: ['Dashboard', 'Deliveries', 'Work', 'Resources', 'Decisions & risks', 'Reports'] },
  { id: '08-results', route: '/results/kpi', tabs: ['OKR', 'ROI', 'Management reports'] },
  { id: '09-finance', route: '/finance', tabs: ['Analysis', 'Models', 'Prediction', 'Enterprise valuation'] },
  { id: '10-materials', route: '/presentations', tabs: ['Documents', 'Presentations', 'Sheets', 'Template Library'] },
  { id: '11-audits', route: '/audit-programs', tabs: ['Library', 'Sessions', 'Conclusions', 'Reports', 'Initiatives'] },
  { id: '13-organization', route: '/organization/profile', tabs: ['Scale', 'Markets & systems'] },
];
const SUBNAV = [
  { id: '14-admin', route: '/admin', items: ['Invitations', 'Roles & Permissions'] },
  { id: '15-settings', route: '/settings/profile', items: ['Security'] },
];

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
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

/** Zwraca teksty zakładek [role=tab] w górnej belce (top<250), w kolejności DOM. */
async function czytajPasekZakladek() {
  return p.evaluate(() => {
    const out = [];
    document.querySelectorAll('[role="tab"]').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < 250 && r.width > 0) out.push((el.innerText || '').trim());
    });
    return out;
  });
}

/** Zwraca elementy [role=tab] w górnej belce jako Locator listę (do klikania po indeksie). */
function lokatorZakladek() {
  return p.locator('[role="tab"]').filter({ hasNotText: '' });
}

// KROK 1 (jeszcze EN): odczytaj rzeczywistą kolejność zakładek dla każdego modułu.
const kolejnoscEN = {};
for (const mod of MODULES_TABS) {
  await p.goto(`${BASE}${mod.route}`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1800);
  kolejnoscEN[mod.id] = await czytajPasekZakladek();
  console.log('EN kolejność', mod.id, JSON.stringify(kolejnoscEN[mod.id]));
}

// KROK 2: przełącz na PL
await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1500);
await p.getByRole('button', { name: /Polski|Polish/i }).first().click({ timeout: 6000 });
await p.waitForTimeout(1500);
await p.reload({ waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1800);

// KROK 3: dla każdego modułu, dla każdej zakładki z configu, znajdź jej indeks
// w kolejnoscEN i kliknij element o tym indeksie w PL (pasek zakładek).
for (const mod of MODULES_TABS) {
  await p.goto(`${BASE}${mod.route}`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1800);
  const paskiPL = lokatorZakladek();
  const liczbaPL = await paskiPL.count();
  const kolejEN = kolejnoscEN[mod.id] || [];
  for (const tabName of mod.tabs) {
    const idx = kolejEN.indexOf(tabName);
    const screenId = `02-tab-${slug(tabName)}`;
    const dir = path.join(OUT, 'pl', mod.id);
    fs.mkdirSync(dir, { recursive: true });
    if (idx === -1 || idx >= liczbaPL) {
      raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: `indeks nieznaleziony (EN kolejność=${JSON.stringify(kolejEN)}, PL liczba zakładek=${liczbaPL})` });
      continue;
    }
    try {
      await paskiPL.nth(idx).click({ timeout: 5000 });
      await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(dir, `${screenId}.png`), fullPage: false });
      const innerText = await p.evaluate(() => document.body.innerText || '');
      fs.writeFileSync(path.join(dir, `${screenId}.txt`), innerText, 'utf8');
      raport.naprawione.push({ modul: mod.id, ekran: screenId, url: p.url() });
      console.log('[pl-retry]', mod.id, screenId, '->', p.url());
    } catch (e) {
      raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: String(e.message || e).slice(0, 200) });
      console.log('[pl-retry] BLAD', mod.id, screenId, String(e.message || e).slice(0, 150));
    }
  }
}

// KROK 4: boczna nawigacja Admin/Settings — ten sam trik, ale na klikalnych
// pozycjach lewego panelu (nie [role=tab]).
async function czytajBoczna(selector) {
  return p.evaluate((sel) => {
    const out = [];
    document.querySelectorAll(sel).forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.left < 260) out.push((el.innerText || '').trim());
    });
    return out;
  }, selector);
}

// Wróć na chwilę do EN, zbadaj kolejność bocznej nawigacji.
await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /English|Angielski/i }).first().click({ timeout: 6000 });
await p.waitForTimeout(1200);
await p.reload({ waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1500);

const kolejnoscBocznaEN = {};
for (const mod of SUBNAV) {
  await p.goto(`${BASE}${mod.route}`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1800);
  kolejnoscBocznaEN[mod.id] = await czytajBoczna('button, a');
  console.log('EN boczna', mod.id, JSON.stringify(kolejnoscBocznaEN[mod.id].slice(0, 40)));
}

// Przełącz na PL ponownie (drugi i OSTATNI raz w tej dogrywce).
await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /Polski|Polish/i }).first().click({ timeout: 6000 });
await p.waitForTimeout(1200);
await p.reload({ waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1500);

for (const mod of SUBNAV) {
  await p.goto(`${BASE}${mod.route}`, { waitUntil: 'load', timeout: 40000 });
  await p.waitForTimeout(1800);
  const kolejEN = kolejnoscBocznaEN[mod.id] || [];
  for (const item of mod.items) {
    const idx = kolejEN.indexOf(item);
    const screenId = `03-subnav-${slug(item)}`;
    const dir = path.join(OUT, 'pl', mod.id);
    fs.mkdirSync(dir, { recursive: true });
    if (idx === -1) {
      raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: `"${item}" nie znaleziono w EN kolejności bocznej` });
      continue;
    }
    try {
      const els = p.locator('button, a').filter({ hasNotText: '' });
      // przelicz PL listę tą samą metodą co EN, żeby indeksy się zgadzały
      const teksty = await czytajBoczna('button, a');
      // znajdź element w DOM o tym samym indeksie wśród widocznych <260px
      const handle = await p.evaluateHandle(
        (sel, i) => {
          const arr = [];
          document.querySelectorAll(sel).forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.left < 260) arr.push(el);
          });
          return arr[i] || null;
        },
        'button, a',
        idx
      );
      const el = handle.asElement();
      if (!el) throw new Error(`brak elementu PL o indeksie ${idx} (PL lista=${JSON.stringify(teksty.slice(0, 40))})`);
      await el.click({ timeout: 5000 });
      await p.waitForTimeout(1500);
      await p.screenshot({ path: path.join(dir, `${screenId}.png`), fullPage: false });
      const innerText = await p.evaluate(() => document.body.innerText || '');
      fs.writeFileSync(path.join(dir, `${screenId}.txt`), innerText, 'utf8');
      raport.naprawione.push({ modul: mod.id, ekran: screenId, url: p.url() });
      console.log('[pl-retry]', mod.id, screenId, '->', p.url());
    } catch (e) {
      raport.dalejNA.push({ modul: mod.id, ekran: screenId, powod: String(e.message || e).slice(0, 250) });
      console.log('[pl-retry] BLAD', mod.id, screenId, String(e.message || e).slice(0, 180));
    }
  }
}

// KROK 5: przywróć EN (stan konta na koniec = EN, jak przed testem).
await p.goto(`${BASE}/settings/language`, { waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1200);
await p.getByRole('button', { name: /English|Angielski/i }).first().click({ timeout: 6000 });
await p.waitForTimeout(1200);
await p.reload({ waitUntil: 'load', timeout: 40000 });
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(OUT, 'en', '00-przywrocenie', '03-po-dogrywce-en.png'), fullPage: false }).catch(async () => {
  fs.mkdirSync(path.join(OUT, 'en', '00-przywrocenie'), { recursive: true });
  await p.screenshot({ path: path.join(OUT, 'en', '00-przywrocenie', '03-po-dogrywce-en.png'), fullPage: false });
});

await b.close();

raport.koniec = new Date().toISOString();
fs.writeFileSync(path.join(OUT, 'pl-retry-raport.json'), JSON.stringify(raport, null, 1));
console.log(`\nDOGRYWKA GOTOWA. Naprawione: ${raport.naprawione.length}  Dalej N/A: ${raport.dalejNA.length}`);
console.log('Dalej N/A:', JSON.stringify(raport.dalejNA, null, 1));
