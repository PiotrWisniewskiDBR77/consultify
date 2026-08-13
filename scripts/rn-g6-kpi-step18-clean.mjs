// Clean re-capture of step 18 (org B admin, narrower/cross-org access,
// viewing org A's scorecard by direct URL) — the first run's screenshot was
// obscured by the first-run "Meet Teresa" onboarding modal.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3197';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-kpi');
const SCORECARD_ID = 'a7a84b5c-cfae-4680-8680-a7a84bcfaea3';

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const netCalls = [];
page.on('response', (r) => {
  if (r.url().includes('/api/')) netCalls.push({ url: r.url(), status: r.status() });
});
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
await page.locator('input[type="email"], input[name="email"]').first().fill('rn-g6-user-b-admin@consultify.local');
await page.locator('input[type="password"]').first().fill('RnG6Runtime!2026');
await page.locator('button:has-text("Log in")').first().click();
await page.waitForTimeout(2000);
await page.goto(`${BASE}/results/kpi/scorecards/${SCORECARD_ID}?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
const skipBtn = page.locator('button:has-text("Skip for now")');
if (await skipBtn.count().catch(() => 0)) {
  await skipBtn.first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/results/kpi/scorecards/${SCORECARD_ID}?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
}
await page.screenshot({ path: path.join(OUT_DIR, '18-narrower-reader-org-b-clean.png') });
console.log('final url:', page.url());
console.log('api calls:', JSON.stringify(netCalls.filter((c) => c.url.includes('scorecard')), null, 2));
await browser.close();
