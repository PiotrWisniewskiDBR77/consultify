import { Check, MessageSquare, Sparkles, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { type RowAction, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import type { ProposalCardType, ProposalStatus } from '@/store/useToolStore';

import { ProposalStatusBadge } from './ProposalCardGovernance';

interface ProposalCardProps {
  cardId: string;
  cardType: ProposalCardType;
  proposalStatus?: ProposalStatus;
  children: React.ReactNode;
  onAccept: (cardType: ProposalCardType, cardId: string) => void;
  onReject: (cardType: ProposalCardType, cardId: string) => void;
  onRethink: (cardType: ProposalCardType, cardId: string, comment?: string) => void;
  className?: string;
  compact?: boolean;
}

// CANON FIX (stream G5, 2026-08-13, TRIADA_KANON.md): 'ai-proposed' used
// `primary-*` (= crimson #85182F) as a routine AI-draft accent — CLAUDE.md
// pułapka nr 1 forbids crimson as data/state, reserved for genuine blockers
// only. AI accent is `c-info` per consultify-artefakty skill. Also swapped
// raw `navy-*`/`slate-*` for `c-*` tokens (accepted/rejected rows).
const STATUS_STYLES: Record<ProposalStatus, string> = {
  'ai-proposed':
    'border-l-4 border-l-c-info border border-dashed border-c-info/30 bg-c-info/5 dark:border-l-c-info dark:border-c-info/40',
  accepted:
    'border-l-4 border-l-emerald-400 border border-emerald-200/60 bg-c-surface dark:border-l-emerald-500 dark:border-emerald-800/40 dark:bg-c-surface-raised',
  rejected:
    'border-l-4 border-l-c-border border border-c-border-subtle bg-c-surface-raised opacity-50 dark:border-l-c-border dark:bg-c-surface',
  rethinking:
    'border-l-4 border-l-amber-400 border border-amber-200/60 bg-amber-50/20 animate-pulse dark:border-l-amber-500 dark:border-amber-800/40 dark:bg-amber-950/10',
};

export const ProposalCard: React.FC<ProposalCardProps> = ({
  cardId,
  cardType,
  proposalStatus = 'ai-proposed',
  children,
  onAccept,
  onReject,
  onRethink,
  className = '',
  compact = false,
}) => {
  const { t, i18n } = useTranslation();
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');
  const isPolish = i18n.language === 'pl';

  const status = proposalStatus || 'ai-proposed';
  const isRethinking = status === 'rethinking';
  const isRejected = status === 'rejected';

  const handleRethink = () => {
    if (comment.trim()) {
      onRethink(cardType, cardId, comment.trim());
      setComment('');
      setShowComment(false);
    } else {
      onRethink(cardType, cardId);
    }
  };

  const menuActions = useMemo<RowAction[]>(() => {
    if (isRethinking || status !== 'ai-proposed') return [];
    return [
      {
        id: 'accept',
        label: t('discoveryToolsSteps.proposalCard.accept'),
        icon: Check,
        variant: 'primary',
        onClick: () => onAccept(cardType, cardId),
      },
      {
        id: 'comment',
        label: t('discoveryToolsSteps.proposalCard.commentAndRethink'),
        icon: MessageSquare,
        onClick: () => setShowComment((current) => !current),
      },
      {
        id: 'rethink',
        label: t('discoveryToolsSteps.proposalCard.rethink'),
        icon: Sparkles,
        onClick: () => onRethink(cardType, cardId),
      },
      {
        id: 'reject',
        label: t('discoveryToolsSteps.proposalCard.reject'),
        icon: X,
        variant: 'danger',
        divider: true,
        onClick: () => onReject(cardType, cardId),
      },
    ];
  }, [cardId, cardType, t, isRethinking, onAccept, onReject, onRethink, status]);

  if (isRejected) return null;

  return (
    <div
      className={`rounded-xl ${STATUS_STYLES[status]} ${compact ? 'p-3' : 'p-4'} transition-all duration-200 ${className}`}
      data-ai-proposal-card={
        status === 'ai-proposed' || status === 'rethinking' ? 'true' : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">{children}</div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <ProposalStatusBadge status={status} isPolish={isPolish} />

          {menuActions.length > 0 ? (
            // #40 — pure-wiring bridge onto the sectional kebab contract (zero visible change).
            <RowActionsMenu
              sections={[{ id: 'legacy', actions: menuActions.filter((a) => !a.disabled) }]}
              iconVariant="vertical"
            />
          ) : null}
        </div>
      </div>

      {showComment && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRethink()}
            placeholder={t('discoveryToolsSteps.proposalCard.feedbackPlaceholder')}
            className="flex-1 rounded-lg border border-c-border bg-c-surface px-3 py-1.5 text-sm text-c-text placeholder-c-text-muted focus:outline-none focus:ring-2 focus:ring-c-focus"
            autoFocus
          />
          <button
            onClick={handleRethink}
            className="rounded-lg bg-c-text px-3 py-1.5 text-xs font-medium text-c-surface transition-colors hover:opacity-90"
          >
            {t('discoveryToolsSteps.proposalCard.rethinkShort')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProposalCard;
