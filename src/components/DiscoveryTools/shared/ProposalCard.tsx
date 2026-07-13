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

const STATUS_STYLES: Record<ProposalStatus, string> = {
  'ai-proposed':
    'border-l-4 border-l-primary-400 border border-dashed border-primary-200/60 bg-primary-50/20 dark:border-l-primary-500 dark:border-primary-800/40 dark:bg-primary-950/10',
  accepted:
    'border-l-4 border-l-emerald-400 border border-emerald-200/60 bg-white dark:border-l-emerald-500 dark:border-emerald-800/40 dark:bg-navy-900/40',
  rejected:
    'border-l-4 border-l-slate-300 border border-slate-200/40 bg-slate-50/50 opacity-50 dark:border-l-slate-600 dark:border-slate-700/40 dark:bg-navy-950/20',
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
  const { i18n } = useTranslation();
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
        label: isPolish ? 'Akceptuj' : 'Accept',
        icon: Check,
        variant: 'primary',
        onClick: () => onAccept(cardType, cardId),
      },
      {
        id: 'comment',
        label: isPolish ? 'Komentarz i rethink' : 'Comment & rethink',
        icon: MessageSquare,
        onClick: () => setShowComment((current) => !current),
      },
      {
        id: 'rethink',
        label: isPolish ? 'Przemyśl ponownie' : 'Rethink',
        icon: Sparkles,
        onClick: () => onRethink(cardType, cardId),
      },
      {
        id: 'reject',
        label: isPolish ? 'Odrzuć' : 'Reject',
        icon: X,
        variant: 'danger',
        divider: true,
        onClick: () => onReject(cardType, cardId),
      },
    ];
  }, [cardId, cardType, isPolish, isRethinking, onAccept, onReject, onRethink, status]);

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
            placeholder={isPolish ? 'Dodaj feedback dla AI...' : 'Your feedback for AI...'}
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-navy-700 dark:bg-navy-800 dark:text-white"
            autoFocus
          />
          <button
            onClick={handleRethink}
            className="rounded-lg bg-navy-900 dark:bg-[#F4F7FB] px-3 py-1.5 text-xs font-medium text-white dark:text-navy-950 transition-colors hover:bg-navy-800 dark:hover:bg-[#DDE5EF]"
          >
            {isPolish ? 'Przemyśl' : 'Rethink'}
          </button>
        </div>
      )}
    </div>
  );
};

export default ProposalCard;
