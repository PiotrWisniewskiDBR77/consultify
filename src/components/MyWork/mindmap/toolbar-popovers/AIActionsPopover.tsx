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

import type { CanvasToolType, IdeaWorkspaceSelection } from '../../ideaSelectionTypes';
import type { SidekickContext } from '../aiSidekickContext';

interface AIActionsPopoverProps {
  isPl: boolean;
  /**
   * P1-1: rail jest wspólny dla czterech reprezentacji, więc popover AI MUSI
   * wiedzieć, w której jest. Wcześniej pokazywał generatory `mm_ai_*` wszędzie
   * — a obsługuje je wyłącznie `useMindMapQuickActions` (montowany tylko w
   * Mapie myśli), więc w Whiteboardzie / Przepływie / Tabeli każda pozycja
   * była martwym klikiem. Domyślnie 'mindmap' dla starych wywołań.
   */
  activeTool?: CanvasToolType;
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
  {
    action: 'mm_ai_expand',
    iconEl: Zap,
    tkey: 'myWorkMindmap.aiGen.expandMap',
    labelEn: 'Expand map (AI)',
  },
  {
    action: 'mm_ai_suggest',
    iconEl: Lightbulb,
    tkey: 'myWorkMindmap.aiGen.suggestBranches',
    labelEn: 'Suggest branches',
  },
  {
    action: 'mm_ai_gap_analysis',
    iconEl: Search,
    tkey: 'myWorkMindmap.aiGen.gapAnalysis',
    labelEn: 'Gap analysis',
  },
  {
    action: 'mm_ai_cluster',
    iconEl: GitMerge,
    tkey: 'myWorkMindmap.aiGen.autoClustering',
    labelEn: 'Auto-clustering',
  },
  {
    action: 'mm_ai_summarize',
    iconEl: Brain,
    tkey: 'myWorkMindmap.aiGen.mapSummary',
    labelEn: 'Map summary',
  },
  {
    action: 'mm_ai_auto_connect',
    iconEl: Target,
    tkey: 'myWorkMindmap.aiGen.autoCrossLinks',
    labelEn: 'Auto cross-links',
  },
];

const NODE_SPECIFIC_GENERATORS = [
  {
    action: 'mm_ai_expand_node',
    iconEl: Zap,
    tkey: 'myWorkMindmap.aiAction.expandNode',
    labelEn: 'Expand this node',
  },
  {
    action: 'mm_ai_deepen',
    iconEl: Wand2,
    tkey: 'myWorkMindmap.aiAction.deepenTopic',
    labelEn: 'Deepen topic',
  },
  {
    action: 'mm_ai_summarize_branch',
    iconEl: Brain,
    tkey: 'myWorkMindmap.aiAction.summarizeBranch',
    labelEn: 'Summarize branch',
  },
  {
    action: 'mm_ai_what_if',
    iconEl: Lightbulb,
    tkey: 'myWorkMindmap.aiAction.whatIfAnalysis',
    labelEn: 'What-if analysis',
  },
];

/**
 * P1-1: generatory AI POZOSTAŁYCH reprezentacji. Każdy ciąg ma realny handler:
 *   wb_ai_*   → whiteboard/useWhiteboardQuickActions.ts (AI_ACTION_MAP → generate→preview→apply)
 *   pf_analyze→ processflow/useProcessFlowQuickActions.ts (runProcessCoach = AI Coach)
 *   tbl_*     → table/useTableQuickActions.ts (toggleMap → realne modale IdeaTableTool)
 * Etykiety są zapisane wprost PL/EN, bo dla tych akcji nie istnieją jeszcze
 * klucze i18n — lepszy jawny polski napis niż pusty klucz.
 */
const TOOL_GENERATORS: Partial<
  Record<CanvasToolType, Array<{ action: string; iconEl: typeof Zap; pl: string; en: string }>>
> = {
  whiteboard: [
    { action: 'wb_ai_find_themes', iconEl: Search, pl: 'Znajdź tematy', en: 'Find themes' },
    { action: 'wb_ai_name_clusters', iconEl: GitMerge, pl: 'Nazwij skupiska', en: 'Name clusters' },
    {
      action: 'wb_ai_extract_actions',
      iconEl: Target,
      pl: 'Wyciągnij działania',
      en: 'Extract action items',
    },
    { action: 'wb_ai_to_map', iconEl: Zap, pl: 'Zamień na mapę myśli', en: 'Convert to mind map' },
    { action: 'wb_ai_to_table', iconEl: Brain, pl: 'Zamień na tabelę', en: 'Convert to table' },
  ],
  process_flow: [
    {
      action: 'pf_analyze',
      iconEl: Search,
      pl: 'Analiza procesu (wąskie gardła)',
      en: 'Process analysis (bottlenecks)',
    },
  ],
  table: [
    {
      action: 'tbl_ai_assistant',
      iconEl: Wand2,
      pl: 'Asystent AI tabeli',
      en: 'Table AI assistant',
    },
    { action: 'tbl_categorize', iconEl: GitMerge, pl: 'Skategoryzuj AI', en: 'AI categorize' },
    {
      action: 'tbl_framework',
      iconEl: Lightbulb,
      pl: 'Generator frameworka',
      en: 'Framework generator',
    },
  ],
};

export const AIActionsPopover: React.FC<AIActionsPopoverProps> = ({
  isPl,
  activeTool = 'mindmap',
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

  const isMindmap = activeTool === 'mindmap';
  // Sekcja „dla zaznaczonego węzła" (mm_ai_expand_node / deepen / summarize_branch
  // / what_if) istnieje tylko w Mapie myśli — poza nią nie ma odbiornika.
  const hasNodeSelected = isMindmap && selection.type === 'node' && selection.count >= 1;
  const toolGenerators = TOOL_GENERATORS[activeTool] ?? [];

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
                {t(a.tkey, a.labelEn)}
              </button>
            );
          })}
        </div>
      )}

      {/* P1-1: poza Mapą myśli pokazujemy generatory TEJ reprezentacji
          (whiteboard/przepływ/tabela) — każdy ma realny handler w swoim hooku. */}
      {!isMindmap && (
        <div className="border-t border-c-border-subtle dark:border-c-border-subtle px-1 py-1">
          <div className="px-2 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
            <Sparkles size={10} className="inline mr-1" />
            {t('ideas.mindmap.aiGenerators', 'AI generators')}
          </div>
          {toolGenerators.map((a) => {
            const Icon = a.iconEl;
            return (
              <button
                key={a.action}
                onClick={() => dispatch(a.action)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[11px] text-c-text-secondary dark:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
              >
                <Icon size={12} className="text-c-text-secondary shrink-0" />
                <span className="flex-1 text-left">{isPl ? a.pl : a.en}</span>
              </button>
            );
          })}
        </div>
      )}

      {isMindmap && (
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
                <span className="flex-1 text-left">{t(a.tkey, a.labelEn)}</span>
                {comingSoon && (
                  <span className="text-[9px] italic text-c-text-secondary dark:text-c-text-secondary shrink-0">
                    {t('ideas.mindmap.comingSoon', 'Coming soon')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
