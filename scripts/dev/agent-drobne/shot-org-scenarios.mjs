import { chromium } from 'playwright';

const out = process.argv[2];
const base = 'http://localhost:4777';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0,300)); });
await page.goto(base + '/?screen=org-scenarios&lang=pl', { waitUntil: 'load' });
await page.waitForTimeout(5000);
await page.screenshot({ path: out, fullPage: false });
console.log('OK', out, 'errs:', errs.length, errs.slice(0,10));
await browser.close();
