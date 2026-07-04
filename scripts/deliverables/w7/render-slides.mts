/**
 * W7 fill-canvas — render the VTS fixture to PNG, BEFORE (W7 off = today's
 * top-glued layout) vs AFTER (W7 on = vertical rhythm + guard-split), one
 * 1280×720 16:9 frame per slide per mode, using the REAL CardRenderer via a
 * throwaway Vite dev server + Playwright chromium. No API keys, backend, or DB.
 *
 * Output: docs/qa/deliverables/runs/2026-07-04-w7-fillcanvas/png/slide<N>_<before|after>.png
 *
 * RUN:  node --import tsx scripts/deliverables/w7/render-slides.mts
 * (requires: playwright chromium — `npx playwright install chromium`)
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { createServer } from 'vite';

import { VTS_CARDS } from './fixture.vts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessDir = path.join(__dirname, 'harness');
const outDir = path.resolve(
  __dirname,
  '../../../docs/qa/deliverables/runs/2026-07-04-w7-fillcanvas/png'
);
mkdirSync(outDir, { recursive: true });

const PORT = 4322;
const N = VTS_CARDS.length;

(async () => {
  const server = await createServer({
    configFile: path.join(harnessDir, 'vite.harness.config.ts'),
    root: harnessDir,
    server: { port: PORT },
  });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}`;
  console.log(`[w7-render] harness up at ${base}`);

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
      await page.waitForFunction(
        () => (window as unknown as { __W7_READY?: boolean }).__W7_READY === true,
        { timeout: 15000 }
      );
      await page.waitForTimeout(300);
      const frame = page.locator('.slide-frame');
      const file = path.join(outDir, `slide${slide}_${mode}.png`);
      await frame.screenshot({ path: file });
      shots.push(file);
      console.log(`[w7-render] slide ${slide} ${mode} → ${path.basename(file)}`);
    }
  }

  await browser.close();
  await server.close();
  console.log(`\n[w7-render] wrote ${shots.length} PNG(s) to ${outDir}`);
  process.exit(0);
})().catch((err) => {
  console.error('[w7-render] FAILED:', err);
  process.exit(1);
});
