import { describe, expect, it } from 'vitest';

import { OutcomeRuntimeService } from '../outcomeRuntimeService.js';

describe('OutcomeRuntimeService', () => {
  it('previews KPI acceptance and creates an acceptance contract', () => {
    const service = new OutcomeRuntimeService();

    const result = service.previewAcceptance({
      scope: { tenantId: 'org-1', userId: 'user-1' },
      analysisSummary: 'Analysis suggests automating weekly KPI review.',
      businessGoal: 'Reduce reporting time for finance team.',
      metrics: [
        {
          id: 'kpi-time',
          label: 'Reporting cycle time',
          domain: 'time',
          unit: 'hours',
          baselineValue: 8,
          targetValue: 3,
        },
      ],
      evidence: { analysisId: 'analysis-1', artifactId: 'artifact-1' },
    });

    expect(result.previewId).toMatch(/^out-prev-/);
    expect(result.acceptanceContract.contractId).toMatch(/^out-ctr-/);
    expect(result.metrics[0]?.suggestedSignalKind).toBe('time_saved');
    expect(result.businessLinkSummary.linkedMetricIds).toEqual(['kpi-time']);
  });

  it('resolves acceptance and emits an outcome record id on accept', () => {
    const service = new OutcomeRuntimeService();
    const preview = service.previewAcceptance({
      scope: { tenantId: 'org-1', userId: 'user-1' },
      analysisSummary: 'Analysis suggests tightening churn interventions.',
      businessGoal: 'Improve customer retention.',
      metrics: [
        {
          id: 'kpi-retention',
          label: 'Renewal rate',
          domain: 'retention',
          unit: '%',
          baselineValue: 82,
          targetValue: 88,
        },
      ],
      evidence: { analysisId: 'analysis-2', correlationId: 'corr-2' },
    });

    const result = service.resolveAcceptance({
      scope: { tenantId: 'org-1', userId: 'user-1' },
      contractId: preview.acceptanceContract.contractId,
      decision: 'accepted',
      acceptedMetricIds: ['kpi-retention'],
    });

    expect(result.status).toBe('accepted');
    expect(result.outcomeRecordId).toMatch(/^out-rec-/);
    expect(result.acceptedMetricIds).toEqual(['kpi-retention']);
  });
});
