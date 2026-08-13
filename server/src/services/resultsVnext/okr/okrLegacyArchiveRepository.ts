/**
 * OKR-E008 Half C — Legacy Archive read repository.
 *
 * Design: docs/product/results-vnext/OKR_E008_DESIGN.md §5.3, table
 * inventory re-verified §2.1/§2.2 (direct grep against
 * `server/migrations/914_okr_management.sql` +
 * `server/migrations/20260803_res009_okr_key_result_definition_version.sql`).
 *
 * GET-only, read-only access to the 4 legacy OKR tables:
 *   - `okr_cycles`      — quarterly cycle, optionally dept/team-scoped.
 *   - `okr_objectives`  — has `parent_id` cascade rollup.
 *   - `okr_key_results` — carries `kpi_id`/`kpi_definition_version_id`, two
 *                         LIVE D09-violating FKs (→ `initiative_kpis`,
 *                         → `kpi_definition_versions`), informational-only
 *                         since 2026-07-12 (D7/Piotr) — never used for
 *                         scoring. `SELECT *` here deliberately includes
 *                         both columns; the warnings-array label is added at
 *                         the ROUTE layer (`okrLegacyArchive.routes.ts`), not
 *                         hidden here at the repo layer (design D-OKR8-19).
 *   - `okr_check_ins`   — deterministic `seq` tie-breaker
 *                         (`20260803_res009_okr_check_ins_deterministic_order.sql`).
 *
 * Owning live surface: `server/src/routes/resultsStrategic.routes.ts`
 * (`/:projectId/okr/*`) + `server/src/services/results/okrService.ts` — this
 * legacy system is LIVE, not dead (write endpoints exist, gated by
 * `requireProjectCapability(..., {shadow:true})` — shadow-only unless
 * `CAPABILITY_ENFORCE=enforce`). Label text says "live, external to Results
 * vNext" (design D-OKR8-18), not "archive — read-only" (which would be
 * misleading here).
 *
 * Zero imports from any `*Commands.ts` file, by design — this file only
 * ever reads, via the same pooled-client acquisition helper
 * `roiLegacyArchiveRepository.ts`/`kpiLegacyArchiveRepository.ts` use
 * (`acquirePgClient` from `PostgresDatabase.ts`).
 *
 * Table names are NEVER interpolated from a runtime argument — each
 * function hardcodes its own table, matching the two landed precedents'
 * explicit anti-SQL-injection discipline.
 *
 * All 4 tables carry `organization_id TEXT NOT NULL` directly (verified,
 * `914_okr_management.sql` lines 41-101) — simplest case of the three
 * domains, no join-through, no ::text cast needed (unlike ROI's
 * `analysis_financials`/`digitization_analyses` INTEGER-vs-TEXT gap).
 *
 * `resultsStrategic.routes.ts`'s own `ensureOkrTables()` independently
 * re-declares `okr_objectives`/`okr_key_results` at runtime (lazy-DDL) — the
 * live column set can exceed what `914_okr_management.sql` alone declares
 * (RES-009's later migration already proves this). `SELECT *` here always
 * reflects the table's REAL runtime columns, never a hardcoded column list,
 * so this repository never needs to track that drift.
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
// `okr_cycles` — live writer `resultsStrategic.routes.ts` (`POST
// /:projectId/okr/cycles`), service `okrService.ts`. id column: `id`
// (TEXT, DEFAULT gen_random_uuid()::text). organization_id: TEXT.
// ==========================================

export async function listLegacyOkrCycles(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM okr_cycles WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM okr_cycles WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyOkrCycle(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM okr_cycles WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `okr_objectives` — live writer `resultsStrategic.routes.ts` (`POST
// /:projectId/okr/objectives`), also lazy-DDL'd by `ensureOkrTables()`. id
// column: `id` (TEXT). organization_id: TEXT. Has `parent_id` cascade
// rollup (informational here, not resolved/joined).
// ==========================================

export async function listLegacyOkrObjectives(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM okr_objectives WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM okr_objectives WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyOkrObjective(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM okr_objectives WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `okr_key_results` — live writer `resultsStrategic.routes.ts` (`POST
// /:projectId/okr/objectives/:id/key-results`). id column: `id` (TEXT).
// organization_id: TEXT. Carries `kpi_id` (FK -> initiative_kpis, migration
// 914) and `kpi_definition_version_id` (FK -> kpi_definition_versions,
// migration 20260803_res009_okr_key_result_definition_version.sql) — TWO
// live D09-violating cross-domain FKs, informational-only since 2026-07-12
// (D7/Piotr), never used for scoring. `SELECT *` deliberately includes both
// — the caller-facing warnings array documenting this is added at the
// ROUTE layer (design D-OKR8-19), not hidden here.
// ==========================================

export async function listLegacyOkrKeyResults(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM okr_key_results WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM okr_key_results WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyOkrKeyResult(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM okr_key_results WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `okr_check_ins` — live writer `resultsStrategic.routes.ts` (`POST
// /:projectId/okr/key-results/:id/check-in`). id column: `id` (TEXT,
// DEFAULT gen_random_uuid()::text). organization_id: TEXT. Deterministic
// `seq` tie-breaker added by
// `20260803_res009_okr_check_ins_deterministic_order.sql` — ordering here
// still uses `created_at DESC` (matching the other 3 tables' convention);
// `seq` is available via `SELECT *` for a caller that needs the
// tie-breaker, not applied as a second ORDER BY column here.
// ==========================================

export async function listLegacyOkrCheckIns(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM okr_check_ins WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM okr_check_ins WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyOkrCheckIn(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM okr_check_ins WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// Index — one row per legacy source, COUNT(*) for that org, fixed order
// (design §5.3). Single bucket (D-OKR8-17): all 4 tables genuinely belong
// to ONE owning surface (resultsStrategic.routes.ts + okrService.ts),
// unlike ROI's 3 genuinely-separate live systems.
// ==========================================

export type OkrLegacyOriginDomain = 'okr_legacy_live';

export interface OkrLegacyArchiveIndexRow {
  sourceTable: string;
  routeKey: string;
  originDomain: OkrLegacyOriginDomain;
  label: string;
  count: number;
}

const OKR_LEGACY_LIVE_LABEL =
  "Legacy OKR (resultsStrategic.routes.ts /:projectId/okr/*) — live, external to Results vNext";

export async function getOkrLegacyArchiveIndex(organizationId: string): Promise<OkrLegacyArchiveIndexRow[]> {
  return withReadClient(async (client) => {
    const tables = [
      { routeKey: 'cycles', sourceTable: 'okr_cycles' },
      { routeKey: 'objectives', sourceTable: 'okr_objectives' },
      { routeKey: 'key-results', sourceTable: 'okr_key_results' },
      { routeKey: 'check-ins', sourceTable: 'okr_check_ins' },
    ] as const;
    const results: OkrLegacyArchiveIndexRow[] = [];
    for (const t of tables) {
      // Table name hardcoded per branch (never interpolated from `t.sourceTable`
      // as a runtime string) — see file header anti-SQL-injection discipline.
      let countRows: { total: number }[];
      switch (t.sourceTable) {
        case 'okr_cycles':
          countRows = await queryRows<{ total: number }>(
            client,
            `SELECT COUNT(*)::int AS total FROM okr_cycles WHERE organization_id = $1`,
            [organizationId]
          );
          break;
        case 'okr_objectives':
          countRows = await queryRows<{ total: number }>(
            client,
            `SELECT COUNT(*)::int AS total FROM okr_objectives WHERE organization_id = $1`,
            [organizationId]
          );
          break;
        case 'okr_key_results':
          countRows = await queryRows<{ total: number }>(
            client,
            `SELECT COUNT(*)::int AS total FROM okr_key_results WHERE organization_id = $1`,
            [organizationId]
          );
          break;
        case 'okr_check_ins':
          countRows = await queryRows<{ total: number }>(
            client,
            `SELECT COUNT(*)::int AS total FROM okr_check_ins WHERE organization_id = $1`,
            [organizationId]
          );
          break;
      }
      results.push({
        routeKey: t.routeKey,
        sourceTable: t.sourceTable,
        originDomain: 'okr_legacy_live',
        label: OKR_LEGACY_LIVE_LABEL,
        count: countRows[0]?.total ?? 0,
      });
    }
    return results;
  });
}
