// Druga tura zrzutów D2 — Tools/Sessions i Assessment/Processes (pierwsza tura
// trafiła w zakładkę "Library" zamiast w rzeczywiste sesje/oceny zasiane
// przez 02-odkrycie.ts). Ten sam login co d2-odkrycie-screenshots.mjs.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://localhost:38271';
const EMAIL = 'james.whitfield@northwind.example';
const PASSWORD = 'D2-Northwind-2026x';
const OUT_DIR = path.resolve('evidence/dane-pokazowe-en/d2');
fs.mkdirSync(OUT_DIR, { recursive: true });

async function login(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Log in' }).first().click();
  await page.waitForTimeout(500);
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/auth/login'), { timeout: 15000 }),
    page.locator('input[type="password"]').first().press('Enter'),
  ]);
  await page.waitForTimeout(1500);
  const skip = page.getByRole('button', { name: 'Skip for now' });
  if (await skip.isVisible().catch(() => false)) await skip.click();
}

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await login(page);

  // ---- Tools — Sessions tab -------------------------------------------------
  await page.goto(`${BASE}/discovery-tools`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: 'Sessions', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT_DIR, '03-tools-lista.png') });

  const vsmRow = page.getByText('Warehouse Outbound Value Stream Map', { exact: false }).first();
  await vsmRow.waitFor({ state: 'visible', timeout: 10000 });
  await vsmRow.dblclick();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT_DIR, '04-tools-wynik-sesji.png') });
  fs.rmSync(path.join(OUT_DIR, '04-tools-wynik-sesji-STOP-nie-znaleziono-wiersza.png'), { force: true });

  // ---- Assessment — Processes tab -------------------------------------------
  await page.goto(`${BASE}/assessment`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.getByRole('tab', { name: 'Processes', exact: true }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT_DIR, '05-assessment-lista.png') });

  const assessmentRow = page.getByText('Operational Maturity Assessment', { exact: false }).first();
  await assessmentRow.waitFor({ state: 'visible', timeout: 10000 });
  await assessmentRow.dblclick();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(OUT_DIR, '06-assessment-raport.png') });
  fs.rmSync(path.join(OUT_DIR, '06-assessment-raport-STOP-nie-znaleziono-wiersza.png'), { force: true });

  await browser.close();
  console.log('Zapisano zrzuty (tura 2) do', OUT_DIR);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
