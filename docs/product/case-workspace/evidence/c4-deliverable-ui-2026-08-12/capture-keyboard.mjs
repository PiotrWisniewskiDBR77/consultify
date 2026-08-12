// C4 packet — clean keyboard/focus-return + refresh evidence, v2.
// Lessons from the two earlier attempts:
//  - headless:false is required — headless Chromium reported
//    document.hidden===true here, which throttles requestAnimationFrame and
//    produced a FALSE "focus never returns" signal.
//  - Alt+ArrowLeft is a Windows/Linux Chrome binding, not macOS — use
//    page.goBack() to drive the history pop instead.
//  - The focus restore is genuinely async (rAF + staggered up-to-640ms
//    retries per the code's own comments) — poll, don't sample once early.
import { chromium } from 'playwright';
import fs from 'node:fs';

const APP = 'http://127.0.0.1:4501';
const OUT = process.argv[2];
if (!OUT) throw new Error('usage: node c4-evidence-keyboard-v2.mjs <outDir>');
fs.mkdirSync(OUT, { recursive: true });

const CASE_URL = `${APP}/zlecenia/case-94b37954-c4a1-4417-8eed-9edefd570f95?zakladka=rezultaty`;
const results = {};

async function pollActiveElement(page, maxMs, stepMs) {
  const trace = [];
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const snap = await page.evaluate(() => ({
      tag: document.activeElement?.tagName || null,
      label: document.activeElement?.getAttribute?.('aria-label') || null,
      outlineStyle: document.activeElement ? getComputedStyle(document.activeElement).outlineStyle : null,
    }));
    const last = trace[trace.length - 1];
    if (!last || last.tag !== snap.tag || last.label !== snap.label) {
      trace.push({ tMs: maxMs - (deadline - Date.now()), ...snap });
    }
    if (snap.label === 'Otwórz obiekt: Decyzja' && snap.outlineStyle === 'solid') break;
    await page.waitForTimeout(stepMs);
  }
  return trace;
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.log('BROWSER_PAGE_ERROR', err.message, err.stack));

  await page.goto(`${APP}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', 'cw.local@local.test');
  await page.fill('input[type="password"]', 'CaseWorkspaceLocal!2026');
  await Promise.all([page.waitForURL(/\/chat/, { timeout: 15000 }), page.click('button[type="submit"]')]);
  await page.evaluate(() => localStorage.setItem('ff.caseWorkspace', '1'));

  await page.goto(CASE_URL, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=Powiązane obiekty', { timeout: 60000 });
  results.visibility = await page.evaluate(() => ({
    visibilityState: document.visibilityState,
    hidden: document.hidden,
    hasFocus: document.hasFocus(),
  }));

  // Instrument sessionStorage to prove the write/consume actually happens
  // (independent of whether focus visibly lands) — same technique used in
  // the manual MCP-browser diagnostic that first surfaced this.
  await page.evaluate(() => {
    window.__ssLog = [];
    const origSet = Storage.prototype.setItem;
    const origRemove = Storage.prototype.removeItem;
    Storage.prototype.setItem = function (k, v) {
      if (this === sessionStorage) window.__ssLog.push({ op: 'set', k, t: Date.now() });
      return origSet.call(this, k, v);
    };
    Storage.prototype.removeItem = function (k) {
      if (this === sessionStorage) window.__ssLog.push({ op: 'remove', k, t: Date.now() });
      return origRemove.call(this, k);
    };
  });

  const availableBtn = page.getByRole('button', { name: 'Otwórz obiekt: Decyzja' });
  await availableBtn.scrollIntoViewIfNeeded();
  await availableBtn.focus();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/keyboard-01-focused-before-open.png` });

  await page.keyboard.press('Enter');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
  results.urlAfterOpen = page.url();
  await page.screenshot({ path: `${OUT}/keyboard-02-opened-target-module.png` });

  await page.goBack({ waitUntil: 'networkidle', timeout: 90000 });
  results.urlAfterBack = page.url();
  // This shared dev box runs many concurrent agent sessions (hundreds of
  // node processes observed) — give the 8-parallel-endpoint case bundle
  // fetch a generous window before concluding anything about focus.
  await page.waitForSelector('text=Powiązane obiekty', { timeout: 60000 });
  results.focusTrace = await pollActiveElement(page, 8000, 200);
  results.ssLog = await page.evaluate(() => window.__ssLog);
  results.buttonStillPresent = await page.evaluate(() => {
    const el = document.querySelector('[data-cw-focus="obiekt:cwlink-ff42e7a0-0348-4f02-9d09-e55a691c22ff"]');
    return !!el;
  });
  await page.waitForTimeout(150); // let the manual outline paint settle
  await page.screenshot({ path: `${OUT}/keyboard-03-returned-focus-restored.png` });
  results.announcementAfterBack = await page.evaluate(
    () => document.querySelector('[role="status"][aria-live="polite"]')?.textContent || null
  );

  // ── Refresh survives, tested in isolation (no race with the focus poll
  // above — this is a SEPARATE reload after the return cycle is long done).
  await page.waitForTimeout(1000);
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=Powiązane obiekty', { timeout: 60000 });
  await page.locator('text=Powiązane obiekty').scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  results.urlAfterRefresh = page.url();
  await page.screenshot({ path: `${OUT}/refresh-01-results-tab-survived.png` });
  results.refreshedRows = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button[aria-label^="Otwórz obiekt"]')).map((b) => ({
      label: b.getAttribute('aria-label'),
      disabled: b.disabled,
    }))
  );

  await browser.close();
  fs.writeFileSync(`${OUT}/keyboard-results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
})().catch((err) => {
  console.error('EVIDENCE_KEYBOARD_V2_FAILED', err);
  process.exit(1);
});
