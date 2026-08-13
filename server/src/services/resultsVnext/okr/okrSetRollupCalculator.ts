/**
 * OKR-E004 — Set-level rollup calculation (design §7.3, Decisions D8-D10).
 *
 * PURE, DB-FREE. No import from `pg`, no network, no `Date.now()` — same
 * discipline `okrProgressEngine.ts` (OKR-E003) states for itself. This file
 * is the "one level up" sibling of that engine: it aggregates ALREADY
 * rolled-up Objective-level progress/confidence (OKR-E003's own
 * `recomputeObjectiveRollup` output) into the Set's `overall_progress`/
 * `overall_confidence`/`attention_state`, never re-deriving anything
 * KR-level itself (design §7.3: "this function consumes Objective-level
 * progress, does not re-derive it from KRs directly, keeping the two
 * rollup layers cleanly separated").
 *
 * D9: deliberately REUSES `calculateObjectiveProgressRollup`/
 * `calculateObjectiveConfidenceRollup` from `okrProgressEngine.ts` rather
 * than re-implementing equal/weighted-average or lowest-of logic a second
 * time — those functions are already generic over "a list of {progress,
 * weight}" / "a list of {confidence, confidenceNumericValue}", and a Set's
 * Objectives are structurally that same shape one level up. This also
 * guarantees the Set layer can never silently drift from the Objective
 * layer's own null/not_calculable discipline (OKR-F-009-AC-02).
 *
 * §-IO / IO-2 + IO-5 (binding): `attention_state` derivation. The design's
 * own §7.3 draft proposed a progress-vs-expected-trajectory margin for
 * `'action_required'` and flagged, in its own words, that "no threshold
 * field exists on okr_vnext_programs today". IO-5 is explicit: never invent
 * a formula/threshold/gradient not specified in any source document. A
 * "trails expected trajectory by X%" check requires BOTH an invented
 * variance threshold AND an invented time-linear expectation model — two
 * free parameters, not one. This implementation therefore does NOT attempt
 * that computation at all: `attentionState` here is constrained to
 * `'none'`/`'watch'` only, decided by two purely BOOLEAN, definitionally-
 * forced facts (a confidence value literally equal to `'low'` exists; a
 * check-in is literally overdue) — no threshold to tune, no gradient to
 * invent. `'action_required'`/`'escalated'` are never emitted by this
 * function; `'escalated'` was always reserved for a human/manager action
 * (design §7.3, presumably OKR-E006's job); `'action_required'` is a
 * NAMED, OPEN GAP restated in the EXECUTION_LEDGER closure entry, not
 * silently downgraded to `'watch'` and forgotten — see that entry for the
 * exact statement of what a future Program-policy field would need to add.
 */
import {
  calculateObjectiveConfidenceRollup,
  calculateObjectiveProgressRollup,
  type OkrConfidenceValue,
} from './okrProgressEngine.js';
import type { OkrObjectiveConfidenceModel, OkrObjectiveRollupModel } from './okrProgramTypes.js';
import type { OkrSetAttentionState } from './okrSetTypes.js';

export interface ComputeSetRollupObjectiveInput {
  objectiveId: string;
  /** OKR-E003's own already-rolled-up Objective progress (design §7.3:
   * "consumes Objective-level progress, does not re-derive it from KRs"). */
  progress: number | null;
  confidence: OkrConfidenceValue | null;
  confidenceNumericValue: number | null;
}

export interface ComputeSetRollupInput {
  /** Non-cancelled Objectives belonging to the Set only — cancelled
   * Objectives are excluded by the CALLER (mirrors
   * `recomputeObjectiveRollup`'s own `status <> 'cancelled'` SQL filter,
   * kept out of this pure function so it never needs to know the status
   * vocabulary). */
  objectives: ComputeSetRollupObjectiveInput[];
  objectiveRollupModel: OkrObjectiveRollupModel;
  objectiveConfidenceModel: OkrObjectiveConfidenceModel;
  /**
   * True if at least one non-cancelled Key Result belonging to this Set has
   * a CLOSED cadence-occurrence window (`window_end < asOf`) with no
   * original check-in recorded against it — a live, caller-computed fact
   * (this function does no date arithmetic and takes no `now`/`asOf`
   * parameter, staying strictly pure). AC-011's literal "brak check-in ->
   * stale/attention" is satisfied through this flag, never through a
   * fabricated progress value.
   */
  anyKeyResultStale: boolean;
  /** D10: `MAX(checkin.submitted_at)` across every KR belonging to the Set
   * — caller-computed, passed straight through to the result. */
  lastCheckinAt: string | null;
  /** D10: "the most urgent still-open obligation this Set owes" —
   * caller-computed, passed straight through to the result. */
  nextCheckinDueAt: string | null;
}

export interface ComputeSetRollupResult {
  overallProgress: number | null;
  overallConfidence: OkrConfidenceValue | null;
  overallConfidenceNumericValue: number | null;
  attentionState: OkrSetAttentionState;
  lastCheckinAt: string | null;
  nextCheckinDueAt: string | null;
  /** RN-G6-SRV / D08 (docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md
   * §OQ-UI-C): the progress half of `reason` below, split out into its own
   * field so `applySetRollupUpdate` can persist it onto
   * `okr_vnext_sets.overall_progress_reason` — the Set-level counterpart of
   * `okr_vnext_objectives.progress_calc_reason`/
   * `okr_vnext_key_results.progress_calc_reason`, which already round-trip
   * this same "not_calculable: ..." vs a real derivation correctly. Always
   * starts with `not_calculable:` when `overallProgress` is `null`,
   * mirroring `calculateObjectiveProgressRollup`'s/
   * `calculateKeyResultProgress`'s own convention one layer down. */
  overallProgressReason: string;
  /** Same rationale as `overallProgressReason`, for
   * `okr_vnext_sets.overall_confidence_reason`. */
  overallConfidenceReason: string;
  /** Audit trail, mirrors OKR-F-009-AC-02's "every calculated value stores
   * ... reason" — one combined reason string covering progress, confidence,
   * and attention derivation (design §7.3's own `reason: string` field).
   * Kept alongside the two split fields above for backward compatibility
   * with existing callers/tests that read the combined string; every piece
   * of information it carries is also available individually via
   * `overallProgressReason`/`overallConfidenceReason` (attention's own
   * reason has no dedicated DB column yet — no AC/decision names one — so
   * it stays only in this combined string, same "restated, not silently
   * dropped" posture the file header already takes for `action_required`). */
  reason: string;
}

/**
 * D9 (Program-policy-driven, no fabricated field): `objective_rollup_model`/
 * `objective_confidence_model` are read directly off the Cycle's PINNED
 * policy snapshot by the caller and passed in here unchanged — this
 * function never reads `okr_vnext_programs` itself (it is DB-free).
 *
 * Zero-Objective / all-cancelled Set (literal AC-011 requirement — "brak
 * check-in -> stale/attention, NIGDY syntetyczne 0%"): both engine calls
 * already return `{progress: null}`/`{confidence: null}` for an empty
 * input list (OKR-F-009-AC-01's own null-not-zero discipline, inherited
 * here rather than re-implemented) — `overallProgress`/`overallConfidence`
 * are `null`, never a fabricated `0`.
 */
export function computeSetRollup(input: ComputeSetRollupInput): ComputeSetRollupResult {
  const { objectives, objectiveRollupModel, objectiveConfidenceModel, anyKeyResultStale, lastCheckinAt, nextCheckinDueAt } = input;

  const progressResult = calculateObjectiveProgressRollup({
    keyResultProgresses: objectives.map((o) => ({ progress: o.progress, weight: null })),
    rollupModel: objectiveRollupModel,
  });

  // D9: no Set-level "owner manually sets overall_confidence" input exists
  // anywhere in this epic (IO-3 — no AC names that capability; E002 never
  // built such an endpoint either) — `ownerSelectedValue` is always `null`
  // here. When `objectiveConfidenceModel === 'owner_selected'`, the engine
  // itself already returns a clean `not_calculable` for a `null`
  // `ownerSelectedValue` rather than throwing, so this degrades safely.
  const confidenceResult = calculateObjectiveConfidenceRollup({
    keyResultConfidences: objectives.map((o) => ({ confidence: o.confidence, confidenceNumericValue: o.confidenceNumericValue })),
    confidenceModel: objectiveConfidenceModel,
    ownerSelectedValue: null,
  });

  // Definitionally-forced, threshold-free 'watch' trigger (IO-5): a literal
  // 'low' confidence value exists among this Set's Objectives, OR at least
  // one KR has a genuinely overdue check-in. Neither branch requires a
  // tunable number.
  const anyObjectiveLowConfidence = objectives.some((o) => o.confidence === 'low');
  const attentionState: OkrSetAttentionState = anyObjectiveLowConfidence || anyKeyResultStale ? 'watch' : 'none';

  const objectiveCount = objectives.length;
  const progressReason =
    objectiveCount === 0
      ? 'not_calculable: set has no non-cancelled objectives to roll up'
      : `set_rollup(${objectiveRollupModel}) over ${objectiveCount} objective(s): ${progressResult.progress === null ? 'not_calculable (see per-objective progress)' : progressResult.progress}`;
  const confidenceReason =
    objectiveCount === 0
      ? 'not_calculable: set has no non-cancelled objectives to roll up'
      : `set_rollup(${objectiveConfidenceModel}) over ${objectiveCount} objective(s): ${confidenceResult.confidence === null ? 'not_calculable (see per-objective confidence)' : confidenceResult.confidence}`;
  const attentionReason = anyKeyResultStale
    ? 'watch: at least one key result has a closed cadence window with no check-in recorded'
    : anyObjectiveLowConfidence
      ? 'watch: at least one objective carries a "low" confidence value'
      : 'none: no stale key result and no low-confidence objective (§-IO IO-5: action_required/escalated are never computed here — no policy threshold exists, see EXECUTION_LEDGER closure entry)';

  return {
    overallProgress: progressResult.progress,
    overallConfidence: confidenceResult.confidence,
    overallConfidenceNumericValue: confidenceResult.confidenceNumericValue,
    attentionState,
    lastCheckinAt,
    nextCheckinDueAt,
    overallProgressReason: progressReason,
    overallConfidenceReason: confidenceReason,
    reason: `${progressReason} | ${confidenceReason} | ${attentionReason}`,
  };
}
