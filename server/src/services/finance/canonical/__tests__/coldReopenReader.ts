/**
 * Cold-reopen canonical READER — the single definition of "what an approved
 * Finance v3 artifact reads back as".
 *
 * W10, gate FC-05.8 / FC-07.9 / FC-12.4. This module is deliberately a plain
 * module and NOT a `*.test.ts` file (vitest's `include` is
 * `src/**‍/*.{test,spec}.ts`, so it is never collected as a suite) because it
 * has to be loadable from BOTH sides of the cold boundary:
 *
 *   1. in-process, by `coldReopen.pg.test.ts`, right after the write phase
 *      ("hot" read — the state the writing session believes it left behind);
 *   2. in a SEPARATE OS PROCESS, by running this same file directly with
 *      `tsx` (see `main()` at the bottom) — a genuinely cold reopen: new
 *      process, new `pg` Pool, new ES module registry, zero bytes of memory
 *      carried over from the session that wrote the data.
 *
 * Both sides must therefore produce byte-identical output for identical
 * database state — which is exactly the property under test. Hence:
 *
 *   - Every numeric column is read as the RAW Postgres text representation.
 *     This repo sets no `pg.types.setTypeParser` anywhere (verified by
 *     `grep setTypeParser server/src`), so `numeric` arrives as a string;
 *     casting it to a JS `number` here would silently launder a real
 *     persistence defect (e.g. a column narrowed from `numeric(38,10)` to
 *     `double precision`) into a passing test. "Identical to the bit" is
 *     asserted on the text, not on a lossy float.
 *   - `canonicalize()` sorts object keys, so a difference in column ORDER
 *     between two `pg` result sets can never masquerade as a value change.
 *   - Row ordering is pinned by an explicit deterministic `ORDER BY` in every
 *     query. An unordered `SELECT` is not a snapshot.
 *
 * WHAT IS DELIBERATELY EXCLUDED from the compared payload: nothing that is
 * persisted. Wall-clock columns (`created_at`/`updated_at`/`approved_at`/
 * `frozen_at`) are INCLUDED on purpose — a cold reopen that silently rewrote a
 * row would move them, and that is precisely the failure we are hunting. The
 * only thing outside the payload is this module's own measured read duration.
 */
import { createHash } from 'node:crypto';

export type Tx = {
  queryAll: <T = any>(sql: string, params?: unknown[]) => Promise<T[]>;
  queryOne: <T = any>(sql: string, params?: unknown[]) => Promise<T | null>;
  queryRun: (sql: string, params?: unknown[]) => Promise<{ changes: number }>;
};

// ---------------------------------------------------------------------------
// Canonical serialisation
// ---------------------------------------------------------------------------

/**
 * Deterministic JSON: object keys sorted, arrays kept in their (query-pinned)
 * order, `Date` normalised to a full-precision ISO string, `undefined`
 * distinguished from `null`. Two payloads with the same canonical form are the
 * same state; two with different forms differ somewhere, and the diff is
 * human-readable.
 */
export function canonicalize(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (v === undefined) return { __undefined: true };
    if (v === null) return null;
    if (v instanceof Date) return { __date: v.toISOString() };
    if (Buffer.isBuffer(v)) return { __buf: v.toString('base64') };
    if (Array.isArray(v)) return v.map(walk);
    if (typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        out[k] = walk((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    if (typeof v === 'bigint') return { __bigint: v.toString() };
    return v;
  };
  return JSON.stringify(walk(value), null, 0);
}

export function digest(value: unknown): string {
  return createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');
}

// ---------------------------------------------------------------------------
// Raw-text reads
// ---------------------------------------------------------------------------

/**
 * Every `numeric`/`timestamptz` column below is wrapped in `::text` at the SQL
 * level rather than converted in JS. Two reasons: (a) `numeric::text` is the
 * exact stored value, trailing zeros and scale included — a JS `Number` round
 * trip is not; (b) `timestamptz::text` renders in the session TimeZone, which
 * would differ between processes, so those are read as `to_char(... , 'YYYY-MM-DD"T"HH24:MI:SS.USOF')`
 * at UTC instead. See `tsUtc()`.
 */
function tsExpr(col: string): string {
  return `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US')`;
}
function tsUtc(col: string, alias: string): string {
  return `${tsExpr(col)} AS ${alias}`;
}

async function businessVersionFacts(tx: Tx, orgId: string, businessVersionId: string) {
  return tx.queryOne(
    `SELECT business_version_id, artifact_id, version_no, version, status, freshness, freshness_reason,
            ${tsUtc('stale_since', 'stale_since')},
            source_working_revision_id, parent_version_id, superseded_by_version_id,
            ${tsUtc('superseded_at', 'superseded_at')},
            compute_snapshot_id, compute_run_id, engine_manifest_id, content_semantic_hash,
            risk_tier, submitted_by, ${tsUtc('submitted_at', 'submitted_at')},
            approved_by, ${tsUtc('approved_at', 'approved_at')}, approval_note,
            ${tsUtc('immutable_since', 'immutable_since')},
            version_kind, restatement_class, result_quality,
            created_by, ${tsUtc('created_at', 'created_at')}, ${tsUtc('updated_at', 'updated_at')}
       FROM finance_business_versions
      WHERE organization_id = ? AND business_version_id = ?`,
    [orgId, businessVersionId]
  );
}

async function computeSnapshotFacts(tx: Tx, orgId: string, businessVersionId: string) {
  return tx.queryAll(
    `SELECT s.compute_snapshot_id, s.artifact_id, s.working_revision_id, s.compute_run_id,
            s.engine_manifest_id, s.fiscal_calendar_id, s.fx_snapshot_id, s.market_data_snapshot_id,
            s.locale, s.timezone, ${tsUtc('s.as_of', 'as_of')}, s.content_semantic_hash, s.created_by,
            ${tsUtc('s.created_at', 'created_at')}
       FROM finance_compute_snapshots s
       JOIN finance_business_versions bv ON bv.artifact_id = s.artifact_id
      WHERE s.organization_id = ? AND bv.business_version_id = ?
      ORDER BY s.created_at, s.compute_snapshot_id`,
    [orgId, businessVersionId]
  );
}

async function workingRevisionFacts(tx: Tx, orgId: string, businessVersionId: string) {
  return tx.queryAll(
    `SELECT wr.working_revision_id, wr.artifact_id, wr.business_version_id, wr.source_business_version_id,
            wr.revision_seq::text AS revision_seq, wr.version, wr.content_semantic_hash, wr.compute_run_id,
            wr.is_current, wr.crash_recovery_checkpoint, wr.edited_by, ${tsUtc('wr.edited_at', 'edited_at')}
       FROM finance_working_revisions wr
       JOIN finance_business_versions bv ON bv.artifact_id = wr.artifact_id
      WHERE wr.organization_id = ? AND bv.business_version_id = ?
      ORDER BY wr.revision_seq, wr.working_revision_id`,
    [orgId, businessVersionId]
  );
}

async function lifecycleFacts(tx: Tx, orgId: string, businessVersionId: string) {
  return tx.queryAll(
    `SELECT action, from_status, to_status, actor_id, risk_tier, reason, idempotency_key, snapshot_id,
            ${tsUtc('created_at', 'created_at')}
       FROM artifact_lifecycle_events
      WHERE organization_id = ? AND business_version_id = ?
      ORDER BY created_at, action, event_id`,
    [orgId, businessVersionId]
  );
}

// ---------------------------------------------------------------------------
// FC-05.8 — Baseline Model reopen payload
// ---------------------------------------------------------------------------

export async function readBaselinePayload(tx: Tx, orgId: string, baselineBvId: string) {
  const businessVersion = await businessVersionFacts(tx, orgId, baselineBvId);
  const model = await tx.queryOne(
    `SELECT horizon_months, horizon_rationale, horizon_rationale_note,
            circularity_max_iterations::text AS circularity_max_iterations,
            circularity_tolerance_currency::text AS circularity_tolerance_currency,
            interest_income_on_cash_modeled, mandatory_contractual_cash_sweep_modeled, created_by
       FROM finance_baseline_models
      WHERE organization_id = ? AND business_version_id = ?`,
    [orgId, baselineBvId]
  );
  const assumptions = await tx.queryAll(
    `SELECT schedule_type, driver_code, entity_id, period_id, rule, value_status,
            value_decimal::text AS value_decimal, unit, quality, created_by
       FROM finance_baseline_assumptions
      WHERE organization_id = ? AND business_version_id = ?
      ORDER BY schedule_type, driver_code, period_id`,
    [orgId, baselineBvId]
  );
  const schedules = await tx.queryAll(
    `SELECT schedule_type, schedule_item_code, entity_id, effective_from_period_id,
            payload::text AS payload, created_by
       FROM finance_baseline_schedules
      WHERE organization_id = ? AND business_version_id = ?
      ORDER BY schedule_type, schedule_item_code`,
    [orgId, baselineBvId]
  );
  /**
   * The monthly engine's own output grid. Joined to `financial_statement_lines`
   * and `finance_stmt_periods` so the payload is keyed by STABLE business keys
   * (line_code + period label) rather than by surrogate uuids — a reopen that
   * returned the right numbers against the wrong periods must fail, and uuid
   * keys would hide that.
   */
  const outputs = await tx.queryAll(
    `SELECT fsl.line_code, p.label AS period_label, o.statement_type, o.consolidation_scope,
            o.value_status, o.value_decimal::text AS value_decimal, o.native_currency,
            o.presentation_currency, o.unit, o.multiplier::text AS multiplier, o.value_kind,
            o.driving_schedule_type, o.quality_flag, o.is_adjustment,
            ${tsUtc('o.created_at', 'created_at')}, ${tsUtc('o.updated_at', 'updated_at')}
       FROM finance_baseline_outputs o
       JOIN financial_statement_lines fsl ON fsl.id = o.canonical_line_id
       JOIN finance_stmt_periods p ON p.period_id = o.period_id
      WHERE o.organization_id = ? AND o.business_version_id = ?
      ORDER BY p.period_start, p.label, fsl.line_code, o.consolidation_scope`,
    [orgId, baselineBvId]
  );
  const solverDiagnostics = await tx.queryAll(
    `SELECT d.iterations_used::text AS iterations_used, d.converged,
            d.final_residual_currency::text AS final_residual_currency,
            d.tolerance_applied::text AS tolerance_applied, p.label AS period_label
       FROM finance_baseline_solver_diagnostics d
       JOIN finance_stmt_periods p ON p.period_id = d.period_id
      WHERE d.organization_id = ? AND d.business_version_id = ?
      ORDER BY p.period_start, p.label`,
    [orgId, baselineBvId]
  );

  return {
    kind: 'BASELINE_MODEL' as const,
    businessVersion,
    workingRevisions: await workingRevisionFacts(tx, orgId, baselineBvId),
    computeSnapshots: await computeSnapshotFacts(tx, orgId, baselineBvId),
    lifecycle: await lifecycleFacts(tx, orgId, baselineBvId),
    model,
    assumptions,
    schedules,
    outputs,
    outputCount: outputs.length,
    solverDiagnostics,
  };
}

// ---------------------------------------------------------------------------
// FC-07.9 — Valuation reopen payload
// ---------------------------------------------------------------------------

export async function readValuationPayload(tx: Tx, orgId: string, valuationBvId: string) {
  const businessVersion = await businessVersionFacts(tx, orgId, valuationBvId);
  const variant = await tx.queryOne(
    `SELECT case_id, name, description, created_by
       FROM finance_valuation_variants
      WHERE organization_id = ? AND business_version_id = ?`,
    [orgId, valuationBvId]
  );
  const waccInputs = await tx.queryOne(
    `SELECT risk_free_rate_pct::text AS risk_free_rate_pct,
            equity_risk_premium_pct::text AS equity_risk_premium_pct,
            beta_unlevered::text AS beta_unlevered, beta_relevered::text AS beta_relevered,
            target_capital_structure_debt_pct::text AS target_capital_structure_debt_pct,
            target_capital_structure_equity_pct::text AS target_capital_structure_equity_pct,
            cost_of_debt_pretax_pct::text AS cost_of_debt_pretax_pct,
            cash_tax_rate_pct::text AS cash_tax_rate_pct,
            currency, nominal_or_real, pre_or_post_tax,
            wacc_computed_pct::text AS wacc_computed_pct
       FROM finance_valuation_wacc_inputs
      WHERE organization_id = ? AND business_version_id = ?`,
    [orgId, valuationBvId]
  );
  const methods = await tx.queryAll(
    `SELECT id, method_type, readiness, result_value_status,
            result_ev_decimal::text AS result_ev_decimal,
            is_in_recommendation_basket, weight_pct::text AS weight_pct, applicability_policy_ref
       FROM finance_valuation_methods
      WHERE organization_id = ? AND business_version_id = ?
      ORDER BY method_type, id`,
    [orgId, valuationBvId]
  );
  const methodIds = methods.map((m: any) => m.id);

  const terminal = methodIds.length
    ? await tx.queryAll(
        `SELECT m.method_type, t.convention, t.g_pct::text AS g_pct,
                t.exit_multiple_value::text AS exit_multiple_value,
                t.terminal_value_decimal::text AS terminal_value_decimal,
                t.terminal_share_pct::text AS terminal_share_pct, t.is_primary, t.rationale
           FROM finance_valuation_terminal t
           JOIN finance_valuation_methods m ON m.id = t.method_id
          WHERE t.organization_id = ? AND t.method_id = ANY(?)
          ORDER BY m.method_type, t.convention, t.is_primary DESC`,
        [orgId, methodIds]
      )
    : [];

  const comps = methodIds.length
    ? await tx.queryAll(
        `SELECT peer_name, metric_type, metric_value_status,
                metric_value_decimal::text AS metric_value_decimal,
                is_outlier_excluded, source_ref::text AS source_ref
           FROM finance_valuation_comps
          WHERE organization_id = ? AND method_id = ANY(?)
          ORDER BY peer_name`,
        [orgId, methodIds]
      )
    : [];

  const grids = methodIds.length
    ? await tx.queryAll(
        `SELECT id, grid_label, row_axis_variable, column_axis_variable, grid_status
           FROM finance_valuation_sensitivity_grids
          WHERE organization_id = ? AND method_id = ANY(?)
          ORDER BY grid_label, id`,
        [orgId, methodIds]
      )
    : [];
  const gridIds = grids.map((g: any) => g.id);
  /**
   * FC-07.9's "wszystkie 25 komórek". Ordered by (row_index, col_index) so the
   * 5x5 grid reads back as the same matrix, not merely the same multiset of
   * numbers — a transposed or shuffled grid is a real defect and must fail.
   */
  const sensitivityCells = gridIds.length
    ? await tx.queryAll(
        `SELECT g.grid_label, c.row_index::text AS row_index, c.col_index::text AS col_index,
                c.row_axis_value::text AS row_axis_value, c.column_axis_value::text AS column_axis_value,
                c.cell_value_decimal::text AS cell_value_decimal, c.is_base_cell
           FROM finance_valuation_sensitivity_cells c
           JOIN finance_valuation_sensitivity_grids g ON g.id = c.grid_id
          WHERE c.organization_id = ? AND c.grid_id = ANY(?)
          ORDER BY g.grid_label, c.row_index, c.col_index`,
        [orgId, gridIds]
      )
    : [];

  const bridge = await tx.queryOne(
    `SELECT id, as_of_date::text AS as_of_date,
            enterprise_value_decimal::text AS enterprise_value_decimal,
            equity_value_decimal::text AS equity_value_decimal
       FROM finance_valuation_ev_equity_bridge
      WHERE organization_id = ? AND business_version_id = ?`,
    [orgId, valuationBvId]
  );
  const bridgeComponents = bridge
    ? await tx.queryAll(
        `SELECT sequence_order::text AS sequence_order, component_kind, sign,
                amount_decimal::text AS amount_decimal, as_of_date::text AS as_of_date, rationale
           FROM finance_valuation_ev_equity_bridge_components
          WHERE organization_id = ? AND bridge_id = ?
          ORDER BY sequence_order`,
        [orgId, (bridge as any).id]
      )
    : [];

  /**
   * Advisor output must come back FROZEN and unchanged (FC-07.9 "wynik Advisora
   * (zamrożony)"). `is_frozen`/`frozen_at`/`is_stale` are part of the compared
   * payload precisely so a cold reopen that re-evaluated the rules — or that
   * flipped staleness on read — cannot pass.
   */
  const advisorOutputs = await tx.queryAll(
    `SELECT output_kind, title, narrative, evidence_ref::text AS evidence_ref, driver_ref,
            impact_decimal::text AS impact_decimal, confidence, is_comparison, is_frozen,
            ${tsUtc('frozen_at', 'frozen_at')}, is_stale, ${tsUtc('stale_since', 'stale_since')},
            ai_provider, ai_model, ai_prompt_version, ai_no_training_commitment, ai_evidence_digest,
            compute_snapshot_id, ${tsUtc('created_at', 'created_at')}
       FROM finance_valuation_advisor_outputs
      WHERE organization_id = ? AND business_version_id = ?
      ORDER BY output_kind, title`,
    [orgId, valuationBvId]
  );

  return {
    kind: 'VALUATION_CASE' as const,
    businessVersion,
    workingRevisions: await workingRevisionFacts(tx, orgId, valuationBvId),
    computeSnapshots: await computeSnapshotFacts(tx, orgId, valuationBvId),
    lifecycle: await lifecycleFacts(tx, orgId, valuationBvId),
    variant,
    waccInputs,
    methods: methods.map(({ id: _id, ...rest }: any) => rest),
    terminal,
    comps,
    grids: grids.map(({ id: _id, ...rest }: any) => rest),
    sensitivityCells,
    sensitivityCellCount: sensitivityCells.length,
    bridge: bridge ? (({ id: _id, ...rest }: any) => rest)(bridge) : null,
    bridgeComponents,
    advisorOutputs,
  };
}

// ---------------------------------------------------------------------------
// Statement / Analysis / Prediction reopen payloads (needed for FC-12.4)
// ---------------------------------------------------------------------------

export async function readStatementPayload(tx: Tx, orgId: string, statementBvId: string) {
  const lines = await tx.queryAll(
    `SELECT fsl.line_code, p.label AS period_label, e.entity_code, l.statement_type,
            l.consolidation_scope, l.value_status, l.value_decimal::text AS value_decimal,
            l.native_currency, l.presentation_currency, l.unit
       FROM finance_stmt_lines l
       JOIN financial_statement_lines fsl ON fsl.id = l.canonical_line_id
       JOIN finance_stmt_periods p ON p.period_id = l.period_id
       JOIN finance_stmt_entities e ON e.id = l.entity_id
      WHERE l.organization_id = ? AND l.business_version_id = ?
      ORDER BY p.period_start, p.label, e.entity_code, fsl.line_code, l.consolidation_scope`,
    [orgId, statementBvId]
  );
  return {
    kind: 'STATEMENT_PACK' as const,
    businessVersion: await businessVersionFacts(tx, orgId, statementBvId),
    workingRevisions: await workingRevisionFacts(tx, orgId, statementBvId),
    computeSnapshots: await computeSnapshotFacts(tx, orgId, statementBvId),
    lifecycle: await lifecycleFacts(tx, orgId, statementBvId),
    lines,
    lineCount: lines.length,
  };
}

export async function readAnalysisPayload(tx: Tx, orgId: string, analysisBvId: string) {
  const definition = await tx.queryOne(
    `SELECT purpose, analysis_type, entity_scope_mode, presentation_currency, unit, created_by
       FROM finance_analysis_definitions
      WHERE organization_id = ? AND business_version_id = ?`,
    [orgId, analysisBvId]
  );
  const kpis = await tx.queryAll(
    `SELECT c.kpi_code, p.label AS period_label, v.value_status,
            v.value_decimal::text AS value_decimal, v.quality_flag, v.is_adjustment, v.adjustment_reason
       FROM finance_analysis_kpi_values v
       JOIN finance_analysis_kpi_catalog c ON c.id = v.kpi_catalog_id
       JOIN finance_stmt_periods p ON p.period_id = v.period_id
      WHERE v.organization_id = ? AND v.business_version_id = ?
      ORDER BY c.kpi_code, p.period_start`,
    [orgId, analysisBvId]
  );
  return {
    kind: 'HISTORICAL_ANALYSIS' as const,
    businessVersion: await businessVersionFacts(tx, orgId, analysisBvId),
    workingRevisions: await workingRevisionFacts(tx, orgId, analysisBvId),
    computeSnapshots: await computeSnapshotFacts(tx, orgId, analysisBvId),
    lifecycle: await lifecycleFacts(tx, orgId, analysisBvId),
    definition,
    kpis,
    kpiCount: kpis.length,
  };
}

export async function readPredictionPayload(tx: Tx, orgId: string, predictionBvId: string) {
  const scenario = await tx.queryOne(
    `SELECT name, scenario_mode, created_by
       FROM finance_prediction_scenarios
      WHERE organization_id = ? AND business_version_id = ?`,
    [orgId, predictionBvId]
  );
  const outputs = await tx.queryAll(
    `SELECT fsl.line_code, p.label AS period_label, o.statement_type, o.consolidation_scope,
            o.value_status, o.value_decimal::text AS value_decimal,
            o.variance_vs_baseline_decimal::text AS variance_vs_baseline_decimal,
            o.native_currency, o.presentation_currency, o.unit
       FROM finance_prediction_outputs o
       JOIN financial_statement_lines fsl ON fsl.id = o.canonical_line_id
       JOIN finance_stmt_periods p ON p.period_id = o.period_id
      WHERE o.organization_id = ? AND o.business_version_id = ?
      ORDER BY p.period_start, p.label, fsl.line_code, o.consolidation_scope`,
    [orgId, predictionBvId]
  );
  /**
   * The values a reopened Prediction actually SHOWS. `finance_prediction_outputs`
   * is empty by design for `scenario_mode = 'STANDARD_BASE'` — a d07_02 trigger
   * forbids Base from owning its own rows ("Base cannot physically diverge from
   * Baseline"), and the Models/Results UI reads
   * `finance_prediction_outputs_effective`, which resolves Base through the
   * MODEL_TO_SCENARIO lineage edge instead. Comparing only the base table would
   * therefore compare an empty set and prove nothing about this stage, so the
   * effective view is read too.
   */
  const effectiveOutputs = await tx.queryAll(
    `SELECT fsl.line_code, p.label AS period_label, v.statement_type, v.consolidation_scope,
            v.value_status, v.value_decimal::text AS value_decimal,
            v.variance_vs_baseline_decimal::text AS variance_vs_baseline_decimal,
            v.native_currency, v.presentation_currency, v.unit, v.source
       FROM finance_prediction_outputs_effective v
       JOIN financial_statement_lines fsl ON fsl.id = v.canonical_line_id
       JOIN finance_stmt_periods p ON p.period_id = v.period_id
      WHERE v.business_version_id = ?
      ORDER BY p.period_start, p.label, fsl.line_code, v.consolidation_scope`,
    [predictionBvId]
  );
  const preflight = await tx.queryAll(
    `SELECT r.assumption_set_semantic_hash, r.findings_count::text AS findings_count,
            r.required_resolutions_count::text AS required_resolutions_count,
            r.superseded_by_preflight_run_id, r.run_by,
            f.finding_kind, f.requires_resolution,
            f.combined_impact_decimal::text AS combined_impact_decimal
       FROM finance_prediction_preflight_runs r
       LEFT JOIN finance_prediction_preflight_findings f ON f.preflight_run_id = r.id
      WHERE r.organization_id = ? AND r.business_version_id = ?
      ORDER BY r.run_at, r.id, f.finding_kind NULLS FIRST, f.id NULLS FIRST`,
    [orgId, predictionBvId]
  );
  return {
    kind: 'PREDICTION_SCENARIO' as const,
    businessVersion: await businessVersionFacts(tx, orgId, predictionBvId),
    workingRevisions: await workingRevisionFacts(tx, orgId, predictionBvId),
    computeSnapshots: await computeSnapshotFacts(tx, orgId, predictionBvId),
    lifecycle: await lifecycleFacts(tx, orgId, predictionBvId),
    scenario,
    outputs,
    outputCount: outputs.length,
    effectiveOutputs,
    effectiveOutputCount: effectiveOutputs.length,
    preflight,
  };
}

// ---------------------------------------------------------------------------
// FC-12.4 — whole-chain reopen payload (Statement -> ... -> Valuation)
// ---------------------------------------------------------------------------

export interface ChainIds {
  statement: string;
  analysis: string;
  baseline: string;
  prediction: string;
  valuation: string;
}

/**
 * Reads the full chain AND the lineage graph that makes it navigable backwards.
 * `lineageAncestors` is read through the production `lineageService.getAncestors`
 * rather than by a hand-rolled recursive CTE — the requirement is "lineage
 * nawigowalny wstecz", i.e. the shipping traversal must work after a cold
 * reopen, not merely the rows underneath it.
 */
export async function readChainPayload(
  tx: Tx,
  orgId: string,
  ids: ChainIds,
  getAncestors: (organizationId: string, versionId: string, maxDepth: number) => Promise<any[]>
) {
  const ancestors = await getAncestors(orgId, ids.valuation, 20);
  const normalisedAncestors = ancestors
    .map((e: any) => ({
      source_artifact_type: e.source_artifact_type,
      source_version_id: e.source_version_id,
      target_artifact_type: e.target_artifact_type,
      target_version_id: e.target_version_id,
      edge_type: e.edge_type,
      transformation_kind: e.transformation_kind,
      assumption_snapshot_hash: e.assumption_snapshot_hash ?? null,
    }))
    .sort((a, b) =>
      `${a.edge_type}|${a.source_version_id}|${a.target_version_id}`.localeCompare(
        `${b.edge_type}|${b.source_version_id}|${b.target_version_id}`
      )
    );

  const freshness = await tx.queryAll(
    `SELECT business_version_id, status, freshness, freshness_reason,
            ${tsUtc('stale_since', 'stale_since')}
       FROM finance_business_versions
      WHERE organization_id = ? AND business_version_id = ANY(?)
      ORDER BY business_version_id`,
    [orgId, [ids.statement, ids.analysis, ids.baseline, ids.prediction, ids.valuation]]
  );

  return {
    kind: 'FULL_CHAIN' as const,
    statement: await readStatementPayload(tx, orgId, ids.statement),
    analysis: await readAnalysisPayload(tx, orgId, ids.analysis),
    baseline: await readBaselinePayload(tx, orgId, ids.baseline),
    prediction: await readPredictionPayload(tx, orgId, ids.prediction),
    valuation: await readValuationPayload(tx, orgId, ids.valuation),
    lineageAncestors: normalisedAncestors,
    lineageEdgeCount: normalisedAncestors.length,
    freshness,
  };
}

// ---------------------------------------------------------------------------
// Compute-activity witness — "no recompute happened"
// ---------------------------------------------------------------------------

/**
 * FC-05.8 requires the cold reopen to return the frozen values "bez
 * przeliczania". A payload comparison alone cannot prove that: a recompute
 * that happened to be deterministic would produce identical numbers. So the
 * reader also fingerprints the compute-side write surface — job/run counts and
 * the newest job timestamp in the org. If a reopen silently kicked off a
 * compute, this witness moves even when the values do not.
 */
export async function readComputeActivityWitness(tx: Tx, orgId: string) {
  const jobs = await tx.queryOne(
    `SELECT count(*)::text AS job_count,
            coalesce(${tsExpr('max(created_at)')}, 'none') AS newest_job,
            coalesce(${tsExpr('max(finished_at)')}, 'none') AS newest_finish
       FROM compute_jobs WHERE organization_id = ?`,
    [orgId]
  );
  const runs = await tx.queryOne(
    `SELECT count(*)::text AS run_count
       FROM compute_job_runs r
      WHERE r.job_id IN (SELECT id FROM compute_jobs WHERE organization_id = ?)`,
    [orgId]
  );
  const snapshots = await tx.queryOne(
    `SELECT count(*)::text AS snapshot_count FROM finance_compute_snapshots WHERE organization_id = ?`,
    [orgId]
  );
  const freshnessEvents = await tx.queryOne(
    `SELECT count(*)::text AS freshness_event_count
       FROM finance_lineage_freshness_events WHERE organization_id = ?`,
    [orgId]
  );
  return { ...(jobs as any), ...(runs as any), ...(snapshots as any), ...(freshnessEvents as any) };
}

// ---------------------------------------------------------------------------
// Separate-process entry point — THE cold side
// ---------------------------------------------------------------------------

export type ReaderMode = 'baseline' | 'valuation' | 'chain';

export interface ChildReaderResult {
  mode: ReaderMode;
  digest: string;
  canonical: string;
  witnessDigest: string;
  witness: unknown;
  /** ms spent inside the child on the read itself (pool creation + queries). */
  readMs: number;
  /** ms from child process start to end of read — the honest end-user number. */
  processMs: number;
  backendPids: number[];
  pid: number;
}

async function main(): Promise<void> {
  const started = Date.now();
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=');
      return [k, rest.join('=')];
    })
  ) as Record<string, string>;

  const connectionString = process.env.DATABASE_URL ?? '';
  if (!(process.env.RUN_DB_TESTS === '1' && process.env.MOCK_DB === 'false' && connectionString.startsWith('postgres'))) {
    throw new Error(
      'coldReopenReader child requires RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=postgresql://... against an ephemeral cluster.'
    );
  }
  process.env.DB_TYPE = 'postgres';

  const mode = args.mode as ReaderMode;
  const orgId = args.org;
  const ids = JSON.parse(args.ids) as Partial<ChainIds>;

  const readStart = Date.now();
  const { withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js');
  const lineageService = await import('../lineageService.js');

  const backendPids: number[] = [];
  const result = await withPinnedPostgresTransaction(async (tx) => {
    const pidRow = await tx.queryOne<{ pid: string }>(`SELECT pg_backend_pid()::text AS pid`);
    if (pidRow) backendPids.push(Number(pidRow.pid));
    if (mode === 'baseline') return readBaselinePayload(tx as Tx, orgId, ids.baseline!);
    if (mode === 'valuation') return readValuationPayload(tx as Tx, orgId, ids.valuation!);
    return readChainPayload(tx as Tx, orgId, ids as ChainIds, lineageService.getAncestors as any);
  });
  const witness = await withPinnedPostgresTransaction((tx) => readComputeActivityWitness(tx as Tx, orgId));
  const readMs = Date.now() - readStart;

  const out: ChildReaderResult = {
    mode,
    digest: digest(result),
    canonical: canonicalize(result),
    witnessDigest: digest(witness),
    witness,
    readMs,
    processMs: Date.now() - started,
    backendPids,
    pid: process.pid,
  };
  /**
   * Written to a FILE rather than piped on stdout. The full-chain payload runs
   * to several megabytes and `process.stdout.write` + `process.exit()` truncates
   * it mid-string on a pipe — which is exactly how the first run of this suite
   * failed. A synchronous file write cannot be truncated by the exit below.
   */
  const outPath = args.out;
  if (!outPath) throw new Error('coldReopenReader child requires --out=<path>');
  const fs = await import('node:fs');
  fs.writeFileSync(outPath, JSON.stringify(out));
  process.stdout.write(`__COLD_REOPEN_RESULT_AT__${outPath}__END__`);

  const db = (await import('../../../../database/PostgresDatabase.js')).default as any;
  await db.close();
}

/**
 * Only run `main()` when this file IS the process entry point (`tsx
 * coldReopenReader.ts`). When `coldReopen.pg.test.ts` imports it for the hot
 * read, `process.argv[1]` is vitest's own entry, so nothing fires.
 */
const invokedDirectly =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  typeof process.argv[1] === 'string' &&
  /coldReopenReader\.(ts|js|mts|mjs)$/.test(process.argv[1]);

if (invokedDirectly) {
  main().then(
    () => process.exit(0),
    (err) => {
      process.stderr.write(`[coldReopenReader] FATAL ${err?.stack ?? String(err)}\n`);
      process.exit(1);
    }
  );
}
