/** Day 17 K.3 — read-only recorded-or-derived next KPI obligation. */
import type { PoolClient, QueryResultRow } from 'pg';
import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  wrapWithVisibilityScope,
  VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';

interface ObligationRow extends QueryResultRow {
  obligation_id: string;
  obligation_type: string;
  due_at: string | null;
  assignee_user_id: string;
}
interface CadenceRow extends QueryResultRow {
  measurement_frequency_days: number | null;
  period_end: string | null;
}
export interface KpiNextObligationResult {
  found: boolean;
  kpiId: string;
  obligation: {
    obligationId: string;
    obligationType: string;
    dueAt: string | null;
    status: 'open';
    assigneeUserId: string;
    overdue: boolean;
    source: 'OBLIGATION_ROW';
  } | null;
  derived: {
    nextExpectedAt: string;
    basis: 'MEASUREMENT_FREQUENCY_DAYS';
    frequencyDays: number;
    lastMeasuredPeriodEnd: string;
  } | null;
  reason: 'NO_CADENCE_CONFIGURED' | 'NO_MEASUREMENT_YET' | null;
  calculatedAt: string;
}
async function withClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function getKpiNextObligation(params: {
  userId: string;
  organizationId: string;
  kpiId: string;
  now?: Date;
}): Promise<KpiNextObligationResult> {
  const calculatedAt = (params.now ?? new Date()).toISOString();
  const visible = await wrapWithVisibilityScope(
    `SELECT kd.kpi_id FROM rvn_kpi_definitions kd INNER JOIN rvn_visible_resources vr ON vr.resource_type='kpi' AND vr.resource_id=kd.kpi_id::text WHERE kd.organization_id=$1 AND kd.kpi_id=$${VISIBILITY_CTE_PARAM_COUNT + 1}`,
    { userId: params.userId, organizationId: params.organizationId, resourceType: 'kpi' }
  );
  return withClient(async (client) => {
    if ((await client.query(visible.sql, [...visible.values, params.kpiId])).rowCount === 0)
      return {
        found: false,
        kpiId: params.kpiId,
        obligation: null,
        derived: null,
        reason: null,
        calculatedAt,
      };
    const obligation = (
      await client.query<ObligationRow>(
        `SELECT obligation_id, obligation_type, due_at, assignee_user_id FROM rvn_platform_obligations WHERE organization_id=$1 AND reference_type='kpi' AND reference_id=$2 AND status='open' ORDER BY due_at ASC NULLS LAST, obligation_id ASC LIMIT 1`,
        [params.organizationId, params.kpiId]
      )
    ).rows[0];
    if (obligation)
      return {
        found: true,
        kpiId: params.kpiId,
        obligation: {
          obligationId: obligation.obligation_id,
          obligationType: obligation.obligation_type,
          dueAt: obligation.due_at ? new Date(obligation.due_at).toISOString() : null,
          status: 'open',
          assigneeUserId: obligation.assignee_user_id,
          overdue:
            obligation.due_at !== null &&
            new Date(obligation.due_at).getTime() < new Date(calculatedAt).getTime(),
          source: 'OBLIGATION_ROW',
        },
        derived: null,
        reason: null,
        calculatedAt,
      };
    const cadence = (
      await client.query<CadenceRow>(
        `SELECT dv.measurement_frequency_days, latest.period_end FROM rvn_kpi_definitions kd LEFT JOIN rvn_kpi_definition_versions dv ON dv.definition_version_id=kd.current_definition_version_id LEFT JOIN LATERAL (SELECT m.period_end FROM rvn_kpi_measurements m WHERE m.organization_id=kd.organization_id AND m.kpi_id=kd.kpi_id AND NOT EXISTS (SELECT 1 FROM rvn_kpi_measurements newer WHERE newer.correction_of_measurement_id=m.measurement_id) ORDER BY m.period_end DESC, m.recorded_at DESC LIMIT 1) latest ON true WHERE kd.organization_id=$1 AND kd.kpi_id=$2`,
        [params.organizationId, params.kpiId]
      )
    ).rows[0];
    if (!cadence?.measurement_frequency_days)
      return {
        found: true,
        kpiId: params.kpiId,
        obligation: null,
        derived: null,
        reason: 'NO_CADENCE_CONFIGURED',
        calculatedAt,
      };
    if (!cadence.period_end)
      return {
        found: true,
        kpiId: params.kpiId,
        obligation: null,
        derived: null,
        reason: 'NO_MEASUREMENT_YET',
        calculatedAt,
      };
    const next = new Date(cadence.period_end);
    next.setUTCDate(next.getUTCDate() + cadence.measurement_frequency_days);
    return {
      found: true,
      kpiId: params.kpiId,
      obligation: null,
      derived: {
        nextExpectedAt: next.toISOString(),
        basis: 'MEASUREMENT_FREQUENCY_DAYS',
        frequencyDays: cadence.measurement_frequency_days,
        lastMeasuredPeriodEnd: new Date(cadence.period_end).toISOString(),
      },
      reason: null,
      calculatedAt,
    };
  });
}
