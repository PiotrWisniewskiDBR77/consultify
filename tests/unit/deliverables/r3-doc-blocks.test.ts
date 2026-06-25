/**
 * @vitest-environment node
 *
 * FT-3 / R3 — Document Studio block renderer unit tests.
 *
 * Tests pure functions and data-transformation logic from:
 *   - docBlockContent.ts  (narrowChartContent, narrowTableContent, narrowKpiContent)
 *   - docChartPalette.ts  (clampPalette, colorAt, PALETTE_CAP)
 *
 * React rendering tests live in tests/components/DocumentStudio/blocks/.
 * These node-env tests cover the data layer without a DOM.
 */

import { describe, expect, it } from 'vitest';

import {
  narrowChartContent,
  narrowKpiContent,
  narrowTableContent,
} from '../../../src/components/DocumentStudio/blocks/docBlockContent';
import {
  HARVARD_CHART_PALETTE,
  PALETTE_CAP,
  clampPalette,
  colorAt,
} from '../../../src/components/DocumentStudio/blocks/docChartPalette';

// ---------------------------------------------------------------------------
// 1. narrowChartContent — kind mapping
// ---------------------------------------------------------------------------

describe('narrowChartContent — kind mapping', () => {
  it('maps "bar" kind correctly', () => {
    const result = narrowChartContent({ kind: 'bar', series: [{ label: 'A', values: [1, 2] }] });
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('bar');
  });

  it('maps "line" kind correctly', () => {
    const result = narrowChartContent({ kind: 'line', series: [{ label: 'A', values: [1, 2] }] });
    expect(result!.kind).toBe('line');
  });

  it('maps "pie" kind correctly', () => {
    const result = narrowChartContent({
      kind: 'pie',
      categories: ['A', 'B'],
      series: [{ label: 'slice', values: [10, 20] }],
    });
    expect(result!.kind).toBe('pie');
  });

  it('maps "area" kind correctly', () => {
    const result = narrowChartContent({ kind: 'area', series: [{ label: 'A', values: [1] }] });
    expect(result!.kind).toBe('area');
  });

  it('maps "donut" kind correctly', () => {
    const result = narrowChartContent({ kind: 'donut', series: [{ label: 'A', values: [1] }] });
    expect(result!.kind).toBe('donut');
  });

  it('maps alias "column" → "bar"', () => {
    const result = narrowChartContent({ kind: 'column', series: [{ label: 'A', values: [1] }] });
    expect(result!.kind).toBe('bar');
  });

  it('maps alias "doughnut" → "donut"', () => {
    const result = narrowChartContent({ kind: 'doughnut', series: [{ label: 'A', values: [1] }] });
    expect(result!.kind).toBe('donut');
  });

  it('unknown kind falls back to "bar" (no crash)', () => {
    const result = narrowChartContent({ kind: 'radar', series: [{ label: 'A', values: [5] }] });
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('bar');
  });
});

// ---------------------------------------------------------------------------
// 2. narrowTableContent — zebra/risk variants
// ---------------------------------------------------------------------------

describe('narrowTableContent — variants', () => {
  it('returns columns and rows from standard input', () => {
    const result = narrowTableContent({
      columns: ['Name', 'Score'],
      rows: [['Alice', '95'], ['Bob', '88']],
    });
    expect(result).not.toBeNull();
    expect(result!.columns).toEqual(['Name', 'Score']);
    expect(result!.rows).toHaveLength(2);
    expect(result!.riskSemantics).toBe(false);
  });

  it('sets riskSemantics=true when opts.riskSemantics=true', () => {
    const result = narrowTableContent(
      { columns: ['Risk', 'Impact'], rows: [['High', 'Critical']] },
      { riskSemantics: true }
    );
    expect(result!.riskSemantics).toBe(true);
  });

  it('sets riskSemantics=true from raw content flag', () => {
    const result = narrowTableContent({
      columns: ['Likelihood', 'Impact'],
      rows: [['High', 'Low']],
      riskSemantics: true,
    });
    expect(result!.riskSemantics).toBe(true);
  });

  it('sets riskSemantics=true from variant="risk"', () => {
    const result = narrowTableContent({
      columns: ['Col'],
      rows: [['val']],
      variant: 'risk',
    });
    expect(result!.riskSemantics).toBe(true);
  });

  it('tolerates dual key: "headers" instead of "columns"', () => {
    const result = narrowTableContent({
      headers: ['X', 'Y'],
      rows: [['1', '2']],
    });
    expect(result!.columns).toEqual(['X', 'Y']);
  });

  it('tolerates object-keyed rows (projects onto column order)', () => {
    const result = narrowTableContent({
      columns: ['name', 'value'],
      rows: [{ name: 'Alpha', value: '100' }],
    });
    expect(result!.rows[0]).toEqual(['Alpha', '100']);
  });

  it('returns null on empty input (no columns, no rows)', () => {
    const result = narrowTableContent({});
    expect(result).toBeNull();
  });

  it('returns null on non-object input', () => {
    expect(narrowTableContent(null)).toBeNull();
    expect(narrowTableContent('string')).toBeNull();
    expect(narrowTableContent(42)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 3. narrowKpiContent — dual-shape KPI (items vs columns+rows)
// ---------------------------------------------------------------------------

describe('narrowKpiContent — dual-shape KPI', () => {
  it('parses Shape A (items[]) with 2 KPI objects → 2 items', () => {
    const result = narrowKpiContent({
      items: [
        { label: 'Revenue', value: '$1M', delta: '+10%', trend: 'up' },
        { label: 'Churn', value: '2%', delta: '-0.5%', trend: 'down' },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0].label).toBe('Revenue');
    expect(result!.items[1].trend).toBe('down');
  });

  it('parses Shape B (columns+rows) — each row becomes one KPI item', () => {
    const result = narrowKpiContent({
      columns: ['Metric', 'Value', 'Change'],
      rows: [
        ['NPS', '72', '+4'],
        ['CSAT', '88%', '+2%'],
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0].label).toBe('NPS');
    expect(result!.items[0].value).toBe('72');
    expect(result!.items[0].delta).toBe('+4');
    expect(result!.items[1].label).toBe('CSAT');
  });

  it('returns null when content has no recoverable KPIs', () => {
    expect(narrowKpiContent({})).toBeNull();
    expect(narrowKpiContent(null)).toBeNull();
    expect(narrowKpiContent([])).toBeNull();
  });

  it('tolerates dual keys: "metrics" instead of "items"', () => {
    const result = narrowKpiContent({
      metrics: [{ label: 'ARR', value: '$5M' }],
    });
    expect(result).not.toBeNull();
    expect(result!.items).toHaveLength(1);
  });

  it('includes optional caption when present', () => {
    const result = narrowKpiContent({
      items: [{ label: 'X', value: '1' }],
      caption: 'Q4 2025 metrics',
    });
    expect(result!.caption).toBe('Q4 2025 metrics');
  });
});

// ---------------------------------------------------------------------------
// 4. clampPalette — Harvard palette constraint ≤7
// ---------------------------------------------------------------------------

describe('clampPalette — Harvard palette ≤7 constraint', () => {
  it('returns PALETTE_CAP=7 entries for large n', () => {
    expect(clampPalette(20)).toHaveLength(PALETTE_CAP);
    expect(clampPalette(100)).toHaveLength(PALETTE_CAP);
  });

  it('returns exactly n entries for n ≤ 7', () => {
    for (let n = 1; n <= 7; n++) {
      expect(clampPalette(n)).toHaveLength(n);
    }
  });

  it('always returns at least 1 entry for degenerate inputs', () => {
    // 0, negative, NaN, Infinity are all non-finite-positive → fall back to safe=1
    expect(clampPalette(0)).toHaveLength(1);
    expect(clampPalette(-5)).toHaveLength(1);
    expect(clampPalette(NaN)).toHaveLength(1);
    // Infinity is not Number.isFinite → treated as safe=1 as well
    expect(clampPalette(Infinity)).toHaveLength(1);
  });

  it('all returned colors are valid hex strings from the Harvard palette', () => {
    const palette = clampPalette(7);
    for (const color of palette) {
      expect(color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(HARVARD_CHART_PALETTE).toContain(color);
    }
  });

  it('PALETTE_CAP constant equals 7', () => {
    expect(PALETTE_CAP).toBe(7);
  });
});

// ---------------------------------------------------------------------------
// 5. colorAt — palette index wrapping
// ---------------------------------------------------------------------------

describe('colorAt', () => {
  it('returns the correct Harvard Crimson at index 0', () => {
    expect(colorAt(0)).toBe('#A51C30');
  });

  it('wraps at PALETTE_CAP (index 7 = index 0)', () => {
    expect(colorAt(7)).toBe(colorAt(0));
    expect(colorAt(14)).toBe(colorAt(0));
  });

  it('returns a valid hex string for any non-negative integer', () => {
    for (let i = 0; i < 20; i++) {
      expect(colorAt(i)).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('tolerates negative / NaN index → falls back to index 0', () => {
    expect(colorAt(-1)).toBe(colorAt(0));
    expect(colorAt(NaN)).toBe(colorAt(0));
  });
});

// ---------------------------------------------------------------------------
// 6. narrowChartContent — unknown block type / empty data graceful handling
// ---------------------------------------------------------------------------

describe('narrowChartContent — graceful degradation', () => {
  it('returns null for non-object input (no crash)', () => {
    expect(narrowChartContent(null)).toBeNull();
    expect(narrowChartContent(undefined)).toBeNull();
    expect(narrowChartContent('garbage')).toBeNull();
    expect(narrowChartContent(42)).toBeNull();
    expect(narrowChartContent([])).toBeNull();
  });

  it('returns null when series have no numeric data', () => {
    const result = narrowChartContent({ kind: 'bar', series: [] });
    expect(result).toBeNull();
  });

  it('handles missing categories gracefully (auto-numbers them)', () => {
    const result = narrowChartContent({
      kind: 'bar',
      series: [{ label: 'S', values: [10, 20, 30] }],
    });
    expect(result).not.toBeNull();
    // categories undefined → component will auto-number '1','2','3'
    expect(result!.categories).toBeUndefined();
  });

  it('handles flat data points shape as fallback series', () => {
    const result = narrowChartContent({
      data: [
        { name: 'Alpha', value: 10 },
        { name: 'Beta', value: 20 },
      ],
    });
    expect(result).not.toBeNull();
    expect(result!.series).toHaveLength(1);
    expect(result!.series[0].values).toEqual([10, 20]);
  });

  it('tolerates numeric-string values ("1 234,5") in series', () => {
    const result = narrowChartContent({
      kind: 'bar',
      series: [{ label: 'Rev', values: ['1 234,5', '2.000', '$500'] }],
    });
    expect(result).not.toBeNull();
    // toNum converts to number — "1 234,5" → 1234.5, "2.000" → 2, "$500" → 500
    expect(result!.series[0].values[0]).toBeCloseTo(1234.5);
  });
});
