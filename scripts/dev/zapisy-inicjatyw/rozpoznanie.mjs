#!/usr/bin/env node
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:3150';
const AUTH = process.argv[3] || '/private/tmp/wt-zapisy/.auth-zapisy.json';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'light',
  storageState: AUTH,
  locale: 'pl-PL',
});
const page = await context.newPage();
await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
console.log('URL:', page.url());
console.log('H:', JSON.stringify(await page.$$eval('h1,h2,h3', (e) => e.slice(0, 8).map((x) => x.textContent?.trim()))));
const rows = await page.$$eval('table tbody tr', (trs) =>
  trs.slice(0, 8).map((tr) => Array.from(tr.querySelectorAll('td')).slice(0, 3).map((td) => td.textContent?.trim()).join(' | '))
);
console.log('WIERSZE:\n' + rows.join('\n'));
await page.screenshot({ path: '/tmp/rozpoznanie-lista.png' });
await browser.close();
