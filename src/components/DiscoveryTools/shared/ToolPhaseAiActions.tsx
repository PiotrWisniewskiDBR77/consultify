import { Loader2, Search, Sparkles, Square, Wand2 } from 'lucide-react';
import React from 'react';

import { getMenu3AiButtonClass } from '@/components/shared/ModuleHub/menu3ActionButtonStyles';

import type { ToolPhaseAiActionDefinition, ToolPhaseAiActionId } from '../toolAiActions';

interface ToolPhaseAiActionsProps {
  actions: ToolPhaseAiActionDefinition[];
  activeActionId?: ToolPhaseAiActionId | null;
  isStreaming?: boolean;
  isPolish: boolean;
  onRunAction: (actionId: ToolPhaseAiActionId) => void;
  onAbort?: () => void;
  className?: string;
  aiReviewCount?: number;
  onReviewAiCards?: () => void;
}

const ICONS = {
  sparkles: Sparkles,
  wand: Wand2,
  search: Search,
} as const;

export const ToolPhaseAiActions: React.FC<ToolPhaseAiActionsProps> = ({
  actions,
  activeActionId = null,
  isStreaming = false,
  isPolish,
  onRunAction,
  onAbort,
  className = '',
  aiReviewCount = 0,
  onReviewAiCards,
}) => {
  if (!actions.length && !isStreaming && aiReviewCount <= 0) return null;

  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
      <span className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:inline">
        {isPolish ? 'AI Copilot' : 'AI Copilot'}
      </span>

      {aiReviewCount > 0 ? (
        <button
          type="button"
          onClick={onReviewAiCards}
          className={getMenu3AiButtonClass(false)}
          title={
            isPolish
              ? `${aiReviewCount} kart AI czeka na review`
              : `${aiReviewCount} AI cards waiting for review`
          }
        >
          <Sparkles size={12} />
          {isPolish ? `Review AI (${aiReviewCount})` : `Review AI (${aiReviewCount})`}
        </button>
      ) : null}

      {actions.map((action) => {
        const Icon = ICONS[action.icon];
        const isActive = activeActionId === action.id;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onRunAction(action.id)}
            disabled={isStreaming}
            title={isPolish ? action.titlePl || action.labelPl : action.title || action.label}
            className={getMenu3AiButtonClass(isActive)}
          >
            {isActive && isStreaming ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Icon size={12} />
            )}
            {isPolish ? action.labelPl : action.label}
          </button>
        );
      })}

      {isStreaming && onAbort ? (
        <button
          type="button"
          onClick={onAbort}
          className={getMenu3AiButtonClass(true)}
          title={isPolish ? 'Zatrzymaj bieżące generowanie AI' : 'Stop the current AI generation'}
        >
          <Square size={12} />
          {isPolish ? 'Zatrzymaj AI' : 'Stop AI'}
        </button>
      ) : null}
    </div>
  );
};

export default ToolPhaseAiActions;
