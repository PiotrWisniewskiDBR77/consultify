// F3 packet — live UI evidence capture for the PARTIAL and SKIPPED
// `case_workspace_node_result_acceptances` states produced by
// drive-states.mjs (real HTTP against the real backend, real disposable
// Postgres — see that script + drive-states-output.json for the API
// sequence and DB readback).
//
// Drives the REAL app (vite dev server on :4501, proxying to the live
// backend on :3001) with Playwright. No mocks, no stubbed fetch. Follows the
// exact login/theme/viewport pattern already proven in
// evidence/c4-deliverable-ui-2026-08-12/capture.mjs.

import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = 'http://127.0.0.1:4501';
const OUT = process.argv[2];
const CASE_ID = process.argv[3];
if (!OUT || !CASE_ID) throw new Error('usage: node capture.mjs <outDir> <caseId>');
fs.mkdirSync(OUT, { recursive: true });

const CASE_URL = `${APP}/zlecenia/${CASE_ID}?zakladka=rezultaty`;

async function loginAndSetFlag(page) {
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'cw.local@local.test');
  await page.fill('input[type="password"]', 'CaseWorkspaceLocal!2026');
  await Promise.all([
    page.waitForURL(/\/chat/, { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.evaluate(() => localStorage.setItem('ff.caseWorkspace', '1'));
}

async function gotoResultsTab(page) {
  await page.goto(CASE_URL, { waitUntil: 'networkidle' });
  await page.waitForSelector('text=Wyniki wykonania kroków', { timeout: 20000 });
  await page.locator('text=Wyniki wykonania kroków').scrollIntoViewIfNeeded();
  await page.waitForTimeout(900);
}

// Same real mechanism as c4's capture.mjs: src/index.tsx reads
// localStorage['consultify-storage'].state.theme synchronously at boot.
async function setTheme(page, theme) {
  await page.evaluate((t) => {
    const raw = localStorage.getItem('consultify-storage');
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state || {}), theme: t };
    localStorage.setItem('consultify-storage', JSON.stringify(parsed));
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Wyniki wykonania kroków', { timeout: 20000 });
  await page.waitForTimeout(500);
}

const results = {};

(async () => {
  const browser = await chromium.launch();

  // ── Desktop, dark + light ──────────────────────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await loginAndSetFlag(page);

    for (const theme of ['dark', 'light']) {
      await gotoResultsTab(page);
      await setTheme(page, theme);
      await page.locator('text=Wyniki wykonania kroków').scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const path = `${OUT}/desktop-${theme}-node-results-table.png`;
      await page.screenshot({ path, fullPage: false });
      results[`desktop-${theme}-table`] = path;

      // Row text sanity — captured as plain text, not just a screenshot.
      const rowText = await page.locator('text=Częściowo zakończone').first().isVisible().catch(() => false);
      const skippedText = await page.locator('text=Pominięty').first().isVisible().catch(() => false);
      results[`desktop-${theme}-partial-row-visible`] = rowText;
      results[`desktop-${theme}-skipped-row-visible`] = skippedText;
    }

    // ── Open the PARTIAL row's preview — confirm label/status/description. ──
    await setTheme(page, 'dark');
    await page.locator('text=Częściowo zakończone').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/desktop-dark-partial-preview.png` });
    results.partialPreviewText = await page.locator('body').innerText();

    // ── Open the SKIPPED row's preview. ──────────────────────────────────
    await page.locator('text=Pominięty').first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}/desktop-dark-skipped-preview.png` });

    // ── Refresh survives (both rows). ────────────────────────────────────
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('text=Wyniki wykonania kroków', { timeout: 20000 });
    await page.locator('text=Wyniki wykonania kroków').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    results.urlAfterRefresh = page.url();
    results.partialVisibleAfterRefresh = await page
      .locator('text=Częściowo zakończone')
      .first()
      .isVisible()
      .catch(() => false);
    results.skippedVisibleAfterRefresh = await page
      .locator('text=Pominięty')
      .first()
      .isVisible()
      .catch(() => false);
    await page.screenshot({ path: `${OUT}/desktop-dark-after-refresh.png` });

    // ── Close and reopen the Case (navigate away to the case list, then
    //    back in — not just a reload) — both rows must still be there. ─────
    await page.goto(`${APP}/zlecenia`, { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(800);
    results.urlAfterClose = page.url();
    await page.screenshot({ path: `${OUT}/desktop-dark-case-list-after-close.png` });

    await gotoResultsTab(page);
    results.urlAfterReopen = page.url();
    results.partialVisibleAfterReopen = await page
      .locator('text=Częściowo zakończone')
      .first()
      .isVisible()
      .catch(() => false);
    results.skippedVisibleAfterReopen = await page
      .locator('text=Pominięty')
      .first()
      .isVisible()
      .catch(() => false);
    await page.screenshot({ path: `${OUT}/desktop-dark-after-reopen.png` });

    await context.close();
  }

  // ── Mobile, dark + light ───────────────────────────────────────────────
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
    const page = await context.newPage();
    await loginAndSetFlag(page);
    for (const theme of ['dark', 'light']) {
      await gotoResultsTab(page);
      await setTheme(page, theme);
      // Scroll to the SKIPPED row's own text (last row) rather than just the
      // section heading, so both rows are actually inside the viewport.
      await page.locator('text=Pominięty').first().scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const path = `${OUT}/mobile-${theme}-node-results-table.png`;
      await page.screenshot({ path, fullPage: false });
      results[`mobile-${theme}-table`] = path;
      results[`mobile-${theme}-partial-row-visible`] = await page
        .locator('text=Częściowo zakończone')
        .first()
        .isVisible()
        .catch(() => false);
      results[`mobile-${theme}-skipped-row-visible`] = await page
        .locator('text=Pominięty')
        .first()
        .isVisible()
        .catch(() => false);
    }

    // Full-page mobile shot too, so nothing is left to guesswork about what
    // is below the fold.
    await page.locator('text=Wyniki wykonania kroków').scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${OUT}/mobile-dark-node-results-fullpage.png`, fullPage: true });

    await context.close();
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/run-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch((err) => {
  console.error('EVIDENCE_SCRIPT_FAILED', err);
  process.exit(1);
});
