import { describe, expect, it } from 'vitest';

import {
  baselineBarGeometry,
  computeBaselineComparison,
  varianceLabel,
} from '../../../src/components/Execution/ganttBaseline';

const DAY = 86_400_000;
const at = (iso: string) => new Date(iso).getTime();

describe('computeBaselineComparison', () => {
  it('on_track: actual end equals planned end (slip 0)', () => {
    const r = computeBaselineComparison(
      { start: '2026-01-01', end: '2026-01-10' },
      { start: '2026-01-01', end: '2026-01-10' },
      at('2026-01-05'),
    );
    expect(r.status).toBe('on_track');
    expect(r.startSlipDays).toBe(0);
    expect(r.endSlipDays).toBe(0);
    expect(r.durationPlannedDays).toBe(9);
    expect(r.durationActualDays).toBe(9);
  });

  it('ahead: actual end before planned end (negative slip)', () => {
    const r = computeBaselineComparison(
      { start: '2026-01-01', end: '2026-01-10' },
      { start: '2026-01-01', end: '2026-01-08' },
      at('2026-01-09'),
    );
    expect(r.status).toBe('ahead');
    expect(r.endSlipDays).toBe(-2);
  });

  it('late: not finished (no actual end) and now is past planned end', () => {
    const r = computeBaselineComparison(
      { start: '2026-01-01', end: '2026-01-10' },
      { start: '2026-01-01', end: null },
      at('2026-01-15'),
    );
    expect(r.status).toBe('late');
    // endSlip falls back to 0 when actual end is missing, but status is late.
    expect(r.endSlipDays).toBe(0);
    expect(r.durationActualDays).toBeNull();
  });

  it('slipping: finished but after planned end (positive slip)', () => {
    const r = computeBaselineComparison(
      { start: '2026-01-01', end: '2026-01-10' },
      { start: '2026-01-01', end: '2026-01-13' },
      at('2026-01-20'),
    );
    expect(r.status).toBe('slipping');
    expect(r.endSlipDays).toBe(3);
  });

  it('slipping: in-progress but not yet past planned end', () => {
    // endSlip computed from null actual end → null → 0, status unknown unless
    // we provide an actual end. Here actual end is later but asOf < plannedEnd.
    const r = computeBaselineComparison(
      { start: '2026-01-01', end: '2026-01-10' },
      { start: '2026-01-01', end: '2026-01-12' },
      at('2026-01-05'),
    );
    expect(r.status).toBe('slipping');
    expect(r.endSlipDays).toBe(2);
  });

  it('unknown: planned end missing', () => {
    const r = computeBaselineComparison(
      { start: '2026-01-01', end: null },
      { start: '2026-01-01', end: '2026-01-10' },
      at('2026-01-05'),
    );
    expect(r.status).toBe('unknown');
    expect(r.durationPlannedDays).toBeNull();
  });

  it('unknown: actual end missing AND not past planned end', () => {
    const r = computeBaselineComparison(
      { start: '2026-01-01', end: '2026-01-10' },
      { start: '2026-01-01', end: null },
      at('2026-01-05'),
    );
    expect(r.status).toBe('unknown');
  });

  it('unknown: invalid (NaN) dates', () => {
    const r = computeBaselineComparison(
      { start: 'not-a-date', end: 'garbage' },
      { start: '2026-01-01', end: '2026-01-10' },
      at('2026-01-05'),
    );
    expect(r.status).toBe('unknown');
    expect(r.durationPlannedDays).toBeNull();
  });

  it('startSlipDays reflects late start', () => {
    const r = computeBaselineComparison(
      { start: '2026-01-01', end: '2026-01-10' },
      { start: '2026-01-04', end: '2026-01-10' },
      at('2026-01-11'),
    );
    expect(r.startSlipDays).toBe(3);
    expect(r.endSlipDays).toBe(0);
    expect(r.status).toBe('on_track');
  });
});

describe('baselineBarGeometry', () => {
  const wStart = at('2026-01-01');
  const wEnd = at('2026-01-11'); // 10-day window

  it('places baseline and actual bars at correct percentages', () => {
    const g = baselineBarGeometry(
      { start: '2026-01-01', end: '2026-01-06' }, // first half
      { start: '2026-01-06', end: '2026-01-11' }, // second half
      wStart,
      wEnd,
    );
    expect(g.baseline).toEqual({ leftPct: 0, widthPct: 50 });
    expect(g.actual).toEqual({ leftPct: 50, widthPct: 50 });
  });

  it('clamps a bar that overruns the window edges', () => {
    const g = baselineBarGeometry(
      { start: '2025-12-20', end: '2026-01-21' }, // starts before, ends after
      { start: '2026-01-06', end: '2026-01-08' },
      wStart,
      wEnd,
    );
    expect(g.baseline).toEqual({ leftPct: 0, widthPct: 100 });
  });

  it('returns null for a bar entirely outside the window', () => {
    const g = baselineBarGeometry(
      { start: '2026-02-01', end: '2026-02-10' }, // after window
      { start: '2025-11-01', end: '2025-11-10' }, // before window
      wStart,
      wEnd,
    );
    expect(g.baseline).toBeNull();
    expect(g.actual).toBeNull();
  });

  it('returns null when dates are missing or invalid', () => {
    const g = baselineBarGeometry(
      { start: null, end: '2026-01-06' },
      { start: '2026-01-06', end: 'nope' },
      wStart,
      wEnd,
    );
    expect(g.baseline).toBeNull();
    expect(g.actual).toBeNull();
  });

  it('returns null when the window has zero or negative span', () => {
    const g = baselineBarGeometry(
      { start: '2026-01-01', end: '2026-01-06' },
      { start: '2026-01-01', end: '2026-01-06' },
      wEnd,
      wStart, // reversed → span <= 0
    );
    expect(g.baseline).toBeNull();
    expect(g.actual).toBeNull();
  });

  it('half-open: bar starting mid-window gets correct left offset', () => {
    const g = baselineBarGeometry(
      { start: '2026-01-03', end: '2026-01-05' }, // 2 days into a 10-day window, 2 days long
      { start: '2026-01-03', end: '2026-01-05' },
      wStart,
      wEnd,
    );
    expect(g.baseline).toEqual({ leftPct: 20, widthPct: 20 });
  });
});

describe('varianceLabel', () => {
  it('formats a delay as +Nd za planem', () => {
    expect(varianceLabel(5)).toBe('+5d za planem');
  });

  it('formats on-time as w terminie', () => {
    expect(varianceLabel(0)).toBe('w terminie');
  });

  it('formats early delivery as -Nd przed planem', () => {
    expect(varianceLabel(-2)).toBe('-2d przed planem');
  });

  it('rounds fractional slip to whole days', () => {
    expect(varianceLabel(2.4)).toBe('+2d za planem');
    expect(varianceLabel(-1.6)).toBe('-2d przed planem');
  });

  it('treats non-finite input as on-time', () => {
    expect(varianceLabel(Number.NaN)).toBe('w terminie');
  });
});
