/**
 * Finance v3 canonical — Analysis KPI compute orchestration (Gate D / Fala 4, WP-D04).
 *
 * Program: `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 6.
 * Schema: `WP-D03_analysis_schema_ADR.md` sections 4 (tables), 7 (readiness
 * gate), 8.1-8.2 (lifecycle/compute-run sequencing) — this module is the
 * "compute engine" that ADR explicitly left unimplemented (section 6.3,
 * section 11 pkt 1's Layer-2 caveat is about currency preflight, not this
 * module's Layer-1 formula evaluation, which this file DOES implement).
 *
 * Orchestrates, for one Analysis Definition Version (`business_version_id`
 * with `finance_artifacts.artifact_type='HISTORICAL_ANALYSIS'`):
 *   1. Resolve the exact source Statement Pack Version via
 *      `finance_lineage_edges` (`edge_type='STATEMENT_TO_ANALYSIS'`) — ADR
 *      section 2.3, never a denormalized column.
 *   2. Load the period graph / entity map / canonical-line-taxonomy map /
 *      `finance_stmt_lines` cell map for that source version once.
 *   3. For every `finance_analysis_kpi_values` row already pre-created for
 *      this Analysis (ADR section 4.4 — row PRESENCE is KPI/period
 *      SELECTION, this module never inserts new selection rows, only
 *      computes into existing ones), build a `CellResolver` +
 *      `DynamicConstantResolver` anchored at that row's own `(entity_id,
 *      period_id)`, run `formulaAstEvaluator.evaluateFormula()`, and UPDATE
 *      the row.
 *   4. Wrap the whole run in a `compute_jobs` row,
 *      `job_type='ANALYSIS_KPI_COMPUTE'` (ADR section 8.2 — "nowy job_type,
 *      ten sam compute_jobs", reusing `computeJobService.ts` from Gate C
 *      as-is).
 *   5. After a successful compute, check `finance_analysis_is_ready_for_review()`
 *      (WP-D03b file 4) and — only if the caller opted in AND the gate
 *      passes — call `artifactVersionService.transition()`'s T2
 *      (`submit_for_review`) to move DRAFT -> READY_FOR_REVIEW (ADR section
 *      7's own "if all required KPI have a value and the gate passes, the
 *      artifact may move to READY_FOR_REVIEW" instruction from this work
 *      package's brief).
 *
 * A NOTE ON "MISSING_INPUT" (brief scope item 1 mentions it as an example
 * `quality_flag`): the real DB CHECK on `finance_analysis_kpi_values.quality_flag`
 * (`20260809_finance_v3_d03_analysis_01_tables.sql`) only allows
 * `DIVISION_BY_ZERO`/`NEGATIVE_DENOMINATOR`/`INSUFFICIENT_HISTORY`/
 * `ESTIMATED_ANNUALIZED` — there is no `MISSING_INPUT` value in the schema.
 * Attempting to write it would be a CHECK-constraint violation caught the
 * moment this module runs against a real Postgres (exactly the "verify
 * REALNY runtime" class of bug CLAUDE.md's golden rule exists for). A
 * missing required input therefore surfaces as `value_status='MISSING'`
 * (never a fabricated `0`, per WP-D01's own `statementMappingService.ts`
 * doctrine, reused verbatim here) with a human-readable `interpretation_text`
 * — never a silent number, just expressed through the column the schema
 * actually gives this fact (`value_status`), not through `quality_flag`.
 */

import { createHash, randomUUID as uuidv4 } from 'node:crypto';

import { withPinnedPostgresTransaction } from '../../../database/PostgresDatabase.js';
import * as artifactVersionService from './artifactVersionService.js';
import { canonicalPayloadHash } from './contentHash.js';
import type { BusinessVersionRow, TransitionServiceResult } from './artifactVersionService.js';
import * as computeJobService from './computeJobService.js';
import type { ComputeJobRow } from './computeJobService.js';
import {
  evaluateFormula,
  type CellRefOperand,
  type CellResolution,
  type CellResolver,
  type DynamicConstantResolver,
  type EvalContext,
  type EvaluationResult,
  type FormulaNode,
  type FormulaRefResolver,
  type NegativeDenominatorPolicy,
} from './formulaAstEvaluator.js';
import type { FinanceRole } from './lifecycleService.js';
import {
  annualizationFactor,
  daysInPeriod,
  resolvePeriodOffset,
  type PeriodGraphLookup,
  type PeriodMeta,
} from './periodConventionResolver.js';

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

export interface KpiCatalogRow {
  id: string;
  kpi_code: string;
  catalog_version: number;
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
  tier: 'UNIVERSAL' | 'INDUSTRY' | 'ORG_CUSTOM';
  category: string;
  kpi_name: string;
  unit_type: string;
  formula_ast: FormulaNode;
  compile_status: 'COMPILED_OK' | 'COMPILE_ERROR' | null;
  resolved_output_unit: string | null;
  period_convention: string;
  negative_denominator_policy: NegativeDenominatorPolicy;
  required_canonical_line_codes: string[];
}

export interface KpiValueRow {
  id: string;
  organization_id: string;
  business_version_id: string;
  kpi_catalog_id: string;
  entity_id: string;
  period_id: string;
  value_status: string;
  value_decimal: string | null;
  quality_flag: string | null;
}

interface StmtLineCell {
  status: 'PRESENT_NONZERO' | 'PRESENT_ZERO' | 'MISSING' | 'NA' | 'NOT_APPLICABLE';
  value: number | null;
}

// finance_stmt_lines.accumulation_basis priority when more than one row exists for the same
// (entity, canonical_line, period, scope) cell (uq_finance_stmt_lines_cell includes
// accumulation_basis, so this is a real possibility, e.g. a pack that carries both a YTD and a
// FULL_YEAR row for the same annual period) — annual KPI compute prefers the FULL_YEAR figure.
const ACCUMULATION_BASIS_PRIORITY = ['FULL_YEAR', 'LTM', 'YTD', 'QUARTER_ONLY'];

function cellKey(entityId: string, canonicalLineId: string, periodId: string, consolidationScope: string): string {
  return [entityId, canonicalLineId, periodId, consolidationScope].join('::');
}

// ---------------------------------------------------------------------------
// Loaders — one round trip each, reused across every row this compute run touches.
// ---------------------------------------------------------------------------

async function loadPeriodGraph(organizationId: string): Promise<Map<string, PeriodMeta>> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{
      period_id: string;
      period_type: PeriodMeta['periodType'];
      fiscal_year: number;
      fiscal_quarter: number | null;
      fiscal_month: number | null;
      period_start: string | Date;
      period_end: string | Date;
      previous_period_id: string | null;
    }>(
      `SELECT period_id, period_type, fiscal_year, fiscal_quarter, fiscal_month, period_start, period_end, previous_period_id
         FROM finance_stmt_periods WHERE organization_id = ?`,
      [organizationId]
    )
  );
  const map = new Map<string, PeriodMeta>();
  for (const r of rows) {
    map.set(r.period_id, {
      periodId: r.period_id,
      periodType: r.period_type,
      fiscalYear: r.fiscal_year,
      fiscalQuarter: r.fiscal_quarter,
      fiscalMonth: r.fiscal_month,
      periodStart: toIsoDate(r.period_start),
      periodEnd: toIsoDate(r.period_end),
      previousPeriodId: r.previous_period_id,
    });
  }
  return map;
}

/** `node-postgres`'s default type parser returns a DATE column as a JS `Date` (UTC midnight), not
 *  the ISO `'YYYY-MM-DD'` string `PeriodMeta.periodStart`/`periodEnd` (`periodConventionResolver.ts`)
 *  documents as its contract — normalize once here rather than pushing driver-shape ambiguity into
 *  that pure module. A plain string (e.g. from a mocked resolver in a unit test) passes through
 *  unchanged. */
function toIsoDate(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value;
}

async function loadEntityCodeMap(sourceBusinessVersionId: string): Promise<Map<string, string>> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ id: string; entity_code: string }>(
      `SELECT id, entity_code FROM finance_stmt_entities WHERE business_version_id = ?`,
      [sourceBusinessVersionId]
    )
  );
  return new Map(rows.map((r) => [r.entity_code, r.id]));
}

/** Org-specific taxonomy rows win over global system rows for the same `line_code` — same precedence `statementMappingService.ts` already uses for `(statement_type, line_code)`. `formula_ast` cell_ref operands only carry `canonicalLineCode` (no `statementType`, per the ADR section 5.2 CellRefOperand schema), so this map is keyed by `line_code` alone; the P0 catalog's 19 canonical codes are unique across statement types by taxonomy convention (ADR section 5.3's own closing note). */
async function loadCanonicalLineMap(organizationId: string): Promise<Map<string, string>> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{ id: string; line_code: string; organization_id: string | null }>(
      `SELECT id, line_code, organization_id FROM financial_statement_lines
        WHERE organization_id IS NULL OR organization_id = ?
        ORDER BY organization_id NULLS FIRST`,
      [organizationId]
    )
  );
  const map = new Map<string, string>();
  for (const r of rows) map.set(r.line_code, r.id); // later (org-specific) rows overwrite global rows for the same code
  return map;
}

/** RC-04 (REAL_COMPANY_PROOF_report.md §5) — `finance_stmt_lines.sign_convention` was written by
 *  the mapping layer but never read here, so a real filed statement pack that carries its costs
 *  with the as-filed negative sign (Apator FY2024 COGS = −913 065 tys. PLN, declared
 *  `sign_convention='CONTRA'`) fed a NEGATIVE denominator into DIO/DPO, whose
 *  `negative_denominator_policy='FORCE_NA'` then silenced both KPI as `NOT_APPLICABLE`. The
 *  analyst's only escape was to physically flip the sign in the pack, destroying the "as filed"
 *  value. `CONTRA` means exactly "this line is stored with the opposite sign to its natural
 *  accounting direction", so applying it on read is the whole point of storing it — the same
 *  reading the elimination-balance trigger already does in SQL
 *  (`20260809_finance_v3_d01_statements_02_integrity.sql` §8.5:
 *  `SUM(CASE WHEN sign_convention = 'CONTRA' THEN -value_decimal ELSE value_decimal END)`).
 *  `value_status` is deliberately NOT recomputed: negating a value never turns a PRESENT_NONZERO
 *  into a PRESENT_ZERO or a MISSING into anything. */
function applySignConvention(value: number | null, signConvention: string | null): number | null {
  if (value === null) return null;
  return signConvention === 'CONTRA' ? -value : value;
}

async function loadStmtLineCells(sourceBusinessVersionId: string): Promise<Map<string, StmtLineCell>> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<{
      entity_id: string;
      canonical_line_id: string;
      period_id: string;
      consolidation_scope: string;
      accumulation_basis: string;
      value_status: StmtLineCell['status'];
      value_decimal: string | null;
      sign_convention: string | null;
    }>(
      `SELECT entity_id, canonical_line_id, period_id, consolidation_scope, accumulation_basis, value_status, value_decimal,
              sign_convention
         FROM finance_stmt_lines WHERE business_version_id = ?`,
      [sourceBusinessVersionId]
    )
  );
  const byKey = new Map<string, { basisPriority: number; cell: StmtLineCell }>();
  for (const r of rows) {
    const key = cellKey(r.entity_id, r.canonical_line_id, r.period_id, r.consolidation_scope);
    const priority = ACCUMULATION_BASIS_PRIORITY.indexOf(r.accumulation_basis);
    const rank = priority === -1 ? ACCUMULATION_BASIS_PRIORITY.length : priority;
    const existing = byKey.get(key);
    if (!existing || rank < existing.basisPriority) {
      byKey.set(key, {
        basisPriority: rank,
        cell: {
          status: r.value_status,
          value: applySignConvention(r.value_decimal === null ? null : Number(r.value_decimal), r.sign_convention),
        },
      });
    }
  }
  const out = new Map<string, StmtLineCell>();
  for (const [key, { cell }] of byKey) out.set(key, cell);
  return out;
}

async function loadActiveCatalogByCode(organizationId: string): Promise<Map<string, KpiCatalogRow>> {
  const rows = await withPinnedPostgresTransaction((tx) =>
    tx.queryAll<KpiCatalogRow & { formula_ast: unknown }>(
      `SELECT id, kpi_code, catalog_version, status, tier, category, kpi_name, unit_type, formula_ast,
              compile_status, resolved_output_unit, period_convention, negative_denominator_policy,
              required_canonical_line_codes
         FROM finance_analysis_kpi_catalog
        WHERE status = 'ACTIVE' AND (tier != 'ORG_CUSTOM' OR organization_id = ?)`,
      [organizationId]
    )
  );
  const map = new Map<string, KpiCatalogRow>();
  for (const r of rows) {
    map.set(r.kpi_code, { ...r, formula_ast: r.formula_ast as FormulaNode });
  }
  return map;
}

// ---------------------------------------------------------------------------
// Pakiet B2 — thin readers (DEC-FIN-012), additive to this file so they stay
// co-located with the row shapes/queries they mirror (`loadActiveCatalogByCode`
// above, `finance_analysis_kpi_values` reads inside `computeAnalysisKpis`).
// No domain logic: org-scoped SELECTs only, same tier-visibility rule
// `loadActiveCatalogByCode` already enforces (`tier != 'ORG_CUSTOM' OR
// organization_id = ?`) reused verbatim so the catalog a client browses and
// the catalog the compute engine actually resolves against never diverge.
// ---------------------------------------------------------------------------

export interface KpiCatalogListRow extends KpiCatalogRow {
  organization_id: string | null;
  industry_code: string | null;
  description: string | null;
}

export interface ListKpiCatalogOptions {
  /** Default: only ACTIVE rows (what compute actually uses). Pass `includeAllStatuses: true` to also see DRAFT/DEPRECATED. */
  includeAllStatuses?: boolean;
  tier?: 'UNIVERSAL' | 'INDUSTRY' | 'ORG_CUSTOM';
}

/** Three-layer catalog (universal / industry / org-custom), WP-D03 §3. Read-only mirror of `loadActiveCatalogByCode`'s own WHERE clause — see that function for why `tier != 'ORG_CUSTOM' OR organization_id = ?` is the whole visibility rule. */
export async function listKpiCatalog(organizationId: string, options: ListKpiCatalogOptions = {}): Promise<KpiCatalogListRow[]> {
  const conditions: string[] = [`(tier != 'ORG_CUSTOM' OR organization_id = ?)`];
  const params: unknown[] = [organizationId];
  if (!options.includeAllStatuses) {
    conditions.push(`status = 'ACTIVE'`);
  }
  if (options.tier) {
    conditions.push(`tier = ?`);
    params.push(options.tier);
  }
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<KpiCatalogListRow>(
      `SELECT id, kpi_code, catalog_version, status, tier, industry_code, organization_id, category, kpi_name,
              description, unit_type, formula_ast, compile_status, resolved_output_unit, period_convention,
              negative_denominator_policy, required_canonical_line_codes
         FROM finance_analysis_kpi_catalog
        WHERE ${conditions.join(' AND ')}
        ORDER BY tier ASC, category ASC, kpi_code ASC`,
      params
    )
  );
}

export interface KpiValueListRow {
  id: string;
  organization_id: string;
  business_version_id: string;
  kpi_catalog_id: string;
  kpi_code: string;
  kpi_name: string;
  category: string;
  tier: string;
  unit_type: string;
  entity_id: string;
  period_id: string;
  value_status: string;
  value_decimal: string | null;
  native_currency: string | null;
  presentation_currency: string | null;
  unit: string | null;
  multiplier: string;
  quality_flag: string | null;
  delta_vs_prior_period: string | null;
  delta_pct_vs_prior_period: string | null;
  interpretation_text: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Computed KPI results for one Analysis version, joined against the catalog for the
 * kpiCode/name/category/tier a client needs to render without a second round-trip.
 * `finance_analysis_benchmarks` (peer-set percentiles) is deliberately NOT joined here —
 * this program ships no writer for that table yet (grep confirms zero INSERT callers
 * anywhere in `services/finance/**`), so joining it would only ever return NULL columns;
 * documented as a real gap in the report rather than a silently-always-empty join.
 */
export async function listKpiValues(
  organizationId: string,
  businessVersionId: string
): Promise<KpiValueListRow[]> {
  return withPinnedPostgresTransaction((tx) =>
    tx.queryAll<KpiValueListRow>(
      `SELECT v.id, v.organization_id, v.business_version_id, v.kpi_catalog_id,
              c.kpi_code, c.kpi_name, c.category, c.tier, c.unit_type,
              v.entity_id, v.period_id, v.value_status, v.value_decimal,
              v.native_currency, v.presentation_currency, v.unit, v.multiplier,
              v.quality_flag, v.delta_vs_prior_period, v.delta_pct_vs_prior_period,
              v.interpretation_text, v.created_at, v.updated_at
         FROM finance_analysis_kpi_values v
         JOIN finance_analysis_kpi_catalog c ON c.id = v.kpi_catalog_id
        WHERE v.organization_id = ? AND v.business_version_id = ?
        ORDER BY c.category ASC, c.kpi_code ASC, v.entity_id ASC, v.period_id ASC`,
      [organizationId, businessVersionId]
    )
  );
}

// ---------------------------------------------------------------------------
// Resolver factory — builds the CellResolver/DynamicConstantResolver
// formulaAstEvaluator needs, anchored at one (defaultEntityId, anchorPeriodId).
// ---------------------------------------------------------------------------

interface ResolverDeps {
  periodLookup: PeriodGraphLookup;
  entityByCode: Map<string, string>;
  lineCodeToId: Map<string, string>;
  stmtLineCells: Map<string, StmtLineCell>;
}

function makeCellResolver(deps: ResolverDeps, defaultEntityId: string, anchorPeriodId: string): CellResolver {
  return {
    async resolveCell(cellRef: CellRefOperand): Promise<CellResolution> {
      const entityId =
        cellRef.entityScope === 'ANALYSIS_DEFAULT' ? defaultEntityId : deps.entityByCode.get(cellRef.entityScope.entityCode);
      if (!entityId) {
        return { ok: false, reason: 'ENTITY_NOT_FOUND', detail: `entityScope not found in source Statement Pack Version entities` };
      }
      const canonicalLineId = deps.lineCodeToId.get(cellRef.canonicalLineCode);
      if (!canonicalLineId) {
        return { ok: false, reason: 'CANONICAL_LINE_NOT_FOUND', detail: `canonicalLineCode ${cellRef.canonicalLineCode} not found` };
      }
      const plan = resolvePeriodOffset(cellRef.periodOffset, anchorPeriodId, deps.periodLookup);
      if (!plan.ok) {
        return { ok: false, reason: plan.reason, detail: plan.detail };
      }

      const points: number[] = [];
      for (const pid of plan.periodIds) {
        const cell = deps.stmtLineCells.get(cellKey(entityId, canonicalLineId, pid, cellRef.consolidationScope));
        if (!cell || cell.status === 'MISSING' || cell.value === null) {
          // Never fabricate a partial average/sum from the points that DO exist — one missing
          // point makes the whole convention un-computable for this cell (never silent zero).
          return { ok: true, status: 'MISSING' };
        }
        points.push(cell.value);
      }

      let combined: number;
      if (plan.combine === 'SINGLE') combined = points[0];
      else if (plan.combine === 'AVERAGE') combined = points.reduce((a, b) => a + b, 0) / points.length;
      else combined = points.reduce((a, b) => a + b, 0); // SUM

      return { ok: true, status: combined === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', value: combined };
    },
  };
}

function makeDynamicConstants(period: PeriodMeta): DynamicConstantResolver {
  return {
    daysInPeriod: () => daysInPeriod(period),
    annualizationFactor: () => annualizationFactor(period),
  };
}

/** `formula_ref` resolution — recursively evaluates a sibling ACTIVE/COMPILED_OK catalog KPI's OWN
 *  formula for the SAME (entity, period) anchor, memoized per run (a KPI referenced by more than
 *  one composite, or referenced twice inside one tree, is only ever computed once). */
function makeFormulaRefResolver(
  catalogByCode: Map<string, KpiCatalogRow>,
  cellResolver: CellResolver,
  dynamicConstants: DynamicConstantResolver,
  memoKeyPrefix: string,
  memo: Map<string, Promise<EvaluationResult>>
): FormulaRefResolver {
  return {
    resolveFormulaRef(kpiCode: string): Promise<EvaluationResult> {
      const memoKey = `${memoKeyPrefix}::${kpiCode}`;
      const cached = memo.get(memoKey);
      if (cached) return cached;

      const catalogRow = catalogByCode.get(kpiCode);
      const promise: Promise<EvaluationResult> =
        !catalogRow || catalogRow.compile_status !== 'COMPILED_OK'
          ? Promise.resolve({
              status: 'MISSING' as const,
              value: null,
              qualityFlag: null,
              detail: `formula_ref ${kpiCode}: no ACTIVE/COMPILED_OK catalog entry`,
            })
          : evaluateFormula(
              catalogRow.formula_ast,
              {
                cellResolver,
                dynamicConstants,
                formulaRefResolver: makeFormulaRefResolver(catalogByCode, cellResolver, dynamicConstants, memoKeyPrefix, memo),
              },
              catalogRow.negative_denominator_policy
            );
      memo.set(memoKey, promise);
      return promise;
    },
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ComputedKpiResult {
  kpiValueId: string;
  kpiCode: string;
  entityId: string;
  periodId: string;
  status: EvaluationResult['status'];
  value: number | null;
  qualityFlag: EvaluationResult['qualityFlag'];
  detail: string | null;
}

/**
 * W3-determinism fix (`docs/validation/finance-v3/generated/gate-d/W3_COMPUTE_DETERMINISM_report.md`)
 * — the ONLY change this report makes to this file's behavior.
 *
 * Builds the exact payload `canonicalPayloadHash()` hashes into `content_semantic_hash`, sorted by
 * a VALUE-based key (`kpiCode::entityId::periodId` — this Analysis's own uniqueness key,
 * `uq_finance_analysis_kpi_values_cell`, so it is collision-free by construction) rather than by
 * whatever order the no-`ORDER BY` `SELECT * FROM finance_analysis_kpi_values` above happened to
 * return. That SQL order is NOT stable across runs of this exact query for the exact same rows —
 * proven empirically in the linked report (10 real-DB runs of the same Analysis via the codebase's
 * own lease-expiry retry path, `faultMatrix.pg.test.ts`'s `reapExpiredLeases()` requeue mechanism,
 * produced 6 DISTINCT `content_semantic_hash` values for byte-identical KPI content — no VACUUM, no
 * forced index scan, no artificial trigger needed; plain `UPDATE` churn from `persistResults()`
 * itself was enough). Returns a NEW array — `results` itself (returned to every caller of
 * `computeAnalysisKpis`, and what `persistResults()` already wrote before this function runs) is
 * NEVER reordered by this, so nothing downstream of this function's return value changes shape.
 *
 * This does NOT touch `contentHash.ts` (frozen — see that file's own header) — the algorithm is
 * still `sha256(JSON.stringify(x))`; only WHICH `x` is handed to it changes, and only for this one
 * producer. Kept separate from `ComputedKpiResult` output ordering by design — see the SQL query's
 * own comment above for why `ORDER BY` in the SQL itself was rejected as the fix.
 */
export function hashPayloadFor(results: readonly ComputedKpiResult[]): ComputedKpiResult[] {
  return [...results].sort((a, b) => {
    const ka = `${a.kpiCode}::${a.entityId}::${a.periodId}`;
    const kb = `${b.kpiCode}::${b.entityId}::${b.periodId}`;
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });
}

export interface ComputeAnalysisKpisParams {
  organizationId: string;
  /** The Analysis Definition Version (`finance_business_versions.business_version_id`, `artifact_type='HISTORICAL_ANALYSIS'`). */
  businessVersionId: string;
  requestedByUserId: string;
  engineManifestId?: string;
  requestId?: string | null;
  /** After a successful compute, attempt the readiness-gated DRAFT -> READY_FOR_REVIEW transition (ADR section 7 / this work package's brief). Requires actorId/role/expectedVersion. */
  attemptReadinessTransition?: boolean;
  actorId?: string;
  role?: FinanceRole;
  expectedVersion?: number;
}

export type ComputeAnalysisKpisResult =
  | {
      ok: true;
      job: ComputeJobRow;
      results: ComputedKpiResult[];
      readiness: {
        checked: boolean;
        ready: boolean;
        checks: { check_name: string; passed: boolean; detail: string }[];
        transitionAttempted: boolean;
        transitionResult?: TransitionServiceResult;
        businessVersion?: BusinessVersionRow;
      };
    }
  | {
      ok: false;
      // W9-B-2 fix: `completeJobSuccess()` reported `NOT_RUNNING` (job
      // cancelled/lease-expired/already terminal before we could commit its
      // output) — never report success for a run whose compute_job_outputs
      // commit did not happen. See W2_FALSE_SUCCESS_W9B2_report.md.
      code: 'NO_SOURCE_STATEMENT_PACK_EDGE' | 'BUSINESS_VERSION_NOT_FOUND' | 'JOB_NOT_RUNNING';
      message: string;
    };

/**
 * ADR section 8.1 point 3 — Analysis -> source Statement Pack Version, exclusively via `finance_lineage_edges`.
 *
 * NEW-2 fix: org-scoped. This is the ACTUAL first read against
 * caller-supplied businessVersionId in computeAnalysisKpis() — it runs
 * before the W9-C-6 org-scoped getBusinessVersion() guard below, so that
 * fix's own comment ("already org-scoped") never actually covered this call.
 * finance_lineage_edges has a NOT NULL organization_id (migration
 * 20260809_finance_v3_b03_lineage_freshness.sql).
 */
async function resolveSourceStatementPackVersion(organizationId: string, businessVersionId: string): Promise<string | null> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ source_version_id: string }>(
      `SELECT source_version_id FROM finance_lineage_edges
        WHERE edge_type = 'STATEMENT_TO_ANALYSIS' AND target_version_id = ? AND organization_id = ?`,
      [businessVersionId, organizationId]
    )
  );
  return row?.source_version_id ?? null;
}

export async function computeAnalysisKpis(params: ComputeAnalysisKpisParams): Promise<ComputeAnalysisKpisResult> {
  const sourceVersionId = await resolveSourceStatementPackVersion(params.organizationId, params.businessVersionId);
  if (!sourceVersionId) {
    return {
      ok: false,
      code: 'NO_SOURCE_STATEMENT_PACK_EDGE',
      message: `No STATEMENT_TO_ANALYSIS lineage edge targets business_version_id ${params.businessVersionId}`,
    };
  }

  // W9-C-6 fix (P2): this guard is already org-scoped (getBusinessVersion
  // takes organizationId) — isolation held even before this fix, INCLUDING
  // for a cross-tenant businessVersionId. But it used to throw a bare Error
  // here instead of returning the typed {ok:false} shape every other failure
  // mode of this function already used, so an HTTP layer mapped a tenant
  // boundary refusal to a 500 instead of a 404. Now typed, consistent with
  // NO_SOURCE_STATEMENT_PACK_EDGE above.
  const bv = await artifactVersionService.getBusinessVersion(params.organizationId, params.businessVersionId);
  if (!bv) {
    return {
      ok: false,
      code: 'BUSINESS_VERSION_NOT_FOUND',
      message: `kpiComputeService: business_version ${params.businessVersionId} not found`,
    };
  }

  const [periodGraph, entityByCode, lineCodeToId, stmtLineCells, catalogByCode, kpiValueRows] = await Promise.all([
    loadPeriodGraph(params.organizationId),
    loadEntityCodeMap(sourceVersionId),
    loadCanonicalLineMap(params.organizationId),
    loadStmtLineCells(sourceVersionId),
    loadActiveCatalogByCode(params.organizationId),
    withPinnedPostgresTransaction((tx) =>
      // W3-hashconsol NOTE / W3-determinism fix (see
      // `docs/validation/finance-v3/generated/gate-d/W3_COMPUTE_DETERMINISM_report.md`):
      // this row set STILL has no ORDER BY on purpose — adding `ORDER BY id` would pin a
      // RANDOM UUID's order, which is not a meaningful sort key and would itself churn
      // on every schema/storage change. `evaluateAllRows` below still iterates in
      // whatever order Postgres returns (that iteration order is harmless — it only
      // affects the UPDATE order in `persistResults`, and the delta-vs-prior computation
      // reads by a `Map` keyed lookup, not array position). What DOES need a stable
      // order is the payload fed to `canonicalPayloadHash()` for `content_semantic_hash`
      // — see the `hashPayloadFor()` call below, which sorts a SEPARATE copy by a
      // value-based key (kpiCode/entityId/periodId) immediately before hashing, never
      // touching this query or the `results` array this function returns to callers.
      tx.queryAll<KpiValueRow>(`SELECT * FROM finance_analysis_kpi_values WHERE business_version_id = ?`, [params.businessVersionId])
    ),
  ]);
  const catalogById = new Map<string, KpiCatalogRow>(Array.from(catalogByCode.values()).map((c) => [c.id, c]));
  const periodLookup: PeriodGraphLookup = (pid) => periodGraph.get(pid);

  // --- Job bookkeeping (ADR section 8.2). Idempotency key: this run's own (business_version_id,
  //     content of the input set) so a byte-identical rerun with nothing changed is a safe no-op
  //     read-back, same idempotency contract computeJobService already documents. ---
  const kpiValueIdsSorted = kpiValueRows.map((r) => r.id).sort();
  const inputRevisionHash = createHash('sha256')
    .update(JSON.stringify({ businessVersionId: params.businessVersionId, sourceVersionId, kpiValueIdsSorted }))
    .digest('hex');
  const { job, wasExisting } = await computeJobService.enqueue({
    organizationId: params.organizationId,
    jobType: 'ANALYSIS_KPI_COMPUTE',
    inputArtifactId: bv.artifact_id,
    inputRevisionHash,
    engineManifestId: params.engineManifestId ?? bv.engine_manifest_id,
    idempotencyKey: `analysis-kpi-compute:${params.businessVersionId}:${inputRevisionHash}`,
    requestedByUserId: params.requestedByUserId,
    requestId: params.requestId ?? null,
  });
  // NEW-3 fix: self-claim the EXACT row just enqueued (by id, org-scoped) —
  // never the globally-oldest queued ANALYSIS_KPI_COMPUTE job across every
  // organization (see computeJobService.claimById doc comment).
  // P1 fix (idempotent compute retry): see valuationComputeService.ts's
  // identical call for the full rationale. Unlike that file, an
  // 'already_committed' outcome here does NOT short-circuit the return —
  // `runningJob` below is simply left non-'running' (the already-succeeded
  // job row), which the pre-existing `if (runningJob.status === 'running')`
  // guards a few lines down already skip correctly (they exist for the
  // unrelated "cancelled mid-flight" race, W9-B-2) — so this duplicate call
  // still safely re-evaluates and re-persists the SAME deterministic KPI
  // values (idempotent UPDATE, never a second compute_job_outputs row) and
  // returns them, instead of throwing.
  const claimResult = await computeJobService.claimForCompute({
    organizationId: params.organizationId,
    job,
    wasExisting,
    workerId: `kpiComputeService:${uuidv4()}`,
  });
  if (claimResult.outcome === 'hard_error') {
    return {
      ok: false,
      code: 'JOB_NOT_RUNNING',
      message: `computeAnalysisKpis: ${claimResult.message}`,
    };
  }
  const runningJob = claimResult.job;

  let results: ComputedKpiResult[];
  try {
    results = await evaluateAllRows({ kpiValueRows, catalogById, periodGraph, periodLookup, entityByCode, lineCodeToId, stmtLineCells });
    await persistResults(results);
  } catch (error: any) {
    if (runningJob.status === 'running')
      await computeJobService.failJob({ jobId: runningJob.id, organizationId: params.organizationId, error: String(error?.message || error) });
    throw error;
  }

  if (runningJob.status === 'running') {
    const contentSemanticHash = canonicalPayloadHash(hashPayloadFor(results));
    const outputWorkingRevisionId = bv.source_working_revision_id ?? params.businessVersionId;
    const completed = await computeJobService.completeJobSuccess({
      jobId: runningJob.id,
      organizationId: params.organizationId,
      inputArtifactId: runningJob.input_artifact_id,
      outputArtifactId: bv.artifact_id,
      outputBusinessVersionId: params.businessVersionId,
      outputWorkingRevisionId,
      contentSemanticHash,
    });
    // W9-B-2 fix: NOT_RUNNING means the job was cancelled/lease-expired/already
    // terminal by the time we tried to commit — never report success for a run
    // whose compute_job_outputs commit did not happen. (The local
    // `runningJob.status === 'running'` guard above only reflects the status
    // at claim() time — it does NOT catch a cancellation that happened during
    // `evaluateAllRows`/`persistResults`, which is exactly the race this
    // fixes.) OUTPUT_ALREADY_COMMITTED is treated as an idempotent-safe
    // outcome — see report §"NOT_RUNNING vs OUTPUT_ALREADY_COMMITTED".
    if (!completed.ok) {
      return {
        ok: false,
        code: 'JOB_NOT_RUNNING',
        message: `computeAnalysisKpis: completeJobSuccess reported NOT_RUNNING for job ${runningJob.id}: ${completed.message}`,
      };
    }
  }

  // --- Readiness gate + optional DRAFT -> READY_FOR_REVIEW transition (ADR section 7 / this
  //     work package's brief: "artefakt może przejść do READY_FOR_REVIEW"). ---
  const readinessOut: Extract<ComputeAnalysisKpisResult, { ok: true }>['readiness'] = {
    checked: false,
    ready: false,
    checks: [],
    transitionAttempted: false,
  };
  if (params.attemptReadinessTransition) {
    const checks = await withPinnedPostgresTransaction((tx) =>
      tx.queryAll<{ check_name: string; passed: boolean; detail: string }>(`SELECT * FROM finance_analysis_readiness_check(?)`, [
        params.businessVersionId,
      ])
    );
    const readyRow = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ ready: boolean }>(`SELECT finance_analysis_is_ready_for_review(?) AS ready`, [params.businessVersionId])
    );
    readinessOut.checked = true;
    readinessOut.checks = checks;
    readinessOut.ready = readyRow?.ready === true;

    if (readinessOut.ready) {
      if (!params.actorId || !params.role || params.expectedVersion === undefined) {
        throw new Error('attemptReadinessTransition=true requires actorId, role, and expectedVersion');
      }
      readinessOut.transitionAttempted = true;
      const transitionResult = await artifactVersionService.transition({
        organizationId: params.organizationId,
        businessVersionId: params.businessVersionId,
        action: 'submit_for_review',
        actorId: params.actorId,
        role: params.role,
        expectedVersion: params.expectedVersion,
      });
      readinessOut.transitionResult = transitionResult;
      if (transitionResult.ok) readinessOut.businessVersion = transitionResult.businessVersion;
    }
  }

  const finalJob = (await computeJobService.getJob(params.organizationId, job.id)) ?? runningJob;
  return { ok: true, job: finalJob, results, readiness: readinessOut };
}

// ---------------------------------------------------------------------------
// Internal: evaluate every selected (MISSING or already-computed) row.
// ---------------------------------------------------------------------------

interface EvaluateAllRowsDeps {
  kpiValueRows: KpiValueRow[];
  catalogById: Map<string, KpiCatalogRow>;
  periodGraph: Map<string, PeriodMeta>;
  periodLookup: PeriodGraphLookup;
  entityByCode: Map<string, string>;
  lineCodeToId: Map<string, string>;
  stmtLineCells: Map<string, StmtLineCell>;
}

async function evaluateAllRows(deps: EvaluateAllRowsDeps): Promise<ComputedKpiResult[]> {
  const catalogByCode = new Map<string, KpiCatalogRow>(Array.from(deps.catalogById.values()).map((c) => [c.kpi_code, c]));
  const results: ComputedKpiResult[] = [];
  // Shared across the whole run: a formula_ref target for the SAME (kpiCode, entityId, periodId)
  // triple is computed once no matter how many rows/composites ask for it.
  const globalMemo = new Map<string, Promise<EvaluationResult>>();

  for (const row of deps.kpiValueRows) {
    const catalogRow = deps.catalogById.get(row.kpi_catalog_id);
    if (!catalogRow || catalogRow.compile_status !== 'COMPILED_OK') {
      results.push({
        kpiValueId: row.id,
        kpiCode: catalogRow?.kpi_code ?? 'UNKNOWN',
        entityId: row.entity_id,
        periodId: row.period_id,
        status: 'MISSING',
        value: null,
        qualityFlag: null,
        detail: 'referenced kpi_catalog_id is not ACTIVE/COMPILED_OK (readiness gate check 4 catches this before READY_FOR_REVIEW)',
      });
      continue;
    }

    const period = deps.periodGraph.get(row.period_id);
    if (!period) {
      results.push({
        kpiValueId: row.id,
        kpiCode: catalogRow.kpi_code,
        entityId: row.entity_id,
        periodId: row.period_id,
        status: 'MISSING',
        value: null,
        qualityFlag: null,
        detail: `period_id ${row.period_id} not found in finance_stmt_periods`,
      });
      continue;
    }

    const memoKeyPrefix = `${row.entity_id}::${row.period_id}`;
    const cellResolver = makeCellResolver(
      { periodLookup: deps.periodLookup, entityByCode: deps.entityByCode, lineCodeToId: deps.lineCodeToId, stmtLineCells: deps.stmtLineCells },
      row.entity_id,
      row.period_id
    );
    const dynamicConstants = makeDynamicConstants(period);
    const formulaRefResolver = makeFormulaRefResolver(catalogByCode, cellResolver, dynamicConstants, memoKeyPrefix, globalMemo);

    const evalResult = await evaluateFormula(
      catalogRow.formula_ast,
      { cellResolver, dynamicConstants, formulaRefResolver },
      catalogRow.negative_denominator_policy
    );

    results.push({
      kpiValueId: row.id,
      kpiCode: catalogRow.kpi_code,
      entityId: row.entity_id,
      periodId: row.period_id,
      status: evalResult.status,
      value: evalResult.value,
      qualityFlag: evalResult.qualityFlag,
      detail: evalResult.detail,
    });
  }

  // --- delta_vs_prior_period / delta_pct_vs_prior_period: computed from THIS run's own results
  //     only (the prior period's value for the same kpi_catalog_id+entity, if that period is
  //     ALSO part of this Analysis's own selected cells) — never reaches outside this Analysis's
  //     own value set, and never fabricates a delta against data this compute run does not have. ---
  const byRowId = new Map(deps.kpiValueRows.map((r) => [r.id, r]));
  const resultByTriple = new Map<string, ComputedKpiResult>();
  for (const r of results) resultByTriple.set(`${r.kpiCode}::${r.entityId}::${r.periodId}`, r);

  return results.map((r) => {
    const row = byRowId.get(r.kpiValueId)!;
    const plan = resolvePeriodOffset('PRIOR_PERIOD', row.period_id, deps.periodLookup);
    if (!plan.ok || r.status === 'MISSING' || r.status === 'NOT_APPLICABLE' || r.value === null) return r;
    const prior = resultByTriple.get(`${r.kpiCode}::${r.entityId}::${plan.periodIds[0]}`);
    if (!prior || prior.value === null || (prior.status !== 'PRESENT_NONZERO' && prior.status !== 'PRESENT_ZERO')) return r;
    const delta = r.value - prior.value;
    const deltaPct = prior.value !== 0 ? delta / Math.abs(prior.value) : null;
    return { ...r, deltaVsPrior: delta, deltaPctVsPrior: deltaPct } as ComputedKpiResult & {
      deltaVsPrior: number;
      deltaPctVsPrior: number | null;
    };
  });
}

async function persistResults(results: ComputedKpiResult[]): Promise<void> {
  await withPinnedPostgresTransaction(async (tx) => {
    for (const r of results as (ComputedKpiResult & { deltaVsPrior?: number; deltaPctVsPrior?: number | null })[]) {
      await tx.queryRun(
        `UPDATE finance_analysis_kpi_values
            SET value_status = ?, value_decimal = ?, quality_flag = ?,
                delta_vs_prior_period = ?, delta_pct_vs_prior_period = ?,
                interpretation_text = ?, updated_at = now()
          WHERE id = ?`,
        [
          r.status,
          r.status === 'PRESENT_NONZERO' || r.status === 'PRESENT_ZERO' ? r.value : null,
          r.qualityFlag,
          r.deltaVsPrior ?? null,
          r.deltaPctVsPrior ?? null,
          r.detail,
          r.kpiValueId,
        ]
      );
    }
  });
}
