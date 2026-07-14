import {
  Brain,
  GitMerge,
  Lightbulb,
  MessageCircle,
  Search,
  Sparkles,
  Target,
  Wand2,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { IdeaWorkspaceSelection } from '../../ideaSelectionTypes';
import type { SidekickContext } from '../aiSidekickContext';

interface AIActionsPopoverProps {
  isPl: boolean;
  selection: IdeaWorkspaceSelection;
  onAction: (action: string) => void;
  onOpenChat: () => void;
  onClose: () => void;
  sidekickHint?: string;
  /**
   * DP-5: when false (default), heuristic AI actions (mm_ai_cluster) render
   * disabled with a "Wkrótce / Coming soon" badge. Controlled by the
   * mindmapHeuristicAiOverlays feature flag upstream.
   */
  heuristicAiEnabled?: boolean;
}

/** DP-5: actions whose displayed result is a client-side heuristic, not real LLM output. */
const HEURISTIC_ACTIONS = new Set(['mm_ai_cluster']);

const GENERAL_GENERATORS = [
  { action: 'mm_ai_expand', iconEl: Zap, labelPl: 'Rozwiń mapę (AI)', labelEn: 'Expand map (AI)' },
  {
    action: 'mm_ai_suggest',
    iconEl: Lightbulb,
    labelPl: 'Zasugeruj gałęzie',
    labelEn: 'Suggest branches',
  },
  { action: 'mm_ai_gap_analysis', iconEl: Search, labelPl: 'Analiza luk', labelEn: 'Gap analysis' },
  {
    action: 'mm_ai_cluster',
    iconEl: GitMerge,
    labelPl: 'Auto-klasteryzacja',
    labelEn: 'Auto-clustering',
  },
  {
    action: 'mm_ai_summarize',
    iconEl: Brain,
    labelPl: 'Podsumowanie mapy',
    labelEn: 'Map summary',
  },
  {
    action: 'mm_ai_auto_connect',
    iconEl: Target,
    labelPl: 'Auto-linki między gałęziami',
    labelEn: 'Auto cross-links',
  },
];

const NODE_SPECIFIC_GENERATORS = [
  {
    action: 'mm_ai_expand_node',
    iconEl: Zap,
    labelPl: 'Rozwiń ten węzeł',
    labelEn: 'Expand this node',
  },
  { action: 'mm_ai_deepen', iconEl: Wand2, labelPl: 'Pogłęb temat', labelEn: 'Deepen topic' },
  {
    action: 'mm_ai_summarize_branch',
    iconEl: Brain,
    labelPl: 'Podsumuj gałąź',
    labelEn: 'Summarize branch',
  },
  {
    action: 'mm_ai_what_if',
    iconEl: Lightbulb,
    labelPl: 'What-if analiza',
    labelEn: 'What-if analysis',
  },
];

export const AIActionsPopover: React.FC<AIActionsPopoverProps> = ({
  isPl,
  selection,
  onAction,
  onOpenChat,
  onClose,
  sidekickHint: sidekickHintProp,
  heuristicAiEnabled = false,
}) => {
  const { t } = useTranslation();
  const [eventCtx, setEventCtx] = useState<SidekickContext | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      setEventCtx((e as CustomEvent<SidekickContext>).detail);
    };
    window.addEventListener('idea-mindmap-sidekick-context', handler);
    return () => window.removeEventListener('idea-mindmap-sidekick-context', handler);
  }, []);

  const resolvedHint =
    sidekickHintProp ??
    (eventCtx ? (isPl ? eventCtx.promptHintPl : eventCtx.promptHint) : undefined);

  const hasNodeSelected = selection.type === 'node' && selection.count >= 1;

  const dispatch = (action: string) => {
    onAction(action);
    onClose();
  };

  return (
    <div className="w-60 max-h-[420px] overflow-y-auto rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle shadow-xl">
      {resolvedHint && (
        <div className="px-3 py-2 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted font-medium flex items-center gap-1">
            <Sparkles size={10} />
            {resolvedHint}
          </div>
        </div>
      )}
      <div className="px-1 py-1">
        <button
          onClick={() => {
            onOpenChat();
            onClose();
          }}
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-[11px] font-semibold text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
        >
          <MessageCircle size={14} className="shrink-0" />
          {hasNodeSelected
            ? t('ideas.mindmap.askAiAboutThisNode', 'Ask AI about this node')
            : t('ideas.mindmap.newAiConversation', 'New AI conversation')}
        </button>
      </div>

      {hasNodeSelected && (
        <div className="border-t border-c-border-subtle dark:border-c-border-subtle px-1 py-1">
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
            {t('ideas.mindmap.selectedNode', 'For selected node')}
          </div>
          {NODE_SPECIFIC_GENERATORS.map((a) => {
            const Icon = a.iconEl;
            return (
              <button
                key={a.action}
                onClick={() => dispatch(a.action)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
              >
                <Icon size={12} className="text-c-text-secondary shrink-0" />
                {isPl ? a.labelPl : a.labelEn}
              </button>
            );
          })}
        </div>
      )}

      <div className="border-t border-c-border-subtle dark:border-c-border-subtle px-1 py-1">
        <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
          <Sparkles size={10} className="inline mr-1" />
          {t('ideas.mindmap.aiGenerators', 'AI generators')}
        </div>
        {GENERAL_GENERATORS.map((a) => {
          const Icon = a.iconEl;
          const comingSoon = !heuristicAiEnabled && HEURISTIC_ACTIONS.has(a.action);
          return (
            <button
              key={a.action}
              disabled={comingSoon}
              onClick={() => dispatch(a.action)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] transition-colors ${
                comingSoon
                  ? 'text-c-text-secondary/60 dark:text-c-text-secondary/60 cursor-not-allowed'
                  : 'text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
              }`}
            >
              <Icon size={12} className="text-c-text-secondary shrink-0" />
              <span className="flex-1 text-left">{isPl ? a.labelPl : a.labelEn}</span>
              {comingSoon && (
                <span className="text-[9px] italic text-c-text-secondary dark:text-c-text-secondary shrink-0">
                  {t('ideas.mindmap.comingSoon', 'Coming soon')}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
