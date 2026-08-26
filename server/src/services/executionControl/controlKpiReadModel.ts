import type { Pool } from 'pg';

export const CONTROL_KPI_FAMILIES = [
  'plan-delivery',
  'blocked-work',
  'milestone',
  'initiative-risk',
  'dependency',
  'capacity',
  'decision-latency',
  'intervention-effectiveness',
] as const;

const REQUIRED_POLICY_PARAMETERS = [
  'impactWeights',
  'atRiskThresholdDays',
  'capacitySaturationThreshold',
  'capacityBuffer',
  'decisionSlaDays',
] as const;

const POLICY_DEPENDENCIES: Partial<Record<(typeof CONTROL_KPI_FAMILIES)[number], string[]>> = {
  'initiative-risk': ['impactWeights', 'atRiskThresholdDays'],
  capacity: ['capacitySaturationThreshold', 'capacityBuffer'],
  'decision-latency': ['decisionSlaDays'],
};

export class ControlKpiReadModel {
  constructor(private readonly pool: Pick<Pool, 'query'>) {}

  async read(organizationId: string, weekStart: string, policyId?: string | null) {
    const policyResult = policyId
      ? await this.pool.query<{ policy_id: string; parameters: Record<string, unknown> }>(
          `SELECT policy_id, parameters
             FROM execution_control_kpi_policies
            WHERE organization_id = $1 AND policy_id = $2`,
          [organizationId, policyId]
        )
      : { rows: [] };
    const policyRow = policyResult.rows[0] ?? null;
    const parameters = policyRow?.parameters ?? {};
    const missingParameters = REQUIRED_POLICY_PARAMETERS.filter(
      (name) => parameters[name] === undefined || parameters[name] === null
    );
    const calculatedAt = new Date().toISOString();

    return {
      weekStart,
      families: CONTROL_KPI_FAMILIES.map((family) => {
        const dependencies = POLICY_DEPENDENCIES[family] ?? [];
        const decisionRequired = dependencies.some((name) =>
          missingParameters.includes(name as any)
        );
        return {
          family,
          numerator: null,
          denominator: null,
          value: null,
          valueReason: decisionRequired ? ('DECISION_REQUIRED' as const) : ('BRAK_ŹRÓDŁA' as const),
          drillDown: { kind: family, ids: [] as string[] },
          sourceVersion: 0,
          calculatedAt,
        };
      }),
      policy: {
        policyId: policyRow?.policy_id ?? null,
        resolved: Boolean(policyRow) && missingParameters.length === 0,
        missingParameters,
      },
      scopeCompleteness: 'PARTIAL' as const,
      calculatedAt,
    };
  }
}
