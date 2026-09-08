#!/usr/bin/env node
/**
 * D4b — zrzuty dowodowe: INICJATYWY (7 statusów) + REALIZACJA (4 realizacje
 * z torem runtime-v1) + OBCIĄŻENIE (podaż ról > 0) + RAPORTY (2 raporty).
 * Organizacja "northwind" po angielsku. Login jako OWNER
 * (james.whitfield@northwind.example), harness bez asysty właściciela.
 * Jasny motyw, szerokość 1440.
 *
 * Wymaga uruchomionych: API na 4186 (DATABASE_URL=consultify_kopia_d44),
 * Vite na 3206 (VITE_API_TARGET=http://127.0.0.1:4186, --mode test).
 * Hasło z pliku poza repo, przez zmienną D4B_HASLO (NIE z argumentu).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3206';
const OUT = '/private/tmp/wt-d4b/evidence/dane-pokazowe-en/d4b';
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = process.env.D4B_HASLO ?? '';

let page, context, browser;
const jezyk = [];

async function zrzut(nazwa) {
  await page.screenshot({ path: `${OUT}/${nazwa}.png`, fullPage: true });
  const tekst = await page.evaluate(() => document.body.innerText);
  jezyk.push({ nazwa, tekst });
  console.log(`ZRZUT ${nazwa}`);
}

async function dismissOverlays() {
  for (const txt of ['Skip for now', 'Pomiń na razie', 'Skip']) {
    const el = page.getByText(txt, { exact: true }).first();
    const visible = await el.isVisible({ timeout: 1200 }).catch(() => false);
    if (visible) {
      await el.click({ force: true }).catch(() => {});
      await page.waitForTimeout(700);
    }
  }
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(250);
}

async function ekran(sciezka, nazwa, czekaj = 8000) {
  await page.goto(`${BASE}${sciezka}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(czekaj);
  await dismissOverlays();
  await zrzut(nazwa);
}

async function zakladka(tab, nazwa, czekaj = 6000) {
  await page.goto(`${BASE}/execution?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(czekaj);
  await dismissOverlays();
  await zrzut(nazwa);
}

async function main() {
  browser = await chromium.launch();
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.fill('input[type="email"], input[name="email"]', EMAIL);
  await page.fill('input[type="password"], input[name="password"]', PASSWORD);
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

  // --- INICJATYWY: lista (7 statusów, 13 rekordów) i Obciążenie -------------
  await ekran('/initiatives?tab=list', '01a-inicjatywy-lista-aktywne-light', 10000);
  // Zakres domyślny to „Active" (11 z 13 — bez CLOSED i REJECTED). Do dowodu
  // „7 statusów na 13 rekordach" trzeba przełączyć zakres na „All".
  const zakresAll = page.locator('[role="radiogroup"] button', { hasText: /^All$/ }).first();
  if (await zakresAll.isVisible({ timeout: 3000 }).catch(() => false)) {
    await zakresAll.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3500);
    await zrzut('01b-inicjatywy-lista-wszystkie-light');
  } else console.error('UWAGA: nie znalazłem przełącznika zakresu All');

  await ekran('/initiatives?tab=capacity', '02a-obciazenie-lista-light', 12000);
  const analiza = page.getByText(/Wave 1 capacity ana/).first();
  if (await analiza.isVisible({ timeout: 3000 }).catch(() => false)) {
    await analiza.click({ force: true }).catch(() => {});
    await page.waitForTimeout(4000);
    const otworz = page.getByRole('button', { name: /^Open$|^Otw/ }).first();
    if (await otworz.isVisible({ timeout: 3000 }).catch(() => false)) {
      await otworz.click({ force: true }).catch(() => {});
      await page.waitForTimeout(6000);
      const arkusz = page.getByText(/Load worksheet|Arkusz obciążenia/).first();
      if (await arkusz.isVisible({ timeout: 3000 }).catch(() => false)) {
        await arkusz.click({ force: true }).catch(() => {});
        await page.waitForTimeout(6000);
      } else console.error('UWAGA: nie znalazłem sekcji arkusza obciążenia');
    } else console.error('UWAGA: nie znalazłem przycisku Open w podglądzie analizy');
    await zrzut('02b-obciazenie-arkusz-podaz-light');
  } else console.error('UWAGA: nie znalazłem wiersza analizy obciążenia');

  // --- REALIZACJA ----------------------------------------------------------
  await zakladka('list', '03-realizacje-lista-light', 9000);
  await zakladka('work', '04-praca-tabela-light', 10000);
  await zakladka('resources', '05-zasoby-light', 10000);
  await zakladka('control', '06-decyzje-lista-light', 9000);

  // Menu 3 zakładki „Decyzje i ryzyka": Sygnały (bez zadań ukończonych).
  const chip = page.getByRole('button', { name: /^Sygnały|^Signals/ }).first();
  if (await chip.isVisible({ timeout: 2500 }).catch(() => false)) {
    await chip.click({ force: true }).catch(() => {});
    await page.waitForTimeout(3500);
    await zrzut('07-sygnaly-light');
  } else console.error('UWAGA: nie znalazłem pstryczka Sygnały');

  await zakladka('reports', '08-raporty-light', 10000);

  fs.writeFileSync(
    `${OUT}/pomiar-jezyka-innerText.txt`,
    jezyk.map((z) => `===== ${z.nazwa} =====\n${z.tekst}\n`).join('\n')
  );
  await browser.close();
}

main().catch((e) => {
  console.error('BŁĄD:', e);
  process.exit(1);
});
