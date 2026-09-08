#!/usr/bin/env node
/**
 * D8 — dowod na STAGINGU (https://staging.consultify.ai), organizacja
 * "Northwind Manufacturing Ltd." zasiana przed restartem maszyny (D1-D6).
 * TYLKO ODCZYT: zaden formularz poza logowaniem nie jest submitowany,
 * zadna akcja zapisu/usuwania nie jest klikana.
 *
 * Login OWNER (james.whitfield@northwind.example) + MEMBER (emily.carter)
 * z /Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt
 * (haslo NIGDY nie jest drukowane ani zapisywane do evidence).
 *
 * Kazdy zrzut -> <nazwa>.png + <nazwa>.png.json: url, bledy konsoli od
 * ostatniego zrzutu, liczba polskich slow w innerText (podzial UI/DANE
 * heurystyka slownikowa ponizej), oraz odpowiedzi API (fetch/xhr) >=400
 * znakow zawierajace polskie diakrytyki.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://staging.consultify.ai';
const OUT = path.resolve(process.cwd(), 'evidence/dane-pokazowe-en/d8-staging');
fs.mkdirSync(OUT, { recursive: true });

const CREDS_FILE = '/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt';
const creds = fs.readFileSync(CREDS_FILE, 'utf8');
const linaHasla = creds.split('\n').find((l) => /has[łl]o/i.test(l) && l.includes(':'));
if (!linaHasla) { console.error('BLAD: nie znalazlem linii z haslem we wzorcu pliku.'); process.exit(1); }
const PASSWORD = linaHasla.split(':').pop().trim();
if (!PASSWORD) { console.error('BLAD: puste haslo po parsowaniu.'); process.exit(1); }

const OWNER_EMAIL = 'james.whitfield@northwind.example';
const MEMBER_EMAIL = 'emily.carter@northwind.example';

const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;
// Heurystyka: typowe polskie slowa/frazy chrome UI (nie dane biznesowe).
const UI_SLOWNIK = [
  'zapisz', 'anuluj', 'filtruj', 'sortuj', 'wszystkie', 'ustawienia', 'pomiń',
  'pomin', 'zamknij', 'otwórz', 'otworz', 'edytuj', 'usuń', 'usun', 'dodaj',
  'wyszukaj', 'szukaj', 'ładowanie', 'ladowanie', 'wczytywanie', 'błąd', 'blad',
  'stronie', 'strona', 'kolejny', 'poprzedni', 'więcej', 'wiecej', 'mniej',
  'zaloguj', 'wyloguj', 'profil', 'powiadomienia', 'jasny', 'ciemny', 'motyw',
  'język', 'jezyk', 'godzina', 'data', 'status', 'akcje', 'eksportuj', 'importuj',
];

const IDY = {
  initDraft: null, // uzupelnione dynamicznie ponizej po sprawdzeniu tytulu
  initApproved: '4d73ba7f-5d5c-58a7-9bef-286ebe54b964',
  kpiOee: 'e4b2514a-84a1-4102-8ee8-614e87b58760',
  conv1: '017b0fd4-655e-5072-8454-36b4c6817ef1',
  meeting1: '2e124a9f-30cd-5ea8-bf77-49441a1861bf',
};
// Ustalone zapytaniem SELECT na bazie stagingu (03-check-ids.mjs, D8):
IDY.initDraft = '80ad392b-6581-5b41-bed6-98efd296365d'; // "Customer Portal for Order Tracking" (DRAFT)

let page, context, browser;
let konsolaBledy = [];
let apiOdpowiedzi = [];
const wpisyGalerii = [];

function rejestrujListenery() {
  page.on('console', (msg) => {
    if (msg.type() === 'error') konsolaBledy.push({ ts: Date.now(), text: msg.text() });
  });
  page.on('pageerror', (err) => konsolaBledy.push({ ts: Date.now(), text: `pageerror: ${err.message}` }));
  page.on('response', async (resp) => {
    try {
      const req = resp.request();
      const rt = req.resourceType();
      if (rt !== 'fetch' && rt !== 'xhr') return;
      const url = resp.url();
      if (!url.includes('/api/')) return;
      const ct = resp.headers()['content-type'] || '';
      if (!ct.includes('json')) return;
      const body = await resp.text().catch(() => '');
      if (body.length >= 400) {
        apiOdpowiedzi.push({ ts: Date.now(), url, dlugosc: body.length, body });
      }
    } catch {}
  });
}

async function dismissOverlays() {
  for (const txt of ['Skip for now', 'Pomiń na razie', 'Skip', 'Got it', 'Close']) {
    const el = page.getByText(txt, { exact: true }).first();
    const visible = await el.isVisible({ timeout: 1000 }).catch(() => false);
    if (visible) {
      await el.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
}

async function idz(sciezka, czekaj = 6000) {
  const bledyOd = Date.now();
  await page.goto(`${BASE}${sciezka}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch((e) => {
    console.error(`UWAGA nawigacja ${sciezka}: ${e.message}`);
  });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(czekaj);
  await dismissOverlays();
  return bledyOd;
}

async function zrzut(nazwa, opis, bledyOd) {
  await page.waitForTimeout(2000);
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  const tekst = await page.evaluate(() => document.body.innerText).catch(() => '');
  const trafienia = tekst.match(DIAKRYTYKI) || [];
  const slowaPL = [...new Set(tekst.match(/\S*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\S*/g) || [])];
  const slowaUI = slowaPL.filter((w) => UI_SLOWNIK.includes(w.toLowerCase().replace(/[^a-ząćęłńóśźż]/gi, '')));
  const slowaDANE = slowaPL.filter((w) => !slowaUI.includes(w));
  const bledy = bledyOd ? konsolaBledy.filter((b) => b.ts >= bledyOd) : [];
  const apiZPolskim = (bledyOd ? apiOdpowiedzi.filter((a) => a.ts >= bledyOd) : [])
    .filter((a) => DIAKRYTYKI.test(a.body))
    .map((a) => ({ url: a.url, dlugosc: a.dlugosc, trafieniaPL: (a.body.match(DIAKRYTYKI) || []).length }));
  const wpis = {
    nazwa,
    opis,
    url: page.url(),
    czas: new Date().toISOString(),
    bledyKonsoli: bledy.map((b) => b.text),
    polskieDiakrytykiLacznie: trafienia.length,
    polskieSlowaUnikalne_UI: slowaUI.slice(0, 40),
    polskieSlowaUnikalne_DANE: slowaDANE.slice(0, 40),
    apiOdpowiedziZPolskimZnakami: apiZPolskim,
  };
  wpisyGalerii.push(wpis);
  fs.writeFileSync(`${OUT}/${nazwa}.png.json`, JSON.stringify(wpis, null, 2));
  console.log(`ZRZUT ${nazwa} (diakrytyki PL: ${trafienia.length} [UI:${slowaUI.length} DANE:${slowaDANE.length}], bledy konsoli: ${bledy.length}, api>=400 z PL: ${apiZPolskim.length})`);
}

async function zaloguj(email, haslo) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', haslo);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(8000);
  console.log('po logowaniu url:', page.url());

  await page.evaluate(() => {
    try {
      const raw = localStorage.getItem('consultify-storage');
      const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      j.state = j.state || {};
      j.state.theme = 'light';
      localStorage.setItem('consultify-storage', JSON.stringify(j));
    } catch {}
    localStorage.setItem('i18nextLng', 'en');
    localStorage.setItem('demo_tour_skipped', '1');
    localStorage.setItem('demo_tour_completed', '1');
    localStorage.setItem('teresa_onboarding_dismissed', '1');
    localStorage.setItem('consultify_teresa_onboarding_seen', '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await dismissOverlays();
}

async function nowaSesja() {
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  page = await context.newPage();
  konsolaBledy = [];
  apiOdpowiedzi = [];
  rejestrujListenery();
}

async function main() {
  browser = await chromium.launch();

  // ===== Sesja OWNER =====
  await nowaSesja();
  await zaloguj(OWNER_EMAIL, PASSWORD);

  let t = await idz('/chat', 6000);
  await zrzut('01-chat', 'Chat — lista watkow (OWNER)', t);

  t = await idz('/my-work', 6000);
  await zrzut('02-my-work', 'My Work — skrzynka OWNER-a', t);

  t = await idz('/interview?tab=sessions', 6000);
  await zrzut('03-interview', 'Interview — lista sesji', t);

  t = await idz('/discovery-tools', 7000);
  await zrzut('04-tools', 'Tools — sesje narzedzi', t);

  t = await idz('/assessment', 7000);
  await zrzut('05-assessment', 'Assessment — lista ocen', t);

  t = await idz('/initiatives?tab=list', 9000);
  await zrzut('06a-initiatives-lista', 'Initiatives — lista (OWNER)', t);
  t = await idz(`/initiatives?open=${IDY.initDraft}&mode=drawer`, 5000);
  await zrzut('06b-initiatives-podglad', 'Initiatives — podglad "Customer Portal for Order Tracking" (DRAFT)', t);

  t = await idz('/execution?tab=list', 8000);
  await zrzut('07a-execution-realizacje', 'Execution — Realizacje (OWNER)', t);
  t = await idz('/execution?tab=work', 9000);
  await zrzut('07b-execution-praca', 'Execution — Praca', t);
  t = await idz('/execution?tab=resources', 9000);
  await zrzut('07c-execution-zasoby', 'Execution — Zasoby/Obciazenie', t);
  t = await idz('/execution?tab=control', 8000);
  await zrzut('07d-execution-decyzje-ryzyka', 'Execution — Decyzje i ryzyka', t);
  t = await idz('/execution?tab=reports', 9000);
  await zrzut('07e-execution-raporty', 'Execution — Raporty statusu', t);

  t = await idz('/results/kpi', 10000);
  await zrzut('08-results', 'Results — KPI', t);

  t = await idz('/finance', 11000);
  await zrzut('09-finance', 'Finance — sprawozdania', t);

  t = await idz('/reports', 8000);
  await zrzut('10-materials', 'Materials — lista', t);

  t = await idz('/audit-programs', 8000);
  await zrzut('11-audits', 'Audits — /audit-programs', t);

  t = await idz('/meetings', 7000);
  await zrzut('12-meetings', 'Meetings — lista', t);

  t = await idz('/organization', 6000);
  await zrzut('13-organization', 'Organization — profil', t);

  t = await idz('/admin', 6000);
  await zrzut('14-admin', 'Admin — panel', t);

  t = await idz('/settings', 6000);
  await zrzut('15-settings', 'Settings — preferencje OWNER-a', t);

  t = await idz('/partner', 6000);
  await zrzut('16-partners', 'Partner Portal — /partner', t);

  await context.close();

  // ===== Sesja MEMBER =====
  await nowaSesja();
  await zaloguj(MEMBER_EMAIL, PASSWORD);

  t = await idz('/initiatives?tab=list', 9000);
  await zrzut('17-initiatives-member', 'Initiatives — lista (MEMBER emily.carter)', t);

  t = await idz('/execution?tab=list', 8000);
  await zrzut('18-execution-member', 'Execution — Realizacje (MEMBER emily.carter)', t);

  await context.close();
  await browser.close();

  fs.writeFileSync(`${OUT}/wpisy-galerii.json`, JSON.stringify(wpisyGalerii, null, 2));
  console.log('GOTOWE. Zrzutow:', wpisyGalerii.length);
}

main().catch((e) => {
  console.error('BLAD:', e);
  process.exit(1);
});
