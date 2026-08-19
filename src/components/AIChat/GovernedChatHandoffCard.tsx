import { CheckCircle2, FileText, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { GovernedChatHandoffProposal } from '@/services/api/v8/chat';

interface GovernedChatHandoffCardProps {
  proposal: GovernedChatHandoffProposal;
  busy?: 'approve' | 'reject' | 'materialize' | null;
  error?: string | null;
  targetRecordId?: string | null;
  onApprove: () => void;
  onReject: () => void;
  onMaterialize: () => void;
}

export const GovernedChatHandoffCard: React.FC<GovernedChatHandoffCardProps> = ({
  proposal,
  busy,
  error,
  targetRecordId,
  onApprove,
  onReject,
  onMaterialize,
}) => {
  const { t } = useTranslation();
  const citationCount = Number(proposal.payload?.citationStats?.totalFound || 0);
  const isPending = proposal.state === 'pending';
  const isApproved = proposal.state === 'approved';
  const isDone = proposal.state === 'materialized' || Boolean(targetRecordId);

  return (
    <section
      data-testid={`governed-chat-handoff-${proposal.proposalId}`}
      className="not-prose mt-3 rounded-lg border border-c-border bg-c-surface-raised p-3"
      aria-label={t('chat.governedHandoff.title', 'Governed document proposal')}
    >
      <div className="flex items-start gap-2">
        <ShieldCheck size={16} className="mt-0.5 shrink-0 text-c-focus" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-c-text">
            {proposal.payload?.suggestedTitle ||
              t('chat.governedHandoff.title', 'Governed document proposal')}
          </div>
          <div className="mt-1 text-[11px] text-c-text-secondary">
            {t(
              'chat.governedHandoff.provenance',
              'Pinned to this message and its server-verified content hash.'
            )}{' '}
            {citationCount > 0
              ? t('chat.governedHandoff.citations', '{{count}} source references preserved.', {
                  count: citationCount,
                })
              : t('chat.governedHandoff.noCitations', 'No source references were found.')}
          </div>
          <div className="mt-1 font-mono text-[10px] text-c-text-muted">
            {proposal.sourceContentHash.slice(0, 12)} · v{proposal.sourceVersion}
          </div>

          {error ? (
            <div role="alert" className="mt-2 text-[11px] text-danger-600 dark:text-danger-400">
              {error}
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {isPending ? (
              <>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={Boolean(busy)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-c-text px-2.5 py-1.5 text-[11px] font-medium text-c-surface disabled:opacity-50"
                >
                  {busy === 'approve' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <CheckCircle2 size={12} />
                  )}
                  {t('chat.governedHandoff.approve', 'Approve')}
                </button>
                <button
                  type="button"
                  onClick={onReject}
                  disabled={Boolean(busy)}
                  className="inline-flex items-center gap-1.5 rounded-md border border-c-border px-2.5 py-1.5 text-[11px] text-c-text-secondary disabled:opacity-50"
                >
                  {busy === 'reject' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <XCircle size={12} />
                  )}
                  {t('chat.governedHandoff.reject', 'Reject')}
                </button>
              </>
            ) : null}

            {isApproved ? (
              <button
                type="button"
                onClick={onMaterialize}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-1.5 rounded-md bg-c-text px-2.5 py-1.5 text-[11px] font-medium text-c-surface disabled:opacity-50"
              >
                {busy === 'materialize' ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileText size={12} />
                )}
                {t('chat.governedHandoff.createDocument', 'Create document')}
              </button>
            ) : null}

            {isDone ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={13} />
                {t('chat.governedHandoff.created', 'Document created')}
                {targetRecordId ? <span className="font-mono">{targetRecordId}</span> : null}
              </span>
            ) : proposal.state === 'rejected' ? (
              <span className="text-[11px] text-c-text-muted">
                {t('chat.governedHandoff.rejected', 'Proposal rejected')}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
};
