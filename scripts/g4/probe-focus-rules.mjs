#!/usr/bin/env node
/**
 * Name the exact CSS rule that wins `outline-width` on a keyboard-focused
 * control, using CDP's matched-styles view. Turns "focus ring missing" into a
 * precise, fixable root cause instead of a heuristic complaint.
 *
 *   node scripts/g4/probe-focus-rules.mjs /my-work
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

const cdp = await context.newCDPSession(page);
await cdp.send('DOM.enable');
await cdp.send('CSS.enable');

let printed = 0;
for (let i = 0; i < 25 && printed < 3; i++) {
  await page.keyboard.press('Tab');
  const state = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return { width: cs.outlineWidth, style: cs.outlineStyle, cls: el.getAttribute('class') || '' };
  });
  if (!state) continue;
  if (state.width !== '0px') continue;

  const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
  const { nodeId } = await cdp.send('DOM.querySelector', {
    nodeId: root.nodeId,
    selector: ':focus',
  });
  if (!nodeId) continue;

  // Ask for the styles as if :focus-visible were active, matching a real
  // keyboard user rather than the snapshot's transient state.
  await cdp
    .send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus', 'focus-visible'] })
    .catch(() => {});
  const matched = await cdp.send('CSS.getMatchedStylesForNode', { nodeId });

  const hits = [];
  for (const m of matched.matchedCSSRules || []) {
    const props = (m.rule?.style?.cssProperties || []).filter((p) =>
      p.name.startsWith('outline')
    );
    if (!props.length) continue;
    hits.push({
      selector: m.rule.selectorList?.text,
      origin: m.rule.origin,
      href: m.rule.styleSheetId,
      props: props.map((p) => `${p.name}: ${p.value}${p.important ? ' !important' : ''}`),
    });
  }
  if (!hits.length) continue;

  printed++;
  console.log(`\n=== focused control #${i} (computed outline: ${state.style} ${state.width}) ===`);
  console.log('classes:', state.cls.replace(/\s+/g, ' ').slice(0, 200));
  for (const h of hits) {
    console.log(`  ${h.selector}  [${h.origin}]`);
    for (const p of h.props) console.log(`      ${p}`);
  }
}

if (!printed) console.log('No focused control with outline-width 0px found on', route);
await browser.close();
