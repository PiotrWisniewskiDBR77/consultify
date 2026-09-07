#!/usr/bin/env node
/**
 * DOWOD NA EKRANIE — kamienie milowe inicjatywy (PRZED/PO).
 * node scripts/dev/zapisy-inicjatyw/dowod-kamienie.mjs <przed|po> <BASE> <AUTH>
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , faza = 'po', BASE = 'http://localhost:3150', AUTH = '/private/tmp/wt-zapisy/.auth-zapisy.json'] = process.argv;
const OUT = `/private/tmp/wt-zapisy/evidence/zapisy-inicjatyw/${faza}-kamienie`;
fs.mkdirSync(OUT, { recursive: true });
const NAZWA = 'Supply Chain Optimization';
const TYTUL = `Kamien z dowodu ${new Date().toISOString().slice(11, 19)}`;

const konsola = [];
const apiLog = [];
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH, locale: 'pl-PL',
});
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 200)); });
page.on('response', async (r) => {
  if (!/\/api\/.*milestone/i.test(r.url())) return;
  let body = '';
  try { body = (await r.text()).slice(0, 250); } catch { body = '(brak ciala)'; }
  apiLog.push(`${r.request().method()} ${r.status()} ${r.url().replace(BASE, '')}\n    ${body}`);
});

async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({
    nazwa, opis, faza, url: page.url(), szerokosc: 1440, motyw: 'jasny',
    bledyKonsoli: [...konsola], czas: new Date().toISOString(),
  }, null, 2));
  console.log(`ZRZUT ${nazwa}: ${sciezka} (url=${page.url()}, bledyKonsoli=${konsola.length})`);
}

await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  const K = 'consultify-storage';
  const raw = localStorage.getItem(K);
  const j = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  j.state = { ...(j.state || {}), theme: 'light' };
  localStorage.setItem(K, JSON.stringify(j));
});

async function otworz() {
  await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const w = page.locator('table tbody tr', { hasText: NAZWA }).first();
  await w.waitFor({ timeout: 20000 });
  await w.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await w.dblclick();
  await page.waitForTimeout(7000);
  const sekcja = page.getByRole('button', { name: /^Zadania/ });
  await sekcja.waitFor({ timeout: 25000 });
  await sekcja.click();
  await page.waitForTimeout(3000);
  const edycja = page.locator('button').filter({ hasText: /^Edycja$/ });
  if (await edycja.count()) { await edycja.first().click(); await page.waitForTimeout(3000); }
}

await otworz();
await zrzut('01-kamienie-stan-poczatkowy', 'Sekcja Produkty i kamienie milowe, tryb edycji');

const dodaj = page.getByRole('button', { name: /Dodaj kamień milowy/i });
console.log('przycisk „Dodaj kamień milowy":', await dodaj.count());
await dodaj.first().scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await dodaj.first().click();
await page.waitForTimeout(2500);
await zrzut('01b-modal-kamienia', 'Po klinieciu „Dodaj kamień milowy"');
console.log('inputy na stronie:', await page.locator('input').count());
// Modal sam ustawia fokus na polu tytulu (createMilestoneTitleInputRef).
await page.keyboard.type(TYTUL, { delay: 20 });
await page.waitForTimeout(600);
const utworz = page.locator('button').filter({ hasText: /^(Utwórz kamień milowy|Create milestone)$/ });
console.log('przycisk „Utwórz kamień milowy":', await utworz.count());
await utworz.last().click();
await page.waitForTimeout(4500);
await zrzut('02-kamien-po-utworzeniu', `Po klinieciu „Utwórz kamień milowy" (${TYTUL})`);

await otworz();
await zrzut('03-kamien-po-odswiezeniu', 'Po odswiezeniu strony — czy kamien przetrwal');

fs.writeFileSync(`${OUT}/api.log`, apiLog.join('\n') + '\n');
fs.writeFileSync(`${OUT}/tytul.txt`, TYTUL + '\n');
console.log('\n=== API ===\n' + apiLog.join('\n'));
await browser.close();
