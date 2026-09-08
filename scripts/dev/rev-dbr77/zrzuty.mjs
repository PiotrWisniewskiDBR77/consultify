import { chromium } from 'playwright';
import fs from 'fs';
const BASE = 'http://127.0.0.1:3187';
const OUT = process.env.OUT || '/private/tmp/wt-rev-real/evidence/przeglad-dbr77/realizacja';
const PREFIX = process.env.PREFIX || '0';
const EKRANY = [
  ['kokpit', '/execution?tab=summary'],
  ['realizacje', '/execution?tab=list'],
  ['praca', '/execution?tab=work'],
  ['zasoby', '/execution?tab=resources'],
  ['raporty', '/execution?tab=reports'],
];
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({
  storageState: process.env.AUTH || '/private/tmp/wt-rev-real/auth-dbr77.json',
  viewport: { width: 1440, height: 900 },
});
let i = 0;
for (const [nazwa, sciezka] of EKRANY) {
  i += 1;
  const page = await ctx.newPage();
  const bledy = [];
  const wolania = [];
  page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => bledy.push('pageerror: ' + String(e.message).slice(0, 300)));
  const starty = new Map();
  page.on('request', (r) => starty.set(r, Date.now()));
  page.on('response', async (r) => {
    const req = r.request();
    const t0 = starty.get(req);
    const ms = t0 ? Date.now() - t0 : null;
    const u = r.url();
    if (!u.includes('/api/')) return;
    if (r.status() >= 400 || (ms !== null && ms > 2000)) {
      wolania.push({ url: u.replace(BASE, ''), status: r.status(), ms });
    }
  });
  const t0 = Date.now();
  await page.goto(`${BASE}${sciezka}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(Number(process.env.CZEKAJ || 22000));
  const ms = Date.now() - t0;
  const nazwaPliku = `${PREFIX}${i}-${nazwa}`;
  await page.screenshot({ path: `${OUT}/${nazwaPliku}.png`, fullPage: false });
  const tekst = (await page.locator('body').innerText()).replace(/\n{2,}/g, '\n').slice(0, 2500);
  fs.writeFileSync(`${OUT}/${nazwaPliku}.png.json`, JSON.stringify({
    ekran: nazwa, url: `${BASE}${sciezka}`, czasStronyMs: ms,
    bledyKonsoli: bledy, wolaniaWolneLubBledne: wolania,
    tekstEkranu: tekst,
  }, null, 1));
  console.log(`${nazwaPliku}: ${ms}ms, bledy=${bledy.length}, wolne/blad=${wolania.length}`);
  if (wolania.length) console.log('   ', JSON.stringify(wolania).slice(0, 600));
  await page.close();
}
await browser.close();
