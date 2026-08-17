#!/usr/bin/env node
/**
 * Enumerate every loaded CSS rule that touches `outline`, in cascade order, so
 * the missing focus ring can be attributed to a named rule instead of a guess.
 *
 *   node scripts/g4/probe-outline-sources.mjs /my-work
 */

import { chromium } from 'playwright';
import fs from 'node:fs';

const route = process.argv[2] || '/my-work';
const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:3940';
const STORAGE = process.env.E2E_STORAGE_STATE_PATH || '.tmp/e2e/e2e-storage-state.json';

const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: fs.existsSync(STORAGE) ? STORAGE : undefined,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(9000);

const rules = await page.evaluate(() => {
  const out = [];
  const walk = (list, sheetHref) => {
    for (const rule of Array.from(list || [])) {
      if (rule.cssRules) {
        walk(rule.cssRules, sheetHref);
        continue;
      }
      const text = rule.cssText || '';
      if (!/outline/.test(text)) continue;
      out.push({ sheet: sheetHref || '(inline)', css: text.slice(0, 200) });
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      walk(sheet.cssRules, sheet.href);
    } catch {
      out.push({ sheet: sheet.href || '(inline)', css: '<<cross-origin, unreadable>>' });
    }
  }
  return out;
});

console.log(`route=${route} rules touching outline: ${rules.length}\n`);
for (const r of rules) console.log(`${r.css}\n    ← ${r.sheet}`);

await browser.close();
