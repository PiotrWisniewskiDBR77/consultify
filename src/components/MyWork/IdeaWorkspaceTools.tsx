/**
 * IdeaWorkspaceTools — Workspace tool panel for Idea Map Workspace.
 *
 * V5 DBR77 "Tech Sexy" compliant. Card-based challenge, pill-style metadata,
 * gradient convert cards, shared workspace sections.
 */
import {
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  FileText,
  GitBranch,
  ListChecks,
  MessageSquarePlus,
  Presentation,
  Rocket,
  Save,
  Shield,
  Star,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  AIQuickActions,
  ShareSection,
  ToolsPanelShell,
  TransformTextSection,
  type WorkspaceContext,
} from '@/components/shared/WorkspaceTools';

import {
  IDEA_STAGE_COLORS,
  IDEA_STAGE_LABELS,
  IDEA_STAGES_V5,
  normalizeStageToV5,
} from './ideaEntryTypes';
import type { AIProposalBatch, CanvasToolType, IdeaWorkspaceSelection } from './ideaSelectionTypes';
import { IdeaCompletenessWidget } from './table/IdeaCompletenessWidget';

const FIELD_CLASS =
  'w-full h-9 px-3 rounded-lg text-sm bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:border-purple-400 dark:focus:border-purple-400 transition-colors';
const LABEL_CLASS = 'text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block';
const SECTION_TITLE_CLASS = 'text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2';

const PRIORITY_COLORS: Record<number, string> = {
  25: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  50: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300',
  75: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
  100: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
};

type ConvertTarget =
  | 'initiative'
  | 'task_set'
  | 'decision'
  | 'team_chat'
  | 'report'
  | 'presentation'
  | 'action_plan'
  | 'raid_log';

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
  onStageChange?: (stage: string) => void;
  onFocusAICommand?: () => void;
  onGenerateProposal?: (batch: AIProposalBatch) => void;
  focusMode?: 'full' | 'system' | 'object';
  onToggleFocus?: () => void;
  votingActive?: boolean;
  onToggleVoting?: () => void;
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
  onStageChange,
  onFocusAICommand,
  focusMode = 'full',
  onToggleFocus,
  votingActive = false,
  onToggleVoting,
  graphNodes = [],
  graphEdges = [],
  graphLanes = [],
  onOpenTemplates,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language === 'pl';
  const [stageDropdownOpen, setStageDropdownOpen] = useState(false);

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


  const selectionSummary = useMemo(() => {
    if (!selection || selection.type === 'none') return null;
    const c = selection.count;
    const typeLabels: Record<string, string> = {
      node: c === 1 ? (isPl ? '1 węzeł' : '1 node') : isPl ? `${c} węzłów` : `${c} nodes`,
      edge: c === 1 ? (isPl ? '1 połączenie' : '1 edge') : isPl ? `${c} połączeń` : `${c} edges`,
      lane: isPl ? '1 lane' : '1 lane',
      row: c === 1 ? (isPl ? '1 wiersz' : '1 row') : isPl ? `${c} wierszy` : `${c} rows`,
    };
    return typeLabels[selection.type] || null;
  }, [isPl, selection]);

  const toolLabel = useMemo(() => {
    const labels: Record<CanvasToolType, string> = {
      mindmap: isPl ? 'Mapa rekomendacji' : 'Recommendation map',
      process_flow: isPl ? 'Przepływ' : 'Process Flow',
      table: isPl ? 'Tabela' : 'Table',
      whiteboard: isPl ? 'Tablica' : 'Whiteboard',
    };
    return labels[activeTool] || activeTool;
  }, [activeTool, isPl]);

  const [branchEditing, setBranchEditing] = useState(false);
  const [areaEditing, setAreaEditing] = useState(false);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const branchRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLInputElement>(null);

  const handleBranchBlur = useCallback(() => {
    setBranchEditing(false);
    onSave();
  }, [onSave]);
  const handleAreaBlur = useCallback(() => {
    setAreaEditing(false);
    onSave();
  }, [onSave]);
  const handlePrioritySelect = useCallback(
    (v: number) => {
      onPriorityChange(v);
      setPriorityOpen(false);
      setTimeout(onSave, 50);
    },
    [onPriorityChange, onSave]
  );

  if (!open) return null;
  const supportedConvertTargets = new Set<ConvertTarget>([
    'initiative',
    'task_set',
    'decision',
    'team_chat',
  ]);

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

  const normalizedPriority = Math.max(25, Math.min(100, Math.round(priority / 25) * 25)) || 25;
  const currentPriorityLabel = priorityOptions.find((o) => o.value === normalizedPriority)?.label ?? 'Medium';

  const v5Stage = normalizeStageToV5(stage);
  const stageLabel = isPl ? IDEA_STAGE_LABELS[v5Stage].pl : IDEA_STAGE_LABELS[v5Stage].en;
  const stageColor = IDEA_STAGE_COLORS[v5Stage];

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
      {/* ─── Stage + selection ─── */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button
              onClick={() => !isDraft && setStageDropdownOpen((v) => !v)}
              disabled={isDraft}
              className={`inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r ${stageColor} px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide shadow-sm transition-all disabled:opacity-50`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
              {stageLabel}
              {!isDraft && <ChevronDown size={10} className="opacity-60" />}
            </button>
            {stageDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 z-[120] w-48 rounded-xl bg-white dark:bg-navy-900 shadow-xl py-1">
                {IDEA_STAGES_V5.map((s) => {
                  const label = isPl ? IDEA_STAGE_LABELS[s].pl : IDEA_STAGE_LABELS[s].en;
                  const isActive = s === v5Stage;
                  return (
                    <button
                      key={s}
                      onClick={() => {
                        onStageChange?.(s);
                        setStageDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[11px] transition-colors ${
                        isActive
                          ? 'font-semibold text-primary-600 dark:text-primary-400 bg-primary-500/5'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                      }`}
                    >
                      <span
                        className={`inline-block w-1.5 h-1.5 rounded-full mr-2 bg-gradient-to-r ${IDEA_STAGE_COLORS[s].split(' ')[0]} ${IDEA_STAGE_COLORS[s].split(' ')[1]}`}
                      />
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{draftSavedLabel}</span>
          {selectionSummary && (
            <span className="inline-flex items-center gap-1 rounded-lg bg-primary-500/10 text-primary-600 dark:text-primary-400 px-2 py-0.5 text-[10px] font-semibold">
              {selectionSummary}
            </span>
          )}
        </div>
      </div>

      {/* ─── Challenge (card-based) ─── */}
      <div className="px-3 pt-2 pb-4">
        <div className="rounded-xl bg-white/40 dark:bg-white/[0.02] p-3 space-y-3">
          <div>
            <label className={LABEL_CLASS}>{isPl ? 'Tytuł' : 'Title'}</label>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder={isPl ? 'Tytuł wyzwania…' : 'Challenge title…'}
              className={`${FIELD_CLASS} font-semibold`}
            />
          </div>
          <div>
            <label className={LABEL_CLASS}>{isPl ? 'Opis wyzwania' : 'Challenge description'}</label>
            <textarea
              value={seedText}
              onChange={(e) => onSeedTextChange(e.target.value)}
              rows={4}
              placeholder={isPl ? 'Opisz problem lub pomysł…' : 'Describe the problem or idea…'}
              className={`${FIELD_CLASS} h-auto py-2 resize-none`}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              disabled={saving || isDraft}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition-colors hover:bg-slate-800 dark:hover:bg-slate-100 disabled:opacity-40"
            >
              <Save size={12} />
              {isPl ? 'Zapisz' : 'Save'}
            </button>
            {!isAccepted && (
              <button
                onClick={onAcceptChallenge}
                disabled={saving || isDraft || !seedText.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-sm transition-all hover:shadow-md disabled:opacity-40"
              >
                <CheckCircle2 size={12} />
                {isPl ? 'Akceptuj' : 'Accept'}
              </button>
            )}
            {isAccepted && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={12} />
                {isPl ? 'Zaakceptowane' : 'Accepted'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Completeness (moved above metadata for immediate feedback) ─── */}
      {graphNodes.length > 0 && (
        <div className="px-3 pb-4">
          <IdeaCompletenessWidget
            nodes={graphNodes}
            edges={graphEdges}
            title={title}
            seedText={seedText}
          />
        </div>
      )}

      {/* ─── Metadata (pill-style) ─── */}
      <div className="px-3 pb-4">
        <div className={SECTION_TITLE_CLASS}>{isPl ? 'Metadane' : 'Metadata'}</div>
        <div className="flex flex-wrap gap-1.5">
          {/* Branch pill */}
          {branchEditing ? (
            <input
              ref={branchRef}
              value={branch}
              onChange={(e) => onBranchChange(e.target.value)}
              onBlur={handleBranchBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleBranchBlur()}
              placeholder={isPl ? 'Gałąź…' : 'Branch…'}
              autoFocus
              className="h-7 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-purple-400 text-slate-700 dark:text-slate-300 outline-none w-28"
            />
          ) : (
            <button
              onClick={() => setBranchEditing(true)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              <GitBranch size={11} className="text-slate-400 shrink-0" />
              {branch || (isPl ? 'Gałąź' : 'Branch')}
            </button>
          )}

          {/* Area pill */}
          {areaEditing ? (
            <input
              ref={areaRef}
              value={area}
              onChange={(e) => onAreaChange(e.target.value)}
              onBlur={handleAreaBlur}
              onKeyDown={(e) => e.key === 'Enter' && handleAreaBlur()}
              placeholder={isPl ? 'Obszar…' : 'Area…'}
              autoFocus
              className="h-7 px-2.5 rounded-lg text-xs bg-slate-50 dark:bg-navy-800 border border-purple-400 text-slate-700 dark:text-slate-300 outline-none w-28"
            />
          ) : (
            <button
              onClick={() => setAreaEditing(true)}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors"
            >
              {area || (isPl ? 'Obszar' : 'Area')}
            </button>
          )}

          {/* Priority badge */}
          <div className="relative">
            <button
              onClick={() => setPriorityOpen((v) => !v)}
              className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-medium transition-colors ${PRIORITY_COLORS[normalizedPriority]}`}
            >
              {currentPriorityLabel}
              <ChevronDown size={10} className="opacity-60" />
            </button>
            {priorityOpen && (
              <div className="absolute top-full left-0 mt-1 z-[120] w-32 rounded-xl bg-white dark:bg-navy-900 shadow-xl py-1">
                {priorityOptions.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => handlePrioritySelect(o.value)}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      o.value === normalizedPriority
                        ? 'font-semibold text-primary-600 dark:text-primary-400 bg-primary-500/5'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${PRIORITY_COLORS[o.value].split(' ')[0]}`} />
                    {o.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Convert ─── */}
      <div className="px-3 pb-4">
        <div className={SECTION_TITLE_CLASS}>{isPl ? 'Konwersja' : 'Convert'}</div>
        {selection.type !== 'none' && selection.count > 0 && (
          <div className="mb-2 text-[10px] font-medium text-primary-600 dark:text-primary-400 bg-primary-500/5 rounded-lg px-2 py-1.5">
            {isPl
              ? `Konwertuj zaznaczenie (${selection.count})`
              : `Convert selection (${selection.count})`}
          </div>
        )}
        <div className="grid grid-cols-1 gap-1.5">
          {convertActions
            .filter(({ id }) => supportedConvertTargets.has(id))
            .map(({ id, icon: Icon, labelPl, labelEn, descPl, descEn, gradient, textColor }) => (
              <button
                key={id}
                onClick={() => onConvert(id)}
                disabled={isDraft}
                className="group relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl overflow-hidden transition-all duration-200 disabled:opacity-40"
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-100 group-hover:opacity-80 transition-opacity`}
                />
                <div
                  className={`relative w-7 h-7 rounded-lg bg-gradient-to-br ${gradient} flex items-center justify-center ${textColor} shrink-0`}
                >
                  <Icon size={14} />
                </div>
                <div className="relative flex-1 min-w-0 text-left">
                  <div className={`text-[11px] font-semibold ${textColor}`}>
                    {isPl ? labelPl : labelEn}
                  </div>
                  <div className="text-[9px] text-slate-400 dark:text-slate-500">
                    {isPl ? descPl : descEn}
                  </div>
                </div>
              </button>
            ))}
        </div>
      </div>

      {/* ─── AI Quick Actions (shared) ─── */}
      <AIQuickActions isPl={isPl} onFocusAICommand={onFocusAICommand} onOpenAIChat={onOpenChat} />

      {/* ─── Transform (shared) ─── */}
      <TransformTextSection isPl={isPl} context={wsContext} />

      {/* ─── Share (shared) ─── */}
      <ShareSection isPl={isPl} context={wsContext} />
    </ToolsPanelShell>
  );
};

export default IdeaWorkspaceTools;
