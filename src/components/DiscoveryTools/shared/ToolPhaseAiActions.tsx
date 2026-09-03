import { Loader2, Search, Sparkles, Square, Wand2 } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

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
  const { t } = useTranslation();
  if (!actions.length && !isStreaming && aiReviewCount <= 0) return null;

  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
      {/* axe color-contrast: text-slate-600 had no dark: override — 2.36:1 on
          the dark surface (< 4.5). dark:text-slate-400 fixes it (6.96:1);
          light theme (7.58:1 on white) unaffected. */}
      <span className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-slate-600 dark:text-slate-400 sm:inline">
        {t('discoveryToolsSteps.toolPhaseAiActions.aiCopilot')}
      </span>

      {aiReviewCount > 0 ? (
        <button
          type="button"
          onClick={onReviewAiCards}
          className={getMenu3AiButtonClass(false)}
          title={t('discoveryToolsSteps.toolPhaseAiActions.reviewWaitingTitle', {
            count: aiReviewCount,
          })}
        >
          <Sparkles size={12} />
          {t('discoveryToolsSteps.toolPhaseAiActions.reviewAiCount', { count: aiReviewCount })}
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
          title={t('discoveryToolsSteps.toolPhaseAiActions.stopGenerationTitle')}
        >
          <Square size={12} />
          {t('discoveryToolsSteps.toolPhaseAiActions.stopAi')}
        </button>
      ) : null}
    </div>
  );
};

export default ToolPhaseAiActions;
