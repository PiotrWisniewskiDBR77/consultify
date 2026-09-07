#!/usr/bin/env node
/** POMIAR PRZED — P15 K3: karta planu (zakres, kolejność, zależności) bez warsztatu. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const [, , BASE = 'http://localhost:3179', AUTH = '/private/tmp/claude-501/-Users-piotrwisniewski-Developer-Consultify/c567f897-e8c7-489d-89b6-c2d26dd765cf/scratchpad/auth-audyt.json'] = process.argv;
const OUT = '/private/tmp/wt-p15-k3/evidence/p15-k3/przed';
fs.mkdirSync(OUT, { recursive: true });
const konsola = [];
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH, locale: 'pl-PL' });
const page = await context.newPage();
page.on('console', (m) => { if (m.type() === 'error') konsola.push(m.text().slice(0, 300)); });
async function zrzut(nazwa, opis) {
  const sciezka = `${OUT}/${nazwa}.png`;
  await page.screenshot({ path: sciezka, fullPage: true });
  fs.writeFileSync(`${sciezka}.json`, JSON.stringify({ nazwa, opis, url: page.url(), szerokosc: 1440, motyw: 'jasny', bledyKonsoli: [...konsola], czas: new Date().toISOString() }, null, 2));
  console.log(`ZRZUT ${nazwa} (bledy=${konsola.length})`);
}
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
const authState = JSON.parse(fs.readFileSync(AUTH, 'utf8'));
await page.evaluate((entries) => { for (const { name, value } of entries) localStorage.setItem(name, value); }, authState.origins?.[0]?.localStorage ?? []);
await page.evaluate(() => {
  const KEY = 'consultify-storage';
  const raw = localStorage.getItem(KEY);
  const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
  parsed.state = { ...(parsed.state || {}), theme: 'light' };
  localStorage.setItem(KEY, JSON.stringify(parsed));
});
await page.goto(`${BASE}/initiatives?tab=plan`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);
await zrzut('01-lista-planow', 'Inicjatywy → Plan: lista planów (preset startowy)');
const wiersz = page.locator('table tbody tr').first();
await wiersz.dblclick();
await page.waitForTimeout(8000);
for (const [nazwa, sekcja, opis] of [
  ['02-zakres-inicjatyw', 'Zakres inicjatyw', 'Sekcja „Zakres inicjatyw" PRZED — tylko do odczytu'],
  ['03-kolejnosc-i-okna', 'Kolejność i okna', 'Sekcja „Kolejność i okna" PRZED — tylko do odczytu, uzasadnienie po angielsku'],
  ['04-zaleznosci-i-konflikty', 'Zależności i konflikty', 'Sekcja „Zależności i konflikty" PRZED — ukrywana przy braku konfliktów'],
]) {
  const przycisk = page.getByRole('button', { name: sekcja }).first();
  if (await przycisk.count()) { await przycisk.click(); await page.waitForTimeout(1200); }
  await zrzut(nazwa, opis);
}
fs.writeFileSync(`${OUT}/konsola.txt`, konsola.join('\n'));
await browser.close();
