// C4 packet — live evidence capture for Deliverable Open/Return UI.
// Drives the REAL app (vite dev server on :4501, proxying to the live
// backend on :3001) with Playwright, against real data seeded via the
// live artifact-links API. No mocks, no stubbed fetch.
import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = 'http://127.0.0.1:4501';
const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node c4-evidence.mjs <outDir>');
fs.mkdirSync(OUT, { recursive: true });

const CASE_ID = 'case-94b37954-c4a1-4417-8eed-9edefd570f95';
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
  await page.waitForSelector('text=Powiązane obiekty', { timeout: 20000 });
  await page.locator('text=Powiązane obiekty').scrollIntoViewIfNeeded();
  // Let the backend-authoritative overwrite (resolveArtifactLinkOpen) land —
  // otherwise the shot can race the enrichment fetch.
  await page.waitForTimeout(900);
}

// Real mechanism, not a CSS hack: src/index.tsx:36-58 reads
// localStorage['consultify-storage'].state.theme synchronously at boot and
// toggles the `dark` class on <html> before React even mounts. Setting the
// SAME key the app's own zustand-persist store uses, then reloading, is the
// same code path a user hits via the profile-menu theme toggle
// (UserProfileMenu.tsx toggleTheme) — just without the extra clicks.
async function setTheme(page, theme) {
  await page.evaluate((t) => {
    const raw = localStorage.getItem('consultify-storage');
    const parsed = raw ? JSON.parse(raw) : { state: {}, version: 0 };
    parsed.state = { ...(parsed.state || {}), theme: t };
    localStorage.setItem('consultify-storage', JSON.stringify(parsed));
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=Powiązane obiekty', { timeout: 20000 });
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
      await page.locator('text=Powiązane obiekty').scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const path = `${OUT}/desktop-${theme}-four-states-table.png`;
      await page.screenshot({ path, fullPage: false });
      results[`desktop-${theme}-table`] = path;
    }

    // ── Keyboard-only: focus the AVAILABLE row's Otwórz button, activate
    // with Enter, confirm navigation to the source module, go back, confirm
    // focus returns to the SAME button with a visible ring. ──────────────
    await gotoResultsTab(page);
    await setTheme(page, 'dark');
    const availableBtn = page.getByRole('button', { name: 'Otwórz obiekt: Decyzja' });
    await availableBtn.scrollIntoViewIfNeeded();
    await availableBtn.focus();
    await page.screenshot({ path: `${OUT}/keyboard-01-focused-before-open.png` });
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
    results.urlAfterOpen = page.url();
    await page.screenshot({ path: `${OUT}/keyboard-02-opened-target-module.png` });

    // Return via browser back (the same path a user takes after opening a
    // deliverable in its module — there is no in-Case "back" affordance to
    // click from inside another module).
    await page.goBack({ waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    results.urlAfterBack = page.url();
    const activeHandle = await page.evaluateHandle(() => document.activeElement);
    results.focusedAfterBackAriaLabel = await page.evaluate(
      (el) => (el instanceof HTMLElement ? el.getAttribute('aria-label') : null),
      activeHandle
    );
    results.focusedAfterBackOutline = await page.evaluate(
      (el) => (el instanceof HTMLElement ? getComputedStyle(el).outlineColor + ' / ' + getComputedStyle(el).outlineStyle : null),
      activeHandle
    );
    await page.screenshot({ path: `${OUT}/keyboard-03-returned-focus-restored.png` });

    // ── Refresh survives: hard-reload the Case URL now carrying the tab
    // param, confirm the results tab (and its table) reloads correctly. ──
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('text=Powiązane obiekty', { timeout: 20000 });
    await page.locator('text=Powiązane obiekty').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    results.urlAfterRefresh = page.url();
    await page.screenshot({ path: `${OUT}/refresh-01-results-tab-survived.png` });

    // ── Direct deep link: open the target module URL directly in a FRESH
    // tab (no prior Case navigation in this tab's history at all). ───────
    const availableLinkOpen = await context.request.get(
      `http://127.0.0.1:3001/api/v8/case-workspace/artifact-links/cwlink-ff42e7a0-0348-4f02-9d09-e55a691c22ff/open`,
      { headers: { Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token'))}` } }
    );
    results.deepLinkResolution = await availableLinkOpen.json();

    const freshPage = await context.newPage();
    await freshPage.goto(`${APP}/my-work?artifact=decision:c4-evid-decision-0001&code=DEC-C4EVIDDECIS`, {
      waitUntil: 'networkidle',
    });
    await freshPage.waitForTimeout(1200);
    results.directDeepLinkUrl = freshPage.url();
    await freshPage.screenshot({ path: `${OUT}/deeplink-01-direct-url-fresh-tab.png` });
    await freshPage.close();

    await context.close();
  }

  // ── Mobile, dark ───────────────────────────────────────────────────────
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
      await page.locator('text=Powiązane obiekty').scrollIntoViewIfNeeded();
      await page.waitForTimeout(200);
      const path = `${OUT}/mobile-${theme}-four-states-table.png`;
      await page.screenshot({ path, fullPage: false });
      results[`mobile-${theme}-table`] = path;
    }
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/run-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch((err) => {
  console.error('EVIDENCE_SCRIPT_FAILED', err);
  process.exit(1);
});
