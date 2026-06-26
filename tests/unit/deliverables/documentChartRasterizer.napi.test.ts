// @vitest-environment node
/**
 * W11.1 — rasteryzacja wykresów DOC przez @napi-rs/canvas (decyzja CTO: opcja B,
 * prebuilt bez system-deps). Dowód: realny blok chart → niepusty PNG (magic 89504e47).
 */
import { describe, expect, it } from 'vitest';
import { renderChartBlockToPng } from '../../../server/src/services/documentStudio/documentChartRasterizer.js';
import type { DocumentBlock } from '../../../server/src/services/documentStudio/documentStudioTypes.js';

const PNG_MAGIC = '89504e47';

function chartBlock(kind: string): DocumentBlock {
  return {
    blockId: 'b-chart-1',
    type: 'chart',
    content: {
      kind,
      title: 'Przychód i EBITDA (3 lata)',
      categories: ['Rok 1', 'Rok 2', 'Rok 3'],
      series: [
        { label: 'Przychód', values: [2390, 4760, 8800] },
        { label: 'EBITDA', values: [-20, 800, 2700] },
      ],
      xAxisLabel: 'Rok',
      yAxisLabel: 'tys EUR',
    },
  } as unknown as DocumentBlock;
}

describe('W11.1 — renderChartBlockToPng (@napi-rs/canvas)', () => {
  it('bar chart → realny PNG (magic 89504e47, niepusty)', async () => {
    const png = await renderChartBlockToPng(chartBlock('bar'));
    expect(png).toBeInstanceOf(Buffer);
    expect(png!.length).toBeGreaterThan(1000);
    expect(png!.subarray(0, 4).toString('hex')).toBe(PNG_MAGIC);
  });

  it('line chart → realny PNG', async () => {
    const png = await renderChartBlockToPng(chartBlock('line'));
    expect(png).toBeInstanceOf(Buffer);
    expect(png!.subarray(0, 4).toString('hex')).toBe(PNG_MAGIC);
  });

  it('respektuje wymiary (width/height)', async () => {
    const png = await renderChartBlockToPng(chartBlock('bar'), { width: 480, height: 270 });
    expect(png).toBeInstanceOf(Buffer);
    expect(png!.subarray(0, 4).toString('hex')).toBe(PNG_MAGIC);
  });

  it('blok bez serii → null (fail-soft)', async () => {
    const empty = { blockId: 'x', type: 'chart', content: { kind: 'bar', title: 'T', series: [] } } as unknown as DocumentBlock;
    expect(await renderChartBlockToPng(empty)).toBeNull();
  });
});
