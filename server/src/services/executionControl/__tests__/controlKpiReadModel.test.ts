import { describe, expect, it, vi } from 'vitest';

import { CONTROL_KPI_FAMILIES, ControlKpiReadModel } from '../controlKpiReadModel.js';

describe('Day 17 X.4 control KPI read model', () => {
  it('always returns all eight families in canonical order on an empty policy table', async () => {
    const model = new ControlKpiReadModel({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as any);
    const result = await model.read('org-a', '2026-08-24', 'missing-policy');
    expect(result.families.map((item) => item.family)).toEqual(CONTROL_KPI_FAMILIES);
    expect(result.families).toHaveLength(8);
    expect(result.families.every((item) => item.value === null)).toBe(true);
    expect(result.scopeCompleteness).toBe('NOT_CALCULABLE');
  });

  it('marks policy-dependent families DECISION_REQUIRED without defaults', async () => {
    const model = new ControlKpiReadModel({
      query: vi.fn().mockResolvedValue({ rows: [] }),
    } as any);
    const result = await model.read('org-a', '2026-08-24', null);
    expect(
      result.families
        .filter((item) => item.valueReason === 'DECISION_REQUIRED')
        .map((item) => item.family)
    ).toEqual(['initiative-risk', 'capacity', 'decision-latency']);
    expect(result.policy.resolved).toBe(false);
    expect(result.policy.missingParameters).toHaveLength(5);
  });

  it('resolves a complete tenant policy but keeps unsupported populations explicit', async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => ({
      rows: sql.includes('execution_control_kpi_policies')
        ? [
            {
              policy_id: 'policy-a',
              parameters: {
                impactWeights: { CRITICAL: 3, IMPORTANT: 2, SUPPORTING: 1 },
                atRiskThresholdDays: 1,
                capacitySaturationThreshold: { normalUpper: 0.5, saturatedUpper: 0.75 },
                capacityBuffer: 0.25,
                decisionSlaDays: { value: 1, unit: 'BUSINESS_DAYS' },
              },
            },
          ]
        : [],
    }));
    const result = await new ControlKpiReadModel({ query } as any).read(
      'org-a',
      '2026-08-24',
      'policy-a'
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining('organization_id = $1'), [
      'org-a',
      'policy-a',
    ]);
    expect(result.policy).toEqual({
      policyId: 'policy-a',
      resolved: true,
      missingParameters: [],
      invalidParameters: [],
    });
    expect(result.families.every((item) => item.valueReason === 'BRAK_ŹRÓDŁA')).toBe(true);
    expect(result.scopeCompleteness).toBe('NOT_CALCULABLE');
  });

  it('derives PARTIAL when at least one family is full and others are not', async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('ie_aggregate_state item')) {
        return {
          rows: [
            {
              aggregate_type: 'execution_task',
              aggregate_id: 'task-a',
              version: 1,
              payload_json: { dueAt: '2026-08-25T00:00:00Z', status: 'COMPLETED' },
              initiative_id: 'initiative-a',
            },
          ],
        };
      }
      if (sql.includes('execution_control_kpi_policies')) {
        return {
          rows: [
            {
              policy_id: 'policy-a',
              parameters: {
                impactWeights: { CRITICAL: 3, IMPORTANT: 2, SUPPORTING: 1 },
                atRiskThresholdDays: 1234,
                capacitySaturationThreshold: { normalUpper: 0.5, saturatedUpper: 0.75 },
                capacityBuffer: 0.25,
                decisionSlaDays: { value: 1234, unit: 'CALENDAR_DAYS' },
              },
            },
          ],
        };
      }
      return { rows: [] };
    });
    const result = await new ControlKpiReadModel({ query } as any).read(
      'org-a',
      '2026-08-24',
      'policy-a'
    );
    expect(result.scopeCompleteness).toBe('PARTIAL');
  });
});
