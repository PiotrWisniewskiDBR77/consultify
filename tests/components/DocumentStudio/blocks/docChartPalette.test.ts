/**
 * R3 — palette cap tests. §P-CHART/§3: categorical palette ≤7.
 */

import { describe, expect, it } from 'vitest';

import {
  HARVARD_CHART_PALETTE,
  PALETTE_CAP,
  clampPalette,
  colorAt,
} from '../../../../src/components/DocumentStudio/blocks/docChartPalette';

describe('docChartPalette', () => {
  it('crimson is the primary anchor', () => {
    expect(HARVARD_CHART_PALETTE[0]).toBe('#A51C30');
  });

  it('clampPalette caps the returned palette at ≤7 (PALETTE_CAP)', () => {
    expect(PALETTE_CAP).toBe(7);
    expect(clampPalette(3)).toHaveLength(3);
    expect(clampPalette(7)).toHaveLength(7);
    expect(clampPalette(12)).toHaveLength(7);
    expect(clampPalette(99)).toHaveLength(7);
  });

  it('clampPalette tolerates garbage → at least 1 colour, never throws', () => {
    expect(clampPalette(0)).toEqual([HARVARD_CHART_PALETTE[0]]);
    expect(clampPalette(-5)).toEqual([HARVARD_CHART_PALETTE[0]]);
    expect(clampPalette(NaN)).toEqual([HARVARD_CHART_PALETTE[0]]);
    // @ts-expect-error — deliberately wrong type
    expect(clampPalette('x')).toEqual([HARVARD_CHART_PALETTE[0]]);
  });

  it('colorAt wraps at the ≤7 cap', () => {
    expect(colorAt(0)).toBe(HARVARD_CHART_PALETTE[0]);
    expect(colorAt(7)).toBe(HARVARD_CHART_PALETTE[0]);
    expect(colorAt(8)).toBe(HARVARD_CHART_PALETTE[1]);
  });
});
