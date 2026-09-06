#!/usr/bin/env node
/**
 * Audyt CTO 05.09 — zrzut ekranu + głęboka telemetria (konsola, sieć 4xx/5xx,
 * długie żądania >5s, przepełnienia poziome) dla audytu award/CES.
 * Wzorowany na m03/scripts/dev/odbior-zywo/zrzut.mjs (sesja ODBIOR_AUTH_STATE).
 * Użycie:
 *   node audyt.mjs --url=/my-work --out=/abs/path/id.png [--klik="text=Zadania"]... \
 *     [--czekaj=1500] [--pelna] [--host=127.0.0.1] [--port=3000] [--width=1440] [--height=900]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const get = (k, d) => { const a = args.find((x) => x.startsWith(`--${k}=`)); return a ? a.slice(k.length + 3) : d; };
const kliki = args.filter((x) => x.startsWith('--klik=')).map((x) => x.slice(7));
const url = get('url', '/chat');
const out = get('out');
const czekaj = Number(get('czekaj', '1200'));
const pelna = args.includes('--pelna');
const width = Number(get('width', '1440'));
const height = Number(get('height', '900'));
const port = Number(get('port', '3000'));
const host = get('host', '127.0.0.1');
const baza = `http://${host}:${port}`;
const auth = process.env.ODBIOR_AUTH_STATE;
if (!out || !auth || !fs.existsSync(auth)) { console.error('Wymagane: --out oraz ODBIOR_AUTH_STATE'); process.exit(2); }
fs.mkdirSync(path.dirname(out), { recursive: true });

const browser = await chromium.launch({ headless: true });
const sesja = JSON.parse(fs.readFileSync(auth, 'utf8'));
sesja.origins = (sesja.origins || []).map((o) => ({ ...o, origin: String(o.origin).replace('http://localhost:3000', baza) }));
const ctx = await browser.newContext({ storageState: sesja, viewport: { width, height }, colorScheme: 'light', locale: 'pl-PL' });
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

const bledyKonsoli = [];
page.on('console', (m) => { if (m.type() === 'error') bledyKonsoli.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => bledyKonsoli.push('pageerror: ' + String(e).slice(0, 300)));

const zadania = new Map(); // url -> {start, method}
const zle = []; // 4xx/5xx
const dlugie = []; // >5s
page.on('request', (req) => { zadania.set(req.url() + '#' + req.method(), { start: Date.now(), method: req.method(), url: req.url() }); });
const HALAS = /google-analytics\.com|googletagmanager\.com|doubleclick\.net|hotjar\.com|clarity\.ms/;
page.on('requestfailed', (req) => {
  const f = req.failure();
  const kod = f ? f.errorText : 'nieznany';
  if (kod === 'net::ERR_ABORTED') return; // zwykle anulowane przy nawigacji/zamknięciu, nie realny błąd
  if (HALAS.test(req.url())) return; // szum analityki zewnętrznej, nie stan aplikacji
  zle.push({ url: req.url(), method: req.method(), blad: kod, typ: 'requestfailed' });
});
page.on('response', (res) => {
  const req = res.request();
  const key = req.url() + '#' + req.method();
  const rec = zadania.get(key);
  const czas = rec ? Date.now() - rec.start : null;
  const status = res.status();
  if (status >= 400 && !HALAS.test(req.url())) zle.push({ url: req.url(), method: req.method(), status, typ: 'http' });
  if (czas && czas > 5000) dlugie.push({ url: req.url(), method: req.method(), ms: czas });
});

let bladNawigacji = null;
try {
  await page.goto(baza + url, { waitUntil: 'domcontentloaded', timeout: 30000 });
} catch (e) { bladNawigacji = String(e.message).split('\n')[0].slice(0, 200); }
await page.waitForTimeout(czekaj);
for (const k of kliki) {
  try { await page.locator(k).first().click({ timeout: 8000 }); await page.waitForTimeout(900); }
  catch (e) { bledyKonsoli.push(`klik nieudany: ${k}: ${String(e.message).split('\n')[0].slice(0, 200)}`); }
}
await page.waitForTimeout(600);

// Skan przepełnień poziomych (element szerszy niż rodzic o >8px, pomijając znane scrollery)
let przepelnienia = [];
try {
  przepelnienia = await page.evaluate(() => {
    const wyniki = [];
    const wszystkie = document.querySelectorAll('body *');
    let licznik = 0;
    for (const el of wszystkie) {
      if (licznik > 4000) break;
      licznik++;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (el.scrollWidth - el.clientWidth > 24 && style.overflowX === 'visible') {
        const txt = (el.textContent || '').trim().slice(0, 60);
        wyniki.push({ tag: el.tagName, klasa: (el.className || '').toString().slice(0, 80), tekst: txt, delta: el.scrollWidth - el.clientWidth });
      }
    }
    return wyniki.slice(0, 20);
  });
} catch {}

// Wykrycie widocznych placeholderów/błędów typu "undefined", "[object Object]", "NaN"
let podejrzaneTeksty = [];
try {
  podejrzaneTeksty = await page.evaluate(() => {
    const zly = /(undefined|NaN|\[object Object\]|null%|TODO:)/;
    const wyniki = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; let i = 0;
    while ((n = walker.nextNode()) && i < 5000) {
      i++;
      const t = n.textContent || '';
      if (zly.test(t)) wyniki.push(t.trim().slice(0, 80));
    }
    return wyniki.slice(0, 15);
  });
} catch {}

await page.screenshot({ path: out, fullPage: pelna });

const raport = {
  url: page.url(),
  tytul: await page.title().catch(() => ''),
  kliki,
  pelna,
  width,
  height,
  bladNawigacji,
  bledyKonsoli,
  siec4xx5xx: zle,
  zadaniaDlugie: dlugie,
  przepelnieniaPoziome: przepelnienia,
  tekstyPodejrzane: podejrzaneTeksty,
  kiedy: new Date().toISOString(),
};
fs.writeFileSync(out + '.json', JSON.stringify(raport, null, 2));
console.log('OK', out, page.url(), `błędy=${bledyKonsoli.length} 4xx5xx=${zle.length} dlugie=${dlugie.length} przepelnienia=${przepelnienia.length}`);

try {
  if (!page.url().includes('/login')) {
    const st = await ctx.storageState();
    st.origins = (st.origins || []).map((o) => ({ ...o, origin: String(o.origin).replace(baza, 'http://localhost:3000') }));
    fs.writeFileSync(auth, JSON.stringify(st, null, 2), { mode: 0o600 });
  }
} catch {}
await browser.close();
