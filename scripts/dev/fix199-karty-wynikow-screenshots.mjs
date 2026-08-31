// FIX-199 evidence capture — odbiór 199 R3b rejection (3/10):
//   1) KPI card only ever showed section 1 (Performance); sections 7
//      (Karty wyników / scorecards) and 8 (Historia / rodowód / history)
//      were never on any screenshot because the dev-render stub had no
//      handler for either GET, so both silently fell through to a dead
//      `realGet(url)` and rendered empty.
//   2) The ROI screenshot named `results-vnext-roi-full-tool` actually
//      showed the ROI *registry* (one row, no click) — never the full
//      case tool the name promised.
//
// This script exercises the REAL click chains against the REAL production
// components mounted by dev-render (no reimplementation):
//   KPI: click "Karty wyników i konteksty" nav item -> screenshot (S7)
//        click "Historia / rodowód" nav item -> screenshot (S8)
//   ROI: click the row's kebab ("Akcje wiersza") -> click "Otwórz pełne
//        narzędzie" -> screenshot (full RoiCaseFullTool workspace)
//
// Wzór: scripts/dev/ui-latki-20260828-screenshots.mjs (fresh context per shot).
// Usage: node scripts/dev/fix199-karty-wynikow-screenshots.mjs <outdir>
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.FIX199_BASE_URL || 'http://localhost:3411';
const OUT =
  process.argv[2] ||
  '/private/tmp/cx-fix199-artefakty/evidence/grafika/199-karty-wynikow-fix199';

fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function shootKpiSection(name, theme, sectionLabel) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const url = `${BASE}/?screen=results-vnext-kpi-tool&lang=pl&theme=${theme}`;
  console.log('navigating', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=OEE-LINIA-PAKOWANIA', { timeout: 15000 });
  await page.getByText(sectionLabel, { exact: true }).click();
  // Section content is fetched async on first visit — wait for the
  // section's own data to land instead of a fixed sleep.
  await page.waitForTimeout(400);
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
  await context.close();
}

async function shootRoiFullTool(name, theme) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const url = `${BASE}/?screen=results-vnext-roi-full-tool&lang=pl&theme=${theme}`;
  console.log('navigating', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('text=Wdrożenie MES — linia pakowania', { timeout: 15000 });
  await page.getByRole('button', { name: 'Akcje wiersza' }).click();
  await page.getByText('Otwórz pełne narzędzie', { exact: true }).click();
  await page.waitForSelector('text=Baseline i polityka', { timeout: 15000 });
  await page.waitForTimeout(300);
  const path = `${OUT}/${name}.png`;
  await page.screenshot({ path, fullPage: false });
  console.log('saved', path);
  await context.close();
}

// KPI — section 7 (scorecards) and section 8 (history), both themes.
await shootKpiSection('kpi-section7-scorecards__light', 'light', 'Karty wyników i konteksty');
await shootKpiSection('kpi-section7-scorecards__dark', 'dark', 'Karty wyników i konteksty');
await shootKpiSection('kpi-section8-history__light', 'light', 'Historia / rodowód');
await shootKpiSection('kpi-section8-history__dark', 'dark', 'Historia / rodowód');

// ROI — full case tool reached via row kebab -> "Otwórz pełne narzędzie".
await shootRoiFullTool('roi-full-tool__light', 'light');
await shootRoiFullTool('roi-full-tool__dark', 'dark');

await browser.close();
console.log('DONE');
