#!/usr/bin/env node
/**
 * KOPIA ROBOTNIKA (agent/admin-ustawienia-defekty-20260905) — port zmieniony na 3011
 * (3000 zajęty przez inny współbieżny proces w tym środowisku). Playwright's
 * storageState `origins[].localStorage` only comes back for an EXACT origin
 * match — auth.json was captured against http://localhost:3000, so we copy
 * those localStorage entries by hand under the new origin (cookies with
 * domain=localhost, no port, still apply as-is).
 *
 * Original: scripts/dev/odbior-zywo/zrzut.mjs (m03) — jasny motyw, 1440 szer.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const PORT = 3011;
const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const kliki = args.filter((x) => x.startsWith('--klik=')).map((x) => x.slice(7));
const url = get('url', '/chat'); const out = get('out'); const czekaj = Number(get('czekaj', '1200'));
const pelna = args.includes('--pelna'); const wysokosc = Number(get('wysokosc', '900'));
const auth = process.env.ODBIOR_AUTH_STATE;
if (!out || !auth || !fs.existsSync(auth)) { console.error('Wymagane: --out oraz ODBIOR_AUTH_STATE (istniejący plik)'); process.exit(2); }
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: wysokosc }, colorScheme: 'light', locale: 'pl-PL' });
{
  const authJson = JSON.parse(fs.readFileSync(auth, 'utf8'));
  const originEntry = (authJson.origins || [])[0] || null;
  const kv = originEntry ? originEntry.localStorage : [];
  await ctx.addInitScript((entries) => {
    try { for (const { name, value } of entries) localStorage.setItem(name, value); } catch {}
  }, kv);
}
await ctx.addInitScript(() => {
  try {
    const raw = localStorage.getItem('consultify-storage');
    const obj = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    obj.state = { ...(obj.state || {}), theme: 'light' };
    localStorage.setItem('consultify-storage', JSON.stringify(obj));
    document.documentElement.classList.remove('dark');
  } catch {}
});
const page = await ctx.newPage();
const bledy = [];
page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => bledy.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto(`http://localhost:${PORT}` + url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(czekaj);
for (const k of kliki) {
  try { await page.locator(k).first().click({ timeout: 8000 }); await page.waitForTimeout(900); }
  catch (e) { bledy.push(`klik nieudany: ${k}: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
}
await page.waitForTimeout(600);
await page.screenshot({ path: out, fullPage: pelna });
fs.writeFileSync(out + '.json', JSON.stringify({ url: page.url(), tytul: await page.title(), kliki, bledy, kiedy: new Date().toISOString() }, null, 1));
console.log('OK', out, page.url(), bledy.length ? `(${bledy.length} błędów konsoli/klików)` : '');
await browser.close();
