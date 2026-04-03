/**
 * LaneSuggestionsSection
 *
 * Proposed actions grouped by feasibility level with FeasibilityBadge.
 * Users can accept (promote to decision) or dismiss suggestions.
 */

import { Lightbulb, MessageSquare } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyStateInline } from '../../shared/NModeBlocks/EmptyStateInline';
import { ToggleBlock } from '../../shared/NModeBlocks/ToggleBlock';
import { FeasibilityBadge } from './FeasibilityBadge';
import type { LaneAction, SuggestionFeasibility, SuggestionItem } from './types';

const FEASIBILITY_ORDER: SuggestionFeasibility[] = [
  'immediate',
  'manager_decision',
  'leadership_decision',
  'not_feasible_now',
];

interface LaneSuggestionsSectionProps {
  suggestions: SuggestionItem[];
  defaultOpen?: boolean;
  onAction?: (action: LaneAction) => void;
}

export const LaneSuggestionsSection: React.FC<LaneSuggestionsSectionProps> = ({
  suggestions,
  defaultOpen = false,
  onAction,
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';

  const grouped = FEASIBILITY_ORDER
    .map((f) => ({ feasibility: f, items: suggestions.filter((s) => s.feasibility === f) }))
    .filter((g) => g.items.length > 0);

  return (
    <ToggleBlock
      title={isPolish ? 'Sugestie' : 'Suggestions'}
      badge={suggestions.length}
      defaultOpen={defaultOpen}
      icon={<MessageSquare size={14} />}
    >
      {suggestions.length === 0 ? (
        <EmptyStateInline
          icon={Lightbulb}
          message={isPolish ? 'Brak sugestii — sytuacja pod kontrolą.' : 'No suggestions — situation under control.'}
          dashed={false}
        />
      ) : (
        <div className="space-y-4">
          {grouped.map(({ feasibility, items }) => (
            <div key={feasibility} className="space-y-2">
              <FeasibilityBadge feasibility={feasibility} />
              {items.map((sug) => (
                <div
                  key={sug.id}
                  className="flex items-start gap-2.5 py-2.5 px-3 rounded-lg bg-white/40 dark:bg-navy-900/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{sug.action}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sug.reason}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        → {sug.expectedOutcome}
                      </span>
                      {sug.cost && (
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">
                          {isPolish ? 'Koszt' : 'Cost'}: {sug.cost}
                        </span>
                      )}
                    </div>
                  </div>
                  {onAction && feasibility !== 'not_feasible_now' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onAction({ type: 'approve', targetId: sug.id })}
                        className="px-2 py-1 rounded-md text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors"
                      >
                        {isPolish ? 'Akceptuj' : 'Accept'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </ToggleBlock>
  );
};

export default LaneSuggestionsSection;
