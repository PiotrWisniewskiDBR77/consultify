/**
 * OKR-E003 — progress/confidence calculation engine.
 *
 * Design: docs/product/results-vnext/OKR_E003_DESIGN.md §9, ratified by the
 * §-IO Integration Owner rulings block at the top of that document (items
 * 1, 2, 5 below are BINDING rulings, not this file's own invention).
 *
 * PURE, DB-FREE. No import from `pg`, no network, no `Date.now()`. Same
 * discipline as ROI's NPV/rounding engine (`EXECUTION_LEDGER.md` §3.5:
 * "MUSI być pure domain package") and this program's "known-answer suite"
 * testing convention — `tests/resultsVnext/okr/okrProgressEngine.test.ts`
 * hand-verifies every expected value in a comment rather than asserting the
 * engine agrees with itself.
 *
 * OKR-F-009-AC-01's literal requirement: degenerate/missing inputs return
 * `not_calculable` (`progress: null`), NEVER a fabricated `0`. `0` is only
 * ever a genuine calculated result (e.g. binary "not achieved", or
 * maintain_range "out of range").
 *
 * §-IO item 1 (binding, overrides the design draft's own rejected
 * proposal): `binary` — achieved = 1.0, not achieved = 0.0. `maintain_range`
 * — in-range = 1.0, out-of-range = 0.0, with the out-of-range MAGNITUDE in
 * the separate `outOfRangeDistance` field, never folded into `progress`.
 * The draft's linear-falloff formula for `maintain_range` is REJECTED — a
 * falloff needs an arbitrary slope parameter no source specifies.
 *
 * §-IO item 2 (binding): `progress` is the RAW UNCLAMPED ratio. This engine
 * never clamps to [0,1] — overachievement (e.g. 1.4 on an `increase` KR) is
 * a legitimate output, not an error.
 */

// ==========================================
// KR-level progress (5 geometries)
// ==========================================

export interface KeyResultProgressInput {
  direction: 'increase' | 'decrease' | 'reach' | 'maintain_range' | 'binary';
  baselineValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  rangeMin: number | null;
  rangeMax: number | null;
}

export interface KeyResultProgressCalcResult {
  /** `null` = not_calculable. §-IO item 2: raw unclamped ratio otherwise —
   * NEVER clamped to [0,1] by this engine. */
  progress: number | null;
  /** ALWAYS populated (both success and not_calculable paths) — the
   * literal audit-trail mechanism OKR-F-009-AC-02 requires ("przechowuje
   * politykę/wersję kalkulacji i powód"). Not-calculable reasons are
   * prefixed `not_calculable:` so a caller can `reason.startsWith(...)`
   * without re-deriving the null check. */
  reason: string;
  /** §-IO item 1: `maintain_range`'s out-of-range MAGNITUDE, kept separate
   * from `progress`. `0` when in-range and calculable (a real measured
   * zero-distance, not "no data"). `null` for every other geometry, and
   * for `maintain_range` itself when not_calculable. */
  outOfRangeDistance: number | null;
}

/**
 * Pure, deterministic, never throws. Degenerate inputs return
 * `{progress: null, reason: 'not_calculable: <cause>', outOfRangeDistance: null}`
 * — never a fabricated `0` (OKR-F-009-AC-01's literal requirement).
 */
export function calculateKeyResultProgress(input: KeyResultProgressInput): KeyResultProgressCalcResult {
  const { direction, baselineValue, targetValue, currentValue, rangeMin, rangeMax } = input;

  switch (direction) {
    case 'increase': {
      if (currentValue === null || baselineValue === null || targetValue === null) {
        return {
          progress: null,
          reason: 'not_calculable: increase geometry requires current_value, baseline_value, and target_value — at least one is missing',
          outOfRangeDistance: null,
        };
      }
      if (targetValue === baselineValue) {
        return {
          progress: null,
          reason: 'not_calculable: increase geometry has target_value equal to baseline_value (division by zero)',
          outOfRangeDistance: null,
        };
      }
      return {
        progress: (currentValue - baselineValue) / (targetValue - baselineValue),
        reason: 'increase: (current_value - baseline_value) / (target_value - baseline_value)',
        outOfRangeDistance: null,
      };
    }

    case 'decrease': {
      if (currentValue === null || baselineValue === null || targetValue === null) {
        return {
          progress: null,
          reason: 'not_calculable: decrease geometry requires current_value, baseline_value, and target_value — at least one is missing',
          outOfRangeDistance: null,
        };
      }
      if (baselineValue === targetValue) {
        return {
          progress: null,
          reason: 'not_calculable: decrease geometry has baseline_value equal to target_value (division by zero)',
          outOfRangeDistance: null,
        };
      }
      return {
        progress: (baselineValue - currentValue) / (baselineValue - targetValue),
        reason: 'decrease: (baseline_value - current_value) / (baseline_value - target_value)',
        outOfRangeDistance: null,
      };
    }

    case 'reach': {
      // "percentage direct" in the plan's prose — no baseline semantics,
      // see design §9.1's reconciliation note (flagged, unconfirmed
      // mapping; see EXECUTION_LEDGER closure entry / EPIC_LEDGER_LIVE).
      if (currentValue === null || targetValue === null) {
        return {
          progress: null,
          reason: 'not_calculable: reach geometry requires current_value and target_value — at least one is missing',
          outOfRangeDistance: null,
        };
      }
      if (targetValue === 0) {
        return {
          progress: null,
          reason: 'not_calculable: reach geometry has target_value equal to zero (division by zero)',
          outOfRangeDistance: null,
        };
      }
      return {
        progress: currentValue / targetValue,
        reason: 'reach: current_value / target_value',
        outOfRangeDistance: null,
      };
    }

    case 'maintain_range': {
      if (currentValue === null || rangeMin === null || rangeMax === null) {
        return {
          progress: null,
          reason: 'not_calculable: maintain_range geometry requires current_value, range_min, and range_max — at least one is missing',
          outOfRangeDistance: null,
        };
      }
      if (rangeMin > rangeMax) {
        return {
          progress: null,
          reason: 'not_calculable: maintain_range geometry has range_min greater than range_max (invalid range)',
          outOfRangeDistance: null,
        };
      }
      if (currentValue >= rangeMin && currentValue <= rangeMax) {
        return {
          progress: 1,
          reason: '§-IO ruling: maintain_range in-range = 1.0',
          outOfRangeDistance: 0,
        };
      }
      const outOfRangeDistance = currentValue < rangeMin ? rangeMin - currentValue : currentValue - rangeMax;
      return {
        progress: 0,
        reason: '§-IO ruling: maintain_range out-of-range = 0.0 (magnitude recorded separately in outOfRangeDistance, never folded into progress)',
        outOfRangeDistance,
      };
    }

    case 'binary': {
      if (currentValue === null) {
        return {
          progress: null,
          reason: 'not_calculable: binary geometry requires current_value',
          outOfRangeDistance: null,
        };
      }
      if (currentValue === 1) {
        return { progress: 1, reason: '§-IO ruling: binary achieved = 1.0', outOfRangeDistance: null };
      }
      if (currentValue === 0) {
        return { progress: 0, reason: '§-IO ruling: binary not achieved = 0.0', outOfRangeDistance: null };
      }
      return {
        progress: null,
        reason: `not_calculable: binary geometry current_value (${currentValue}) is neither 1 (achieved) nor 0 (not achieved) — no other sentinel is defined`,
        outOfRangeDistance: null,
      };
    }

    default: {
      const exhaustive: never = direction;
      return {
        progress: null,
        reason: `not_calculable: unrecognized direction "${String(exhaustive)}"`,
        outOfRangeDistance: null,
      };
    }
  }
}

// ==========================================
// Objective-level progress rollup
// ==========================================

export interface ObjectiveRollupKeyResultInput {
  progress: number | null;
  weight: number | null;
}

export interface ObjectiveRollupInput {
  keyResultProgresses: ObjectiveRollupKeyResultInput[];
  rollupModel: 'equal_average' | 'weighted_average' | 'manual' | 'none';
}

export interface ProgressCalcResult {
  progress: number | null;
  reason: string;
}

/**
 * `'none'`/`'manual'` are legitimate policy choices, not degenerate inputs
 * — they are NOT reported as `not_calculable` even though `progress` is
 * `null`, because the reason is a deliberate policy decision, not missing
 * data (the distinction OKR-F-009-AC-02's audit trail exists to preserve).
 * `'equal_average'`/`'weighted_average'` skip not_calculable KRs; if EVERY
 * KR is not_calculable (or there are none), the rollup itself is
 * `not_calculable` — never treated as `0`.
 */
export function calculateObjectiveProgressRollup(input: ObjectiveRollupInput): ProgressCalcResult {
  const { keyResultProgresses, rollupModel } = input;

  if (rollupModel === 'none') {
    return {
      progress: null,
      reason: 'rollup_model_none: objective_rollup_model is "none" — Objective progress is intentionally not rolled up',
    };
  }
  if (rollupModel === 'manual') {
    return {
      progress: null,
      reason:
        'rollup_model_manual_owner_sets_directly: objective_rollup_model is "manual" — Objective Owner sets progress directly via updateObjective, the engine never overwrites it',
    };
  }

  const calculable = keyResultProgresses.filter((kr) => kr.progress !== null);
  if (calculable.length === 0) {
    return {
      progress: null,
      reason:
        keyResultProgresses.length === 0
          ? 'not_calculable: objective has no non-cancelled key results to roll up'
          : 'not_calculable: every key result under this objective is itself not_calculable',
    };
  }

  if (rollupModel === 'equal_average') {
    const sum = calculable.reduce((acc, kr) => acc + (kr.progress as number), 0);
    return {
      progress: sum / calculable.length,
      reason: `equal_average over ${calculable.length} calculable key result(s) (of ${keyResultProgresses.length} total)`,
    };
  }

  // weighted_average — a KR with a null weight is treated as weight=1
  // (equal contribution), a stated design choice (D-E3-2/§9.3), not a
  // silent guess.
  const totalWeight = calculable.reduce((acc, kr) => acc + (kr.weight ?? 1), 0);
  if (totalWeight === 0) {
    return {
      progress: null,
      reason: 'not_calculable: weighted_average total weight across calculable key results is zero',
    };
  }
  const weightedSum = calculable.reduce((acc, kr) => acc + (kr.progress as number) * (kr.weight ?? 1), 0);
  return {
    progress: weightedSum / totalWeight,
    reason: `weighted_average over ${calculable.length} calculable key result(s) (of ${keyResultProgresses.length} total); a null weight is treated as 1`,
  };
}

// ==========================================
// Objective-level confidence rollup — NEVER averaged (plan §5.4)
// ==========================================

export type OkrConfidenceValue = 'high' | 'medium' | 'low' | 'numeric';

export interface ObjectiveConfidenceRollupKeyResultInput {
  confidence: OkrConfidenceValue | null;
  confidenceNumericValue: number | null;
}

export interface ObjectiveConfidenceRollupInput {
  keyResultConfidences: ObjectiveConfidenceRollupKeyResultInput[];
  confidenceModel: 'lowest_kr' | 'owner_selected' | 'custom';
  ownerSelectedValue?: { confidence: OkrConfidenceValue; confidenceNumericValue: number | null } | null;
}

export interface ObjectiveConfidenceRollupResult {
  confidence: OkrConfidenceValue | null;
  confidenceNumericValue: number | null;
  reason: string;
}

const CATEGORICAL_CONFIDENCE_RANK: Record<'low' | 'medium' | 'high', number> = { low: 0, medium: 1, high: 2 };

/**
 * `'lowest_kr'` orders `high > medium > low` (categorical) or takes the
 * minimum numeric value (numeric) — NEVER averages, per plan §5.4's
 * literal "Confidence is never blindly averaged." §-IO item 5 (binding):
 * if KRs within one Objective mix categorical and numeric confidence
 * models, the result is `not_calculable` — no cross-scale comparison is
 * invented, and this function (nor the schema) forces homogeneity.
 * `'custom'` is rejected at the COMMAND layer (D-E3-10) before this
 * function would ever be called with it in production; the branch here
 * exists only so the pure function itself never throws.
 */
export function calculateObjectiveConfidenceRollup(
  input: ObjectiveConfidenceRollupInput
): ObjectiveConfidenceRollupResult {
  const { keyResultConfidences, confidenceModel, ownerSelectedValue } = input;

  if (confidenceModel === 'owner_selected') {
    if (!ownerSelectedValue) {
      return {
        confidence: null,
        confidenceNumericValue: null,
        reason: 'not_calculable: objective_confidence_model is "owner_selected" but the Objective Owner has not set a value yet',
      };
    }
    return {
      confidence: ownerSelectedValue.confidence,
      confidenceNumericValue: ownerSelectedValue.confidenceNumericValue,
      reason: 'owner_selected: Objective Owner value — key result confidence not consulted',
    };
  }

  if (confidenceModel === 'custom') {
    return {
      confidence: null,
      confidenceNumericValue: null,
      reason: 'not_calculable: objective_confidence_model "custom" is not implemented in OKR-E003 (D-E3-10) — reject this at the command layer before reaching the engine',
    };
  }

  // lowest_kr
  const withValue = keyResultConfidences.filter((kr) => kr.confidence !== null);
  if (withValue.length === 0) {
    return {
      confidence: null,
      confidenceNumericValue: null,
      reason: 'not_calculable: no key result under this objective has a confidence value set yet',
    };
  }

  const hasCategorical = withValue.some((kr) => kr.confidence !== 'numeric');
  const hasNumeric = withValue.some((kr) => kr.confidence === 'numeric');
  if (hasCategorical && hasNumeric) {
    return {
      confidence: null,
      confidenceNumericValue: null,
      reason:
        'not_calculable: key results within this objective mix categorical (high/medium/low) confidence with numeric confidence — §-IO ruling item 5: no cross-scale comparison is defined, this is a real heterogeneous state, not schema-forbidden',
    };
  }

  if (hasNumeric) {
    const numericValues = withValue.map((kr) => kr.confidenceNumericValue).filter((v): v is number => v !== null);
    if (numericValues.length === 0) {
      return {
        confidence: null,
        confidenceNumericValue: null,
        reason: 'not_calculable: confidence model is numeric but no key result has a confidenceNumericValue populated',
      };
    }
    const worst = Math.min(...numericValues);
    return {
      confidence: 'numeric',
      confidenceNumericValue: worst,
      reason: `lowest_kr: numeric confidence, minimum value across ${numericValues.length} key result(s) — lower numeric value interpreted as less confidence, never averaged`,
    };
  }

  const worstRank = Math.min(
    ...withValue.map((kr) => CATEGORICAL_CONFIDENCE_RANK[kr.confidence as 'low' | 'medium' | 'high'])
  );
  const worstLabel = (Object.keys(CATEGORICAL_CONFIDENCE_RANK) as Array<'low' | 'medium' | 'high'>).find(
    (label) => CATEGORICAL_CONFIDENCE_RANK[label] === worstRank
  ) as 'low' | 'medium' | 'high';
  return {
    confidence: worstLabel,
    confidenceNumericValue: null,
    reason: `lowest_kr: categorical confidence, worst of ${withValue.length} key result(s) (high > medium > low, never averaged)`,
  };
}
