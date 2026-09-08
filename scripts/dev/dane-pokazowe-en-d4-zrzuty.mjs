#!/usr/bin/env node
/**
 * D4 — zrzuty dowodowe modułu REALIZACJA, organizacja "northwind" po angielsku
 * (`docs/program/DANE_POKAZOWE_EN_20260908/PLAN.md` §D4). Login jako OWNER
 * (james.whitfield@northwind.example), harness bez asysty właściciela.
 * Jasny motyw, szerokość 1440.
 *
 * Wymaga uruchomionych: API na 4184 (DATABASE_URL=consultify_kopia_d4),
 * Vite na 3204 (VITE_API_TARGET=http://127.0.0.1:4184).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3204';
const OUT = '/private/tmp/wt-d4/evidence/dane-pokazowe-en/d4';
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = 'UR40vYG1IcKWR9lEsKc';

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

  await zakladka('list', '01-realizacje-lista-light', 8000);
  await zakladka('work', '02-praca-tabela-light', 10000);
  await zakladka('resources', '03-zasoby-obciazenie-light', 10000);
  await zakladka('control', '04-decyzje-lista-light', 9000);

  // Menu 3 zakładki „Decyzje i ryzyka": Ryzyka i Sygnały.
  for (const [etykieta, nazwa] of [
    [/^Ryzyka|^Risks/, '05-ryzyka-raid-light'],
    [/^Sygnały|^Signals/, '06-sygnaly-light'],
  ]) {
    const chip = page.getByRole('button', { name: etykieta }).first();
    const ok = await chip.isVisible({ timeout: 2500 }).catch(() => false);
    if (ok) {
      await chip.click({ force: true }).catch(() => {});
      await page.waitForTimeout(3000);
      await zrzut(nazwa);
    } else console.error(`UWAGA: nie znalazłem pstryczka ${etykieta}`);
  }

  await zakladka('summary', '07-kokpit-light', 10000);
  await zakladka('reports', '08-raporty-light', 9000);

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
