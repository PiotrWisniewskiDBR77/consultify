/**
 * RN-G2 §G #25 — Check-in pure mapping helpers. No React. Mirrors
 * `okrObjectiveMappers.ts`'s shape one level down.
 */
import type { HonestValue } from '../types';
import { formatOkrDate } from './okrRegistryMappers';
import type { OkrCheckInConfidence, OkrCheckInStatus, OkrSuggestNextCheckInBasis } from './okrCheckInApi';

export { formatOkrDate };

export const OKR_CHECKIN_STATUS_LABELS: Record<OkrCheckInStatus, { pl: string; en: string }> = {
  not_started: { pl: 'Nierozpoczęty', en: 'Not started' },
  on_track: { pl: 'Zgodnie z planem', en: 'On track' },
  at_risk: { pl: 'Zagrożony', en: 'At risk' },
  off_track: { pl: 'Poza planem', en: 'Off track' },
  achieved: { pl: 'Osiągnięty', en: 'Achieved' },
  not_achieved: { pl: 'Nieosiągnięty', en: 'Not achieved' },
  cancelled: { pl: 'Anulowany', en: 'Cancelled' },
};

export function okrCheckInStatusLabel(status: OkrCheckInStatus, isPolish: boolean): string {
  return isPolish ? OKR_CHECKIN_STATUS_LABELS[status].pl : OKR_CHECKIN_STATUS_LABELS[status].en;
}

export type OkrCheckInStatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const OKR_CHECKIN_STATUS_TONE: Record<OkrCheckInStatus, OkrCheckInStatusTone> = {
  not_started: 'neutral',
  on_track: 'success',
  at_risk: 'warning',
  off_track: 'danger',
  achieved: 'success',
  not_achieved: 'danger',
  cancelled: 'danger',
};

export const OKR_CHECKIN_CONFIDENCE_LABELS: Record<OkrCheckInConfidence, { pl: string; en: string }> = {
  high: { pl: 'Wysoka', en: 'High' },
  medium: { pl: 'Średnia', en: 'Medium' },
  low: { pl: 'Niska', en: 'Low' },
  numeric: { pl: 'Liczbowa', en: 'Numeric' },
};

export function okrCheckInConfidenceLabel(confidence: OkrCheckInConfidence, isPolish: boolean): string {
  return isPolish ? OKR_CHECKIN_CONFIDENCE_LABELS[confidence].pl : OKR_CHECKIN_CONFIDENCE_LABELS[confidence].en;
}

export const OKR_SUGGEST_BASIS_LABELS: Record<OkrSuggestNextCheckInBasis, { pl: string; en: string }> = {
  linear_trend: { pl: 'Trend liniowy', en: 'Linear trend' },
  no_history: { pl: 'Brak wystarczającej historii', en: 'Insufficient history' },
  // Declared for exhaustiveness — `suggestNextCheckInValue`'s real
  // implementation never returns this basis today (see `okrCheckInApi.ts`
  // header). Kept so a future backend change that DOES start returning it
  // renders correctly without a client change.
  not_calculable: { pl: 'Nie można wyliczyć', en: 'Not calculable' },
};

export function okrSuggestBasisLabel(basis: OkrSuggestNextCheckInBasis, isPolish: boolean): string {
  return isPolish ? OKR_SUGGEST_BASIS_LABELS[basis].pl : OKR_SUGGEST_BASIS_LABELS[basis].en;
}

/**
 * Check-in `calculatedProgress` — a genuine 2-way domain on the wire (see
 * `okrCheckInApi.ts`'s `OkrCheckInDto.calculatedProgress` doc comment: the
 * engine computes a `reason` at insert time but `okr_vnext_checkins` has no
 * column to persist it). Never returns `'not_calculable'` — there is no
 * reason string on this row to justify that branch, so returning it here
 * would be exactly the fabricated distinction CLAUDE.md's rule forbids.
 */
export function parseOkrCheckInProgress(calculatedProgress: string | null): HonestValue<number> {
  if (calculatedProgress === null) return null;
  const parsed = Number(calculatedProgress);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatOkrProgressPercent(value: number, isPolish: boolean): string {
  return `${(value * 100).toLocaleString(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 1 })}%`;
}

export function parseOkrNumericField(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
