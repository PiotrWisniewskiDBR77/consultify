#!/usr/bin/env node
/**
 * Adversarial check of the sweep's "focus indicator not visible" finding.
 *
 * The sweep reports a control as having no visible focus when neither outline,
 * box-shadow nor a focus/ring class is present. That heuristic could be wrong if
 * the ring is painted on a parent, a child, or a pseudo-element. This probe
 * dumps the full computed picture for the first offending controls so the
 * finding can be confirmed or withdrawn on evidence rather than assumed.
 *
 *   node scripts/g4/probe-focus.mjs /my-work
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
await page.locator('#root').waitFor({ state: 'attached' });
await page.waitForTimeout(9000);
console.log('html class =', await page.evaluate(() => document.documentElement.className));

const report = [];
for (let i = 0; i < 25; i++) {
  await page.keyboard.press('Tab');
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    const before = getComputedStyle(el, '::before');
    const after = getComputedStyle(el, '::after');
    const parent = el.parentElement ? getComputedStyle(el.parentElement) : null;
    return {
      tag: el.tagName.toLowerCase(),
      classes: (el.getAttribute('class') || '').slice(0, 160),
      matchesFocusVisible: el.matches(':focus-visible'),
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
      boxShadow: cs.boxShadow.slice(0, 120),
      beforeBoxShadow: before.boxShadow.slice(0, 60),
      afterBoxShadow: after.boxShadow.slice(0, 60),
      beforeContent: before.content.slice(0, 40),
      parentBoxShadow: parent ? parent.boxShadow.slice(0, 60) : null,
      parentOutline: parent ? `${parent.outlineStyle} ${parent.outlineWidth}` : null,
      bg: cs.backgroundColor,
    };
  });
  if (info) report.push(info);
}

const noRing = report.filter(
  (r) =>
    (r.outline.startsWith('none') || r.outline.includes('0px')) &&
    (r.boxShadow === 'none' || r.boxShadow === '') &&
    (r.parentBoxShadow === 'none' || r.parentBoxShadow === null) &&
    (r.beforeBoxShadow === 'none' || r.beforeBoxShadow === '')
);

console.log(`route=${route} focused=${report.length} withoutAnyRing=${noRing.length}\n`);
for (const r of noRing.slice(0, 6)) console.log(JSON.stringify(r, null, 1));
console.log('\n--- sample WITH ring (control) ---');
const withRing = report.filter((r) => !noRing.includes(r));
for (const r of withRing.slice(0, 3)) console.log(JSON.stringify(r, null, 1));

await browser.close();
