/**
 * RN-G3 lane `okr` (2026-08-11) — pure mapping/label/gate helpers for the
 * full OKR tool's workspace tabs (Overview/Alignment/Support/Review &
 * Reflection/History). No React — mirrors `okrRegistryMappers.ts`'s own
 * split (labels/tones/lock-gates/formatters, zero side effects).
 *
 * ── Set lifecycle gate table — every fact below is a literal citation, not
 * an inference. `plik:linia` refers to the SHA this lane started from
 * (`0b161c7719`), server files (read-only, out of allowlist for this lane —
 * "jesteś klientem"):
 *  - submit:        fromStatuses ['draft','changes_requested'] -> 'submitted'
 *                    (okrSetCommands.ts:761,799)
 *  - approve:        requires status === 'submitted' (okrSetCommands.ts:955-960);
 *                    self-approval denied if approver === submitted_by OR
 *                    created_by (okrSetCommands.ts:948-953)
 *  - request-changes: requires status === 'submitted' -> 'changes_requested'
 *                    (okrSetCommands.ts:1083-1088)
 *  - activate:       OKR_SET_ACTIVATE_SPEC fromStatuses ['approved'] -> 'active'
 *                    (okrSetCommands.ts:1255-1259)
 *  - cancel:         OKR_SET_CANCEL_SPEC fromStatuses
 *                    ['draft','submitted','changes_requested','approved','active']
 *                    -> 'cancelled' (okrSetCommands.ts:1266-1270)
 *  - open-review:    OKR_SET_OPEN_REVIEW_SPEC fromStatuses ['active'] -> 'review'
 *                    (okrSetCommands.ts:1278-1282)
 *  - close:          requires status === 'review' (okrSetCommands.ts:1366-1372);
 *                    if Program policy `managerReviewRequired`, a 'manager'
 *                    review with status 'approved' must exist
 *                    (okrSetCommands.ts:1378-1387); if `selfReviewRequired`, a
 *                    'self' review with status 'submitted' must exist
 *                    (okrSetCommands.ts:1390-1399); if
 *                    `reflectionRequiredForClose`, EVERY non-cancelled
 *                    Objective needs a reflection row with (finalScore set OR
 *                    scoringModelUnsupported) AND all five narrative fields
 *                    (whatWorked/whatDidNotWork/why/learning/nextCycleChange)
 *                    AND disposition non-null (okrSetCommands.ts:1402-1425)
 *  - carry-forward:  requires SOURCE status === 'closed'
 *                    (okrCarryForwardCommands.ts:89-95)
 *  - self-review submit:    only the Set's own owner_user_id may submit
 *                    (okrReviewCommands.ts:269-276); expectedVersion 0 = create
 *  - manager-review submit: requires reviewer_user_id assigned on the Set
 *                    (okrReviewCommands.ts:422-429); expectedVersion 0 = create
 *  - manager-review approve: self-approval denied if actor === submitted_by,
 *                    owner_user_id, OR created_by (okrReviewCommands.ts:579-587)
 *
 * These are NOT re-derived/guessed client-side beyond what is stated here —
 * every gate the workspace UI enforces client-side (disabling a button with
 * a reason, per TRIADA §C3) traces to one of the citations above. The
 * SERVER remains the actual enforcement point in every case (client gating
 * is UX only, never the security boundary).
 */
import type { OkrSetDto, OkrSetStatus } from './okrApi';
import { okrSetStatusLabel } from './okrRegistryMappers';
import type {
  OkrAlignmentStatus,
  OkrRecognitionVisibility,
  OkrReflectionDisposition,
  OkrReviewStatus,
  OkrReviewType,
  OkrSupportRequestKind,
  OkrSupportRequestStatus,
} from './okrWorkspaceApi';

// ==========================================
// Alignment labels
// ==========================================

export const OKR_ALIGNMENT_STATUS_LABELS: Record<OkrAlignmentStatus, { pl: string; en: string }> = {
  proposed: { pl: 'Zaproponowane', en: 'Proposed' },
  accepted: { pl: 'Zaakceptowane', en: 'Accepted' },
  rejected: { pl: 'Odrzucone', en: 'Rejected' },
  removed: { pl: 'Usunięte', en: 'Removed' },
};
export function okrAlignmentStatusLabel(status: OkrAlignmentStatus, isPolish: boolean): string {
  return isPolish ? OKR_ALIGNMENT_STATUS_LABELS[status].pl : OKR_ALIGNMENT_STATUS_LABELS[status].en;
}
export type OkrAlignmentStatusTone = 'neutral' | 'warning' | 'success' | 'danger';
export const OKR_ALIGNMENT_STATUS_TONE: Record<OkrAlignmentStatus, OkrAlignmentStatusTone> = {
  proposed: 'warning',
  accepted: 'success',
  rejected: 'danger',
  removed: 'neutral',
};

// ==========================================
// Review labels
// ==========================================

export const OKR_REVIEW_TYPE_LABELS: Record<OkrReviewType, { pl: string; en: string }> = {
  self: { pl: 'Samoocena', en: 'Self-review' },
  manager: { pl: 'Ocena managera', en: 'Manager review' },
};
export function okrReviewTypeLabel(type: OkrReviewType, isPolish: boolean): string {
  return isPolish ? OKR_REVIEW_TYPE_LABELS[type].pl : OKR_REVIEW_TYPE_LABELS[type].en;
}
export const OKR_REVIEW_STATUS_LABELS: Record<OkrReviewStatus, { pl: string; en: string }> = {
  draft: { pl: 'Szkic', en: 'Draft' },
  submitted: { pl: 'Złożona', en: 'Submitted' },
  approved: { pl: 'Zaakceptowana', en: 'Approved' },
  changes_requested: { pl: 'Wymaga poprawek', en: 'Changes requested' },
};
export function okrReviewStatusLabel(status: OkrReviewStatus, isPolish: boolean): string {
  return isPolish ? OKR_REVIEW_STATUS_LABELS[status].pl : OKR_REVIEW_STATUS_LABELS[status].en;
}
export type OkrReviewStatusTone = 'neutral' | 'warning' | 'success';
export const OKR_REVIEW_STATUS_TONE: Record<OkrReviewStatus, OkrReviewStatusTone> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  changes_requested: 'warning',
};

// ==========================================
// Reflection disposition labels
// ==========================================

export const OKR_REFLECTION_DISPOSITION_LABELS: Record<OkrReflectionDisposition, { pl: string; en: string }> = {
  complete: { pl: 'Zrealizowany', en: 'Complete' },
  carry_forward: { pl: 'Przenieś dalej', en: 'Carry forward' },
  drop: { pl: 'Porzuć', en: 'Drop' },
  redefine: { pl: 'Przedefiniuj', en: 'Redefine' },
};
export function okrReflectionDispositionLabel(d: OkrReflectionDisposition, isPolish: boolean): string {
  return isPolish ? OKR_REFLECTION_DISPOSITION_LABELS[d].pl : OKR_REFLECTION_DISPOSITION_LABELS[d].en;
}

// ==========================================
// Support/recognition labels
// ==========================================

export const OKR_SUPPORT_KIND_LABELS: Record<OkrSupportRequestKind, { pl: string; en: string }> = {
  comment: { pl: 'Komentarz', en: 'Comment' },
  recognition: { pl: 'Uznanie', en: 'Recognition' },
  support_request: { pl: 'Prośba o wsparcie', en: 'Support request' },
};
export function okrSupportKindLabel(kind: OkrSupportRequestKind, isPolish: boolean): string {
  return isPolish ? OKR_SUPPORT_KIND_LABELS[kind].pl : OKR_SUPPORT_KIND_LABELS[kind].en;
}
export const OKR_SUPPORT_STATUS_LABELS: Record<OkrSupportRequestStatus, { pl: string; en: string }> = {
  open: { pl: 'Otwarta', en: 'Open' },
  acknowledged: { pl: 'Przyjęta do wiadomości', en: 'Acknowledged' },
  resolved: { pl: 'Rozwiązana', en: 'Resolved' },
  dismissed: { pl: 'Odrzucona', en: 'Dismissed' },
};
export function okrSupportStatusLabel(status: OkrSupportRequestStatus | null, isPolish: boolean): string {
  if (!status) return '—';
  return isPolish ? OKR_SUPPORT_STATUS_LABELS[status].pl : OKR_SUPPORT_STATUS_LABELS[status].en;
}
export type OkrSupportStatusTone = 'neutral' | 'warning' | 'success' | 'danger';
export const OKR_SUPPORT_STATUS_TONE: Record<OkrSupportRequestStatus, OkrSupportStatusTone> = {
  open: 'warning',
  acknowledged: 'neutral',
  resolved: 'success',
  dismissed: 'danger',
};
export const OKR_RECOGNITION_VISIBILITY_LABELS: Record<OkrRecognitionVisibility, { pl: string; en: string }> = {
  team: { pl: 'Zespół', en: 'Team' },
  organization: { pl: 'Organizacja', en: 'Organization' },
};
export function okrRecognitionVisibilityLabel(v: OkrRecognitionVisibility, isPolish: boolean): string {
  return isPolish ? OKR_RECOGNITION_VISIBILITY_LABELS[v].pl : OKR_RECOGNITION_VISIBILITY_LABELS[v].en;
}

// ==========================================
// Set-level lifecycle-action gates — see file header for citations. Each
// function returns `null` when the action IS allowed from the Set's current
// status, or a `{pl,en}` reason when it is not — TRIADA §C3 "visible,
// disabled, with a reason" contract for the workspace's own action buttons
// (distinct from `okrRegistryMappers.ts`'s `getOkrSetLockInfo`, which gates
// DRAFT-FIELD edits, not these lifecycle transitions).
// ==========================================

export interface OkrActionGate {
  pl: string;
  en: string;
}

// 2026-08-26 night-fixes-a P0 (NIGHT_SWEEP_A_REPORT_20260826.md #1): the
// reason text used to interpolate the RAW server enum ('draft',
// 'changes_requested', …) straight into the sentence shown to the user —
// technical jargon on the product's face. Resolve every status through the
// SAME i18n label dictionary the rest of the workspace already uses
// (`OKR_SET_STATUS_LABELS` via `okrSetStatusLabel`) so the sentence reads in
// plain PL/EN business language instead of the wire-format state machine.
function reasonWrongStatus(action: { pl: string; en: string }, allowed: OkrSetStatus[], current: OkrSetStatus): OkrActionGate {
  const allowedListPl = allowed.map((status) => okrSetStatusLabel(status, true)).join(', ');
  const allowedListEn = allowed.map((status) => okrSetStatusLabel(status, false)).join(', ');
  return {
    pl: `${action.pl}: wymaga statusu „${allowedListPl}” (obecny status: „${okrSetStatusLabel(current, true)}”).`,
    en: `${action.en}: requires status "${allowedListEn}" (current status: "${okrSetStatusLabel(current, false)}").`,
  };
}

export function gateSubmit(set: OkrSetDto): OkrActionGate | null {
  const allowed: OkrSetStatus[] = ['draft', 'changes_requested'];
  if (allowed.includes(set.status)) return null;
  return reasonWrongStatus({ pl: 'Złożenie do akceptacji', en: 'Submit for approval' }, allowed, set.status);
}

export function gateApprove(set: OkrSetDto, currentUserId: string | null): OkrActionGate | null {
  if (set.status !== 'submitted') {
    return reasonWrongStatus({ pl: 'Akceptacja', en: 'Approve' }, ['submitted'], set.status);
  }
  if (currentUserId && (currentUserId === set.submittedBy || currentUserId === set.createdBy)) {
    return {
      pl: 'Akceptacja: autor złożenia nie może zaakceptować własnego zestawu (blokada samo-akceptacji).',
      en: 'Approve: the submitter cannot approve their own set (self-approval denial).',
    };
  }
  return null;
}

export function gateRequestChanges(set: OkrSetDto): OkrActionGate | null {
  if (set.status !== 'submitted') {
    return reasonWrongStatus({ pl: 'Żądanie poprawek', en: 'Request changes' }, ['submitted'], set.status);
  }
  return null;
}

export function gateActivate(set: OkrSetDto): OkrActionGate | null {
  if (set.status !== 'approved') {
    return reasonWrongStatus({ pl: 'Aktywacja', en: 'Activate' }, ['approved'], set.status);
  }
  return null;
}

export function gateOpenReview(set: OkrSetDto): OkrActionGate | null {
  if (set.status !== 'active') {
    return reasonWrongStatus({ pl: 'Otwarcie przeglądu', en: 'Open review' }, ['active'], set.status);
  }
  return null;
}

export function gateCancel(set: OkrSetDto): OkrActionGate | null {
  const allowed: OkrSetStatus[] = ['draft', 'submitted', 'changes_requested', 'approved', 'active'];
  if (allowed.includes(set.status)) return null;
  return reasonWrongStatus({ pl: 'Anulowanie', en: 'Cancel' }, allowed, set.status);
}

export function gateClose(set: OkrSetDto): OkrActionGate | null {
  if (set.status !== 'review') {
    return reasonWrongStatus({ pl: 'Zamknięcie', en: 'Close' }, ['review'], set.status);
  }
  return null;
}

export function gateCarryForward(set: OkrSetDto): OkrActionGate | null {
  if (set.status !== 'closed') {
    return reasonWrongStatus({ pl: 'Przeniesienie na kolejny cykl', en: 'Carry forward' }, ['closed'], set.status);
  }
  return null;
}

export function gateSelfReview(set: OkrSetDto, currentUserId: string | null): OkrActionGate | null {
  if (currentUserId && currentUserId !== set.ownerUserId) {
    return {
      pl: 'Samoocenę może złożyć tylko właściciel tego zestawu OKR.',
      en: "Only this OKR Set's own owner may submit its self-review.",
    };
  }
  return null;
}

export function gateManagerReviewSubmit(set: OkrSetDto): OkrActionGate | null {
  if (!set.reviewerUserId) {
    return {
      pl: 'Zestaw nie ma przypisanego recenzenta — nie można złożyć oceny managera.',
      en: 'This Set has no reviewer assigned — cannot submit for manager review.',
    };
  }
  return null;
}

// ==========================================
// Formatters (mirrors okrRegistryMappers.ts's own — redeclared here per this
// program's stated "no shared helpers across domain-file boundaries" rule)
// ==========================================

export function formatOkrWorkspaceDate(value: string | null, isPolish: boolean): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString(isPolish ? 'pl-PL' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

export function shortWorkspaceId(id: string | null): string {
  if (!id) return '—';
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}
