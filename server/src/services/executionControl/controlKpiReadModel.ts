import type { Pool } from 'pg';

import { OwnerIndependentKpiReader } from './ownerIndependentKpiReader.js';

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
    const computed = await new OwnerIndependentKpiReader(this.pool as Pool).read(
      organizationId,
      weekStart
    );
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

    const families = CONTROL_KPI_FAMILIES.map((family) => {
      const dependencies = POLICY_DEPENDENCIES[family] ?? [];
      const decisionRequired = dependencies.some((name) => missingParameters.includes(name as any));
      const value = family in computed ? computed[family as keyof typeof computed] : null;
      const hasPopulation = Boolean(value && value.denominator > 0);
      return {
        family,
        numerator: decisionRequired || !hasPopulation ? null : value!.numerator,
        denominator: decisionRequired || !hasPopulation ? null : value!.denominator,
        value: decisionRequired || !hasPopulation ? null : value!.numerator / value!.denominator,
        valueReason: decisionRequired
          ? ('DECISION_REQUIRED' as const)
          : hasPopulation
            ? null
            : ('BRAK_ŹRÓDŁA' as const),
        drillDown: { kind: family, ids: hasPopulation ? value!.ids : ([] as string[]) },
        sourceVersion: hasPopulation ? value!.sourceVersion : 0,
        scopeCompleteness: decisionRequired
          ? ('NOT_CALCULABLE' as const)
          : hasPopulation
            ? ('FULL' as const)
            : ('NO_POPULATION' as const),
        valueClass: decisionRequired
          ? ('UNKNOWN' as const)
          : hasPopulation
            ? ('CALCULATED' as const)
            : ('UNKNOWN' as const),
        calculatedAt,
      };
    });
    const fullFamilyCount = families.filter((family) => family.scopeCompleteness === 'FULL').length;

    return {
      weekStart,
      families,
      policy: {
        policyId: policyRow?.policy_id ?? null,
        resolved: Boolean(policyRow) && missingParameters.length === 0,
        missingParameters,
      },
      scopeCompleteness:
        fullFamilyCount === families.length
          ? ('FULL' as const)
          : fullFamilyCount === 0
            ? ('NOT_CALCULABLE' as const)
            : ('PARTIAL' as const),
      calculatedAt,
    };
  }
}
