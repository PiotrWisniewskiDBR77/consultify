import {
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileText,
  Loader2,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
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
  const visualState = error
    ? 'failed'
    : busy
      ? 'working'
      : isDone
        ? 'materialized'
        : isApproved
          ? 'approved'
          : proposal.state;
  const stateStyle = {
    pending: {
      card: 'border-amber-300/60 dark:border-amber-300/20',
      icon: 'text-amber-600 dark:text-amber-300',
      badge: 'bg-amber-500/10 text-amber-700 dark:text-amber-200',
      label: t('chat.governedHandoff.state.pending', 'Pending review'),
    },
    materializable: {
      card: 'border-sky-300/60 dark:border-sky-300/20',
      icon: 'text-sky-600 dark:text-sky-300',
      badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-200',
      label: t('chat.governedHandoff.state.materializable', 'Ready to create'),
    },
    working: {
      card: 'border-sky-300/60 dark:border-sky-300/20',
      icon: 'text-sky-600 dark:text-sky-300',
      badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-200',
      label: t('chat.governedHandoff.state.working', 'Working'),
    },
    materialized: {
      card: 'border-emerald-300/60 dark:border-emerald-300/20',
      icon: 'text-emerald-600 dark:text-emerald-300',
      badge: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200',
      label: t('chat.governedHandoff.state.materialized', 'Created'),
    },
    rejected: {
      card: 'border-slate-300/70 dark:border-slate-500/30',
      icon: 'text-slate-500 dark:text-slate-300',
      badge: 'bg-slate-500/10 text-slate-600 dark:text-slate-300',
      label: t('chat.governedHandoff.state.rejected', 'Rejected'),
    },
    failed: {
      card: 'border-danger-300/60 dark:border-danger-300/25',
      icon: 'text-danger-600 dark:text-danger-300',
      badge: 'bg-danger-500/10 text-danger-700 dark:text-danger-200',
      label: t('chat.governedHandoff.state.failed', 'Action failed'),
    },
    approved: {
      card: 'border-sky-300/60 dark:border-sky-300/20',
      icon: 'text-sky-600 dark:text-sky-300',
      badge: 'bg-sky-500/10 text-sky-700 dark:text-sky-200',
      label: t('chat.governedHandoff.state.approved', 'Approved'),
    },
  }[visualState];
  const StateIcon = {
    pending: Clock3,
    approved: ShieldCheck,
    materializable: FileText,
    working: Loader2,
    materialized: CheckCircle2,
    rejected: XCircle,
    failed: CircleAlert,
  }[visualState];

  return (
    <section
      data-testid={`governed-chat-handoff-${proposal.proposalId}`}
      data-visual-state={visualState}
      className={`not-prose relative mt-3 overflow-hidden rounded-2xl border bg-gradient-to-br from-white/90 to-white/70 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.10)] backdrop-blur-xl dark:from-navy-900/90 dark:to-navy-800/70 dark:shadow-[0_16px_36px_rgba(0,0,0,0.28)] ${stateStyle.card}`}
      aria-label={t('chat.governedHandoff.title', 'Governed document proposal')}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/20" />
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 rounded-xl bg-white/70 p-2 shadow-sm dark:bg-white/[0.06] ${stateStyle.icon}`}
        >
          <StateIcon
            size={16}
            aria-hidden="true"
            className={visualState === 'working' ? 'animate-spin' : undefined}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="text-xs font-semibold text-c-text">
              {proposal.payload?.suggestedTitle ||
                t('chat.governedHandoff.title', 'Governed document proposal')}
            </div>
            <span
              data-testid="governed-chat-handoff-state"
              role="status"
              aria-live="polite"
              className={`rounded-full px-2 py-1 text-[10px] font-semibold ${stateStyle.badge}`}
            >
              {stateStyle.label}
            </span>
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
          <dl
            className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-[10px] text-c-text-muted"
            data-testid="governed-chat-handoff-provenance"
          >
            <dt>{t('chat.governedHandoff.source', 'Source')}</dt>
            <dd className="break-all font-mono">
              {proposal.producerRecordId}
            </dd>
            <dt>{t('chat.governedHandoff.hash', 'Hash')}</dt>
            <dd className="break-all font-mono">
              {proposal.sourceContentHash}
            </dd>
            <dt>{t('chat.governedHandoff.version', 'Version')}</dt>
            <dd className="font-mono">{proposal.sourceVersion}</dd>
          </dl>

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
                  aria-busy={busy === 'approve' || undefined}
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
                  aria-busy={busy === 'reject' || undefined}
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
              <div className="flex flex-wrap items-center gap-2">
                <span
                  data-testid="governed-chat-handoff-materializable"
                  className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 dark:text-sky-200"
                >
                  <FileText size={12} aria-hidden="true" />
                  {t('chat.governedHandoff.state.materializable', 'Ready to create')}
                </span>
                <button
                  type="button"
                  onClick={onMaterialize}
                  disabled={Boolean(busy)}
                  aria-busy={busy === 'materialize' || undefined}
                  className="inline-flex items-center gap-1.5 rounded-md bg-c-text px-2.5 py-1.5 text-[11px] font-medium text-c-surface disabled:opacity-50"
                >
                  {busy === 'materialize' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <FileText size={12} />
                  )}
                  {t('chat.governedHandoff.createDocument', 'Create document')}
                </button>
              </div>
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
