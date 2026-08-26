// Tools > Insights/Outputs i18n + date-format fix (2026-08-27) evidence
// capture. Wzór: scripts/dev/fixc-screenshots.mjs (fresh context per shot).
//
// Usage: node scripts/dev/tools-insights-i18n-screenshots.mjs <outdir>
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.TOOLS_INSIGHTS_BASE_URL || 'http://localhost:4711';
const OUT =
  process.argv[2] ||
  '/private/tmp/consultify-tools-i18n/docs/program/waves/WAVE_03_ACCEPTANCE/evidence/tools-batch1-20260826';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, theme, openKebab) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  const url = `${BASE}/tools-outputs-insights-tab.html?theme=${theme}&lang=pl`;
  console.log('navigating', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  // Wait for the table rows to actually render (mock data resolves async).
  await page.waitForSelector('text=Dynamic SWOT', { timeout: 15000 });
  await page.waitForTimeout(500);
  if (openKebab) {
    // Row menu (kebab) trigger for the "Dynamic SWOT" row — last cell button.
    const row = page.locator('tr', { hasText: 'Dynamic SWOT' });
    await row.locator('button').last().click();
    await page.waitForTimeout(300);
  }
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
  await context.close();
}

await shoot('01-light', 'light', false);
await shoot('02-dark', 'dark', false);
await shoot('03-dark-kebab', 'dark', true);

await browser.close();
console.log('DONE');
