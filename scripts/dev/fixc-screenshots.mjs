// FIXC — PRZED/PO screenshot capture for the three dead-space-over-limit
// screens (Prediction, Analysis, Valuation/Source), at 1280x800 and
// 1440x900, light + dark. Wzór: scripts/dev/pkgf-baseline-screenshots.mjs,
// scripts/dev/apmount-screenshots.mjs — but with a FRESH browser context per
// screenshot (localStorage carries over navigations within a shared context
// and has already poisoned evidence once this session — session memory).
//
// Usage: node scripts/dev/fixc-screenshots.mjs <prefix> <outdir> [screenKeyFilter]
//   prefix — "PRZED" or "PO", used in the output filename.
//   outdir — directory to write PNGs into (created if missing).
//   screenKeyFilter — optional, one of prediction|analysis|valuation-source; restricts capture
//                     to that single screen so each screen's evidence can be committed on its own.
import fs from 'fs';
import { chromium } from 'playwright';

const BASE = process.env.FIXC_BASE_URL || 'http://localhost:58123';
const PREFIX = process.argv[2] || 'PO';
const OUT = process.argv[3] || '/Users/piotrwisniewski/consultify-wt/fv3p-d-statements/docs/validation/finance-v3/generated/gate-e/visual/fixc';
const SCREEN_FILTER = process.argv[4] || null;

fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { key: '1280', width: 1280, height: 800 },
  { key: '1440', width: 1440, height: 900 },
];

const ALL_SCREENS = [
  { key: 'prediction', screen: 'finance-prediction-workspace', params: '&mode=C' },
  { key: 'analysis', screen: 'finance-analysis-workspace', params: '&scene=draft-with-kpis' },
  { key: 'valuation-source', screen: 'finance-valuation-workspace', params: '&step=source' },
];
const screens = SCREEN_FILTER ? ALL_SCREENS.filter((s) => s.key === SCREEN_FILTER) : ALL_SCREENS;

const themes = ['light', 'dark'];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  for (const s of screens) {
    for (const theme of themes) {
      const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await context.newPage();
      const url = `${BASE}/?screen=${s.screen}&theme=${theme}${s.params || ''}`;
      console.log('navigating', url);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
      await page.waitForTimeout(2000);
      const path = `${OUT}/${PREFIX}-${s.key}-${vp.key}-${theme}.png`;
      await page.screenshot({ path, fullPage: false });
      console.log('saved', path);
      await context.close();
    }
  }
}

await browser.close();
console.log('DONE');
