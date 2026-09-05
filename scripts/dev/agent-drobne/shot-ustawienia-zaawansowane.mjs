import { chromium } from 'playwright';

const out = process.argv[2];
const base = 'http://localhost:4777';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0,300)); });
await page.goto(base + '/?screen=ustawienia-zaawansowane&lang=pl', { waitUntil: 'load' });
await page.waitForTimeout(5000);
const items = await page.evaluate(() => {
  const spans = Array.from(document.querySelectorAll('aside, nav, div')).filter(el => el.textContent === 'Zaawansowane');
  return document.body.innerText.match(/Import\/Eksport|Szablony|Deweloper|Funkcje beta|Historia/g);
});
console.log('sidebar advanced items found:', items);
await page.screenshot({ path: out, fullPage: false });
console.log('OK', out, 'errs:', errs.length, errs.slice(0,10));
await browser.close();
