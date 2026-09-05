import { chromium } from 'playwright';

const out = process.argv[2];
const base = 'http://localhost:4777';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0,200)); });
await page.goto(base + '/?screen=whiteboard-canvas', { waitUntil: 'load' });
await page.waitForTimeout(8000);
const sticky = page.locator('text=Klient nie ma spisanej dokumentacji procesu').first();
await sticky.waitFor({ state: 'visible', timeout: 15000 });
await sticky.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: out });
console.log('OK', out, 'errs:', errs.length, errs.slice(0,5));
await browser.close();
