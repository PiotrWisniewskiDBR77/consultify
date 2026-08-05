/**
 * MW-DEC-001 — the actual decide action (approve / reject / return for
 * clarification) against PUT /api/decisions/:id/decide.
 *
 * Honest-failure contract (see the packet brief):
 *  - 400 (missing rationale on approve/reject) → inline field error, rationale
 *    draft preserved.
 *  - 403 (not decision-maker/admin) → a DISTINCT "you are not authorized to
 *    decide this" message, not a generic error. The UI also proactively
 *    hides/disables the controls for non-owners (`canDecide` below), but that
 *    is a convenience, not the real gate — the server 403 is, and this
 *    component still renders it correctly if it ever fires anyway (stale
 *    client-side role, race, etc).
 *  - 404 → bubbled to the parent via `onNotFound()` so the whole workspace
 *    can show the single honest "this decision no longer exists" state
 *    instead of a dead action bar under stale content.
 *  - 409 ALREADY_FINALIZED → parent refetch (`onDecided`) so this bar
 *    re-renders from the REAL final state (see the read-only branch below).
 *  - 409 STALE_VERSION → inline message + parent refetch, so the visible
 *    status reflects what actually happened concurrently instead of the
 *    stale copy this tab loaded.
 */
import { AlertTriangle, Check, MessageCircleQuestion, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { actionPillClass } from '@/components/shared/PreviewPane/previewStyles';

import decisionWorkspaceApi, {
  type DecideInput,
  readDecisionApiError,
  readDecisionApiErrorDetail,
} from './decisionWorkspaceApi';
import type { DecideTargetStatus, DecisionDetailDTO, WorkspaceUserRef } from './types';
import { formatDateTime, resolveUserName } from './workspaceHelpers';

export interface DecisionDecideBarProps {
  decisionId: string;
  detail: DecisionDetailDTO;
  currentUserId?: string;
  isAdminLike: boolean;
  usersById: Map<string, WorkspaceUserRef>;
  /** Called after ANY successful or finalized-race outcome — parent refetches the full aggregate. */
  onDecided: () => void;
  /** Called on a 404 from the decide call itself (the decision vanished mid-session). */
  onNotFound: () => void;
  confirm: (options: {
    title: string;
    description?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'default';
  }) => Promise<boolean>;
}

const isFinalOutcome = (status: string) => status === 'APPROVED' || status === 'REJECTED';

export const DecisionDecideBar: React.FC<DecisionDecideBarProps> = ({
  decisionId,
  detail,
  currentUserId,
  isAdminLike,
  usersById,
  onDecided,
  onNotFound,
  confirm,
}) => {
  const { t } = useTranslation();

  // Draft-only UI state — the rationale/notes text before the decide() call
  // actually resolves. Never persisted, never treated as the real outcome.
  const [rationale, setRationale] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [staleNotice, setStaleNotice] = useState<string | null>(null);
  const [submittingStatus, setSubmittingStatus] = useState<DecideTargetStatus | null>(null);

  const canDecide =
    Boolean(currentUserId) && (currentUserId === detail.decisionOwnerId || isAdminLike);

  const submit = useCallback(
    async (status: DecideTargetStatus) => {
      const trimmedRationale = rationale.trim();
      if ((status === 'APPROVED' || status === 'REJECTED') && !trimmedRationale) {
        setFieldError(
          t(
            'myWork.decisionWorkspace.decide.rationaleRequired',
            'A rationale is required to approve or reject.'
          )
        );
        return;
      }

      if (status === 'REJECTED' || status === 'APPROVED') {
        const ok = await confirm({
          title:
            status === 'APPROVED'
              ? t('myWork.decisionWorkspace.decide.confirmApproveTitle', 'Approve this decision?')
              : t('myWork.decisionWorkspace.decide.confirmRejectTitle', 'Reject this decision?'),
          description: t(
            'myWork.decisionWorkspace.decide.confirmDescription',
            'This outcome is final — the decision cannot be re-decided afterwards.'
          ),
          confirmLabel:
            status === 'APPROVED'
              ? t('myWork.decisionWorkspace.decide.confirmApprove', 'Approve')
              : t('myWork.decisionWorkspace.decide.confirmReject', 'Reject'),
          variant: status === 'REJECTED' ? 'danger' : 'default',
        });
        if (!ok) return;
      }

      setFieldError(null);
      setSubmitError(null);
      setStaleNotice(null);
      setSubmittingStatus(status);
      const input: DecideInput = {
        status,
        rationale: trimmedRationale || undefined,
        notes: notes.trim() || undefined,
        expectedVersion: detail.version,
      };
      try {
        await decisionWorkspaceApi.decide(decisionId, input);
        // Only clear drafts once the server actually confirmed the transition.
        setRationale('');
        setNotes('');
        onDecided();
      } catch (err) {
        const apiErr = readDecisionApiError(err);
        if (apiErr.status === 404) {
          onNotFound();
        } else if (apiErr.status === 403) {
          setSubmitError(
            t(
              'myWork.decisionWorkspace.decide.forbidden',
              'You are not authorized to decide this — only the decision maker or an admin can.'
            )
          );
        } else if (apiErr.data?.code === 'ALREADY_FINALIZED') {
          setSubmitError(
            t(
              'myWork.decisionWorkspace.decide.alreadyFinalized',
              'This decision was already finalized — showing the real final state.'
            )
          );
          onDecided();
        } else if (apiErr.data?.code === 'STALE_VERSION') {
          const current = apiErr.data?.currentVersion;
          setStaleNotice(
            t(
              'myWork.decisionWorkspace.decide.staleVersion',
              'This decision changed since you opened it (now at version {{current}}). Reloading the latest state — review it before deciding again.',
              { current: String(current ?? '?') }
            )
          );
          onDecided();
        } else if (apiErr.status === 400) {
          setFieldError(
            readDecisionApiErrorDetail(err) ||
              t('myWork.decisionWorkspace.decide.invalid', 'This decision could not be recorded.')
          );
        } else {
          setSubmitError(
            t(
              'myWork.decisionWorkspace.decide.genericFailure',
              'Could not record this decision. {{msg}}',
              {
                msg: readDecisionApiErrorDetail(err),
              }
            )
          );
        }
        // Rationale/notes drafts intentionally kept so the user can retry.
      } finally {
        setSubmittingStatus(null);
      }
    },
    [confirm, decisionId, detail.version, notes, onDecided, onNotFound, rationale, t]
  );

  if (isFinalOutcome(detail.status)) {
    const decidedByName = resolveUserName(
      usersById,
      detail.decidedBy,
      t('myWork.decisionWorkspace.decide.unknownDecider', 'Unknown user')
    );
    return (
      <div className="rounded-xl border border-c-border-subtle bg-c-surface-raised px-3 py-2.5 space-y-1">
        <div className="text-xs font-semibold text-c-text">
          {detail.status === 'APPROVED'
            ? t('myWork.decisionWorkspace.decide.finalApproved', 'Approved')
            : t('myWork.decisionWorkspace.decide.finalRejected', 'Rejected')}
        </div>
        <div className="text-[11px] text-c-text-secondary">
          {t('myWork.decisionWorkspace.decide.finalBy', 'By {{name}} on {{date}}', {
            name: decidedByName,
            date: formatDateTime(detail.decidedAt),
          })}
        </div>
        {detail.rationale ? (
          <p className="text-[11px] text-c-text-secondary italic">"{detail.rationale}"</p>
        ) : null}
      </div>
    );
  }

  if (!canDecide) {
    return (
      <div className="rounded-xl border border-c-border-subtle bg-c-surface px-3 py-2.5 text-[11px] text-c-text-muted">
        {t(
          'myWork.decisionWorkspace.decide.notEligible',
          'Only the decision maker or an admin can decide this. You can still comment.'
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {staleNotice ? (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-400/40 bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{staleNotice}</span>
        </div>
      ) : null}
      {submitError ? (
        <div className="flex items-start gap-1.5 text-[11px] text-danger-600 dark:text-danger-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{submitError}</span>
        </div>
      ) : null}
      <textarea
        value={rationale}
        onChange={(e) => {
          setRationale(e.target.value);
          if (fieldError) setFieldError(null);
        }}
        placeholder={t(
          'myWork.decisionWorkspace.decide.rationalePlaceholder',
          'Rationale (required to approve or reject)'
        )}
        rows={2}
        className="w-full resize-none rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-2 text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      />
      {fieldError ? (
        <div className="flex items-start gap-1.5 text-[11px] text-danger-600 dark:text-danger-400">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{fieldError}</span>
        </div>
      ) : null}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t('myWork.decisionWorkspace.decide.notesPlaceholder', 'Notes (optional)')}
        rows={1}
        className="w-full resize-none rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-xs text-c-text placeholder:text-c-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
      />
      <div className="flex gap-2">
        <button
          onClick={() => void submit('APPROVED')}
          disabled={submittingStatus !== null}
          className={actionPillClass(
            'emerald',
            'flex-1 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Check size={13} />
          {t('myWork.decisionWorkspace.decide.approve', 'Approve')}
        </button>
        <button
          onClick={() => void submit('REJECTED')}
          disabled={submittingStatus !== null}
          className={actionPillClass(
            'red',
            'flex-1 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <X size={13} />
          {t('myWork.decisionWorkspace.decide.reject', 'Reject')}
        </button>
        <button
          onClick={() => void submit('RETURNED_FOR_CLARIFICATION')}
          disabled={submittingStatus !== null}
          className={actionPillClass(
            'neutral',
            'flex-1 disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <MessageCircleQuestion size={13} />
          {t('myWork.decisionWorkspace.decide.returnForClarification', 'Return for clarification')}
        </button>
      </div>
    </div>
  );
};

export default DecisionDecideBar;
