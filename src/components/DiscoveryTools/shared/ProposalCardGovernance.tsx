import { Check, RefreshCw, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ProposalCardType, ProposalStatus } from '@/store/useToolStore';

export function ProposalStatusBadge({
  status,
  suffix,
}: {
  status?: ProposalStatus | string;
  isPolish: boolean;
  suffix?: string;
}) {
  const { t } = useTranslation();
  const labels: Record<ProposalStatus, string> = {
    'ai-proposed': t('discoveryToolsSteps.proposalCardGovernance.status.aiProposed'),
    accepted: t('discoveryToolsSteps.proposalCardGovernance.status.accepted'),
    rejected: t('discoveryToolsSteps.proposalCardGovernance.status.rejected'),
    rethinking: t('discoveryToolsSteps.proposalCardGovernance.status.rethinking'),
  };
  const tone =
    status === 'ai-proposed'
      ? 'border-c-info/40 bg-c-info/10 text-c-info'
      : status === 'rejected'
        ? 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-900/40 dark:bg-danger-900/30 dark:text-danger-300'
        : status === 'rethinking'
          ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300';

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {labels[(status as ProposalStatus) || 'accepted'] || labels.accepted}
      {suffix ? ` · ${suffix}` : ''}
    </span>
  );
}

export function ProposalCardActions({
  cardType,
  cardId,
  onAcceptCard,
  onRejectCard,
  onRethinkCard,
}: {
  cardType: ProposalCardType;
  cardId: string;
  isPolish: boolean;
  onAcceptCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRejectCard?: (cardType: ProposalCardType, cardId: string) => void;
  onRethinkCard?: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
}) {
  const { t } = useTranslation();
  const [isCommenting, setIsCommenting] = useState(false);
  const [comment, setComment] = useState('');

  const submitRethink = () => {
    onRethinkCard?.(cardType, cardId, comment.trim() || undefined);
    setComment('');
    setIsCommenting(false);
  };

  return (
    <div className="flex flex-col items-end gap-2" data-ai-proposal-card="true">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => onAcceptCard?.(cardType, cardId)}
          className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300"
          aria-label={t('discoveryToolsSteps.proposalCardGovernance.accept')}
          title={t('discoveryToolsSteps.proposalCardGovernance.acceptAiCard')}
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setIsCommenting((value) => !value)}
          className="rounded-lg bg-c-info/10 p-1.5 text-c-info hover:bg-c-info/20"
          aria-label={t('discoveryToolsSteps.proposalCardGovernance.rethink')}
          title={t('discoveryToolsSteps.proposalCardGovernance.askAiToRethink')}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onRejectCard?.(cardType, cardId)}
          className="rounded-lg bg-danger-50 p-1.5 text-danger-700 hover:bg-danger-100 dark:bg-danger-900/30 dark:text-danger-300"
          aria-label={t('discoveryToolsSteps.proposalCardGovernance.reject')}
          title={t('discoveryToolsSteps.proposalCardGovernance.rejectAiCard')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {isCommenting ? (
        <div className="flex w-64 flex-col gap-2">
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={2}
            className="rounded-lg border border-c-border bg-c-surface px-2 py-1 text-xs text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            placeholder={t('discoveryToolsSteps.proposalCardGovernance.rethinkPlaceholder')}
          />
          <button
            type="button"
            onClick={submitRethink}
            className="self-end rounded-lg bg-c-text px-2 py-1 text-xs text-c-surface hover:opacity-90"
          >
            {t('discoveryToolsSteps.proposalCardGovernance.send')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
