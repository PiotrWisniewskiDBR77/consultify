// RN-G6 — headless smoke pass over the three Results Next registry screens
// (KPI/ROI/OKR) against a real backend + real Postgres. Logs in as the
// seeded rn-g6-user-a-admin, opens each route with its feature flag on via
// `?ff_...=1`, dismisses the first-run "Meet Teresa" onboarding modal if it
// appears, and saves one screenshot + a combined console/network report per
// route. See docs/product/results-vnext/RN_G6_RUNTIME_ENVIRONMENT.md for the
// full runbook (start Postgres, migrate, seed, start backend+frontend) this
// script assumes is already running.
//
// Usage (from repo root, backend on :3097 and frontend on :3197 already up):
//   node scripts/rn-g6-smoke-screenshot.mjs
//
// Requires the `playwright` package with Chromium installed. This repo
// installs both under a sibling workspace, resolved automatically via normal
// node_modules resolution from this file's location — no extra setup needed
// if you can already run `npx playwright test` elsewhere in this workspace.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RN_G6_FRONTEND_URL || 'http://localhost:3197';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-runtime');
fs.mkdirSync(OUT_DIR, { recursive: true });

// RN-G6 B3 — real-routing inventory. IDs below come from the seed summary
// (deterministic `uid()` hashes — reproducible via `--wipe`), NOT re-queried
// live, so a route-not-found here can never be blamed on a stale ID lookup
// bug in this script itself.
const KPI_A_1 = process.env.RN_G6_KPI_A_1 || '4d5db4f2-454e-4813-8813-4d5db4454ebd';
const KPI_SCORECARD_A_1 = process.env.RN_G6_SCORECARD_A_1 || 'a7a84b5c-cfae-4680-8680-a7a84bcfaea3';
const ROI_CASE_A_2 = process.env.RN_G6_ROI_CASE_A_2 || '4d60dfcb-463e-4b5e-8b5e-4d60df463e9a';
const OKR_SET_A_1 = process.env.RN_G6_OKR_SET_A_1 || 'f772dd20-6d67-49a1-89a1-f772dd6d67ca';

const routes = [
  { name: 'kpi-registry', path: '/results/kpi?ff_resultsVNextKpi=1' },
  { name: 'kpi-tool', path: `/results/kpi/${KPI_A_1}?ff_resultsVNextKpi=1` },
  { name: 'kpi-scorecard', path: `/results/kpi/scorecards/${KPI_SCORECARD_A_1}?ff_resultsVNextKpi=1` },
  { name: 'roi-registry', path: '/results/roi?ff_resultsVNextRoi=1' },
  { name: 'roi-case', path: `/results/roi/cases/${ROI_CASE_A_2}?ff_resultsVNextRoi=1` },
  { name: 'okr-registry', path: '/results/okr?ff_resultsVNextOkr=1' },
  { name: 'okr-set', path: `/results/okr/sets/${OKR_SET_A_1}?ff_resultsVNextOkr=1` },
  // Real route is /results/attention (routeConfig.ts RESULTS_ATTENTION) —
  // gated behind BOTH kpiRegistry AND okrRegistry flags together
  // (ResultsAttentionPage.tsx). Mission brief said `/attention` (bare) —
  // checked separately below as `attention-bare` to confirm which one is
  // real, not assumed.
  { name: 'attention', path: '/results/attention?ff_resultsVNextKpi=1&ff_resultsVNextOkr=1' },
  { name: 'attention-bare', path: '/attention' },
];

const report = { routes: [] };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

// Login
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 }).catch(() => {});
const emailInput = page.locator('input').first();
await emailInput.fill('rn-g6-user-a-admin@consultify.local');
const passInput = page.locator('input[type="password"]').first();
await passInput.fill('RnG6Runtime!2026');
await page.locator('button:has-text("Log in")').first().click();
await page.waitForTimeout(3000);

for (const r of routes) {
  consoleErrors.length = 0;
  const netStatuses = [];
  const listener = (resp) => {
    try {
      const url = resp.url();
      if (url.includes('/api/')) netStatuses.push({ url, status: resp.status() });
    } catch {}
  };
  page.on('response', listener);

  await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(8000);

  // Dismiss onboarding modal if present
  const skipBtn = page.locator('button:has-text("Skip for now")');
  if (await skipBtn.count().catch(() => 0)) {
    try {
      await skipBtn.first().click({ timeout: 2000 });
      await page.waitForTimeout(1500);
      // Re-navigate since Skip may redirect away
      await page.goto(`${BASE}${r.path}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(4000);
    } catch {}
  }

  if (r.name === 'kpi-registry') {
    const orgTab = page.locator('button:has-text("Org")').first();
    if (await orgTab.count().catch(() => 0)) {
      try {
        await orgTab.click({ timeout: 2000 });
        await page.waitForTimeout(1500);
      } catch {}
    }
  }

  const shotPath = `${OUT_DIR}/${r.name}.png`;
  await page.screenshot({ path: shotPath, fullPage: false });

  const rootInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    const bodyText = document.body ? document.body.innerText : '';
    return {
      rootInnerHtmlLength: root ? root.innerHTML.length : 0,
      bodyTextSnippet: bodyText.slice(0, 400),
      finalUrl: window.location.pathname + window.location.search,
    };
  });

  page.off('response', listener);
  const errCount = netStatuses.filter((s) => s.status >= 400).length;
  const redirectedAway = rootInfo.finalUrl.split('?')[0] !== r.path.split('?')[0];
  report.routes.push({
    name: r.name,
    requestedPath: r.path,
    finalUrl: page.url(),
    finalPath: rootInfo.finalUrl,
    redirectedAway,
    screenshot: shotPath,
    rootInnerHtmlLength: rootInfo.rootInnerHtmlLength,
    bodyTextSnippet: rootInfo.bodyTextSnippet,
    consoleErrors: [...consoleErrors],
    apiCalls: netStatuses,
    apiErrorCount: errCount,
  });
}

await browser.close();

fs.writeFileSync(`${OUT_DIR}/smoke-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
