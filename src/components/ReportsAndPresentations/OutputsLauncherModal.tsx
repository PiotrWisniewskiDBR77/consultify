/**
 * OutputsLauncherModal — wspólne wejście „Nowy" dla generatorów deliverable (M17–M20).
 *
 * Przepływ 2-krokowy (SSOT docs/product/DELIVERABLES_GENERATORS_SPEC.md §1):
 *   E1 · krok 1 — wybór TYPU (Raport · Prezentacja · Tabela). Wyjście różne, wejście wspólne.
 *   E2 · krok 2 — wybór TEMPLATE (Blank + kuratorowane v1). Galeria per typ.
 * Wybór emituje `onSelect({ type, templateId })`; spięcie z silnikiem generacji
 * + „paczką kontekstu" = sub-moduł E3. Realna biblioteka DBR77 + user-created = seria T.
 *
 * Styl/kanon wzorowany na MyWork/notebook/NewPageModal (overlay + backdrop-dismiss + Escape).
 */

import {
  ArrowLeft,
  ClipboardList,
  Download,
  FileText,
  LayoutDashboard,
  Loader2,
  Package2,
  PenSquare,
  Presentation,
  ShieldAlert,
  Sparkles,
  Table2,
  Wand2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { downloadBundleZip } from '../../services/deliverablesBundle';
import { type CanvasOutputResource, createOutputFromCanvasDraft } from './createOutputFromCanvas';
import { useDeliverableTemplates } from './useDeliverableTemplates';
import { useRecentWorkCanvasDrafts } from './useRecentWorkCanvasDrafts';
import { useTemplateSuggestion } from './useTemplateSuggestion';

export type DeliverableType = 'report' | 'presentation' | 'table';

export interface LauncherSelection {
  type: DeliverableType;
  /** templateId === 'blank' ⇒ start od zera (bez szkieletu). */
  templateId: string;
}

/** #83e — result of POST /work-canvas/drafts/:id/create-output. Re-exported for callers. */
export type { CanvasOutputResource };

/** #83e — step-2 sub-mode: start from a template gallery, or from an existing canvas. */
type TemplateStepMode = 'template' | 'canvas';

interface TypeTile {
  type: DeliverableType;
  icon: React.ReactNode;
  gradient: string;
  labelKey: string;
  labelFallback: string;
  hintKey: string;
  hintFallback: string;
}

interface TemplateCard {
  id: string;
  icon: React.ReactNode;
  labelKey: string;
  labelFallback: string;
}

const TYPE_TILES: TypeTile[] = [
  {
    type: 'report',
    icon: <FileText size={22} />,
    gradient: 'from-primary-500 to-primary-600',
    labelKey: 'rap.outputs.launcher.report',
    labelFallback: 'Report',
    hintKey: 'rap.outputs.launcher.reportHint',
    hintFallback: 'Advisory document — Teresa helps you write it',
  },
  {
    type: 'presentation',
    icon: <Presentation size={22} />,
    gradient: 'from-blue-500 to-indigo-600',
    labelKey: 'rap.outputs.launcher.presentation',
    labelFallback: 'Presentation',
    hintKey: 'rap.outputs.launcher.presentationHint',
    hintFallback: 'Gamma-grade slides with layout and visuals',
  },
  {
    type: 'table',
    icon: <Table2 size={22} />,
    gradient: 'from-emerald-500 to-green-600',
    labelKey: 'rap.outputs.launcher.table',
    labelFallback: 'Table',
    hintKey: 'rap.outputs.launcher.tableHint',
    hintFallback: 'Typed, formatted sheet — Airtable/Excel style',
  },
];

const BLANK_CARD: TemplateCard = {
  id: 'blank',
  icon: <Sparkles size={18} />,
  labelKey: 'rap.outputs.launcher.tpl.blank',
  labelFallback: 'Blank',
};

/** #83e — compact "updated" date for the canvas picker rows; no i18n lib dependency. */
function formatCanvasUpdatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
}

// v1 — kuratorowane szablony placeholder (realna biblioteka DBR77 = seria T).
// id-y zgodne ze scenariuszami MQ-* z DELIVERABLES_QUALITY_RUBRIC.md.
const TEMPLATES: Record<DeliverableType, TemplateCard[]> = {
  report: [
    BLANK_CARD,
    {
      id: 'audit-report',
      icon: <ClipboardList size={18} />,
      labelKey: 'rap.outputs.launcher.tpl.auditReport',
      labelFallback: 'Audit report',
    },
    {
      id: 'exec-memo',
      icon: <FileText size={18} />,
      labelKey: 'rap.outputs.launcher.tpl.execMemo',
      labelFallback: 'Executive memo',
    },
  ],
  presentation: [
    BLANK_CARD,
    {
      id: 'board-deck',
      icon: <Presentation size={18} />,
      labelKey: 'rap.outputs.launcher.tpl.boardDeck',
      labelFallback: 'Board deck',
    },
    {
      id: 'diagnostic',
      icon: <LayoutDashboard size={18} />,
      labelKey: 'rap.outputs.launcher.tpl.diagnostic',
      labelFallback: 'Diagnostic read-out',
    },
  ],
  table: [
    BLANK_CARD,
    {
      id: 'risk-register',
      icon: <ShieldAlert size={18} />,
      labelKey: 'rap.outputs.launcher.tpl.riskRegister',
      labelFallback: 'Risk register',
    },
    {
      id: 'kpi-dashboard',
      icon: <LayoutDashboard size={18} />,
      labelKey: 'rap.outputs.launcher.tpl.kpiDashboard',
      labelFallback: 'KPI dashboard',
    },
  ],
};

export interface OutputsLauncherModalProps {
  open: boolean;
  onClose: () => void;
  /** Wywoływane po wyborze typu + template. */
  onSelect: (selection: LauncherSelection) => void;
  /** Wywoływane po udanej generacji Kompletu AI — pozwala odświeżyć historię. */
  onBundleGenerated?: () => void;
  /**
   * #83e — wywoływane po udanej konwersji wybranego canvasa na output
   * (Api.workCanvasCreateOutput). W przeciwieństwie do onSelect (które seeduje
   * czat Teresy pustym openerem), output tutaj JUŻ istnieje z treścią canvasa —
   * caller nawiguje pod `output.url`.
   */
  onCanvasOutputCreated?: (output: CanvasOutputResource) => void;
}

export const OutputsLauncherModal: React.FC<OutputsLauncherModalProps> = ({
  open,
  onClose,
  onSelect,
  onBundleGenerated,
  onCanvasOutputCreated,
}) => {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [selectedType, setSelectedType] = useState<DeliverableType | null>(null);

  const {
    templates: apiTemplates,
    loading: tplLoading,
    error: tplError,
  } = useDeliverableTemplates(selectedType);

  const {
    loading: suggestLoading,
    suggestion,
    suggest,
    reset: resetSuggestion,
  } = useTemplateSuggestion();

  const [intentInput, setIntentInput] = useState('');

  // #83e — 3rd wizard option: "From canvas". Sits alongside Blank/Template at
  // step 2; picking a canvas calls the existing Api.workCanvasCreateOutput
  // conversion endpoint (accepts outputType = report|presentation|table, a 1:1
  // match with DeliverableType) instead of seeding a blank Teresa opener.
  const [templateStepMode, setTemplateStepMode] = useState<TemplateStepMode>('template');
  const {
    drafts: canvasDrafts,
    loading: canvasDraftsLoading,
    error: canvasDraftsError,
  } = useRecentWorkCanvasDrafts(!!selectedType && templateStepMode === 'canvas');
  const [canvasConvertBusyId, setCanvasConvertBusyId] = useState<string | null>(null);
  const [canvasConvertError, setCanvasConvertError] = useState<string | null>(null);

  // W3.5 — Komplet AI: brief → ZIP generation state.
  const [bundleStep, setBundleStep] = useState(false);
  const [bundleBrief, setBundleBrief] = useState('');
  const [bundleLoading, setBundleLoading] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);
  // W3.7 — animated generation phases (simulated 20s per phase, 5 phases total).
  const [bundlePhase, setBundlePhase] = useState(0);
  const bundlePhaseRef = useRef(0);

  // Reset kroku przy każdym otwarciu.
  useEffect(() => {
    if (open) {
      setSelectedType(null);
      setIntentInput('');
      resetSuggestion();
      setBundleStep(false);
      setBundleBrief('');
      setBundleError(null);
      setBundlePhase(0);
      bundlePhaseRef.current = 0;
      setTemplateStepMode('template');
      setCanvasConvertBusyId(null);
      setCanvasConvertError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset the canvas sub-mode whenever the type tile changes (going back to
  // step 1 and picking a different type starts step 2 fresh on Template).
  useEffect(() => {
    setTemplateStepMode('template');
    setCanvasConvertError(null);
  }, [selectedType]);

  // W3.7 — cycle through generation phases while loading.
  useEffect(() => {
    if (!bundleLoading) {
      setBundlePhase(0);
      bundlePhaseRef.current = 0;
      return;
    }
    bundlePhaseRef.current = 0;
    setBundlePhase(0);
    const PHASE_DURATION = 22_000; // ~22s per phase → 5 × 22 = 110s fits within 120s timeout
    const tick = () => {
      if (bundlePhaseRef.current < 4) {
        bundlePhaseRef.current += 1;
        setBundlePhase(bundlePhaseRef.current);
      }
    };
    const timers = [
      setTimeout(tick, PHASE_DURATION),
      setTimeout(tick, PHASE_DURATION * 2),
      setTimeout(tick, PHASE_DURATION * 3),
      setTimeout(tick, PHASE_DURATION * 4),
    ];
    return () => timers.forEach(clearTimeout);
  }, [bundleLoading]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (bundleStep) setBundleStep(false);
        else if (selectedType) setSelectedType(null);
        else onClose();
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose, selectedType]);

  const handlePickTemplate = useCallback(
    (templateId: string) => {
      if (!selectedType) return;
      onSelect({ type: selectedType, templateId });
      onClose();
    },
    [selectedType, onSelect, onClose]
  );

  // Mapowanie launcher type → API type
  const toApiType = (t: DeliverableType): 'doc' | 'deck' | 'table' =>
    t === 'report' ? 'doc' : t === 'presentation' ? 'deck' : 'table';

  const handleSuggest = useCallback(() => {
    if (!selectedType) return;
    const intentText =
      intentInput.trim() ||
      t('rap.outputs.launcher.suggestDefaultIntent', 'choose the best template for me');
    suggest(intentText, toApiType(selectedType));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, intentInput, suggest, t]);

  // #83e — convert a picked canvas draft directly into the selected output
  // type via the existing Work Canvas → Outputs endpoint. The result already
  // carries real content (no Teresa-seeded blank opener needed) so we hand it
  // to the caller (onCanvasOutputCreated) and close, mirroring handlePickTemplate.
  const handleUseCanvas = useCallback(
    async (draftId: string) => {
      if (!selectedType) return;
      setCanvasConvertBusyId(draftId);
      setCanvasConvertError(null);
      try {
        const outputResource = await createOutputFromCanvasDraft(draftId, selectedType);
        onCanvasOutputCreated?.(outputResource);
        onClose();
      } catch {
        setCanvasConvertError(
          t(
            'rap.outputs.launcher.canvasConvertError',
            'Failed to create the output from this canvas — please try again.'
          )
        );
      } finally {
        setCanvasConvertBusyId(null);
      }
    },
    [selectedType, onCanvasOutputCreated, onClose, t]
  );

  const handleBundleGenerate = useCallback(async () => {
    const brief = bundleBrief.trim();
    if (brief.length < 20) {
      setBundleError(
        t('rap.outputs.launcher.bundleBriefTooShort', 'Brief must be at least 20 characters')
      );
      return;
    }
    setBundleLoading(true);
    setBundleError(null);
    const ok = await downloadBundleZip(brief);
    setBundleLoading(false);
    if (ok) {
      onBundleGenerated?.(); // odśwież historię bundli w hubie
      onClose();
    } else {
      setBundleError(t('rap.outputs.launcher.bundleError', 'Generation failed — please try again'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleBrief, onClose, onBundleGenerated, t]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      data-testid="launcher-modal"
      aria-labelledby="outputs-launcher-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-xl mx-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-800">
          <div className="flex items-center gap-2 min-w-0">
            {(selectedType || bundleStep) && (
              <button
                onClick={() => {
                  setBundleStep(false);
                  setSelectedType(null);
                }}
                data-testid="launcher-back"
                className="p-1 rounded-lg text-slate-600 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                aria-label={t('rap.outputs.launcher.back', 'Back')}
              >
                <ArrowLeft size={18} />
              </button>
            )}
            <h2
              id="outputs-launcher-title"
              className="text-base font-semibold text-slate-900 dark:text-white truncate"
            >
              {bundleStep
                ? t('rap.outputs.launcher.bundleTitle', 'Komplet AI — brief')
                : selectedType
                  ? t('rap.outputs.launcher.chooseTemplate', 'Choose a template')
                  : t('rap.outputs.launcher.title', 'New output')}
            </h2>
          </div>
          <button
            onClick={onClose}
            data-testid="launcher-close"
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            aria-label={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {bundleStep ? (
            /* W3.5 — Komplet AI: brief textarea → ZIP generation */
            <div className="flex flex-col gap-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t(
                  'rap.outputs.launcher.bundleSubtitle',
                  'Describe your company, product, market, and ask in one paragraph. The AI will produce DOCX + XLSX + PPTX and download them as a ZIP.'
                )}
              </p>
              <textarea
                data-testid="launcher-bundle-brief"
                value={bundleBrief}
                onChange={(e) => {
                  setBundleBrief(e.target.value);
                  setBundleError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) void handleBundleGenerate();
                }}
                rows={5}
                maxLength={4000}
                placeholder={t(
                  'rap.outputs.launcher.bundleBriefPlaceholder',
                  'e.g. Acme is a SaaS B2B platform for logistics companies in Central Europe. TAM €3B, asking €500k seed. Primary KPIs: MRR €40k, NRR 115%, burn €25k/mo…'
                )}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-c-focus resize-none"
              />
              <div className="text-[11px] text-slate-400 -mt-2">
                {bundleBrief.length}/4000 {t('common.characters', 'characters')}
              </div>
              {bundleError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
                  {bundleError}
                </div>
              )}
              {bundleLoading && (
                <div className="flex flex-col gap-2 px-1">
                  {[
                    t('rap.outputs.launcher.phase0', 'Analyzing brief & extracting KPIs…'),
                    t('rap.outputs.launcher.phase1', 'Building financial model…'),
                    t('rap.outputs.launcher.phase2', 'Writing report sections…'),
                    t('rap.outputs.launcher.phase3', 'Composing slide deck…'),
                    t('rap.outputs.launcher.phase4', 'Rendering DOCX + XLSX + PPTX…'),
                  ].map((label, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div
                        className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] ${
                          idx < bundlePhase
                            ? 'bg-violet-600 text-white'
                            : idx === bundlePhase
                              ? 'border-2 border-violet-500 bg-white dark:bg-navy-900'
                              : 'border-2 border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900'
                        }`}
                      >
                        {idx < bundlePhase && '✓'}
                        {idx === bundlePhase && (
                          <span className="block w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                        )}
                      </div>
                      <span
                        className={`text-xs ${idx === bundlePhase ? 'text-slate-900 dark:text-white font-medium' : idx < bundlePhase ? 'text-slate-400 line-through' : 'text-slate-300 dark:text-navy-600'}`}
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                  <p className="mt-1 text-[11px] text-slate-400 dark:text-navy-600">
                    {t(
                      'rap.outputs.launcher.phaseEstimateNote',
                      'Szacowany przebieg — generacja trwa zwykle 1–2 min, pobieranie ruszy po zakończeniu.'
                    )}
                  </p>
                </div>
              )}
              <button
                type="button"
                data-testid="launcher-bundle-generate"
                onClick={() => void handleBundleGenerate()}
                disabled={bundleLoading || bundleBrief.trim().length < 20}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {bundleLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />{' '}
                    {t('rap.outputs.launcher.bundleGenerating', 'Generating…')}
                  </>
                ) : (
                  <>
                    <Download size={16} />{' '}
                    {t('rap.outputs.launcher.bundleGenerate', 'Generate & download ZIP')}
                  </>
                )}
              </button>
            </div>
          ) : !selectedType ? (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {t('rap.outputs.launcher.subtitle', 'Pick what you want to create')}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {TYPE_TILES.map((tile) => {
                  const label = t(tile.labelKey, tile.labelFallback);
                  return (
                    <button
                      key={tile.type}
                      type="button"
                      data-testid={`launcher-type-${tile.type}`}
                      onClick={() => setSelectedType(tile.type)}
                      aria-label={label}
                      className="group flex flex-col items-start gap-3 w-full p-4 rounded-xl text-left border border-slate-200 dark:border-navy-700 hover:border-slate-300 dark:hover:border-navy-600 hover:shadow-md bg-white dark:bg-navy-950 transition-all duration-150 hover:-translate-y-0.5"
                    >
                      <div
                        className={`shrink-0 p-2.5 rounded-lg bg-gradient-to-br ${tile.gradient} text-white`}
                      >
                        {tile.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm text-slate-900 dark:text-white">
                          {label}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {t(tile.hintKey, tile.hintFallback)}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              {/* W3.5 — Komplet AI tile: pełna szerokość, wyróżniona */}
              <button
                type="button"
                data-testid="launcher-type-bundle"
                onClick={() => setBundleStep(true)}
                className="group mt-3 flex items-center gap-3 w-full p-4 rounded-xl text-left border border-violet-200 dark:border-violet-800 hover:border-violet-400 dark:hover:border-violet-600 hover:shadow-md bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 transition-all duration-150 hover:-translate-y-0.5"
              >
                <div className="shrink-0 p-2.5 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <Package2 size={22} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-violet-900 dark:text-violet-100">
                      {t('rap.outputs.launcher.bundle', 'Komplet AI')}
                    </span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300">
                      {t('common.new', 'NEW')}
                    </span>
                  </div>
                  <div className="text-[11px] text-violet-700 dark:text-violet-400 mt-0.5">
                    {t(
                      'rap.outputs.launcher.bundleHint',
                      'One brief → DOCX + XLSX + PPTX downloaded as ZIP'
                    )}
                  </div>
                </div>
                <Sparkles size={16} className="shrink-0 text-violet-400 dark:text-violet-500" />
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {t('rap.outputs.launcher.templateSubtitle', 'Start blank or from a template')}
              </p>

              {/* #83e — 3rd wizard option: Template gallery vs From canvas. */}
              <div
                className="mb-3 flex gap-1 rounded-lg bg-slate-100 dark:bg-navy-900 p-1"
                role="tablist"
                aria-label={t('rap.outputs.launcher.modeLabel', 'Start mode')}
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={templateStepMode === 'template'}
                  data-testid="launcher-mode-template"
                  onClick={() => setTemplateStepMode('template')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    templateStepMode === 'template'
                      ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <Sparkles size={13} />
                  {t('rap.outputs.launcher.modeTemplate', 'Blank / Template')}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={templateStepMode === 'canvas'}
                  data-testid="launcher-mode-canvas"
                  onClick={() => setTemplateStepMode('canvas')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    templateStepMode === 'canvas'
                      ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  <PenSquare size={13} />
                  {t('rap.outputs.launcher.modeCanvas', 'From canvas')}
                </button>
              </div>

              {templateStepMode === 'canvas' ? (
                /* #83e — From canvas: pick a recent canvas → convert directly via
                   Api.workCanvasCreateOutput (real content, not a blank Teresa seed). */
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t(
                      'rap.outputs.launcher.canvasSubtitle',
                      'Pick a recent canvas to turn into this output — its content carries over immediately.'
                    )}
                  </p>

                  {canvasDraftsLoading && (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <Loader2 size={20} className="animate-spin mr-2" />
                      <span className="text-sm">{t('common.loading', 'Loading...')}</span>
                    </div>
                  )}

                  {!canvasDraftsLoading && canvasDraftsError && (
                    <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
                      {canvasDraftsError}
                    </div>
                  )}

                  {!canvasDraftsLoading && !canvasDraftsError && canvasDrafts.length === 0 && (
                    <div
                      className="px-3 py-6 text-center text-xs text-slate-400 dark:text-slate-500"
                      data-testid="launcher-canvas-empty"
                    >
                      {t(
                        'rap.outputs.launcher.canvasEmpty',
                        'No canvases yet — start one from the chat and come back here.'
                      )}
                    </div>
                  )}

                  {!canvasDraftsLoading && !canvasDraftsError && canvasDrafts.length > 0 && (
                    <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
                      {canvasDrafts.map((d) => {
                        const busy = canvasConvertBusyId === d.id;
                        const updated = formatCanvasUpdatedAt(d.updatedAt);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            data-testid={`launcher-canvas-${d.id}`}
                            onClick={() => void handleUseCanvas(d.id)}
                            disabled={canvasConvertBusyId !== null}
                            className="group flex items-center gap-2.5 w-full p-3 rounded-xl text-left border border-slate-200 dark:border-navy-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md bg-white dark:bg-navy-950 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            <div className="shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                              {busy ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <PenSquare size={16} />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-[13px] text-slate-900 dark:text-white leading-tight truncate">
                                {d.title}
                              </div>
                              {updated && (
                                <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                                  {t('rap.outputs.launcher.canvasUpdated', 'Updated')} {updated}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {canvasConvertError && (
                    <div className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
                      {canvasConvertError}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Teresa zaproponuje — mini input + przycisk */}
                  <div className="mb-4 flex gap-2">
                    <input
                      type="text"
                      data-testid="launcher-suggest-input"
                      value={intentInput}
                      onChange={(e) => setIntentInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSuggest();
                      }}
                      placeholder={t(
                        'rap.outputs.launcher.suggestPlaceholder',
                        'Describe what you need…'
                      )}
                      maxLength={1000}
                      className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-c-focus"
                    />
                    <button
                      type="button"
                      data-testid="launcher-suggest-btn"
                      onClick={handleSuggest}
                      disabled={suggestLoading}
                      aria-label={t('rap.outputs.launcher.suggestBtn', 'Teresa suggests')}
                      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-800/40 disabled:opacity-50 transition-colors"
                    >
                      {suggestLoading ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Wand2 size={14} />
                      )}
                      {t('rap.outputs.launcher.suggestBtn', 'Teresa suggests')}
                    </button>
                  </div>

                  {/* Wynik sugestii */}
                  {suggestion && !suggestLoading && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700">
                      <p className="text-xs text-primary-700 dark:text-primary-300 font-medium mb-1">
                        {t('rap.outputs.launcher.suggestResult', 'Teresa recommends')}
                        {': '}
                        <span className="font-semibold">{suggestion.templateId}</span>{' '}
                        <span className="opacity-70">({suggestion.confidence})</span>
                      </p>
                      <p className="text-[11px] text-primary-600 dark:text-primary-400 mb-2">
                        {suggestion.reasoning}
                      </p>
                      <button
                        type="button"
                        onClick={() => handlePickTemplate(suggestion.templateId)}
                        className="text-xs px-2.5 py-1 rounded-md bg-navy-900 dark:bg-[#F4F7FB] hover:bg-navy-800 dark:hover:bg-[#DDE5EF] text-white dark:text-navy-950 font-medium transition-colors"
                      >
                        {t('rap.outputs.launcher.suggestAccept', 'Use this template')}
                      </button>
                    </div>
                  )}

                  {/* Loading */}
                  {tplLoading && (
                    <div className="flex items-center justify-center py-8 text-slate-400">
                      <Loader2 size={20} className="animate-spin mr-2" />
                      <span className="text-sm">{t('common.loading', 'Loading...')}</span>
                    </div>
                  )}

                  {/* Error — pokazuj Blank jako fallback */}
                  {!tplLoading && tplError && (
                    <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs">
                      {tplError}
                    </div>
                  )}

                  {/* Template grid — zawsze Blank na pierwszej pozycji */}
                  {!tplLoading && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Blank — zawsze pierwszy */}
                      <button
                        type="button"
                        data-testid="launcher-template-blank"
                        onClick={() => handlePickTemplate('blank')}
                        aria-label={t(BLANK_CARD.labelKey, BLANK_CARD.labelFallback)}
                        className="group flex items-start gap-2.5 w-full p-3.5 rounded-xl text-left border border-slate-200 dark:border-navy-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md bg-white dark:bg-navy-950 transition-all duration-150 hover:-translate-y-0.5"
                      >
                        <div className="shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                          <Sparkles size={18} />
                        </div>
                        <div className="min-w-0 pt-0.5">
                          <div className="font-medium text-[13px] text-slate-900 dark:text-white leading-tight">
                            {t(BLANK_CARD.labelKey, BLANK_CARD.labelFallback)}
                          </div>
                        </div>
                      </button>

                      {/* Szablony z API (bez blank — eliminujemy duplikaty) */}
                      {apiTemplates
                        .filter((tpl) => !tpl.isBlank)
                        .map((tpl) => (
                          <button
                            key={tpl.id}
                            type="button"
                            data-testid={`launcher-template-${tpl.id}`}
                            onClick={() => handlePickTemplate(tpl.id)}
                            aria-label={tpl.name}
                            className="group flex items-start gap-2.5 w-full p-3.5 rounded-xl text-left border border-slate-200 dark:border-navy-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-md bg-white dark:bg-navy-950 transition-all duration-150 hover:-translate-y-0.5"
                          >
                            <div className="shrink-0 p-2 rounded-lg bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-300">
                              <FileText size={18} />
                            </div>
                            <div className="min-w-0 pt-0.5">
                              <div className="font-medium text-[13px] text-slate-900 dark:text-white leading-tight">
                                {tpl.name}
                              </div>
                              {tpl.description && (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                                  {tpl.description}
                                </div>
                              )}
                            </div>
                          </button>
                        ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutputsLauncherModal;
