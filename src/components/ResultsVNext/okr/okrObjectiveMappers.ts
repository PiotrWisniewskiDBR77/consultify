/**
 * RN-G2 §G #25 — Objective + Key Result pure mapping helpers (status labels,
 * lock semantics, honest progress derivation, formatters). No React —
 * shared by the presenter files and dev-render mock screens. Mirrors
 * `okrRegistryMappers.ts`'s own shape for the Set level.
 */
import type { HonestValue } from '../types';
import { formatOkrDate, shortOkrId } from './okrRegistryMappers';
import type {
  OkrKeyResultConfidence,
  OkrKeyResultDirection,
  OkrKeyResultMeasurementType,
  OkrKeyResultSourceType,
  OkrKeyResultStatus,
  OkrObjectiveAmbitionType,
  OkrObjectiveConfidence,
  OkrObjectiveStatus,
} from './okrObjectiveApi';

export { formatOkrDate, shortOkrId };

// ==========================================
// Objective status labels — 8-state machine, `okrObjectiveTypes.ts` L15-25
// (OKR-E003 design). Never invent a 9th state.
// ==========================================

export const OKR_OBJECTIVE_STATUS_LABELS: Record<OkrObjectiveStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  submitted: { pl: 'Złożony do akceptacji', en: 'Submitted for approval' },
  approved: { pl: 'Zaakceptowany', en: 'Approved' },
  active: { pl: 'Aktywny', en: 'Active' },
  at_risk: { pl: 'Zagrożony', en: 'At risk' },
  completed: { pl: 'Zrealizowany', en: 'Completed' },
  cancelled: { pl: 'Anulowany', en: 'Cancelled' },
  closed: { pl: 'Zamknięty', en: 'Closed' },
};

export function okrObjectiveStatusLabel(status: OkrObjectiveStatus, isPolish: boolean): string {
  return isPolish ? OKR_OBJECTIVE_STATUS_LABELS[status].pl : OKR_OBJECTIVE_STATUS_LABELS[status].en;
}

export type OkrStatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const OKR_OBJECTIVE_STATUS_TONE: Record<OkrObjectiveStatus, OkrStatusTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  active: 'success',
  at_risk: 'warning',
  completed: 'success',
  cancelled: 'danger',
  closed: 'neutral',
};

export const OKR_OBJECTIVE_AMBITION_LABELS: Record<OkrObjectiveAmbitionType, { pl: string; en: string }> = {
  committed: { pl: 'Zobowiązanie', en: 'Committed' },
  aspirational: { pl: 'Aspiracyjny', en: 'Aspirational' },
  standard: { pl: 'Standardowy', en: 'Standard' },
};

export function okrObjectiveAmbitionLabel(ambition: OkrObjectiveAmbitionType, isPolish: boolean): string {
  return isPolish ? OKR_OBJECTIVE_AMBITION_LABELS[ambition].pl : OKR_OBJECTIVE_AMBITION_LABELS[ambition].en;
}

export const OKR_OBJECTIVE_CONFIDENCE_LABELS: Record<OkrObjectiveConfidence, { pl: string; en: string }> = {
  high: { pl: 'Wysoka', en: 'High' },
  medium: { pl: 'Średnia', en: 'Medium' },
  low: { pl: 'Niska', en: 'Low' },
  numeric: { pl: 'Liczbowa', en: 'Numeric' },
};

export function okrObjectiveConfidenceLabel(confidence: OkrObjectiveConfidence, isPolish: boolean): string {
  return isPolish ? OKR_OBJECTIVE_CONFIDENCE_LABELS[confidence].pl : OKR_OBJECTIVE_CONFIDENCE_LABELS[confidence].en;
}

// ==========================================
// Key Result status labels — 7-state machine, `okrKeyResultTypes.ts` L35-44.
// ==========================================

export const OKR_KEY_RESULT_STATUS_LABELS: Record<OkrKeyResultStatus, { pl: string; en: string }> = {
  not_started: { pl: 'Nierozpoczęty', en: 'Not started' },
  on_track: { pl: 'Zgodnie z planem', en: 'On track' },
  at_risk: { pl: 'Zagrożony', en: 'At risk' },
  off_track: { pl: 'Poza planem', en: 'Off track' },
  achieved: { pl: 'Osiągnięty', en: 'Achieved' },
  not_achieved: { pl: 'Nieosiągnięty', en: 'Not achieved' },
  cancelled: { pl: 'Anulowany', en: 'Cancelled' },
};

export function okrKeyResultStatusLabel(status: OkrKeyResultStatus, isPolish: boolean): string {
  return isPolish ? OKR_KEY_RESULT_STATUS_LABELS[status].pl : OKR_KEY_RESULT_STATUS_LABELS[status].en;
}

export const OKR_KEY_RESULT_STATUS_TONE: Record<OkrKeyResultStatus, OkrStatusTone> = {
  not_started: 'neutral',
  on_track: 'success',
  at_risk: 'warning',
  off_track: 'danger',
  achieved: 'success',
  not_achieved: 'danger',
  cancelled: 'danger',
};

export const OKR_KEY_RESULT_DIRECTION_LABELS: Record<OkrKeyResultDirection, { pl: string; en: string }> = {
  increase: { pl: 'Wzrost', en: 'Increase' },
  decrease: { pl: 'Spadek', en: 'Decrease' },
  reach: { pl: 'Osiągnięcie wartości', en: 'Reach' },
  maintain_range: { pl: 'Utrzymanie zakresu', en: 'Maintain range' },
  binary: { pl: 'Binarny (tak/nie)', en: 'Binary (yes/no)' },
};

export function okrKeyResultDirectionLabel(direction: OkrKeyResultDirection, isPolish: boolean): string {
  return isPolish ? OKR_KEY_RESULT_DIRECTION_LABELS[direction].pl : OKR_KEY_RESULT_DIRECTION_LABELS[direction].en;
}

/** MVP-supported subset only (`okrKeyResultCommands.ts` L84:
 * "numeric/percentage/currency/binary only" — `milestone`/`custom` are
 * schema-permitted but command-layer-rejected, so this client never offers
 * them as a create/edit option). */
export const OKR_KEY_RESULT_MEASUREMENT_TYPE_LABELS: Record<OkrKeyResultMeasurementType, { pl: string; en: string }> = {
  numeric: { pl: 'Liczbowy', en: 'Numeric' },
  percentage: { pl: 'Procentowy', en: 'Percentage' },
  currency: { pl: 'Walutowy', en: 'Currency' },
  binary: { pl: 'Binarny (tak/nie)', en: 'Binary (yes/no)' },
};

export function okrKeyResultMeasurementTypeLabel(type: OkrKeyResultMeasurementType, isPolish: boolean): string {
  return isPolish
    ? OKR_KEY_RESULT_MEASUREMENT_TYPE_LABELS[type].pl
    : OKR_KEY_RESULT_MEASUREMENT_TYPE_LABELS[type].en;
}

export const OKR_KEY_RESULT_SOURCE_TYPE_LABELS: Record<OkrKeyResultSourceType, { pl: string; en: string }> = {
  manual: { pl: 'Ręczny', en: 'Manual' },
  import: { pl: 'Import', en: 'Import' },
  connector: { pl: 'Konektor', en: 'Connector' },
  mcp: { pl: 'MCP', en: 'MCP' },
  calculated: { pl: 'Wyliczany', en: 'Calculated' },
};

export function okrKeyResultSourceTypeLabel(type: OkrKeyResultSourceType, isPolish: boolean): string {
  return isPolish ? OKR_KEY_RESULT_SOURCE_TYPE_LABELS[type].pl : OKR_KEY_RESULT_SOURCE_TYPE_LABELS[type].en;
}

export const OKR_KEY_RESULT_CONFIDENCE_LABELS: Record<OkrKeyResultConfidence, { pl: string; en: string }> = {
  high: { pl: 'Wysoka', en: 'High' },
  medium: { pl: 'Średnia', en: 'Medium' },
  low: { pl: 'Niska', en: 'Low' },
  numeric: { pl: 'Liczbowa', en: 'Numeric' },
};

export function okrKeyResultConfidenceLabel(confidence: OkrKeyResultConfidence, isPolish: boolean): string {
  return isPolish ? OKR_KEY_RESULT_CONFIDENCE_LABELS[confidence].pl : OKR_KEY_RESULT_CONFIDENCE_LABELS[confidence].en;
}

// ==========================================
// Lock semantics — content-edit lock (create/update/cancel of BOTH
// Objectives and Key Results) is gated ENTIRELY on the OWNING Set's status,
// via `assertSetEditableForUpdate` (`okrObjectiveCommands.ts` L103-129,
// reused verbatim by `okrKeyResultCommands.ts`) — `['draft',
// 'changes_requested']` is the whitelist, THE SAME TWO STATUSES already
// used for Set-level draft-field locking (`OKR_SET_DRAFT_EDITABLE_STATUSES`,
// `okrSetCommands.ts` L464). This does not import that Set-specific helper
// (its copy is worded for the SET's own draft fields, e.g. "pola szkicu
// zablokowane") — this file declares its own copy worded for Objective/KR
// content, tailored to the action being blocked.
// ==========================================

const OKR_SET_CHILD_EDITABLE_STATUSES = new Set(['draft', 'changes_requested']);

export interface OkrSetChildLockInfo {
  label: { pl: string; en: string };
  reason: { pl: string; en: string };
}

/** `setStatus` is the OWNING Set's status (an `OkrSetStatus`, typed loosely
 * here as `string` so this file does not need to import `okrApi.ts` just
 * for one union type). Returns `null` when Objectives/KRs under this Set
 * ARE currently create/edit/cancel-able. */
export function getOkrSetChildEditLock(setStatus: string): OkrSetChildLockInfo | null {
  if (OKR_SET_CHILD_EDITABLE_STATUSES.has(setStatus)) return null;
  return {
    label: { pl: 'Zablokowane', en: 'Locked' },
    reason: {
      pl: `Cele i Kluczowe Rezultaty można dodawać i edytować tylko, gdy zestaw OKR jest w statusie "Szkic" lub "Wymaga poprawek" — ten zestaw jest w statusie innym (kod serwera: assertSetEditableForUpdate).`,
      en: `Objectives and Key Results can only be added or edited while the OKR set is "Draft" or "Changes requested" — this set is in a different status (server rule: assertSetEditableForUpdate).`,
    },
  };
}

/** `recordCheckIn`'s OPPOSITE lifecycle gate (`okrCheckInCommands.ts`
 * L441-446: `SET_NOT_ACTIVE`) — check-ins are only accepted while the
 * owning Set is `'active'`. Deliberately a separate helper, not a negation
 * of `getOkrSetChildEditLock`, because the two gates use DIFFERENT status
 * sets (child-edit: draft/changes_requested; check-in: active only — a Set
 * in e.g. 'submitted' or 'approved' is locked for BOTH). */
export function getOkrCheckInSetLock(setStatus: string): OkrSetChildLockInfo | null {
  if (setStatus === 'active') return null;
  return {
    label: { pl: 'Zablokowane', en: 'Locked' },
    reason: {
      pl: `Check-iny przyjmowane są tylko, gdy zestaw OKR jest w statusie "Aktywny" — ten zestaw jest w statusie innym (kod serwera: SET_NOT_ACTIVE).`,
      en: `Check-ins are only accepted while the OKR set is "Active" — this set is in a different status (server rule: SET_NOT_ACTIVE).`,
    },
  };
}

// ==========================================
// Cancel-eligibility — a SEPARATE gate from the content-edit lock above:
// even while the owning Set is editable, cancelling an Objective/KR is only
// valid from specific OWN statuses (`OKR_OBJECTIVE_CANCEL_FROM_STATUSES`/
// `OKR_KEY_RESULT_CANCEL_FROM_STATUSES`, `okrObjectiveCommands.ts` L667-676 /
// `okrKeyResultCommands.ts` L545-552) — terminal states can't be cancelled
// again. BOTH gates must pass for the cancel action to be enabled.
// ==========================================

const OKR_OBJECTIVE_CANCEL_FROM_STATUSES = new Set<OkrObjectiveStatus>([
  'draft',
  'submitted',
  'approved',
  'active',
  'at_risk',
]);

export function canCancelObjectiveStatus(status: OkrObjectiveStatus): boolean {
  return OKR_OBJECTIVE_CANCEL_FROM_STATUSES.has(status);
}

const OKR_KEY_RESULT_CANCEL_FROM_STATUSES = new Set<OkrKeyResultStatus>([
  'not_started',
  'on_track',
  'at_risk',
  'off_track',
  'achieved',
  'not_achieved',
]);

export function canCancelKeyResultStatus(status: OkrKeyResultStatus): boolean {
  return OKR_KEY_RESULT_CANCEL_FROM_STATUSES.has(status);
}

// ==========================================
// Honest-value derivation
// ==========================================

const NOT_CALCULABLE_PREFIX = 'not_calculable:';

/**
 * Objective-level progress — UNLIKE the Set (`okrRegistryMappers.ts`'s
 * `parseOkrProgress`, a genuine 2-way domain), the Objective's
 * `progressCalcReason` IS persisted and returned (see `okrObjectiveApi.ts`'s
 * `OkrObjectiveDto.progressCalcReason` doc comment for the full citation),
 * so the real 3-way `decimal | null | 'not_calculable'` domain IS reachable
 * here — but ONLY when the reason is actually prefixed `'not_calculable:'`.
 * A `null` progress with a `'rollup_model_none: ...'` or
 * `'rollup_model_manual_owner_sets_directly: ...'` reason
 * (`okrProgressEngine.ts` L233-244) is a deliberate POLICY choice, not a
 * structurally-broken calculation — that case returns plain `null` ("—"),
 * never `'not_calculable'`, so this function never fabricates a distinction
 * the reason string does not support.
 */
export function parseOkrObjectiveProgress(progress: string | null, progressCalcReason: string | null): HonestValue<number> {
  if (progress !== null) {
    const parsed = Number(progress);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (progressCalcReason && progressCalcReason.startsWith(NOT_CALCULABLE_PREFIX)) return 'not_calculable';
  return null;
}

/**
 * Key Result-level progress — the KR is the DIRECT output of
 * `calculateKeyResultProgress` (no rollup, no policy-choice branch — see
 * `okrObjectiveApi.ts`'s `OkrKeyResultDto.progressCalcReason` doc comment),
 * so every `null` progress that carries a reason at all IS
 * `'not_calculable:'`-prefixed. Still checks the prefix explicitly (never
 * assumes) rather than treating "reason present" as sufficient.
 */
export function parseOkrKeyResultProgress(progress: string | null, progressCalcReason: string | null): HonestValue<number> {
  if (progress !== null) {
    const parsed = Number(progress);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (progressCalcReason && progressCalcReason.startsWith(NOT_CALCULABLE_PREFIX)) return 'not_calculable';
  return null;
}

/** Objective confidence rollup — same 3-way mechanism via
 * `confidenceCalcReason` (`okrProgressEngine.ts` L300-396's own
 * `not_calculable:`-prefixed reasons). Categorical, not numeric — no
 * `format` needed, the raw enum value doubles as the display value via
 * `okrObjectiveConfidenceLabel`. */
export function parseOkrObjectiveConfidence(
  confidence: OkrObjectiveConfidence | null,
  confidenceCalcReason: string | null
): HonestValue<OkrObjectiveConfidence> {
  if (confidence !== null) return confidence;
  if (confidenceCalcReason && confidenceCalcReason.startsWith(NOT_CALCULABLE_PREFIX)) return 'not_calculable';
  return null;
}

/** A plain optional numeric FIELD (baseline/target/start/current/range/
 * weight) — NOT a calculated result, so this is an honest 2-way parse only
 * (`null` = "not set"). Never a `'not_calculable'` branch: there is no
 * calculation here to be undefined. */
export function parseOkrNumericField(value: string | null): number | null {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatOkrProgressPercent(value: number, isPolish: boolean): string {
  return `${(value * 100).toLocaleString(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 1 })}%`;
}

export function formatOkrNumeric(value: number, isPolish: boolean, unit?: string | null): string {
  const formatted = value.toLocaleString(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 2 });
  return unit ? `${formatted} ${unit}` : formatted;
}
