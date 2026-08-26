import type { ChartConfiguration } from 'chart.js';
import { afterEach, describe, expect, it } from 'vitest';

import { __setChartCanvasCtorForTest, renderChartBlockToPng } from '../documentChartRasterizer.js';
import type { DocumentBlock } from '../documentStudioTypes.js';

const RADAR_BLOCK: DocumentBlock = {
  blockId: 'day32-radar',
  type: 'chart',
  content: {
    kind: 'radar',
    title: 'Profil dojrzałości DRD',
    categories: [
      'Procesy Cyfrowe',
      'Produkty Cyfrowe',
      'Modele Biznesowe',
      'Dane i analityka',
      'Technologie i infrastruktura',
      'Organizacja i kompetencje',
      'Strategia cyfrowa',
    ],
    series: [
      { label: 'Poziom obecny', values: [20, 40, 60, 35, 55, 45, 30], color: '#0C447C' },
      { label: 'Poziom docelowy', values: [70, 75, 80, 65, 85, 70, 75], color: '#1D9E75' },
    ],
  },
};

afterEach(() => __setChartCanvasCtorForTest(undefined));

describe('Day 32 — radar chart without an office suite', () => {
  it('passes the canonical radar configuration to chart.js', async () => {
    let captured: ChartConfiguration | null = null;
    class FakeChartCanvas {
      constructor(_options: { width: number; height: number; backgroundColour: string }) {}
      async renderToBuffer(configuration: ChartConfiguration): Promise<Buffer> {
        captured = configuration;
        return Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      }
    }
    __setChartCanvasCtorForTest(FakeChartCanvas);

    await expect(renderChartBlockToPng(RADAR_BLOCK)).resolves.toBeTruthy();
    expect(captured?.type).toBe('radar');
    expect(captured?.data.datasets).toHaveLength(2);
    expect(captured?.data.labels).toHaveLength(7);
    expect((captured?.options?.scales?.r as { min?: number; max?: number }).min).toBe(0);
    expect((captured?.options?.scales?.r as { min?: number; max?: number }).max).toBe(100);
    expect(captured?.options?.plugins?.legend?.position).toBe('bottom');
  });

  it('uses the production @napi-rs/canvas path to emit real PNG bytes', async () => {
    __setChartCanvasCtorForTest(undefined);
    const png = await renderChartBlockToPng(RADAR_BLOCK);
    expect(png).not.toBeNull();
    expect(png?.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
    expect(png?.length).toBeGreaterThan(10_000);
  });
});
