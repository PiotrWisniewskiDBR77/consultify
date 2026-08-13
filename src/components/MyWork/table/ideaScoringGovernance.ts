/**
 * ideaScoringGovernance — transparent, versioned scoring model for Ideas.
 * Program D / epic E08, master program §6.3 (Scoring and prioritisation).
 *
 * WHAT EXISTED BEFORE THIS FILE (read before touching — 2026-08-10 finding):
 * `IdeaScoringModel.tsx` already implements a real weighted-composite ENGINE:
 * pick any visible number/rating/progress/currency column, assign it a 0-100
 * weight slider (optionally inverted), and it min-max-normalizes + sums into a
 * 0-100 rank, live, in a modal. That part is honest and works.
 *
 * What it does NOT do — the actual gap §6.3 asks this program to close:
 *   - the nine CANON dimensions (strategic fit, customer/business value,
 *     financial impact, urgency, confidence/evidence, delivery effort,
 *     implementation risk, dependency complexity, compliance/security) are
 *     nowhere — the model only sees whatever columns happen to exist;
 *   - weights are NOT visible outside the open modal and NOT versioned —
 *     `useState(() => ...)` re-derives a fresh default every time the dialog
 *     opens, so "why is this 62" has no answer five minutes after Apply;
 *   - there is no override concept at all, therefore no reason requirement
 *     and no history — a user can only accept the computed number or ignore
 *     the tool;
 *   - "Apply" writes a bare `{ score, rank }` into `data.score`/`data.rank`
 *     with no record of which weight version, which inputs, or who ran it.
 *
 * This file is the missing model, as pure/storage-agnostic logic: the nine
 * dimensions, weight versioning (append-only, never mutated in place),
 * override-with-mandatory-reason, and a portfolio comparison builder that
 * carries BOTH the absolute per-dimension inputs and the normalized score
 * (§6.3: "Portfolio comparison must show both absolute inputs and the
 * normalized score"). The host component owns persistence — today that is
 * `IdeaTableTool`'s row `data` bag (see `IdeaScoringModel.tsx`); a future
 * server-backed store can adopt the same shapes without changing callers.
 *
 * No React import on purpose — this must be usable from the table engine,
 * from Teresa/AI proposal review, and from tests without a DOM.
 */

// ─────────────────────────────────────────────────────────────────────────
// Dimensions
// ─────────────────────────────────────────────────────────────────────────

export const SCORING_DIMENSION_KEYS = [
  'strategicFit',
  'customerBusinessValue',
  'financialImpact',
  'urgency',
  'confidenceEvidence',
  'deliveryEffort',
  'implementationRisk',
  'dependencyComplexity',
  'complianceSecurity',
] as const;

export type ScoringDimensionKey = (typeof SCORING_DIMENSION_KEYS)[number];

export interface ScoringDimensionDef {
  key: ScoringDimensionKey;
  /** i18n key — `t(i18nKey, labelEn)`. Real strings own translation. */
  i18nKey: string;
  labelEn: string;
  labelPl: string;
  /** Default weight in a 0-100 pool. The nine defaults sum to exactly 100. */
  defaultWeight: number;
  /**
   * True for dimensions where a HIGHER raw input is WORSE for the idea
   * (more effort, more risk, more dependency complexity). The composite
   * inverts these so "higher composite = more attractive idea" holds across
   * all nine — matching `IdeaScoringModel`'s existing `invert` toggle for
   * `effort`-like columns, just fixed per-dimension instead of user-toggled.
   */
  lowerIsBetter: boolean;
}

export const SCORING_DIMENSIONS: readonly ScoringDimensionDef[] = [
  {
    key: 'strategicFit',
    i18nKey: 'ideas.table.scoringGovernance.dimension.strategicFit',
    labelEn: 'Strategic fit',
    labelPl: 'Dopasowanie strategiczne',
    defaultWeight: 15,
    lowerIsBetter: false,
  },
  {
    key: 'customerBusinessValue',
    i18nKey: 'ideas.table.scoringGovernance.dimension.customerBusinessValue',
    labelEn: 'Customer / business value',
    labelPl: 'Wartość dla klienta/biznesu',
    defaultWeight: 15,
    lowerIsBetter: false,
  },
  {
    key: 'financialImpact',
    i18nKey: 'ideas.table.scoringGovernance.dimension.financialImpact',
    labelEn: 'Financial impact',
    labelPl: 'Wpływ finansowy',
    defaultWeight: 15,
    lowerIsBetter: false,
  },
  {
    key: 'urgency',
    i18nKey: 'ideas.table.scoringGovernance.dimension.urgency',
    labelEn: 'Urgency / time criticality',
    labelPl: 'Pilność / krytyczność czasowa',
    defaultWeight: 10,
    lowerIsBetter: false,
  },
  {
    key: 'confidenceEvidence',
    i18nKey: 'ideas.table.scoringGovernance.dimension.confidenceEvidence',
    labelEn: 'Confidence / evidence quality',
    labelPl: 'Pewność / jakość dowodów',
    defaultWeight: 10,
    lowerIsBetter: false,
  },
  {
    key: 'deliveryEffort',
    i18nKey: 'ideas.table.scoringGovernance.dimension.deliveryEffort',
    labelEn: 'Delivery effort',
    labelPl: 'Nakład realizacji',
    defaultWeight: 10,
    lowerIsBetter: true,
  },
  {
    key: 'implementationRisk',
    i18nKey: 'ideas.table.scoringGovernance.dimension.implementationRisk',
    labelEn: 'Implementation risk',
    labelPl: 'Ryzyko wdrożenia',
    defaultWeight: 10,
    lowerIsBetter: true,
  },
  {
    key: 'dependencyComplexity',
    i18nKey: 'ideas.table.scoringGovernance.dimension.dependencyComplexity',
    labelEn: 'Dependency complexity',
    labelPl: 'Złożoność zależności',
    defaultWeight: 5,
    lowerIsBetter: true,
  },
  {
    key: 'complianceSecurity',
    i18nKey: 'ideas.table.scoringGovernance.dimension.complianceSecurity',
    labelEn: 'Compliance / security impact',
    labelPl: 'Wpływ na zgodność/bezpieczeństwo',
    defaultWeight: 10,
    lowerIsBetter: false,
  },
] as const;

if (
  process.env.NODE_ENV !== 'production' &&
  SCORING_DIMENSIONS.reduce((s, d) => s + d.defaultWeight, 0) !== 100
) {
  // Fails loudly in dev/test rather than shipping a default weight set that
  // does not sum to 100 — "weights are visible" only means something if the
  // shipped defaults are honest about summing to the whole pie.
  // eslint-disable-next-line no-console
  console.error('ideaScoringGovernance: SCORING_DIMENSIONS defaultWeight does not sum to 100');
}

export type ScoringWeightSet = Partial<Record<ScoringDimensionKey, number>>;

/** Raw per-dimension inputs for one idea, on a 0-10 scale (matches the
 *  existing `rating` column type already used elsewhere on the table). */
export type DimensionScoreInput = Partial<Record<ScoringDimensionKey, number>>;

export const DIMENSION_INPUT_MIN = 0;
export const DIMENSION_INPUT_MAX = 10;

// ─────────────────────────────────────────────────────────────────────────
// Weight versioning — "weights are visible and versioned" (§6.3)
// ─────────────────────────────────────────────────────────────────────────

export interface ScoringWeightVersion {
  /** 1-based, strictly increasing. */
  version: number;
  weights: ScoringWeightSet;
  createdAt: string;
  createdBy?: string;
  /** Why the weights changed — optional (unlike score overrides, which
   *  REQUIRE a reason; a weight revision is a model change, not a judgement
   *  call on one idea, so a note is good practice but not gated). */
  note?: string;
}

/** Append-only, oldest first. Never mutate an entry in place — see
 *  `reviseWeights`, which always appends. */
export type ScoringWeightHistory = ScoringWeightVersion[];

/** The default weight set, keyed, derived from `SCORING_DIMENSIONS`. */
export function defaultWeightSet(): ScoringWeightSet {
  const out: ScoringWeightSet = {};
  for (const d of SCORING_DIMENSIONS) out[d.key] = d.defaultWeight;
  return out;
}

export function createInitialWeightVersion(opts?: {
  weights?: ScoringWeightSet;
  createdBy?: string;
  note?: string;
  now?: string;
}): ScoringWeightHistory {
  return [
    {
      version: 1,
      weights: opts?.weights ?? defaultWeightSet(),
      createdAt: opts?.now ?? new Date().toISOString(),
      createdBy: opts?.createdBy,
      note: opts?.note,
    },
  ];
}

export class InvalidWeightRevisionError extends Error {}

/**
 * Appends a new weight version. Throws rather than silently accepting an
 * empty/negative weight set — a scoring model whose weights can go invalid
 * without complaint is exactly the "mysterious AI number" §6.3 forbids.
 */
export function reviseWeights(
  history: ScoringWeightHistory,
  newWeights: ScoringWeightSet,
  opts?: { createdBy?: string; note?: string; now?: string }
): ScoringWeightHistory {
  const entries = Object.entries(newWeights);
  if (entries.length === 0) {
    throw new InvalidWeightRevisionError('At least one dimension weight is required.');
  }
  for (const [key, w] of entries) {
    if (typeof w !== 'number' || !Number.isFinite(w) || w < 0) {
      throw new InvalidWeightRevisionError(`Weight for "${key}" must be a number >= 0.`);
    }
  }
  const prevVersion = history.length > 0 ? history[history.length - 1].version : 0;
  const next: ScoringWeightVersion = {
    version: prevVersion + 1,
    weights: { ...newWeights },
    createdAt: opts?.now ?? new Date().toISOString(),
    createdBy: opts?.createdBy,
    note: opts?.note,
  };
  return [...history, next];
}

export function currentWeightVersion(history: ScoringWeightHistory): ScoringWeightVersion | null {
  return history.length > 0 ? history[history.length - 1] : null;
}

// ─────────────────────────────────────────────────────────────────────────
// Composite score — "never a mysterious AI number"
// ─────────────────────────────────────────────────────────────────────────

export interface ScoreBreakdownItem {
  dimension: ScoringDimensionKey;
  /** Whether this idea actually carries a value for this dimension. */
  provided: boolean;
  /** Raw 0-10 input, if provided. */
  rawValue?: number;
  weight: number;
  /** Share of the weight pool actually used in the computation (renormalized
   *  across only the PROVIDED dimensions — see doc comment on
   *  `computeCompositeScore`). */
  effectiveWeightShare: number;
  /** 0-1 normalized value (already inverted for lowerIsBetter dimensions). */
  normalizedValue?: number;
  /** Contribution to the final 0-100 score. */
  contribution: number;
}

export interface CompositeScoreResult {
  /** 0-100, rounded. */
  score: number;
  modelVersion: number;
  breakdown: ScoreBreakdownItem[];
  /** Dimensions with a defined weight but no input for this idea — surfaced
   *  so "why is this lower than expected" has a real answer. */
  missingDimensions: ScoringDimensionKey[];
}

/**
 * Computes the 0-100 composite from raw 0-10 dimension inputs and a weight
 * version. Unlike `IdeaScoringModel`'s existing min-max normalization (which
 * needs the whole portfolio's range to mean anything), each dimension here is
 * normalized against the FIXED 0-10 input scale — so a single idea's score is
 * meaningful on its own, which is required for the portfolio comparison to
 * show honest per-idea absolute values next to the normalized score.
 *
 * Dimensions with no input are excluded from the sum and the remaining
 * weights are renormalized among the dimensions that DO have a value, rather
 * than silently treating "no answer yet" as "worst possible answer" (0). Both
 * choices are visible in `breakdown`/`missingDimensions` — nothing is hidden.
 */
export function computeCompositeScore(
  inputs: DimensionScoreInput,
  weightVersion: ScoringWeightVersion
): CompositeScoreResult {
  const dims = SCORING_DIMENSIONS.filter((d) => (weightVersion.weights[d.key] ?? 0) > 0);
  const providedWeightSum = dims.reduce((sum, d) => {
    const raw = inputs[d.key];
    return raw !== undefined && raw !== null && Number.isFinite(raw)
      ? sum + (weightVersion.weights[d.key] ?? 0)
      : sum;
  }, 0);

  const breakdown: ScoreBreakdownItem[] = [];
  const missingDimensions: ScoringDimensionKey[] = [];
  let score = 0;

  for (const d of dims) {
    const weight = weightVersion.weights[d.key] ?? 0;
    const raw = inputs[d.key];
    const provided = raw !== undefined && raw !== null && Number.isFinite(raw);
    if (!provided) {
      missingDimensions.push(d.key);
      breakdown.push({ dimension: d.key, provided: false, weight, effectiveWeightShare: 0, contribution: 0 });
      continue;
    }
    const clamped = Math.min(DIMENSION_INPUT_MAX, Math.max(DIMENSION_INPUT_MIN, raw as number));
    let normalized = (clamped - DIMENSION_INPUT_MIN) / (DIMENSION_INPUT_MAX - DIMENSION_INPUT_MIN);
    if (d.lowerIsBetter) normalized = 1 - normalized;
    const effectiveWeightShare = providedWeightSum > 0 ? weight / providedWeightSum : 0;
    const contribution = normalized * effectiveWeightShare * 100;
    score += contribution;
    breakdown.push({
      dimension: d.key,
      provided: true,
      rawValue: clamped,
      weight,
      effectiveWeightShare,
      normalizedValue: normalized,
      contribution,
    });
  }

  return {
    score: Math.round(score),
    modelVersion: weightVersion.version,
    breakdown,
    missingDimensions,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Manual override — "REQUIRE A REASON and appear in history"
// ─────────────────────────────────────────────────────────────────────────

export class MissingOverrideReasonError extends Error {}

export interface ScoreOverride {
  value: number;
  reason: string;
  byUser?: string;
  at: string;
  /** The computed value being overridden, at the time of override — kept so
   *  history can show "computed 54, overridden to 70". */
  previousComputedValue: number;
  modelVersion: number;
}

/** Validates and constructs an override. Throws `MissingOverrideReasonError`
 *  on a blank/whitespace-only reason — there is no code path in this module
 *  that can silently accept a reasonless override. */
export function createScoreOverride(opts: {
  value: number;
  reason: string;
  previousComputedValue: number;
  modelVersion: number;
  byUser?: string;
  now?: string;
}): ScoreOverride {
  const reason = opts.reason.trim();
  if (reason.length === 0) {
    throw new MissingOverrideReasonError('A manual score override requires a non-empty reason.');
  }
  if (!Number.isFinite(opts.value) || opts.value < 0 || opts.value > 100) {
    throw new MissingOverrideReasonError('Override value must be a number between 0 and 100.');
  }
  return {
    value: opts.value,
    reason,
    byUser: opts.byUser,
    at: opts.now ?? new Date().toISOString(),
    previousComputedValue: opts.previousComputedValue,
    modelVersion: opts.modelVersion,
  };
}

export type ScoreHistoryEvent =
  | { type: 'computed'; at: string; result: CompositeScoreResult }
  | { type: 'override'; at: string; override: ScoreOverride };

/** Append-only per-idea score history — computed runs AND overrides both
 *  land here in chronological order, so "why is this idea's score what it
 *  is" is always answerable by reading down the list. */
export type ScoreHistory = ScoreHistoryEvent[];

export function appendComputedEvent(history: ScoreHistory, result: CompositeScoreResult, now?: string): ScoreHistory {
  return [...history, { type: 'computed', at: now ?? new Date().toISOString(), result }];
}

export function appendOverrideEvent(history: ScoreHistory, override: ScoreOverride): ScoreHistory {
  return [...history, { type: 'override', at: override.at, override }];
}

/** The score currently in effect: the most recent event, whatever its type —
 *  an override stands until either a NEW override or a NEW computed run is
 *  appended (re-running the model does not silently discard a human's
 *  override; it takes a fresh `computeCompositeScore` + `appendComputedEvent`
 *  call, visible in history same as everything else). */
export function currentScore(history: ScoreHistory): { value: number; source: 'computed' | 'override'; modelVersion: number } | null {
  if (history.length === 0) return null;
  const last = history[history.length - 1];
  return last.type === 'computed'
    ? { value: last.result.score, source: 'computed', modelVersion: last.result.modelVersion }
    : { value: last.override.value, source: 'override', modelVersion: last.override.modelVersion };
}

// ─────────────────────────────────────────────────────────────────────────
// Portfolio comparison — "absolute inputs AND normalized score"
// ─────────────────────────────────────────────────────────────────────────

export interface PortfolioComparisonRow {
  ideaId: string;
  label: string;
  /** Absolute per-dimension raw inputs (0-10 each), as entered. */
  inputs: DimensionScoreInput;
  normalizedScore: number;
  scoreSource: 'computed' | 'override';
  overrideReason?: string;
  modelVersion: number;
  missingDimensions: ScoringDimensionKey[];
}

/**
 * Builds the side-by-side portfolio view: every idea's raw dimension inputs
 * (the "absolute inputs" §6.3 requires stay visible) next to its normalized
 * 0-100 score, sorted best-first. Ideas with no score history yet are scored
 * on the fly against the current weight version so the table never shows a
 * blank rank for an idea nobody has explicitly re-run.
 */
export function buildPortfolioComparison(
  ideas: { ideaId: string; label: string; inputs: DimensionScoreInput; history?: ScoreHistory }[],
  weightVersion: ScoringWeightVersion
): PortfolioComparisonRow[] {
  const rows = ideas.map((idea) => {
    const history = idea.history ?? [];
    const existing = currentScore(history);
    if (existing) {
      const overrideEvent =
        existing.source === 'override' ? (history[history.length - 1] as Extract<ScoreHistoryEvent, { type: 'override' }>) : undefined;
      const missing =
        history[history.length - 1].type === 'computed'
          ? (history[history.length - 1] as Extract<ScoreHistoryEvent, { type: 'computed' }>).result.missingDimensions
          : [];
      return {
        ideaId: idea.ideaId,
        label: idea.label,
        inputs: idea.inputs,
        normalizedScore: existing.value,
        scoreSource: existing.source,
        overrideReason: overrideEvent?.override.reason,
        modelVersion: existing.modelVersion,
        missingDimensions: missing,
      } satisfies PortfolioComparisonRow;
    }
    const computed = computeCompositeScore(idea.inputs, weightVersion);
    return {
      ideaId: idea.ideaId,
      label: idea.label,
      inputs: idea.inputs,
      normalizedScore: computed.score,
      scoreSource: 'computed' as const,
      modelVersion: computed.modelVersion,
      missingDimensions: computed.missingDimensions,
    } satisfies PortfolioComparisonRow;
  });

  return rows.sort((a, b) => b.normalizedScore - a.normalizedScore);
}
