#!/usr/bin/env node
/**
 * Dodatkowy zrzut D5: budżet OTWARTY z pozycjami (nie tylko wiersz listy).
 * Uzupełnia braki z pierwszego przebiegu zrzuty.mjs — `06-finanse-budzet-owner-light`
 * pokazywał listę Prediction z jednym wierszem, nie kartę budżetu z liniami P&L.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.D5_BASE || 'http://127.0.0.1:3205';
const OUT = process.env.D5_OUT || '/private/tmp/wt-d5/evidence/dane-pokazowe-en/d5';
const HASLO_PLIK = process.env.D5_HASLO || '/private/tmp/dane-pokazowe-en/northwind-konta.txt';
const OWNER = 'james.whitfield@northwind.example';
const PASSWORD = fs.readFileSync(HASLO_PLIK, 'utf8').match(/dostęp pokazowy\): (.+)/)[1].trim();

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const page = await context.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await page.fill('input[type="email"], input[name="email"]', OWNER);
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
      const raw = localStorage.getItem('consultify-storage');
      const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
      j.state = j.state || {};
      j.state.theme = 'light';
      localStorage.setItem('consultify-storage', JSON.stringify(j));
    } catch {}
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3500);

  await page.goto(`${BASE}/finance?tab=prediction`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(9000);
  await page.getByText('Northwind 2027 Programme Bu', { exact: false }).first().click({ force: true });
  await page.waitForTimeout(2000);
  const openBtn = page.getByRole('button', { name: 'Open', exact: true }).first();
  if (await openBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await openBtn.click({ force: true });
  }
  await page.waitForTimeout(6000);
  await page.screenshot({ path: `${OUT}/06b-finanse-budzet-pozycje-owner-light.png`, fullPage: true });
  console.log('ZRZUT 06b-finanse-budzet-pozycje-owner-light zapisany');

  // Zakładka Initiatives (4) — dowód powiązań budżet <-> inicjatywy
  const initiativesTab = page.getByText('Initiatives (4)', { exact: false }).first();
  if (await initiativesTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await initiativesTab.click({ force: true });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/06c-finanse-budzet-inicjatywy-owner-light.png`, fullPage: true });
    console.log('ZRZUT 06c-finanse-budzet-inicjatywy-owner-light zapisany');
  }

  await browser.close();
}

main().catch((e) => { console.error('BLAD:', e); process.exit(1); });
