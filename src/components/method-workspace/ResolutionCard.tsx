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
  /**
   * Actions with no real backing endpoint/mechanism yet — rendered disabled
   * with a "Planowane" note instead of firing a decorative empty handler.
   * `assign_question` has no per-question assignee anywhere in the app today
   * (only session-level Owner/Approver roles exist) — it defaults disabled.
   */
  unavailableActions?: readonly ResolutionAction[];
}

const ACTIONS: Array<{ id: ResolutionAction; label: string; icon: React.ReactNode }> = [
  { id: 'assign_question', label: 'Przypisz pytanie', icon: <UserPlus size={14} /> },
  { id: 'request_evidence', label: 'Poproś o dowód', icon: <ScrollText size={14} /> },
  { id: 'ask_teresa', label: 'Zapytaj Teresę', icon: <Sparkles size={14} /> },
  { id: 'return_later', label: 'Wróć później', icon: <MessageSquareText size={14} /> },
];

const DEFAULT_UNAVAILABLE: readonly ResolutionAction[] = ['assign_question'];

export const ResolutionCard: React.FC<ResolutionCardProps> = ({
  data,
  onAction,
  className = '',
  unavailableActions = DEFAULT_UNAVAILABLE,
}) => {
  const [lastAction, setLastAction] = React.useState<ResolutionAction | null>(null);
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

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {ACTIONS.map((action) => {
          const disabled = unavailableActions.includes(action.id);
          return (
            <button
              key={action.id}
              type="button"
              disabled={disabled}
              title={disabled ? 'Planowane — niedostępne w tej wersji.' : undefined}
              onClick={() => {
                if (disabled) return;
                onAction(action.id);
                setLastAction(action.id);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {action.icon}
              {action.label}
              {disabled && <span className="text-c-text-muted">(Planowane)</span>}
            </button>
          );
        })}
      </div>
      {lastAction && (
        <p role="status" className="text-[11px] text-c-text-muted">
          Zapisano: {ACTIONS.find((a) => a.id === lastAction)?.label}.
        </p>
      )}
    </div>
  );
};

export default ResolutionCard;
