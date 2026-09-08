#!/usr/bin/env node
/**
 * D5 — zrzuty dowodowe modułów WYNIKI i FINANSE dla organizacji „northwind"
 * po angielsku. Logowanie przez formularz (hasło z pliku poza repo), 1440x900,
 * motyw jasny (+ ciemny dla listy KPI). Bez asysty właściciela (punkt 7 CLAUDE.md).
 *
 * DWA KONTA — to jest sedno dowodu, nie ozdoba:
 *   OWNER  james.whitfield@northwind.example — widzi Wyniki i Finanse,
 *   MEMBER emily.carter@northwind.example    — NIE widzi ich wcale
 *                                              (`resultsInternalBetaVisibility`
 *                                              403, `BetaGate MODULE_ECONOMICS`).
 * Zrzut z konta MEMBER jest dowodem BRAMKI, nie braku danych.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.D5_BASE || 'http://127.0.0.1:3205';
const OUT = process.env.D5_OUT || '/private/tmp/wt-d5/evidence/dane-pokazowe-en/d5';
const HASLO_PLIK = process.env.D5_HASLO || '/private/tmp/dane-pokazowe-en/northwind-konta-d5.txt';
const OWNER = 'james.whitfield@northwind.example';
const MEMBER = 'emily.carter@northwind.example';
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;

fs.mkdirSync(OUT, { recursive: true });
const PASSWORD = fs.readFileSync(HASLO_PLIK, 'utf8').match(/dostęp pokazowy\): (.+)/)[1].trim();
const IDY = JSON.parse(fs.readFileSync(`${OUT}/idy.json`, 'utf8'));

let page, context, browser;
const pomiar = [];

async function zrzut(nazwa, opis) {
  await page.screenshot({ path: `${OUT}/${nazwa}.png`, fullPage: true });
  const tekst = await page.evaluate(() => document.body.innerText);
  const trafienia = tekst.match(DIAKRYTYKI) || [];
  const slowa = [...new Set(tekst.match(/\S*[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]\S*/g) || [])].slice(0, 25);
  pomiar.push({ nazwa, opis, url: page.url(), diakrytyki: trafienia.length, slowa });
  console.log(`ZRZUT ${nazwa} — ${opis} (diakrytyki PL w innerText: ${trafienia.length})`);
}

async function zamknijNakladki() {
  for (const txt of ['Skip for now', 'Pomiń na razie', 'Skip', 'Got it', 'Close']) {
    const el = page.getByText(txt, { exact: true }).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      await el.click({ force: true }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
}

async function ustawMotyw(theme) {
  await page.evaluate((t) => {
    try {
      const raw = localStorage.getItem('consultify-storage');
      const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      j.state = j.state || {};
      j.state.theme = t;
      localStorage.setItem('consultify-storage', JSON.stringify(j));
    } catch {}
  }, theme);
}

async function zaloguj(email) {
  await context.clearCookies();
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {}
  });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[name="email"]', email);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(7000);
  await page.evaluate(() => {
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
  await ustawMotyw('light');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);
  await zamknijNakladki();
}

async function idz(sciezka, czekaj = 9000) {
  await page.goto(`${BASE}${sciezka}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(czekaj);
  await zamknijNakladki();
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  page = await context.newPage();

  // ======================= KONTO OWNER =======================
  await zaloguj(OWNER);

  // --- WYNIKI: rejestr KPI --------------------------------------------------
  await idz('/results/kpi', 12000);
  await zrzut('01-wyniki-kpi-lista-owner-light', 'Wyniki > KPI — 8 definicji Northwind, konto OWNER');

  // POZIOM 2 — raport otwarty: TABELA osmiu miernikow z pomiarami. Poziom 1
  // pokazuje same raporty, wiec bez tego kroku osiem miernikow nie trafia na
  // zaden zrzut.
  await idz(`/results/kpi/scorecards/${IDY.scorecard}`, 14000);
  await zrzut('01c-wyniki-kpi-raport-otwarty-light', 'Raport KPI otwarty — tabela 8 miernikow Northwind');

  // --- WYNIKI: karta KPI z pomiarami ---------------------------------------
  await idz(`/results/kpi/${IDY.kpiOee}`, 13000);
  await zrzut('02-wyniki-kpi-karta-oee-light', 'Karta KPI „OEE — Line 3" z 6 pomiarami i trendem');

  await idz(`/results/kpi/${IDY.kpiScrap}`, 13000);
  await zrzut('02b-wyniki-kpi-karta-scrap-light', 'Karta KPI „Scrap Rate" — mierniki niżej-lepiej');

  // --- WYNIKI: OKR ----------------------------------------------------------
  await idz('/results/okr', 12000);
  await zrzut('03-wyniki-okr-lista-owner-light', 'Wyniki > OKR — zestaw firmowy Q3 FY2026');

  await idz(`/results/okr/${IDY.okrSet}`, 13000);
  await zrzut('03b-wyniki-okr-raport-light', 'Raport OKR — 3 cele i 6 kluczowych wynikow');

  // --- WYNIKI: ROI ----------------------------------------------------------
  await idz('/results/roi', 12000);
  await zrzut('04-wyniki-roi-lista-owner-light', 'Wyniki > ROI — przypadek MES Rollout Line 3');

  await idz(`/results/roi/${IDY.roiCase}`, 14000);
  await zrzut('04b-wyniki-roi-karta-light', 'Karta ROI — zalozenia, koszty, korzysci, wynik przebiegu');

  // --- FINANSE (za BetaGate; konto OWNER) -----------------------------------
  await idz('/finance', 14000);
  await zrzut('05-finanse-sprawozdania-owner-light', 'Finanse > Sprawozdania — paczka 4 kwartalow GBP, konto OWNER');

  // Zakladka z budzetami. Menu 2 Finansow to: Statements · Analysis · Models ·
  // Prediction · Enterprise valuation — budzety siedza pod „Prediction"
  // (`useFinanceData.ts:341` laduje modele + budzety dla zakladki prognozy).
  for (const etykieta of ['Prediction', 'Prognoza', 'Forecast']) {
    const el = page.getByRole('tab', { name: etykieta }).first();
    const el2 = page.getByText(etykieta, { exact: true }).first();
    if (await el.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el.click({ force: true }).catch(() => {});
      break;
    }
    if (await el2.isVisible({ timeout: 1500 }).catch(() => false)) {
      await el2.click({ force: true }).catch(() => {});
      break;
    }
  }
  await page.waitForTimeout(9000);
  await zamknijNakladki();
  await zrzut('06-finanse-budzet-owner-light', 'Finanse > Prognoza/Budzety — budzet programu FY2026 z pozycjami');

  // --- WYNIKI w motywie ciemnym --------------------------------------------
  await idz('/results/kpi', 8000);
  await ustawMotyw('dark');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);
  await zamknijNakladki();
  await zrzut('01b-wyniki-kpi-lista-owner-dark', 'Wyniki > KPI, motyw ciemny, konto OWNER');

  await idz('/finance', 13000);
  await zrzut('05b-finanse-sprawozdania-owner-dark', 'Finanse > Sprawozdania, motyw ciemny, konto OWNER');

  // ======================= KONTO MEMBER =======================
  // DOWOD BRAMKI, nie danych: ten sam komplet danych, inne konto.
  await zaloguj(MEMBER);
  await idz('/results/kpi', 12000);
  await zrzut('07-wyniki-kpi-member-light', 'Wyniki > KPI z konta MEMBER (Emily Carter) — bramka OWNER/ADMIN');

  await idz('/finance', 12000);
  await zrzut('08-finanse-member-light', 'Finanse z konta MEMBER — BetaGate MODULE_ECONOMICS');

  fs.writeFileSync(`${OUT}/pomiar-jezyka-innerText.txt`, pomiarTekst());
  await browser.close();
}

function pomiarTekst() {
  return (
    `Pomiar jezyka na renderowanym innerText — organizacja northwind (D5), ${new Date().toISOString()}\n` +
    `Regula: dane pokazowe MUSZA byc po angielsku. Diakrytyki spoza danych = etykiety interfejsu (PL) — dlug programu JEZYK, zgloszony jako STOP.\n\n` +
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
