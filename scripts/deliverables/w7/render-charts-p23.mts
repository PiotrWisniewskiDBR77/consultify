/**
 * P2.3 chart proof — render the VTS fixture's chart-bearing slides (index 2 =
 * line trend, 4 = grouped bar) via the REAL CardRenderer + Vite + Playwright,
 * so the ChartBlock change (placeholder → data-bound recharts) is visible.
 *
 * Reuses the W7 harness (same entry/fixture). Output label comes from the
 * LABEL env var so the SAME script, run in the baseline worktree vs this one,
 * yields BEFORE (placeholder ChartBlock) and AFTER (data-bound) frames into
 * one shared run dir.
 *
 * RUN:  LABEL=after node --import tsx scripts/deliverables/w7/render-charts-p23.mts
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { createServer } from 'vite';

import { VTS_CARDS } from './fixture.vts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessDir = path.join(__dirname, 'harness');
const LABEL = (process.env.LABEL || 'after') === 'before' ? 'before' : 'after';
// Shared absolute run dir so both worktrees write to the SAME folder.
const outDir =
  process.env.OUT_DIR ||
  path.resolve(__dirname, '../../../docs/qa/deliverables/runs/2026-07-04-p23-charts/png');
mkdirSync(outDir, { recursive: true });

const PORT = Number(process.env.PORT || 4323);
const CHART_SLIDES = [2, 4]; // performance_overview (line), comparison (bar)

(async () => {
  const server = await createServer({
    configFile: path.join(harnessDir, 'vite.harness.config.ts'),
    root: harnessDir,
    server: { port: PORT },
  });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}`;
  console.log(`[p23-render] harness up at ${base} (label=${LABEL})`);

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
  page.setDefaultNavigationTimeout(120000);
  page.setDefaultTimeout(120000);

  const shots: string[] = [];
  for (const slide of CHART_SLIDES) {
    if (slide >= VTS_CARDS.length) continue;
    const url = `${base}/index.html?slide=${slide}&mode=after`;
    await page.goto(url, { waitUntil: 'commit' });
    await page.waitForFunction(
      () => (window as unknown as { __W7_READY?: boolean }).__W7_READY === true,
      { timeout: 15000 }
    );
    await page.waitForTimeout(500); // let recharts settle
    const file = path.join(outDir, `slide${slide}_${LABEL}.png`);
    await page.locator('.slide-frame').screenshot({ path: file });
    shots.push(file);
    console.log(`[p23-render] slide ${slide} ${LABEL} → ${path.basename(file)}`);
  }

  await browser.close();
  await server.close();
  console.log(`\n[p23-render] wrote ${shots.length} PNG(s) to ${outDir}`);
  process.exit(0);
})().catch((err) => {
  console.error('[p23-render] FAILED:', err);
  process.exit(1);
});
