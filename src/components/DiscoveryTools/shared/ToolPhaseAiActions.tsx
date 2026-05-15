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
}) => {
  if (!actions.length && !isStreaming) return null;

  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
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
        <button type="button" onClick={onAbort} className={getMenu3AiButtonClass(true)}>
          <Square size={12} />
          {isPolish ? 'Zatrzymaj AI' : 'Stop AI'}
        </button>
      ) : null}
    </div>
  );
};

export default ToolPhaseAiActions;
