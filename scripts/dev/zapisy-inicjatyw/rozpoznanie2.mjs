#!/usr/bin/env node
import { chromium } from 'playwright';
const BASE = process.argv[2] || 'http://localhost:3150';
const AUTH = process.argv[3] || '/private/tmp/wt-zapisy/.auth-zapisy.json';
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 }, colorScheme: 'light', storageState: AUTH, locale: 'pl-PL',
});
const page = await context.newPage();
await page.goto(`${BASE}/initiatives`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
const row = page.locator('table tbody tr').first();
await row.dblclick();
await page.waitForTimeout(6000);
console.log('URL:', page.url());
const txt = await page.$$eval('h1,h2,h3,h4,button,[role="tab"]', (els) =>
  els.slice(0, 250).map((e) => `${e.tagName}:${(e.textContent || '').trim().slice(0, 45)}`).filter((s) => s.length > 8)
);
console.log(txt.join('\n'));
await page.screenshot({ path: '/tmp/rozpoznanie-dok.png', fullPage: false });
await browser.close();
