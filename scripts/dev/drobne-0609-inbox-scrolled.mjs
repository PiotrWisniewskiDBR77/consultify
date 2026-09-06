import { chromium } from 'playwright';
import fs from 'node:fs';
const auth = JSON.parse(fs.readFileSync('/private/tmp/stanowisko-noc/auth-drobne.json','utf8'));
const origin = auth.origins.find(o=>o.origin==='http://localhost:3000');
const ls = Object.fromEntries(origin.localStorage.map(i=>[i.name,i.value]));
const outDir = '/private/tmp/wt-drobne/evidence/drobne-0609';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:3111/', { waitUntil: 'domcontentloaded' });
await page.evaluate((data) => { for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v); }, ls);
await page.goto('http://127.0.0.1:3111/my-work', { waitUntil: 'networkidle' });
await page.waitForSelector('table thead th');
await page.waitForTimeout(1200);

await page.evaluate(() => {
  const table = document.querySelector('table');
  let el = table.parentElement;
  while (el && !(el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX !== 'visible')) {
    el = el.parentElement;
  }
  if (el) { el.scrollLeft = el.scrollWidth; window.__scrolledEl = el; }
});
await page.waitForTimeout(300);

await page.screenshot({ path: `${outDir}/A-skrzynka-1440-po-scrolled.png`, fullPage: false });

const measurement = await page.evaluate(() => {
  const ths = Array.from(document.querySelectorAll('table thead th'));
  const receivedTh = ths.find((th) => th.textContent.trim() === 'Otrzymano');
  const lastTh = ths[ths.length - 1];
  const idx = ths.indexOf(receivedTh);
  const td = document.querySelectorAll('table tbody tr:first-child td')[idx];
  const span = td.querySelector('span');
  const table = document.querySelector('table');
  let el = table.parentElement;
  while (el && !(el.scrollWidth > el.clientWidth && getComputedStyle(el).overflowX !== 'visible')) {
    el = el.parentElement;
  }
  return {
    scrollLeft: el ? el.scrollLeft : null,
    scrollWidth: el ? el.scrollWidth : null,
    clientWidth: el ? el.clientWidth : null,
    receivedRect: receivedTh.getBoundingClientRect(),
    actionsRect: lastTh.getBoundingClientRect(),
    cellText: span.textContent,
    cellTextRect: span.getBoundingClientRect(),
  };
});
console.log(JSON.stringify(measurement, null, 2));
await browser.close();
