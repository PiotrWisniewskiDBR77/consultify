import { describe, it, expect } from 'vitest';
import { formatRoiDisplay } from '../../src/utils/safeFormat';

describe('formatRoiDisplay (Z64 crash guard)', () => {
  it('formats real numbers as Nx (preserves old visual)', () => {
    expect(formatRoiDisplay(2)).toBe('2.0x');
    expect(formatRoiDisplay(3.456)).toBe('3.5x');
    expect(formatRoiDisplay(0)).toBe('0.0x');
  });

  it('formats pure numeric strings as Nx (no crash)', () => {
    expect(formatRoiDisplay('2.5')).toBe('2.5x');
    expect(formatRoiDisplay('10')).toBe('10.0x');
  });

  it('shows qualitative TEXT (migration 903) verbatim — this is what crashed', () => {
    // These are the exact shapes the AI writes into the TEXT column.
    expect(formatRoiDisplay('ROI 200%')).toBe('ROI 200%');
    expect(formatRoiDisplay('44% (zysk netto ÷ nakład), payback 14 mies')).toBe(
      '44% (zysk netto ÷ nakład), payback 14 mies'
    );
    expect(formatRoiDisplay('rentowność Q3 2027')).toBe('rentowność Q3 2027');
  });

  it('falls back for empty / null / undefined / non-finite', () => {
    expect(formatRoiDisplay(null)).toBe('-');
    expect(formatRoiDisplay(undefined)).toBe('-');
    expect(formatRoiDisplay('')).toBe('-');
    expect(formatRoiDisplay('   ')).toBe('-');
    expect(formatRoiDisplay(Number.NaN)).toBe('-');
    expect(formatRoiDisplay(Infinity)).toBe('-');
  });

  it('never throws on any input (the actual Z64 failure mode)', () => {
    const inputs: unknown[] = ['ROI 200%', {}, [], true, null, undefined, 5, '3.2', NaN];
    for (const i of inputs) expect(() => formatRoiDisplay(i)).not.toThrow();
  });
});
