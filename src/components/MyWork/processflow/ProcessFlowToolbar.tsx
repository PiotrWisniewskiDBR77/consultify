import {
  AlertTriangle,
  BarChart3,
  Copy,
  GitMerge,
  LayoutGrid,
  Loader2,
  MessageSquare,
  Plus,
  Redo2,
  Rocket,
  Save,
  ScanText,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import React from 'react';

import TeresaMark from '../../shared/TeresaMark';
import { type ProcessFlowSemanticKit } from '../canvas/canvasOsContract';
import { type FlowShape, SHAPE_CONFIG } from './FlowNodeComponent';
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
  /** Open the AI Proposal side panel (AI suggests graph operations). Optional — button hidden when unset. */
  onAIProposal?: () => void;
  /** Open the Semantic Readback side panel (plain-language read of the flow). Optional — button hidden when unset. */
  onReadback?: () => void;
}

// ── Component ────────────────────────────────────────────────────────────────

// Compact toolbar primitives (2026 canvas-toolbar: single slim row, icon-first, tooltips).
const BTN =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40';
// Icon-only square button — label lives in the tooltip (title). Keeps the bar slim.
const ICON =
  'inline-flex items-center justify-center h-7 w-7 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-30';
const SEP = 'w-px h-5 bg-slate-200 dark:bg-navy-700 mx-0.5 shrink-0';

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
  onAIProposal,
  onReadback,
}) => (
  <div className="border-b border-slate-200/60 dark:border-navy-700/60 bg-white/90 dark:bg-navy-900/70 flex-shrink-0">
    <div className="px-4 py-2 flex flex-col gap-2">
      {/* ── Header row (slim) ──────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[13px] font-semibold text-slate-900 dark:text-slate-100 truncate"
            title={isPl ? guidance.pl : guidance.en}
          >
            {isPl ? 'Nawigacja procesu' : 'Process navigation'}
          </span>
          <span className="inline-flex items-center rounded-full bg-slate-900/[0.06] dark:bg-white/[0.10] px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:text-slate-200">
            {isPl ? FLOW_MODE_LABELS[flowMode].pl : FLOW_MODE_LABELS[flowMode].en}
          </span>
          <span className="hidden sm:inline-flex items-center rounded-full bg-slate-200/70 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
            {isPl ? guidance.stagePl : guidance.stageEn}
          </span>
          <span className="hidden md:inline-flex items-center rounded-full bg-slate-200/70 dark:bg-white/[0.06] px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
            Kit {semanticKit}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-navy-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
            {isPl ? `Kroki ${stepCount}` : `Steps ${stepCount}`}
          </span>
          <span className="hidden sm:inline-flex items-center rounded-full bg-slate-100 dark:bg-navy-800 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
            {isPl ? `Lanes ${laneCount}` : `Lanes ${laneCount}`}
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
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

      {/* ── Toolbar (single slim row, icon-first, grouped by separators) ── */}
      <div className="flex flex-wrap items-center gap-1">
        {/* Flow mode — compact segmented control */}
        <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-navy-800 p-0.5">
          {(['classic', 'automation', 'vsm'] as ProcessFlowMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setFlowMode(mode)}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                flowMode === mode
                  ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {isPl ? FLOW_MODE_LABELS[mode].pl : FLOW_MODE_LABELS[mode].en}
            </button>
          ))}
        </div>

        <div className={SEP} />

        {/* Build — shapes as icon buttons (label in tooltip) + structure actions */}
        {availableShapes.map((shape) => {
          const cfg = SHAPE_CONFIG[shape];
          const Icon = cfg.icon;
          return (
            <button
              key={shape}
              type="button"
              onClick={() => addNode(shape)}
              disabled={locked}
              className={ICON}
              title={isPl ? cfg.labelPl : cfg.label}
              aria-label={isPl ? cfg.labelPl : cfg.label}
            >
              <Icon size={15} />
            </button>
          );
        })}
        <button
          type="button"
          onClick={addLane}
          disabled={locked}
          className={ICON}
          title={isPl ? 'Dodaj lane' : 'Add lane'}
          aria-label={isPl ? 'Dodaj lane' : 'Add lane'}
        >
          <Plus size={15} />
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

        <div className={SEP} />

        {/* Analyze & validate — KPI/Validate keep label (stateful), rest icon-only */}
        <button
          type="button"
          onClick={() => setShowKPIDashboard((v) => !v)}
          className={`${BTN} ${showKPIDashboard ? 'bg-slate-200/70 dark:bg-navy-800 text-slate-900 dark:text-slate-100' : ''}`}
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
          className={`${ICON} ${showCoach ? 'bg-slate-200/70 dark:bg-navy-800 text-slate-900 dark:text-slate-100' : ''}`}
          title={isPl ? 'Trener AI' : 'AI Coach'}
          aria-label={isPl ? 'Trener AI' : 'AI Coach'}
        >
          {coachLoading ? <Loader2 size={15} className="animate-spin" /> : <TeresaMark size={15} />}
        </button>
        <button
          type="button"
          onClick={generateSummary}
          disabled={locked || summaryLoading}
          className={`${ICON} ${showSummary ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' : ''}`}
          title={isPl ? 'Podsumowanie' : 'Summary'}
          aria-label={isPl ? 'Podsumowanie' : 'Summary'}
        >
          {summaryLoading ? <Loader2 size={15} className="animate-spin" /> : <BarChart3 size={15} />}
        </button>
        {onAIProposal && (
          <button
            type="button"
            onClick={onAIProposal}
            disabled={locked}
            className={`${ICON} text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20`}
            title={isPl ? 'Propozycja AI — zmiany w przepływie' : 'AI Proposal — flow edits'}
            aria-label={isPl ? 'Propozycja AI' : 'AI Proposal'}
          >
            <Sparkles size={15} />
          </button>
        )}
        {onReadback && (
          <button
            type="button"
            onClick={onReadback}
            className={`${ICON} text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-900/20`}
            title={isPl ? 'Odczyt semantyczny przepływu' : 'Semantic readback of the flow'}
            aria-label={isPl ? 'Odczyt' : 'Readback'}
          >
            <ScanText size={15} />
          </button>
        )}

        <div className={SEP} />

        {/* Manage — undo/redo/auto/dup icons, Delete danger */}
        <button
          type="button"
          onClick={undo}
          disabled={!canUndo || locked}
          className={ICON}
          title={isPl ? 'Cofnij (Ctrl+Z)' : 'Undo (Ctrl+Z)'}
          aria-label={isPl ? 'Cofnij' : 'Undo'}
        >
          <Undo2 size={15} />
        </button>
        <button
          type="button"
          onClick={redo}
          disabled={!canRedo || locked}
          className={ICON}
          title={isPl ? 'Ponów (Ctrl+Shift+Z)' : 'Redo (Ctrl+Shift+Z)'}
          aria-label={isPl ? 'Ponów' : 'Redo'}
        >
          <Redo2 size={15} />
        </button>
        <button
          type="button"
          onClick={handleAutoLayout}
          disabled={locked}
          className={ICON}
          title={isPl ? 'Auto układ' : 'Auto arrange'}
          aria-label={isPl ? 'Auto układ' : 'Auto arrange'}
        >
          <LayoutGrid size={15} />
        </button>
        <button
          type="button"
          onClick={duplicateSelected}
          disabled={locked}
          className={ICON}
          title={isPl ? 'Duplikuj (Ctrl+D)' : 'Duplicate (Ctrl+D)'}
          aria-label={isPl ? 'Duplikuj' : 'Duplicate'}
        >
          <Copy size={15} />
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={locked}
          className={`${ICON} text-danger-600 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20`}
          title={isPl ? 'Usuń zaznaczone' : 'Delete selected'}
          aria-label={isPl ? 'Usuń' : 'Delete'}
        >
          <Trash2 size={15} />
        </button>

        {/* Right cluster — primary Save + status + AI/Convert */}
        <div className="ml-auto flex items-center gap-1">
          {onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              className={ICON}
              title={isPl ? 'Zapytaj AI o ten proces' : 'Ask AI about this process'}
              aria-label={isPl ? 'Zapytaj AI' : 'Ask AI'}
            >
              <MessageSquare size={15} />
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
          <span className="hidden lg:inline text-[11px] text-slate-500 dark:text-slate-400">
            {syncLabel}
          </span>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || locked}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              saving || locked
                ? 'bg-slate-200/60 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
                : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100'
            }`}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? (isPl ? 'Zapisuję…' : 'Saving…') : isPl ? 'Zapisz' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default ProcessFlowToolbar;
