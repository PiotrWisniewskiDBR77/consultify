/**
 * KPI-E001/E002 — read repository.
 *
 * Design: docs/product/results-vnext/KPI_E001_E002_DESIGN.md, "Files to
 * create" table: "`listKpis`/`getKpi`/`listMeasurements` via
 * `buildVisibilityScopedCte`/`wrapWithVisibilityScope` only" — i.e. this
 * file is the first real caller of `platform/visibilityScopedQuery.ts`
 * (§B.4), which was inert scaffolding with an illustrative-only example
 * (this exact file, `kpiRepository.ts`, named as "hypothetical" there)
 * until now.
 *
 * ALL THREE functions below go through `wrapWithVisibilityScope` — even
 * `getKpi` (a single-resource fetch, which `visibilityResolver.ts`'s
 * `resolveVisibility()` could also answer). The design doc's instruction is
 * explicit ("never a raw WHERE") and keeping every read on the same CTE
 * code path is what makes "forgot the visibility filter" structurally
 * harder here, exactly the threat-model rationale
 * `visibilityScopedQuery.ts`'s own header comment gives (T3, EXECUTION_LEDGER
 * §4.3) — a `getKpi` that quietly used `resolveVisibility()` instead would
 * be a second, easier-to-forget code path doing the same job.
 *
 * `rvn_kpi_definition_versions` and `rvn_kpi_measurements` have NO row of
 * their own in `rvn_platform_resource_visibility` (design doc "Key points":
 * "Only `rvn_kpi_definitions` gets a row ... versions/measurements inherit
 * visibility via `kpi_id`") — so `listMeasurements`'s mandatory
 * `INNER JOIN rvn_visible_resources` joins on `m.kpi_id`, NOT
 * `m.measurement_id`, per `visibilityScopedQuery.ts`'s own contract comment
 * ("INNER JOIN ... ON rvn_visible_resources.resource_id = <caller's PK
 * column>" — here that PK-equivalent-for-visibility-purposes is `kpi_id`,
 * because that's the column that actually appears as `resource_id` in
 * `rvn_platform_resource_visibility` for this whole family of rows).
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import {
  buildVisibilityScopedCte,
  wrapWithVisibilityScope,
  VISIBILITY_CTE_PARAM_COUNT,
} from '../platform/visibilityScopedQuery.js';

import {
  toKpiDefinition,
  toKpiMeasurement,
  type KpiDefinition,
  type KpiDefinitionRow,
  type KpiMeasurement,
  type KpiMeasurementRow,
  type KpiStatus,
} from './kpiTypes.js';

/**
 * This whole module family (`visibilityResolver.ts`, `visibilityScopedQuery.ts`)
 * reads via a pinned `acquirePgClient()` client rather than an exported
 * shared pool — `PostgresDatabase.ts`'s `getPool()` is module-private by
 * design (only `acquirePgClient()`/`getPoolClientForPinnedTransaction()` are
 * exported as the sanctioned ways to reach a connection). No BEGIN/COMMIT is
 * needed for a read, but the pinned-client shape is kept here for the same
 * reason `visibilityResolver.ts`'s header comment gives: consistency across
 * this module family. Every function below acquires-and-releases its own
 * client rather than sharing one across calls.
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
// listKpis
// ==========================================

export interface ListKpisParams {
  userId: string;
  organizationId: string;
  status?: KpiStatus;
  limit?: number;
  offset?: number;
}

export async function listKpis(params: ListKpisParams): Promise<KpiDefinition[]> {
  const { userId, organizationId, status, limit = 100, offset = 0 } = params;

  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const values: unknown[] = [...cte.values];
  const filters: string[] = [];

  if (status) {
    values.push(status);
    filters.push(`kd.status = $${values.length}`);
  }

  values.push(limit);
  const limitParamIndex = values.length;
  values.push(offset);
  const offsetParamIndex = values.length;

  const baseQuerySql = `
    SELECT kd.*
      FROM rvn_kpi_definitions kd
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
     WHERE kd.organization_id = $1
       ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
     ORDER BY kd.updated_at DESC
     LIMIT $${limitParamIndex} OFFSET $${offsetParamIndex}
  `;

  const rows = await withReadClient((client) =>
    queryRows<KpiDefinitionRow>(client, `${cte.sql}\n${baseQuerySql}`, values)
  );
  return rows.map(toKpiDefinition);
}

// ==========================================
// getKpi
// ==========================================

export interface GetKpiParams {
  userId: string;
  organizationId: string;
  kpiId: string;
}

export async function getKpi(params: GetKpiParams): Promise<KpiDefinition | null> {
  const { userId, organizationId, kpiId } = params;

  const baseQuerySql = `
    SELECT kd.*
      FROM rvn_kpi_definitions kd
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = kd.kpi_id::text
     WHERE kd.organization_id = $1
       AND kd.kpi_id = $${VISIBILITY_CTE_PARAM_COUNT + 1}
  `;

  const wrapped = await wrapWithVisibilityScope(baseQuerySql, {
    userId,
    organizationId,
    resourceType: 'kpi',
  });
  const values = [...wrapped.values, kpiId];

  const rows = await withReadClient((client) =>
    queryRows<KpiDefinitionRow>(client, wrapped.sql, values)
  );
  const row = rows[0];
  return row ? toKpiDefinition(row) : null;
}

// ==========================================
// listMeasurements
// ==========================================

export interface ListMeasurementsParams {
  userId: string;
  organizationId: string;
  kpiId: string;
  /** When `false` (default), only "current" rows are returned — the latest
   * row per period (an original if never corrected/verified/disputed,
   * otherwise the most recent superseding row for that period). When
   * `true`, every row (full append-only history, including every
   * correction/verify/dispute) is returned. */
  includeSuperseded?: boolean;
  periodStart?: string;
  periodEnd?: string;
  limit?: number;
  offset?: number;
}

export async function listMeasurements(params: ListMeasurementsParams): Promise<KpiMeasurement[]> {
  const {
    userId,
    organizationId,
    kpiId,
    includeSuperseded = false,
    periodStart,
    periodEnd,
    limit = 200,
    offset = 0,
  } = params;

  const cte = await buildVisibilityScopedCte({ userId, organizationId, resourceType: 'kpi' });
  const values: unknown[] = [...cte.values, kpiId];
  const kpiParamIndex = values.length;
  const filters: string[] = [`m.kpi_id = $${kpiParamIndex}`];

  if (periodStart) {
    values.push(periodStart);
    filters.push(`m.period_start >= $${values.length}`);
  }
  if (periodEnd) {
    values.push(periodEnd);
    filters.push(`m.period_end <= $${values.length}`);
  }

  // "Current" view: latest row per period, walking the
  // correction_of_measurement_id chain forward via a recursive CTE would be
  // the fully general form; for this package's scope (no deep correction
  // chains expected yet) the simpler, equivalent rule is "the most recently
  // recorded row whose period matches, OR — if none was ever superseded for
  // that period — the single original row", implemented as: keep rows with
  // correction_of_measurement_id IS NOT NULL when they are the newest for
  // their (kpi_id, period_start, period_end), and drop the original row
  // they superseded.
  const currentOnlyClause = includeSuperseded
    ? ''
    : `AND NOT EXISTS (
         SELECT 1 FROM rvn_kpi_measurements newer
          WHERE newer.correction_of_measurement_id = m.measurement_id
       )`;

  const baseQuerySql = `
    SELECT m.*
      FROM rvn_kpi_measurements m
      INNER JOIN rvn_visible_resources vr
              ON vr.resource_type = 'kpi' AND vr.resource_id = m.kpi_id::text
     WHERE ${filters.join(' AND ')}
       ${currentOnlyClause}
     ORDER BY m.period_start DESC, m.recorded_at DESC
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}
  `;
  values.push(limit, offset);

  const rows = await withReadClient((client) =>
    queryRows<KpiMeasurementRow>(client, `${cte.sql}\n${baseQuerySql}`, values)
  );
  return rows.map(toKpiMeasurement);
}
