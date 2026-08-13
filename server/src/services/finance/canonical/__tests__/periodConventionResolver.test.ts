/**
 * Pure unit tests for `periodConventionResolver.ts` — no database, an
 * in-memory `Map<periodId, PeriodMeta>` stands in for `finance_stmt_periods`.
 */
import { describe, expect, it } from 'vitest';

import { annualizationFactor, daysInPeriod, resolvePeriodOffset, type PeriodMeta } from '../periodConventionResolver.js';

function fy(year: number, id: string, prev: string | null, start: string, end: string): PeriodMeta {
  return { periodId: id, periodType: 'FY', fiscalYear: year, fiscalQuarter: null, fiscalMonth: null, periodStart: start, periodEnd: end, previousPeriodId: prev };
}

function q(year: number, quarter: number, id: string, prev: string | null, start: string, end: string): PeriodMeta {
  return { periodId: id, periodType: 'Q', fiscalYear: year, fiscalQuarter: quarter, fiscalMonth: null, periodStart: start, periodEnd: end, previousPeriodId: prev };
}

describe('daysInPeriod — never hardcoded 365', () => {
  it('a non-leap calendar FY2025 is 365 days', () => {
    expect(daysInPeriod(fy(2025, 'fy2025', null, '2025-01-01', '2025-12-31'))).toBe(365);
  });

  it('a leap-year FY2024 is 366 days', () => {
    expect(daysInPeriod(fy(2024, 'fy2024', null, '2024-01-01', '2024-12-31'))).toBe(366);
  });

  it('a calendar quarter is ~91 days, not 365/4', () => {
    expect(daysInPeriod(q(2025, 1, 'q1-2025', null, '2025-01-01', '2025-03-31'))).toBe(90);
  });
});

describe('annualizationFactor', () => {
  it('FY period: factor 1 (already annual)', () => {
    expect(annualizationFactor(fy(2025, 'fy2025', null, '2025-01-01', '2025-12-31'))).toBe(1);
  });

  it('MONTH period fiscal_month=8: 12/8', () => {
    const period: PeriodMeta = { periodId: 'm8', periodType: 'MONTH', fiscalYear: 2025, fiscalQuarter: null, fiscalMonth: 8, periodStart: '2025-01-01', periodEnd: '2025-08-31', previousPeriodId: null };
    expect(annualizationFactor(period)).toBeCloseTo(1.5, 9);
  });

  it('Q period fiscal_quarter=3: 4/3', () => {
    expect(annualizationFactor(q(2025, 3, 'q3', null, '2025-01-01', '2025-09-30'))).toBeCloseTo(4 / 3, 9);
  });
});

describe('resolvePeriodOffset — CURRENT / PRIOR_PERIOD', () => {
  const graph = new Map<string, PeriodMeta>([
    ['fy2024', fy(2024, 'fy2024', null, '2024-01-01', '2024-12-31')],
    ['fy2025', fy(2025, 'fy2025', 'fy2024', '2025-01-01', '2025-12-31')],
  ]);
  const lookup = (id: string) => graph.get(id);

  it('CURRENT: single period, unchanged', () => {
    expect(resolvePeriodOffset('CURRENT', 'fy2025', lookup)).toEqual({ ok: true, periodIds: ['fy2025'], combine: 'SINGLE' });
  });

  it('PRIOR_PERIOD: walks previous_period_id once', () => {
    expect(resolvePeriodOffset('PRIOR_PERIOD', 'fy2025', lookup)).toEqual({ ok: true, periodIds: ['fy2024'], combine: 'SINGLE' });
  });

  it('PRIOR_PERIOD on the first period on record: INSUFFICIENT_HISTORY, no silent fallback', () => {
    const result = resolvePeriodOffset('PRIOR_PERIOD', 'fy2024', lookup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INSUFFICIENT_HISTORY');
  });
});

describe('resolvePeriodOffset — AVERAGE_CURRENT_AND_PRIOR', () => {
  const graph = new Map<string, PeriodMeta>([
    ['fy2024', fy(2024, 'fy2024', null, '2024-01-01', '2024-12-31')],
    ['fy2025', fy(2025, 'fy2025', 'fy2024', '2025-01-01', '2025-12-31')],
  ]);
  const lookup = (id: string) => graph.get(id);

  it('combine=AVERAGE over [current, prior]', () => {
    expect(resolvePeriodOffset('AVERAGE_CURRENT_AND_PRIOR', 'fy2025', lookup)).toEqual({
      ok: true,
      periodIds: ['fy2025', 'fy2024'],
      combine: 'AVERAGE',
    });
  });

  it('first period on record: INSUFFICIENT_HISTORY (ADR 6.4 — never falls back to the point-in-time value)', () => {
    const result = resolvePeriodOffset('AVERAGE_CURRENT_AND_PRIOR', 'fy2024', lookup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INSUFFICIENT_HISTORY');
  });
});

describe('resolvePeriodOffset — LTM_SUM_4Q / LTM_LATEST_Q_CLOSE', () => {
  const graph = new Map<string, PeriodMeta>([
    ['q1', q(2025, 1, 'q1', null, '2025-01-01', '2025-03-31')],
    ['q2', q(2025, 2, 'q2', 'q1', '2025-04-01', '2025-06-30')],
    ['q3', q(2025, 3, 'q3', 'q2', '2025-07-01', '2025-09-30')],
    ['q4', q(2025, 4, 'q4', 'q3', '2025-10-01', '2025-12-31')],
    ['fy2025', fy(2025, 'fy2025', null, '2025-01-01', '2025-12-31')],
  ]);
  const lookup = (id: string) => graph.get(id);

  it('LTM_SUM_4Q collects [current, -1Q, -2Q, -3Q] and combine=SUM', () => {
    expect(resolvePeriodOffset('LTM_SUM_4Q', 'q4', lookup)).toEqual({
      ok: true,
      periodIds: ['q4', 'q3', 'q2', 'q1'],
      combine: 'SUM',
    });
  });

  it('LTM_SUM_4Q with fewer than 3 prior quarters: INSUFFICIENT_HISTORY', () => {
    const result = resolvePeriodOffset('LTM_SUM_4Q', 'q2', lookup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('INSUFFICIENT_HISTORY');
  });

  it('LTM_SUM_4Q against a non-quarterly (FY) current period: WRONG_PERIOD_TYPE_FOR_LTM (a readiness-gate concern, per ADR 6.4)', () => {
    const result = resolvePeriodOffset('LTM_SUM_4Q', 'fy2025', lookup);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('WRONG_PERIOD_TYPE_FOR_LTM');
  });

  it('LTM_LATEST_Q_CLOSE: SINGLE [current], no summing (a balance sheet does not sum across periods)', () => {
    expect(resolvePeriodOffset('LTM_LATEST_Q_CLOSE', 'q4', lookup)).toEqual({ ok: true, periodIds: ['q4'], combine: 'SINGLE' });
  });
});

describe('resolvePeriodOffset — PRIOR_YEAR_SAME_PERIOD', () => {
  it('FY granularity: 1 hop', () => {
    const graph = new Map<string, PeriodMeta>([
      ['fy2024', fy(2024, 'fy2024', null, '2024-01-01', '2024-12-31')],
      ['fy2025', fy(2025, 'fy2025', 'fy2024', '2025-01-01', '2025-12-31')],
    ]);
    expect(resolvePeriodOffset('PRIOR_YEAR_SAME_PERIOD', 'fy2025', (id) => graph.get(id))).toEqual({
      ok: true,
      periodIds: ['fy2024'],
      combine: 'SINGLE',
    });
  });

  it('Q granularity: 4 hops', () => {
    const graph = new Map<string, PeriodMeta>([
      ['q1-24', q(2024, 1, 'q1-24', null, '2024-01-01', '2024-03-31')],
      ['q2-24', q(2024, 2, 'q2-24', 'q1-24', '2024-04-01', '2024-06-30')],
      ['q3-24', q(2024, 3, 'q3-24', 'q2-24', '2024-07-01', '2024-09-30')],
      ['q4-24', q(2024, 4, 'q4-24', 'q3-24', '2024-10-01', '2024-12-31')],
      ['q1-25', q(2025, 1, 'q1-25', 'q4-24', '2025-01-01', '2025-03-31')],
      ['q2-25', q(2025, 2, 'q2-25', 'q1-25', '2025-04-01', '2025-06-30')],
      ['q3-25', q(2025, 3, 'q3-25', 'q2-25', '2025-07-01', '2025-09-30')],
      ['q4-25', q(2025, 4, 'q4-25', 'q3-25', '2025-10-01', '2025-12-31')],
    ]);
    expect(resolvePeriodOffset('PRIOR_YEAR_SAME_PERIOD', 'q4-25', (id) => graph.get(id))).toEqual({
      ok: true,
      periodIds: ['q4-24'],
      combine: 'SINGLE',
    });
  });
});
