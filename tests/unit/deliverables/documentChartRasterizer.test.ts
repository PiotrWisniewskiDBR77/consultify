// @vitest-environment node
/**
 * Unit tests — documentChartRasterizer (X3, W5 / Seria X)
 *
 * Kontrakt rasteryzera `renderChartBlockToPng`:
 *   - 6 typów: bar / line / pie / donut / scatter / area
 *   - fallback null gdy chartjs-node-canvas niedostępny lub block malformed
 *   - opcje width/height honorowane
 *
 * CI scope: ten plik w `tests/unit/` (CI bierze tylko tests/{unit,integration,components}).
 * Istnieje też test integracyjny pod `server/src/services/documentStudio/__tests__/`
 * (documentChartRenderQa.test.ts, DOCX/PDF + QA findings), ale ten katalog jest
 * POZA CI scope (per memory finding_ci_skips_src_tests).
 *
 * Mocks:
 *   - chartjs-node-canvas → controlled per test (renderToBuffer success/fail/missing)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  DocumentBlock,
  DocumentChartKind,
} from '../../../server/src/services/documentStudio/documentStudioTypes.js';

// chartjs-node-canvas mock — kontrolowany per test
const renderToBuffer = vi.fn();
class FakeChartCanvas {
  constructor(_opts: any) {}
  renderToBuffer = renderToBuffer;
}

vi.mock('chartjs-node-canvas', () => ({
  ChartJSNodeCanvas: FakeChartCanvas,
}));


function mkChartBlock(
  kind: DocumentChartKind,
  overrides: Partial<{
    title: string;
    series: Array<{ label: string; values: number[]; color?: string }>;
    categories: string[];
    xAxisLabel: string;
    yAxisLabel: string;
  }> = {}
): DocumentBlock {
  return {
    blockId: `block-${kind}`,
    type: 'chart',
    content: {
      kind,
      title: overrides.title ?? `Test ${kind}`,
      series: overrides.series ?? [
        { label: 'A', values: [10, 20, 30] },
        { label: 'B', values: [15, 25, 35] },
      ],
      categories: overrides.categories ?? ['Q1', 'Q2', 'Q3'],
      xAxisLabel: overrides.xAxisLabel,
      yAxisLabel: overrides.yAxisLabel,
    },
  } as DocumentBlock;
}

describe('documentChartRasterizer (X3)', () => {
  let renderChartBlockToPng: typeof import('../../../server/src/services/documentStudio/documentChartRasterizer.js').renderChartBlockToPng;

  beforeEach(async () => {
    vi.resetModules();
    renderToBuffer.mockReset();
    renderToBuffer.mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])); // PNG magic
    const mod = await import(
      '../../../server/src/services/documentStudio/documentChartRasterizer.js'
    );
    renderChartBlockToPng = mod.renderChartBlockToPng;
    // Wstrzyknij kontrolowany ctor (FakeChartCanvas z mockiem renderToBuffer) —
    // omija realny @napi-rs/canvas, którego vitest nie mockuje na dynamic-import.
    (mod as unknown as { __setChartCanvasCtorForTest: (c: unknown) => void })
      .__setChartCanvasCtorForTest(FakeChartCanvas);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 — 6 typów wykresów
  // ──────────────────────────────────────────────────────────────

  it.each<DocumentChartKind>(['bar', 'line', 'pie', 'donut', 'scatter', 'area'])(
    'FT-1: renders %s chart → non-empty PNG buffer',
    async (kind) => {
      const block = mkChartBlock(kind);
      const png = await renderChartBlockToPng(block);

      expect(png).not.toBeNull();
      expect(png).toBeInstanceOf(Buffer);
      expect(png!.length).toBeGreaterThan(0);
    }
  );

  it('FT-1/7: chart.js config maps donut → "doughnut" type (chart.js naming)', async () => {
    const block = mkChartBlock('donut');
    await renderChartBlockToPng(block);

    expect(renderToBuffer).toHaveBeenCalledOnce();
    const config = renderToBuffer.mock.calls[0][0];
    expect(config.type).toBe('doughnut');
  });

  it('FT-1/8: area chart maps to type=line with fill=origin in datasets', async () => {
    const block = mkChartBlock('area');
    await renderChartBlockToPng(block);

    const config = renderToBuffer.mock.calls[0][0];
    expect(config.type).toBe('line');
    expect(config.data.datasets[0].fill).toBe('origin');
  });

  // ──────────────────────────────────────────────────────────────
  // FT-1 — opcje width/height
  // ──────────────────────────────────────────────────────────────

  it('FT-1/9: honors custom width/height (separate canvas instance)', async () => {
    const block = mkChartBlock('bar');
    const png = await renderChartBlockToPng(block, { width: 1280, height: 720 });

    expect(png).not.toBeNull();
    expect(renderToBuffer).toHaveBeenCalledOnce();
  });

  // ──────────────────────────────────────────────────────────────
  // FT-8 — fail-open / fallback paths
  // ──────────────────────────────────────────────────────────────

  it('FT-8/10: malformed block (wrong type) → returns null (no throw)', async () => {
    const malformed = { blockId: 'b', type: 'text', content: { text: 'hello' } } as any;
    const png = await renderChartBlockToPng(malformed);

    expect(png).toBeNull();
    expect(renderToBuffer).not.toHaveBeenCalled();
  });

  it('FT-8/11: empty series → returns null (no throw)', async () => {
    const block = mkChartBlock('bar', { series: [] });
    const png = await renderChartBlockToPng(block);

    expect(png).toBeNull();
    expect(renderToBuffer).not.toHaveBeenCalled();
  });

  it('FT-8/12: renderToBuffer throws → returns null (caught, no propagation)', async () => {
    renderToBuffer.mockRejectedValueOnce(new Error('canvas backend missing'));
    const block = mkChartBlock('line');

    const png = await renderChartBlockToPng(block);
    expect(png).toBeNull();
  });
});
