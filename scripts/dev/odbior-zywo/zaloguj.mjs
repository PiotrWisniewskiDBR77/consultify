#!/usr/bin/env node
/**
 * ODBIÓR NA ŻYWO 05.09 — zapis zalogowanej sesji do automatu zrzutów.
 * Otwiera PRAWDZIWE okno przeglądarki na localhost:3000/login. WŁAŚCICIEL LOGUJE SIĘ SAM
 * (nikt nie wpisuje jego hasła). Gdy w localStorage pojawi się token, sesja zapisuje się
 * do pliku podanego w ODBIOR_AUTH_STATE (poza repo) i okno się zamyka.
 * Użycie: ODBIOR_AUTH_STATE=/sciezka/auth.json node scripts/dev/odbior-zywo/zaloguj.mjs
 */
import { chromium } from 'playwright';
const out = process.env.ODBIOR_AUTH_STATE;
if (!out) { console.error('Brak ODBIOR_AUTH_STATE'); process.exit(2); }
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto('http://localhost:3000/login');
console.log('Okno otwarte. Zaloguj się w nim. Czekam do 10 minut...');
const start = Date.now();
while (Date.now() - start < 10 * 60_000) {
  const ok = await page.evaluate(() => !!localStorage.getItem('token')).catch(() => false);
  if (ok) break;
  await page.waitForTimeout(1500);
}
const ok = await page.evaluate(() => !!localStorage.getItem('token')).catch(() => false);
if (!ok) { console.error('Nie zalogowano w 10 minut.'); await browser.close(); process.exit(1); }
await page.evaluate(() => { localStorage.setItem('iris-theme', 'light'); });
await ctx.storageState({ path: out });
console.log('Sesja zapisana:', out);
await browser.close();
