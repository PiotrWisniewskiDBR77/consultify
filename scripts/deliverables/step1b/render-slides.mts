/**
 * STEP 1b — render the VTS fixture to PNG, BEFORE (heuristic) vs AFTER (composition),
 * one 1280×720 16:9 frame per slide per mode, using the REAL CardRenderer via a
 * throwaway Vite dev server + Playwright chromium. No API keys, no backend, no DB.
 *
 * Output: docs/qa/deliverables/runs/2026-07-04-step1b/png/slide<N>_<before|after>.png
 *
 * RUN:  node --import tsx scripts/deliverables/step1b/render-slides.mts
 * (requires: playwright chromium installed — `npx playwright install chromium`)
 */
import { createServer } from 'vite';
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

import { VTS_CARDS } from './fixture.vts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessDir = path.join(__dirname, 'harness');
const outDir = path.resolve(
  __dirname,
  '../../../docs/qa/deliverables/runs/2026-07-04-step1b/png'
);
mkdirSync(outDir, { recursive: true });

const PORT = 4321;
const N = VTS_CARDS.length;

(async () => {
  const server = await createServer({
    configFile: path.join(harnessDir, 'vite.harness.config.ts'),
    root: harnessDir,
    server: { port: PORT },
  });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}`;
  console.log(`[render] harness up at ${base}`);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });

  const shots: string[] = [];
  for (let slide = 0; slide < N; slide++) {
    for (const mode of ['before', 'after'] as const) {
      const url = `${base}/index.html?slide=${slide}&mode=${mode}`;
      await page.goto(url, { waitUntil: 'networkidle' });
      // Wait for harness readiness flag (fonts + two rAFs).
      await page.waitForFunction(
        () => (window as unknown as { __STEP1B_READY?: boolean }).__STEP1B_READY === true,
        { timeout: 15000 }
      );
      // Small settle for chart/layout.
      await page.waitForTimeout(300);
      const frame = page.locator('.slide-frame');
      const file = path.join(outDir, `slide${slide}_${mode}.png`);
      await frame.screenshot({ path: file });
      shots.push(file);
      console.log(`[render] slide ${slide} ${mode} → ${path.basename(file)}`);
    }
  }

  await browser.close();
  await server.close();
  console.log(`\n[render] wrote ${shots.length} PNG(s) to ${outDir}`);
  process.exit(0);
})().catch((err) => {
  console.error('[render] FAILED:', err);
  process.exit(1);
});
