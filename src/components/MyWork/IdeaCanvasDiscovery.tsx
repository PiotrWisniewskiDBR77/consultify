import {
  BadgeCheck,
  BookOpen,
  Bot,
  Box,
  BriefcaseBusiness,
  Brush,
  Building2,
  CircleDot,
  Database,
  Diamond,
  Download,
  FileBarChart2,
  Flag,
  Frame,
  Gauge,
  GitBranch,
  Group,
  History,
  LayoutTemplate,
  Library,
  Lightbulb,
  LocateFixed,
  Map,
  MessageSquareMore,
  Minus,
  Network,
  NotebookPen,
  Palette,
  PanelRightOpen,
  Plus,
  Presentation,
  Rocket,
  Rows3,
  Scale,
  Server,
  Shapes,
  Share2,
  ShieldCheck,
  Sparkles,
  Split,
  Square,
  StickyNote,
  Timer,
  Type,
  Users,
  UserSquare2,
  Vote,
  Workflow,
  X,
  Zap,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';

import {
  CANVAS_OS_CAPABILITY_LABELS,
  CANVAS_OS_RAIL,
  type CanvasOsAction,
  type CanvasOsPanelId,
  getCanvasOsActions,
  type ProcessFlowSemanticKit,
} from './canvas/canvasOsContract';
import type { CanvasToolType, IdeaWorkspaceInsertItem } from './ideaSelectionTypes';

const ICON_MAP = {
  BadgeCheck,
  Building2,
  BookOpen,
  Bot,
  Box,
  BriefcaseBusiness,
  Brush,
  CircleDot,
  Database,
  Diamond,
  Download,
  FileBarChart2,
  Flag,
  Frame,
  Gauge,
  GitBranch,
  Group,
  History,
  LayoutTemplate,
  Library,
  Lightbulb,
  LocateFixed,
  Map,
  MessageSquareMore,
  Minus,
  Network,
  NotebookPen,
  Palette,
  PanelRightOpen,
  Plus,
  Presentation,
  Rocket,
  Rows3,
  Scale,
  Server,
  Share2,
  Shapes,
  ShieldCheck,
  Sparkles,
  Split,
  Square,
  StickyNote,
  Timer,
  Type,
  UserSquare2,
  Users,
  Vote,
  Workflow,
  X,
  Zap,
} satisfies Record<string, React.ComponentType<{ size?: number; className?: string }>>;

interface IdeaCanvasDiscoveryProps {
  activeTool: CanvasToolType;
  activePanelId: CanvasOsPanelId | null;
  onPanelChange: (panelId: CanvasOsPanelId | null) => void;
  isPolish?: boolean;
  onDispatchQuickAction: (action: string) => void;
  onDispatchInsert: (items: IdeaWorkspaceInsertItem[]) => void;
  onApplyTheme: (themeId: string) => void;
  onApplyFlowSemantic: (semantic: ProcessFlowSemanticKit) => void;
  onApplyTemplate: (templateId: string) => void;
  onGenerateAI: (generatorType: string) => void;
  onGovernanceUpdate: (update: { status: string; note?: string; actor?: string }) => void;
  onOpenTemplates: () => void;
  onOpenExport: () => void;
  onOpenAI: () => void;
  onOpenContext: () => void;
  onOpenTools: () => void;
  onToggleVoting: () => void;
  onSendToChat: (prompt: string) => void;
}

function getIcon(name: string) {
  return ICON_MAP[name as keyof typeof ICON_MAP] || Sparkles;
}

function capabilityBadge(capability: CanvasOsAction['capability'] | string, isPolish?: boolean) {
  const labels =
    CANVAS_OS_CAPABILITY_LABELS[capability as keyof typeof CANVAS_OS_CAPABILITY_LABELS] ||
    CANVAS_OS_CAPABILITY_LABELS.scaffold;
  return isPolish ? labels.pl : labels.en;
}

export const IdeaCanvasDiscovery: React.FC<IdeaCanvasDiscoveryProps> = ({
  activeTool,
  activePanelId,
  onPanelChange,
  isPolish,
  onDispatchQuickAction,
  onDispatchInsert,
  onApplyTheme,
  onApplyFlowSemantic,
  onApplyTemplate,
  onGenerateAI,
  onGovernanceUpdate,
  onOpenTemplates,
  onOpenExport,
  onOpenAI,
  onOpenContext,
  onOpenTools,
  onToggleVoting,
  onSendToChat,
}) => {
  const [query, setQuery] = useState('');

  const actions = useMemo(() => {
    if (!activePanelId) return [];
    const base = getCanvasOsActions(activePanelId, activeTool);
    const normalized = query.trim().toLowerCase();
    if (!normalized) return base;
    return base.filter((action) => {
      const haystack = [action.labelEn, action.labelPl, action.descEn, action.descPl, action.id]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalized);
    });
  }, [activePanelId, activeTool, query]);

  const activeRailItem = activePanelId
    ? CANVAS_OS_RAIL.find((item) => item.id === activePanelId)
    : null;

  const handleAction = (action: CanvasOsAction) => {
    switch (action.kind) {
      case 'quick_action':
        if (action.quickAction) onDispatchQuickAction(action.quickAction);
        return;
      case 'insert':
        if (action.insertItems?.length) onDispatchInsert(action.insertItems);
        return;
      case 'theme':
        if (action.themeId) onApplyTheme(action.themeId);
        return;
      case 'flow_semantic':
        if (action.flowSemantic) onApplyFlowSemantic(action.flowSemantic);
        return;
      case 'apply_template':
        if (action.templateId) onApplyTemplate(action.templateId);
        return;
      case 'generate_ai':
        if (action.generatorType) onGenerateAI(action.generatorType);
        return;
      case 'governance_update':
        if (action.governanceUpdate) onGovernanceUpdate(action.governanceUpdate);
        return;
      case 'open_templates':
        onOpenTemplates();
        return;
      case 'open_export':
        onOpenExport();
        return;
      case 'open_ai':
        onOpenAI();
        return;
      case 'toggle_voting':
        onToggleVoting();
        return;
      case 'open_context':
        onOpenContext();
        return;
      case 'open_tools':
        onOpenTools();
        return;
      case 'chat_prompt':
        onSendToChat(
          isPolish ? action.chatPromptPl || action.descPl : action.chatPromptEn || action.descEn
        );
        return;
      default:
        return;
    }
  };

  return (
    <>
      <div className="absolute left-3 top-20 z-[57] flex flex-col gap-2">
        {CANVAS_OS_RAIL.map((item) => {
          const Icon = getIcon(item.icon);
          const isActive = activePanelId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onPanelChange(isActive ? null : item.id)}
              title={isPolish ? item.labelPl : item.labelEn}
              className={`group flex h-11 w-11 items-center justify-center rounded-2xl border backdrop-blur-md shadow-lg transition-all ${
                isActive
                  ? 'border-c-info/50 bg-white text-c-info dark:bg-navy-900'
                  : 'border-slate-200/60 bg-white/92 text-slate-500 hover:text-slate-800 dark:border-navy-700/60 dark:bg-navy-900/88 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              <Icon size={17} />
            </button>
          );
        })}
      </div>

      {activePanelId && activeRailItem && (
        <div className="absolute left-[4.5rem] top-8 bottom-8 z-[56] w-[320px] overflow-hidden rounded-3xl border border-slate-200/60 bg-white/96 shadow-2xl backdrop-blur-xl dark:border-navy-700/60 dark:bg-navy-900/95">
          <div className="flex items-start justify-between gap-3 border-b border-slate-200/60 px-4 py-4 dark:border-navy-700/60">
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-c-info">
                Canvas OS
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                {isPolish ? activeRailItem.labelPl : activeRailItem.labelEn}
              </div>
              <div className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                {isPolish ? activeRailItem.descriptionPl : activeRailItem.descriptionEn}
              </div>
            </div>
            <button
              type="button"
              onClick={() => onPanelChange(null)}
              className="rounded-xl p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-navy-800 dark:hover:text-slate-100"
            >
              <X size={14} />
            </button>
          </div>

          <div className="border-b border-slate-200/60 px-4 py-3 dark:border-navy-700/60">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/80 px-3 py-2 dark:border-navy-700/70 dark:bg-navy-950/70">
              <SearchGlyph />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isPolish ? 'Szukaj w Canvas OS' : 'Search Canvas OS'}
                className="w-full bg-transparent text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-200"
              />
            </div>
            <div className="mt-2 text-[10px] text-slate-600 dark:text-slate-500">
              {isPolish ? 'Aktywny system' : 'Active system'}:{' '}
              <span className="font-semibold">{activeTool}</span>
            </div>
          </div>

          <div className="h-[calc(100%-8.5rem)] overflow-y-auto px-4 py-4">
            {actions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-6 text-center dark:border-navy-700 dark:bg-navy-950/70">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {isPolish ? 'Brak wyników dla tego filtra' : 'No results for this filter'}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Wyczyść wyszukiwarkę albo przełącz panel.'
                    : 'Clear the search or switch the panel.'}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {actions.map((action) => {
                  const Icon = getIcon(action.icon);
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleAction(action)}
                      className="w-full rounded-2xl border border-slate-200/70 bg-white px-3 py-3 text-left transition-all hover:border-c-info/40 hover:bg-c-info/[0.03] dark:border-navy-700/70 dark:bg-navy-950/60"
                    >
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-c-info/10 text-c-info">
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                              {isPolish ? action.labelPl : action.labelEn}
                            </div>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:bg-navy-800 dark:text-slate-300">
                              {capabilityBadge(action.capability, isPolish)}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                            {isPolish ? action.descPl : action.descEn}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

const SearchGlyph = () => (
  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 text-slate-600" fill="none" stroke="currentColor">
    <circle cx="8.5" cy="8.5" r="5.5" strokeWidth="1.8" />
    <path d="M13 13l4 4" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default IdeaCanvasDiscovery;
