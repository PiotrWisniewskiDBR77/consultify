/**
 * LaneDecisionsSection
 *
 * Shows decisions with their current state and action buttons.
 * State machine: proposed -> pending_approval -> approved -> in_execution -> verified
 */

import { CheckCircle2, ChevronRight, Clock, Scale, XCircle } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyStateInline } from '../../shared/NModeBlocks/EmptyStateInline';
import { ToggleBlock } from '../../shared/NModeBlocks/ToggleBlock';
import type { DecisionItem, DecisionState, LaneAction, SuggestionItem } from './types';

const STATE_CFG: Record<DecisionState, { bg: string; text: string; labelEn: string; labelPl: string }> = {
  proposed: { bg: 'bg-slate-400/10', text: 'text-slate-500 dark:text-slate-400', labelEn: 'Proposed', labelPl: 'Zaproponowano' },
  pending_approval: { bg: 'bg-amber-500/10', text: 'text-amber-700 dark:text-amber-300', labelEn: 'Pending Approval', labelPl: 'Oczekuje na zatwierdzenie' },
  approved: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', labelEn: 'Approved', labelPl: 'Zatwierdzone' },
  rejected: { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', labelEn: 'Rejected', labelPl: 'Odrzucone' },
  deferred: { bg: 'bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', labelEn: 'Deferred', labelPl: 'Odroczone' },
  in_execution: { bg: 'bg-blue-500/10', text: 'text-blue-700 dark:text-blue-300', labelEn: 'In Execution', labelPl: 'W realizacji' },
  verified: { bg: 'bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-300', labelEn: 'Verified', labelPl: 'Zweryfikowane' },
};

interface LaneDecisionsSectionProps {
  decisions: DecisionItem[];
  suggestions: SuggestionItem[];
  defaultOpen?: boolean;
  onAction?: (action: LaneAction) => void;
}

export const LaneDecisionsSection: React.FC<LaneDecisionsSectionProps> = ({
  decisions,
  suggestions,
  defaultOpen = false,
  onAction,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const getSuggestionLabel = (id: string) => suggestions.find((s) => s.id === id)?.action || id;

  return (
    <ToggleBlock
      title={isPolish ? 'Decyzje' : 'Decisions'}
      badge={decisions.length}
      defaultOpen={defaultOpen}
      icon={<Scale size={14} />}
    >
      {decisions.length === 0 ? (
        <EmptyStateInline
          icon={Scale}
          message={isPolish ? 'Brak decyzji — zaakceptuj sugestie powyżej.' : 'No decisions — accept suggestions above to create them.'}
          dashed={false}
        />
      ) : (
        <div className="space-y-2">
          {decisions.map((dec) => {
            const cfg = STATE_CFG[dec.state];
            const canApprove = dec.state === 'proposed' || dec.state === 'pending_approval';
            const canExecute = dec.state === 'approved';

            return (
              <div
                key={dec.id}
                className="flex items-center gap-2.5 py-2.5 px-3 rounded-lg bg-white/40 dark:bg-navy-900/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {getSuggestionLabel(dec.suggestionId)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.text}`}>
                      {isPolish ? cfg.labelPl : cfg.labelEn}
                    </span>
                    {dec.decidedBy && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {dec.decidedBy}
                        {dec.decidedAt && ` · ${new Date(dec.decidedAt).toLocaleDateString()}`}
                      </span>
                    )}
                  </div>
                  {dec.notes && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 italic">{dec.notes}</p>
                  )}
                </div>

                {onAction && (
                  <div className="flex items-center gap-1 shrink-0">
                    {canApprove && (
                      <>
                        <button
                          onClick={() => onAction({ type: 'approve', targetId: dec.id })}
                          className="p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                          title={isPolish ? 'Zatwierdź' : 'Approve'}
                        >
                          <CheckCircle2 size={14} />
                        </button>
                        <button
                          onClick={() => onAction({ type: 'reject', targetId: dec.id })}
                          className="p-1.5 rounded-md text-rose-500 dark:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title={isPolish ? 'Odrzuć' : 'Reject'}
                        >
                          <XCircle size={14} />
                        </button>
                        <button
                          onClick={() => onAction({ type: 'defer', targetId: dec.id })}
                          className="p-1.5 rounded-md text-slate-400 dark:text-slate-500 hover:bg-slate-400/10 transition-colors"
                          title={isPolish ? 'Odrocz' : 'Defer'}
                        >
                          <Clock size={14} />
                        </button>
                        <button
                          onClick={() => onAction({ type: 'escalate', targetId: dec.id })}
                          className="p-1.5 rounded-md text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                          title={isPolish ? 'Eskaluj' : 'Escalate'}
                        >
                          <ChevronRight size={14} />
                        </button>
                      </>
                    )}
                    {canExecute && (
                      <button
                        onClick={() => onAction({ type: 'execute', targetId: dec.id })}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
                      >
                        {isPolish ? 'Realizuj' : 'Execute'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </ToggleBlock>
  );
};

export default LaneDecisionsSection;
