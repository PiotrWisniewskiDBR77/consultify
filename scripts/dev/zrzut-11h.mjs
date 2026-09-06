#!/usr/bin/env node
/**
 * ZLECENIE 1.1-H — zrzuty ewidencyjne (1440, ciemny) dla H1/H2/H3.
 * Uzycie: node scripts/dev/zrzut-11h.mjs <nazwa> <url> <selector-do-poczekania?>
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const AUTH = JSON.parse(fs.readFileSync('/tmp/auth11h_localstorage.json', 'utf8'));

const [, , name, url, waitSelector] = process.argv;
if (!name || !url) {
  console.error('Uzycie: node zrzut-11h.mjs <nazwa> <url> [selector]');
  process.exit(1);
}

const outDir = '/private/tmp/wt-11h/evidence/1-1-h';
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  colorScheme: 'dark',
});
const page = await context.newPage();

// First navigate to set the origin, then inject localStorage, then reload.
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.evaluate((data) => {
  for (const [k, v] of Object.entries(data)) window.localStorage.setItem(k, v);
}, AUTH);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
if (waitSelector) {
  try {
    await page.waitForSelector(waitSelector, { timeout: 8000 });
  } catch {
    console.error('Selector not found (continuing anyway):', waitSelector);
  }
}
await page.waitForTimeout(500);

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

const outPath = `${outDir}/${name}.png`;
await page.screenshot({ path: outPath, fullPage: false });
console.log('Saved', outPath);
console.log('Console errors so far:', consoleErrors.length ? consoleErrors : '(none captured post-hoc)');

await browser.close();
