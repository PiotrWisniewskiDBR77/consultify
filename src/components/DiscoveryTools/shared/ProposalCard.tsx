import { Check, Loader2, MessageSquare, Sparkles, X } from 'lucide-react';
import React, { useState } from 'react';

import type { ProposalCardType, ProposalStatus } from '@/store/useToolStore';

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
    'border-l-4 border-l-violet-400 border border-dashed border-violet-200/60 bg-violet-50/20 dark:border-l-violet-500 dark:border-violet-800/40 dark:bg-violet-950/10',
  accepted:
    'border-l-4 border-l-emerald-400 border border-emerald-200/60 bg-white dark:border-l-emerald-500 dark:border-emerald-800/40 dark:bg-navy-900/40',
  rejected:
    'border-l-4 border-l-slate-300 border border-slate-200/40 bg-slate-50/50 opacity-50 dark:border-l-slate-600 dark:border-slate-700/40 dark:bg-navy-950/20',
  rethinking:
    'border-l-4 border-l-amber-400 border border-amber-200/60 bg-amber-50/20 animate-pulse dark:border-l-amber-500 dark:border-amber-800/40 dark:bg-amber-950/10',
};

const STATUS_BADGE: Record<
  ProposalStatus,
  { label: string; labelPl: string; icon: React.ReactNode; tone: string }
> = {
  'ai-proposed': {
    label: 'AI Proposal',
    labelPl: 'Propozycja AI',
    icon: <Sparkles className="h-3 w-3" />,
    tone: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  },
  accepted: {
    label: 'Accepted',
    labelPl: 'Zaakceptowane',
    icon: <Check className="h-3 w-3" />,
    tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },
  rejected: {
    label: 'Rejected',
    labelPl: 'Odrzucone',
    icon: <X className="h-3 w-3" />,
    tone: 'bg-slate-100 text-slate-500 dark:bg-slate-800/30 dark:text-slate-400',
  },
  rethinking: {
    label: 'Rethinking...',
    labelPl: 'Przemyślam...',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
    tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },
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
  const [showComment, setShowComment] = useState(false);
  const [comment, setComment] = useState('');

  const status = proposalStatus || 'ai-proposed';
  const badge = STATUS_BADGE[status];
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

  if (isRejected) return null;

  return (
    <div
      className={`rounded-xl ${STATUS_STYLES[status]} ${compact ? 'p-3' : 'p-4'} transition-all duration-200 ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">{children}</div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${badge.tone}`}
          >
            {badge.icon}
            <span>{badge.label}</span>
          </div>

          {!isRethinking && status === 'ai-proposed' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onAccept(cardType, cardId)}
                className="rounded-lg p-1.5 text-emerald-600 transition-colors hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-900/30"
                title="Accept"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setShowComment(!showComment)}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/30"
                title="Comment & Rethink"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onRethink(cardType, cardId)}
                className="rounded-lg p-1.5 text-violet-600 transition-colors hover:bg-violet-100 dark:text-violet-400 dark:hover:bg-violet-900/30"
                title="Rethink"
              >
                <Sparkles className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => onReject(cardType, cardId)}
                className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-100 hover:text-rose-600 dark:text-slate-500 dark:hover:bg-rose-900/30 dark:hover:text-rose-400"
                title="Reject"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showComment && (
        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRethink()}
            placeholder="Your feedback for AI..."
            className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 dark:border-navy-700 dark:bg-navy-800 dark:text-white"
            autoFocus
          />
          <button
            onClick={handleRethink}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-violet-700"
          >
            Rethink
          </button>
        </div>
      )}
    </div>
  );
};

export default ProposalCard;
