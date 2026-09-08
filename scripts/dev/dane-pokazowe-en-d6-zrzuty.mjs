#!/usr/bin/env node
/**
 * D6 — zrzuty dowodowe Materiały/Spotkania/Czat/Moja Praca, organizacja
 * "northwind" po angielsku (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md`
 * §D6). Login jako OWNER (james.whitfield@northwind.example), harness bez
 * asysty właściciela. Jasny motyw (1440), zgodnie ze zleceniem D6.
 *
 * Wymaga uruchomionych: API na 4181 (DATABASE_URL=consultify_kopia_d6),
 * Vite na 3201 (VITE_API_TARGET=http://127.0.0.1:4181, VITE_MODULE_MEETINGS=true).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3201';
const OUT = '/private/tmp/wt-d6/evidence/dane-pokazowe-en/d6';
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = 'JPJxSySkX8jiM1OrORQ';

// Id-y ustalone deterministycznie (det() z 00-wspolne.ts), odczytane z bazy
// po --apply — patrz `docs/program/DANE_POKAZOWE_EN_20260908` D6.
const CONVERSATION_ID = '017b0fd4-655e-5072-8454-36b4c6817ef1'; // "Where are we losing OEE on Line 3?"
const MEETING_ID = '2e124a9f-30cd-5ea8-bf77-49441a1861bf'; // "Weekly PMO Review"

let page, context, browser;

async function zrzut(nazwa) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  console.log(`ZRZUT ${nazwa}`);
}

async function dismissOverlays() {
  for (const txt of ['Skip for now', 'Pomiń na razie', 'Skip']) {
    const el = page.getByText(txt, { exact: true }).first();
    const visible = await el.isVisible({ timeout: 1500 }).catch(() => false);
    if (visible) {
      await el.click({ force: true }).catch(() => {});
      await page.waitForTimeout(800);
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(300);
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
  console.log('po reload url:', page.url());
  await dismissOverlays();

  // --- Materiały: lista (Outputs / All) ---
  await page.goto(`${BASE}/reports`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  await zrzut('01-materialy-lista-light');

  // --- Materiały: podgląd dokumentu ---
  const docRow = page.getByText('Operational Excellence Char', { exact: false }).first();
  const docVisible = await docRow.isVisible({ timeout: 3000 }).catch(() => false);
  if (docVisible) {
    await docRow.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
    const openBtn = page.getByRole('button', { name: 'Open', exact: true }).first();
    const openVisible = await openBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (openVisible) {
      await openBtn.click({ force: true }).catch(() => {});
      await page.waitForTimeout(2500);
    }
    await zrzut('02-materialy-podglad-dokumentu-light');
  } else {
    console.error('UWAGA: wiersz "Operational Excellence Charter" nie znaleziony na liście Materiałów.');
  }

  // --- Spotkania: lista ---
  await page.goto(`${BASE}/meetings`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  await zrzut('03-spotkania-lista-light');

  // --- Spotkania: obiekt + notatka (zakładka "Minutes" — meeting_notes) ---
  await page.goto(`${BASE}/meetings/${MEETING_ID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  const minutesTab = page.getByText('Minutes', { exact: true }).first();
  const minutesVisible = await minutesTab.isVisible({ timeout: 2000 }).catch(() => false);
  if (minutesVisible) {
    await minutesTab.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1500);
  }
  await zrzut('04-spotkanie-notatka-light');

  // --- Czat: lista wątków ---
  await page.goto(`${BASE}/chat`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);
  await dismissOverlays();
  // Otwórz panel historii, jeśli jest schowany za przełącznikiem.
  const historyToggle = page
    .getByRole('button', { name: /history|historia|conversations|wątki/i })
    .first();
  const toggleVisible = await historyToggle.isVisible({ timeout: 1500 }).catch(() => false);
  if (toggleVisible) {
    await historyToggle.click({ force: true }).catch(() => {});
    await page.waitForTimeout(1000);
  }
  await zrzut('05-czat-lista-light');

  // --- Czat: wątek otwarty ---
  await page.goto(`${BASE}/chat/${CONVERSATION_ID}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  await zrzut('06-czat-watek-light');

  // --- Moja Praca: skrzynka ---
  await page.goto(`${BASE}/my-work`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
  await dismissOverlays();
  await zrzut('07-moja-praca-skrzynka-light');

  await browser.close();
}

main().catch((e) => {
  console.error('BŁĄD:', e);
  process.exit(1);
});
