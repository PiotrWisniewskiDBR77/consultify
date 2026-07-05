/**
 * grow-content — DETERMINISTIC geometry proof (no API key, no vision model).
 *
 * W7 proved it could REMOVE the dead bottom by centering sparse content — but
 * centering whitespace is not filling it (W7 README: "sama redystrybucja przez
 * justify-content centruje pustkę, nie usuwa jej"). grow-content's job is to
 * make the dominant block BIGGER so it actually occupies the canvas. So the
 * metrics that matter here are:
 *
 *   - fill        = (content bottom − content top) / usableHeight
 *                   fraction of usable height the content actually SPANS. This is
 *                   the grow win: bigger blocks span more.
 *   - dominant    = tallest single block height / usableHeight
 *                   how much of the canvas the hero block occupies. A lone metric
 *                   / chart floating small has a small dominant; a grown one is
 *                   large.
 *   - deadBottom  = 1 − contentBottom   (kept for continuity with W7)
 *
 * Output JSON: docs/qa/deliverables/runs/2026-07-05-grow-content/fill-geometry.json
 *
 * RUN:  node --import tsx scripts/deliverables/grow-content/measure-fill.mts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { createServer } from 'vite';

import { VTS_CARDS } from '../w7/fixture.vts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessDir = path.join(__dirname, 'harness');
const runDir = path.resolve(
  __dirname,
  '../../../docs/qa/deliverables/runs/2026-07-05-grow-content'
);
mkdirSync(runDir, { recursive: true });

const PORT = 4327;
const N = VTS_CARDS.length;

/** See render-slides.mts — warm vite's cold dep pre-bundle before navigating. */
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
  await new Promise((res) => setTimeout(res, 6000));
}

interface Geom {
  slide: number;
  variant?: string;
  intent: string;
  top: number;
  bottom: number;
  fill: number;
  dominant: number;
  deadBottom: number;
  /** px height of the tallest chart plot area (recharts container). */
  chartPx: number;
  /** px font-size of the largest number rendered (hero metric). */
  heroPx: number;
}

(async () => {
  const server = await createServer({
    configFile: path.join(harnessDir, 'vite.harness.config.ts'),
    root: harnessDir,
    server: { port: PORT },
  });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}`;
  await warmup(base);
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });

  const measure = async (): Promise<{
    top: number;
    bottom: number;
    dominant: number;
    chartPx: number;
    heroPx: number;
  } | null> =>
    page.evaluate(() => {
      const pad = document.querySelector('.slide-frame .absolute.inset-0') as HTMLElement | null;
      if (!pad) return null;
      const padRect = pad.getBoundingClientRect();
      const col = pad.firstElementChild as HTMLElement | null;
      if (!col) return null;
      const blocks = Array.from(col.querySelectorAll('.group')) as HTMLElement[];
      const nodes = blocks.length ? blocks : [col];
      const rects = nodes.map((b) => b.getBoundingClientRect());
      const minTop = Math.min(...rects.map((r) => r.top));
      const maxBottom = Math.max(...rects.map((r) => r.bottom));
      const tallest = Math.max(...rects.map((r) => r.height));
      // Tallest chart plot area (recharts wrapper) — captures chart growth even
      // inside a grid cell, where the block bounding box is cell-bound.
      const charts = Array.from(
        document.querySelectorAll('.recharts-responsive-container, .recharts-wrapper')
      ) as HTMLElement[];
      const chartPx = charts.length
        ? Math.max(...charts.map((c) => c.getBoundingClientRect().height))
        : 0;
      // Largest rendered number font-size (hero metric).
      const numeric = Array.from(col.querySelectorAll('p, span')).filter((n) =>
        /\d/.test((n as HTMLElement).textContent || '')
      ) as HTMLElement[];
      const heroPx = numeric.length
        ? Math.max(...numeric.map((n) => parseFloat(getComputedStyle(n).fontSize) || 0))
        : 0;
      return {
        top: (minTop - padRect.top) / padRect.height,
        bottom: (maxBottom - padRect.top) / padRect.height,
        dominant: tallest / padRect.height,
        chartPx: +chartPx.toFixed(0),
        heroPx: +heroPx.toFixed(0),
      };
    });

  const before: Geom[] = [];
  const after: Geom[] = [];

  for (let slide = 0; slide < N; slide++) {
    for (const mode of ['before', 'after'] as const) {
      await page.goto(`${base}/index.html?slide=${slide}&mode=${mode}`, {
        waitUntil: 'load',
      });
      await page.waitForFunction(
        () => (window as unknown as { __GROW_READY?: boolean }).__GROW_READY === true,
        { timeout: 30000 }
      );
      await page.waitForTimeout(200);
      const m = await measure();
      const card = VTS_CARDS[slide];
      const rec: Geom = {
        slide,
        variant: card.composition?.layoutVariantId,
        intent: card.intent,
        top: m ? +m.top.toFixed(3) : NaN,
        bottom: m ? +m.bottom.toFixed(3) : NaN,
        fill: m ? +(m.bottom - m.top).toFixed(3) : NaN,
        dominant: m ? +m.dominant.toFixed(3) : NaN,
        deadBottom: m ? +(1 - m.bottom).toFixed(3) : NaN,
        chartPx: m ? m.chartPx : NaN,
        heroPx: m ? m.heroPx : NaN,
      };
      (mode === 'before' ? before : after).push(rec);
    }
  }

  await browser.close();
  await server.close();

  const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : '  n/a');
  console.log('\n=== grow-content — DETERMINISTIC geometry ===');
  console.log(
    'slide  variant          BEFORE[fill dom chartPx heroPx]   AFTER[fill dom chartPx heroPx]'
  );
  for (let i = 0; i < N; i++) {
    const b = before[i];
    const a = after[i];
    console.log(
      `  ${i}   ${(b.variant || '').padEnd(15)}  ${fmt(b.fill)} ${fmt(b.dominant)} ${String(b.chartPx).padStart(6)} ${String(b.heroPx).padStart(6)}   ${fmt(a.fill)} ${fmt(a.dominant)} ${String(a.chartPx).padStart(6)} ${String(a.heroPx).padStart(6)}`
    );
  }
  const avg = (arr: Geom[], k: keyof Geom) =>
    arr.reduce((s, x) => s + (Number.isFinite(x[k] as number) ? (x[k] as number) : 0), 0) /
    arr.length;
  console.log(
    `\n  avg fill      BEFORE=${avg(before, 'fill').toFixed(3)}  AFTER=${avg(after, 'fill').toFixed(3)}`
  );
  console.log(
    `  avg dominant  BEFORE=${avg(before, 'dominant').toFixed(3)}  AFTER=${avg(after, 'dominant').toFixed(3)}`
  );
  console.log(
    `  avg deadBottom BEFORE=${avg(before, 'deadBottom').toFixed(3)}  AFTER=${avg(after, 'deadBottom').toFixed(3)}`
  );
  console.log(
    `  avg chartPx   BEFORE=${avg(before, 'chartPx').toFixed(0)}  AFTER=${avg(after, 'chartPx').toFixed(0)}`
  );
  console.log(
    `  max heroPx    BEFORE=${Math.max(...before.map((x) => x.heroPx))}  AFTER=${Math.max(...after.map((x) => x.heroPx))}`
  );

  writeFileSync(
    path.join(runDir, 'fill-geometry.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note:
          'Deterministic DOM geometry. fill = fraction of usable height the content spans; dominant = tallest single block / usable height (grow makes hero blocks bigger); deadBottom = fraction empty below content. BEFORE = W7 rhythm alone (grow off), AFTER = grow on.',
        before,
        after,
      },
      null,
      2
    )
  );
  console.log(`\nwrote ${path.join(runDir, 'fill-geometry.json')}`);
  process.exit(0);
})().catch((err) => {
  console.error('[grow-measure] FAILED:', err);
  process.exit(1);
});
