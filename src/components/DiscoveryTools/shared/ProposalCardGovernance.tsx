import { Check, RefreshCw, X } from 'lucide-react';
import React, { useState } from 'react';

import type { ProposalCardType, ProposalStatus } from '@/store/useToolStore';

export function ProposalStatusBadge({
  status,
  isPolish,
  suffix,
}: {
  status?: ProposalStatus | string;
  isPolish: boolean;
  suffix?: string;
}) {
  const labels: Record<ProposalStatus, string> = {
    'ai-proposed': isPolish ? 'Propozycja AI' : 'AI proposal',
    accepted: isPolish ? 'Zaakceptowane' : 'Accepted',
    rejected: isPolish ? 'Odrzucone' : 'Rejected',
    rethinking: isPolish ? 'Przemyślenie' : 'Rethinking',
  };
  const tone =
    status === 'ai-proposed'
      ? 'border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-900/40 dark:bg-primary-950/30 dark:text-primary-300'
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
  isPolish,
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
          aria-label={isPolish ? 'Akceptuj' : 'Accept'}
          title={isPolish ? 'Akceptuj kartę AI' : 'Accept AI card'}
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setIsCommenting((value) => !value)}
          className="rounded-lg bg-primary-50 p-1.5 text-primary-700 hover:bg-primary-100 dark:bg-primary-950/30 dark:text-primary-300"
          aria-label={isPolish ? 'Przemyśl ponownie' : 'Rethink'}
          title={isPolish ? 'Poproś AI o ponowne przemyślenie' : 'Ask AI to rethink'}
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onRejectCard?.(cardType, cardId)}
          className="rounded-lg bg-danger-50 p-1.5 text-danger-700 hover:bg-danger-100 dark:bg-danger-900/30 dark:text-danger-300"
          aria-label={isPolish ? 'Odrzuć' : 'Reject'}
          title={isPolish ? 'Odrzuć kartę AI' : 'Reject AI card'}
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
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
            placeholder={isPolish ? 'Co AI ma poprawić?' : 'What should AI improve?'}
          />
          <button
            type="button"
            onClick={submitRethink}
            className="self-end rounded-lg bg-navy-900 dark:bg-[#F4F7FB] px-2 py-1 text-xs text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF]"
          >
            {isPolish ? 'Wyślij' : 'Send'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
