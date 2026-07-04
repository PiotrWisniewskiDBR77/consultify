/**
 * deckChartAdapter (P2.3) — data-bound deck chart spec normalization.
 *
 * Proves: (1) each authoring shape → the correct discriminated spec type;
 * (2) fail-open — missing/garbage data → `null` (renderer draws nothing, no
 * placeholder, no throw).
 */
import { describe, expect, it } from 'vitest';

import {
  adaptChartBlockContent,
  type CartesianSpec,
  type HarveySpec,
  type Matrix2x2Spec,
  type MarimekkoSpec,
  type PieSpec,
  type RagSpec,
  type WaterfallSpec,
} from '@/components/Presentations/DeckBuilder/blocks/deckChartAdapter';

describe('deckChartAdapter — cartesian shapes', () => {
  it('series+data shape → bar spec with categories padded to series length', () => {
    const spec = adaptChartBlockContent({
      chartType: 'bar',
      title: 'Dojrzałość',
      series: [
        { name: 'VTS', data: [3, 2, 4] },
        { name: 'Rynek', data: [4, 4, 4] },
      ],
    }) as CartesianSpec;
    expect(spec.type).toBe('bar');
    expect(spec.series).toHaveLength(2);
    expect(spec.categories).toHaveLength(3); // auto-filled 1,2,3
    expect(spec.series[0].values).toEqual([3, 2, 4]);
  });

  it('legacy data:[{label,value}] shape → single-series bar', () => {
    const spec = adaptChartBlockContent({
      chartType: 'bar',
      data: [
        { label: 'Q1', value: 42 },
        { label: 'Q2', value: 58 },
      ],
    }) as CartesianSpec;
    expect(spec.type).toBe('bar');
    expect(spec.categories).toEqual(['Q1', 'Q2']);
    expect(spec.series[0].values).toEqual([42, 58]);
  });

  it('line chartType maps to line spec', () => {
    const spec = adaptChartBlockContent({
      chartType: 'line',
      series: [{ name: 'Adopcja', data: [66, 63, 61] }],
    }) as CartesianSpec;
    expect(spec.type).toBe('line');
  });

  it('unknown cartesian kind degrades to bar', () => {
    const spec = adaptChartBlockContent({
      chartType: 'scatter',
      series: [{ name: 'x', data: [1, 2] }],
    }) as CartesianSpec;
    expect(spec.type).toBe('bar');
  });
});

describe('deckChartAdapter — pie / donut', () => {
  it('pie → slices from first series', () => {
    const spec = adaptChartBlockContent({
      chartType: 'pie',
      categories: ['A', 'B', 'C'],
      series: [{ name: 'Udział', data: [50, 30, 20] }],
    }) as PieSpec;
    expect(spec.type).toBe('pie');
    expect(spec.slices).toEqual([
      { name: 'A', value: 50 },
      { name: 'B', value: 30 },
      { name: 'C', value: 20 },
    ]);
  });
});

describe('deckChartAdapter — advanced consulting archetypes', () => {
  it('waterfall → floating bars with running totals + domain', () => {
    const spec = adaptChartBlockContent({
      chartType: 'waterfall',
      items: [
        { label: 'Start', value: 100, isTotal: true },
        { label: 'Wzrost', value: 40 },
        { label: 'Spadek', value: -25 },
        { label: 'Koniec', value: 115, isTotal: true },
      ],
    }) as WaterfallSpec;
    expect(spec.type).toBe('waterfall');
    expect(spec.bars).toHaveLength(4);
    expect(spec.bars[1].kind).toBe('increase');
    expect(spec.bars[2].kind).toBe('decrease');
    expect(spec.bars[0].kind).toBe('total');
    expect(spec.domain.max).toBeGreaterThanOrEqual(140);
  });

  it('matrix_2x2 → points assigned to quadrants around auto-midpoints', () => {
    const spec = adaptChartBlockContent({
      chartType: 'matrix_2x2',
      points: [
        { label: 'A', x: 9, y: 9 },
        { label: 'B', x: 1, y: 1 },
      ],
    }) as Matrix2x2Spec;
    expect(spec.type).toBe('matrix_2x2');
    expect(spec.points[0].quadrant).toBe('Q1'); // top-right
    expect(spec.points[1].quadrant).toBe('Q3'); // bottom-left
  });

  it('rag → status classified from thresholds (higher is better)', () => {
    const spec = adaptChartBlockContent({
      chartType: 'rag',
      thresholds: { green: 80, amber: 50 },
      items: [
        { label: 'Ok', value: 90 },
        { label: 'Watch', value: 60 },
        { label: 'Bad', value: 20 },
      ],
    }) as RagSpec;
    expect(spec.type).toBe('rag');
    expect(spec.items.map((i) => i.status)).toEqual(['green', 'amber', 'red']);
  });

  it('rag → explicit status wins over thresholds', () => {
    const spec = adaptChartBlockContent({
      chartType: 'rag',
      items: [{ label: 'Forced', value: 10, status: 'green' }],
    }) as RagSpec;
    expect(spec.items[0].status).toBe('green');
  });

  it('marimekko → normalized rects summing shares, segment names collected', () => {
    const spec = adaptChartBlockContent({
      chartType: 'marimekko',
      columns: [
        { label: 'Seg A', segments: [{ name: 'X', value: 30 }, { name: 'Y', value: 10 }] },
        { label: 'Seg B', segments: [{ name: 'X', value: 40 }, { name: 'Y', value: 20 }] },
      ],
    }) as MarimekkoSpec;
    expect(spec.type).toBe('marimekko');
    expect(spec.columnBounds).toHaveLength(2);
    expect(spec.segmentNames).toEqual(['X', 'Y']);
    const totalW = spec.columnBounds.reduce((s, c) => s + c.w, 0);
    expect(totalW).toBeCloseTo(1, 5);
  });

  it('harvey_balls → levels clamped to 0..4 with fill fraction', () => {
    const spec = adaptChartBlockContent({
      chartType: 'harvey_balls',
      rows: [
        { label: 'Pełny', level: 9 },
        { label: 'Połowa', level: 2 },
        { label: 'Pusty', level: -1 },
      ],
    }) as HarveySpec;
    expect(spec.type).toBe('harvey_balls');
    expect(spec.balls.map((b) => b.level)).toEqual([4, 2, 0]);
    expect(spec.balls[1].fillFraction).toBeCloseTo(0.5);
  });
});

describe('deckChartAdapter — fail-open (renders NOTHING, never throws)', () => {
  it('null / undefined / primitive → null', () => {
    expect(adaptChartBlockContent(null)).toBeNull();
    expect(adaptChartBlockContent(undefined)).toBeNull();
    expect(adaptChartBlockContent(42)).toBeNull();
    expect(adaptChartBlockContent('bar')).toBeNull();
  });

  it('chart block with no data arrays → null', () => {
    expect(adaptChartBlockContent({ chartType: 'bar', title: 'Empty' })).toBeNull();
    expect(adaptChartBlockContent({ chartType: 'line', series: [] })).toBeNull();
    expect(adaptChartBlockContent({ chartType: 'pie', data: [] })).toBeNull();
  });

  it('series present but all values non-numeric → null', () => {
    expect(
      adaptChartBlockContent({ chartType: 'bar', series: [{ name: 's', data: ['a', 'b'] }] })
    ).toBeNull();
  });

  it('waterfall with <2 usable items → null', () => {
    expect(
      adaptChartBlockContent({ chartType: 'waterfall', items: [{ label: 'only', value: 5 }] })
    ).toBeNull();
  });

  it('advanced types with empty/garbage payloads → null', () => {
    expect(adaptChartBlockContent({ chartType: 'rag', items: [] })).toBeNull();
    expect(adaptChartBlockContent({ chartType: 'matrix_2x2', points: [{ label: 'x' }] })).toBeNull();
    expect(adaptChartBlockContent({ chartType: 'marimekko', columns: [] })).toBeNull();
    expect(adaptChartBlockContent({ chartType: 'harvey_balls', rows: [{ label: 'x' }] })).toBeNull();
  });

  it('never throws on deeply malformed input', () => {
    expect(() =>
      adaptChartBlockContent({ chartType: 'bar', series: [null, { data: [Infinity, NaN] }] })
    ).not.toThrow();
    expect(
      adaptChartBlockContent({ chartType: 'bar', series: [null, { data: [Infinity, NaN] }] })
    ).toBeNull();
  });
});
