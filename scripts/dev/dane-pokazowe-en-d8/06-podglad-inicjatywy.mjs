#!/usr/bin/env node
// Poprawka: prawdziwe kliknieicie w wiersz "Customer Portal for Order Tracking",
// zamiast URL query ktory nie otwieral drawera. TYLKO ODCZYT.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'https://staging.consultify.ai';
const OUT = path.resolve(process.cwd(), 'evidence/dane-pokazowe-en/d8-staging');
const CREDS_FILE = '/Users/piotrwisniewski/Developer/consultify-secrets/northwind-konta-STAGING.txt';
const creds = fs.readFileSync(CREDS_FILE, 'utf8');
const linaHasla = creds.split('\n').find((l) => /has[łl]o/i.test(l) && l.includes(':'));
const PASSWORD = linaHasla.split(':').pop().trim();
const EMAIL = 'james.whitfield@northwind.example';

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const page = await context.newPage();
const konsolaBledy = [];
page.on('console', (m) => { if (m.type() === 'error') konsolaBledy.push(m.text()); });
page.on('pageerror', (e) => konsolaBledy.push(`pageerror: ${e.message}`));

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(2000);
await page.fill('input[type="email"], input[name="email"]', EMAIL);
await page.fill('input[type="password"], input[name="password"]', PASSWORD);
await page.click('button[type="submit"]');
await page.waitForTimeout(8000);
await page.evaluate(() => {
  try {
    const raw = localStorage.getItem('consultify-storage');
    const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    j.state = j.state || {};
    j.state.theme = 'light';
    localStorage.setItem('consultify-storage', JSON.stringify(j));
  } catch {}
  localStorage.setItem('i18nextLng', 'en');
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);

await page.goto(`${BASE}/initiatives?tab=list`, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(4000);

const row = page.getByText('Customer Portal for Order Tracking', { exact: false }).first();
const bylWidoczny = await row.isVisible({ timeout: 5000 }).catch(() => false);
console.log('wiersz widoczny:', bylWidoczny);
if (bylWidoczny) {
  await row.click({ force: true }).catch((e) => console.error('klik nieudany:', e.message));
  await page.waitForTimeout(3000);
}
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/06b-initiatives-podglad.png`, fullPage: true });
const tekst = await page.evaluate(() => document.body.innerText).catch(() => '');
const DIAKRYTYKI = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g;
fs.writeFileSync(`${OUT}/06b-initiatives-podglad.png.json`, JSON.stringify({
  nazwa: '06b-initiatives-podglad',
  opis: 'Initiatives — podglad "Customer Portal for Order Tracking" (DRAFT) — POPRAWIONE: klik w wiersz zamiast URL query',
  url: page.url(),
  czas: new Date().toISOString(),
  wierszWidocznyPrzedKlikiem: bylWidoczny,
  bledyKonsoli: konsolaBledy,
  polskieDiakrytykiLacznie: (tekst.match(DIAKRYTYKI) || []).length,
}, null, 2));

await browser.close();
console.log('GOTOWE — 06b poprawiony.');
