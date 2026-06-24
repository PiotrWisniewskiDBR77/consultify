/**
 * financeAnomalyDetectorService — M16/8.1
 *
 * Pure, rule-based (NO LLM) anomaly detection for imported financial statements.
 * Flags structural / sign / classification / completeness problems so an importer
 * can surface them and (when critical) block confirmation.
 *
 * All functions are deterministic and side-effect free → unit-testable.
 */

export type AnomalySeverity = 'info' | 'warning' | 'critical';

export type AnomalyType =
  | 'TIE_OUT_BREAK'
  | 'SIGN_ERROR'
  | 'OUTLIER_JUMP'
  | 'MISCLASSIFICATION'
  | 'MISSING_REQUIRED'
  | 'SCALE_MISMATCH';

export interface FinanceAnomaly {
  type: AnomalyType;
  severity: AnomalySeverity;
  /** Statement line code the anomaly refers to (when line-scoped). */
  line?: string;
  message: string;
}

/** Sign convention expected for a given line. */
export type SignConvention = 'positive' | 'negative';

export interface StatementLine {
  code: string;
  value: number;
  /** Expected sign of the value. 'negative' = should be < 0 (e.g. COGS/expense). */
  signConvention?: SignConvention;
  /** Prior-period value for YoY outlier detection. */
  priorValue?: number;
}

export type StatementType = 'balance_sheet' | 'income_statement' | 'cash_flow' | string;

export interface FinanceStatement {
  type: StatementType;
  lines: StatementLine[];
  /** Balance-sheet totals for tie-out check (optional). */
  assets?: number;
  liabilities?: number;
  equity?: number;
}

export interface AnomalySummary {
  critical: number;
  warning: number;
  info: number;
  /** True when any critical anomaly is present → confirmation must be blocked. */
  blocksConfirm: boolean;
}

// ---------------------------------------------------------------------------
// Tunable thresholds
// ---------------------------------------------------------------------------

/** Balance-sheet tie-out tolerance: |A-(L+E)|/|A| above this is a break. */
const TIE_OUT_TOLERANCE = 0.01; // 1%

/** A YoY change this many times the median change counts as an outlier jump. */
const OUTLIER_MULTIPLE = 5;

/** Minimum median magnitude before outlier comparison is meaningful. */
const OUTLIER_MIN_MEDIAN = 1e-9;

/**
 * Order-of-magnitude gap (in log10) between a line and the cohort median that
 * signals a probable scale mismatch (e.g. one line in thousands, rest in millions).
 */
const SCALE_LOG10_GAP = 2.5; // ~316x

/** Lines whose absolute value must be present (non-zero) per statement type. */
const REQUIRED_LINES: Record<string, string[]> = {
  income_statement: ['revenue'],
  balance_sheet: ['total_assets'],
};

/**
 * Generic required lines checked across any statement when present in the model.
 * (revenue/total_assets are the canonical "must exist" lines from the spec.)
 */
const ALWAYS_REQUIRED: string[] = ['revenue', 'total_assets'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function normCode(code: string): string {
  return String(code || '').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Individual rule detectors (each returns 0..n anomalies)
// ---------------------------------------------------------------------------

/** TIE_OUT_BREAK: Assets != Liabilities + Equity beyond tolerance. */
function detectTieOutBreak(statement: FinanceStatement): FinanceAnomaly[] {
  const { assets, liabilities, equity } = statement;
  if (!isFiniteNumber(assets) || !isFiniteNumber(liabilities) || !isFiniteNumber(equity)) {
    return [];
  }
  const denom = Math.abs(assets);
  if (denom < OUTLIER_MIN_MEDIAN) return [];
  const diff = Math.abs(assets - (liabilities + equity));
  const rel = diff / denom;
  if (rel > TIE_OUT_TOLERANCE) {
    return [
      {
        type: 'TIE_OUT_BREAK',
        severity: 'critical',
        message:
          `Balance sheet does not tie out: Assets ${assets} vs Liabilities+Equity ` +
          `${liabilities + equity} (off by ${(rel * 100).toFixed(2)}%, tolerance ` +
          `${(TIE_OUT_TOLERANCE * 100).toFixed(0)}%).`,
      },
    ];
  }
  return [];
}

/** SIGN_ERROR: line value sign contradicts its declared signConvention. */
function detectSignErrors(statement: FinanceStatement): FinanceAnomaly[] {
  const out: FinanceAnomaly[] = [];
  for (const line of statement.lines) {
    if (!line || !line.signConvention || !isFiniteNumber(line.value)) continue;
    if (line.value === 0) continue; // zero is sign-neutral
    const expectedNeg = line.signConvention === 'negative';
    const isNeg = line.value < 0;
    if (expectedNeg !== isNeg) {
      out.push({
        type: 'SIGN_ERROR',
        severity: 'warning',
        line: line.code,
        message:
          `Line "${line.code}" has value ${line.value} but sign convention expects a ` +
          `${line.signConvention} value.`,
      });
    }
  }
  return out;
}

/**
 * OUTLIER_JUMP: a line's YoY % change is wildly larger than the median YoY change
 * across all lines that carry a prior value.
 */
function detectOutlierJumps(statement: FinanceStatement): FinanceAnomaly[] {
  const changes: { line: StatementLine; pct: number }[] = [];
  for (const line of statement.lines) {
    if (!line || !isFiniteNumber(line.value) || !isFiniteNumber(line.priorValue)) continue;
    const prior = line.priorValue as number;
    if (Math.abs(prior) < OUTLIER_MIN_MEDIAN) continue; // can't compute % vs ~0
    const pct = Math.abs((line.value - prior) / prior);
    changes.push({ line, pct });
  }
  if (changes.length < 2) return []; // need a cohort to compare against

  const med = median(changes.map((c) => c.pct));
  const out: FinanceAnomaly[] = [];
  for (const { line, pct } of changes) {
    const threshold = Math.max(med * OUTLIER_MULTIPLE, OUTLIER_MIN_MEDIAN);
    // Only flag genuinely large absolute moves (>50%) that also dwarf the median.
    if (pct > 0.5 && pct > threshold && med > OUTLIER_MIN_MEDIAN) {
      out.push({
        type: 'OUTLIER_JUMP',
        severity: 'warning',
        line: line.code,
        message:
          `Line "${line.code}" changed ${(pct * 100).toFixed(0)}% YoY vs a median change of ` +
          `${(med * 100).toFixed(0)}% across the statement — possible import error.`,
      });
    }
  }
  return out;
}

/**
 * MISCLASSIFICATION: a line is mapped to a category whose expected sign contradicts
 * its actual sign in a way that suggests it landed in the wrong bucket. We treat a
 * signConvention mismatch that is NOT a clear sign-flip (handled by SIGN_ERROR) as
 * informational classification noise — here we flag lines whose code hints at one
 * category (e.g. "expense"/"cost") but whose sign is consistently positive AND large
 * relative to the cohort, hinting it was bucketed as revenue/asset.
 */
function detectMisclassification(statement: FinanceStatement): FinanceAnomaly[] {
  const out: FinanceAnomaly[] = [];
  const EXPENSE_HINTS = ['expense', 'cost', 'cogs', 'depreciation', 'amortization', 'tax'];
  for (const line of statement.lines) {
    if (!line || !isFiniteNumber(line.value)) continue;
    const code = normCode(line.code);
    const looksExpense = EXPENSE_HINTS.some((h) => code.includes(h));
    // If it reads like an expense, has no explicit negative convention, and is
    // positive, it may have been classified as income/asset.
    if (looksExpense && line.value > 0 && line.signConvention !== 'positive') {
      out.push({
        type: 'MISCLASSIFICATION',
        severity: 'info',
        line: line.code,
        message:
          `Line "${line.code}" reads like an expense but carries a positive value with no ` +
          `negative sign convention — verify its category mapping.`,
      });
    }
  }
  return out;
}

/** MISSING_REQUIRED: a required line (revenue/total_assets) is absent or zero. */
function detectMissingRequired(statement: FinanceStatement): FinanceAnomaly[] {
  const present = new Map<string, number>();
  for (const line of statement.lines) {
    if (!line) continue;
    present.set(normCode(line.code), isFiniteNumber(line.value) ? line.value : NaN);
  }

  const typeReq = REQUIRED_LINES[normCode(statement.type)] || [];
  const required = new Set<string>([...typeReq, ...ALWAYS_REQUIRED]);

  // For a balance sheet we don't demand revenue; for an income statement we don't
  // demand total_assets. Restrict ALWAYS_REQUIRED to what the type can hold.
  const t = normCode(statement.type);
  if (t === 'balance_sheet') required.delete('revenue');
  if (t === 'income_statement') required.delete('total_assets');

  const out: FinanceAnomaly[] = [];
  for (const code of required) {
    const val = present.get(code);
    if (val === undefined) {
      out.push({
        type: 'MISSING_REQUIRED',
        severity: 'critical',
        line: code,
        message: `Required line "${code}" is missing from the imported statement.`,
      });
    } else if (!isFiniteNumber(val) || val === 0) {
      out.push({
        type: 'MISSING_REQUIRED',
        severity: 'critical',
        line: code,
        message: `Required line "${code}" is present but has no usable value (${val}).`,
      });
    }
  }
  return out;
}

/**
 * SCALE_MISMATCH: one line's order of magnitude is far from the cohort median,
 * suggesting unit inconsistency (e.g. one figure in thousands, the rest in millions).
 */
function detectScaleMismatch(statement: FinanceStatement): FinanceAnomaly[] {
  const mags: { line: StatementLine; log10: number }[] = [];
  for (const line of statement.lines) {
    if (!line || !isFiniteNumber(line.value)) continue;
    const abs = Math.abs(line.value);
    if (abs < OUTLIER_MIN_MEDIAN) continue; // skip zeros
    mags.push({ line, log10: Math.log10(abs) });
  }
  if (mags.length < 3) return []; // need a cohort to judge "the rest"

  const medLog = median(mags.map((m) => m.log10));
  const out: FinanceAnomaly[] = [];
  for (const { line, log10 } of mags) {
    if (Math.abs(log10 - medLog) >= SCALE_LOG10_GAP) {
      out.push({
        type: 'SCALE_MISMATCH',
        severity: 'warning',
        line: line.code,
        message:
          `Line "${line.code}" (${line.value}) is ~${Math.round(
            Math.pow(10, Math.abs(log10 - medLog)),
          )}x off the typical magnitude of other lines — possible units (thousands vs ` +
          `millions) mismatch.`,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Run all rule-based detectors over an imported statement.
 * Returns a flat, ordered list of anomalies (most severe rules first).
 */
export function detectAnomalies(statement: FinanceStatement): FinanceAnomaly[] {
  if (!statement || !Array.isArray(statement.lines)) {
    return [];
  }
  return [
    ...detectMissingRequired(statement),
    ...detectTieOutBreak(statement),
    ...detectSignErrors(statement),
    ...detectOutlierJumps(statement),
    ...detectScaleMismatch(statement),
    ...detectMisclassification(statement),
  ];
}

/**
 * Aggregate anomalies into counts by severity.
 * blocksConfirm is true iff at least one critical anomaly exists.
 */
export function anomalySummary(anomalies: FinanceAnomaly[]): AnomalySummary {
  const summary: AnomalySummary = {
    critical: 0,
    warning: 0,
    info: 0,
    blocksConfirm: false,
  };
  if (!Array.isArray(anomalies)) return summary;
  for (const a of anomalies) {
    if (!a) continue;
    if (a.severity === 'critical') summary.critical += 1;
    else if (a.severity === 'warning') summary.warning += 1;
    else if (a.severity === 'info') summary.info += 1;
  }
  summary.blocksConfirm = summary.critical > 0;
  return summary;
}
