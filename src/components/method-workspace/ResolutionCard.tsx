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
import { useTranslation, type TFunction } from 'react-i18next';

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

/** Słownik enumu akcji (PLAN §2 pkt 6) — etykiety z `t()`, nie stała tablica. */
function akcje(t: TFunction): Array<{ id: ResolutionAction; label: string; icon: React.ReactNode }> {
  return [
    { id: 'assign_question', label: t('methodWorkspace.resolution.assignQuestion', 'Assign the question'), icon: <UserPlus size={14} /> },
    { id: 'request_evidence', label: t('methodWorkspace.resolution.requestEvidence', 'Request evidence'), icon: <ScrollText size={14} /> },
    { id: 'ask_teresa', label: t('methodWorkspace.resolution.askTeresa', 'Ask Teresa'), icon: <Sparkles size={14} /> },
    { id: 'return_later', label: t('methodWorkspace.resolution.returnLater', 'Come back later'), icon: <MessageSquareText size={14} /> },
  ];
}

const DEFAULT_UNAVAILABLE: readonly ResolutionAction[] = ['assign_question'];

export const ResolutionCard: React.FC<ResolutionCardProps> = ({
  data,
  onAction,
  className = '',
  unavailableActions = DEFAULT_UNAVAILABLE,
}) => {
  const { t } = useTranslation();
  const ACTIONS = React.useMemo(() => akcje(t), [t]);
  const [lastAction, setLastAction] = React.useState<ResolutionAction | null>(null);
  return (
    <div
      role="region"
      aria-label={t('methodWorkspace.resolution.regionLabel', 'Resolution card — I don’t know')}
      data-testid="resolution-card"
      className={`rounded-xl border border-c-info/30 bg-c-info/5 p-4 space-y-3 ${className}`}
    >
      <div className="flex items-start gap-2">
        <HelpCircle size={16} className="mt-0.5 shrink-0 text-c-info" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-c-text">
            {t('methodWorkspace.resolution.title', 'This is not a mistake — it is a knowledge gap')}
          </p>
          <p className="text-xs text-c-text-secondary mt-0.5">
            {t(
              'methodWorkspace.resolution.subtitle',
              '“I don’t know” sets no level and does not count as a zero. Let us work out what is missing.'
            )}
          </p>
        </div>
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
        <div>
          <dt className="text-c-text-muted">{t('methodWorkspace.resolution.whatIsUnknown', 'What exactly we do not know')}</dt>
          <dd className="text-c-text mt-0.5">{data.whatIsUnknown}</dd>
        </div>
        <div>
          <dt className="text-c-text-muted">{t('methodWorkspace.resolution.likelyOwner', 'Who probably knows')}</dt>
          <dd className="text-c-text mt-0.5">{data.likelyOwnerLabel || t('methodWorkspace.resolution.notEstablished', 'Not established')}</dd>
        </div>
        <div>
          <dt className="text-c-text-muted">{t('methodWorkspace.resolution.resolvingArtifact', 'Which artefact would settle it')}</dt>
          <dd className="text-c-text mt-0.5">{data.resolvingArtifactHint || t('methodWorkspace.resolution.notEstablished', 'Not established')}</dd>
        </div>
        <div>
          <dt className="text-c-text-muted">{t('methodWorkspace.resolution.freezeImpact', 'Impact on freezing')}</dt>
          <dd className={`mt-0.5 ${data.blocksFreeze ? 'text-c-warning' : 'text-c-text'}`}>
            {data.blocksFreeze
              ? t('methodWorkspace.resolution.blocksFreeze', 'Blocks freezing the result')
              : t('methodWorkspace.resolution.doesNotBlockFreeze', 'Does not block freezing')}
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
              title={disabled ? t('methodWorkspace.resolution.plannedTooltip', 'Planned — not available in this version.') : undefined}
              onClick={() => {
                if (disabled) return;
                onAction(action.id);
                setLastAction(action.id);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-c-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {action.icon}
              {action.label}
              {disabled && <span className="text-c-text-muted">({t('methodWorkspace.resolution.planned', 'Planned')})</span>}
            </button>
          );
        })}
      </div>
      {lastAction && (
        <p role="status" className="text-[11px] text-c-text-muted">
          {t('methodWorkspace.resolution.recorded', 'Recorded: {{action}}.', {
            action: ACTIONS.find((a) => a.id === lastAction)?.label ?? '',
          })}
        </p>
      )}
    </div>
  );
};

export default ResolutionCard;
