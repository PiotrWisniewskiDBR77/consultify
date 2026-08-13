#!/usr/bin/env node
/**
 * risk35-kebab-contrast-check.mjs — RISK-35 negative-control harness.
 *
 * Loads the REAL `idea-table` dev-render screen (src/components/MyWork/IdeasTableContent.tsx
 * via dev-render/screens/idea-table.tsx), reads the row-actions kebab button's LIVE computed
 * style (color + cumulative opacity) and the canvas background it sits on, composites them
 * with the same Porter-Duff method as scripts/contrast-ratio.mjs, and asserts >= 3.0:1
 * (WCAG 1.4.11 non-text contrast, icon-only button) for BOTH themes.
 *
 * Exits 1 (and prints FAIL) if either theme is under the bar — used once deliberately
 * against the pre-fix opacity-40 to prove the check can go red, then re-run after
 * restoring the fix to prove it goes green again (RISK-35 negative control).
 *
 * Requires the dev-render vite server already running (see RISK-35 report for the
 * exact command) and its URL passed as argv[2] (default http://localhost:3733).
 */
import { chromium } from 'playwright';

import { compositeOver, contrastRatio } from './contrast-ratio.mjs';

const BASE_URL = process.argv[2] || 'http://localhost:3733';
const THRESHOLD = 3.0;

async function measure(page, theme) {
  await page.goto(`${BASE_URL}/?screen=idea-table&theme=${theme}&lang=pl`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  });
  await page.waitForTimeout(2000);
  const result = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="Row actions"]');
    if (!btn) return null;
    const wrapper = btn.closest('.inline-block');
    const cs = getComputedStyle(btn);
    const wrapperOpacity = wrapper ? Number(getComputedStyle(wrapper).opacity) : 1;
    const colorMatch = cs.color.match(/\d+/g).map(Number);
    // Canvas background: sample the row's own background (white/navy, opaque).
    const row = btn.closest('tr');
    const rowBg = getComputedStyle(row).backgroundColor;
    return { color: colorMatch, wrapperOpacity, rowBg };
  });
  return result;
}

function parseRgb(str, fallback) {
  const m = str.match(/\d+/g);
  if (!m) return fallback;
  return m.slice(0, 3).map(Number);
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const themes = [
    { theme: 'light', bg: [255, 255, 255] },
    { theme: 'dark', bg: [15, 23, 42] },
  ];

  let allPass = true;
  for (const { theme, bg } of themes) {
    const m = await measure(page, theme);
    if (!m) {
      console.log(`[${theme}] FAIL — kebab button not found in DOM`);
      allPass = false;
      continue;
    }
    const composited = compositeOver(m.color, m.wrapperOpacity, bg);
    const ratio = contrastRatio(composited, bg);
    const pass = ratio >= THRESHOLD;
    if (!pass) allPass = false;
    console.log(
      `[${theme}] color=rgb(${m.color.join(',')}) opacity=${m.wrapperOpacity} bg=rgb(${bg.join(',')}) ` +
        `composited=rgb(${composited.join(',')}) ratio=${ratio.toFixed(2)} threshold=${THRESHOLD} ` +
        `-> ${pass ? 'PASS' : 'FAIL'}`
    );
  }

  await browser.close();
  console.log(allPass ? 'RESULT: ALL PASS' : 'RESULT: FAIL');
  process.exit(allPass ? 0 : 1);
}

main();
