import { chromium } from 'playwright';

const out = process.argv[2];
const base = 'http://localhost:4777';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0,200)); });
await page.goto(base + '/?screen=admin-command-center-panel&tab=attention-queue&lang=pl', { waitUntil: 'load' });
await page.waitForTimeout(4000);
await page.screenshot({ path: out, fullPage: false });
console.log('OK', out, 'errs:', errs.length, errs.slice(0,5));
await browser.close();
