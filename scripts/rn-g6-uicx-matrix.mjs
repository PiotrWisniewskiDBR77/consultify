// RN-G6-MATRIX — headless Playwright sweep over KPI/ROI/OKR (registry + full
// tool) covering roles, states, presentation variants, and a11y signals.
// Against a REAL backend (port from RN_G6_BACKEND_URL) + REAL frontend
// (RN_G6_FRONTEND_URL) + the shared Postgres described in
// docs/product/results-vnext/RN_G6_RUNTIME_ENVIRONMENT.md.
//
// SAFETY: this script never clicks any state-mutating action (Suspend/
// Archive/Approve/Submit/etc.) — the seeded dataset is shared with other
// concurrent lanes on the same Postgres instance and mutating it would break
// their fixtures. It only navigates, reads, and (for the network-timeout
// probe) intercepts its OWN page's requests via page.route, which has no
// effect on the server or other sessions.
//
// Usage: node scripts/rn-g6-uicx-matrix.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RN_G6_FRONTEND_URL || 'http://localhost:3201';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-uicx');
fs.mkdirSync(OUT_DIR, { recursive: true });

const PASSWORD = 'RnG6Runtime!2026';
const USERS = {
  ownerA: 'rn-g6-user-a-owner@consultify.local',
  adminA: 'rn-g6-user-a-admin@consultify.local',
  contributorA: 'rn-g6-user-a-contributor@consultify.local',
  reviewerA: 'rn-g6-user-a-reviewer@consultify.local',
  outsiderA: 'rn-g6-user-a-outsider@consultify.local',
  adminB: 'rn-g6-user-b-admin@consultify.local',
};

// Real IDs, queried live from the shared Postgres just before this run
// (see agent transcript) — org A unless noted.
const IDS = {
  kpiActive1: '4d5db4f2-454e-4813-8813-4d5db4454ebd', // KPI-A-001 active
  kpiActive2: '4d5db4f3-454e-4813-8813-4d5db4454ebd', // KPI-A-002 active
  kpiDraft: '4d5db4f4-454e-4813-8813-4d5db4454ebd', // KPI-A-003 draft
  kpiPending: '4d5db4f5-454e-4813-8813-4d5db4454ebd', // KPI-A-004 pending_approval
  kpiSuspended: '4d5db4f6-454e-4813-8813-4d5db4454ebd', // KPI-A-005 suspended
  kpiArchived: '4d5db4f7-454e-4813-8813-4d5db4454ebd', // KPI-A-006 archived
  scorecard: 'a7a84b5c-cfae-4680-8680-a7a84bcfaea3',
  roiModeling: '4d60dfca-463e-4b5e-8b5e-4d60df463e9a', // Build Case, not_calculable-ish (no run)
  roiApproved: '4d60dfcb-463e-4b5e-8b5e-4d60df463e9a', // Decision
  roiTracking: '4d60dfcc-463e-4b5e-8b5e-4d60df463e9a', // Realize Value
  roiPir: '4d60dfcd-463e-4b5e-8b5e-4d60df463e9a', // Learn / post_investment_review
  roiChangesRequested: '4d60dfce-463e-4b5e-8b5e-4d60df463e9a', // not_calculable literal
  roiClosed: '4d60dfcf-463e-4b5e-8b5e-4d60df463e9a', // locked/terminal
  okrSetActive: 'f772dd20-6d67-49a1-89a1-f772dd6d67ca', // watch, 58%
  okrSetDraft: '87e7cc9e-4ace-4b11-bc31-75e63e792712', // not_calculable
  okrSetClosed: '644a4ebd-828e-486f-8a24-c0e6c0319913', // locked/terminal
  notFound: '00000000-0000-0000-0000-000000000000',
};

const report = { generatedAt: new Date().toISOString(), base: BASE, sections: {} };

function initErrCollectors(page) {
  const consoleErrors = [];
  const netErrors = [];
  const allNet = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));
  page.on('response', (resp) => {
    try {
      const url = resp.url();
      if (url.includes('/api/')) {
        allNet.push({ url, status: resp.status() });
        if (resp.status() >= 400) netErrors.push({ url, status: resp.status() });
      }
    } catch {}
  });
  return { consoleErrors, netErrors, allNet };
}

async function login(page, email) {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 }).catch(() => {});
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  // Login CTA text is locale-dependent ("Log in" EN / "Zaloguj się" PL) —
  // match the submit button structurally instead of by English text so this
  // works when a variant forces PL via localStorage before first paint.
  const submitBtn = page.locator('form button[type="submit"], button[type="submit"]').first();
  await submitBtn.click({ timeout: 15000 });
  await page.waitForTimeout(3000);
}

async function waitForRootRender(page, timeoutMs = 20000) {
  const start = Date.now();
  let len = 0;
  while (Date.now() - start < timeoutMs) {
    len = await page.evaluate(() => document.getElementById('root')?.innerHTML.length || 0).catch(() => 0);
    if (len > 500) return len;
    await page.waitForTimeout(500);
  }
  return len;
}

async function shot(page, name) {
  const p = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: p });
  return p;
}

async function dismissOnboarding(page) {
  const skipBtn = page.locator('button:has-text("Skip for now")');
  if (await skipBtn.count().catch(() => 0)) {
    try {
      await skipBtn.first().click({ timeout: 2000 });
      await page.waitForTimeout(1000);
    } catch {}
  }
}

// ---------------------------------------------------------------------------
// SECTION 1 — Role matrix: who reaches /results/*
// ---------------------------------------------------------------------------
async function runRoleMatrix(browser) {
  const results = [];
  for (const [key, email] of Object.entries(USERS)) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { consoleErrors, netErrors } = initErrCollectors(page);
    await login(page, email);
    await page.goto(`${BASE}/results/kpi?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' });
    await waitForRootRender(page, 15000);
    await dismissOnboarding(page);
    await page.waitForTimeout(1500);
    const finalPath = await page.evaluate(() => window.location.pathname);
    const shotPath = await shot(page, `role-${key}`);
    results.push({
      user: key,
      email,
      finalPath,
      reachedResults: finalPath.startsWith('/results'),
      screenshot: shotPath,
      consoleErrors: [...consoleErrors],
      netErrors: [...netErrors],
    });
    await context.close();
  }
  report.sections.roleMatrix = results;
  console.log('role matrix done');
}

// ---------------------------------------------------------------------------
// SECTION 2 — presentation variants (dark/light, PL/EN, viewports, zoom)
// ---------------------------------------------------------------------------
async function newPreparedContext(browser, { viewport, theme, lang } = {}) {
  const context = await browser.newContext({ viewport: viewport || { width: 1440, height: 900 } });
  await context.addInitScript(
    ({ theme, lang }) => {
      if (theme) {
        localStorage.setItem('consultify-storage', JSON.stringify({ state: { theme }, version: 2 }));
      }
      if (lang) {
        localStorage.setItem('i18nextLng', lang);
      }
    },
    { theme, lang }
  );
  const page = await context.newPage();
  return { context, page };
}

async function runPresentationMatrix(browser) {
  const variants = [
    { name: 'kpi-1440-light-pl', path: '/results/kpi?ff_resultsVNextKpi=1', viewport: { width: 1440, height: 900 }, theme: 'light', lang: 'pl' },
    { name: 'kpi-1440-dark-pl', path: '/results/kpi?ff_resultsVNextKpi=1', viewport: { width: 1440, height: 900 }, theme: 'dark', lang: 'pl' },
    { name: 'kpi-1440-dark-en', path: '/results/kpi?ff_resultsVNextKpi=1', viewport: { width: 1440, height: 900 }, theme: 'dark', lang: 'en' },
    { name: 'kpi-1280-dark-pl', path: '/results/kpi?ff_resultsVNextKpi=1', viewport: { width: 1280, height: 720 }, theme: 'dark', lang: 'pl' },
    { name: 'kpi-1600-dark-pl', path: '/results/kpi?ff_resultsVNextKpi=1', viewport: { width: 1600, height: 900 }, theme: 'dark', lang: 'pl' },
    { name: 'kpi-1920-dark-pl', path: '/results/kpi?ff_resultsVNextKpi=1', viewport: { width: 1920, height: 1080 }, theme: 'dark', lang: 'pl' },
    { name: 'kpi-tablet-dark-pl', path: '/results/kpi?ff_resultsVNextKpi=1', viewport: { width: 768, height: 1024 }, theme: 'dark', lang: 'pl' },
    { name: 'roi-1440-light-pl', path: '/results/roi?ff_resultsVNextRoi=1', viewport: { width: 1440, height: 900 }, theme: 'light', lang: 'pl' },
    { name: 'roi-1440-dark-en', path: '/results/roi?ff_resultsVNextRoi=1', viewport: { width: 1440, height: 900 }, theme: 'dark', lang: 'en' },
    { name: 'okr-1440-light-pl', path: '/results/okr?ff_resultsVNextOkr=1', viewport: { width: 1440, height: 900 }, theme: 'light', lang: 'pl' },
    { name: 'okr-1440-dark-en', path: '/results/okr?ff_resultsVNextOkr=1', viewport: { width: 1440, height: 900 }, theme: 'dark', lang: 'en' },
  ];
  const results = [];
  for (const v of variants) {
    const { context, page } = await newPreparedContext(browser, v);
    const { consoleErrors, netErrors } = initErrCollectors(page);
    await login(page, USERS.adminA);
    await page.goto(`${BASE}${v.path}`, { waitUntil: 'domcontentloaded' });
    await waitForRootRender(page, 20000);
    await dismissOnboarding(page);
    await page.waitForTimeout(1500);
    const shotPath = await shot(page, v.name);
    results.push({ ...v, screenshot: shotPath, consoleErrors: [...consoleErrors], netErrors: [...netErrors] });
    await context.close();
  }

  // 125% zoom emulation (Playwright has no true browser-zoom; approximate via
  // deviceScaleFactor is a raster-only change, so we use CSS zoom on the
  // document element on a 1280x720 viewport, which is the closest DOM-level
  // analogue and what the task's "1280 + 125%" combination is checking for
  // (long PL labels colliding at reduced effective width). Documented as an
  // approximation, not real OS/browser zoom.
  {
    const { context, page } = await newPreparedContext(browser, {
      viewport: { width: 1280, height: 720 },
      theme: 'dark',
      lang: 'pl',
    });
    const { consoleErrors, netErrors } = initErrCollectors(page);
    await login(page, USERS.adminA);
    await page.goto(`${BASE}/results/kpi?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' });
    await waitForRootRender(page, 20000);
    await dismissOnboarding(page);
    await page.evaluate(() => {
      document.documentElement.style.zoom = '1.25';
    });
    await page.waitForTimeout(800);
    const shotPath = await shot(page, 'kpi-1280-125pct-dark-pl');
    results.push({
      name: 'kpi-1280-125pct-dark-pl',
      note: 'CSS zoom approximation, not real OS zoom',
      screenshot: shotPath,
      consoleErrors: [...consoleErrors],
      netErrors: [...netErrors],
    });
    await context.close();
  }

  report.sections.presentationMatrix = results;
  console.log('presentation matrix done');
}

// ---------------------------------------------------------------------------
// SECTION 3 — state matrix (per domain: various lifecycle states + not-found
// + empty + empty-after-filter)
// ---------------------------------------------------------------------------
async function runStateMatrix(browser) {
  const routes = [
    // KPI
    { name: 'kpi-full-active', path: `/results/kpi/${IDS.kpiActive1}?ff_resultsVNextKpi=1` },
    { name: 'kpi-full-draft', path: `/results/kpi/${IDS.kpiDraft}?ff_resultsVNextKpi=1` },
    { name: 'kpi-full-pending', path: `/results/kpi/${IDS.kpiPending}?ff_resultsVNextKpi=1` },
    { name: 'kpi-full-suspended', path: `/results/kpi/${IDS.kpiSuspended}?ff_resultsVNextKpi=1` },
    { name: 'kpi-full-archived', path: `/results/kpi/${IDS.kpiArchived}?ff_resultsVNextKpi=1` },
    { name: 'kpi-scorecard', path: `/results/kpi/scorecards/${IDS.scorecard}?ff_resultsVNextKpi=1` },
    { name: 'kpi-not-found', path: `/results/kpi/${IDS.notFound}?ff_resultsVNextKpi=1` },
    // ROI
    { name: 'roi-full-modeling', path: `/results/roi/cases/${IDS.roiModeling}?ff_resultsVNextRoi=1` },
    { name: 'roi-full-approved', path: `/results/roi/cases/${IDS.roiApproved}?ff_resultsVNextRoi=1` },
    { name: 'roi-full-tracking', path: `/results/roi/cases/${IDS.roiTracking}?ff_resultsVNextRoi=1` },
    { name: 'roi-full-pir', path: `/results/roi/cases/${IDS.roiPir}?ff_resultsVNextRoi=1` },
    { name: 'roi-full-changes-requested', path: `/results/roi/cases/${IDS.roiChangesRequested}?ff_resultsVNextRoi=1` },
    { name: 'roi-full-closed-locked', path: `/results/roi/cases/${IDS.roiClosed}?ff_resultsVNextRoi=1` },
    { name: 'roi-not-found', path: `/results/roi/cases/${IDS.notFound}?ff_resultsVNextRoi=1` },
    // OKR
    { name: 'okr-full-active-watch', path: `/results/okr/sets/${IDS.okrSetActive}?ff_resultsVNextOkr=1` },
    { name: 'okr-full-draft-notcalc', path: `/results/okr/sets/${IDS.okrSetDraft}?ff_resultsVNextOkr=1` },
    { name: 'okr-full-closed-locked', path: `/results/okr/sets/${IDS.okrSetClosed}?ff_resultsVNextOkr=1` },
    { name: 'okr-not-found', path: `/results/okr/sets/${IDS.notFound}?ff_resultsVNextOkr=1` },
    // empty / empty-after-filter (org B admin — light dataset)
    { name: 'kpi-empty-orgB-my-tab', path: '/results/kpi?ff_resultsVNextKpi=1', user: 'adminB' },
    { name: 'okr-empty-orgB', path: '/results/okr?ff_resultsVNextOkr=1', user: 'adminB' },
  ];
  const results = [];
  for (const r of routes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { consoleErrors, netErrors, allNet } = initErrCollectors(page);
    await login(page, USERS[r.user || 'adminA']);
    await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded' });
    await waitForRootRender(page, 20000);
    await dismissOnboarding(page);
    await page.waitForTimeout(1500);
    const finalPath = await page.evaluate(() => window.location.pathname);
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));
    const shotPath = await shot(page, r.name);
    results.push({
      name: r.name,
      requestedPath: r.path,
      finalPath,
      redirected: finalPath.split('?')[0] !== r.path.split('?')[0],
      screenshot: shotPath,
      bodyTextSnippet: bodyText,
      consoleErrors: [...consoleErrors],
      netErrors: [...netErrors],
      apiCallCount: allNet.length,
    });
    await context.close();
  }
  report.sections.stateMatrix = results;
  console.log('state matrix done');
}

// ---------------------------------------------------------------------------
// SECTION 4 — network-timeout / error+retry probe via page.route (own page
// only, no server/data mutation)
// ---------------------------------------------------------------------------
async function runNetworkFaultProbe(browser) {
  const results = [];
  // 4a. Simulated slow network (delay all /api/vnext/results responses 8s)
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { consoleErrors } = initErrCollectors(page);
    await login(page, USERS.adminA);
    await page.route('**/api/vnext/results/**', async (route) => {
      await new Promise((res) => setTimeout(res, 8000));
      await route.continue();
    });
    const t0 = Date.now();
    page.goto(`${BASE}/results/kpi?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(1500);
    const midShot = await shot(page, 'kpi-network-delay-inflight');
    await page.waitForTimeout(8000);
    const finalShot = await shot(page, 'kpi-network-delay-resolved');
    results.push({
      name: 'network-delay-8s',
      elapsedMs: Date.now() - t0,
      midFlightScreenshot: midShot,
      resolvedScreenshot: finalShot,
      consoleErrors: [...consoleErrors],
    });
    await context.close();
  }
  // 4b. Simulated hard failure (abort all /api/vnext/results/kpi requests) —
  // error state + retry button, if any.
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { consoleErrors } = initErrCollectors(page);
    await login(page, USERS.adminA);
    await page.route('**/api/vnext/results/kpi**', (route) => route.abort('failed'));
    await page.goto(`${BASE}/results/kpi?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForTimeout(4000);
    const shotPath = await shot(page, 'kpi-network-abort-error-state');
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 600));
    // look for a retry affordance
    const retryBtn = page.locator('button:has-text("Retry"), button:has-text("Ponów"), button:has-text("Spróbuj")');
    const hasRetry = (await retryBtn.count().catch(() => 0)) > 0;
    let retryResult = null;
    if (hasRetry) {
      await page.unroute('**/api/vnext/results/kpi**');
      try {
        await retryBtn.first().click({ timeout: 2000 });
        await page.waitForTimeout(3000);
        retryResult = await shot(page, 'kpi-network-abort-retry-succeeded');
      } catch (e) {
        retryResult = 'retry click failed: ' + e.message;
      }
    }
    results.push({
      name: 'network-abort-error-and-retry',
      screenshot: shotPath,
      bodyTextSnippet: bodyText,
      hasRetryButton: hasRetry,
      retryResult,
      consoleErrors: [...consoleErrors],
    });
    await context.close();
  }
  report.sections.networkFaultProbe = results;
  console.log('network fault probe done');
}

// ---------------------------------------------------------------------------
// SECTION 5 — accessibility signals (aria-sort, roles, icon-button names,
// aria-live, composited contrast for a sample of text/background pairs)
// ---------------------------------------------------------------------------
function relLuminance([r, g, b]) {
  const srgb = [r, g, b].map((c) => {
    const cs = c / 255;
    return cs <= 0.04045 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
function contrastRatio(rgb1, rgb2) {
  const L1 = relLuminance(rgb1);
  const L2 = relLuminance(rgb2);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function runAccessibilityProbe(browser) {
  const { context, page } = await newPreparedContext(browser, {
    viewport: { width: 1440, height: 900 },
    theme: 'dark',
    lang: 'pl',
  });
  await login(page, USERS.adminA);
  await page.goto(`${BASE}/results/kpi?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' });
  await waitForRootRender(page, 20000);
  await dismissOnboarding(page);
  const orgTab = page.locator('button:has-text("Org")').first();
  if (await orgTab.count().catch(() => 0)) {
    await orgTab.click().catch(() => {});
    await page.waitForTimeout(1200);
  }

  const domSignals = await page.evaluate(() => {
    const out = {};
    out.tableRoleCount = document.querySelectorAll('[role="table"], table').length;
    out.tabsRoleCount = document.querySelectorAll('[role="tablist"], [role="tab"]').length;
    out.menuRoleCount = document.querySelectorAll('[role="menu"], [role="menuitem"]').length;
    out.dialogRoleCount = document.querySelectorAll('[role="dialog"]').length;
    out.ariaSortEls = Array.from(document.querySelectorAll('[aria-sort]')).map((el) => ({
      text: el.textContent?.trim().slice(0, 40),
      ariaSort: el.getAttribute('aria-sort'),
    }));
    out.ariaLiveEls = Array.from(document.querySelectorAll('[aria-live]')).map((el) => ({
      text: el.textContent?.trim().slice(0, 60),
      ariaLive: el.getAttribute('aria-live'),
    }));
    // icon-only buttons: buttons whose visible text is empty
    const iconButtons = Array.from(document.querySelectorAll('button')).filter((b) => {
      const text = b.textContent?.trim();
      return !text; // no visible text -> icon-only
    });
    out.iconOnlyButtonsTotal = iconButtons.length;
    out.iconOnlyButtonsWithAccessibleName = iconButtons.filter(
      (b) => b.getAttribute('aria-label') || b.getAttribute('title') || b.querySelector('[aria-hidden="false"]')
    ).length;
    out.iconOnlyButtonsMissingName = iconButtons
      .filter((b) => !b.getAttribute('aria-label') && !b.getAttribute('title'))
      .slice(0, 10)
      .map((b) => b.outerHTML.slice(0, 150));
    return out;
  });

  // Contrast on composited background for a sample of elements: status
  // badges + primary table text + focus ring color if visible.
  const contrastSample = await page.evaluate(() => {
    function parseColor(str) {
      const m = str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const parts = m[1].split(',').map((s) => parseFloat(s.trim()));
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 ? parts[3] : 1 };
    }
    function compositedBg(el) {
      let node = el;
      let acc = { r: 255, g: 255, b: 255 }; // fallback white canvas
      const stack = [];
      while (node) {
        const cs = getComputedStyle(node);
        const bg = parseColor(cs.backgroundColor || 'rgba(0,0,0,0)');
        if (bg && bg.a > 0) stack.push(bg);
        node = node.parentElement;
      }
      // composite from topmost ancestor down to element (reverse order)
      for (let i = stack.length - 1; i >= 0; i--) {
        const c = stack[i];
        acc = {
          r: c.r * c.a + acc.r * (1 - c.a),
          g: c.g * c.a + acc.g * (1 - c.a),
          b: c.b * c.a + acc.b * (1 - c.a),
        };
      }
      return [acc.r, acc.g, acc.b];
    }
    const results = [];
    const candidates = Array.from(
      document.querySelectorAll('td, th, button, [class*="badge"], [class*="status"]')
    ).slice(0, 400);
    const seenTexts = new Set();
    for (const el of candidates) {
      const text = el.textContent?.trim();
      if (!text || text.length > 30 || seenTexts.has(text)) continue;
      const cs = getComputedStyle(el);
      const fg = parseColor(cs.color);
      if (!fg) continue;
      const bg = compositedBg(el);
      seenTexts.add(text);
      results.push({ text, fg: [fg.r, fg.g, fg.b], bg: bg.map((v) => Math.round(v)) });
      if (results.length >= 25) break;
    }
    return results;
  });

  const contrastResults = contrastSample.map((s) => ({
    text: s.text,
    fg: s.fg,
    bgComposited: s.bg,
    ratio: Number(contrastRatio(s.fg, s.bg).toFixed(2)),
    passesAA_normalText: contrastRatio(s.fg, s.bg) >= 4.5,
    passesAA_largeText: contrastRatio(s.fg, s.bg) >= 3.0,
  }));

  const shotPath = await shot(page, 'a11y-kpi-registry-org-tab');
  report.sections.accessibility = { domSignals, contrastResults, screenshot: shotPath };
  await context.close();
  console.log('accessibility probe done');
}

// ---------------------------------------------------------------------------
// SECTION 6 — keyboard-only interaction probe (tab, Enter, Esc, focus return)
// ---------------------------------------------------------------------------
async function runKeyboardProbe(browser) {
  const { context, page } = await newPreparedContext(browser, {
    viewport: { width: 1440, height: 900 },
    theme: 'dark',
    lang: 'pl',
  });
  const { consoleErrors } = initErrCollectors(page);
  await login(page, USERS.adminA);
  await page.goto(`${BASE}/results/kpi?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' });
  await waitForRootRender(page, 20000);
  await dismissOnboarding(page);
  const orgTab = page.locator('button:has-text("Org")').first();
  await orgTab.click().catch(() => {});
  await page.waitForTimeout(1200);

  const findings = {};

  // Try to focus the first data row via Tab traversal (bounded attempts)
  let focusedRowText = null;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tag: el?.tagName,
        text: el?.textContent?.trim().slice(0, 40),
        role: el?.getAttribute('role'),
        row: el?.closest('tr') ? el.closest('tr').textContent?.trim().slice(0, 40) : null,
      };
    });
    if (info.row && /KPI-/.test(info.row)) {
      focusedRowText = info;
      break;
    }
  }
  findings.keyboardReachedRow = focusedRowText;

  if (focusedRowText) {
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);
    const afterEnterPath = await page.evaluate(() => window.location.pathname);
    findings.enterNavigated = afterEnterPath.includes('/results/kpi/');
    findings.afterEnterPath = afterEnterPath;
    findings.afterEnterScreenshot = await shot(page, 'kbd-after-enter-full-tool');

    // Esc once from full tool (no modal open) — should be a no-op or single
    // layer collapse if a layer is open; record behavior either way.
    const beforeEscPath = afterEnterPath;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    const afterEscPath = await page.evaluate(() => window.location.pathname);
    findings.escFromFullToolNoLayer = { beforeEscPath, afterEscPath, changed: beforeEscPath !== afterEscPath };
  }

  findings.consoleErrors = [...consoleErrors];
  const shotPath = await shot(page, 'kbd-final-state');
  report.sections.keyboardProbe = { ...findings, screenshot: shotPath };
  await context.close();
  console.log('keyboard probe done');
}

// ---------------------------------------------------------------------------
// SECTION 7 — cold deep-link probe (fresh context, no prior nav, straight to
// a specific object URL)
// ---------------------------------------------------------------------------
async function runColdDeepLinkProbe(browser) {
  const targets = [
    { name: 'cold-deep-link-kpi-pending', path: `/results/kpi/${IDS.kpiPending}?ff_resultsVNextKpi=1` },
    { name: 'cold-deep-link-roi-tracking', path: `/results/roi/cases/${IDS.roiTracking}?ff_resultsVNextRoi=1` },
    { name: 'cold-deep-link-okr-active', path: `/results/okr/sets/${IDS.okrSetActive}?ff_resultsVNextOkr=1` },
  ];
  const results = [];
  for (const t of targets) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const { consoleErrors, netErrors } = initErrCollectors(page);
    // Log in via API first (fresh context has no session), then go straight
    // to the deep link in one navigation (not via clicking through registry).
    await login(page, USERS.adminA);
    await page.goto(`${BASE}${t.path}`, { waitUntil: 'domcontentloaded' });
    await waitForRootRender(page, 20000);
    await dismissOnboarding(page);
    await page.waitForTimeout(1500);
    const finalPath = await page.evaluate(() => window.location.pathname);
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 300));
    const shotPath = await shot(page, t.name);
    results.push({
      name: t.name,
      requestedPath: t.path,
      finalPath,
      openedCorrectObject: finalPath.split('?')[0] === t.path.split('?')[0],
      bodyTextSnippet: bodyText,
      screenshot: shotPath,
      consoleErrors: [...consoleErrors],
      netErrors: [...netErrors],
    });
    await context.close();
  }
  report.sections.coldDeepLink = results;
  console.log('cold deep link probe done');
}

// ---------------------------------------------------------------------------
async function main() {
  const browser = await chromium.launch();
  const existing = fs.existsSync(path.join(OUT_DIR, 'uicx-report.json'))
    ? JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'uicx-report.json'), 'utf8'))
    : null;
  if (process.env.RN_G6_SKIP_ROLE_MATRIX === '1' && existing?.sections?.roleMatrix) {
    report.sections.roleMatrix = existing.sections.roleMatrix;
    console.log('role matrix skipped (reused prior result)');
  } else {
    await runRoleMatrix(browser);
  }
  fs.writeFileSync(path.join(OUT_DIR, 'uicx-report.json'), JSON.stringify(report, null, 2));
  await runPresentationMatrix(browser);
  fs.writeFileSync(path.join(OUT_DIR, 'uicx-report.json'), JSON.stringify(report, null, 2));
  await runStateMatrix(browser);
  fs.writeFileSync(path.join(OUT_DIR, 'uicx-report.json'), JSON.stringify(report, null, 2));
  await runNetworkFaultProbe(browser);
  fs.writeFileSync(path.join(OUT_DIR, 'uicx-report.json'), JSON.stringify(report, null, 2));
  await runAccessibilityProbe(browser);
  fs.writeFileSync(path.join(OUT_DIR, 'uicx-report.json'), JSON.stringify(report, null, 2));
  await runKeyboardProbe(browser);
  fs.writeFileSync(path.join(OUT_DIR, 'uicx-report.json'), JSON.stringify(report, null, 2));
  await runColdDeepLinkProbe(browser);
  fs.writeFileSync(path.join(OUT_DIR, 'uicx-report.json'), JSON.stringify(report, null, 2));
  await browser.close();
  console.log('ALL DONE');
}

main().catch((e) => {
  console.error(e);
  fs.writeFileSync(path.join(OUT_DIR, 'uicx-report.json'), JSON.stringify(report, null, 2));
  process.exit(1);
});
