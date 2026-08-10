/**
 * RN-G2 P3 #23 — OKR Set registry pure mapping helpers (status labels, lock
 * semantics, chip buckets, honest-value derivation, formatters). No React —
 * shared by `okrRegistryPresenters.tsx` (live Hub) and the dev-render mock
 * screen, mirroring `../roi/roiRegistryMappers.ts` exactly so both use the
 * SAME lock/label logic instead of two versions silently drifting.
 */
import type { HonestValue } from '../types';
import type { OkrSetAttentionState, OkrSetConfidence, OkrSetScopeType, OkrSetStatus } from './okrApi';

// ==========================================
// Status labels (PL/EN) — literal 10-state machine,
// `server/src/services/resultsVnext/okr/okrSetTypes.ts` L21-31 (OKR_E002/E004/E007
// design). Never invent an 11th state; never collapse two into one label.
// `not_required`/`required` are reserved, zero code path today (see okrApi.ts) —
// still given real labels so an exhaustive switch never silently falls through
// if a later epic ever reaches them.
// ==========================================

export const OKR_SET_STATUS_LABELS: Record<OkrSetStatus, { pl: string; en: string }> = {
  not_required: { pl: 'Niewymagany', en: 'Not required' },
  required: { pl: 'Wymagany', en: 'Required' },
  draft: { pl: 'Szkic', en: 'Draft' },
  submitted: { pl: 'Złożony do akceptacji', en: 'Submitted for approval' },
  changes_requested: { pl: 'Wymaga poprawek', en: 'Changes requested' },
  approved: { pl: 'Zaakceptowany', en: 'Approved' },
  active: { pl: 'Aktywny', en: 'Active' },
  review: { pl: 'Przegląd', en: 'Review' },
  closed: { pl: 'Zamknięty', en: 'Closed' },
  cancelled: { pl: 'Anulowany', en: 'Cancelled' },
};

export function okrSetStatusLabel(status: OkrSetStatus, isPolish: boolean): string {
  return isPolish ? OKR_SET_STATUS_LABELS[status].pl : OKR_SET_STATUS_LABELS[status].en;
}

export type OkrSetStatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const OKR_SET_STATUS_TONE: Record<OkrSetStatus, OkrSetStatusTone> = {
  not_required: 'neutral',
  required: 'neutral',
  draft: 'neutral',
  submitted: 'warning',
  changes_requested: 'warning',
  approved: 'success',
  active: 'success',
  review: 'info',
  closed: 'neutral',
  cancelled: 'danger',
};

// ==========================================
// Scope labels (PL/EN) — 4-value CHECK constraint, okrSetTypes.ts L17.
// ==========================================

export const OKR_SET_SCOPE_LABELS: Record<OkrSetScopeType, { pl: string; en: string }> = {
  company: { pl: 'Firma', en: 'Company' },
  business_unit: { pl: 'Jednostka biznesowa', en: 'Business unit' },
  team: { pl: 'Zespół', en: 'Team' },
  individual: { pl: 'Indywidualny', en: 'Individual' },
};

export function okrSetScopeLabel(scope: OkrSetScopeType, isPolish: boolean): string {
  return isPolish ? OKR_SET_SCOPE_LABELS[scope].pl : OKR_SET_SCOPE_LABELS[scope].en;
}

// ==========================================
// Confidence labels — `overallConfidence` is a CATEGORICAL enum
// (high/medium/low/numeric), not itself the honest-missing 3-way domain;
// only its ABSENCE is `null` ("—"). See `parseOkrConfidence` below for why
// there is no `'not_calculable'` branch for this field on the wire.
// ==========================================

export const OKR_SET_CONFIDENCE_LABELS: Record<OkrSetConfidence, { pl: string; en: string }> = {
  high: { pl: 'Wysoka', en: 'High' },
  medium: { pl: 'Średnia', en: 'Medium' },
  low: { pl: 'Niska', en: 'Low' },
  numeric: { pl: 'Liczbowa', en: 'Numeric' },
};

export function okrSetConfidenceLabel(confidence: OkrSetConfidence, isPolish: boolean): string {
  return isPolish ? OKR_SET_CONFIDENCE_LABELS[confidence].pl : OKR_SET_CONFIDENCE_LABELS[confidence].en;
}

export type OkrSetConfidenceTone = 'neutral' | 'success' | 'warning' | 'danger';

/** Confidence-as-signal tone (NOT the same map as status tone) — used only
 * for the preview's confidence pill, matching the intuitive "low confidence
 * reads as a warning" convention already established by `LifecycleLockBadge`
 * pairing a 'low' confidence value with the Set-rollup `attention_state`
 * ('watch') in `okrSetRollupCalculator.ts` L136 (`anyObjectiveLowConfidence`). */
export const OKR_SET_CONFIDENCE_TONE: Record<OkrSetConfidence, OkrSetConfidenceTone> = {
  high: 'success',
  medium: 'neutral',
  low: 'warning',
  numeric: 'neutral',
};

// ==========================================
// Attention-state labels — `okr_vnext_sets.attention_state`
// (okrSetTypes.ts L38). `action_required`/`escalated` are reserved: the
// current rollup calculator (`okrSetRollupCalculator.ts` L35-40) only ever
// emits `'none'`/`'watch'` (§-IO IO-5: no invented threshold), but both
// values are given real labels for the same exhaustiveness reason as the
// reserved statuses above.
// ==========================================

export const OKR_SET_ATTENTION_LABELS: Record<OkrSetAttentionState, { pl: string; en: string }> = {
  none: { pl: 'Brak', en: 'None' },
  watch: { pl: 'Obserwacja', en: 'Watch' },
  action_required: { pl: 'Wymaga działania', en: 'Action required' },
  escalated: { pl: 'Eskalowane', en: 'Escalated' },
};

export function okrSetAttentionLabel(state: OkrSetAttentionState, isPolish: boolean): string {
  return isPolish ? OKR_SET_ATTENTION_LABELS[state].pl : OKR_SET_ATTENTION_LABELS[state].en;
}

export const OKR_SET_ATTENTION_TONE: Record<OkrSetAttentionState, OkrSetConfidenceTone> = {
  none: 'neutral',
  watch: 'warning',
  action_required: 'danger',
  escalated: 'danger',
};

// ==========================================
// Lock semantics — mirrors `OKR_SET_DRAFT_EDITABLE_STATUSES`,
// server/src/services/resultsVnext/okr/okrSetCommands.ts L464 EXACTLY:
// `['draft', 'changes_requested']` is the only whitelist `updateOkrSetDraft`
// accepts (L508: `if (!OKR_SET_DRAFT_EDITABLE_STATUSES.includes(currentRow.status))
// throw ... 'NOT_EDITABLE'`). Every other status is locked for draft-field
// edits — this is the enforcement boundary, the UI only renders it honestly.
// (D6, cited in the server file: `'active'` content edits go through a
// SEPARATE command, `recordOkrSetMaterialChange` — out of scope for this
// registry package, so `active` is still locked from THIS package's own
// "Edit" action, with a reason that says so rather than pretending edit
// works.)
// ==========================================

export interface OkrSetLockInfo {
  label: { pl: string; en: string };
  reason: { pl: string; en: string };
}

const OKR_SET_LOCK_INFO: Partial<Record<OkrSetStatus, OkrSetLockInfo>> = {
  submitted: {
    label: { pl: 'Oczekuje na decyzję', en: 'Pending decision' },
    reason: {
      pl: 'Zestaw jest złożony do akceptacji — pola szkicu zablokowane do decyzji (approve/request-changes).',
      en: 'Set is submitted for approval — draft fields are locked until a decision is made (approve/request-changes).',
    },
  },
  approved: {
    label: { pl: 'Zaakceptowany', en: 'Approved' },
    reason: {
      pl: 'Zestaw zaakceptowany — pola szkicu zablokowane; kolejny krok to publikacja (aktywacja).',
      en: 'Set approved — draft fields are locked; the next step is publishing (activate).',
    },
  },
  active: {
    label: { pl: 'Aktywny', en: 'Active' },
    reason: {
      pl: 'Zestaw aktywny — edycja pól szkicu z tego rejestru niedostępna; zmiany treści idą przez osobny mechanizm rewizji (poza zakresem tego pakietu).',
      en: 'Set is active — editing draft fields from this registry is unavailable; content changes go through a separate revision mechanism (out of scope for this package).',
    },
  },
  review: {
    label: { pl: 'Przegląd', en: 'Review' },
    reason: {
      pl: 'Zestaw w fazie przeglądu — pola szkicu zablokowane.',
      en: 'Set is in review — draft fields are locked.',
    },
  },
  closed: {
    label: { pl: 'Zamknięty', en: 'Closed' },
    reason: {
      pl: 'Zestaw zamknięty — stan końcowy, tylko odczyt.',
      en: 'Set is closed — terminal state, read-only.',
    },
  },
  cancelled: {
    label: { pl: 'Anulowany', en: 'Cancelled' },
    reason: {
      pl: 'Zestaw anulowany trwale — tylko odczyt.',
      en: 'Set is permanently cancelled — read-only.',
    },
  },
  not_required: {
    label: { pl: 'Niewymagany', en: 'Not required' },
    reason: {
      pl: 'Stan zarezerwowany — żadna komenda w tym backendzie go dziś nie ustawia (brak ścieżki kodu w OKR-E002).',
      en: 'Reserved state — no command in this backend sets it today (no OKR-E002 code path).',
    },
  },
  required: {
    label: { pl: 'Wymagany', en: 'Required' },
    reason: {
      pl: 'Stan zarezerwowany — żadna komenda w tym backendzie go dziś nie ustawia (brak ścieżki kodu w OKR-E002).',
      en: 'Reserved state — no command in this backend sets it today (no OKR-E002 code path).',
    },
  },
};

export function getOkrSetLockInfo(status: OkrSetStatus): OkrSetLockInfo | null {
  return OKR_SET_LOCK_INFO[status] ?? null;
}

export function isOkrSetLocked(status: OkrSetStatus): boolean {
  return OKR_SET_LOCK_INFO[status] !== undefined;
}

// ==========================================
// Menu 3 chip buckets — grounded in the real 10-status machine (never a
// fabricated bucketing scheme). Every status falls into EXACTLY one bucket.
// `not_required`/`required` bucket into `in_progress` alongside `draft` —
// they are pre-draft/reserved states, never a real "closed" outcome; there
// is no evidence in any design doc for a 5th bucket just for two unreachable
// states, so folding them into the nearest honest neighbor (rather than
// inventing a "reserved" bucket nobody asked for) is the conservative call.
// ==========================================

export type OkrSetStatusBucket = 'in_progress' | 'in_review' | 'active' | 'closed_out';

export const OKR_SET_STATUS_BUCKET: Record<OkrSetStatus, OkrSetStatusBucket> = {
  not_required: 'in_progress',
  required: 'in_progress',
  draft: 'in_progress',
  changes_requested: 'in_progress',
  submitted: 'in_review',
  approved: 'active',
  active: 'active',
  review: 'active',
  closed: 'closed_out',
  cancelled: 'closed_out',
};

export const OKR_SET_STATUS_BUCKET_LABEL: Record<OkrSetStatusBucket, { pl: string; en: string }> = {
  in_progress: { pl: 'W toku', en: 'In progress' },
  in_review: { pl: 'Do akceptacji', en: 'In review' },
  active: { pl: 'Aktywne', en: 'Active' },
  closed_out: { pl: 'Zamknięte / anulowane', en: 'Closed / cancelled' },
};

// ==========================================
// Honest-value derivation — `overallProgress`/`overallConfidence`
// ==========================================

/**
 * `OPEN QUESTION, resolved by reading the code (not assumed)`: RN_G2_UI_SCOPE.md
 * §D and this program's own invariant docs (EXECUTION_LEDGER.md L132,
 * OKR_E006_DESIGN.md L16 IO-5) describe OKR progress/confidence as a 3-way
 * `decimal | null | 'not_calculable'` domain. That IS true one layer down,
 * INSIDE the calculation engine (`okrProgressEngine.ts`,
 * `okrSetRollupCalculator.ts` — every `reason` string there is literally
 * prefixed `not_calculable: ...` for a structurally-undefined case).
 *
 * It is NOT true at the `okr_vnext_sets` PERSISTED/API level this registry
 * reads: `overall_progress` is `NUMERIC NULL` (migration
 * `20260823_rvn_okr_set.sql` L74), `okrCheckInCommands.ts` L280-287 persists
 * ONLY `rollup.overallProgress`/`rollup.overallConfidence` (both already
 * `T | null` by the time they reach the UPDATE) — the calculator's own
 * `reason` string (which is where the `not_calculable` distinction actually
 * lives) is NEVER written to the Set row and has no GET endpoint anywhere
 * in `okr.routes.ts`. So `null` here can mean EITHER "no check-in/objective
 * ever rolled up a value" OR "a rollup ran and was structurally
 * not_calculable" — the wire genuinely cannot distinguish the two for a
 * Set. This is a REAL, CITED backend gap, not something to paper over by
 * fabricating a `'not_calculable'` sentinel the API never sends (that would
 * be exactly the "invented value with a free parameter" IO-5 forbids, just
 * inverted — inventing a DISTINCTION instead of a NUMBER). `parseOkrProgress`
 * therefore returns the honest 2-way domain the wire actually carries;
 * `HonestValueCell` is still the right rendering primitive (it degrades
 * cleanly to its `null` branch), but its `'not_calculable'` branch is
 * unreachable from real API data for this specific field today.
 */
export function parseOkrProgress(value: string | null): HonestValue<number> {
  if (value === null) return null;
  const parsed = Number(value);
  // A non-numeric string from the wire is itself a structurally-broken
  // response, not "no data" — but since the server's own CHECK constraint
  // is `NUMERIC`, this branch is defensive only (never fabricate a `0`).
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatOkrProgressPercent(value: number, isPolish: boolean): string {
  return `${value.toLocaleString(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 1 })}%`;
}

// ==========================================
// Formatters
// ==========================================

export function formatOkrDate(value: string | null, isPolish: boolean): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

/** Short id fallback for `ownerUserId`/`reviewerUserId` — same convention
 * `ResultsKpiRegistryPage.tsx`'s own `shortId` helper uses (no user-directory
 * lookup exists in this small client, per the same "don't hand-write 200
 * endpoint wrappers" scope boundary as `okrApi.ts`'s own header note). */
export function shortOkrId(id: string | null): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}
