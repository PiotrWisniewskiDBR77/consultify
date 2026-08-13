// RN-G6-C3 — persisted-state screenshot proof for the OKR gold flow.
//
// This does NOT replay all 20 steps interactively (those were driven live
// through the MCP Browser pane against the real backend/DB, see
// RN_G6_C3_OKR_GOLD_FLOW.md for the full narrative + psql readbacks). This
// script captures disk-persisted PNG proof of the FINAL, already-mutated
// state for the highest-value checkpoints, since the interactive tool's
// screenshots are inline-only (not written to disk) — same rationale as
// scripts/rn-g6-smoke-screenshot.mjs (RN-G6 runtime doc §7.3: headless
// Playwright is the reliable path for persisted screenshots in this repo).
//
// Usage (backend on :3099, frontend on :3298 already up — see
// RN_G6_C3_OKR_GOLD_FLOW.md §0 for the exact start commands used this run):
//   node scripts/rn-g6-okr-gold-flow-proof.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.RN_G6_FRONTEND_URL || 'http://localhost:3298';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-okr');
fs.mkdirSync(OUT_DIR, { recursive: true });

const SET_A = '644a4ebd-828e-486f-8a24-c0e6c0319913'; // RN-G6 C3 Gold Flow — closed
const SET_B = '87e7cc9e-4ace-4b11-bc31-75e63e792712'; // not_calculable-at-objective-level demo
const OBJ_A = 'd3ee2786-9db9-4dcf-ac98-f7358573d779';

const checkpoints = [
  { name: '01-registry', path: '/results/okr?ff_resultsVNextOkr=1', wait: 2500 },
  { name: '02-set-a-overview-closed', path: `/results/okr/sets/${SET_A}?ff_resultsVNextOkr=1`, wait: 2000 },
  { name: '03-set-a-objectives-key-results', path: `/results/okr/sets/${SET_A}?ff_resultsVNextOkr=1`, wait: 2000, tab: 'Objectives & Key Results' },
  { name: '04-set-a-alignment', path: `/results/okr/sets/${SET_A}?ff_resultsVNextOkr=1`, wait: 2000, tab: 'Alignment' },
  { name: '05-set-a-conversations-support', path: `/results/okr/sets/${SET_A}?ff_resultsVNextOkr=1`, wait: 2000, tab: 'Conversations & Support' },
  { name: '06-set-a-review-reflection', path: `/results/okr/sets/${SET_A}?ff_resultsVNextOkr=1`, wait: 2000, tab: 'Review & Reflection' },
  { name: '07-set-a-history', path: `/results/okr/sets/${SET_A}?ff_resultsVNextOkr=1`, wait: 2000, tab: 'History' },
  { name: '08-set-b-not-calculable-objective', path: `/results/okr/sets/${SET_B}?ff_resultsVNextOkr=1`, wait: 2000, tab: 'Objectives & Key Results' },
  { name: '09-programs-flag-preserved', path: '/results/okr/programs?ff_resultsVNextOkr=1', wait: 2000 },
  { name: '10-cycles-flag-preserved', path: '/results/okr/cycles?ff_resultsVNextOkr=1', wait: 2000 },
];

const report = { checkpoints: [] };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();

const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
page.on('pageerror', (err) => consoleErrors.push('PAGEERROR: ' + err.message));

await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 }).catch(() => {});
await page.locator('input').first().fill('rn-g6-user-a-owner@consultify.local');
await page.locator('input[type="password"]').first().fill('RnG6Runtime!2026');
await page.locator('button:has-text("Log in")').first().click();
await page.waitForTimeout(3000);

for (const cp of checkpoints) {
  consoleErrors.length = 0;
  const netStatuses = [];
  const listener = (resp) => {
    try {
      const url = resp.url();
      if (url.includes('/api/')) netStatuses.push({ url, status: resp.status() });
    } catch {}
  };
  page.on('response', listener);

  await page.goto(`${BASE}${cp.path}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(cp.wait);

  if (cp.tab) {
    const tabBtn = page.locator(`button:has-text("${cp.tab}")`).first();
    if (await tabBtn.count().catch(() => 0)) {
      try {
        await tabBtn.click({ timeout: 3000 });
        await page.waitForTimeout(1200);
      } catch {}
    }
  }

  const shotPath = `${OUT_DIR}/${cp.name}.png`;
  await page.screenshot({ path: shotPath, fullPage: false });

  page.off('response', listener);
  const errCount = netStatuses.filter((s) => s.status >= 400).length;
  report.checkpoints.push({
    name: cp.name,
    path: cp.path,
    tab: cp.tab ?? null,
    finalUrl: page.url(),
    screenshot: shotPath,
    consoleErrors: [...consoleErrors],
    apiErrorCount: errCount,
    apiErrors: netStatuses.filter((s) => s.status >= 400),
  });
}

await browser.close();
fs.writeFileSync(`${OUT_DIR}/gold-flow-proof-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
