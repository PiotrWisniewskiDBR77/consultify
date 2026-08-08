import { describe, expect, it } from 'vitest';

import { normalizeSensitivityGrid } from '../normalizeSensitivityGrid';

describe('normalizeSensitivityGrid', () => {
  it('pivots persisted flat WACC/g/EV cells used by real valuations', () => {
    expect(
      normalizeSensitivityGrid({
        matrix: [
          { wacc: 9, g: 1, ev: 90 },
          { wacc: 8, g: 2, ev: 120 },
          { wacc: 8, g: 1, ev: 110 },
          { wacc: 9, g: 2, ev: 100 },
        ],
      })
    ).toEqual({
      columnHeaders: ['1%', '2%'],
      rowHeaders: ['8%', '9%'],
      values: [
        [110, 120],
        [90, 100],
      ],
    });
  });

  it('keeps legacy 2D matrices and their explicit headers', () => {
    expect(
      normalizeSensitivityGrid({
        matrix: [
          [10, 20],
          [30, 40],
        ],
        colHeaders: ['A', 'B'],
        rowHeaders: ['C', 'D'],
      })
    ).toEqual({
      columnHeaders: ['A', 'B'],
      rowHeaders: ['C', 'D'],
      values: [
        [10, 20],
        [30, 40],
      ],
    });
  });

  it('preserves missing intersections instead of fabricating zero enterprise value', () => {
    expect(
      normalizeSensitivityGrid({
        matrix: [
          { wacc: 8, g: 1, ev: 110 },
          { wacc: 8, g: 2, ev: 120 },
          { wacc: 9, g: 1, ev: 90 },
        ],
      })?.values
    ).toEqual([
      [110, 120],
      [90, null],
    ]);
  });
});
