/**
 * KPI-E003 — Deviation Closed Loop read repository.
 *
 * Design: docs/product/results-vnext/KPI_E003_DESIGN.md §D, "Files to
 * create": "kpiDeviationRepository.ts — read queries via
 * buildVisibilityScopedCte" (NOT a raw WHERE).
 *
 * Deviation cases/corrective actions/effectiveness verifications have NO
 * row of their own in `rvn_platform_resource_visibility` — same principle
 * `kpiRepository.ts`'s header comment states for
 * `rvn_kpi_definition_versions`/`rvn_kpi_measurements` ("Only
 * `rvn_kpi_definitions` gets a row ... children inherit visibility via
 * `kpi_id`"). Nothing in KPI_E003_DESIGN.md §A creates a
 * `rvn_platform_resource_visibility` row for a deviation case either (no
 * such INSERT appears anywhere in `kpiDeviationCommands.ts`'s
 * `openOrEscalateDeviationCase`) — so every query below resolves visibility
 * against `resourceType: 'kpi'` and joins the CTE on the relevant table's
 * `kpi_id` (directly for cases, via a join to the case for corrective
 * actions/verifications), exactly the same "PK-equivalent-for-visibility"
 * pattern `kpiRepository.listMeasurements` uses. `'deviation_case'` exists
 * in `RVN_RESOURCE_TYPES` for `aggregate_type`/future `object_type` use
 * (event envelopes above all use it), not because deviation cases carry
 * their own visibility row.
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  buildVisibilityScopedCte,
  wrapWithVisibilityScope,
  VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';

import {
  toCorrectiveAction,
  toDeviationCase,
  toEffectivenessVerification,
  type CorrectiveAction,
  type CorrectiveActionRow,
  type CorrectiveActionStatus,
  type DeviationCase,
  type DeviationCaseRow,
  type DeviationCaseStatus,
  type EffectivenessVerification,
  type EffectivenessVerificationRow,
} from './kpiDeviationTypes.js';

/** Same pinned-client-per-call shape as `kpiRepository.ts`'s
 * `withReadClient` — kept local rather than shared to avoid a cross-file
 * dependency for a two-line helper (`kpiRepository.ts` does not export it).
 */
async function withReadClient<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await acquirePgClient();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

async function queryRows<T extends QueryResultRow>(
  client: PoolClient,
  sql: string,
  values: unknown[]
): Promise<T[]> {
  const result = await client.query<T>(sql, values);
  return result.rows;
}

// ==========================================
// getDeviationCase
// ==========================================

export interface GetDeviationCaseParams {
  userId: string;
  organizationId: string;
  caseId: string;
}

export async function getDeviationCase(params: GetDeviationCaseParams): Promise<DeviationCase | null> {
  const { userId, organizationId, caseId } = params;

  const baseQuerySql = `
    SELECT dc.*
      FROM rvn_kpi_deviation_cases dc
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = dc.kpi_id
     WHERE dc.organization_id = $1
       AND dc.case_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;

  const wrapped = await wrapWithVisibilityScope(baseQuerySql, { userId, organizationId, resourceType: 'kpi' });
  const values = [...wrapped.values, caseId];

  const rows = await withReadClient((client) => queryRows<DeviationCaseRow>(client, wrapped.sql, values));
  const row = rows[0];
  return row ? toDeviationCase(row) : null;
}

// ==========================================
// listDeviationCases
// ==========================================

export interface ListDeviationCasesParams {
  userId: string;
  organizationId: string;
  kpiId?: string;
  status?: DeviationCaseStatus;
  ownerUserId?: string;
  escalatedOnly?: boolean;
  limit?: number;
  offset?: number;
}

export async function listDeviationCases(params: ListDeviationCasesParams): Promise<DeviationCase[]> {
  const { userId, organizationId, kpiId, status, ownerUserId, escalatedOnly, limit = 100, offset = 0 } = params;

  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const values: unknown[] = [...cte.values];
  const filters: string[] = [];

  if (kpiId) {
    values.push(kpiId);
    filters.push(`dc.kpi_id = $${values.length}`);
  }
  if (status) {
    values.push(status);
    filters.push(`dc.status = $${values.length}`);
  }
  if (ownerUserId) {
    values.push(ownerUserId);
    filters.push(`dc.owner_user_id = $${values.length}`);
  }
  if (escalatedOnly) {
    filters.push(`dc.escalated = true`);
  }

  values.push(limit);
  const limitParamIndex = values.length;
  values.push(offset);
  const offsetParamIndex = values.length;

  const baseQuerySql = `
    SELECT dc.*
      FROM rvn_kpi_deviation_cases dc
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = dc.kpi_id
     WHERE dc.organization_id = $1
       ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
     ORDER BY dc.detected_at DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const rows = await withReadClient((client) =>
    queryRows<DeviationCaseRow>(client, `${cte.sql}\n${baseQuerySql}`, values)
  );
  return rows.map(toDeviationCase);
}

// ==========================================
// listCorrectiveActions
// ==========================================

export interface ListCorrectiveActionsParams {
  userId: string;
  organizationId: string;
  deviationCaseId: string;
  status?: CorrectiveActionStatus;
  limit?: number;
  offset?: number;
}

export async function listCorrectiveActions(params: ListCorrectiveActionsParams): Promise<CorrectiveAction[]> {
  const { userId, organizationId, deviationCaseId, status, limit = 100, offset = 0 } = params;

  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const values: unknown[] = [...cte.values, deviationCaseId];
  const caseParamIndex = values.length;
  const filters: string[] = [`ca.deviation_case_id = $${caseParamIndex}`];

  if (status) {
    values.push(status);
    filters.push(`ca.status = $${values.length}`);
  }

  values.push(limit);
  const limitParamIndex = values.length;
  values.push(offset);
  const offsetParamIndex = values.length;

  // Corrective actions inherit visibility via their case's kpi_id, one join
  // further out than the case itself — see file header.
  const baseQuerySql = `
    SELECT ca.*
      FROM rvn_kpi_corrective_actions ca
      INNER JOIN rvn_kpi_deviation_cases dc ON dc.case_id = ca.deviation_case_id
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = dc.kpi_id
     WHERE ca.organization_id = $1
       AND ${filters.join(' AND ')}
     ORDER BY ca.created_at ASC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const rows = await withReadClient((client) =>
    queryRows<CorrectiveActionRow>(client, `${cte.sql}\n${baseQuerySql}`, values)
  );
  return rows.map(toCorrectiveAction);
}

// ==========================================
// listEffectivenessVerifications
// ==========================================

export interface ListEffectivenessVerificationsParams {
  userId: string;
  organizationId: string;
  deviationCaseId: string;
  limit?: number;
  offset?: number;
}

export async function listEffectivenessVerifications(
  params: ListEffectivenessVerificationsParams
): Promise<EffectivenessVerification[]> {
  const { userId, organizationId, deviationCaseId, limit = 50, offset = 0 } = params;

  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const values: unknown[] = [...cte.values, deviationCaseId, limit, offset];

  const baseQuerySql = `
    SELECT ev.*
      FROM rvn_kpi_effectiveness_verifications ev
      INNER JOIN rvn_kpi_deviation_cases dc ON dc.case_id = ev.deviation_case_id
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = dc.kpi_id
     WHERE ev.organization_id = $1
       AND ev.deviation_case_id = $${cte.values.length + 1}
     ORDER BY ev.created_at DESC
     LIMIT $${cte.values.length + 2} OFFSET $${cte.values.length + 3}
  `;

  return withReadClient(async (client) => {
    const verificationRows = await queryRows<EffectivenessVerificationRow>(
      client,
      `${cte.sql}\n${baseQuerySql}`,
      values
    );
    if (verificationRows.length === 0) return [];

    // Visibility was already established by the query above (a verification
    // row only came back if its case's KPI is visible) — this second query
    // is a plain join-table lookup, not a second visibility check.
    const verificationIds = verificationRows.map((row) => row.verification_id);
    const measurementLinks = await queryRows<{ verification_id: string; measurement_id: string }>(
      client,
      `SELECT verification_id, measurement_id
         FROM rvn_kpi_effectiveness_verification_measurements
        WHERE verification_id = ANY($1::uuid[])`,
      [verificationIds]
    );
    const measurementIdsByVerification = new Map<string, string[]>();
    for (const link of measurementLinks) {
      const list = measurementIdsByVerification.get(link.verification_id) ?? [];
      list.push(link.measurement_id);
      measurementIdsByVerification.set(link.verification_id, list);
    }

    return verificationRows.map((row) =>
      toEffectivenessVerification(row, measurementIdsByVerification.get(row.verification_id) ?? [])
    );
  });
}
