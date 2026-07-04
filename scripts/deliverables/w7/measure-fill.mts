/**
 * W7 fill-canvas — DETERMINISTIC geometry proof (no API key, no vision model).
 *
 * For each slide, in BEFORE (fill OFF) and AFTER (fill ON) mode, measures the
 * rendered content's vertical footprint inside the 16:9 canvas:
 *   - the content padding box is the `.absolute.inset-0.p-8` wrapper (the usable
 *     area, canvas minus the p-8 margins),
 *   - top    = (first block top   − usableTop) / usableHeight
 *   - bottom = (last block bottom  − usableTop) / usableHeight
 *   - deadBottom = 1 − bottom      (fraction of usable height empty at the base)
 *   - deadTop    = top             (fraction empty at the top)
 *   - fill       = bottom − top    (fraction of usable height the content spans)
 *
 * DoD#2 (M17-DECK-PERFEKCJA): content fills ≥85% of usable height OR is
 * deliberately centered (balanced deadTop≈deadBottom). We report both so the
 * win is legible either way.
 *
 * Output JSON: docs/qa/deliverables/runs/2026-07-04-w7-fillcanvas/fill-geometry.json
 *
 * RUN:  node --import tsx scripts/deliverables/w7/measure-fill.mts
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';
import { createServer } from 'vite';

import { VTS_CARDS } from './fixture.vts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const harnessDir = path.join(__dirname, 'harness');
const runDir = path.resolve(
  __dirname,
  '../../../docs/qa/deliverables/runs/2026-07-04-w7-fillcanvas'
);
mkdirSync(runDir, { recursive: true });

const PORT = 4323;
const N = VTS_CARDS.length;

interface Geom {
  slide: number;
  variant?: string;
  intent: string;
  top: number;
  bottom: number;
  fill: number;
  deadTop: number;
  deadBottom: number;
}

(async () => {
  const server = await createServer({
    configFile: path.join(harnessDir, 'vite.harness.config.ts'),
    root: harnessDir,
    server: { port: PORT },
  });
  await server.listen();
  const base = `http://127.0.0.1:${PORT}`;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });

  const measure = async (): Promise<{ top: number; bottom: number } | null> =>
    page.evaluate(() => {
      const pad = document.querySelector('.slide-frame .absolute.inset-0') as HTMLElement | null;
      if (!pad) return null;
      const padRect = pad.getBoundingClientRect();
      // Content children = the flex column right under the padding wrapper.
      const col = pad.firstElementChild as HTMLElement | null;
      if (!col) return null;
      // Gather leaf block wrappers (the AnimatedBlock > div.relative.group nodes).
      const blocks = Array.from(col.querySelectorAll('.group')) as HTMLElement[];
      const rects = (blocks.length ? blocks : [col]).map((b) => b.getBoundingClientRect());
      const minTop = Math.min(...rects.map((r) => r.top));
      const maxBottom = Math.max(...rects.map((r) => r.bottom));
      return {
        top: (minTop - padRect.top) / padRect.height,
        bottom: (maxBottom - padRect.top) / padRect.height,
      };
    });

  const before: Geom[] = [];
  const after: Geom[] = [];

  for (let slide = 0; slide < N; slide++) {
    for (const mode of ['before', 'after'] as const) {
      await page.goto(`${base}/index.html?slide=${slide}&mode=${mode}`, { waitUntil: 'networkidle' });
      await page.waitForFunction(
        () => (window as unknown as { __W7_READY?: boolean }).__W7_READY === true,
        { timeout: 15000 }
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
        deadTop: m ? +m.top.toFixed(3) : NaN,
        deadBottom: m ? +(1 - m.bottom).toFixed(3) : NaN,
      };
      (mode === 'before' ? before : after).push(rec);
    }
  }

  await browser.close();
  await server.close();

  const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(3) : '  n/a');
  console.log('\n=== W7 fill-canvas — DETERMINISTIC geometry (fraction of usable height) ===');
  console.log('slide  variant          BEFORE[top→bottom  dead⊤/dead⊥]     AFTER[top→bottom  dead⊤/dead⊥]');
  for (let i = 0; i < N; i++) {
    const b = before[i];
    const a = after[i];
    console.log(
      `  ${i}   ${(b.variant || '').padEnd(15)}  ${fmt(b.top)}→${fmt(b.bottom)}  ${fmt(b.deadTop)}/${fmt(b.deadBottom)}   ${fmt(a.top)}→${fmt(a.bottom)}  ${fmt(a.deadTop)}/${fmt(a.deadBottom)}`
    );
  }
  const avg = (arr: Geom[], k: keyof Geom) =>
    arr.reduce((s, x) => s + (Number.isFinite(x[k] as number) ? (x[k] as number) : 0), 0) / arr.length;
  console.log(
    `\n  avg deadBottom  BEFORE=${avg(before, 'deadBottom').toFixed(3)}  AFTER=${avg(after, 'deadBottom').toFixed(3)}`
  );
  console.log(
    `  avg |deadTop−deadBottom| (asymmetry)  BEFORE=${(
      before.reduce((s, x) => s + Math.abs(x.deadTop - x.deadBottom), 0) / N
    ).toFixed(3)}  AFTER=${(after.reduce((s, x) => s + Math.abs(x.deadTop - x.deadBottom), 0) / N).toFixed(3)}`
  );

  writeFileSync(
    path.join(runDir, 'fill-geometry.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        note: 'Deterministic DOM geometry. deadBottom = fraction of usable height empty below content. asymmetry = |deadTop − deadBottom| (0 = perfectly centered). BEFORE = W7 off, AFTER = W7 on.',
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
  console.error('[w7-measure] FAILED:', err);
  process.exit(1);
});
