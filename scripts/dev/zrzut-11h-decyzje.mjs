#!/usr/bin/env node
/** H3 evidence: Decyzje list, TYP column + column toggler. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const AUTH = JSON.parse(fs.readFileSync('/tmp/auth11h_localstorage.json', 'utf8'));
const outDir = '/private/tmp/wt-11h/evidence/1-1-h';
fs.mkdirSync(outDir, { recursive: true });

const [, , name] = process.argv;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
const page = await context.newPage();

await page.goto('http://127.0.0.1:3123/my-work', { waitUntil: 'domcontentloaded' });
await page.evaluate((data) => {
  for (const [k, v] of Object.entries(data)) window.localStorage.setItem(k, v);
}, AUTH);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);

await page.getByText('Decyzje', { exact: true }).first().click();
await page.waitForTimeout(2000);

await page.screenshot({ path: `${outDir}/${name}-lista.png` });
console.log('Saved', `${outDir}/${name}-lista.png`);

// Open the column toggler ("Ustawienia widoku") to show the Project checkbox state.
const gearBtn = page.getByRole('button', { name: 'Ustawienia widoku' });
await gearBtn.click();
await page.waitForTimeout(600);
await page.screenshot({ path: `${outDir}/${name}-pstryczek.png` });
console.log('Saved', `${outDir}/${name}-pstryczek.png`);

await browser.close();
