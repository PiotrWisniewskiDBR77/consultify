/**
 * PKG_H (Enterprise Valuation) — zrzuty ekranu <ValuationWorkspace> z dev-render harnessu, do
 * dowodu wizualnego w PKG_H_VALUATION_report.md (CLAUDE.md reguła #7).
 *
 * Wymaga uruchomionego dev-render na porcie z argv[2] (domyślnie 58033) — patrz .claude/launch.json
 * wpis "fv3p-h-valuation".
 *
 * node scripts/shot-pkg-h-valuation.mjs <katalog-wyjsciowy> [port]
 */
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = process.argv[2] || 'docs/validation/finance-v3/generated/gate-e/visual/pkg-h';
const PORT = process.argv[3] || '58033';
fs.mkdirSync(OUT, { recursive: true });

const STEPS = [
  ['source', 'source&sourceLinked=1', 'source-linked'],
  ['source', 'source&sourceLinked=0', 'source-unlinked-NEGCTRL'],
  ['assumptions', 'assumptions', 'assumptions-wacc-consistent'],
  ['methods', 'methods', 'methods-weights'],
  ['results', 'results', 'results-headline-and-range'],
  ['sensitivity', 'sensitivity', 'sensitivity-5x5-empty'],
  ['advisor', 'advisor', 'advisor-fact-vs-hypothesis'],
  ['export', 'export', 'export-honest-gap'],
];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

for (const [, qs, filename] of STEPS) {
  const url = `http://localhost:${PORT}/?screen=finance-valuation-workspace&step=${qs}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${filename}.png`, fullPage: false });
  console.log(`OK ${filename}.png`);
}

// Sensitivity — click "Wczytaj siatkę" to render the actual 5x5 grid (button-triggered load).
await page.goto(`http://localhost:${PORT}/?screen=finance-valuation-workspace&step=sensitivity`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.getByTestId('sensitivity-load-button').click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/sensitivity-5x5-loaded.png`, fullPage: false });
console.log('OK sensitivity-5x5-loaded.png');

await browser.close();
console.log('DONE');
