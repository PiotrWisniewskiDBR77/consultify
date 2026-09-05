#!/usr/bin/env node
// Audyt B2 — klik po wspolrzednych (gdy tekst niejednoznaczny), potem dalsze kliki tekstowe.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const url = get('url', '/'); const out = get('out'); const czekaj = Number(get('czekaj', '1200'));
const port = Number(get('port', '3090'));
const xy = get('xy', ''); // "x,y"
const kliki = args.filter((x) => x.startsWith('--klik=')).map((x) => x.slice(7));
const auth = process.env.ODBIOR_AUTH_STATE;
if (!out || !auth) { console.error('Wymagane: --out, ODBIOR_AUTH_STATE'); process.exit(2); }
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await chromium.launch({ headless: true });
const sesja = JSON.parse(fs.readFileSync(auth, 'utf8'));
const originy = sesja.origins || [];
const zrodlo = originy.find((o) => o.origin === 'http://localhost:3000') || originy[0];
const baza = `http://localhost:${port}`;
if (zrodlo) { sesja.origins = [...originy.filter((o) => o.origin !== baza), { ...zrodlo, origin: baza }]; }
const ctx = await browser.newContext({ storageState: sesja, viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'pl-PL' });
const page = await ctx.newPage();
const bledy = [];
page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => bledy.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto(baza + url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(czekaj);
if (xy) {
  const [x, y] = xy.split(',').map(Number);
  try { await page.mouse.click(x, y); await page.waitForTimeout(900); }
  catch (e) { bledy.push('klik-xy nieudany: ' + String(e.message).slice(0, 160)); }
}
for (const k of kliki) {
  try { await page.locator(k).first().click({ timeout: 8000 }); await page.waitForTimeout(900); }
  catch (e) { bledy.push(`klik nieudany: ${k}: ${String(e.message).split('\n')[0].slice(0, 160)}`); }
}
await page.waitForTimeout(500);
await page.screenshot({ path: out });
const tekst = await page.locator('body').innerText().catch(() => '');
fs.writeFileSync(out + '.json', JSON.stringify({ url: page.url(), bledy, bledyKonsoli: bledy, tekst, kiedy: new Date().toISOString() }, null, 1));
console.log('OK', out, page.url(), bledy.length ? `(${bledy.length} bledow)` : '');
try {
  if (!page.url().includes('/login')) {
    const st = await ctx.storageState();
    st.origins = (st.origins || []).map((o) => ({ ...o, origin: String(o.origin).replace(baza, 'http://localhost:3000') }));
    fs.writeFileSync(auth, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
} catch {}
await browser.close();
