/**
 * ArtifactApprovalStatusBar (HP-8, 2026-07-15).
 *
 * Pill + role-appropriate actions for the HP-7 artifact approval workflow
 * (draft -> review -> approved/rejected), meant to be dropped into
 * `ArtifactRightPanel`'s `statusBar` slot.
 *
 * NOT wired into any live consumer yet — this is the built, ready piece;
 * actually rendering it inside a specific artifact shell (Task/Decision/
 * Insight/...) is Vegas's follow-up once it has gone through the
 * `consultify-artefakty` DoD §18.1 visual pass (dark+light screenshots +
 * owner acceptance) per CLAUDE.md rule #7. Until then it only activates
 * behind `isArtifactApprovalUiEnabled()` (default OFF) wherever a caller
 * chooses to mount it.
 *
 * Tokens: c-* only (kanon — zero navy/slate/hex/crimson on state/selection).
 */
import { Check, Send, X } from 'lucide-react';
import React, { useState } from 'react';

import { useArtifactApprovalStatus } from '@/hooks/useArtifactApprovalStatus';
import type { ArtifactApprovalState } from '@/services/api/artifactApprovals.api';

export interface ArtifactApprovalStatusBarProps {
  artifactType: string;
  artifactId: string;
  /** Current user's id — used to offer "Submit for review" assigned to self when no reviewer picker exists yet (Vegas: replace with a real reviewer picker). */
  currentUserId?: string;
  /** Whether the current user may approve/reject (role check owned by the caller). */
  canReview?: boolean;
  className?: string;
}

const STATE_LABEL: Record<ArtifactApprovalState, string> = {
  draft: 'Draft',
  review: 'In review',
  approved: 'Approved',
  rejected: 'Rejected',
};

const STATE_PILL_CLASS: Record<ArtifactApprovalState, string> = {
  draft: 'bg-c-surface-raised text-c-text-muted',
  review: 'bg-[color-mix(in_srgb,var(--c-info)_15%,transparent)] text-c-info',
  approved: 'bg-[color-mix(in_srgb,var(--c-success)_15%,transparent)] text-c-success',
  rejected: 'bg-[color-mix(in_srgb,var(--c-danger)_15%,transparent)] text-c-danger',
};

const buttonClass =
  'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium border border-c-border-subtle bg-c-surface-raised text-c-text hover:bg-c-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] disabled:opacity-50 disabled:pointer-events-none';

export const ArtifactApprovalStatusBar: React.FC<ArtifactApprovalStatusBarProps> = ({
  artifactType,
  artifactId,
  currentUserId,
  canReview = false,
  className,
}) => {
  const { state, loading, error, actionPending, submitForReview, approve, reject } =
    useArtifactApprovalStatus(artifactType, artifactId);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (loading && !state) {
    return (
      <div className={`text-xs text-c-text-muted ${className ?? ''}`}>Loading approval state…</div>
    );
  }

  const effectiveState: ArtifactApprovalState = state ?? 'draft';

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex items-center h-5 px-2 rounded-md text-[11px] font-medium ${STATE_PILL_CLASS[effectiveState]}`}
        >
          {STATE_LABEL[effectiveState]}
        </span>
        {actionPending ? <span className="text-[11px] text-c-text-muted">Saving…</span> : null}
      </div>

      {error ? <p className="text-[11px] text-c-danger">{error}</p> : null}

      <div className="flex flex-wrap items-center gap-1.5">
        {(effectiveState === 'draft' || effectiveState === 'rejected') && currentUserId ? (
          <button
            type="button"
            className={buttonClass}
            disabled={actionPending}
            onClick={() => void submitForReview(currentUserId)}
          >
            <Send size={12} />
            Submit for review
          </button>
        ) : null}

        {effectiveState === 'review' && canReview ? (
          <>
            <button
              type="button"
              className={buttonClass}
              disabled={actionPending}
              onClick={() => void approve()}
            >
              <Check size={12} />
              Approve
            </button>
            {showRejectInput ? (
              <span className="inline-flex items-center gap-1">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="h-7 px-2 rounded-lg text-xs border border-c-border-subtle bg-c-surface text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
                />
                <button
                  type="button"
                  className={buttonClass}
                  disabled={actionPending}
                  onClick={() => {
                    void reject(rejectReason || undefined).then((ok) => {
                      if (ok) {
                        setShowRejectInput(false);
                        setRejectReason('');
                      }
                    });
                  }}
                >
                  <X size={12} />
                  Confirm reject
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={buttonClass}
                disabled={actionPending}
                onClick={() => setShowRejectInput(true)}
              >
                <X size={12} />
                Reject
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};

export default ArtifactApprovalStatusBar;
