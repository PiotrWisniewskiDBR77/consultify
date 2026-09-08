#!/usr/bin/env node
/**
 * D3 — zrzuty dowodowe modułu Inicjatywy dla organizacji „northwind" po angielsku.
 * Logowanie OWNER-em przez formularz (hasło z pliku poza repo), 1440x900,
 * jasny + ciemny dla listy. Bez asysty właściciela (punkt 7 CLAUDE.md).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.D3_BASE || 'http://127.0.0.1:3199';
const OUT = process.env.D3_OUT || '/private/tmp/wt-d3/evidence/dane-pokazowe-en/d3';
const HASLO_PLIK = process.env.D3_HASLO || '/private/tmp/dane-pokazowe-en/northwind-konta-d3.txt';
const EMAIL = 'james.whitfield@northwind.example';
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;

fs.mkdirSync(OUT, { recursive: true });
const PASSWORD = fs.readFileSync(HASLO_PLIK, 'utf8').match(/dostęp pokazowy\): (.+)/)[1].trim();

let page, context, browser;
const pomiar = [];

async function zrzut(nazwa, opis) {
  await page.screenshot({ path: `${OUT}/${nazwa}.png`, fullPage: true });
  const tekst = await page.evaluate(() => document.body.innerText);
  const trafienia = tekst.match(DIAKRYTYKI) || [];
  const slowa = [...new Set(tekst.match(/\S*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\S*/g) || [])].slice(0, 20);
  pomiar.push({ nazwa, opis, url: page.url(), diakrytyki: trafienia.length, slowa });
  console.log(`ZRZUT ${nazwa} — ${opis} (diakrytyki PL w innerText: ${trafienia.length})`);
}

async function zamknijNakladki() {
  for (const txt of ['Skip for now', 'Pomiń na razie', 'Skip', 'Got it']) {
    const el = page.getByText(txt, { exact: true }).first();
    if (await el.isVisible({ timeout: 1200 }).catch(() => false)) {
      await el.click({ force: true }).catch(() => {});
      await page.waitForTimeout(600);
    }
  }
}

async function motyw(theme) {
  // Przelaczamy motyw ZAWSZE z ekranu listy — reload na trasie pelnego widoku
  // (`mode=doc`) wraca do pustego szkieletu i nastepny zrzut lapie placeholdery.
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.evaluate((t) => {
    try {
      const raw = localStorage.getItem('consultify-storage');
      const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      j.state = j.state || {};
      j.state.theme = t;
      localStorage.setItem('consultify-storage', JSON.stringify(j));
    } catch {}
  }, theme);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
}

async function czekajNaTabele() {
  // Szkielet ladowania znika dopiero po dwoch zapytaniach (rejestr runtime-v1
  // + lista klasyczna). Bez tego czekania zrzut lapie same placeholdery.
  await page
    .getByText('Predictive Maintenance for CNC Line', { exact: false })
    .first()
    .waitFor({ state: 'visible', timeout: 45000 })
    .catch(() => console.warn('UWAGA: nie doczekalem sie wiersza tabeli'));
  await page.waitForTimeout(1500);
}

async function przewinTabeleNaDol() {
  await page.evaluate(() => {
    const przewijalne = Array.from(document.querySelectorAll('*')).filter((el) => {
      const cs = getComputedStyle(el);
      return (
        (cs.overflowY === 'auto' || cs.overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight + 40 &&
        el.clientHeight > 200
      );
    });
    for (const el of przewijalne) el.scrollTop = el.scrollHeight;
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1500);
}

async function otworzListe() {
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  // Otwarte dokumenty modulu zyja w sessionStorage — po zrzucie pelnego widoku
  // modul wraca na zakladke dokumentu, nie na liste. Chip „List" wraca na liste.
  const chipListy = page.getByText('List', { exact: true }).first();
  if (await chipListy.isVisible({ timeout: 4000 }).catch(() => false)) {
    await chipListy.click({ force: true }).catch(() => {});
    await page.waitForTimeout(2000);
  }
  await czekajNaTabele();
  await zamknijNakladki();
  // Zakres „Wszystkie" — bez niego CLOSED i REJECTED są odfiltrowane i widać 5 z 7 statusów.
  const wszystkie = page
    .locator('[role="radiogroup"]')
    .filter({ hasText: 'Active' })
    .locator('button')
    .filter({ hasText: /^All$/ })
    .first();
  if (await wszystkie.isVisible({ timeout: 10000 }).catch(() => false)) {
    await wszystkie.click({ force: true });
    await page.waitForTimeout(2500);
  } else {
    console.warn('UWAGA: nie znalazłem pstryczka zakresu „All" — lista może pokazywać tylko aktywne.');
  }
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(7000);

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
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      if (u && u.id) localStorage.setItem(`consultify_onboarding_done:${u.id}`, '1');
    } catch {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await zamknijNakladki();

  // --- 1. Lista, zakres „Wszystkie", 7 statusów -----------------------------
  await otworzListe();
  await zrzut('01-lista-wszystkie-light', 'Lista inicjatyw, zakres All, 13 rekordow / 7 statusow');
  // Tabela ma WLASNY kontener przewijania — bez tego CLOSED i REJECTED (dwa ostatnie
  // wiersze) nie trafiaja na zrzut, mimo `fullPage: true`.
  await przewinTabeleNaDol();
  await zrzut('01b-lista-wszystkie-dol-light', 'Lista przewinieta na dol — wiersze Closed i Rejected');

  // --- 2. Podglad DRAFT ------------------------------------------------------
  const idy = JSON.parse(fs.readFileSync(process.env.D3_IDY || `${OUT}/idy.json`, 'utf8'));
  await page.goto(`${BASE}/initiatives?open=${idy.draft}&mode=drawer`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(11000);
  await zamknijNakladki();
  await zrzut('02-podglad-draft-light', 'Podglad DRAFT — akcja „Submit for approval"');

  // --- 3. Podglad APPROVED ---------------------------------------------------
  await page.goto(`${BASE}/initiatives?open=${idy.approved}&mode=drawer`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(11000);
  await zamknijNakladki();
  await zrzut('03-podglad-approved-light', 'Podglad APPROVED — przejscie do realizacji');

  // --- 3b. Podglad PENDING_APPROVAL — aktywne „Approve" dzieki decyzji GO -----
  await page.goto(`${BASE}/initiatives?open=${idy.pending}&mode=drawer`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(11000);
  await zamknijNakladki();
  await zrzut('03b-podglad-pending-light', 'Podglad PENDING_APPROVAL — „Approve" odblokowany decyzja GO');

  // --- 3c. Pelny widok APPROVED (mode=doc) — czy sa akcje cyklu zycia --------
  await page.goto(`${BASE}/initiatives?open=${idy.approved}&mode=doc`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(12000);
  await zamknijNakladki();
  await zrzut('03c-pelny-widok-approved-light', 'Pelny widok APPROVED — przejscie do realizacji');

  // --- 4. Plan ----------------------------------------------------------------
  await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);
  await zamknijNakladki();
  await zrzut('04-plan-light', 'Zakladka Plan — opublikowana karta planu z 4 inicjatywami');

  // --- 5. Obciazenie ----------------------------------------------------------
  await page.goto(`${BASE}/initiatives?tab=capacity`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(12000);
  await zamknijNakladki();
  await zrzut('05-obciazenie-light', 'Zakladka Obciazenie — arkusz okres x rola');

  // --- 6. Lista w ciemnym -----------------------------------------------------
  await motyw('dark');
  await otworzListe();
  await zrzut('01-lista-wszystkie-dark', 'Lista inicjatyw, zakres All, motyw ciemny');
  await przewinTabeleNaDol();
  await zrzut('01b-lista-wszystkie-dol-dark', 'Lista przewinieta na dol, motyw ciemny');

  fs.writeFileSync(`${OUT}/pomiar-jezyka-innerText.txt`, pomiarTekst());
  await browser.close();
}

function pomiarTekst() {
  return (
    `Pomiar jezyka na renderowanym innerText — organizacja northwind (D3), ${new Date().toISOString()}\n` +
    `Regula: dane pokazowe MUSZA byc po angielsku. Diakrytyki spoza danych = etykiety interfejsu (PL) — zgloszone jako STOP.\n\n` +
    pomiar
      .map(
        (p) =>
          `=== ${p.nazwa} (${p.url}) ===\n${p.opis}\n` +
          `znakow diakrytycznych PL: ${p.diakrytyki}\n` +
          `slowa PL: ${p.slowa.join(', ') || '(brak)'}\n`
      )
      .join('\n')
  );
}

main().catch((e) => {
  console.error('BLAD:', e);
  process.exit(1);
});
