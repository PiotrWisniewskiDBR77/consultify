/**
 * RN-G2 P2 — ROI registry pure mapping helpers (status labels, lock
 * semantics, chip buckets, honest-value derivation, formatters). No React —
 * shared by `roiRegistryPresenters.tsx` (live Hub) and the dev-render mock
 * screen, so both use the SAME lock/label logic instead of two versions
 * silently drifting.
 */
import type { HonestValue } from '../types';
import type { RoiCalculationRunSummary, RoiCaseStatus, RoiIrrStatus } from './roiApi';

// ==========================================
// Status labels (PL/EN) — literal 13-state machine, ROI_E001_DESIGN.md L104-109.
// Never invent a 14th state; never collapse two into one label.
// ==========================================

export const ROI_STATUS_LABELS: Record<RoiCaseStatus, { pl: string; en: string }> = {
  not_started: { pl: 'Nierozpoczęty', en: 'Not started' },
  draft: { pl: 'Szkic', en: 'Draft' },
  modeling: { pl: 'Modelowanie', en: 'Modeling' },
  ready_for_review: { pl: 'Gotowy do przeglądu', en: 'Ready for review' },
  submitted_for_approval: { pl: 'Złożony do akceptacji', en: 'Submitted for approval' },
  changes_requested: { pl: 'Wymaga poprawek', en: 'Changes requested' },
  approved: { pl: 'Zaakceptowany', en: 'Approved' },
  rejected: { pl: 'Odrzucony', en: 'Rejected' },
  tracking: { pl: 'Śledzenie realizacji', en: 'Tracking' },
  benefits_realization: { pl: 'Realizacja korzyści', en: 'Benefits realization' },
  post_investment_review_due: { pl: 'PIR do wykonania', en: 'PIR due' },
  post_investment_review: { pl: 'Przegląd poinwestycyjny', en: 'Post-investment review' },
  closed: { pl: 'Zamknięty', en: 'Closed' },
  cancelled: { pl: 'Anulowany', en: 'Cancelled' },
};

export function roiStatusLabel(status: RoiCaseStatus, isPolish: boolean): string {
  return isPolish ? ROI_STATUS_LABELS[status].pl : ROI_STATUS_LABELS[status].en;
}

export type RoiStatusTone = 'neutral' | 'info' | 'warning' | 'success' | 'danger';

export const ROI_STATUS_TONE: Record<RoiCaseStatus, RoiStatusTone> = {
  not_started: 'neutral',
  draft: 'neutral',
  modeling: 'info',
  ready_for_review: 'info',
  submitted_for_approval: 'warning',
  changes_requested: 'warning',
  approved: 'success',
  rejected: 'danger',
  tracking: 'success',
  benefits_realization: 'success',
  post_investment_review_due: 'warning',
  post_investment_review: 'info',
  closed: 'neutral',
  cancelled: 'danger',
};

// ==========================================
// Lock semantics — mirrors `NON_EDITABLE_STATUSES`,
// server/src/services/resultsVnext/roi/roiCaseCommands.ts L492-506, EXACTLY.
// A status appears here IF AND ONLY IF it is in that server-side list — this
// is the enforcement boundary, the UI only has to render it honestly.
// ==========================================

export interface RoiCaseLockInfo {
  label: { pl: string; en: string };
  reason: { pl: string; en: string };
}

const ROI_LOCK_INFO: Partial<Record<RoiCaseStatus, RoiCaseLockInfo>> = {
  submitted_for_approval: {
    label: { pl: 'Oczekuje na decyzję', en: 'Pending decision' },
    reason: {
      pl: 'Sprawa jest złożona do akceptacji — edycja wstrzymana do decyzji.',
      en: 'Case is submitted for approval — editing is paused until a decision is made.',
    },
  },
  approved: {
    label: { pl: 'Zaakceptowany — zamrożony', en: 'Approved — frozen' },
    reason: {
      pl: 'Sprawa zaakceptowana — baseline i model ekonomiczny są zamrożone (migawka akceptacji).',
      en: 'Approved case — baseline and economic model are frozen (approval snapshot taken).',
    },
  },
  rejected: {
    label: { pl: 'Odrzucony', en: 'Rejected' },
    reason: {
      pl: 'Sprawa odrzucona — otwórz ponownie do rewizji, aby edytować.',
      en: 'Rejected — reopen for revision to edit again.',
    },
  },
  tracking: {
    label: { pl: 'Zamrożony (śledzenie)', en: 'Frozen (tracking)' },
    reason: {
      pl: 'Baseline i model ekonomiczny pozostają zamrożone podczas śledzenia realizacji.',
      en: 'Baseline and economic model remain frozen during tracking.',
    },
  },
  benefits_realization: {
    label: { pl: 'Zamrożony (realizacja)', en: 'Frozen (realization)' },
    reason: {
      pl: 'Baseline i model ekonomiczny pozostają zamrożone w fazie realizacji korzyści.',
      en: 'Baseline and economic model remain frozen during benefits realization.',
    },
  },
  post_investment_review_due: {
    label: { pl: 'Zamrożony (PIR)', en: 'Frozen (PIR)' },
    reason: {
      pl: 'Baseline i model ekonomiczny pozostają zamrożone do czasu przeglądu poinwestycyjnego.',
      en: 'Baseline and economic model remain frozen pending post-investment review.',
    },
  },
  post_investment_review: {
    label: { pl: 'Zamrożony (PIR)', en: 'Frozen (PIR)' },
    reason: {
      pl: 'Baseline i model ekonomiczny pozostają zamrożone w trakcie przeglądu poinwestycyjnego.',
      en: 'Baseline and economic model remain frozen during post-investment review.',
    },
  },
  closed: {
    label: { pl: 'Zamknięty', en: 'Closed' },
    reason: {
      pl: 'Sprawa zamknięta — rekord jest tylko do odczytu.',
      en: 'Case is closed — the record is read-only.',
    },
  },
  cancelled: {
    label: { pl: 'Anulowany', en: 'Cancelled' },
    reason: {
      pl: 'Sprawa anulowana trwale — rekord jest tylko do odczytu.',
      en: 'Case is permanently cancelled — the record is read-only.',
    },
  },
};

export function getRoiCaseLockInfo(status: RoiCaseStatus): RoiCaseLockInfo | null {
  return ROI_LOCK_INFO[status] ?? null;
}

export function isRoiCaseLocked(status: RoiCaseStatus): boolean {
  return ROI_LOCK_INFO[status] !== undefined;
}

// ==========================================
// Menu 3 chip buckets — grounded in the real 13-state machine (never a
// fabricated bucketing scheme). Every case falls into EXACTLY one bucket.
// ==========================================

export type RoiStatusBucket = 'in_progress' | 'in_review' | 'active' | 'closed_out';

export const ROI_STATUS_BUCKET: Record<RoiCaseStatus, RoiStatusBucket> = {
  not_started: 'in_progress',
  draft: 'in_progress',
  modeling: 'in_progress',
  ready_for_review: 'in_progress',
  changes_requested: 'in_progress',
  submitted_for_approval: 'in_review',
  approved: 'active',
  tracking: 'active',
  benefits_realization: 'active',
  post_investment_review_due: 'active',
  post_investment_review: 'active',
  closed: 'closed_out',
  cancelled: 'closed_out',
  rejected: 'closed_out',
};

export const ROI_STATUS_BUCKET_LABEL: Record<RoiStatusBucket, { pl: string; en: string }> = {
  in_progress: { pl: 'W toku', en: 'In progress' },
  in_review: { pl: 'Do akceptacji', en: 'In review' },
  active: { pl: 'Aktywne', en: 'Active' },
  closed_out: { pl: 'Zamknięte / odrzucone', en: 'Closed / rejected' },
};

// ==========================================
// Honest-value derivation from a calculation run — the actual point of this
// package (RN_G2_UI_SCOPE.md §D). NEVER a fabricated 0.
// ==========================================

/**
 * NPV: `run.npv` is `number | null` on the wire, but a `'failed'` run status
 * means the engine could not produce a result at all — that is the
 * `'not_calculable'` case (data exists — a run was attempted — but the
 * formula/inputs were structurally unusable), distinct from `run === null`
 * ("no calculation has ever been run for this case", i.e. "no data was ever
 * entered", which renders as `null` → "—").
 */
export function deriveNpvHonestValue(run: RoiCalculationRunSummary | null): HonestValue<number> {
  if (!run) return null;
  if (run.status === 'failed') return 'not_calculable';
  return run.npv;
}

/**
 * IRR: the engine itself models "not calculable" as a dedicated `irrStatus`
 * enum (`ROI_IRR_STATUSES`, roiEconomicModelTypes.ts L48) rather than
 * overloading `irrPct` — `irrStatus !== 'computed'` IS the `'not_calculable'`
 * case by construction (no sign change in cash flows, IRR not required by
 * calculation policy, or not applicable to this case shape).
 */
export function deriveIrrHonestValue(run: RoiCalculationRunSummary | null): HonestValue<number> {
  if (!run) return null;
  if (run.status === 'failed') return 'not_calculable';
  if (run.irrStatus !== 'computed') return 'not_calculable';
  return run.irrPct;
}

export const ROI_IRR_STATUS_REASON: Record<Exclude<RoiIrrStatus, 'computed'>, { pl: string; en: string }> = {
  not_applicable: {
    pl: 'IRR nie ma zastosowania do kształtu przepływów tej sprawy.',
    en: 'IRR is not applicable to this case’s cash-flow shape.',
  },
  no_sign_change: {
    pl: 'Brak zmiany znaku w przepływach pieniężnych — IRR strukturalnie nieokreślone.',
    en: 'No sign change in the cash flows — IRR is structurally undefined.',
  },
  not_required_by_policy: {
    pl: 'Polityka kalkulacji tej sprawy nie wymaga liczenia IRR.',
    en: 'This case’s calculation policy does not require IRR.',
  },
};

export function irrNotCalculableReason(run: RoiCalculationRunSummary | null, isPolish: boolean): string {
  if (!run) return isPolish ? 'Brak jeszcze żadnego przebiegu kalkulacji.' : 'No calculation run yet.';
  if (run.status === 'failed') {
    return isPolish
      ? 'Ostatni przebieg kalkulacji zakończył się niepowodzeniem.'
      : 'The latest calculation run failed.';
  }
  if (run.irrStatus !== 'computed') {
    const copy = ROI_IRR_STATUS_REASON[run.irrStatus as Exclude<RoiIrrStatus, 'computed'>];
    return isPolish ? copy.pl : copy.en;
  }
  return isPolish ? 'Nie do obliczenia.' : 'Not calculable.';
}

export function npvNotCalculableReason(run: RoiCalculationRunSummary | null, isPolish: boolean): string {
  if (!run) return isPolish ? 'Brak jeszcze żadnego przebiegu kalkulacji.' : 'No calculation run yet.';
  if (run.status === 'failed') {
    return isPolish
      ? 'Ostatni przebieg kalkulacji zakończył się niepowodzeniem — sprawdź ustalenia walidacji.'
      : 'The latest calculation run failed — see validation findings.';
  }
  return isPolish ? 'Nie do obliczenia.' : 'Not calculable.';
}

// ==========================================
// paybackPeriods — from the calculation run (forecast side). NOTE: this is
// NOT the same slot as the Actual-vs-Forecast comparison's `paybackPeriods`,
// which `roiCompareRepository.ts` documents as a PERMANENT gap ("ACTUAL
// slot is a DOCUMENTED, permanent gap, not a bug" — `rvn_roi_actual_snapshots`
// stores no `payback_periods` column). The registry preview only ever reads
// the calculation run's own value, which IS available — the Actual-side gap
// belongs to a later Actuals/Variance package (RN_G2_UI_SCOPE.md §G #18/#19),
// not this one.
// ==========================================
export function derivePaybackHonestValue(run: RoiCalculationRunSummary | null): HonestValue<number> {
  if (!run) return null;
  if (run.status === 'failed') return 'not_calculable';
  return run.paybackPeriods;
}

// ==========================================
// Formatters
// ==========================================

/**
 * Locale follows `isPolish` — matches the repo convention already
 * established by the sibling P1 KPI registry (`ResultsKpiRegistryPage.tsx`
 * L255/L305: `const lang = ctx.isPolish ? 'pl-PL' : 'en-US'` /
 * `v.toLocaleString(lang)`) and by `formatRoiDate` below in this very file.
 * A hardcoded `'en-US'` here (pre-fix) meant PL sessions still saw
 * "1,234" instead of "1 234" — silently inconsistent with every other
 * RN-G2 number/date formatter (RN-G2 P2 QA 2026-08-10 fix).
 */
export function formatRoiCurrency(value: number, currency: string, isPolish: boolean): string {
  const locale = isPolish ? 'pl-PL' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    // Unknown/invalid ISO currency code from free-text case data — never throw
    // in a table cell over a formatting edge case.
    return `${value.toLocaleString(locale)} ${currency}`;
  }
}

/**
 * Plain thousands-separated number, NO currency symbol — used for
 * `GET /org/benefits-realization` amounts, which the server does not join a
 * `currency` column onto (`roiOrgPerspectiveRepository.ts` `listOrganizationRoiBenefitsRealization`
 * selects `case_id`/`title`/`status`/the two benefit amounts only). Fabricating
 * a currency symbol from the case's own list-row `currency` would silently
 * conflate a value from a DIFFERENT endpoint/query — this formatter is the
 * honest choice for that data source specifically.
 */
export function formatRoiNumber(value: number, isPolish: boolean): string {
  return value.toLocaleString(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 0 });
}

export function formatRoiPercent(value: number, isPolish: boolean): string {
  return `${value.toLocaleString(isPolish ? 'pl-PL' : 'en-US', { maximumFractionDigits: 1 })}%`;
}

export function formatRoiDate(value: string | null, isPolish: boolean): string {
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

// ==========================================
// Lifecycle transition eligibility — RN-G2 quick-create+transitions package.
// The 7 transitions this package is scoped to (RN_G2_UI_SCOPE.md §G #16
// subset): approve/reject/request-changes/reopen-for-revision/cancel/
// start-pir/close. EVERY "from" status below is copied verbatim from the
// server's own status guard, NOT inferred/invented — citations point at the
// exact guard line so a reviewer can diff this table against the code:
//
// PLUS (RN-G6-C2) start_modeling/ready_for_review — see `roiApi.ts`'s
// header comment on `startModelingRoiCase`/`markRoiCaseReadyForReview` for
// why these two were added: the endpoints existed server-side but had no
// frontend caller, leaving every newly-created case permanently stuck in
// `draft` with no UI path to a calculation-run-eligible status.
//
//  - start-modeling     : status !== 'draft' → reject
//                          `server/src/services/resultsVnext/roi/roiCaseCommands.ts` L977 (fromStatuses)
//  - ready-for-review    : status !== 'modeling' → reject (+ economic-model guard:
//                          successful/fresh calc run, no unresolved double-counting)
//                          same file L991-999
//  - approve            : status !== 'submitted_for_approval' → reject
//                          `server/src/services/resultsVnext/roi/roiCaseApprovalCommands.ts` L347
//  - reject              : status !== 'submitted_for_approval' → reject
//                          same file L647
//  - request-changes     : status !== 'submitted_for_approval' → reject
//                          same file L747
//  - reopen-for-revision : status !== 'approved' → reject
//                          same file L849
//  - cancel              : status not in ROI_TRACKING_ACTIVE_STATUSES → reject
//                          `server/src/services/resultsVnext/roi/roiBenefitsRealizationCommands.ts` L244,
//                          ROI_TRACKING_ACTIVE_STATUSES = ['tracking','benefits_realization',
//                          'post_investment_review_due','post_investment_review']
//                          (`server/src/services/resultsVnext/roi/roiCaseCommands.ts` L512-517)
//  - start-pir           : status !== 'post_investment_review_due' → reject
//                          `server/src/services/resultsVnext/roi/roiPirCommands.ts` L437
//  - close               : status !== 'post_investment_review' → reject
//                          same file L977
//
// Runtime-only guards this table CANNOT express (never fake them as a
// status check): `approve` also 403s on self-approval (approver ===
// submitted_by or created_by, roiCaseApprovalCommands.ts L336-344) — the
// registry list payload carries neither field, so that denial can only be
// surfaced honestly AFTER a real 403 response, never pre-computed here.
// ==========================================

export type RoiTransitionId =
  | 'start_modeling'
  | 'ready_for_review'
  | 'approve'
  | 'reject'
  | 'request_changes'
  | 'reopen_for_revision'
  | 'cancel'
  | 'start_pir'
  | 'close';

export interface RoiTransitionDefinition {
  id: RoiTransitionId;
  label: { pl: string; en: string };
  /** Statuses the server accepts this transition FROM — verbatim from the
   * guard cited above, never widened/narrowed here. */
  fromStatuses: readonly RoiCaseStatus[];
  /** `true` ⇒ the reason/notes field is REQUIRED by the server schema
   * (min-length-1 Zod field) and the UI must never submit it empty. */
  reasonRequired: boolean;
  /** Copy shown when disabled because the case's CURRENT status is not in
   * `fromStatuses` — i.e. "the state machine doesn't allow this from here",
   * distinct from a permissions denial. */
  disabledReason: { pl: string; en: string };
}

/** Client-side mirror of `ROI_TRACKING_ACTIVE_STATUSES`
 * (`server/src/services/resultsVnext/roi/roiCaseCommands.ts` L512-517) —
 * copied verbatim, not re-derived, so a server-side change to that array is
 * the only place this can silently drift from (same "mirrors the server
 * array exactly" convention `ROI_LOCK_INFO` above already uses for
 * `NON_EDITABLE_STATUSES`). */
const ROI_TRACKING_ACTIVE_STATUSES_FOR_TRANSITIONS: readonly RoiCaseStatus[] = [
  'tracking',
  'benefits_realization',
  'post_investment_review_due',
  'post_investment_review',
];

export const ROI_TRANSITIONS: Record<RoiTransitionId, RoiTransitionDefinition> = {
  start_modeling: {
    id: 'start_modeling',
    label: { pl: 'Rozpocznij modelowanie', en: 'Start modeling' },
    fromStatuses: ['draft'],
    reasonRequired: false,
    disabledReason: {
      pl: 'Rozpoczęcie modelowania dostępne tylko dla sprawy w statusie „Szkic”.',
      en: 'Starting modeling is only available for a case in Draft status.',
    },
  },
  ready_for_review: {
    id: 'ready_for_review',
    label: { pl: 'Oznacz jako gotowe do przeglądu', en: 'Mark ready for review' },
    fromStatuses: ['modeling'],
    reasonRequired: false,
    disabledReason: {
      pl: 'Dostępne tylko w statusie „Modelowanie”, po udanym przebiegu kalkulacji.',
      en: 'Only available while Modeling, after a successful calculation run.',
    },
  },
  approve: {
    id: 'approve',
    label: { pl: 'Zaakceptuj', en: 'Approve' },
    fromStatuses: ['submitted_for_approval'],
    reasonRequired: false,
    disabledReason: {
      pl: 'Akceptacja dostępna tylko dla sprawy złożonej do akceptacji.',
      en: 'Approval is only available for a case submitted for approval.',
    },
  },
  reject: {
    id: 'reject',
    label: { pl: 'Odrzuć', en: 'Reject' },
    fromStatuses: ['submitted_for_approval'],
    reasonRequired: true,
    disabledReason: {
      pl: 'Odrzucenie dostępne tylko dla sprawy złożonej do akceptacji.',
      en: 'Rejection is only available for a case submitted for approval.',
    },
  },
  request_changes: {
    id: 'request_changes',
    label: { pl: 'Poproś o poprawki', en: 'Request changes' },
    fromStatuses: ['submitted_for_approval'],
    reasonRequired: true,
    disabledReason: {
      pl: 'Prośba o poprawki dostępna tylko dla sprawy złożonej do akceptacji.',
      en: 'Requesting changes is only available for a case submitted for approval.',
    },
  },
  reopen_for_revision: {
    id: 'reopen_for_revision',
    label: { pl: 'Otwórz ponownie do rewizji', en: 'Reopen for revision' },
    fromStatuses: ['approved'],
    reasonRequired: true,
    disabledReason: {
      pl: 'Ponowne otwarcie do rewizji dostępne tylko dla sprawy zaakceptowanej.',
      en: 'Reopening for revision is only available for an approved case.',
    },
  },
  cancel: {
    id: 'cancel',
    label: { pl: 'Anuluj sprawę', en: 'Cancel case' },
    fromStatuses: ROI_TRACKING_ACTIVE_STATUSES_FOR_TRANSITIONS,
    reasonRequired: true,
    disabledReason: {
      pl: 'Anulowanie dostępne tylko dla sprawy, która rozpoczęła śledzenie realizacji.',
      en: 'Cancellation is only available for a case that has started tracking.',
    },
  },
  start_pir: {
    id: 'start_pir',
    label: { pl: 'Rozpocznij PIR', en: 'Start PIR' },
    fromStatuses: ['post_investment_review_due'],
    reasonRequired: false,
    disabledReason: {
      pl: 'Rozpoczęcie przeglądu poinwestycyjnego dostępne tylko, gdy PIR jest do wykonania.',
      en: 'Starting the post-investment review is only available when a PIR is due.',
    },
  },
  close: {
    id: 'close',
    label: { pl: 'Zamknij sprawę', en: 'Close case' },
    fromStatuses: ['post_investment_review'],
    reasonRequired: false,
    disabledReason: {
      pl: 'Zamknięcie dostępne tylko w trakcie przeglądu poinwestycyjnego.',
      en: 'Closing is only available during the post-investment review.',
    },
  },
};

export function isRoiTransitionAllowedFromStatus(
  transitionId: RoiTransitionId,
  status: RoiCaseStatus
): boolean {
  return ROI_TRANSITIONS[transitionId].fromStatuses.includes(status);
}

/** Humanizes a free-form `next_action_type` slug (e.g. `conduct_post_investment_review`
 * → "Conduct post investment review") — no exhaustive translation table exists
 * server-side for this field (it's a status-machine side-effect string, not a
 * closed enum), so a generic humanizer is the honest choice over guessing PL
 * copy for values that may grow over time. */
export function humanizeActionType(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
