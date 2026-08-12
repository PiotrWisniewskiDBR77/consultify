/**
 * `valuationMath` — pure, client-side validation/normalization helpers for the Enterprise
 * Valuation workspace (Pakiet H).
 *
 * Two families of function here, deliberately kept apart:
 *
 *  1. UI-side MIRRORS of server-side gates (`assertGBelowWacc`, `impliedGFromReinvestmentRoic`,
 *     `evaluateGConsistency`, `validateBasketWeights`, `assertSensitivityGridShape`). These exist
 *     so the workspace can give a "friendly error before submit" the same way the server gives a
 *     "friendly error before the DB CHECK/trigger would reject it" — same discipline
 *     `valuationTerminalService.assertGBelowWacc()`'s own header documents for itself. The SERVER
 *     is still the authoritative gate (its DB trigger `trg_finance_valuation_terminal_check_g_below_wacc`
 *     and `trg_finance_valuation_methods_weight_sum` are the real enforcement points) — these
 *     functions can only drift out of sync with the server if one side is edited and not the
 *     other, exactly the same caveat the server-side originals carry. They are PORTS (typed from
 *     reading `server/src/services/finance/canonical/valuationTerminalService.ts` and
 *     `valuationComputeService.ts` at base SHA 9604652e27), not imports — this package never
 *     crosses the src/↔server/src boundary, same rule `financeV2.types.ts` documents.
 *
 *  2. NORMALIZATION helpers (`normalizeAdvisorFinding`) that absorb the camelCase/snake_case
 *     inconsistency measured in `financeV2.types.ts` (§ PKG-H Valuation) between
 *     `POST .../advisor/generate` and `GET .../advisor`, so every other component in this folder
 *     can render ONE finding shape regardless of which endpoint produced it.
 */

import type {
  ValuationAdvisorConfidence,
  ValuationAdvisorFindingGeneratedDto,
  ValuationAdvisorFindingStoredDto,
  ValuationAdvisorOutputKind,
  ValuationMethodDto,
  ValuationMethodType,
  ValuationSensitivityCellDto,
} from '@/services/api/financeV2.types';

// =============================================================================================
// g < WACC — mirrors `valuationTerminalService.assertGBelowWacc()` (line 36-45 at base SHA).
// =============================================================================================

export type GBelowWaccResult = { ok: true } | { ok: false; code: 'G_MUST_BE_LESS_THAN_WACC'; message: string };

/** Terminal growth `g` must be strictly less than WACC — Gordon Growth is undefined/negative otherwise. */
export function assertGBelowWacc(gPct: number, waccPct: number): GBelowWaccResult {
  if (!Number.isFinite(gPct) || !Number.isFinite(waccPct)) {
    return { ok: false, code: 'G_MUST_BE_LESS_THAN_WACC', message: 'g_pct i WACC muszą być liczbami skończonymi.' };
  }
  if (gPct >= waccPct) {
    return {
      ok: false,
      code: 'G_MUST_BE_LESS_THAN_WACC',
      message: `Wzrost terminalny g (${gPct}%) musi być ściśle mniejszy niż WACC (${waccPct}%) — inaczej wzór Gordona jest nieokreślony lub ujemny.`,
    };
  }
  return { ok: true };
}

// =============================================================================================
// g = reinvestment rate × ROIC — mirrors `valuationTerminalService.impliedGFromReinvestmentRoic()`
// (line 89-91). Reasonableness cross-check, NEVER a hard rule (server never rejects a mismatch —
// see that function's own doc comment) — surfaced here as an explicit, visible warning instead.
// =============================================================================================

export function impliedGFromReinvestmentRoic(reinvestmentRatePct: number, roicPct: number): number {
  return (reinvestmentRatePct / 100) * (roicPct / 100) * 100;
}

export interface GConsistencyResult {
  /** `null` when either input is missing — never treated as a silent 0/0 match. */
  impliedGPct: number | null;
  gapPp: number | null;
  /** `true` only when both inputs are present AND the gap is within tolerance. Missing inputs are NOT "consistent" — they are unproven, surfaced separately via `inputsMissing`. */
  consistent: boolean;
  inputsMissing: boolean;
}

/** Default tolerance mirrors the Advisor's own `ADVISOR_THRESHOLDS.impliedGTolerancePp` intent (a documented reasonableness band, not zero-tolerance float equality). */
export const DEFAULT_G_CONSISTENCY_TOLERANCE_PP = 1;

export function evaluateGConsistency(
  gPct: number | null,
  reinvestmentRatePct: number | null,
  roicPct: number | null,
  toleranceP_p: number = DEFAULT_G_CONSISTENCY_TOLERANCE_PP
): GConsistencyResult {
  if (gPct === null || reinvestmentRatePct === null || roicPct === null) {
    return { impliedGPct: null, gapPp: null, consistent: false, inputsMissing: true };
  }
  const impliedGPct = impliedGFromReinvestmentRoic(reinvestmentRatePct, roicPct);
  const gapPp = Math.abs(gPct - impliedGPct);
  return { impliedGPct, gapPp, consistent: gapPp <= toleranceP_p, inputsMissing: false };
}

// =============================================================================================
// Nominal/real + pre/post-tax + currency consistency — mirrors
// `valuationWaccService.assertWaccConsistency()` (line 96-119 at base SHA). Classic valuation
// error: discounting nominal cash flows with a real rate (or after-tax flows with a pre-tax
// rate) silently mis-states EV. Hard rejection, not a warning — same "hard block over silent
// wrong number" judgment as the EV→Equity bridge `as_of` alignment check.
// =============================================================================================

export type WaccConsistencyErrorCode = 'UNSUPPORTED_NOMINAL_REAL_CONVENTION' | 'UNSUPPORTED_PRE_POST_TAX_CONVENTION' | 'CURRENCY_MISMATCH';

export type WaccConsistencyResult = { ok: true } | { ok: false; code: WaccConsistencyErrorCode; message: string };

export interface WaccConsistencyInput {
  nominalOrReal: 'NOMINAL' | 'REAL';
  preOrPostTax: 'PRE_TAX' | 'POST_TAX';
  currency: string;
}

/**
 * This engine's FCFF is always NOMINAL, POST_TAX (Baseline/Prediction compute has no inflation
 * layer, and FCFF = EBIT*(1-cash_tax_rate)+... is already after-tax by construction) — so WACC
 * must match on both axes, plus currency, before it may be used to discount that FCFF series.
 */
export function assertWaccConsistency(wacc: WaccConsistencyInput, fcffCurrency: string): WaccConsistencyResult {
  if (wacc.nominalOrReal !== 'NOMINAL') {
    return {
      ok: false,
      code: 'UNSUPPORTED_NOMINAL_REAL_CONVENTION',
      message: `WACC jest oznaczony jako '${wacc.nominalOrReal}', ale przepływy FCFF w tym silniku są zawsze NOMINALNE (brak warstwy inflacji w Baseline/Prediction) — przelicz WACC na bazie nominalnej albo dyskontuj przepływy realne.`,
    };
  }
  if (wacc.preOrPostTax !== 'POST_TAX') {
    return {
      ok: false,
      code: 'UNSUPPORTED_PRE_POST_TAX_CONVENTION',
      message: `WACC jest oznaczony jako '${wacc.preOrPostTax}', ale FCFF jest już liczony PO OPODATKOWANIU — przelicz WACC na bazie post-tax.`,
    };
  }
  if (wacc.currency !== fcffCurrency) {
    return {
      ok: false,
      code: 'CURRENCY_MISMATCH',
      message: `Waluta WACC ('${wacc.currency}') nie zgadza się z walutą prezentacyjną FCFF ('${fcffCurrency}') — WACC i przepływy muszą być w tej samej walucie przed dyskontowaniem.`,
    };
  }
  return { ok: true };
}

// =============================================================================================
// Sensitivity 5x5 MONOTONICITY — mirrors `valuationSensitivityService.findMonotonicityViolation()`
// (line 106-135 at base SHA). A non-monotonic cell is an ENGINE bug signal, not just a rendering
// concern — EV must be non-increasing as WACC rises (row-wise, WACC ascending across columns) and
// non-decreasing as terminal g rises (column-wise, g ascending across rows), for any pair of
// adjacent DEFINED cells (null cells — g>=WACC corners — are skipped, never compared).
// =============================================================================================

export function findSensitivityMonotonicityViolation(
  cells: readonly Pick<ValuationSensitivityCellDto, 'rowIndex' | 'colIndex' | 'rowAxisValue' | 'columnAxisValue' | 'cellValueDecimal'>[]
): string | null {
  const byRow = new Map<number, typeof cells[number][]>();
  const byCol = new Map<number, typeof cells[number][]>();
  for (const cell of cells) {
    if (!byRow.has(cell.rowIndex)) byRow.set(cell.rowIndex, []);
    byRow.get(cell.rowIndex)!.push(cell);
    if (!byCol.has(cell.colIndex)) byCol.set(cell.colIndex, []);
    byCol.get(cell.colIndex)!.push(cell);
  }

  for (const [rowIndex, rowCells] of byRow) {
    const sorted = [...rowCells].sort((a, b) => a.colIndex - b.colIndex); // ascending WACC
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.cellValueDecimal === null || cur.cellValueDecimal === null) continue;
      if (cur.cellValueDecimal > prev.cellValueDecimal) {
        return `wiersz ${rowIndex}: EV w kolumnie ${cur.colIndex} (WACC=${cur.columnAxisValue}) = ${cur.cellValueDecimal} jest większe niż EV w kolumnie ${prev.colIndex} (WACC=${prev.columnAxisValue}) = ${prev.cellValueDecimal} — EV powinno maleć (lub stać) wraz ze wzrostem WACC.`;
      }
    }
  }
  for (const [colIndex, colCells] of byCol) {
    const sorted = [...colCells].sort((a, b) => a.rowIndex - b.rowIndex); // ascending g
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (prev.cellValueDecimal === null || cur.cellValueDecimal === null) continue;
      if (cur.cellValueDecimal < prev.cellValueDecimal) {
        return `kolumna ${colIndex}: EV w wierszu ${cur.rowIndex} (g=${cur.rowAxisValue}) = ${cur.cellValueDecimal} jest mniejsze niż EV w wierszu ${prev.rowIndex} (g=${prev.rowAxisValue}) = ${prev.cellValueDecimal} — EV powinno rosnąć (lub stać) wraz ze wzrostem g.`;
      }
    }
  }
  return null;
}

export interface SensitivityGridIntegrityResult {
  shape: SensitivityGridShapeResult;
  monotonicityViolation: string | null;
  ok: boolean;
}

/** Combines the shape gate (exactly 25 cells / 1 base cell / full 5×5 coverage) with the monotonicity gate — both are required for a grid to be trustworthy, per the coordinator's WP-D05 correction. */
export function assertSensitivityGridIntegrity(cells: readonly ValuationSensitivityCellDto[]): SensitivityGridIntegrityResult {
  const shape = assertSensitivityGridShape(cells);
  const monotonicityViolation = shape.ok ? findSensitivityMonotonicityViolation(cells) : null;
  return { shape, monotonicityViolation, ok: shape.ok && monotonicityViolation === null };
}

// =============================================================================================
// Basket weights sum to 100% — mirrors the DB trigger `trg_finance_valuation_methods_weight_sum`
// and the router's own pre-check (`valuation.routes.ts:339-351`): a basket member MUST carry a
// positive weight, a cross-check MUST NOT carry one (physically null, never 0 — DEC-FIN-005).
// =============================================================================================

export interface BasketWeightIssue {
  methodId: string;
  code: 'MISSING_WEIGHT' | 'WEIGHT_NOT_ALLOWED' | 'WEIGHT_NOT_POSITIVE';
  message: string;
}

export interface BasketWeightValidation {
  ok: boolean;
  issues: BasketWeightIssue[];
  /** Sum across basket members only (cross-checks excluded — DEC-FIN-005: "Cross-checki są NIEWAŻONE"). `null` when the basket is empty. */
  basketSumPct: number | null;
  sumMatches100: boolean;
}

const WEIGHT_SUM_TOLERANCE = 1e-9;

export function validateBasketWeights(
  updates: readonly { methodId: string; isInRecommendationBasket: boolean; weightPct: number | null }[]
): BasketWeightValidation {
  const issues: BasketWeightIssue[] = [];
  let basketSum = 0;
  let basketCount = 0;

  for (const u of updates) {
    if (u.isInRecommendationBasket) {
      if (u.weightPct === null || u.weightPct === undefined) {
        issues.push({ methodId: u.methodId, code: 'MISSING_WEIGHT', message: 'Metoda w koszyku wymaga dodatniej wagi.' });
        continue;
      }
      if (!Number.isFinite(u.weightPct) || u.weightPct <= 0) {
        issues.push({ methodId: u.methodId, code: 'WEIGHT_NOT_POSITIVE', message: `Waga metody w koszyku musi być liczbą dodatnią, jest ${u.weightPct}.` });
        continue;
      }
      basketSum += u.weightPct;
      basketCount += 1;
    } else if (u.weightPct !== null && u.weightPct !== undefined) {
      issues.push({ methodId: u.methodId, code: 'WEIGHT_NOT_ALLOWED', message: 'Cross-check nie może mieć wagi (cross-checki są niewazone, DEC-FIN-005).' });
    }
  }

  const basketSumPct = basketCount > 0 ? basketSum : null;
  const sumMatches100 = basketSumPct !== null && Math.abs(basketSumPct - 100) <= WEIGHT_SUM_TOLERANCE;

  return { ok: issues.length === 0 && (basketSumPct === null || sumMatches100), issues, basketSumPct, sumMatches100 };
}

/** Convenience: build basket-weight validation directly from the `/methods` response's `ValuationMethodDto[]` (decimal strings parsed, `null`-safe). */
export function validateBasketWeightsFromMethods(methods: readonly ValuationMethodDto[]): BasketWeightValidation {
  return validateBasketWeights(
    methods.map((m) => ({
      methodId: m.methodId,
      isInRecommendationBasket: m.isInRecommendationBasket,
      weightPct: m.weightPct === null ? null : Number(m.weightPct),
    }))
  );
}

// =============================================================================================
// Disagreement analysis — coordinator correction (WP-D05 DoD): the Results step must show a
// RANGE and an explicit method-disagreement read, never a single number pretending to be
// certain. `computeWeightedRecommendation()` on the server already produces ONE weighted point
// estimate for the basket; this function is the client-side companion that additionally surfaces
// the spread across every READY method with a present result (basket AND cross-check alike —
// disagreement is about what the methods say, not just what is weighted), so "one number" is
// never the only thing on screen.
// =============================================================================================

export interface MethodResultRangeView {
  /** READY methods with a PRESENT_ZERO/PRESENT_NONZERO result — NA/NOT_APPLICABLE/MISSING/DATA_INCOMPLETE methods contribute nothing here (never coerced to 0). */
  readyCount: number;
  min: number | null;
  max: number | null;
  /** `(max-min)/|median|`, `null` when fewer than 2 ready methods (a spread needs at least two points). */
  spreadPct: number | null;
  /** Spread beyond this threshold is flagged as material disagreement — DEC-FIN-005's "ostrzeżenia o korelacji/rozbieżności metod" made visible as a number, not just a rule-engine sentence. */
  hasMaterialDisagreement: boolean;
  methodResults: { methodType: ValuationMethodType; valueDecimal: number }[];
}

export const DEFAULT_MATERIAL_DISAGREEMENT_SPREAD_PCT = 20;

export function computeMethodResultRange(
  methods: readonly ValuationMethodDto[],
  materialSpreadThresholdPct: number = DEFAULT_MATERIAL_DISAGREEMENT_SPREAD_PCT
): MethodResultRangeView {
  const methodResults = methods
    .filter((m) => m.readiness === 'READY' && (m.result.status === 'PRESENT_ZERO' || m.result.status === 'PRESENT_NONZERO') && m.result.valueDecimal !== null)
    .map((m) => ({ methodType: m.methodType, valueDecimal: Number(m.result.valueDecimal) }));

  if (methodResults.length === 0) {
    return { readyCount: 0, min: null, max: null, spreadPct: null, hasMaterialDisagreement: false, methodResults: [] };
  }
  const values = methodResults.map((m) => m.valueDecimal);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (methodResults.length === 1) {
    return { readyCount: 1, min, max, spreadPct: null, hasMaterialDisagreement: false, methodResults };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  const spreadPct = median === 0 ? null : (Math.abs(max - min) / Math.abs(median)) * 100;
  return {
    readyCount: methodResults.length,
    min,
    max,
    spreadPct,
    hasMaterialDisagreement: spreadPct !== null && spreadPct > materialSpreadThresholdPct,
    methodResults,
  };
}

// =============================================================================================
// Sensitivity 5x5 shape — OWN-FIN-002 history: a grid SHAPE bug once crashed the whole view.
// Mirrors `writeSensitivityGrid()`'s own invariants (valuationSensitivityService.ts:168-173):
// exactly 25 cells, exactly 1 base cell, row/col indices covering 1..5 exactly once each.
// =============================================================================================

export type SensitivityGridShapeErrorCode =
  | 'WRONG_CELL_COUNT'
  | 'WRONG_BASE_CELL_COUNT'
  | 'ROW_INDEX_OUT_OF_RANGE'
  | 'COL_INDEX_OUT_OF_RANGE'
  | 'DUPLICATE_CELL_COORDINATE'
  | 'INCOMPLETE_ROW_OR_COLUMN_COVERAGE';

export type SensitivityGridShapeResult = { ok: true } | { ok: false; code: SensitivityGridShapeErrorCode; message: string };

export function assertSensitivityGridShape(cells: readonly Pick<ValuationSensitivityCellDto, 'rowIndex' | 'colIndex' | 'isBaseCell'>[]): SensitivityGridShapeResult {
  if (cells.length !== 25) {
    return { ok: false, code: 'WRONG_CELL_COUNT', message: `Siatka wrażliwości musi mieć dokładnie 25 komórek (5×5), jest ${cells.length}.` };
  }
  const baseCells = cells.filter((c) => c.isBaseCell);
  if (baseCells.length !== 1) {
    return { ok: false, code: 'WRONG_BASE_CELL_COUNT', message: `Siatka musi mieć dokładnie 1 komórkę bazową, jest ${baseCells.length}.` };
  }
  const seen = new Set<string>();
  const rowIndices = new Set<number>();
  const colIndices = new Set<number>();
  for (const c of cells) {
    if (c.rowIndex < 1 || c.rowIndex > 5) {
      return { ok: false, code: 'ROW_INDEX_OUT_OF_RANGE', message: `rowIndex poza zakresem 1..5: ${c.rowIndex}.` };
    }
    if (c.colIndex < 1 || c.colIndex > 5) {
      return { ok: false, code: 'COL_INDEX_OUT_OF_RANGE', message: `colIndex poza zakresem 1..5: ${c.colIndex}.` };
    }
    const key = `${c.rowIndex}:${c.colIndex}`;
    if (seen.has(key)) {
      return { ok: false, code: 'DUPLICATE_CELL_COORDINATE', message: `Zduplikowana współrzędna komórki: (${c.rowIndex}, ${c.colIndex}).` };
    }
    seen.add(key);
    rowIndices.add(c.rowIndex);
    colIndices.add(c.colIndex);
  }
  if (rowIndices.size !== 5 || colIndices.size !== 5) {
    return {
      ok: false,
      code: 'INCOMPLETE_ROW_OR_COLUMN_COVERAGE',
      message: `Siatka musi pokrywać wszystkie 5 wierszy i 5 kolumn dokładnie raz każdą — pokryto ${rowIndices.size} wierszy, ${colIndices.size} kolumn.`,
    };
  }
  return { ok: true };
}

// =============================================================================================
// Advisor finding normalization — absorbs the POST(camelCase)/GET(snake_case) inconsistency
// measured in financeV2.types.ts. Every consumer in this folder renders THIS shape only.
// =============================================================================================

export interface ValuationAdvisorFindingView {
  id: string;
  outputKind: ValuationAdvisorOutputKind;
  /** Explicit fact-vs-hypothesis label the Advisor step renders next to the title — never left to the reader to infer from tone (DEC-FIN-006: "jawne odróżnienie faktu od hipotezy"). */
  isFactual: boolean;
  title: string;
  narrative: string;
  driverRef: string | null;
  impactDecimal: number | null;
  confidence: ValuationAdvisorConfidence | null;
  isComparison: boolean;
  isFrozen: boolean;
  isStale: boolean;
  evidencePointerCount: number;
}

export function normalizeAdvisorFinding(
  finding: ValuationAdvisorFindingGeneratedDto | ValuationAdvisorFindingStoredDto
): ValuationAdvisorFindingView {
  if ('output_kind' in finding) {
    // GET .../advisor shape — raw StoredAdvisorOutputRow (snake_case).
    return {
      id: finding.id,
      outputKind: finding.output_kind,
      isFactual: finding.output_kind === 'FACT',
      title: finding.title,
      narrative: finding.narrative,
      driverRef: finding.driver_ref,
      impactDecimal: finding.impact_decimal === null ? null : Number(finding.impact_decimal),
      confidence: finding.confidence,
      isComparison: finding.is_comparison,
      isFrozen: finding.is_frozen,
      isStale: finding.is_stale,
      evidencePointerCount: finding.evidence_ref?.pointers?.length ?? 0,
    };
  }
  // POST .../advisor/generate shape — PersistedAdvisorFinding DTO (camelCase).
  return {
    id: finding.id,
    outputKind: finding.outputKind,
    isFactual: finding.outputKind === 'FACT',
    title: finding.title,
    narrative: finding.narrative,
    driverRef: finding.driverRef,
    impactDecimal: finding.impactDecimal,
    confidence: finding.confidence,
    isComparison: finding.isComparison,
    // A freshly generated (not-yet-persisted-and-reloaded) finding cannot be frozen/stale yet —
    // both only become meaningful once the finding survives an approval or a subsequent recompute.
    isFrozen: false,
    isStale: false,
    evidencePointerCount: finding.evidenceRef?.pointers?.length ?? 0,
  };
}

export function groupAdvisorFindingsByKind(
  findings: readonly ValuationAdvisorFindingView[]
): Record<ValuationAdvisorOutputKind, ValuationAdvisorFindingView[]> {
  const groups: Record<ValuationAdvisorOutputKind, ValuationAdvisorFindingView[]> = {
    FACT: [],
    HYPOTHESIS: [],
    RISK: [],
    QUESTION: [],
    ACTION: [],
  };
  for (const f of findings) {
    groups[f.outputKind].push(f);
  }
  return groups;
}
