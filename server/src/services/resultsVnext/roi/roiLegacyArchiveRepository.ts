/**
 * ROI-E008 — Legacy Archive read repository.
 *
 * Design: docs/product/results-vnext/ROI_E008_DESIGN.md §3/B1, table
 * inventory §B0.
 *
 * GET-only, read-only access to the 7 legacy/parallel ROI tables identified
 * in the design's §B0 inventory:
 *   - `analysis_financials`         — Initiatives module `/roi`, live.
 *   - `digitization_analyses`       — Initiatives module `/roi`, live.
 *   - `initiative_benefits`         — Legacy Benefits, live.
 *   - `roi_assumptions`             — Results V8 `/api/v8/results/roi/*`, live.
 *   - `roi_realized_values`         — Results V8, live, append-only.
 *   - `benefits_register`           — Benefits Register (M14→M15), live.
 *   - `v8_roi_realization_entries`  — V8 Results/ROI Continuity, live.
 *
 * Zero imports from any `*Commands.ts` file, by design — this file only
 * ever reads, via the same pooled-client acquisition helper
 * `roiPirRepository.ts`/`kpiLegacyArchiveRepository.ts` use
 * (`acquirePgClient` from `PostgresDatabase.ts`).
 *
 * Table names are NEVER interpolated from a runtime argument — each
 * function hardcodes its own table, matching `kpiLegacyArchiveRepository
 * .ts`'s own explicit anti-SQL-injection discipline.
 *
 * -- DEVIATION FOUND ON REAL POSTGRES (not in the design doc, not
 * guessable from a git worktree — same class of gap KPI-E007 found for the
 * `kpis` view): `analysis_financials`/`digitization_analyses` do NOT have a
 * TEXT `organization_id` column, as the design's §B0 table implicitly
 * assumed (it only names the PK column, not every column's type).
 * `organization_id` on BOTH tables is `INTEGER` (`068_economics_analysis_
 * financials.sql`/`060_digitization_analyses.sql`), while `organizations.id`
 * — and every `organizationId` value this repository is ever called with —
 * is `TEXT` (`000_z_core_baseline.sql`). Binding a TEXT organizationId
 * directly against an INTEGER column raises `operator does not exist:
 * integer = text` on real Postgres. A `20260628_ensure_digitization_
 * analyses.sql` migration attempted to fix this for `digitization_analyses`
 * with its own `CREATE TABLE IF NOT EXISTS ... organization_id TEXT`, but
 * because it is a DATED migration it runs AFTER the NUMBERED `060_...sql`
 * migration that already created the table with the INTEGER column — a
 * no-op, the fix never actually applies (verified against
 * `server/scripts/migrate.postgres.ts`'s numbered-then-dated execution
 * order). Both functions below therefore cast the column
 * (`organization_id::text = $1`) rather than bind-comparing directly —
 * this never raises a type error, and correctly returns zero rows for
 * every real (non-numeric-string) organizationId, which is the honest
 * behaviour for a column that in practice never holds a value equal to any
 * real TEXT org id. All 5 other tables have a genuine TEXT
 * `organization_id` column and are queried directly, no cast needed.
 *
 * `v8_roi_realization_entries` is queried UNQUALIFIED (no `public.`/`v8.`
 * schema prefix) per Decision D9 — it exists in both `public.` and `v8.`
 * schemas (verified: `20260323_v8_results_roi.sql` creates `public.
 * v8_roi_realization_entries`; `20260719_baseline_gap.sql` separately
 * creates `v8.v8_roi_realization_entries` with identical columns), matching
 * `resultsROIService.ts`'s own unqualified query shape exactly — the live
 * connection's `search_path` (`PostgresDatabase.ts`) puts `public` first,
 * so an unqualified query resolves to the SAME table the live writer
 * (`resultsROIService.ts:501`) uses. Primary key is `entry_id`, not `id`.
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
// `analysis_financials` — Initiatives module `/roi`, live writer
// (`economics.routes.ts`, re-confirmed per D16 — see routes file header).
// id column: `id` (text). organization_id: INTEGER, cast to text (see
// file header DEVIATION note).
// ==========================================

export async function listLegacyAnalysisFinancials(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM analysis_financials WHERE organization_id::text = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM analysis_financials WHERE organization_id::text = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyAnalysisFinancial(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM analysis_financials WHERE organization_id::text = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `digitization_analyses` — Initiatives module `/roi`, live writer
// (`economics.routes.ts:28` INSERT). id column: `id` (text).
// organization_id: INTEGER, cast to text (see file header DEVIATION note).
// ==========================================

export async function listLegacyDigitizationAnalyses(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM digitization_analyses WHERE organization_id::text = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM digitization_analyses WHERE organization_id::text = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyDigitizationAnalysis(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM digitization_analyses WHERE organization_id::text = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `initiative_benefits` — Legacy Benefits, live writers
// (`benefitsRegister.routes.ts`, `finance-statements.routes.ts`,
// `v8/results.routes.ts`). id column: `id` (text). organization_id: TEXT.
// ==========================================

export async function listLegacyInitiativeBenefits(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM initiative_benefits WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM initiative_benefits WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyInitiativeBenefit(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM initiative_benefits WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `roi_assumptions` — Results V8 `/api/v8/results/roi/*`, live writers
// (`benefits.routes.ts:1449`, `v8/results.routes.ts:3098` INSERT). id
// column: `id` (text). organization_id: TEXT.
// ==========================================

export async function listLegacyRoiAssumptions(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM roi_assumptions WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM roi_assumptions WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyRoiAssumption(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM roi_assumptions WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `roi_realized_values` — Results V8, live writer
// (`benefits.routes.ts:1527` INSERT), append-only (no `updated_at`). id
// column: `id` (text). organization_id: TEXT.
// ==========================================

export async function listLegacyRoiRealizedValues(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM roi_realized_values WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM roi_realized_values WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyRoiRealizedValue(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM roi_realized_values WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `benefits_register` — Benefits Register (M14→M15), live writer
// (`benefitsRegister.routes.ts` POST). id column: `id` (TEXT).
// organization_id: TEXT.
// ==========================================

export async function listLegacyBenefitsRegister(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM benefits_register WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM benefits_register WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyBenefitsRegisterEntry(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM benefits_register WHERE organization_id = $1 AND id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// `v8_roi_realization_entries` — V8 Results/ROI Continuity, live writer
// (`resultsROIService.ts:501` INSERT), UNQUALIFIED per Decision D9 (see
// file header). PK column: `entry_id`, NOT `id`. organization_id: TEXT.
// ==========================================

export async function listLegacyV8RoiRealizationEntries(
  organizationId: string,
  limit: number,
  offset: number
): Promise<LegacyListResult<Record<string, unknown>>> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM v8_roi_realization_entries WHERE organization_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [organizationId, limit, offset]
    );
    const countRows = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM v8_roi_realization_entries WHERE organization_id = $1`,
      [organizationId]
    );
    return { rows, total: countRows[0]?.total ?? 0 };
  });
}

export async function getLegacyV8RoiRealizationEntry(
  organizationId: string,
  legacyId: string
): Promise<Record<string, unknown> | null> {
  return withReadClient(async (client) => {
    const rows = await queryRows(
      client,
      `SELECT * FROM v8_roi_realization_entries WHERE organization_id = $1 AND entry_id = $2`,
      [organizationId, legacyId]
    );
    return rows[0] ?? null;
  });
}

// ==========================================
// Index — one row per legacy source, COUNT(*) for that org, fixed order
// (design §B1)
// ==========================================

export type RoiLegacyOriginDomain = 'initiatives_module_live' | 'results_v8_live' | 'finance_benefits_live';

export interface RoiLegacyArchiveIndexRow {
  sourceTable: string;
  originDomain: RoiLegacyOriginDomain;
  label: string;
  count: number;
}

export async function getRoiLegacyArchiveIndex(organizationId: string): Promise<RoiLegacyArchiveIndexRow[]> {
  return withReadClient(async (client) => {
    const results: RoiLegacyArchiveIndexRow[] = [];

    const analysisFinancialsCount = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM analysis_financials WHERE organization_id::text = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'analysis_financials',
      originDomain: 'initiatives_module_live',
      label: "Initiatives module `/roi` — live, external to Results vNext",
      count: analysisFinancialsCount[0]?.total ?? 0,
    });

    const digitizationAnalysesCount = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM digitization_analyses WHERE organization_id::text = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'digitization_analyses',
      originDomain: 'initiatives_module_live',
      label: "Initiatives module `/roi` — live, external to Results vNext",
      count: digitizationAnalysesCount[0]?.total ?? 0,
    });

    const initiativeBenefitsCount = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM initiative_benefits WHERE organization_id = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'initiative_benefits',
      originDomain: 'finance_benefits_live',
      label: 'Legacy Benefits (initiative_benefits) — live, external to Results vNext',
      count: initiativeBenefitsCount[0]?.total ?? 0,
    });

    const roiAssumptionsCount = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM roi_assumptions WHERE organization_id = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'roi_assumptions',
      originDomain: 'results_v8_live',
      label: "Results V8 `/api/v8/results/roi` — live, external to Results vNext",
      count: roiAssumptionsCount[0]?.total ?? 0,
    });

    const roiRealizedValuesCount = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM roi_realized_values WHERE organization_id = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'roi_realized_values',
      originDomain: 'results_v8_live',
      label: "Results V8 `/api/v8/results/roi` — live, external to Results vNext",
      count: roiRealizedValuesCount[0]?.total ?? 0,
    });

    const benefitsRegisterCount = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM benefits_register WHERE organization_id = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'benefits_register',
      originDomain: 'finance_benefits_live',
      label: 'Benefits Register (M14→M15) — live, external to Results vNext',
      count: benefitsRegisterCount[0]?.total ?? 0,
    });

    const v8RoiRealizationEntriesCount = await queryRows<{ total: number }>(
      client,
      `SELECT COUNT(*)::int AS total FROM v8_roi_realization_entries WHERE organization_id = $1`,
      [organizationId]
    );
    results.push({
      sourceTable: 'v8_roi_realization_entries',
      originDomain: 'results_v8_live',
      label: 'Results V8 ROI Continuity — live, external to Results vNext',
      count: v8RoiRealizationEntriesCount[0]?.total ?? 0,
    });

    return results;
  });
}
