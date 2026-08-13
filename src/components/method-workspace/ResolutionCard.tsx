/**
 * ResolutionCard — opens when the answer state is `Nie wiem / potrzebuję pomocy`.
 *
 * Canon (ASSESSMENT_QUESTION_HELP_AND_CONVERSATION_STANDARD.md §4): "Nie wiem"
 * nie jest błędem użytkownika i NIE DAJE ZERA. This card is the honest
 * follow-up: what's unknown, who likely knows, what artefact could resolve it,
 * and four controlled actions. It never writes a level/score itself.
 */
import { HelpCircle, MessageSquareText, ScrollText, Sparkles, UserPlus } from 'lucide-react';
import React from 'react';

import type { ResolutionAction, ResolutionCardData } from './types';

export interface ResolutionCardProps {
  data: ResolutionCardData;
  onAction: (action: ResolutionAction) => void;
  className?: string;
}

const ACTIONS: Array<{ id: ResolutionAction; label: string; icon: React.ReactNode }> = [
  { id: 'assign_question', label: 'Przypisz pytanie', icon: <UserPlus size={14} /> },
  { id: 'request_evidence', label: 'Poproś o dowód', icon: <ScrollText size={14} /> },
  { id: 'ask_teresa', label: 'Zapytaj Teresę', icon: <Sparkles size={14} /> },
  { id: 'return_later', label: 'Wróć później', icon: <MessageSquareText size={14} /> },
];

export const ResolutionCard: React.FC<ResolutionCardProps> = ({ data, onAction, className = '' }) => {
  return (
    <div
      role="region"
      aria-label="Karta rozstrzygnięcia — nie wiem"
      data-testid="resolution-card"
      className={`rounded-xl border border-c-info/30 bg-c-info/5 p-4 space-y-3 ${className}`}
    >
      <div className="flex items-start gap-2">
        <HelpCircle size={16} className="mt-0.5 shrink-0 text-c-info" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-c-text">To nie jest błąd — to jest luka wiedzy</p>
          <p className="text-xs text-c-text-secondary mt-0.5">
            „Nie wiem" nie ustawia poziomu i nie liczy się jako zero. Ustalmy, czego brakuje.
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-c-text-muted">Czego dokładnie nie wiemy</dt>
          <dd className="text-c-text mt-0.5">{data.whatIsUnknown}</dd>
        </div>
        <div>
          <dt className="text-c-text-muted">Kto prawdopodobnie wie</dt>
          <dd className="text-c-text mt-0.5">{data.likelyOwnerLabel || 'Nie ustalono'}</dd>
        </div>
        <div>
          <dt className="text-c-text-muted">Jaki artefakt rozstrzygnie</dt>
          <dd className="text-c-text mt-0.5">{data.resolvingArtifactHint || 'Nie ustalono'}</dd>
        </div>
        <div>
          <dt className="text-c-text-muted">Wpływ na freeze</dt>
          <dd className={`mt-0.5 ${data.blocksFreeze ? 'text-c-warning' : 'text-c-text'}`}>
            {data.blocksFreeze ? 'Blokuje zamrożenie wyniku' : 'Nie blokuje zamrożenia'}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        {ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {action.icon}
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ResolutionCard;
