/**
 * InterviewCandidateCard — ST-2 (DEC-540 / U-09), etap 1: Interview only.
 *
 * The candidate mechanics already exist (`initiative_candidates`, the Interview
 * writer, the accept endpoint); what was missing is the SCREEN. This card is the
 * in-module surface for a pending initiative candidate so its author can approve
 * it as a draft WITHOUT jumping to the Initiatives module.
 *
 * Kanon: SPEC-A archetype C (Rekord) — a single bordered record on `c-*` tokens,
 * zero `primary-*`/crimson (the approve action is a neutral, focus-blue control).
 * Pattern follows `ProcessFlowCandidatePreviewCard` (P-T14 D2, Ideas).
 *
 * Visibility: a candidate is shown ONLY to its author (`createdBy`) or an
 * ADMIN/SUPERADMIN — enforced by the exported `canViewCandidate` filter so the
 * rule is unit-testable and the host list cannot leak another user's candidate.
 */
import { Loader2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

/** Source types the Interview writer stamps on its candidates. */
export const INTERVIEW_CANDIDATE_SOURCE_TYPES = [
  'interview_submission',
  'interview_insight_finding',
  'interview_insight',
] as const;

export interface InterviewCandidate {
  id: string;
  title: string;
  rationale?: string | null;
  sourceType?: string | null;
  sourceId?: string | null;
  status?: string | null;
  /** Author of the candidate (`created_by`) — the visibility key. */
  createdBy?: string | null;
  createdAt?: string | null;
}

/** Minimal shape of the signed-in user the visibility filter needs. */
export interface CandidateViewer {
  id?: string | null;
  role?: string | null;
}

const ADMIN_ROLES = new Set(['ADMIN', 'SUPERADMIN']);

/**
 * A candidate is visible ONLY to its author or an admin. A candidate with no
 * recorded author is NOT shown to a plain member (fail-closed) — only an admin
 * may act on it. MUTATION target: dropping the `createdBy` comparison makes the
 * "not visible to a non-author" test red.
 */
export function canViewCandidate(
  candidate: Pick<InterviewCandidate, 'createdBy'>,
  viewer: CandidateViewer | null | undefined
): boolean {
  const role = String(viewer?.role ?? '').toUpperCase();
  if (ADMIN_ROLES.has(role)) return true;
  const author = candidate?.createdBy;
  const viewerId = viewer?.id;
  return author != null && viewerId != null && String(author) === String(viewerId);
}

/** True when the candidate originates from the Interview module. */
export function isInterviewCandidate(candidate: Pick<InterviewCandidate, 'sourceType'>): boolean {
  const st = String(candidate?.sourceType ?? '');
  return (INTERVIEW_CANDIDATE_SOURCE_TYPES as readonly string[]).includes(st);
}

export interface InterviewCandidateCardProps {
  candidate: InterviewCandidate;
  /** Approve as draft → Initiatives (calls the existing accept endpoint upstream). */
  onApprove: (candidate: InterviewCandidate) => void | Promise<void>;
  busy?: boolean;
}

export const InterviewCandidateCard: React.FC<InterviewCandidateCardProps> = ({
  candidate,
  onApprove,
  busy = false,
}) => {
  const { t } = useTranslation();
  const title = candidate.title?.trim() || t('interview.candidateCard.untitled');
  const rationale = candidate.rationale?.trim();

  return (
    <div
      data-testid="interview-candidate-card"
      data-candidate-id={candidate.id}
      className="flex flex-col gap-2 rounded-lg border border-c-border bg-c-surface p-3 text-sm"
    >
      <div className="text-[11px] font-medium uppercase tracking-wide text-c-text-muted">
        {t('interview.candidateCard.title')}
      </div>
      <div className="font-medium text-c-text" data-testid="interview-candidate-card-name">
        {title}
      </div>
      {rationale ? (
        <p className="text-c-text-secondary" data-testid="interview-candidate-card-rationale">
          {rationale}
        </p>
      ) : null}
      <p className="text-c-text-secondary">{t('interview.candidateCard.summary')}</p>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          data-testid="interview-candidate-card-approve"
          onClick={() => void onApprove(candidate)}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border border-c-border bg-c-surface px-3 py-1.5 text-sm font-medium text-c-text transition-colors hover:bg-c-surface-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          {t('interview.candidateCard.approveAsDraft')}
        </button>
      </div>
    </div>
  );
};

export default InterviewCandidateCard;
