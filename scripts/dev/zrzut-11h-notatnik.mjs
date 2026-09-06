#!/usr/bin/env node
/** H2 evidence: Notatnik -> Q2 Strategy note, saved to evidence/1-1-h/. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const AUTH = JSON.parse(fs.readFileSync('/tmp/auth11h_localstorage.json', 'utf8'));
const outDir = '/private/tmp/wt-11h/evidence/1-1-h';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await context.newPage();

await page.goto('http://127.0.0.1:3123/my-work', { waitUntil: 'domcontentloaded' });
await page.evaluate((data) => {
  for (const [k, v] of Object.entries(data)) window.localStorage.setItem(k, v);
}, AUTH);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

await page.getByText('Notatnik', { exact: true }).first().click();
await page.waitForTimeout(1500);
await page.getByText('Moje notatki', { exact: true }).first().click();
await page.waitForTimeout(1500);
await page.getByText(/Q2 Strategy/).first().click();
await page.waitForTimeout(1500);

await page.screenshot({ path: `${outDir}/h2-po.png` });
console.log('Saved', `${outDir}/h2-po.png`);

await browser.close();
