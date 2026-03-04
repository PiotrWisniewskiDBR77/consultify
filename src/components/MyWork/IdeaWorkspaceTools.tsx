/**
 * IdeaWorkspaceTools — Workspace tool panel for Idea Map Workspace.
 *
 * V3 upgrade: selection-aware, quick tools per mode, AI generators,
 * plus shared Workspace sections (AI, Transform, Share).
 */
import {
  Activity,
  ArrowDownUp,
  BarChart3,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Columns3,
  Diamond,
  Download,
  FileText,
  Filter,
  GitBranch,
  GitMerge,
  Group,
  Heart,
  LayoutGrid,
  Layers,
  ListChecks,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Mic,
  Network,
  Palette,
  Plus,
  Presentation,
  Redo2,
  Rocket,
  Save,
  Search,
  Shield,
  SmilePlus,
  Sparkles,
  Square,
  Star,
  StickyNote,
  StopCircle,
  Target,
  TrendingUp,
  Type,
  Undo2,
  Upload,
  Wand2,
  Zap,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  AIQuickActions,
  SectionLabel,
  ShareSection,
  ToolsPanelShell,
  TransformTextSection,
  type WorkspaceContext,
} from '@/components/shared/WorkspaceTools';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { generateAIProposal, type GeneratorType } from '@/services/ideaAIGenerator';
import { useAppStore } from '@/store/useAppStore';

import type { AIProposalBatch, CanvasToolType, IdeaWorkspaceSelection } from './ideaSelectionTypes';
import { IdeaCompletenessWidget } from './table/IdeaCompletenessWidget';

type ConvertTarget = 'initiative' | 'task_set' | 'decision' | 'team_chat' | 'report' | 'presentation' | 'action_plan' | 'raid_log';

interface IdeaWorkspaceToolsProps {
  open: boolean;
  onClose: () => void;

  ideaId: string;
  title: string;
  seedText: string;
  stage: string;
  branch: string;
  area: string;
  priority: number;
  isDraft: boolean;
  isAccepted: boolean;
  saving: boolean;
  draftSavedLabel: string;

  activeTool: CanvasToolType;
  selection: IdeaWorkspaceSelection;

  onTitleChange: (v: string) => void;
  onSeedTextChange: (v: string) => void;
  onBranchChange: (v: string) => void;
  onAreaChange: (v: string) => void;
  onPriorityChange: (v: number) => void;
  onSave: () => void;
  onAcceptChallenge: () => void;
  onConvert: (target: ConvertTarget) => void;
  onOpenChat: () => void;
  onFocusAICommand?: () => void;
  onGenerateProposal?: (batch: AIProposalBatch) => void;
  graphNodes?: any[];
  graphEdges?: any[];
  graphLanes?: any[];
  onOpenTemplates?: () => void;
}

export const IdeaWorkspaceTools: React.FC<IdeaWorkspaceToolsProps> = ({
  open,
  onClose,
  ideaId,
  title,
  seedText,
  stage,
  branch,
  area,
  priority,
  isDraft,
  isAccepted,
  saving,
  draftSavedLabel,
  activeTool,
  selection,
  onTitleChange,
  onSeedTextChange,
  onBranchChange,
  onAreaChange,
  onPriorityChange,
  onSave,
  onAcceptChallenge,
  onConvert,
  onOpenChat,
  onFocusAICommand,
  onGenerateProposal,
  graphNodes = [],
  graphEdges = [],
  graphLanes = [],
  onOpenTemplates,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const { setChatKickoffMessage, isChatCollapsed, toggleChatCollapse } = useAppStore();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'challenge' | 'ai' | 'metadata' | 'convert' | 'quick_tools'>(
    'challenge'
  );

  const wsContext: WorkspaceContext = useMemo(
    () => ({
      title,
      content: seedText,
      tags: [branch, area].filter(Boolean),
      entityType: 'idea',
      entityId: ideaId,
    }),
    [title, seedText, branch, area, ideaId]
  );

  const sendToChat = useCallback(
    (prompt: string) => {
      setChatKickoffMessage(prompt);
      if (isChatCollapsed) toggleChatCollapse();
    },
    [setChatKickoffMessage, isChatCollapsed, toggleChatCollapse]
  );

  const handleAIExpand = useCallback(() => {
    if (!isAccepted) {
      toast(isPl ? 'Najpierw zaakceptuj wyzwanie.' : 'Accept the challenge first.');
      setActiveTab('challenge');
      return;
    }
    const excerpt = (seedText || '').trim().slice(0, 2000);
    sendToChat(
      isPl
        ? `Na podstawie wyzwania "${title}" rozbuduj mapę rekomendacji. Zaproponuj 5-7 nowych gałęzi z konkretnymi akcjami.\n\nOpis:\n${excerpt}`
        : `Based on challenge "${title}", expand the recommendation map. Propose 5-7 new branches with concrete actions.\n\nDescription:\n${excerpt}`
    );
    trackFunnelEvent('notebook_transform_used', {});
    toast.success(isPl ? 'Wysłano do czata AI' : 'Sent to AI chat');
  }, [isAccepted, isPl, seedText, sendToChat, title]);

  // ── AI Generator (real LLM) ─────────────────────────────────────────────────
  const handleAIGenerate = useCallback(async (genType: GeneratorType) => {
    if (!isAccepted || !onGenerateProposal || generatingId) return;
    setGeneratingId(genType);
    try {
      const batch = await generateAIProposal({
        ideaId,
        generatorType: genType,
        tool: activeTool,
        context: {
          seedText,
          title,
          branch,
          area,
          existingNodes: graphNodes,
          existingEdges: graphEdges,
          existingLanes: graphLanes,
          language: i18n.language || 'en',
        },
      });
      onGenerateProposal(batch);
      toast.success(isPl ? 'Propozycja wygenerowana' : 'Proposal generated');
    } catch (err: any) {
      toast.error(err?.message || (isPl ? 'Nie udało się wygenerować' : 'Generation failed'));
    } finally {
      setGeneratingId(null);
    }
  }, [isAccepted, onGenerateProposal, generatingId, ideaId, activeTool, seedText, title, branch, area, graphNodes, graphEdges, graphLanes, i18n.language, isPl]);

  const handleGenerateLanes = useCallback(() => handleAIGenerate('lane_generator'), [handleAIGenerate]);
  const handleGenerateFlow = useCallback(() => handleAIGenerate('flow_generator'), [handleAIGenerate]);
  const handleGenerateTableColumns = useCallback(() => handleAIGenerate('table_columns'), [handleAIGenerate]);
  const handleGenerateTableView = useCallback(() => handleAIGenerate('table_views'), [handleAIGenerate]);
  const handleGenerateWBClusters = useCallback(() => handleAIGenerate('whiteboard_clusters'), [handleAIGenerate]);
  const handleGenerateWBBrainstorm = useCallback(() => handleAIGenerate('whiteboard_brainstorm'), [handleAIGenerate]);
  const handleGenerateWBOrganize = useCallback(() => handleAIGenerate('whiteboard_organize'), [handleAIGenerate]);
  const handleGenerateSummary = useCallback(() => handleAIGenerate('summary'), [handleAIGenerate]);
  const handleGenerateStickySummarize = useCallback(() => handleAIGenerate('sticky_summarize'), [handleAIGenerate]);
  const handleGenerateBottleneck = useCallback(() => handleAIGenerate('bottleneck'), [handleAIGenerate]);
  const handleGenerateVSM = useCallback(() => handleAIGenerate('vsm_generator'), [handleAIGenerate]);
  const handleGenerateVSMFuture = useCallback(() => handleAIGenerate('vsm_future_state' as GeneratorType), [handleAIGenerate]);
  const handleGenerateAutoCluster = useCallback(() => handleAIGenerate('auto_cluster' as GeneratorType), [handleAIGenerate]);

  // Mind Map AI generators
  const handleMMGenerateBranches = useCallback(() => handleAIGenerate('mm_branch_generator' as any), [handleAIGenerate]);
  const handleMMExpandBranch = useCallback(() => {
    window.dispatchEvent(new CustomEvent('idea-workspace-quick-action', { detail: { action: 'mm_ai_expand_branch' } }));
  }, []);
  const handleMMGapAnalysis = useCallback(() => handleAIGenerate('mm_gap_analysis' as any), [handleAIGenerate]);
  const handleMMDeepenNode = useCallback(() => handleAIGenerate('mm_deepen_node' as any), [handleAIGenerate]);
  const handleMMSummarize = useCallback(() => handleAIGenerate('mm_summarize' as any), [handleAIGenerate]);

  const selectionSummary = useMemo(() => {
    if (!selection || selection.type === 'none') return null;
    const c = selection.count;
    const typeLabels: Record<string, string> = {
      node: c === 1 ? (isPl ? '1 węzeł' : '1 node') : (isPl ? `${c} węzłów` : `${c} nodes`),
      edge: c === 1 ? (isPl ? '1 połączenie' : '1 edge') : (isPl ? `${c} połączeń` : `${c} edges`),
      lane: isPl ? '1 lane' : '1 lane',
      row: c === 1 ? (isPl ? '1 wiersz' : '1 row') : (isPl ? `${c} wierszy` : `${c} rows`),
    };
    return typeLabels[selection.type] || null;
  }, [isPl, selection]);

  const toolLabel = useMemo(() => {
    const labels: Record<CanvasToolType, string> = {
      mindmap: 'Mind Map',
      process_flow: isPl ? 'Przepływ' : 'Process Flow',
      table: isPl ? 'Tabela' : 'Table',
      whiteboard: isPl ? 'Tablica' : 'Whiteboard',
    };
    return labels[activeTool] || activeTool;
  }, [activeTool, isPl]);

  if (!open) return null;

  const tabs = [
    { id: 'challenge' as const, label: isPl ? 'Wyzwanie' : 'Challenge' },
    { id: 'quick_tools' as const, label: isPl ? 'Narzędzia' : 'Quick' },
    { id: 'ai' as const, label: 'AI' },
    { id: 'metadata' as const, label: isPl ? 'Meta' : 'Meta' },
    { id: 'convert' as const, label: isPl ? 'Konwersja' : 'Convert' },
  ];

  const convertActions: {
    id: ConvertTarget;
    icon: React.ComponentType<any>;
    labelPl: string;
    labelEn: string;
    descPl: string;
    descEn: string;
    gradient: string;
    textColor: string;
  }[] = [
    {
      id: 'initiative',
      icon: Rocket,
      labelPl: 'Inicjatywa',
      labelEn: 'Initiative',
      descPl: 'Utwórz w PMO',
      descEn: 'Create in PMO',
      gradient: 'from-amber-500/15 to-orange-500/10',
      textColor: 'text-amber-600 dark:text-amber-400',
    },
    {
      id: 'task_set',
      icon: CheckSquare,
      labelPl: 'Taski',
      labelEn: 'Tasks',
      descPl: 'Z next steps',
      descEn: 'From next steps',
      gradient: 'from-emerald-500/15 to-green-500/10',
      textColor: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      id: 'decision',
      icon: Star,
      labelPl: 'Decyzja',
      labelEn: 'Decision',
      descPl: 'Artefakt decyzyjny',
      descEn: 'Decision artifact',
      gradient: 'from-blue-500/15 to-cyan-500/10',
      textColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      id: 'team_chat',
      icon: MessageSquarePlus,
      labelPl: 'Team Chat',
      labelEn: 'Team Chat',
      descPl: 'Wątek do omówienia',
      descEn: 'Discussion thread',
      gradient: 'from-violet-500/15 to-purple-500/10',
      textColor: 'text-violet-600 dark:text-violet-400',
    },
    {
      id: 'report',
      icon: FileText,
      labelPl: 'Raport',
      labelEn: 'Report',
      descPl: 'Generuj raport z mapy',
      descEn: 'Generate report from map',
      gradient: 'from-slate-500/15 to-gray-500/10',
      textColor: 'text-slate-600 dark:text-slate-400',
    },
    {
      id: 'presentation',
      icon: Presentation,
      labelPl: 'Prezentacja',
      labelEn: 'Presentation',
      descPl: 'Generuj slajdy z gałęzi',
      descEn: 'Generate slides from branches',
      gradient: 'from-indigo-500/15 to-blue-500/10',
      textColor: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      id: 'action_plan',
      icon: ListChecks,
      labelPl: 'Plan działania',
      labelEn: 'Action Plan',
      descPl: 'Plan z timeline',
      descEn: 'Plan with timeline',
      gradient: 'from-teal-500/15 to-cyan-500/10',
      textColor: 'text-teal-600 dark:text-teal-400',
    },
    {
      id: 'raid_log',
      icon: Shield,
      labelPl: 'RAID Log',
      labelEn: 'RAID Log',
      descPl: 'Risks, Actions, Issues, Dependencies',
      descEn: 'Risks, Actions, Issues, Dependencies',
      gradient: 'from-red-500/15 to-orange-500/10',
      textColor: 'text-red-600 dark:text-red-400',
    },
  ];

  const priorityOptions = [
    { value: 25, label: isPl ? 'Niski' : 'Low' },
    { value: 50, label: isPl ? 'Średni' : 'Medium' },
    { value: 75, label: isPl ? 'Wysoki' : 'High' },
    { value: 100, label: isPl ? 'Krytyczny' : 'Critical' },
  ];

  const stageLabel = (() => {
    const s = String(stage || '').toLowerCase();
    if (s === 'incubating') return isPl ? 'Inkubacja' : 'Incubating';
    if (s === 'shaping') return isPl ? 'Kształtuje się' : 'Shaping';
    if (s === 'ready') return isPl ? 'Gotowy' : 'Ready';
    if (s === 'promoted') return isPl ? 'Promowany' : 'Promoted';
    return isPl ? 'Iskra' : 'Spark';
  })();

  return (
    <ToolsPanelShell
      title={isPl ? 'Narzędzia' : 'Tools'}
      subtitle={toolLabel}
      icon={
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-sm shadow-amber-500/20">
          <GitBranch size={13} className="text-white" />
        </div>
      }
      onClose={onClose}
    >
      {/* ─── Stage badge + selection summary ─── */}
      <div className="px-3 pt-3 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-400/20 to-orange-400/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
            {stageLabel}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{draftSavedLabel}</span>
          {selectionSummary && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 text-[10px] font-bold">
              {selectionSummary}
            </span>
          )}
        </div>
      </div>

      {/* ─── Tab switcher ─── */}
      <div className="px-3 py-2 border-b border-slate-200/30 dark:border-white/[0.04]">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap ${
                activeTab === t.id
                  ? 'bg-gradient-to-r from-amber-500/15 to-orange-500/10 text-amber-700 dark:text-amber-300 shadow-sm'
                  : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Quick Tools tab (mode-specific) ─── */}
      {activeTab === 'quick_tools' && (
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{toolLabel} — {isPl ? 'Szybkie narzędzia' : 'Quick tools'}</SectionLabel>

          {/* Templates button */}
          {onOpenTemplates && (activeTool === 'process_flow' || activeTool === 'mindmap') && (
            <button
              type="button"
              onClick={onOpenTemplates}
              disabled={!isAccepted}
              className="w-full mb-2 flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:shadow-sm hover:bg-slate-50 dark:hover:bg-white/[0.02] disabled:opacity-40"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500/15 to-teal-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Layers size={12} />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                  {isPl ? 'Szablony' : 'Templates'}
                </div>
                <div className="text-[9px] text-slate-400 dark:text-slate-500">
                  {isPl ? 'Gotowe schematy' : 'Pre-built layouts'}
                </div>
              </div>
            </button>
          )}

          {/* Selection-driven node properties panel */}
          {selection.type === 'node' && selection.count === 1 && selection.primaryId && (
            <NodePropertiesPanel
              nodeId={selection.primaryId}
              meta={selection.meta || {}}
              isPl={isPl}
              locked={!isAccepted}
            />
          )}
          {selection.type !== 'none' && selection.count !== 1 && selection.meta?.label && (
            <div className="mb-3 p-2 rounded-xl bg-primary-500/5 border border-primary-500/10">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary-600/80 dark:text-primary-400/80 mb-1">
                {isPl ? 'Zaznaczenie' : 'Selection'} ({selection.count})
              </div>
              <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
                {selection.meta.label}
              </div>
            </div>
          )}

          {/* MindMap quick tools */}
          {activeTool === 'mindmap' && (
            <div className="space-y-1.5">
              <QuickToolBtn icon={Plus} label={isPl ? 'Dodaj gałąź (Tab)' : 'Add child (Tab)'} action="mm_add_child" disabled={!isAccepted} />
              <QuickToolBtn icon={Plus} label={isPl ? 'Dodaj sąsiada (Enter)' : 'Add sibling (Enter)'} action="mm_add_sibling" disabled={!isAccepted} />
              <QuickToolBtn icon={Layers} label={isPl ? 'Zwiń/Rozwiń (Space)' : 'Collapse/Expand (Space)'} action="mm_toggle_collapse" disabled={!isAccepted} />
              <QuickToolBtn icon={LayoutGrid} label={isPl ? 'Auto-układ' : 'Auto-layout'} action="mm_auto_layout" disabled={!isAccepted} />

              {/* Undo / Redo */}
              <div className="flex items-center gap-1 pt-1">
                <QuickToolBtn icon={Undo2} label={isPl ? 'Cofnij (Ctrl+Z)' : 'Undo (Ctrl+Z)'} action="mm_undo" disabled={!isAccepted} />
                <QuickToolBtn icon={Redo2} label={isPl ? 'Ponów (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z)'} action="mm_redo" disabled={!isAccepted} />
              </div>

              {/* Export */}
              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Eksport' : 'Export'}</SectionLabel>
                <div className="space-y-1.5">
                  <QuickToolBtn icon={Download} label={isPl ? 'Eksportuj mapę (PNG/SVG/JSON)' : 'Export map (PNG/SVG/JSON)'} action="mm_export" disabled={!isAccepted} />
                  <QuickToolBtn icon={Presentation} label={isPl ? 'Eksport prezentacji' : 'Export presentation'} action="mm_export_pptx" disabled={!isAccepted} />
                  <QuickToolBtn icon={FileText} label={isPl ? 'Osadź w raporcie' : 'Embed in report'} action="mm_embed_report" disabled={!isAccepted} />
                </div>
              </div>

              {/* Visual Modes */}
              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Tryby wizualne' : 'Visual Modes'}</SectionLabel>
                <div className="space-y-1.5">
                  <QuickToolBtn icon={Group} label={isPl ? 'Bąbelki klastrów' : 'Cluster bubbles'} action="mm_toggle_bubbles" disabled={!isAccepted} />
                  <QuickToolBtn icon={Layers} label={isPl ? 'Mapa ciepła' : 'Heatmap mode'} action="mm_toggle_heatmap" disabled={!isAccepted} />
                  <QuickToolBtn icon={Zap} label={isPl ? 'Cząsteczki na liniach' : 'Particle flow'} action="mm_toggle_particles" disabled={!isAccepted} />
                </div>
              </div>

              {/* Workflow */}
              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Przepływ pracy' : 'Workflow'}</SectionLabel>
                <div className="space-y-1.5">
                  <QuickToolBtn icon={Rocket} label={isPl ? 'Konwersja zbiorcza' : 'Batch convert'} action="mm_batch_convert" disabled={!isAccepted} />
                  <QuickToolBtn icon={Presentation} label={isPl ? 'Tryb prezentacji' : 'Presentation mode'} action="mm_presentation" disabled={!isAccepted} />
                  <QuickToolBtn icon={ListChecks} label={isPl ? 'Oś czasu' : 'Timeline view'} action="mm_timeline" disabled={!isAccepted} />
                  <QuickToolBtn icon={Save} label={isPl ? 'Historia snapshotów' : 'Snapshot history'} action="mm_snapshots" disabled={!isAccepted} />
                </div>
              </div>

              {/* AI Generators */}
              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Generatory AI' : 'AI Generators'}</SectionLabel>
                <div className="space-y-1.5">
                  <GeneratorBtn icon={Wand2} label={isPl ? 'Generuj gałęzie' : 'Generate branches'} onClick={handleMMGenerateBranches} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'mm_branch_generator'} />
                  <GeneratorBtn icon={Sparkles} label={isPl ? 'Rozbuduj wybraną gałąź' : 'Expand selected branch'} onClick={handleMMExpandBranch} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={false} />
                  <GeneratorBtn icon={Search} label={isPl ? 'Analiza luk (gap analysis)' : 'Gap analysis'} onClick={handleMMGapAnalysis} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'mm_gap_analysis'} />
                  <GeneratorBtn icon={Target} label={isPl ? 'Pogłęb wybrany temat' : 'Deepen selected topic'} onClick={handleMMDeepenNode} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'mm_deepen_node'} />
                  <GeneratorBtn icon={Zap} label={isPl ? 'Podsumuj gałąź' : 'Summarize branch'} onClick={handleMMSummarize} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'mm_summarize'} />
                  <QuickToolBtn icon={GitBranch} label={isPl ? 'Co jeśli...? (What-If)' : 'What if...? (What-If)'} action="mm_what_if" disabled={!isAccepted} />
                </div>
              </div>

              {/* AI Deep Intelligence */}
              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'AI: Inteligencja' : 'AI: Intelligence'}</SectionLabel>
                <div className="space-y-1.5">
                  <QuickToolBtn icon={Network} label={isPl ? 'Wykryj zależności' : 'Detect dependencies'} action="mm_dependency_detect" disabled={!isAccepted} />
                  <QuickToolBtn icon={Target} label={isPl ? 'Priorytetyzacja AI' : 'AI Priority'} action="mm_priority_recommender" disabled={!isAccepted} />
                  <QuickToolBtn icon={Group} label={isPl ? 'Auto-klastry AI' : 'AI Auto-Clustering'} action="mm_auto_clustering" disabled={!isAccepted} />
                  <QuickToolBtn icon={SmilePlus} label={isPl ? 'Analiza sentymentu' : 'Sentiment analysis'} action="mm_sentiment_analysis" disabled={!isAccepted} />
                </div>
              </div>

              {/* Collaboration */}
              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Współpraca' : 'Collaboration'}</SectionLabel>
                <div className="space-y-1.5">
                  <QuickToolBtn icon={MessageSquare} label={isPl ? 'Komentarze do węzła' : 'Node comments'} action="mm_comments" disabled={!isAccepted} />
                  <QuickToolBtn icon={Activity} label={isPl ? 'Aktywność' : 'Activity feed'} action="mm_activity_feed" disabled={!isAccepted} />
                </div>
              </div>

              {/* Analytics */}
              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Analityka' : 'Analytics'}</SectionLabel>
                <div className="space-y-1.5">
                  <QuickToolBtn icon={Heart} label={isPl ? 'Zdrowie mapy' : 'Map health'} action="mm_toggle_health" disabled={!isAccepted} />
                  <QuickToolBtn icon={TrendingUp} label={isPl ? 'Lejek pomysłów' : 'Idea funnel'} action="mm_funnel_analytics" disabled={!isAccepted} />
                  <QuickToolBtn icon={GitMerge} label={isPl ? 'Układ promieniowy' : 'Radial layout'} action="mm_radial_layout" disabled={!isAccepted} />
                </div>
              </div>

              {/* Import */}
              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Import' : 'Import'}</SectionLabel>
                <div className="space-y-1.5">
                  <QuickToolBtn icon={Mic} label={isPl ? 'Mów pomysły (Voice)' : 'Voice to Node'} action="mm_voice" disabled={!isAccepted} />
                  <QuickToolBtn icon={Upload} label={isPl ? 'Dokument → Mapa' : 'Document → Map'} action="mm_doc_to_map" disabled={!isAccepted} />
                  <QuickToolBtn icon={MessageSquare} label={isPl ? 'Wywiady → Mapa' : 'Interviews → Map'} action="mm_interview_to_map" disabled={!isAccepted} />
                </div>
              </div>
            </div>
          )}

          {/* Process Flow quick tools + AI generators */}
          {activeTool === 'process_flow' && (
            <div className="space-y-1.5">
              <QuickToolBtn icon={CircleDot} label="Start" action="pf_add_start" disabled={!isAccepted} />
              <QuickToolBtn icon={Square} label={isPl ? 'Akcja' : 'Action'} action="pf_add_action" disabled={!isAccepted} />
              <QuickToolBtn icon={Diamond} label={isPl ? 'Decyzja' : 'Decision'} action="pf_add_decision" disabled={!isAccepted} />
              <QuickToolBtn icon={StopCircle} label={isPl ? 'Koniec' : 'End'} action="pf_add_end" disabled={!isAccepted} />
              <QuickToolBtn icon={Plus} label="Lane" action="pf_add_lane" disabled={!isAccepted} />
              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Generatory AI' : 'AI Generators'}</SectionLabel>
                <div className="space-y-1.5">
                  <GeneratorBtn icon={Wand2} label={isPl ? 'Generuj lane\'y' : 'Generate lanes'} onClick={handleGenerateLanes} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'lane_generator'} />
                  <GeneratorBtn icon={Zap} label={isPl ? 'Generuj przepływ' : 'Generate flow'} onClick={handleGenerateFlow} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'flow_generator'} />
                  <GeneratorBtn icon={Shield} label={isPl ? 'AI: Wykryj wąskie gardła' : 'AI: Detect bottlenecks'} onClick={handleGenerateBottleneck} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'bottleneck'} />
                  <GeneratorBtn icon={Wand2} label={isPl ? 'AI: Generuj VSM' : 'AI: Generate VSM'} onClick={handleGenerateVSM} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'vsm_generator'} />
                  <GeneratorBtn icon={Zap} label={isPl ? 'AI: VSM Stan Przyszły' : 'AI: VSM Future State'} onClick={handleGenerateVSMFuture} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'vsm_future_state'} />
                </div>
              </div>
            </div>
          )}

          {/* Table quick tools + AI generators */}
          {activeTool === 'table' && (
            <div className="space-y-1.5">
              <QuickToolBtn icon={Columns3} label={isPl ? 'Dodaj kolumnę' : 'Add column'} action="tbl_add_column" disabled={!isAccepted} />
              <QuickToolBtn icon={ArrowDownUp} label={isPl ? 'Sortuj' : 'Sort'} action="tbl_sort" disabled={!isAccepted} />
              <QuickToolBtn icon={Filter} label={isPl ? 'Filtruj' : 'Filter'} action="tbl_filter" disabled={!isAccepted} />
              <QuickToolBtn icon={Sparkles} label={isPl ? 'Asystent AI (/)' : 'AI Assistant (/)'} action="tbl_ai_assistant" disabled={!isAccepted} />
              <QuickToolBtn icon={LayoutGrid} label={isPl ? 'Framework' : 'Framework'} action="tbl_framework" disabled={!isAccepted} />
              <QuickToolBtn icon={Download} label={isPl ? 'Eksportuj CSV' : 'Export CSV'} action="tbl_export_csv" disabled={!isAccepted} />

              {/* View layout shortcuts */}
              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Widoki' : 'Views'}</SectionLabel>
                <div className="space-y-1.5">
                  <QuickToolBtn icon={Layers} label="Kanban" action="tbl_kanban" disabled={!isAccepted} />
                  <QuickToolBtn icon={Target} label="Matrix" action="tbl_matrix" disabled={!isAccepted} />
                  <QuickToolBtn icon={StickyNote} label={isPl ? 'Karteczki' : 'Sticky Notes'} action="tbl_sticky" disabled={!isAccepted} />
                  <QuickToolBtn icon={BarChart3} label={isPl ? 'Podsumowanie' : 'Summary'} action="tbl_summary" disabled={!isAccepted} />
                  <QuickToolBtn icon={Palette} label={isPl ? 'Paleta kolorów' : 'Color Palette'} action="tbl_color_palette" disabled={!isAccepted} />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Generatory AI' : 'AI Generators'}</SectionLabel>
                <div className="space-y-1.5">
                  <GeneratorBtn icon={Columns3} label={isPl ? 'Generuj kolumny' : 'Generate columns'} onClick={handleGenerateTableColumns} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'table_columns'} />
                  <GeneratorBtn icon={Layers} label={isPl ? 'Generuj widoki' : 'Generate views'} onClick={handleGenerateTableView} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'table_views'} />
                </div>
              </div>
            </div>
          )}

          {/* Whiteboard quick tools + AI generators */}
          {activeTool === 'whiteboard' && (
            <div className="space-y-1.5">
              <QuickToolBtn icon={StickyNote} label={isPl ? 'Notatka' : 'Sticky note'} action="wb_add_sticky" disabled={!isAccepted} />
              <QuickToolBtn icon={Type} label={isPl ? 'Tekst' : 'Text'} action="wb_add_text" disabled={!isAccepted} />
              <QuickToolBtn icon={Group} label={isPl ? 'Grupa' : 'Group'} action="wb_add_group" disabled={!isAccepted} />

              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Metryki i dane' : 'Metrics & Data'}</SectionLabel>
                <div className="space-y-1.5">
                  <QuickToolBtn icon={TrendingUp} label={isPl ? 'KPI Badge' : 'KPI Badge'} action="wb_add_kpi" disabled={!isAccepted} />
                  <QuickToolBtn icon={Target} label={isPl ? 'Wynik / Score' : 'Score Node'} action="wb_add_score" disabled={!isAccepted} />
                  <QuickToolBtn icon={BarChart3} label={isPl ? 'Pasek postępu' : 'Progress Bar'} action="wb_add_progress" disabled={!isAccepted} />
                  <QuickToolBtn icon={FileText} label={isPl ? 'Karta podsumowania' : 'Summary Card'} action="wb_add_summary" disabled={!isAccepted} />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/20 dark:border-white/[0.04]">
                <SectionLabel>{isPl ? 'Generatory AI' : 'AI Generators'}</SectionLabel>
                <div className="space-y-1.5">
                  <GeneratorBtn icon={Sparkles} label={isPl ? 'AI: Brainstorm' : 'AI: Brainstorm'} onClick={handleGenerateWBBrainstorm} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'whiteboard_brainstorm'} />
                  <GeneratorBtn icon={Layers} label={isPl ? 'AI: Klastry tematyczne' : 'AI: Thematic clusters'} onClick={handleGenerateWBClusters} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'whiteboard_clusters'} />
                  <GeneratorBtn icon={Group} label={isPl ? 'AI: Auto-klastry' : 'AI: Auto-cluster'} onClick={handleGenerateAutoCluster} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'auto_cluster'} />
                  <GeneratorBtn icon={Wand2} label={isPl ? 'AI: Organizuj' : 'AI: Organize'} onClick={handleGenerateWBOrganize} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'whiteboard_organize'} />
                  <GeneratorBtn icon={Layers} label={isPl ? 'AI: Podsumuj zaznaczone' : 'AI: Summarize selected'} onClick={handleGenerateStickySummarize} disabled={!isAccepted || !!generatingId} isPl={isPl} loading={generatingId === 'sticky_summarize'} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Challenge tab ─── */}
      {activeTab === 'challenge' && (
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Tytuł' : 'Title'}</SectionLabel>
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder={isPl ? 'Tytuł wyzwania…' : 'Challenge title…'}
            className="w-full mb-3 px-3 py-2 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] text-xs font-semibold text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400/40 transition-all"
          />
          <SectionLabel>{isPl ? 'Opis wyzwania' : 'Challenge description'}</SectionLabel>
          <textarea
            value={seedText}
            onChange={(e) => onSeedTextChange(e.target.value)}
            rows={6}
            placeholder={isPl ? 'Opisz problem lub pomysł…' : 'Describe the problem or idea…'}
            className="w-full px-3 py-2 rounded-xl border border-slate-200/60 dark:border-white/[0.06] bg-white/50 dark:bg-white/[0.02] text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-400/40 resize-none transition-all"
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={onSave}
              disabled={saving || isDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-emerald-500/12 to-teal-500/8 text-emerald-700 dark:text-emerald-300 hover:from-emerald-500/20 hover:to-teal-500/15 border border-emerald-500/10 hover:border-emerald-500/20 transition-all disabled:opacity-50"
            >
              <Save size={11} />
              {isPl ? 'Zapisz' : 'Save'}
            </button>
            <button
              onClick={onAcceptChallenge}
              disabled={saving || isDraft || !seedText.trim() || isAccepted}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-amber-500/12 to-orange-500/8 text-amber-700 dark:text-amber-300 hover:from-amber-500/20 hover:to-orange-500/15 border border-amber-500/10 hover:border-amber-500/20 transition-all disabled:opacity-50"
              title={isAccepted ? (isPl ? 'Zaakceptowane' : 'Accepted') : undefined}
            >
              <CheckCircle2 size={11} />
              {isAccepted ? (isPl ? 'Zaakceptowane' : 'Accepted') : isPl ? 'Akceptuj' : 'Accept'}
            </button>
          </div>
        </div>
      )}

      {/* ─── AI tab ─── */}
      {activeTab === 'ai' && (
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'AI: rozbudowa mapy' : 'AI: expand the map'}</SectionLabel>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">
            {isPl
              ? 'Wybierz gałąź na mapie, potem kliknij AI na mapie. Lub użyj przycisku poniżej.'
              : 'Pick a branch on the map, then click AI on the map. Or use the button below.'}
          </div>
          {!isAccepted && (
            <div className="text-[11px] text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-400/20 rounded-xl p-2.5 mb-3">
              {isPl
                ? 'Zaakceptuj wyzwanie, aby odblokować AI.'
                : 'Accept the challenge to unlock AI.'}
            </div>
          )}
          <button
            onClick={handleAIExpand}
            disabled={!isAccepted}
            className="group w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all duration-200 hover:shadow-md disabled:opacity-40"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-indigo-500/8 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="relative w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/15 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
              <Sparkles size={16} />
            </div>
            <div className="relative flex-1 min-w-0 text-left">
              <div className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                {isPl ? 'Rozbuduj mapę z AI' : 'Expand map with AI'}
              </div>
              <div className="text-[9px] text-slate-400 dark:text-slate-500">
                {isPl ? 'Zaproponuje nowe gałęzie' : 'Will propose new branches'}
              </div>
            </div>
          </button>

          <div className="mt-3 pt-3 border-t border-slate-200/20 dark:border-white/[0.04]">
            <SectionLabel>{isPl ? 'AI: Podsumowanie' : 'AI: Summarize'}</SectionLabel>
            <GeneratorBtn
              icon={Target}
              label={isPl ? 'Podsumuj mapę' : 'Summarize map'}
              onClick={handleGenerateSummary}
              disabled={!isAccepted || !!generatingId}
              isPl={isPl}
              loading={generatingId === 'summary'}
            />
          </div>
        </div>
      )}

      {/* ─── Metadata tab ─── */}
      {activeTab === 'metadata' && (
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Metadane' : 'Metadata'}</SectionLabel>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400/80">
                {isPl ? 'Gałąź' : 'Branch'}
              </div>
              <input
                value={branch}
                onChange={(e) => onBranchChange(e.target.value)}
                placeholder={isPl ? 'np. Finanse' : 'e.g. Finance'}
                className="w-full h-8 px-2.5 rounded-lg text-[11px] bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400/80">
                {isPl ? 'Obszar' : 'Area'}
              </div>
              <input
                value={area}
                onChange={(e) => onAreaChange(e.target.value)}
                placeholder={isPl ? 'np. Operacje' : 'e.g. Ops'}
                className="w-full h-8 px-2.5 rounded-lg text-[11px] bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 placeholder:text-slate-400/60 focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
              />
            </div>
            <div className="space-y-1">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400/80">
                {isPl ? 'Priorytet' : 'Priority'}
              </div>
              <div className="relative">
                <select
                  value={String(Math.max(25, Math.min(100, Math.round(priority / 25) * 25)) || 25)}
                  onChange={(e) => onPriorityChange(Number(e.target.value))}
                  className="appearance-none w-full h-8 px-2.5 pr-7 rounded-lg text-[11px] bg-white/50 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/[0.06] text-slate-800 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-amber-500/30 transition-all"
                >
                  {priorityOptions.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={10}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                />
              </div>
            </div>
            <button
              onClick={onSave}
              disabled={saving}
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-100/80 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/[0.06] transition-all disabled:opacity-50"
            >
              <Save size={11} />
              {isPl ? 'Zapisz metadane' : 'Save metadata'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Convert tab ─── */}
      {activeTab === 'convert' && (
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <SectionLabel>{isPl ? 'Konwersja' : 'Convert'}</SectionLabel>
          {selection.type !== 'none' && selection.count > 0 && (
            <div className="mb-2 text-[10px] text-primary-600 dark:text-primary-400 bg-primary-500/5 rounded-lg px-2 py-1.5">
              {isPl ? `Konwertuj zaznaczenie (${selection.count})` : `Convert selection (${selection.count})`}
            </div>
          )}
          <div className="grid grid-cols-1 gap-1.5">
            {convertActions.map(
              ({ id, icon: Icon, labelPl, labelEn, descPl, descEn, gradient, textColor }) => (
                <button
                  key={id}
                  onClick={() => onConvert(id)}
                  disabled={isDraft}
                  className="group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md disabled:opacity-40"
                >
                  <div
                    className={`absolute inset-0 bg-gradient-to-br ${gradient} group-hover:opacity-150 transition-opacity`}
                  />
                  <div className="absolute inset-0 border border-current/[0.06] group-hover:border-current/[0.12] rounded-xl transition-colors" />
                  <div
                    className={`relative w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center ${textColor} shrink-0`}
                  >
                    <Icon size={14} />
                  </div>
                  <div className="relative flex-1 min-w-0 text-left">
                    <div className={`text-[11px] font-bold ${textColor}`}>
                      {isPl ? labelPl : labelEn}
                    </div>
                    <div className="text-[9px] text-slate-400 dark:text-slate-500">
                      {isPl ? descPl : descEn}
                    </div>
                  </div>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* ─── Idea Completeness ─── */}
      {graphNodes.length > 0 && (
        <div className="px-3 py-3 border-b border-slate-200/30 dark:border-white/[0.04]">
          <IdeaCompletenessWidget
            nodes={graphNodes}
            edges={graphEdges}
            title={title}
            seedText={seedText}
          />
        </div>
      )}

      {/* ─── AI Quick Actions (shared) ─── */}
      <AIQuickActions isPl={isPl} onFocusAICommand={onFocusAICommand} onOpenAIChat={onOpenChat} />

      {/* ─── Transform (shared) ─── */}
      <TransformTextSection isPl={isPl} context={wsContext} />

      {/* ─── Share (shared) ─── */}
      <ShareSection isPl={isPl} context={wsContext} />
    </ToolsPanelShell>
  );
};

// ── Helper components ─────────────────────────────────────────────────────────

const QuickToolBtn: React.FC<{
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  action: string;
  disabled?: boolean;
}> = ({ icon: Icon, label, action, disabled }) => (
  <button
    type="button"
    onClick={() => {
      trackFunnelEvent('ideas_quick_tool_used', { action });
      window.dispatchEvent(new CustomEvent('idea-workspace-quick-action', { detail: { action } }));
    }}
    disabled={disabled}
    className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[11px] font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/60 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-40"
  >
    <Icon size={14} />
    {label}
  </button>
);

// ── Node Properties Panel ────────────────────────────────────────────────────

const NODE_STATUS_OPTIONS = [
  { value: 'todo', labelEn: 'To Do', labelPl: 'Do zrobienia', color: 'bg-slate-200 text-slate-700' },
  { value: 'in_progress', labelEn: 'In Progress', labelPl: 'W toku', color: 'bg-blue-100 text-blue-700' },
  { value: 'done', labelEn: 'Done', labelPl: 'Gotowe', color: 'bg-green-100 text-green-700' },
  { value: 'blocked', labelEn: 'Blocked', labelPl: 'Zablokowane', color: 'bg-red-100 text-red-700' },
];

const NodePropertiesPanel: React.FC<{
  nodeId: string;
  meta: Record<string, any>;
  isPl: boolean;
  locked: boolean;
}> = ({ nodeId, meta, isPl, locked }) => {
  const [description, setDescription] = useState(meta?.description || '');
  const [owner, setOwner] = useState(meta?.owner || '');
  const [duration, setDuration] = useState(meta?.duration || '');
  const [durationUnit, setDurationUnit] = useState(meta?.durationUnit || 'h');
  const [status, setStatus] = useState(meta?.status || 'todo');
  const [tags, setTags] = useState(meta?.tags?.join(', ') || '');
  const [artifactRef, setArtifactRef] = useState(meta?.artifactRef || '');

  const dispatchUpdate = useCallback((data: Record<string, any>) => {
    window.dispatchEvent(
      new CustomEvent('idea-workspace-node-update', { detail: { nodeId, data } })
    );
  }, [nodeId]);

  const handleBlur = useCallback((field: string, value: any) => {
    dispatchUpdate({ [field]: value });
  }, [dispatchUpdate]);

  return (
    <div className="mb-3 p-2.5 rounded-xl bg-primary-500/5 border border-primary-500/10 space-y-2">
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-primary-600/80 dark:text-primary-400/80">
        {isPl ? 'Właściwości węzła' : 'Node Properties'}
      </div>

      {/* Label (read-only display) */}
      <div>
        <div className="text-[11px] font-medium text-slate-800 dark:text-slate-200 truncate">
          {meta?.label || nodeId}
        </div>
        {meta?.shape && (
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {isPl ? 'Kształt' : 'Shape'}: {meta.shape}
          </div>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {isPl ? 'Opis' : 'Description'}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={() => handleBlur('description', description)}
          disabled={locked}
          rows={2}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg border border-slate-200/60 dark:border-navy-600/60 bg-white/60 dark:bg-navy-800/60 text-slate-700 dark:text-slate-200 outline-none focus:border-primary-400 resize-none disabled:opacity-50"
          placeholder={isPl ? 'Opis kroku…' : 'Step description…'}
        />
      </div>

      {/* Owner */}
      <div>
        <label className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {isPl ? 'Właściciel' : 'Owner'}
        </label>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          onBlur={() => handleBlur('owner', owner)}
          disabled={locked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg border border-slate-200/60 dark:border-navy-600/60 bg-white/60 dark:bg-navy-800/60 text-slate-700 dark:text-slate-200 outline-none focus:border-primary-400 disabled:opacity-50"
          placeholder={isPl ? 'Osoba odpowiedzialna' : 'Responsible person'}
        />
      </div>

      {/* Duration */}
      <div>
        <label className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {isPl ? 'Czas trwania' : 'Duration'}
        </label>
        <div className="flex gap-1 mt-0.5">
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            onBlur={() => handleBlur('duration', duration)}
            disabled={locked}
            min={0}
            className="flex-1 px-2 py-1 text-[11px] rounded-lg border border-slate-200/60 dark:border-navy-600/60 bg-white/60 dark:bg-navy-800/60 text-slate-700 dark:text-slate-200 outline-none focus:border-primary-400 disabled:opacity-50"
            placeholder="0"
          />
          <select
            value={durationUnit}
            onChange={(e) => { setDurationUnit(e.target.value); handleBlur('durationUnit', e.target.value); }}
            disabled={locked}
            className="px-1.5 py-1 text-[11px] rounded-lg border border-slate-200/60 dark:border-navy-600/60 bg-white/60 dark:bg-navy-800/60 text-slate-700 dark:text-slate-200 outline-none disabled:opacity-50"
          >
            <option value="m">{isPl ? 'min' : 'min'}</option>
            <option value="h">{isPl ? 'godz' : 'hrs'}</option>
            <option value="d">{isPl ? 'dni' : 'days'}</option>
            <option value="w">{isPl ? 'tyg' : 'wks'}</option>
          </select>
        </div>
      </div>

      {/* Status */}
      <div>
        <label className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); handleBlur('status', e.target.value); }}
          disabled={locked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg border border-slate-200/60 dark:border-navy-600/60 bg-white/60 dark:bg-navy-800/60 text-slate-700 dark:text-slate-200 outline-none focus:border-primary-400 disabled:opacity-50"
        >
          {NODE_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{isPl ? opt.labelPl : opt.labelEn}</option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {isPl ? 'Tagi' : 'Tags'}
        </label>
        <input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          onBlur={() => handleBlur('tags', tags.split(',').map((t: string) => t.trim()).filter(Boolean))}
          disabled={locked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg border border-slate-200/60 dark:border-navy-600/60 bg-white/60 dark:bg-navy-800/60 text-slate-700 dark:text-slate-200 outline-none focus:border-primary-400 disabled:opacity-50"
          placeholder={isPl ? 'tag1, tag2, tag3' : 'tag1, tag2, tag3'}
        />
      </div>

      {/* Artifact reference */}
      <div>
        <label className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {isPl ? 'Link do artefaktu' : 'Artifact link'}
        </label>
        <input
          type="text"
          value={artifactRef}
          onChange={(e) => setArtifactRef(e.target.value)}
          onBlur={() => handleBlur('artifactRef', artifactRef)}
          disabled={locked}
          className="w-full mt-0.5 px-2 py-1 text-[11px] rounded-lg border border-slate-200/60 dark:border-navy-600/60 bg-white/60 dark:bg-navy-800/60 text-slate-700 dark:text-slate-200 outline-none focus:border-primary-400 disabled:opacity-50"
          placeholder={isPl ? 'ID lub URL artefaktu' : 'Artifact ID or URL'}
        />
      </div>
    </div>
  );
};

const GeneratorBtn: React.FC<{
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isPl: boolean;
  loading?: boolean;
}> = ({ icon: Icon, label, onClick, disabled, isPl, loading }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled || loading}
    className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all duration-200 hover:shadow-sm disabled:opacity-40"
  >
    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500/15 to-indigo-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
    </div>
    <div className="flex-1 min-w-0 text-left">
      <div className="text-[11px] font-bold text-violet-700 dark:text-violet-300">{label}</div>
      <div className="text-[9px] text-slate-400 dark:text-slate-500">
        {loading ? (isPl ? 'Generuję…' : 'Generating…') : 'Propose → Accept'}
      </div>
    </div>
    {!loading && <Sparkles size={10} className="text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
  </button>
);

export default IdeaWorkspaceTools;
