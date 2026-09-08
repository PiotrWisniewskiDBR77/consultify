#!/usr/bin/env node
/**
 * D7 — GALERIA ODBIORCZA, 16 pozycji menu, organizacja "northwind" po
 * angielsku (docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md §D7 i §3).
 * Login jako OWNER (james.whitfield@northwind.example), jasny motyw, 1440x900,
 * bez asysty właściciela (punkt 7 CLAUDE.md).
 *
 * Dla każdego zrzutu zapisuje <nazwa>.png.json: opis, url, błędy konsoli od
 * ostatniego zrzutu, liczba polskich słów w innerText (surowe trafienia
 * diakrytyków — klasyfikacja UI/DANE robiona ręcznie przy pisaniu GALERIA.md,
 * bo dane Northwind mają być 100% angielskie wg asercji --verify D1-D6).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3211';
const OUT = '/private/tmp/wt-d7/evidence/dane-pokazowe-en/d7-galeria';
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = 'A6PjlLeXTqxXCuntABk';
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;

// Id-y ustalone deterministycznie (det() z 00-wspolne.ts) albo odczytane
// z bazy po --apply — patrz meldunek D7.
const IDY = {
  initDraft: '84baaa08-5249-42e4-a292-3921e67d29d1', // Customer Portal Redesign
  initApproved: '4d73ba7f-5d5c-58a7-9bef-286ebe54b964', // Supplier Quality Gate
  initPending: '80b23c87-6806-5ddb-8744-2326c4c50f36', // Digital Work Instructions
  scorecard: 'ce5c2982-8bd6-4498-9caa-d0906f61fcd9',
  kpiOee: '71ff89d2-0e1f-4ffd-ad74-42723a19ec60', // NW-OEE-L3
  okrSet: 'dcf28dd5-8361-4fe7-b420-fd5a376a8ca1',
  roiCase: 'd2de531c-530f-4d5c-b56b-bafd90b2a3fc',
  conv1: '017b0fd4-655e-5072-8454-36b4c6817ef1', // Where are we losing OEE on Line 3?
  meeting1: '2e124a9f-30cd-5ea8-bf77-49441a1861bf', // Weekly PMO Review
};

let page, context, browser;
const konsolaBledy = [];
const wpisyGalerii = [];

function rejestrujKonsole() {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      konsolaBledy.push({ ts: Date.now(), text: msg.text() });
    }
  });
  page.on('pageerror', (err) => {
    konsolaBledy.push({ ts: Date.now(), text: `pageerror: ${err.message}` });
  });
}

async function dismissOverlays() {
  for (const txt of ['Skip for now', 'Pomiń na razie', 'Skip', 'Got it', 'Close']) {
    const el = page.getByText(txt, { exact: true }).first();
    const visible = await el.isVisible({ timeout: 1200 }).catch(() => false);
    if (visible) {
      await el.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
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

async function zrzut(nazwa, opis, urlOverride, bledyOd) {
  // Reguła zrzutu: networkidle (już poczekane w idz) + widoczna treść + 2s.
  await page.waitForTimeout(2000);
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  const tekst = await page.evaluate(() => document.body.innerText).catch(() => '');
  const trafienia = tekst.match(DIAKRYTYKI) || [];
  const slowaUnikalne = [...new Set(tekst.match(/\S*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\S*/g) || [])];
  const bledy = bledyOd ? konsolaBledy.filter((b) => b.ts >= bledyOd) : [];
  const wpis = {
    nazwa,
    opis,
    url: urlOverride || page.url(),
    czas: new Date().toISOString(),
    bledyKonsoli: bledy.map((b) => b.text),
    polskieDiakrytykiLiczba: trafienia.length,
    polskieSlowaUnikalne: slowaUnikalne.slice(0, 40),
  };
  wpisyGalerii.push(wpis);
  fs.writeFileSync(`${OUT}/${nazwa}.png.json`, JSON.stringify(wpis, null, 2));
  console.log(`ZRZUT ${nazwa} (diakrytyki PL: ${trafienia.length}, bledy konsoli: ${bledy.length})`);
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
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u && u.id) localStorage.setItem(`consultify_onboarding_done:${u.id}`, '1');
    } catch {}
    localStorage.setItem('demo_tour_skipped', '1');
    localStorage.setItem('demo_tour_completed', '1');
    localStorage.setItem('teresa_onboarding_dismissed', '1');
    localStorage.setItem('consultify_teresa_onboarding_seen', '1');
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);
  await dismissOverlays();
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  page = await context.newPage();
  rejestrujKonsole();

  await zaloguj(EMAIL, PASSWORD);

  // ===== 01 Chat =====
  let t = await idz('/chat', 6000);
  await zrzut('01-chat-lista', 'Chat — lista wątków Northwind (3 wątki)', null, t);
  t = await idz(`/chat/${IDY.conv1}`, 6000);
  await zrzut('01b-chat-watek', 'Chat — wątek "Where are we losing OEE on Line 3?" otwarty', null, t);

  // ===== 02 My Work =====
  t = await idz('/my-work', 6000);
  await zrzut('02-my-work-skrzynka', 'My Work — skrzynka OWNER-a (6 pozycji, w tym overdue)', null, t);

  // ===== 03 Interview =====
  t = await idz('/interview?tab=sessions', 6000);
  await zrzut('03-interview-lista', 'Interview — lista sesji (2 wywiady)', null, t);
  const wiersz = page.getByText('Plant operations', { exact: false }).first();
  if (await wiersz.isVisible({ timeout: 3000 }).catch(() => false)) {
    await wiersz.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
    await dismissOverlays();
    await zrzut('03b-interview-podglad', 'Interview — podgląd sesji "Plant operations — Leeds"', null, t);
  } else {
    console.error('UWAGA: nie znalazlem wiersza "Plant operations" na liscie Interview.');
  }

  // ===== 04 Tools =====
  t = await idz('/discovery-tools', 7000);
  await zrzut('04-tools-lista', 'Tools — 3 sesje narzędzi z katalogu globalnego', null, t);

  // ===== 05 Assessment =====
  t = await idz('/assessment', 7000);
  await zrzut('05-assessment-lista', 'Assessment — 1 ocena dojrzałości operacyjnej', null, t);

  // ===== 06 Initiatives =====
  t = await idz('/initiatives?tab=list', 9000);
  const zakresAll = page.locator('[role="radiogroup"] button', { hasText: /^All$/ }).first();
  if (await zakresAll.isVisible({ timeout: 3000 }).catch(() => false)) {
    await zakresAll.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3000);
  }
  await zrzut('06-initiatives-lista', 'Initiatives — lista, zakres All (13 rekordow, 7 statusow DEC-424)', null, t);
  t = await idz(`/initiatives?open=${IDY.initDraft}&mode=drawer`, 5000);
  await zrzut('06b-initiatives-podglad-draft', 'Initiatives — podglad "Customer Portal Redesign" (DRAFT)', null, t);

  // ===== 07 Execution =====
  t = await idz('/execution?tab=list', 8000);
  await zrzut('07a-execution-realizacje', 'Execution — lista realizacji (4 execution_case)', null, t);
  t = await idz('/execution?tab=work', 9000);
  await zrzut('07b-execution-praca', 'Execution — tabela Praca (36 zadan)', null, t);
  t = await idz('/execution?tab=resources', 9000);
  await zrzut('07c-execution-zasoby', 'Execution — Zasoby/Obciazenie (9 osob)', null, t);
  t = await idz('/execution?tab=control', 8000);
  await zrzut('07d-execution-decyzje-ryzyka', 'Execution — Decyzje i ryzyka (9 decyzji, 7 RAID)', null, t);
  t = await idz('/execution?tab=reports', 9000);
  await zrzut('07e-execution-raporty', 'Execution — Raporty statusu (2 raporty)', null, t);

  // ===== 08 Results =====
  t = await idz('/results/kpi', 10000);
  await zrzut('08-results-kpi-lista', 'Results — KPI, 8 definicji Northwind', null, t);
  t = await idz(`/results/kpi/${IDY.kpiOee}`, 10000);
  await zrzut('08b-results-kpi-karta', 'Results — karta KPI "OEE — Line 3" z 6 pomiarami', null, t);

  // ===== 09 Finance =====
  t = await idz('/finance', 11000);
  await zrzut('09-finance-sprawozdania', 'Finance — sprawozdania, 4 kwartaly GBP', null, t);
  for (const etykieta of ['Prediction', 'Forecast', 'Prognoza']) {
    const el = page.getByRole('tab', { name: etykieta }).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ force: true }).catch(() => {});
      break;
    }
  }
  await page.waitForTimeout(8000);
  await dismissOverlays();
  await zrzut('09b-finance-budzet', 'Finance — Prediction/Budget (budzet programu FY2026)', null, t);

  // ===== 10 Materials =====
  t = await idz('/reports', 8000);
  await zrzut('10-materials-lista', 'Materials — lista (4 dokumenty, 2 decki, 1 skoroszyt)', null, t);
  const docRow = page.getByText('Operational Excellence Char', { exact: false }).first();
  if (await docRow.isVisible({ timeout: 3000 }).catch(() => false)) {
    await docRow.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
    const openBtn = page.getByRole('button', { name: 'Open', exact: true }).first();
    if (await openBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await openBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
    }
    await dismissOverlays();
    await zrzut('10b-materials-dokument', 'Materials — podglad "Operational Excellence Charter"', null, t);
  } else {
    console.error('UWAGA: wiersz "Operational Excellence Charter" nie znaleziony.');
  }

  // ===== 11 Audits =====
  t = await idz('/audit-programs', 8000);
  await zrzut('11-audits-glowny', 'Audits — /audit-programs (dane NIE seedowane w D1-D6)', null, t);

  // ===== 12 Meetings =====
  t = await idz('/meetings', 7000);
  await zrzut('12-meetings-lista', 'Meetings — lista (2 spotkania)', null, t);
  t = await idz(`/meetings/${IDY.meeting1}`, 7000);
  const minutesTab = page.getByText('Minutes', { exact: true }).first();
  if (await minutesTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    await minutesTab.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  await zrzut('12b-meetings-notatka', 'Meetings — "Weekly PMO Review", zakladka Minutes', null, t);

  // ===== 13 Organization =====
  t = await idz('/organization', 6000);
  await zrzut('13-organization-profil', 'Organization — profil Northwind Manufacturing Ltd.', null, t);

  // ===== 14 Admin =====
  t = await idz('/admin', 6000);
  await zrzut('14-admin-panel', 'Admin — panel (9 kont, role)', null, t);
  const membersLink = page.getByText('Members', { exact: false }).first();
  if (await membersLink.isVisible({ timeout: 2000 }).catch(() => false)) {
    await membersLink.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2500);
    await zrzut('14b-admin-czlonkowie', 'Admin — lista czlonkow organizacji', null, t);
  }

  // ===== 15 Settings =====
  t = await idz('/settings', 6000);
  await zrzut('15-settings-glowny', 'Settings — preferencje OWNER-a (jezyk en, strefa Europe/London)', null, t);

  // ===== 16 Partners =====
  t = await idz('/partner', 6000);
  await zrzut('16-partners-portal', 'Partner Portal — /partner (brak wiersza partner_users w D1-D6)', null, t);

  fs.writeFileSync(`${OUT}/wpisy-galerii.json`, JSON.stringify(wpisyGalerii, null, 2));
  await browser.close();
  console.log('GOTOWE.');
}

main().catch((e) => {
  console.error('BLAD:', e);
  process.exit(1);
});
