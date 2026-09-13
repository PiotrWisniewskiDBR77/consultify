import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';

const BASE = 'http://localhost:5310';
const OUT = path.resolve('/Users/piotrwisniewski/Developer/wt/narzedzia/evidence/s114b-narzedzia');
fs.mkdirSync(OUT, { recursive: true });

const PARTS = process.argv[2] ? process.argv[2].split(',') : ['b1','b2','w3','b3','b6','w11'];
const browser = await chromium.launch();
const wyniki = [];
for (const part of PARTS) {
  for (const motyw of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const bledy = [];
    page.on('console', (m) => { if (m.type() === 'error') bledy.push(m.text()); });
    page.on('pageerror', (e) => bledy.push('PAGEERROR: ' + e.message));
    const url = `${BASE}/?screen=s114b-narzedzia&part=${part}&lang=en&theme=${motyw}&uwagi=0`;
    const plik = path.join(OUT, `${part}__PO__${motyw}.png`);
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(1800);
      await page.addStyleTag({ content: '[data-dev-render-chrome], .dev-render-chrome { display: none !important; }' });
      await page.screenshot({ path: plik, fullPage: true });
      wyniki.push({ part, motyw, status: 'OK', bledyKonsoli: bledy.length, bledy: bledy.slice(0, 3) });
    } catch (e) {
      wyniki.push({ part, motyw, status: 'BLAD: ' + String(e.message).slice(0, 140), bledyKonsoli: bledy.length, bledy: bledy.slice(0, 3) });
    }
    await ctx.close();
  }
}
await browser.close();
console.log(JSON.stringify(wyniki, null, 1));
