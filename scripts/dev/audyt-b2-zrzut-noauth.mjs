#!/usr/bin/env node
// Audyt B2 — zrzut BEZ sesji (incognito), do weryfikacji stron publicznych/loginu/404.
// Nie dotyka pliku auth-B.json. Użycie identyczne jak zrzut.mjs ale bez ODBIOR_AUTH_STATE.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const url = get('url', '/'); const out = get('out'); const czekaj = Number(get('czekaj', '1200'));
const pelna = args.includes('--pelna'); const wysokosc = Number(get('wysokosc', '900'));
const port = Number(get('port', '3090'));
const host = get('host', 'localhost');
const baza = `http://${host}:${port}`;
if (!out) { console.error('Wymagane: --out'); process.exit(2); }
fs.mkdirSync(path.dirname(out), { recursive: true });
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: wysokosc }, colorScheme: 'light', locale: 'pl-PL' });
const page = await ctx.newPage();
const bledy = [];
page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => bledy.push('pageerror: ' + String(e).slice(0, 200)));
await page.goto(baza + url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(czekaj);
await page.screenshot({ path: out, fullPage: pelna });
const tekst = await page.locator('body').innerText().catch(() => '');
fs.writeFileSync(out + '.json', JSON.stringify({ url: page.url(), tytul: await page.title(), bledy, bledyKonsoli: bledy, tekst, kiedy: new Date().toISOString() }, null, 1));
console.log('OK', out, page.url(), bledy.length ? `(${bledy.length} błędów konsoli)` : '');
await browser.close();
