import {
  AlertTriangle,
  BarChart3,
  Copy,
  GitMerge,
  LayoutGrid,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Plus,
  Redo2,
  Rocket,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

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

/**
 * Human-readable label for the semantic kit chip. `classic/automation/vsm` mirror the
 * flow mode (so we don't surface them as a redundant "Kit" pill — only the specialised
 * kits, which are set from chat via IDEA_WORKSPACE_FLOW_SEMANTIC_EVENT, get a chip).
 */
export const SEMANTIC_KIT_LABELS: Record<string, { en: string; pl: string }> = {
  bpmn: { en: 'BPMN notation', pl: 'Notacja BPMN' },
  system: { en: 'System map', pl: 'Mapa systemowa' },
  org: { en: 'Org / RACI', pl: 'Organizacja / RACI' },
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
}

// ── Component ────────────────────────────────────────────────────────────────

const BTN =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors disabled:opacity-40';

const OVERFLOW_ITEM =
  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-800 disabled:opacity-40';

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
}) => {
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overflowOpen) return;
    const handler = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowOpen]);

  // UI-L13: the specialised semantic kits (bpmn/system/org) are set from chat and
  // change the shape palette; classic/automation/vsm mirror the flow mode, so we only
  // surface a "kit" chip for the specialised ones — no redundant second mode row.
  const kitLabel =
    semanticKit && SEMANTIC_KIT_LABELS[semanticKit]
      ? isPl
        ? SEMANTIC_KIT_LABELS[semanticKit].pl
        : SEMANTIC_KIT_LABELS[semanticKit].en
      : null;

  return (
  <div className="border-b border-slate-200/60 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/80 flex-shrink-0">
    <div className="px-4 py-3 flex flex-col gap-3">
      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* UI-L13: ONE segmented mode control (was two redundant rows) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {isPl ? 'Tryb' : 'Mode'}
          </span>
          <div
            role="tablist"
            aria-label={isPl ? 'Tryb przepływu' : 'Flow mode'}
            className="flex items-center gap-0.5 rounded-lg bg-slate-100 dark:bg-navy-800 p-0.5"
          >
            {(['classic', 'automation', 'vsm'] as ProcessFlowMode[]).map((mode) => {
              const g = FLOW_MODE_GUIDANCE[mode];
              const tooltip = `${isPl ? FLOW_MODE_LABELS[mode].pl : FLOW_MODE_LABELS[mode].en} — ${
                isPl ? g.pl : g.en
              }`;
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={flowMode === mode}
                  onClick={() => setFlowMode(mode)}
                  title={tooltip}
                  aria-label={tooltip}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                    flowMode === mode
                      ? 'bg-white dark:bg-navy-700 text-primary-600 dark:text-primary-400 shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  {isPl ? FLOW_MODE_LABELS[mode].pl : FLOW_MODE_LABELS[mode].en}
                </button>
              );
            })}
          </div>
          {kitLabel && (
            <span
              className="inline-flex items-center rounded-full bg-primary-500/10 px-2 py-0.5 text-[10px] font-medium text-primary-600 dark:text-primary-300"
              title={isPl ? 'Zestaw notacji ustawiony z czatu' : 'Notation kit set from chat'}
            >
              {kitLabel}
            </span>
          )}
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

      {/* Mode guidance line (single, contextual — replaces the redundant stage badge) */}
      <p className="-mt-1 text-[11px] text-slate-600 dark:text-slate-300">
        {isPl ? guidance.pl : guidance.en}
      </p>

      {/* ── Toolbar sections ───────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
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
          </div>
        </div>

        {/* Manage canvas — command-row hierarchy: primary (max 4) · secondary · overflow "…" */}
        <div className="flex-1 min-w-[280px] rounded-xl border border-slate-200/70 dark:border-navy-700 bg-white/70 dark:bg-navy-900/50 p-2.5">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            {isPl ? 'Zarządzanie canvasem' : 'Manage canvas'}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Primary: Save (strongest action) */}
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

            <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-navy-700" />

            {/* Secondary: undo / redo / auto-layout */}
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

            <div className="ml-auto" />

            {/* Overflow "…" — duplicate / delete / ask AI / convert */}
            <div className="relative" ref={overflowRef}>
              <button
                type="button"
                onClick={() => setOverflowOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={overflowOpen}
                className={`${BTN} ${overflowOpen ? 'bg-slate-100 dark:bg-navy-800' : ''}`}
                title={isPl ? 'Więcej akcji' : 'More actions'}
                aria-label={isPl ? 'Więcej akcji' : 'More actions'}
              >
                <MoreHorizontal size={16} />
              </button>
              {overflowOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 z-50 flex w-48 flex-col rounded-xl border border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900 shadow-xl py-1"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      duplicateSelected();
                      setOverflowOpen(false);
                    }}
                    disabled={locked}
                    className={OVERFLOW_ITEM}
                  >
                    <Copy size={14} />
                    {isPl ? 'Duplikuj (Ctrl+D)' : 'Duplicate (Ctrl+D)'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      deleteSelected();
                      setOverflowOpen(false);
                    }}
                    disabled={locked}
                    className={`${OVERFLOW_ITEM} text-danger-600 dark:text-danger-400`}
                  >
                    <Trash2 size={14} />
                    {isPl ? 'Usuń zaznaczone' : 'Delete selected'}
                  </button>
                  {onOpenChat && (
                    <>
                      <div className="my-1 h-px bg-slate-100 dark:bg-navy-800" />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          onOpenChat();
                          setOverflowOpen(false);
                        }}
                        className={OVERFLOW_ITEM}
                      >
                        <MessageSquare size={14} />
                        {isPl ? 'Zapytaj AI o ten proces' : 'Ask AI about this process'}
                      </button>
                    </>
                  )}
                  {onConvert && (
                    <>
                      <div className="my-1 h-px bg-slate-100 dark:bg-navy-800" />
                      <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Rocket size={11} />
                          {isPl ? 'Konwertuj' : 'Convert'}
                        </span>
                      </div>
                      {(
                        [
                          ['pf_convert_initiative', isPl ? 'Inicjatywa' : 'Initiative'],
                          ['pf_convert_task_set', isPl ? 'Zadania' : 'Task set'],
                          ['pf_convert_report', isPl ? 'Raport' : 'Report'],
                          ['pf_convert_analysis', isPl ? 'Analiza' : 'Analysis'],
                        ] as [string, string][]
                      ).map(([action, label]) => (
                        <button
                          key={action}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            onConvert(action);
                            setOverflowOpen(false);
                          }}
                          className={OVERFLOW_ITEM}
                        >
                          {label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default ProcessFlowToolbar;
