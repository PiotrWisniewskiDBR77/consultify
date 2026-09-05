import { chromium } from 'playwright';

const out = process.argv[2];
const base = 'http://localhost:4777';
const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, colorScheme: 'light' });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0,200)); });
await page.goto(base + '/?screen=karta-tool&lang=pl', { waitUntil: 'load' });
await page.waitForTimeout(6000);
// Sekcja "PRZYKŁAD" jest domyślnie ROZWINIĘTA — klik w NAGŁÓWEK by ją zwinął.
// Klikamy bezpośrednio drugi element tekstowy "Przykład" (pozycja 0 = nagłówek sekcji, 1 = pozycja nawigacyjna).
const items = page.getByText('Przykład', { exact: true });
console.log('count', await items.count());
await items.nth(1).click();
await page.waitForTimeout(1200);
await page.screenshot({ path: out, fullPage: false });
console.log('OK', out, 'errs:', errs.length, errs.slice(0,5));
await browser.close();
