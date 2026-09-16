import { describe, expect, it } from 'vitest';

import { resolveKpiReportPeriodLabel } from '../kpiReportPresenters';
import type { KpiScorecardDto } from '../kpiScorecardApi';

const MONTHLY_SCORECARD = {
  scorecardId: 'scorecard-1',
  reviewFrequency: 'monthly',
} as KpiScorecardDto;

describe('resolveKpiReportPeriodLabel locale', () => {
  it('uses localized month for the current period', () => {
    const now = new Date('2026-09-16T12:00:00.000Z');

    expect(resolveKpiReportPeriodLabel(MONTHLY_SCORECARD, null, true, now)).toBe('IX 2026');
    expect(resolveKpiReportPeriodLabel(MONTHLY_SCORECARD, null, false, now)).toBe('SEP 2026');
  });

  it('uses localized month from a published snapshot', () => {
    const snapshot = {
      reviewPeriodStart: '2026-07-01T00:00:00.000Z',
      reviewPeriodEnd: '2026-07-31T23:59:59.999Z',
    };

    expect(resolveKpiReportPeriodLabel(MONTHLY_SCORECARD, snapshot, true)).toBe('VII 2026');
    expect(resolveKpiReportPeriodLabel(MONTHLY_SCORECARD, snapshot, false)).toBe('JUL 2026');
  });
});
