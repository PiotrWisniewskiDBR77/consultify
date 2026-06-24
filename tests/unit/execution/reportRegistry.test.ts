import { describe, expect, it } from 'vitest';

import {
  REPORT_REGISTRY,
  getReportById,
  getReportsByCadence,
  getReportsForAudience,
  type ReportCadence,
  type ReportDefinition,
} from '@/components/Execution/reportRegistry';

const VALID_CADENCES: ReportCadence[] = [
  'weekly',
  'monthly',
  'biweekly',
  'on-demand',
  'sponsor',
];

describe('REPORT_REGISTRY (SSOT)', () => {
  it('is non-empty', () => {
    expect(Array.isArray(REPORT_REGISTRY)).toBe(true);
    expect(REPORT_REGISTRY.length).toBeGreaterThan(0);
  });

  it('every entry has all required fields, correctly typed', () => {
    for (const report of REPORT_REGISTRY) {
      expect(typeof report.id).toBe('string');
      expect(report.id.length).toBeGreaterThan(0);

      expect(typeof report.titleKey).toBe('string');
      expect(report.titleKey.length).toBeGreaterThan(0);

      expect(typeof report.defaultTitle).toBe('string');
      expect(report.defaultTitle.length).toBeGreaterThan(0);

      expect(Array.isArray(report.audience)).toBe(true);
      expect(report.audience.length).toBeGreaterThan(0);
      report.audience.forEach((a) => expect(typeof a).toBe('string'));

      expect(VALID_CADENCES).toContain(report.cadence);

      expect(typeof report.scope).toBe('string');
      expect(report.scope.length).toBeGreaterThan(0);

      expect(Array.isArray(report.dataSources)).toBe(true);
      expect(report.dataSources.length).toBeGreaterThan(0);

      expect(Array.isArray(report.sections)).toBe(true);
      expect(report.sections.length).toBeGreaterThan(0);
    }
  });

  it('has unique ids', () => {
    const ids = REPORT_REGISTRY.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers the canonical report families', () => {
    const ids = new Set(REPORT_REGISTRY.map((r) => r.id));
    // Spot-check that the SSOT carries the key reports the task asked for.
    expect(ids.has('weekly-exec')).toBe(true);
    expect(ids.has('steering-pack')).toBe(true);
    expect(ids.has('sponsor-onepager')).toBe(true);
    expect(ids.has('budget-variance')).toBe(true);
    expect(ids.has('risk-report')).toBe(true);
    expect(ids.has('workload-report')).toBe(true);
    expect(ids.has('monthly-executive')).toBe(true);
  });
});

describe('getReportsByCadence', () => {
  it('returns only reports of the requested cadence', () => {
    for (const cadence of VALID_CADENCES) {
      const result = getReportsByCadence(cadence);
      result.forEach((r: ReportDefinition) => expect(r.cadence).toBe(cadence));
    }
  });

  it('partitions the registry across all cadences', () => {
    const total = VALID_CADENCES.reduce(
      (sum, cadence) => sum + getReportsByCadence(cadence).length,
      0
    );
    expect(total).toBe(REPORT_REGISTRY.length);
  });

  it('returns at least one weekly report', () => {
    expect(getReportsByCadence('weekly').length).toBeGreaterThan(0);
  });
});

describe('getReportById', () => {
  it('finds an existing report', () => {
    const report = getReportById('weekly-exec');
    expect(report).toBeDefined();
    expect(report?.id).toBe('weekly-exec');
    expect(report?.defaultTitle).toBe('Weekly Execution Pack');
  });

  it('returns undefined for an unknown id', () => {
    expect(getReportById('does-not-exist')).toBeUndefined();
  });
});

describe('getReportsForAudience', () => {
  it('matches case-insensitively and by substring', () => {
    const sponsorReports = getReportsForAudience('sponsor');
    expect(sponsorReports.length).toBeGreaterThan(0);
    sponsorReports.forEach((r) =>
      expect(r.audience.some((a) => a.toLowerCase().includes('sponsor'))).toBe(true)
    );
  });

  it('matches PMO across multiple reports', () => {
    const pmoReports = getReportsForAudience('PMO');
    expect(pmoReports.length).toBeGreaterThan(1);
  });

  it('returns an empty array for an empty query', () => {
    expect(getReportsForAudience('')).toEqual([]);
    expect(getReportsForAudience('   ')).toEqual([]);
  });

  it('returns an empty array for an unknown audience', () => {
    expect(getReportsForAudience('nobody-at-all')).toEqual([]);
  });
});
