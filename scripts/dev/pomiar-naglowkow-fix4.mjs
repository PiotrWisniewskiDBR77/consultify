#!/usr/bin/env node
/**
 * Pomiar naglowkow kolumn (fala 4, mvp/naprawy-noc-4) — standalone, NIE dotyka
 * wspolnego scripts/dev/odbior-zywo/zrzut.mjs. Dla kazdego --url robi zrzut PNG
 * 1440x900 (jasny motyw) i mierzy document.querySelectorAll('th'):
 * tekst, scrollWidth, clientWidth, uciety = scrollWidth > clientWidth + 1.
 * Uzycie:
 *   node scripts/dev/pomiar-naglowkow-fix4.mjs --url=/finance --out=evidence/x/finance.png \
 *     --port=3096 --auth=/private/tmp/stanowisko-noc/auth-fix4.json
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const url = get('url', '/chat');
const outPng = get('out');
const port = Number(get('port', '3096'));
const host = get('host', 'localhost');
const authPath = get('auth', '/private/tmp/stanowisko-noc/auth-fix4.json');
const czekaj = Number(get('czekaj', '1500'));

if (!outPng) { console.error('brak --out'); process.exit(2); }
fs.mkdirSync(path.dirname(outPng), { recursive: true });

const baza = `http://${host}:${port}`;
const stan = JSON.parse(fs.readFileSync(authPath, 'utf8'));
stan.origins = (stan.origins || []).map((o) => ({
  ...o,
  origin: o.origin.replace(/:\d+$/, `:${port}`).replace(/^https?:\/\/[^:/]+/, baza.replace(/:\d+$/, '')),
}));
// prostsze i pewniejsze: przepisz KAZDY origin na baza, niezaleznie od hosta/portu zrodlowego
stan.origins = (JSON.parse(fs.readFileSync(authPath, 'utf8')).origins || []).map((o) => ({ ...o, origin: baza }));

const browser = await chromium.launch();
const context = await browser.newContext({ storageState: stan, viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const page = await context.newPage();
const bledy = [];
page.on('console', (msg) => { if (msg.type() === 'error') bledy.push(msg.text().slice(0, 300)); });
await page.goto(baza + url, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => bledy.push('goto: ' + e.message));
await page.waitForTimeout(czekaj);

const finalUrl = page.url();
const naglowki = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('th')).map((th) => {
    const rect = th.getBoundingClientRect();
    return {
      tekst: (th.innerText || '').trim().replace(/\s+/g, ' '),
      scrollWidth: th.scrollWidth,
      clientWidth: th.clientWidth,
      uciety: th.scrollWidth > th.clientWidth + 1,
      x: Math.round(rect.x),
      width: Math.round(rect.width),
    };
  });
});

await page.screenshot({ path: outPng, fullPage: false });
await browser.close();

const wynik = { url: finalUrl, port, naglowki, uciete: naglowki.filter((n) => n.uciety), bledyKonsoli: bledy, kiedy: new Date().toISOString() };
fs.writeFileSync(outPng + '.json', JSON.stringify(wynik, null, 2));
console.log(`${url} -> ${finalUrl} | th=${naglowki.length} | uciete=${wynik.uciete.length}`);
if (wynik.uciete.length) console.log('  UCIETE:', wynik.uciete.map((n) => n.tekst).join(' | '));
if (finalUrl.includes('/login')) console.log('  UWAGA: przekierowano na /login (sesja niewazna)');
