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
  ScanText,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  type ActionContext,
  getActionsForSurface,
  runIdeaAction,
} from '@/actions/ideaActionRegistry';
import { isCanvasUndoInRailOnlyEnabled } from '@/utils/canvasUndoInRailOnlyFlag';

import TeresaMark from '../../shared/TeresaMark';
import { type ProcessFlowSemanticKit } from '../canvas/canvasOsContract';
import { FOCUS_RING } from '../canvas/motionTokens';
import { EMPTY_SELECTION } from '../ideaSelectionTypes';
import { type FlowShape, SHAPE_CONFIG } from './FlowNodeComponent';

// M07 F2: useProcessFlowAIProposal / AIProposalPanel now consume the real
// blob backend (POST /api/my-work/my-ideas/:id/ai-generate). This constant
// stays in the code as an emergency kill-switch (spec decision 7) — flip to
// false to hide the "Propozycja AI" button without touching the wiring.
export const AI_PROPOSAL_ENABLED = true;

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

// CB-05/RB-017/RV-007: the left rail (CanvasLeftToolbar PF_CONTEXT_SLOTS) owns
// exactly these four shapes as one-click primary create commands, across every
// flow mode/kit — decision #2/#3. The horizontal build palette below renders
// `availableShapes` MINUS this set, so it only ever shows the shapes genuinely
// specific to the active mode/kit that the rail has no equivalent for (End,
// the automation/VSM/BPMN/System/Org shapes, …).
const RAIL_OWNED_SHAPES = new Set<FlowShape>(['start', 'action', 'decision']);

// ── Props ────────────────────────────────────────────────────────────────────

export interface ProcessFlowToolbarProps {
  isPl: boolean;
  locked: boolean;
  flowMode: ProcessFlowMode;
  setFlowMode: (mode: ProcessFlowMode) => void;
  semanticKit: string;
  availableShapes: FlowShape[];
  addNode: (shape: FlowShape) => void;
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
  /** When true (Menu 1 owns the save indicator in the mels canvas shell), the
   *  toolbar hides its own Save button to avoid duplicating the identity-row
   *  save state. Save mechanics (autosave + handleSave) are untouched. Default
   *  OFF → legacy layout renders exactly as before. */
  hideSaveIndicator?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────────

// Hover uses c-surface (deeper) because the buttons now sit directly on the
// raised toolbar bar — the old cards (bg-c-surface) are gone, so a raised hover
// would be invisible.
const BTN = `inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium text-c-text-secondary hover:bg-c-surface transition-colors disabled:opacity-40 ${FOCUS_RING}`;

const OVERFLOW_ITEM = `flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-40 ${FOCUS_RING}`;

const MENU_HEADER = 'px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-c-text-muted';

/**
 * N6.4: tryb → id akcji rejestru. Osobna stała (nie inline w JSX), żeby pętla
 * po trzech zakładkach nie musiała zgadywać nazwy z szablonu stringa — literalne
 * id są łatwiejsze do wygrepowania przy audycie rejestru.
 */
const FLOW_MODE_ACTION_ID: Record<ProcessFlowMode, string> = {
  classic: 'idea.view.pf_mode_classic',
  automation: 'idea.view.pf_mode_automation',
  vsm: 'idea.view.pf_mode_vsm',
};

/** N6.4: pozycja grupy „Konwertuj" → id akcji rejestru (patrz komentarz przy
 *  `idea.node.pf_convert_analysis` — ta ostatnia jest dziś MARTWA i wpis
 *  rejestru mówi to wprost; menu zostaje nietknięte, bo to decyzja właściciela). */
const CONVERT_ACTION_ID: Record<string, string> = {
  pf_convert_initiative: 'idea.node.pf_convert_initiative',
  pf_convert_task_set: 'idea.node.pf_convert_task_set',
  pf_convert_report: 'idea.node.pf_convert_report',
  pf_convert_analysis: 'idea.node.pf_convert_analysis',
};

export const ProcessFlowToolbar: React.FC<ProcessFlowToolbarProps> = ({
  isPl,
  locked,
  flowMode,
  setFlowMode,
  semanticKit,
  availableShapes,
  addNode,
  insertBetween,
  splitPath,
  runValidation,
  showWarnings,
  warnings,
  showCoach,
  coachLoading,
  runProcessCoach,
  showSummary,
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
  handleSave,
  stepCount,
  laneCount,
  guidance,
  onOpenChat,
  onConvert,
  hideSaveIndicator = false,
}) => {
  const { t } = useTranslation();
  /** C: Cofnij/Ponów tylko w lewym pasku (flaga, domyślnie OFF). */
  const undoRedoInRailOnly = isCanvasUndoInRailOnlyEnabled();
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

  /**
   * N6.4 (2026-08-10, Program B/E02) — przełącznik trybu (3 zakładki) i menu
   * „Więcej" (13 pozycji) są teraz wpisami `surface: 'toolbar'` w
   * `ideaActionRegistry.ts`. Wzorzec 1:1 z `WhiteboardToolbar.tsx` (N7):
   * layout, etykiety i18n oraz lokalne stany `active`/`disabled`
   * (locked/coachLoading/summaryLoading/showKPIDashboard/…) ZOSTAJĄ DOKŁADNIE
   * takie jak przed migracją — zmienia się WYŁĄCZNIE sposób wykonania: zamiast
   * wołać prop-callback wprost, klik idzie przez `runIdeaAction` z tym samym
   * callbackiem w `ctx.params.run`. Brak wpisu w rejestrze = odpalamy
   * oryginalny callback (nigdy nie wyciszamy kliku), ale to sygnał do naprawy
   * rejestru, nie zamierzona ścieżka.
   */
  const registryActionsById = React.useMemo(() => {
    const map = new Map<string, ReturnType<typeof getActionsForSurface>[number]>();
    for (const entry of getActionsForSurface('toolbar', { tool: 'process_flow' })) {
      map.set(entry.def.id, entry);
    }
    return map;
  }, []);

  const runAction = React.useCallback(
    (id: string, run: () => void) => {
      if (!registryActionsById.has(id)) {
        run();
        return;
      }
      const ctx: ActionContext = {
        ideaId: '',
        tool: 'process_flow',
        selection: EMPTY_SELECTION,
        surface: 'toolbar',
        source: 'ui',
        language: isPl ? 'pl' : 'en',
        params: { run },
      };
      void runIdeaAction(id, ctx);
    },
    [registryActionsById, isPl]
  );

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
    <div className="border-b border-c-border-subtle bg-c-surface-raised flex-shrink-0">
      <div className="px-4 py-2 flex flex-col gap-2">
        {/* ── Top row: compact mode switch · status badges ───────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          {/* UI-L13: ONE segmented mode control (was two redundant rows) */}
          <div className="flex items-center gap-2">
            <div
              role="tablist"
              aria-label={t('processFlow.toolbar.flowModeAriaLabel', 'Flow mode')}
              className="flex items-center gap-0.5 rounded-lg bg-c-surface p-0.5"
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
                    onClick={() => runAction(FLOW_MODE_ACTION_ID[mode], () => setFlowMode(mode))}
                    title={tooltip}
                    aria-label={tooltip}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${FOCUS_RING} ${
                      flowMode === mode
                        ? 'bg-c-surface-raised text-c-text shadow-sm'
                        : 'text-c-text-muted hover:text-c-text-secondary'
                    }`}
                  >
                    {isPl ? FLOW_MODE_LABELS[mode].pl : FLOW_MODE_LABELS[mode].en}
                  </button>
                );
              })}
            </div>
            {kitLabel && (
              <span
                className="inline-flex items-center rounded-full bg-c-accent-soft px-2 py-0.5 text-[10px] font-medium text-c-text-secondary"
                title={t('processFlow.toolbar.kitTitle', 'Notation kit set from chat')}
              >
                {kitLabel}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center rounded-full bg-c-surface px-2 py-0.5 text-[10px] font-medium text-c-text-secondary">
              {t('processFlow.toolbar.stepsCount', 'Steps {{value}}', { value: stepCount })}
            </span>
            <span className="inline-flex items-center rounded-full bg-c-surface px-2 py-0.5 text-[10px] font-medium text-c-text-secondary">
              {/* Was a hardcoded `Lanes ${laneCount}` justified in-code as "term kept
                  in EN intentionally". Found on a PL screenshot (2026-08-10): the chip
                  immediately to the left IS translated, so a Polish consultant saw
                  „Kroki 4 | Lanes 1" — half the pair localized, half not, side by side.
                  „Ścieżki" is the term this repo already uses for swimlanes elsewhere
                  (myWorkIdeas.processFlowTool.lanes = „Ścieżek"). */}
              {t('processFlow.toolbar.lanesCount', 'Lanes {{value}}', { value: laneCount })}
            </span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                warnings.length > 0
                  ? 'bg-warning-500/10 text-warning-600 dark:text-warning-300'
                  : 'bg-success-500/10 text-emerald-800 dark:text-success-300'
              }`}
            >
              {warnings.length > 0
                ? t('processFlow.toolbar.warningsCount', 'Warnings {{value}}', {
                    value: warnings.length,
                  })
                : t('processFlow.toolbar.noWarnings', 'No warnings')}
            </span>
          </div>
        </div>

        {/* Mode guidance — single subtle line, truncated so it never wraps/cuts */}
        <p
          className="text-[11px] text-c-text-secondary truncate"
          title={isPl ? guidance.pl : guidance.en}
        >
          {isPl ? guidance.pl : guidance.en}
        </p>

        {/* ── Main toolbar: build palette · edit · save · Więcej ─────────── */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Build palette — mode/kit-specific shapes only. Start/Action/Decision
              (and Lane, below) are the left rail's job (RB-017/RV-007); showing
              them here too was the duplicate-ownership finding. */}
          {availableShapes
            .filter((shape) => !RAIL_OWNED_SHAPES.has(shape))
            .map((shape) => {
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

          <div className="mx-0.5 h-5 w-px bg-c-border-subtle" />

          <button
            type="button"
            onClick={insertBetween}
            disabled={locked}
            className={BTN}
            title={t('processFlow.toolbar.insertBetweenTitle', 'Insert between')}
          >
            <Plus size={14} />
            {t('processFlow.toolbar.insert', 'Insert')}
          </button>
          <button
            type="button"
            onClick={splitPath}
            disabled={locked}
            className={BTN}
            title={t('processFlow.toolbar.splitPathTitle', 'Split path')}
          >
            <GitMerge size={14} />
            {t('processFlow.toolbar.split', 'Split')}
          </button>

          <div className="ml-auto" />

          {/*
           * Sprzątanie C (2026-07-28, flaga `ff_canvasUndoInRailOnly`, OFF):
           * Przepływ miał DWA komplety Cofnij/Ponów na jednym ekranie — ten i
           * lewy pasek. Właściciel o parze z paska poziomego: „to nie jest
           * potrzebne bo mamy to samo w panelu lewym". Traktujemy identycznie
           * jak Tablicę. Funkcja zostaje: lewy pasek (`pf_undo`/`pf_redo`),
           * Ctrl/Cmd+Z i Ctrl/Cmd+Shift+Z, sekcja „Historia" prawego panelu.
           */}
          {!undoRedoInRailOnly && (
            <>
              <button
                type="button"
                onClick={undo}
                disabled={!canUndo || locked}
                className={`inline-flex items-center rounded-lg px-1.5 py-1.5 text-c-text-secondary hover:bg-c-surface transition-colors disabled:opacity-30 ${FOCUS_RING}`}
                title={t('processFlow.toolbar.undoTitle', 'Undo (Ctrl+Z)')}
                aria-label={t('processFlow.toolbar.undo', 'Undo')}
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                onClick={redo}
                disabled={!canRedo || locked}
                className={`inline-flex items-center rounded-lg px-1.5 py-1.5 text-c-text-secondary hover:bg-c-surface transition-colors disabled:opacity-30 ${FOCUS_RING}`}
                title={t('processFlow.toolbar.redoTitle', 'Redo (Ctrl+Shift+Z)')}
                aria-label={t('processFlow.toolbar.redo', 'Redo')}
              >
                <Redo2 size={14} />
              </button>
            </>
          )}

          {/* Z9: gdy Menu 1 (mels canvas shell) niesie własny wskaźnik zapisu
              (IdeaSaveIndicator), toolbar chowa WŁASNY przycisk Zapisz (wraz z
              dzielnikiem) — zero dubli. hideSaveIndicator=false (legacy) →
              renderuje jak dotąd. Mechanika zapisu (autosave + handleSave) bez
              zmian. */}
          {!hideSaveIndicator && (
            <>
              <div className="mx-0.5 h-5 w-px bg-c-border-subtle" />

              {/* Save (primary, always visible) */}
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || locked}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${FOCUS_RING} ${
                  saving || locked
                    ? 'bg-c-surface-raised text-c-text-muted'
                    : 'bg-c-text text-c-surface hover:brightness-110'
                }`}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving
                  ? t('processFlow.toolbar.saving', 'Saving…')
                  : t('processFlow.toolbar.save', 'Save')}
              </button>
            </>
          )}
          {/* #6c: "Saved Xs ago" tekst usunięty — autosave ma być cichy (dublet z Mind Map #6b/#6c).
              Mechanika sync (syncLabel prop) zostaje niezmieniona, tylko nie renderujemy jej. */}

          {/* Overflow "Więcej" — analyze · manage · convert (progressive disclosure) */}
          <div className="relative" ref={overflowRef}>
            <button
              type="button"
              onClick={() => setOverflowOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={overflowOpen}
              className={`${BTN} ${overflowOpen ? 'bg-c-surface' : ''}`}
              title={t('processFlow.toolbar.moreActions', 'More actions')}
              aria-label={t('processFlow.toolbar.moreActions', 'More actions')}
            >
              <MoreHorizontal size={16} />
              {t('processFlow.toolbar.more', 'More')}
            </button>
            {overflowOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-1 z-50 flex w-60 flex-col rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-xl py-1"
              >
                {/* ── Analyze & validate ── */}
                <div className={MENU_HEADER}>
                  {t('processFlow.toolbar.analyzeAndValidate', 'Analyze and validate')}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runAction('idea.view.pf_toggle_kpi', () => {
                      setShowKPIDashboard((v) => !v);
                      setOverflowOpen(false);
                    })
                  }
                  className={`${OVERFLOW_ITEM} ${showKPIDashboard ? 'text-c-text font-semibold' : ''}`}
                >
                  <BarChart3 size={14} />
                  KPI
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runAction('idea.view.pf_validate', () => {
                      runValidation();
                      setOverflowOpen(false);
                    })
                  }
                  className={`${OVERFLOW_ITEM} ${
                    showWarnings ? 'text-warning-600 dark:text-warning-300' : ''
                  }`}
                >
                  <AlertTriangle size={14} />
                  {t('processFlow.toolbar.validate', 'Validate')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runAction('idea.ai.process_analysis', () => {
                      runProcessCoach();
                      setOverflowOpen(false);
                    })
                  }
                  disabled={locked || coachLoading}
                  className={`${OVERFLOW_ITEM} ${showCoach ? 'text-c-text font-semibold' : ''}`}
                >
                  {coachLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <TeresaMark size={14} />
                  )}
                  {t('myWork.aiCoachPanel.aICoach', 'AI Coach')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runAction('idea.ai.pf_process_summary', () => {
                      generateSummary();
                      setOverflowOpen(false);
                    })
                  }
                  disabled={locked || summaryLoading}
                  className={`${OVERFLOW_ITEM} ${
                    showSummary ? 'text-success-600 dark:text-success-300' : ''
                  }`}
                >
                  {summaryLoading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <BarChart3 size={14} />
                  )}
                  {t('processFlow.toolbar.summarize', 'Summary')}
                </button>
                {onOpenReadback && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      runAction('idea.view.pf_readback', () => {
                        onOpenReadback();
                        setOverflowOpen(false);
                      })
                    }
                    className={`${OVERFLOW_ITEM} ${showReadbackPanel ? 'text-c-info' : ''}`}
                  >
                    <ScanText size={14} />
                    {t('processFlow.toolbar.readback', 'Readback')}
                  </button>
                )}
                {AI_PROPOSAL_ENABLED && onOpenAIProposal && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() =>
                      runAction('idea.view.pf_open_ai_proposal', () => {
                        onOpenAIProposal();
                        setOverflowOpen(false);
                      })
                    }
                    disabled={locked}
                    className={`${OVERFLOW_ITEM} ${showAIPanel ? 'text-c-tag-2' : ''}`}
                  >
                    <Sparkles size={14} />
                    {t('processFlow.toolbar.aiProposalLabel', 'AI Proposal')}
                  </button>
                )}

                <div className="my-1 h-px bg-c-surface-raised" />

                {/* ── Manage canvas ── */}
                <div className={MENU_HEADER}>
                  {t('processFlow.toolbar.manageCanvas', 'Manage canvas')}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runAction('idea.view.auto_layout', () => {
                      handleAutoLayout();
                      setOverflowOpen(false);
                    })
                  }
                  disabled={locked}
                  className={OVERFLOW_ITEM}
                >
                  <LayoutGrid size={14} />
                  {t('processFlow.toolbar.autoArrangeTitle', 'Auto arrange')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runAction('idea.node.duplicate', () => {
                      duplicateSelected();
                      setOverflowOpen(false);
                    })
                  }
                  disabled={locked}
                  className={OVERFLOW_ITEM}
                >
                  <Copy size={14} />
                  {t('processFlow.toolbar.duplicateWithShortcut', 'Duplicate (Ctrl+D)')}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() =>
                    runAction('idea.node.delete', () => {
                      deleteSelected();
                      setOverflowOpen(false);
                    })
                  }
                  disabled={locked}
                  className={`${OVERFLOW_ITEM} text-danger-600 dark:text-danger-400`}
                >
                  <Trash2 size={14} />
                  {t('processFlow.toolbar.deleteSelected', 'Delete selected')}
                </button>
                {onOpenChat && (
                  <>
                    <div className="my-1 h-px bg-c-surface-raised" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() =>
                        runAction('idea.node.pf_open_chat', () => {
                          onOpenChat();
                          setOverflowOpen(false);
                        })
                      }
                      className={OVERFLOW_ITEM}
                    >
                      <MessageSquare size={14} />
                      {t('processFlow.toolbar.askAiAboutProcess', 'Ask AI about this process')}
                    </button>
                  </>
                )}
                {onConvert && (
                  <>
                    <div className="my-1 h-px bg-c-surface-raised" />
                    <div className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider text-c-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Rocket size={11} />
                        {t('processFlow.toolbar.convert', 'Convert')}
                      </span>
                    </div>
                    {(
                      [
                        [
                          'pf_convert_initiative',
                          t('processFlow.toolbar.convertInitiative', 'Initiative'),
                        ],
                        [
                          'pf_convert_task_set',
                          t('processFlow.toolbar.convertTaskSet', 'Task set'),
                        ],
                        ['pf_convert_report', t('processFlow.toolbar.convertReport', 'Report')],
                        [
                          'pf_convert_analysis',
                          t('processFlow.toolbar.convertAnalysis', 'Analysis'),
                        ],
                      ] as [string, string][]
                    ).map(([action, label]) => (
                      <button
                        key={action}
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          runAction(CONVERT_ACTION_ID[action] || action, () => {
                            onConvert(action);
                            setOverflowOpen(false);
                          })
                        }
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
  );
};

export default ProcessFlowToolbar;
