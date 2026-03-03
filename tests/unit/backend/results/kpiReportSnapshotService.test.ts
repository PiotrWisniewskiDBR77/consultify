import { describe, expect, it } from 'vitest';

import {
  renderSnapshotMarkdown,
  type ResultsKpiReportSnapshot,
} from '../../../../server/src/services/results/kpiReportSnapshotService.js';

describe('kpiReportSnapshotService', () => {
  it('renders executive summary + tables for KPI report snapshot', () => {
    const snap: ResultsKpiReportSnapshot = {
      id: 's1',
      organizationId: 'org-1',
      periodStart: '2026-02-01',
      periodEnd: '2026-02-28',
      title: 'KPI performance review (2026-02)',
      generatedAt: '2026-02-28T10:00:00.000Z',
      kpis: [
        {
          id: 'k1',
          initiativeId: null,
          initiativeName: null,
          name: 'OEE',
          description: null,
          unit: '%',
          baselineValue: null,
          targetValue: 85,
          measurementFrequency: 'MONTHLY',
          ownerUserId: 'u1',
          ownerName: 'Owner One',
          currentValue: null,
          latestValue: 80,
          latestMeasurementDate: '2026-02-01',
          isOnTarget: false,
          openDeviationCase: { id: 'c1', severity: 'RED', status: 'OPEN' },
        },
      ],
      deviationCases: [
        {
          id: 'c1',
          kpiId: 'k1',
          kpiName: 'OEE',
          periodStart: '2026-02-01',
          periodEnd: '2026-02-28',
          severity: 'RED',
          status: 'OPEN',
          ownerUserId: 'u1',
          deviationSummary: 'RED: value 80 deviates from target 85',
          rcaText: null,
          detectedAt: '2026-02-15',
          actions: [
            {
              id: 'a1',
              caseId: 'c1',
              title: 'Fix downtime root cause',
              ownerUserId: 'u1',
              dueDate: '2026-03-05',
              status: 'OPEN',
            },
          ],
        },
      ],
      actionPlan: [
        {
          id: 'a1',
          caseId: 'c1',
          title: 'Fix downtime root cause',
          ownerUserId: 'u1',
          dueDate: '2026-03-05',
          status: 'OPEN',
          kpiId: 'k1',
          kpiName: 'OEE',
          severity: 'RED',
          caseStatus: 'OPEN',
        },
      ],
      stats: {
        kpisTotal: 1,
        kpisOnTarget: 0,
        kpisBelowTarget: 1,
        kpisNoData: 0,
        openDeviationCases: 1,
        openRedCases: 1,
        openAmberCases: 0,
        openActions: 1,
      },
    };

    const md = renderSnapshotMarkdown(snap);
    expect(md.executive_summary).toContain('KPI performance review');
    expect(md.kpi_overview).toContain('| KPI |');
    expect(md.deviation_cases).toContain('Deviation cases');
    expect(md.action_plan).toContain('Action plan');
    expect(md.action_plan).toContain('Fix downtime root cause');
  });
});

