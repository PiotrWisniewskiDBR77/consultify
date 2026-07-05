/**
 * grow-content — render the VTS fixture to PNG, BEFORE (grow OFF = W7 rhythm
 * alone: small blocks, floating chart) vs AFTER (grow ON = hero metrics /
 * dashboard tiles / tall charts), one 1280×720 16:9 frame per slide per mode,
 * using the REAL CardRenderer via a throwaway Vite dev server + Playwright
 * chromium. No API keys, backend, or DB.
 *
 * Output: docs/qa/deliverables/runs/2026-07-05-grow-content/png/slide<N>_<before|after>.png
 *
 * RUN:  node --import tsx scripts/deliverables/grow-content/render-slides.mts
 * (requires: playwright chromium — `npx playwright install chromium`)
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { createServer } from 'vite';

import { VTS_CARDS } from '../w7/fixture.vts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessDir = path.join(__dirname, 'harness');
const outDir = path.resolve(
  __dirname,
  '../../../docs/qa/deliverables/runs/2026-07-05-grow-content/png'
);
mkdirSync(outDir, { recursive: true });

const PORT = 4326;
const N = VTS_CARDS.length;

/**
 * Prime vite's dep optimizer by requesting the entry module until it responds
 * quickly (i.e. pre-bundling finished). Avoids the first Playwright navigation
 * racing the cold recharts optimize and hanging past the goto timeout.
 */
async function warmup(base: string): Promise<void> {
  for (let i = 0; i < 30; i++) {
    try {
      const r = await fetch(`${base}/entry.tsx`);
      if (r.ok) {
        await r.text();
        break;
      }
    } catch {
      /* server still starting */
    }
    await new Promise((res) => setTimeout(res, 1000));
  }
  // Give the transitive graph (recharts) a beat to finish optimizing.
  await new Promise((res) => setTimeout(res, 6000));
}

(async () => {
  const server = await createServer({
    configFile: path.join(harnessDir, 'vite.harness.config.ts'),
    root: harnessDir,
    server: { port: PORT },
  });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}`;
  console.log(`[grow-render] harness up at ${base}`);
  // Warm vite's cold dep pre-bundle (recharts is heavy) BEFORE Playwright
  // navigates — otherwise the first goto races the optimizer and hangs.
  await warmup(base);

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });

  const shots: string[] = [];
  for (let slide = 0; slide < N; slide++) {
    for (const mode of ['before', 'after'] as const) {
      const url = `${base}/index.html?slide=${slide}&mode=${mode}`;
      // `load` (not `networkidle`): the first navigation triggers vite dep
      // pre-bundling (recharts is heavy) whose reload never settles to idle
      // inside the timeout; __GROW_READY is the real "layout settled" signal.
      await page.goto(url, { waitUntil: 'load' });
      await page.waitForFunction(
        () => (window as unknown as { __GROW_READY?: boolean }).__GROW_READY === true,
        { timeout: 30000 }
      );
      await page.waitForTimeout(300);
      const frame = page.locator('.slide-frame');
      const file = path.join(outDir, `slide${slide}_${mode}.png`);
      await frame.screenshot({ path: file });
      shots.push(file);
      console.log(`[grow-render] slide ${slide} ${mode} → ${path.basename(file)}`);
    }
  }

  await browser.close();
  await server.close();
  console.log(`\n[grow-render] wrote ${shots.length} PNG(s) to ${outDir}`);
  process.exit(0);
})().catch((err) => {
  console.error('[grow-render] FAILED:', err);
  process.exit(1);
});
