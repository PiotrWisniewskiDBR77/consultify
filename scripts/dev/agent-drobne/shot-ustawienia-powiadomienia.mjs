import { chromium } from 'playwright';

const out = process.argv[2];
const base = 'http://localhost:4777';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const page = await ctx.newPage();
const errs = [];
const requests = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0,300)); });
page.on('request', (req) => { requests.push(req.url()); });
await page.goto(base + '/?screen=ustawienia-powiadomienia&lang=pl', { waitUntil: 'load' });
await page.waitForTimeout(5000);
await page.screenshot({ path: out, fullPage: false });
const integrationsCalls = requests.filter(u => u.includes('/integrations'));
console.log('OK', out);
console.log('console errors:', errs.length, errs.slice(0,10));
console.log('requests hitting /integrations:', integrationsCalls);
await browser.close();
