/**
 * KPI-E007 — Legacy Archive read repository.
 *
 * Design: docs/product/results-vnext/KPI_E007_DESIGN.md §3.
 *
 * GET-only, read-only access to the 4 legacy/parallel KPI-definition tables
 * identified in the design's §0.1 inventory:
 *   - `kpis`                 — no live writer found; read by AI context
 *                              builders only.
 *   - `kpi_definitions`      — read by `results-kpi-reports.routes.ts` (a
 *                              live, read-only report surface).
 *   - `v8_kpi_definitions`   — written by `resultsROIService.ts`, called
 *                              only by the (admin-gated, self-cleaning)
 *                              Health Panel probe.
 *   - `tp_kpi_definitions`   — Table Platform / Governed Models, a
 *                              DIFFERENT, live, actively-used product that
 *                              happens to share the word "KPI" — NOT
 *                              KPI-Results legacy debt (§0.1's own
 *                              "Consequence" paragraph).
 *
 * Zero imports from any `*Commands.ts` file in the KPI domain, by design —
 * this file only ever reads, via the same pooled-client acquisition helper
 * `kpiRepository.ts` uses (`acquirePgClient` from `PostgresDatabase.ts`).
 *
 * Every query is tenant-scoped — `organization_id` (or, for
 * `tp_kpi_definitions`, the join chain that resolves to it — see the
 * DEVIATION note below) is always the first bound param, no exceptions.
 *
 * -- DEVIATION FROM DESIGN §3's PSEUDOCODE: the design's illustrative
 * `getLegacyArchiveIndex` snippet assumes `tp_kpi_definitions` has its own
 * `organization_id` column ("it may not be literally `organization_id` ...
 * verify before writing the WHERE clause, do not assume" — the design's own
 * explicit instruction). It does not. Read directly from
 * `server/migrations/713_governed_models.sql`:
 *   `tp_kpi_definitions.model_id` -> `tp_governed_models.model_id`
 *   `tp_governed_models.base_id`  -> `tp_bases.id`
 *   `tp_bases.organization_id`    (TEXT NOT NULL — this is where the column
 *                                   actually lives, confirmed against
 *                                   `server/migrations/700_table_platform_foundation.sql`)
 * `listLegacyTpKpiDefinitions`/`getLegacyTpKpiDefinition`/the index-count
 * branch below therefore join through `tp_governed_models`/`tp_bases` to
 * reach `organization_id`, rather than filtering a non-existent column
 * directly on `tp_kpi_definitions`. This is a real schema fact the design
 * doc could not verify from a git worktree (its own D1/D3 rationale) and
 * flagged as a required pre-write check — this is that check, done.
 *
 * `v8_kpi_definitions` is queried UNQUALIFIED (no `public.`/`v8.` schema
 * prefix) per Decision D1, matching `resultsROIService.ts`'s `getKPI`/
 * `updateKPIStatus` query shape exactly (`WHERE kpi_id = ... AND
 * organization_id = ...`) — that table's primary key column is `kpi_id`,
 * not `id` (verified against its DDL in
 * `server/migrations-v2/001_baseline_20260413.sql`).
 *
 * Table names below are NEVER interpolated from a runtime argument — each
 * function hardcodes its own table (and, for `tp_kpi_definitions`, its own
 * join chain) per the design's explicit anti-SQL-injection instruction ("do
 * not generalize into a `listLegacyTable(tableName: string, ...)` helper").
 */
import type { PoolClient, QueryResultRow } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';

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

export interface LegacyListResult<T> {
  rows: T[];
  total: number;
}

// ==========================================
// `kpis` — no live writer found (design §0.1).
//
// -- DEVIATION FOUND ON REAL POSTGRES (not in the design doc, not
// guessable from a git worktree): `kpis` is NOT a plain table on the
// forward migration path this program's ephemeral-Postgres recipe
// applies (`server/migrations/`, `server/scripts/migrate.postgres.ts`).
// It is a read-only compatibility VIEW, defined in
// `server/migrations/20260719_baseline_gap.sql`:
//   `CREATE OR REPLACE VIEW public.kpis AS
//      SELECT ik.id, i.organization_id, ik.name, NULL::real AS current_value,
//             ik.target_value, ik.unit, NULL::text AS trend_direction,
//             ik.measurement_frequency AS period, ik.updated_at
//        FROM initiative_kpis ik JOIN initiatives i ON ik.initiative_id = i.id`
// — i.e. it has NO `created_at` column (only `updated_at`) and its
// `organization_id` is sourced from the JOINed `initiatives` row, not from
// `initiative_kpis.organization_id` (which also exists but the view
// ignores it). `SELECT * FROM kpis ... ORDER BY created_at DESC` (this
// function's originally-written query, following the design's generic
// pseudocode) fails with `column "created_at" does not exist` against the
// real view — caught only by running this exact query on real Postgres
// (`tests/resultsVnext/kpi/legacyIsolation.realdb.test.ts`), never by
// `tsc` or a mocked test. Fixed here to `ORDER BY updated_at DESC`, the
// only timestamp column the view actually exposes. Being a
// multi-table-join view, `kpis` is also structurally NOT insertable/
// updatable/deletable — which costs this read-only archive nothing (every
// function below only ever SELECTs).
// ==========================================

export async function listLegacyKpis(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM kpis WHERE organization_id = $1 ORDER BY updated_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM kpis WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyKpi(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM kpis WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `kpi_definitions` — read by results-kpi-reports.routes.ts (design §0.1);
// id column: `id` (text)
// ==========================================

export async function listLegacyKpiDefinitions(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM kpi_definitions WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM kpi_definitions WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyKpiDefinition(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM kpi_definitions WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `v8_kpi_definitions` — written by resultsROIService.ts, health-probe-only
// (design §0.1); UNQUALIFIED per Decision D1; id column: `kpi_id` (text)
// ==========================================

export async function listLegacyV8KpiDefinitions(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM v8_kpi_definitions WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM v8_kpi_definitions WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyV8KpiDefinition(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM v8_kpi_definitions WHERE organization_id = $1 AND kpi_id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `tp_kpi_definitions` — Table Platform / Governed Models, live external
// product (design §0.1/Decision D3). NO `organization_id` column of its own
// — see file header DEVIATION note. Scoped via
// tp_kpi_definitions.model_id -> tp_governed_models.base_id -> tp_bases.organization_id.
// id column: `kpi_id` (uuid).
// ==========================================

const TP_KPI_DEFINITIONS_ORG_SCOPED_FROM = `
  FROM tp_kpi_definitions k
  INNER JOIN tp_governed_models m ON m.model_id = k.model_id
  INNER JOIN tp_bases b ON b.id = m.base_id
`;

export async function listLegacyTpKpiDefinitions(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT k.* ${TP_KPI_DEFINITIONS_ORG_SCOPED_FROM}
       WHERE b.organization_id = $1
       ORDER BY k.created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total ${TP_KPI_DEFINITIONS_ORG_SCOPED_FROM} WHERE b.organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyTpKpiDefinition(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT k.* ${TP_KPI_DEFINITIONS_ORG_SCOPED_FROM} WHERE b.organization_id = $1 AND k.kpi_id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// Index — one row per legacy source, COUNT(*) for that org, fixed order
// (design §2.3)
// ==========================================

export interface LegacyArchiveIndexRow {
  sourceTable: string;
  originDomain: 'results_legacy' | 'table_platform_live';
  label: string;
  count: number;
}

export async function getLegacyArchiveIndex(organizationId: string): Promise<LegacyArchiveIndexRow[]> {
  return withReadClient(async (client) => {
    const results: LegacyArchiveIndexRow[] = [];

    const kpisCount = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM kpis WHERE organization_id = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'kpis',
      originDomain: 'results_legacy',
      label: 'Legacy archive — read-only',
      count: kpisCount[0]?.total ?? 0,
    });

    const kpiDefinitionsCount = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM kpi_definitions WHERE organization_id = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'kpi_definitions',
      originDomain: 'results_legacy',
      label: 'Legacy archive — read-only',
      count: kpiDefinitionsCount[0]?.total ?? 0,
    });

    const v8Count = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM v8_kpi_definitions WHERE organization_id = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'v8_kpi_definitions',
      originDomain: 'results_legacy',
      label: 'Legacy archive — read-only',
      count: v8Count[0]?.total ?? 0,
    });

    const tpCount = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total ${TP_KPI_DEFINITIONS_ORG_SCOPED_FROM} WHERE b.organization_id = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'tp_kpi_definitions',
      originDomain: 'table_platform_live',
      label: 'Table Platform — live, external to Results',
      count: tpCount[0]?.total ?? 0,
    });

    return results;
  });
}
