/**
 * Finance v3 canonical — Analysis formula-AST evaluator (Gate D / Fala 4, WP-D04).
 *
 * Program: `FINANCE_COMPLETE_PROGRAM_CLAUDE_HANDOFF_2026-08-09.md` section 6
 * (formula AST / KPI compute). Schema: `WP-D03_analysis_schema_ADR.md`
 * section 5.2 (the `FormulaNode` JSON schema this module's types mirror
 * 1:1), section 6.5 (negative-denominator policy), and the seed catalog
 * `server/migrations/20260809_finance_v3_d03_analysis_03_kpi_p0_catalog.sql`
 * (18 real formula_ast trees this evaluator is tested against).
 *
 * PURE module: zero DB imports, zero `finance_stmt_periods`/`finance_stmt_lines`
 * knowledge. Every "go fetch a number" concern is behind two small resolver
 * interfaces the caller injects (`CellResolver`, `FormulaRefResolver`) —
 * `kpiComputeService.ts` is the only module that implements those against
 * Postgres. This mirrors the existing pattern in this same directory:
 * `statementReconciliationService.ts`'s `computeWaterfall` is pure math over
 * caller-supplied rows; this module is pure math over a caller-supplied
 * resolver, one level more indirect because a formula tree — unlike a flat
 * waterfall — needs to ask "what is this cell's value" possibly dozens of
 * times per KPI (`formula_ref` composition, `AVERAGE_BALANCE`'s two points).
 *
 * WHY "never silent zero" governs every branch below (WP-D01's own
 * `statementMappingService.ts` doctrine, restated for Analysis): a formula
 * whose input is missing NEVER computes a number — it returns
 * `value_status='MISSING'`. A formula whose denominator is exactly zero
 * NEVER computes a number — it returns `value_status='NOT_APPLICABLE'`,
 * `quality_flag='DIVISION_BY_ZERO'` (this is not a style preference: the DB
 * CHECK `chk_finance_analysis_kpi_values_division_by_zero_shape` in
 * `20260809_finance_v3_d03_analysis_01_tables.sql` makes any other shape a
 * write-time constraint violation — this module's `DIVISION_BY_ZERO` branch
 * exists to make that never even attempted, not merely to satisfy the DB).
 *
 * IMPORTANT DESIGN DECISION (documented — not literally spelled out by the
 * ADR's prose, which is worth calling out explicitly per WP-D04's own
 * report): ADR section 5.2's last paragraph says `negative_denominator_policy`
 * "applies to" the `ratio` operator specifically, reserved for the canonical
 * money/money case. But the ADR's OWN seed data
 * (`..._03_kpi_p0_catalog.sql` row 10, `DSO`) declares
 * `negative_denominator_policy='FORCE_NA'` on a KPI whose formula_ast root
 * node is `divide`, not `ratio` (`DSO = divide(AR_avg, divide(REVENUE,
 * DAYS_IN_PERIOD))` — nested `divide` used to build "revenue per day", not
 * `ratio`). A literal-`ratio`-only reading of the policy would make DSO's
 * `negative_denominator_policy` column a KPI the policy never fires for —
 * silently inert data on 8 of the 18 P0 rows (`DSO`/`DIO`/`DPO`/
 * `REVENUE_GROWTH_YOY` all have a `divide` root, not `ratio`). This module
 * resolves the tension the way a compute engine actually has to: the policy
 * is a KPI-level property (one value per catalog row, not per AST node), so
 * it is applied to whichever operator sits at the ROOT of that KPI's own
 * `formula_ast` — exactly the position that represents "this KPI's own
 * output", regardless of whether the ADR's author happened to spell the
 * root division as `ratio` or `divide`. A `divide`/`ratio` node nested
 * *inside* the tree (e.g. `REVENUE / DAYS_IN_PERIOD` inside `DSO`) is pure
 * arithmetic and never gets the business-level negative-denominator
 * treatment — only physical `DIVISION_BY_ZERO` protection, which applies
 * uniformly at every division regardless of nesting. `CASH_CONVERSION_CYCLE`
 * (root op `subtract`, catalog `negative_denominator_policy=NULL`) never
 * reaches this branch at all, consistent with the ADR's own "n/a (add/
 * subtract, not a ratio)" note for that row.
 */

// ---------------------------------------------------------------------------
// Types — mirrors WP-D03 ADR section 5.2's FormulaNode JSON schema verbatim.
// ---------------------------------------------------------------------------

export type UnitType = 'MONETARY' | 'RATIO' | 'PERCENT' | 'MULTIPLE' | 'DAYS' | 'COUNT' | 'MONETARY_PER_DAY' | 'DIMENSIONLESS';

export type OperatorKind = 'add' | 'subtract' | 'multiply' | 'divide' | 'ratio';

export interface OperatorNode {
  node: 'operator';
  op: OperatorKind;
  left: FormulaNode;
  right: FormulaNode;
}

export type ConsolidationScope = 'CONSOLIDATED' | 'STANDALONE';

export interface CellRefOperand {
  canonicalLineCode: string;
  consolidationScope: ConsolidationScope;
  entityScope: 'ANALYSIS_DEFAULT' | { entityCode: string };
  periodOffset:
    | 'CURRENT'
    | 'PRIOR_PERIOD'
    | 'PRIOR_YEAR_SAME_PERIOD'
    | 'AVERAGE_CURRENT_AND_PRIOR'
    | 'LTM_SUM_4Q'
    | 'LTM_LATEST_Q_CLOSE';
}

export type OperandNode =
  | { node: 'operand'; kind: 'cell_ref'; cellRef: CellRefOperand }
  | { node: 'operand'; kind: 'literal'; value: number; unitType?: UnitType }
  | { node: 'operand'; kind: 'literal'; valueRef: 'DAYS_IN_PERIOD' | 'ANNUALIZATION_FACTOR' }
  | { node: 'operand'; kind: 'formula_ref'; kpiCode: string };

export type FormulaNode = OperatorNode | OperandNode;

/** `finance_analysis_kpi_catalog.negative_denominator_policy` DB CHECK values. `null` = n/a (non-ratio-shaped KPI, e.g. CASH_CONVERSION_CYCLE). */
export type NegativeDenominatorPolicy = 'SHOW_WITH_FLAG' | 'FORCE_NA' | null;

/** `finance_analysis_kpi_values.quality_flag` DB CHECK values — this module NEVER produces a value outside this set (see file header: task-level prose mentions "MISSING_INPUT" as an example, but that is not a DB-valid quality_flag; a missing input surfaces as `status='MISSING'` instead, per WP-D01's own value_status doctrine — see `kpiComputeService.ts` report discussion). */
export type QualityFlag = 'DIVISION_BY_ZERO' | 'NEGATIVE_DENOMINATOR' | 'INSUFFICIENT_HISTORY' | 'ESTIMATED_ANNUALIZED';

/**
 * `finance_analysis_kpi_values.value_status` DB CHECK values this module can produce.
 *
 * P1 fix (`PKG_FIX_CANONICAL_report.md`, defect 2 — "NA jest nieosiągalny"): this comment used to
 * read "never `'NA'` — reserved for other domains/callers, not emitted by this evaluator", and that
 * was true — `evaluateNode`'s divide/ratio branch mapped BOTH a zero denominator AND a MISSING
 * denominator to `'NOT_APPLICABLE'`, so the DEC-FIN-005 guarantee ("brak danych daje N/A z powodem,
 * NIGDY zero") had no live code path producing `NA` anywhere in this evaluator, confirmed by an
 * independent oracle (GoldCo). Per the kanon's 5-state value type, a division whose denominator is
 * missing or exactly zero is "cannot be computed" (`NA`), a strictly different fact from
 * `NOT_APPLICABLE` ("this position does not apply to this entity/period" — e.g. `INSUFFICIENT_HISTORY`
 * below, unaffected by this fix) and from `MISSING` ("the data itself is absent" — still used when the
 * NUMERATOR, not the denominator, is missing). `NA` is fixed here to CARRY the reason code via
 * `EvaluationResult.detail` (persisted to `finance_analysis_kpi_values.interpretation_text`), not via
 * `quality_flag`: the DB CHECK `chk_finance_analysis_kpi_values_division_by_zero_shape`
 * (`20260809_finance_v3_d03_analysis_01_tables.sql`) hard-requires `value_status='NOT_APPLICABLE'`
 * whenever `quality_flag='DIVISION_BY_ZERO'` — a schema constraint this fix deliberately does NOT
 * touch (outside this fix's allowlisted paths, and not necessary: `qualityFlag` stays `null` for the
 * new `NA` branches below, so that CHECK is simply never exercised by this evaluator anymore, not
 * violated).
 */
export type EvalValueStatus = 'PRESENT_NONZERO' | 'PRESENT_ZERO' | 'MISSING' | 'NA' | 'NOT_APPLICABLE';

export interface EvaluationResult {
  status: EvalValueStatus;
  value: number | null;
  qualityFlag: QualityFlag | null;
  /** Human-readable diagnostic (feeds `finance_analysis_kpi_values.interpretation_text` / logs) — never persisted as `quality_flag` itself. */
  detail: string | null;
}

// ---------------------------------------------------------------------------
// Resolver interfaces — the only things a caller must implement.
// ---------------------------------------------------------------------------

export type CellResolutionFailureReason =
  | 'INSUFFICIENT_HISTORY'
  | 'WRONG_PERIOD_TYPE_FOR_LTM'
  | 'UNSUPPORTED_PERIOD_TYPE_FOR_YOY'
  | 'ENTITY_NOT_FOUND'
  | 'CANONICAL_LINE_NOT_FOUND';

export type CellResolution =
  | { ok: true; status: 'PRESENT_NONZERO' | 'PRESENT_ZERO'; value: number }
  | { ok: true; status: 'MISSING' }
  | { ok: false; reason: CellResolutionFailureReason; detail: string };

export interface CellResolver {
  resolveCell(cellRef: CellRefOperand): Promise<CellResolution>;
}

export interface FormulaRefResolver {
  /** Resolves an already-ACTIVE/COMPILED_OK sibling catalog entry's OWN value for the same (entity, period) context this evaluation is running under. */
  resolveFormulaRef(kpiCode: string): Promise<EvaluationResult>;
}

export interface DynamicConstantResolver {
  /** `finance_stmt_periods.period_end - period_start + 1` for the target period. */
  daysInPeriod(): number;
  /** `periods_per_year / periods_elapsed`, or `null` if unsupported for this period's granularity (INTERIM_ANNUALIZED formulas referencing it then evaluate to MISSING). */
  annualizationFactor(): number | null;
}

export interface EvalContext {
  cellResolver: CellResolver;
  formulaRefResolver: FormulaRefResolver;
  dynamicConstants: DynamicConstantResolver;
}

// ---------------------------------------------------------------------------
// Internal result shape — like EvaluationResult but a divide/ratio node also
// carries its own already-evaluated denominator, so evaluateFormula's root-
// level negative-denominator policy check (file header) does not need to
// evaluate the right subtree a second time.
// ---------------------------------------------------------------------------

interface InternalResult extends EvaluationResult {
  denominator?: EvaluationResult;
}

const MISSING: EvaluationResult = { status: 'MISSING', value: null, qualityFlag: null, detail: null };

function isUnusable(r: EvaluationResult): boolean {
  return r.status === 'MISSING' || r.status === 'NA' || r.status === 'NOT_APPLICABLE';
}

/**
 * MISSING beats NA beats NOT_APPLICABLE beats a flagged-but-present value, when combining two
 * unusable children — "the data itself is absent" is the most fundamental blocker, then "cannot be
 * computed" (a nested divide-by-zero/missing-denominator propagating up through an outer add/
 * subtract/multiply/divide), then "flagged as not applicable" is the mildest. P1 fix
 * (`PKG_FIX_CANONICAL_report.md`, defect 2): the `NA` branch is new — without it, an `NA` result
 * from a nested division would NOT be recognized as unusable by the old two-way check, and an outer
 * arithmetic op would silently read its `null` value as a number.
 */
function propagateUnusable(left: EvaluationResult, right: EvaluationResult): EvaluationResult {
  if (left.status === 'MISSING' || right.status === 'MISSING') {
    const detail = left.status === 'MISSING' ? left.detail : right.detail;
    return { status: 'MISSING', value: null, qualityFlag: null, detail: detail ?? 'an operand is MISSING' };
  }
  if (left.status === 'NA' || right.status === 'NA') {
    const na = left.status === 'NA' ? left : right;
    return { status: 'NA', value: null, qualityFlag: na.qualityFlag, detail: na.detail ?? 'an operand is NA (cannot be computed)' };
  }
  // Both/either NOT_APPLICABLE.
  const flagged = left.status === 'NOT_APPLICABLE' ? left : right;
  return { status: 'NOT_APPLICABLE', value: null, qualityFlag: flagged.qualityFlag, detail: flagged.detail };
}

// ---------------------------------------------------------------------------
// evaluateNode — recursive, structural. No policy applied here except the
// PHYSICAL division-by-zero guard, which is unconditional at every division
// regardless of nesting (file header).
// ---------------------------------------------------------------------------

async function evaluateNode(node: FormulaNode, ctx: EvalContext): Promise<InternalResult> {
  if (node.node === 'operand') {
    if (node.kind === 'cell_ref') {
      const resolved = await ctx.cellResolver.resolveCell(node.cellRef);
      if (!resolved.ok) {
        if (resolved.reason === 'INSUFFICIENT_HISTORY') {
          // Not a numeric MISSING (source data absent) — this is "the convention this KPI
          // requires cannot be satisfied for this period" (e.g. first period on record, no
          // previous_period_id). ADR 6.4: "quality_flag='INSUFFICIENT_HISTORY', nie cichy
          // fallback na wartość punktową." Modeled as NOT_APPLICABLE (a real DB-valid
          // value_status) carrying that quality_flag, not MISSING (which carries none).
          return { status: 'NOT_APPLICABLE', value: null, qualityFlag: 'INSUFFICIENT_HISTORY', detail: resolved.detail };
        }
        // WRONG_PERIOD_TYPE_FOR_LTM / UNSUPPORTED_PERIOD_TYPE_FOR_YOY / ENTITY_NOT_FOUND /
        // CANONICAL_LINE_NOT_FOUND: configuration/readiness problems, not DB-valid quality
        // flags (see module header + `QualityFlag` type comment) — surfaces as MISSING with a
        // diagnostic `detail` string instead of inventing a non-schema enum value.
        return { status: 'MISSING', value: null, qualityFlag: null, detail: `${resolved.reason}: ${resolved.detail}` };
      }
      if (resolved.status === 'MISSING') return { ...MISSING, detail: 'source finance_stmt_lines cell is value_status=MISSING' };
      return { status: resolved.status, value: resolved.value, qualityFlag: null, detail: null };
    }

    if (node.kind === 'literal') {
      if ('valueRef' in node) {
        if (node.valueRef === 'DAYS_IN_PERIOD') {
          const days = ctx.dynamicConstants.daysInPeriod();
          return { status: days === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', value: days, qualityFlag: null, detail: null };
        }
        // ANNUALIZATION_FACTOR
        const factor = ctx.dynamicConstants.annualizationFactor();
        if (factor === null) {
          return { status: 'MISSING', value: null, qualityFlag: null, detail: 'ANNUALIZATION_FACTOR unsupported for this period granularity' };
        }
        return { status: factor === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', value: factor, qualityFlag: null, detail: null };
      }
      // Plain authored literal — always present by construction (compile-time constant).
      return { status: node.value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', value: node.value, qualityFlag: null, detail: null };
    }

    // formula_ref
    const nested = await ctx.formulaRefResolver.resolveFormulaRef(node.kpiCode);
    return { ...nested };
  }

  // operator
  const left = await evaluateNode(node.left, ctx);
  const right = await evaluateNode(node.right, ctx);

  switch (node.op) {
    case 'add':
      if (isUnusable(left) || isUnusable(right)) return propagateUnusable(left, right);
      return numeric((left.value as number) + (right.value as number));

    case 'subtract':
      if (isUnusable(left) || isUnusable(right)) return propagateUnusable(left, right);
      return numeric((left.value as number) - (right.value as number));

    case 'multiply':
      if (isUnusable(left) || isUnusable(right)) return propagateUnusable(left, right);
      return numeric((left.value as number) * (right.value as number));

    case 'divide':
    case 'ratio': {
      // P1 fix (`PKG_FIX_CANONICAL_report.md`, defect 2 — "NA jest nieosiągalny"): a MISSING or
      // exactly-zero DENOMINATOR makes the division itself mathematically undefined, independent
      // of the numerator's own state — this is `NA` ("cannot be computed"), checked FIRST and
      // unconditionally, never `MISSING` (that stays reserved for "the source data is absent",
      // still the correct status when only the NUMERATOR is missing, handled further below) and
      // never a silently fabricated number. `qualityFlag` stays `null` here (not
      // `'DIVISION_BY_ZERO'`) — see `EvalValueStatus`'s doc comment for why: the DB CHECK pairs
      // that flag with `NOT_APPLICABLE`, not `NA`. The reason code instead travels in `detail`
      // (persisted to `interpretation_text`), prefixed `NA_REASON:` so it is machine-parseable.
      if (right.status === 'MISSING') {
        return {
          status: 'NA',
          value: null,
          qualityFlag: null,
          // Preserves the denominator's own `detail` (e.g. "WRONG_PERIOD_TYPE_FOR_LTM: ...") rather
          // than discarding it — the NA_REASON prefix says WHY this is NA at the divide level, the
          // parenthetical keeps the underlying diagnostic from the operand that actually failed.
          detail: `NA_REASON:DENOMINATOR_MISSING — cannot compute ${node.op}: denominator is MISSING${right.detail ? ` (${right.detail})` : ''}`,
          denominator: right,
        };
      }
      // NA denominator (e.g. a NESTED divide-by-zero one level down, like DSO's inner
      // `REVENUE/DAYS_IN_PERIOD`) or NOT_APPLICABLE denominator (e.g. INSUFFICIENT_HISTORY)
      // propagate as-is via propagateUnusable — the nested reason code survives in `detail`
      // ("cannot compute" infects the whole tree, exactly like MISSING already did).
      if (right.status === 'NA' || right.status === 'NOT_APPLICABLE') return { ...propagateUnusable(left, right), denominator: right };
      const denomValue = right.value as number;
      if (denomValue === 0) {
        const dbz: InternalResult = {
          status: 'NA',
          value: null,
          qualityFlag: null,
          detail: `NA_REASON:DIVISION_BY_ZERO — ${node.op} by zero`,
          denominator: right,
        };
        return dbz;
      }
      // Numerator issues (denominator is confirmed present/nonzero at this point): MISSING/NA/
      // NOT_APPLICABLE numerator propagates via the normal priority order.
      if (isUnusable(left)) return { ...propagateUnusable(left, right), denominator: right };
      const result = numeric((left.value as number) / denomValue);
      return { ...result, denominator: right };
    }

    default: {
      const _exhaustive: never = node.op;
      throw new Error(`formulaAstEvaluator: unknown operator ${String(_exhaustive)}`);
    }
  }
}

function numeric(value: number): InternalResult {
  return { status: value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO', value, qualityFlag: null, detail: null };
}

// ---------------------------------------------------------------------------
// evaluateFormula — public entry point. Wraps evaluateNode with the KPI-level
// negative_denominator_policy check at the ROOT node (file header decision).
// ---------------------------------------------------------------------------

export async function evaluateFormula(
  formulaAst: FormulaNode,
  ctx: EvalContext,
  negativeDenominatorPolicy: NegativeDenominatorPolicy
): Promise<EvaluationResult> {
  const result = await evaluateNode(formulaAst, ctx);

  const rootIsDivisionShaped = formulaAst.node === 'operator' && (formulaAst.op === 'divide' || formulaAst.op === 'ratio');

  if (rootIsDivisionShaped && negativeDenominatorPolicy && result.denominator) {
    // DIVISION_BY_ZERO/missing-denominator (now NA, P1 fix) already takes precedence (0 is not
    // negative, so there is no overlap to arbitrate) and any already-unusable (MISSING/NA/
    // NOT_APPLICABLE) result is left exactly as-is.
    const denom = result.denominator;
    if (denom.status !== 'MISSING' && denom.status !== 'NA' && denom.status !== 'NOT_APPLICABLE' && (denom.value as number) < 0) {
      if (negativeDenominatorPolicy === 'FORCE_NA') {
        // ADR 6.5: "value_status='NOT_APPLICABLE', quality_flag pozostaje NULL (to nie jest błąd
        // obliczeniowy, to jest polityczna decyzja)."
        return {
          status: 'NOT_APPLICABLE',
          value: null,
          qualityFlag: null,
          detail: `negative_denominator_policy=FORCE_NA: denominator ${denom.value} < 0`,
        };
      }
      // SHOW_WITH_FLAG: keep the computed value, attach the flag (only meaningful when the
      // result itself is actually numeric — a MISSING/NOT_APPLICABLE numerator upstream already
      // short-circuited above via propagateUnusable inside evaluateNode's divide/ratio branch,
      // so `result` here is guaranteed numeric whenever we reach this line).
      return {
        status: result.status,
        value: result.value,
        qualityFlag: 'NEGATIVE_DENOMINATOR',
        detail: `negative_denominator_policy=SHOW_WITH_FLAG: denominator ${denom.value} < 0`,
      };
    }
  }

  const { denominator: _denominator, ...pub } = result;
  return pub;
}
