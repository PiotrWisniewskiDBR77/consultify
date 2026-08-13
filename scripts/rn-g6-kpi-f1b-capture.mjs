// One-off evidence capture for F1B (maker-checker gate unusable for a real
// second-actor session) — logs in as admin, opens Org tab, selects
// KPI-G6-002, opens its row kebab menu to show the honest "No
// definition-version data in this session" reason next to disabled
// Approve/Reject, AND the preview panel's own Approve/Reject buttons which
// show NO reason at all (comparison of the two surfaces).
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3197';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'qa', 'screens', 'rn-g6-kpi');

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 30000 });
await page.locator('input[type="email"], input[name="email"]').first().fill('rn-g6-user-a-admin@consultify.local');
await page.locator('input[type="password"]').first().fill('RnG6Runtime!2026');
await page.locator('button:has-text("Log in")').first().click();
await page.waitForTimeout(2000);
await page.goto(`${BASE}/results/kpi?ff_resultsVNextKpi=1`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2000);
await page.locator('button:has-text("Org")').click();
await page.waitForTimeout(1000);
const row = page.locator('tr:has-text("KPI-G6-002")').first();
await row.click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT_DIR, '06a-reject-disabled-preview-panel-no-reason.png') });
const kebab = row.locator('button[aria-label="Row actions"], button:has-text("⋮")').first();
await row.hover();
const rowActionsBtn = page.locator('button[aria-label="Row actions"]').first();
await rowActionsBtn.click({ timeout: 5000 }).catch(async () => {
  // fallback: click the last button cell in the row
  await row.locator('button').last().click();
});
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(OUT_DIR, '06b-reject-disabled-kebab-honest-reason.png') });
console.log('done');
await browser.close();
