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
    }>(
      `SELECT entity_id, canonical_line_id, period_id, consolidation_scope, accumulation_basis, value_status, value_decimal
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
        cell: { status: r.value_status, value: r.value_decimal === null ? null : Number(r.value_decimal) },
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
  | { ok: false; code: 'NO_SOURCE_STATEMENT_PACK_EDGE'; message: string };

/** ADR section 8.1 point 3 — Analysis -> source Statement Pack Version, exclusively via `finance_lineage_edges`. */
async function resolveSourceStatementPackVersion(businessVersionId: string): Promise<string | null> {
  const row = await withPinnedPostgresTransaction((tx) =>
    tx.queryOne<{ source_version_id: string }>(
      `SELECT source_version_id FROM finance_lineage_edges
        WHERE edge_type = 'STATEMENT_TO_ANALYSIS' AND target_version_id = ?`,
      [businessVersionId]
    )
  );
  return row?.source_version_id ?? null;
}

export async function computeAnalysisKpis(params: ComputeAnalysisKpisParams): Promise<ComputeAnalysisKpisResult> {
  const sourceVersionId = await resolveSourceStatementPackVersion(params.businessVersionId);
  if (!sourceVersionId) {
    return {
      ok: false,
      code: 'NO_SOURCE_STATEMENT_PACK_EDGE',
      message: `No STATEMENT_TO_ANALYSIS lineage edge targets business_version_id ${params.businessVersionId}`,
    };
  }

  const bv = await artifactVersionService.getBusinessVersion(params.organizationId, params.businessVersionId);
  if (!bv) throw new Error(`kpiComputeService: business_version ${params.businessVersionId} not found`);

  const [periodGraph, entityByCode, lineCodeToId, stmtLineCells, catalogByCode, kpiValueRows] = await Promise.all([
    loadPeriodGraph(params.organizationId),
    loadEntityCodeMap(sourceVersionId),
    loadCanonicalLineMap(params.organizationId),
    loadStmtLineCells(sourceVersionId),
    loadActiveCatalogByCode(params.organizationId),
    withPinnedPostgresTransaction((tx) =>
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
  const { job } = await computeJobService.enqueue({
    organizationId: params.organizationId,
    jobType: 'ANALYSIS_KPI_COMPUTE',
    inputArtifactId: bv.artifact_id,
    inputRevisionHash,
    engineManifestId: params.engineManifestId ?? bv.engine_manifest_id,
    idempotencyKey: `analysis-kpi-compute:${params.businessVersionId}:${inputRevisionHash}`,
    requestedByUserId: params.requestedByUserId,
    requestId: params.requestId ?? null,
  });
  const [claimed] = await computeJobService.claim({ workerId: `kpiComputeService:${uuidv4()}`, jobTypes: ['ANALYSIS_KPI_COMPUTE'], limit: 1 });
  const runningJob = claimed && claimed.id === job.id ? claimed : job;

  let results: ComputedKpiResult[];
  try {
    results = await evaluateAllRows({ kpiValueRows, catalogById, periodGraph, periodLookup, entityByCode, lineCodeToId, stmtLineCells });
    await persistResults(results);
  } catch (error: any) {
    if (runningJob.status === 'running') await computeJobService.failJob({ jobId: runningJob.id, error: String(error?.message || error) });
    throw error;
  }

  if (runningJob.status === 'running') {
    const contentSemanticHash = createHash('sha256').update(JSON.stringify(results)).digest('hex');
    await computeJobService.completeJobSuccess({
      jobId: runningJob.id,
      organizationId: params.organizationId,
      outputArtifactId: bv.artifact_id,
      outputBusinessVersionId: params.businessVersionId,
      outputWorkingRevisionId: bv.source_working_revision_id ?? params.businessVersionId,
      contentSemanticHash,
    });
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

  const finalJob = (await computeJobService.getJob(job.id)) ?? runningJob;
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
