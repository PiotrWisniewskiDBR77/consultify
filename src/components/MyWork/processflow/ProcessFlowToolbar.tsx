import {
  AlertTriangle,
  BarChart3,
  Copy,
  GitBranch,
  GitMerge,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Plus,
  Redo2,
  Rocket,
  Save,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import React from 'react';

import TeresaMark from '../../shared/TeresaMark';
import { type ProcessFlowSemanticKit } from '../canvas/canvasOsContract';
import { type FlowShape, SHAPE_CONFIG } from './FlowNodeComponent';

// DP-5: "Propozycja AI" (AI Proposal panel) is hidden until F2 rewires
// useProcessFlowAIProposal / AIProposalPanel from the dead V8
// `/process-flow/:id/ai-proposals` route to a real AI endpoint
// (e.g. /my-ideas/:id/ai-generate). The panel and hook are kept intact so F2
// only needs to flip this constant once the backend exists.
export const AI_PROPOSAL_ENABLED = false;

// ── Re-export types ──────────────────────────────────────────────────────────

export type ProcessFlowMode = 'classic' | 'automation' | 'vsm';

export const FLOW_MODE_LABELS: Record<ProcessFlowMode, { en: string; pl: string }> = {
  classic: { en: 'Classic Flow', pl: 'Klasyczny przepływ' },
  automation: { en: 'Automation', pl: 'Automatyzacja' },
  vsm: { en: 'Value Stream', pl: 'Strumień wartości' },
};

export const FLOW_MODE_GUIDANCE: Record<
  ProcessFlowMode,
  { en: string; pl: string; stageEn: string; stagePl: string }
> = {
  classic: {
    en: 'Map the current process, decisions, and ownership before optimization.',
    pl: 'Mapuj bieżący proces, decyzje i odpowiedzialność zanim zaczniesz optymalizację.',
    stageEn: 'Map and classify',
    stagePl: 'Mapuj i klasyfikuj',
  },
  automation: {
    en: 'Focus on triggers, integrations, and hand-offs that can be automated safely.',
    pl: 'Skup się na triggerach, integracjach i hand-offach, które można bezpiecznie automatyzować.',
    stageEn: 'Measure and automate',
    stagePl: 'Mierz i automatyzuj',
  },
  vsm: {
    en: 'Show end-to-end flow, inventory, and waiting time to expose bottlenecks.',
    pl: 'Pokaż przepływ end-to-end, zapasy i czas oczekiwania, aby ujawnić bottlenecki.',
    stageEn: 'Measure and optimize',
    stagePl: 'Mierz i optymalizuj',
  },
};

// ── Shape lists ──────────────────────────────────────────────────────────────

export const CLASSIC_SHAPES: FlowShape[] = ['start', 'end', 'action', 'decision'];
export const BPMN_SHAPES: FlowShape[] = ['bpmn_event', 'bpmn_task', 'bpmn_gateway', 'start', 'end'];
export const SYSTEM_SHAPES: FlowShape[] = [
  'system_actor',
  'system_service',
  'system_db',
  'decision',
];
export const ORG_SHAPES: FlowShape[] = ['org_role', 'org_team', 'org_handoff', 'decision'];
export const AUTOMATION_SHAPES: FlowShape[] = [
  'start',
  'end',
  'action',
  'auto_trigger',
  'auto_api',
  'auto_condition',
];
export const VSM_SHAPES: FlowShape[] = [
  'vsm_process',
  'vsm_inventory',
  'vsm_supplier',
  'vsm_customer',
  'vsm_kaizen',
  'vsm_push_arrow',
  'vsm_pull_arrow',
  'vsm_supermarket',
  'vsm_fifo',
];

export const SHAPES_BY_MODE: Record<ProcessFlowMode, FlowShape[]> = {
  classic: CLASSIC_SHAPES,
  automation: AUTOMATION_SHAPES,
  vsm: VSM_SHAPES,
};

export const SHAPES_BY_SEMANTIC_KIT: Partial<Record<ProcessFlowSemanticKit, FlowShape[]>> = {
  bpmn: BPMN_SHAPES,
  system: SYSTEM_SHAPES,
  org: ORG_SHAPES,
};

// ── Props ────────────────────────────────────────────────────────────────────

export interface ProcessFlowToolbarProps {
  isPl: boolean;
  locked: boolean;
  flowMode: ProcessFlowMode;
  setFlowMode: (mode: ProcessFlowMode) => void;
  semanticKit: string;
  availableShapes: FlowShape[];
  addNode: (shape: FlowShape) => void;
  addLane: () => void;
  insertBetween: () => void;
  splitPath: () => void;
  runValidation: () => void;
  showWarnings: boolean;
  warnings: { message: string }[];
  showCoach: boolean;
  setShowCoach: (v: boolean) => void;
  coachLoading: boolean;
  runProcessCoach: () => void;
  showSummary: boolean;
  setShowSummary: (v: boolean) => void;
  summaryLoading: boolean;
  generateSummary: () => void;
  showKPIDashboard: boolean;
  setShowKPIDashboard: React.Dispatch<React.SetStateAction<boolean>>;
  showReadbackPanel?: boolean;
  onOpenReadback?: () => void;
  showAIPanel?: boolean;
  onOpenAIProposal?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  handleAutoLayout: () => void;
  duplicateSelected: () => void;
  deleteSelected: () => void;
  saving: boolean;
  syncLabel: string;
  handleSave: () => void;
  stepCount: number;
  laneCount: number;
  guidance: { en: string; pl: string; stageEn: string; stagePl: string };
  onOpenChat?: () => void;
  onConvert?: (action: string) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

const BTN =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40';

export const ProcessFlowToolbar: React.FC<ProcessFlowToolbarProps> = ({
  isPl,
  locked,
  flowMode,
  setFlowMode,
  semanticKit,
  availableShapes,
  addNode,
  addLane,
  insertBetween,
  splitPath,
  runValidation,
  showWarnings,
  warnings,
  showCoach,
  setShowCoach,
  coachLoading,
  runProcessCoach,
  showSummary,
  setShowSummary,
  summaryLoading,
  generateSummary,
  showKPIDashboard,
  setShowKPIDashboard,
  showReadbackPanel,
  onOpenReadback,
  showAIPanel,
  onOpenAIProposal,
  canUndo,
  canRedo,
  undo,
  redo,
  handleAutoLayout,
  duplicateSelected,
  deleteSelected,
  saving,
  syncLabel,
  handleSave,
  stepCount,
  laneCount,
  guidance,
  onOpenChat,
  onConvert,
}) => (
  <div className="border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/80 flex-shrink-0">
    <div className="px-4 py-3 flex flex-col gap-3">
      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-[240px]">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Workspace / Process Flow
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isPl ? 'Nawigacja procesu' : 'Process navigation'}
            </div>
            <span className="inline-flex items-center rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-semibold text-primary-600 dark:text-primary-300">
              {isPl ? FLOW_MODE_LABELS[flowMode].pl : FLOW_MODE_LABELS[flowMode].en}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-200/70 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
              {isPl ? guidance.stagePl : guidance.stageEn}
            </span>
            <span className="inline-flex items-center rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-medium text-primary-600 dark:text-primary-300">
              Kit {semanticKit}
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-[11px] text-slate-600 dark:text-slate-300">
            {isPl ? guidance.pl : guidance.en}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-white/80 dark:bg-navy-900/40 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300">
            {isPl ? `Kroki ${stepCount}` : `Steps ${stepCount}`}
          </span>
          <span className="inline-flex items-center rounded-full bg-white/80 dark:bg-navy-900/40 px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300">
            {isPl ? `Lanes ${laneCount}` : `Lanes ${laneCount}`}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium ${
              warnings.length > 0
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
            }`}
          >
            {warnings.length > 0
              ? isPl
                ? `Ostrzeżenia ${warnings.length}`
                : `Warnings ${warnings.length}`
              : isPl
                ? 'Brak ostrzeżeń'
                : 'No warnings'}
          </span>
        </div>
      </div>

      {/* ── Toolbar sections ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        {/* Flow mode pills */}
        <div className="min-w-[250px] rounded-xl border border-slate-200/70 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 p-2.5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {isPl ? 'Tryb flow' : 'Flow mode'}
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 dark:bg-navy-800 p-0.5">
            {(['classic', 'automation', 'vsm'] as ProcessFlowMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setFlowMode(mode)}
                className={`px-2.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                  flowMode === mode
                    ? 'bg-white dark:bg-navy-700 text-primary-600 dark:text-primary-400 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {isPl ? FLOW_MODE_LABELS[mode].pl : FLOW_MODE_LABELS[mode].en}
              </button>
            ))}
          </div>
        </div>

        {/* Build flow */}
        <div className="flex-1 min-w-[320px] rounded-xl border border-slate-200/70 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 p-2.5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {isPl ? 'Budowanie procesu' : 'Build flow'}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {availableShapes.map((shape) => {
              const cfg = SHAPE_CONFIG[shape];
              const Icon = cfg.icon;
              return (
                <button
                  key={shape}
                  type="button"
                  onClick={() => addNode(shape)}
                  disabled={locked}
                  className={BTN}
                  title={isPl ? cfg.labelPl : cfg.label}
                >
                  <Icon size={14} />
                  {isPl ? cfg.labelPl : cfg.label}
                </button>
              );
            })}
            <div className="w-px h-5 bg-slate-200 dark:bg-navy-700 mx-1" />
            <button
              type="button"
              onClick={addLane}
              disabled={locked}
              className={BTN}
              title={isPl ? 'Dodaj lane' : 'Add lane'}
            >
              <Plus size={14} />
              Lane
            </button>
            <button
              type="button"
              onClick={insertBetween}
              disabled={locked}
              className={BTN}
              title={isPl ? 'Wstaw krok między' : 'Insert between'}
            >
              <Plus size={14} />
              {isPl ? 'Wstaw' : 'Insert'}
            </button>
            <button
              type="button"
              onClick={splitPath}
              disabled={locked}
              className={BTN}
              title={isPl ? 'Rozdziel ścieżkę' : 'Split path'}
            >
              <GitMerge size={14} />
              {isPl ? 'Rozdziel' : 'Split'}
            </button>
          </div>
        </div>

        {/* Analyze & validate */}
        <div className="flex-1 min-w-[260px] rounded-xl border border-slate-200/70 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 p-2.5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {isPl ? 'Analiza i walidacja' : 'Analyze and validate'}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowKPIDashboard((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                showKPIDashboard
                  ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800'
              }`}
              title="KPI Dashboard"
            >
              <BarChart3 size={14} />
              KPI
            </button>
            <button
              type="button"
              onClick={runValidation}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                showWarnings
                  ? 'text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300'
                  : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20'
              }`}
              title={isPl ? 'Waliduj przepływ' : 'Validate flow'}
            >
              <AlertTriangle size={14} />
              {isPl ? 'Waliduj' : 'Validate'}
            </button>
            <button
              type="button"
              onClick={runProcessCoach}
              disabled={locked || coachLoading}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                showCoach
                  ? 'text-primary-700 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-300'
                  : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'
              }`}
              title="AI Coach"
            >
              {coachLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <TeresaMark size={14} />
              )}
              AI Coach
            </button>
            <button
              type="button"
              onClick={generateSummary}
              disabled={locked || summaryLoading}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                showSummary
                  ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300'
                  : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
              }`}
              title={isPl ? 'Podsumowanie' : 'Summary'}
            >
              {summaryLoading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <BarChart3 size={14} />
              )}
              {isPl ? 'Podsumuj' : 'Summary'}
            </button>
            {onOpenReadback && (
              <button
                type="button"
                onClick={onOpenReadback}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors ${
                  showReadbackPanel
                    ? 'text-indigo-700 bg-indigo-50 dark:bg-indigo-900/20 dark:text-indigo-300'
                    : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                }`}
                title={isPl ? 'Odczyt semantyczny' : 'Semantic readback'}
              >
                <GitBranch size={14} />
                {isPl ? 'Odczyt' : 'Readback'}
              </button>
            )}
            {AI_PROPOSAL_ENABLED && onOpenAIProposal && (
              <button
                type="button"
                onClick={onOpenAIProposal}
                disabled={locked}
                className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-colors disabled:opacity-40 ${
                  showAIPanel
                    ? 'text-primary-700 bg-primary-50 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                }`}
                title={isPl ? 'Propozycja AI' : 'AI proposal'}
              >
                <Sparkles size={14} />
                {isPl ? 'Propozycja AI' : 'AI Proposal'}
              </button>
            )}
          </div>
        </div>

        {/* Manage canvas */}
        <div className="flex-1 min-w-[280px] rounded-xl border border-slate-200/70 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 p-2.5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {isPl ? 'Zarządzanie canvasem' : 'Manage canvas'}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo || locked}
              className="inline-flex items-center rounded-lg px-1.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-30"
              title={isPl ? 'Cofnij (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
              aria-label={isPl ? 'Cofnij' : 'Undo'}
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo || locked}
              className="inline-flex items-center rounded-lg px-1.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-30"
              title={isPl ? 'Ponów (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z)'}
              aria-label={isPl ? 'Ponów' : 'Redo'}
            >
              <Redo2 size={14} />
            </button>
            <button
              type="button"
              onClick={handleAutoLayout}
              disabled={locked}
              className={BTN}
              title={isPl ? 'Auto układ' : 'Auto arrange'}
            >
              <LayoutGrid size={14} />
              Auto
            </button>
            <button
              type="button"
              onClick={duplicateSelected}
              disabled={locked}
              className={BTN}
              title={isPl ? 'Duplikuj (Ctrl+D)' : 'Duplicate (Ctrl+D)'}
            >
              <Copy size={14} />
              {isPl ? 'Duplikuj' : 'Duplicate'}
            </button>
            <button
              type="button"
              onClick={deleteSelected}
              disabled={locked}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors disabled:opacity-40"
              title={isPl ? 'Usuń zaznaczone' : 'Delete selected'}
            >
              <Trash2 size={14} />
              {isPl ? 'Usuń' : 'Delete'}
            </button>
            <div className="ml-auto" />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || locked}
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                saving || locked
                  ? 'bg-slate-200/60 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
                  : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
              }`}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? (isPl ? 'Zapisuję…' : 'Saving…') : isPl ? 'Zapisz' : 'Save'}
            </button>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{syncLabel}</span>
            {onOpenChat && (
              <button
                type="button"
                onClick={onOpenChat}
                className={BTN}
                title={isPl ? 'Zapytaj AI o ten proces' : 'Ask AI about this process'}
              >
                <MessageSquare size={14} />
                {isPl ? 'Zapytaj AI' : 'Ask AI'}
              </button>
            )}
            {onConvert && (
              <div className="relative group">
                <button
                  type="button"
                  className={BTN}
                  title={isPl ? 'Konwertuj proces' : 'Convert process'}
                >
                  <Rocket size={14} />
                  {isPl ? 'Konwertuj' : 'Convert'}
                </button>
                <div className="absolute right-0 top-full mt-1 hidden group-hover:flex flex-col w-44 rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900 shadow-xl py-1 z-50">
                  <button
                    type="button"
                    onClick={() => onConvert('pf_convert_initiative')}
                    className="px-3 py-1.5 text-left text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
                  >
                    {isPl ? 'Inicjatywa' : 'Initiative'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onConvert('pf_convert_task_set')}
                    className="px-3 py-1.5 text-left text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
                  >
                    {isPl ? 'Zadania' : 'Task set'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onConvert('pf_convert_report')}
                    className="px-3 py-1.5 text-left text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
                  >
                    {isPl ? 'Raport' : 'Report'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onConvert('pf_convert_analysis')}
                    className="px-3 py-1.5 text-left text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800"
                  >
                    {isPl ? 'Analiza' : 'Analysis'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default ProcessFlowToolbar;
