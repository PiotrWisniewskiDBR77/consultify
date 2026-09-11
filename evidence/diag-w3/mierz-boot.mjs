// Pomiar kosztu ROZRUCHU (eager bundle) bez API: statyczny serwer na dist + Playwright.
// Mierzy: czas do pierwszego niepustego #root, bajty JS/CSS pobrane, liczba żądań.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const DIST = process.argv[2];
const ETYKIETA = process.argv[3];
const PORT = Number(process.argv[4] || 5711);
const MIME = { '.js':'text/javascript', '.css':'text/css', '.html':'text/html', '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

const srv = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.join(DIST, p);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(DIST, 'index.html');
  const buf = fs.readFileSync(f);
  res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream');
  res.setHeader('Cache-Control', 'no-store');
  res.end(buf);
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
let bytes = 0, reqJs = 0, reqAll = 0, bytesCss = 0;
page.on('response', async r => {
  reqAll++;
  const u = r.url();
  try {
    const b = await r.body();
    if (u.endsWith('.js')) { bytes += b.length; reqJs++; }
    if (u.endsWith('.css')) bytesCss += b.length;
  } catch {}
});
const t0 = Date.now();
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 });
let tRoot = null;
try {
  await page.waitForFunction(() => (document.getElementById('root')?.innerHTML.length ?? 0) > 500, null, { timeout: 60000 });
  tRoot = Date.now() - t0;
} catch {}
await page.waitForTimeout(1500);
const len = await page.evaluate(() => document.getElementById('root')?.innerHTML.length ?? 0);
console.log(JSON.stringify({ etykieta: ETYKIETA, msDoPierwszegoRenderu: tRoot, rootLen: len, jsPobrane: bytes, jsZadania: reqJs, cssPobrane: bytesCss, zadaniaRazem: reqAll }, null, 1));
await browser.close();
srv.close();
