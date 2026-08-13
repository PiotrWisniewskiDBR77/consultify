/**
 * OKR-E004 — Suggested check-in value (design §9, AC-F-012-AC-01, the
 * "isolating AC").
 *
 * AC-012 is explicitly the isolating AC in the ledger — it exists to block a
 * SPECIFIC, already-confirmed legacy defect from crossing into vNext:
 * `okrService.ts::getSuggestedValueForKeyResult` reads `kpi_time_series`
 * directly and imports `kpiDefinitionService.js` (confirmed by direct code
 * read during OKR-E001's own drafting, design §0). The AC's own
 * Schema/migration/constraint cell states this in the strongest possible
 * terms: "BRAK FK z okr_vnext_* do kpi_*".
 *
 * HARD, STATIC, PROVEN CONSTRAINT (not just a comment): this file must NEVER
 * import from `server/src/services/kpiDefinitionService.js` (legacy) or
 * `server/src/services/resultsVnext/kpi/*` (vNext — D09 is about
 * cross-domain coupling in general, not just the legacy path specifically),
 * and must issue ZERO SQL of its own against `kpi_time_series` or any other
 * table. `tests/resultsVnext/okr/okrCheckInSuggestion.test.ts` proves this
 * via a static import-list check on this file's own source text, mirroring
 * `legacyIsolation.realdb.test.ts`'s established pattern elsewhere in this
 * program for D09-class guarantees.
 *
 * PURE, DB-FREE. Takes the KR's own check-in HISTORY (this epic's own
 * `okr_vnext_checkins` rows, already loaded by the caller) and suggests a
 * naive linear-trend next value derived PURELY from the OKR domain's own
 * data — never from KPI's. "Typed optional reference, NIE strukturalny
 * odczyt" (AC table Schema cell): a KR MAY carry an opaque
 * `sourceReference` TEXT pointer (OKR-E003's own `source_type`/
 * `source_reference` columns, zero FK per D09) purely as a human-readable
 * pointer — this function never resolves, joins, or dereferences it.
 *
 * Roles/visibility cell confirms this is UI-facing only ("KR Owner (widzi
 * sugestię, nie źródło KPI)") — surfaced to the person doing the check-in,
 * with no provenance claim back to any KPI source, because there is none.
 */
import type { OkrCheckIn } from './okrCheckInTypes.js';
import type { OkrKeyResult } from './okrKeyResultTypes.js';

export interface SuggestNextCheckInValueResult {
  suggestedValue: number | null;
  basis: 'linear_trend' | 'no_history' | 'not_calculable';
  reason: string;
}

function toNumberOrNull(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * `priorCheckIns` MUST already be filtered to this KR's own "current" rows
 * (correction-superseded rows excluded, most-recent-first is NOT required —
 * this function sorts by `submittedAt` itself) — the caller
 * (`okrCheckInRepository.ts::listCheckIns`) owns that filtering, this
 * function only consumes what it is given.
 *
 * Naive linear trend: average step between consecutive `newValue`s across
 * the KR's own check-in history, projected one step forward from the most
 * recent value. Fewer than 2 numeric-valued check-ins => `'no_history'`
 * (never a fabricated guess from a single point). A KR whose
 * `measurementType` cannot sensibly extrapolate (e.g. `binary`) is not
 * special-cased here — the caller (or the UI) decides whether to surface
 * this suggestion for that measurement type; this function stays a pure
 * numeric utility.
 */
export function suggestNextCheckInValue(priorCheckIns: OkrCheckIn[], keyResult: OkrKeyResult): SuggestNextCheckInValueResult {
  const numericHistory = priorCheckIns
    .map((c) => ({ value: toNumberOrNull(c.newValue), submittedAt: c.submittedAt }))
    .filter((entry): entry is { value: number; submittedAt: string } => entry.value !== null)
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime());

  if (numericHistory.length === 0) {
    return {
      suggestedValue: null,
      basis: 'no_history',
      reason: `no_history: key result ${keyResult.keyResultId} has no prior check-in with a numeric new_value`,
    };
  }

  if (numericHistory.length === 1) {
    return {
      suggestedValue: null,
      basis: 'no_history',
      reason: 'no_history: exactly one prior check-in exists — at least two are required to compute a trend, never guessed from a single point',
    };
  }

  const steps: number[] = [];
  for (let i = 1; i < numericHistory.length; i += 1) {
    steps.push(numericHistory[i]!.value - numericHistory[i - 1]!.value);
  }
  const averageStep = steps.reduce((sum, step) => sum + step, 0) / steps.length;
  const lastValue = numericHistory[numericHistory.length - 1]!.value;
  const suggestedValue = lastValue + averageStep;

  return {
    suggestedValue,
    basis: 'linear_trend',
    reason: `linear_trend: average step ${averageStep} across ${steps.length} interval(s) of ${numericHistory.length} prior check-in(s), projected from the most recent value ${lastValue}`,
  };
}
