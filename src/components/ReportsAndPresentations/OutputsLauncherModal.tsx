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
  FileText,
  LayoutDashboard,
  Loader2,
  Presentation,
  ShieldAlert,
  Sparkles,
  Table2,
  Wand2,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useDeliverableTemplates } from './useDeliverableTemplates';
import { useTemplateSuggestion } from './useTemplateSuggestion';

export type DeliverableType = 'report' | 'presentation' | 'table';

export interface LauncherSelection {
  type: DeliverableType;
  /** templateId === 'blank' ⇒ start od zera (bez szkieletu). */
  templateId: string;
}

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
}

export const OutputsLauncherModal: React.FC<OutputsLauncherModalProps> = ({
  open,
  onClose,
  onSelect,
}) => {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [selectedType, setSelectedType] = useState<DeliverableType | null>(null);

  const { templates: apiTemplates, loading: tplLoading, error: tplError } =
    useDeliverableTemplates(selectedType);

  const { loading: suggestLoading, suggestion, suggest, reset: resetSuggestion } =
    useTemplateSuggestion();

  const [intentInput, setIntentInput] = useState('');

  // Reset kroku przy każdym otwarciu.
  useEffect(() => {
    if (open) {
      setSelectedType(null);
      setIntentInput('');
      resetSuggestion();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedType) setSelectedType(null);
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
    const intentText = intentInput.trim() || t('rap.outputs.launcher.suggestDefaultIntent', 'choose the best template for me');
    suggest(intentText, toApiType(selectedType));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, intentInput, suggest, t]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="outputs-launcher-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
    >
      <div className="w-full max-w-xl mx-4 rounded-2xl bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-800">
          <div className="flex items-center gap-2 min-w-0">
            {selectedType && (
              <button
                onClick={() => setSelectedType(null)}
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
              {selectedType
                ? t('rap.outputs.launcher.chooseTemplate', 'Choose a template')
                : t('rap.outputs.launcher.title', 'New output')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            aria-label={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {!selectedType ? (
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
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                {t('rap.outputs.launcher.templateSubtitle', 'Start blank or from a template')}
              </p>

              {/* Teresa zaproponuje — mini input + przycisk */}
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={intentInput}
                  onChange={(e) => setIntentInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSuggest(); }}
                  placeholder={t('rap.outputs.launcher.suggestPlaceholder', 'Describe what you need…')}
                  maxLength={1000}
                  className="flex-1 min-w-0 px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                />
                <button
                  type="button"
                  onClick={handleSuggest}
                  disabled={suggestLoading}
                  aria-label={t('rap.outputs.launcher.suggestBtn', 'Teresa suggests')}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700 hover:bg-primary-100 dark:hover:bg-primary-800/40 disabled:opacity-50 transition-colors"
                >
                  {suggestLoading
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Wand2 size={14} />}
                  {t('rap.outputs.launcher.suggestBtn', 'Teresa suggests')}
                </button>
              </div>

              {/* Wynik sugestii */}
              {suggestion && !suggestLoading && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700">
                  <p className="text-xs text-primary-700 dark:text-primary-300 font-medium mb-1">
                    {t('rap.outputs.launcher.suggestResult', 'Teresa recommends')}
                    {': '}
                    <span className="font-semibold">{suggestion.templateId}</span>
                    {' '}
                    <span className="opacity-70">({suggestion.confidence})</span>
                  </p>
                  <p className="text-[11px] text-primary-600 dark:text-primary-400 mb-2">
                    {suggestion.reasoning}
                  </p>
                  <button
                    type="button"
                    onClick={() => handlePickTemplate(suggestion.templateId)}
                    className="text-xs px-2.5 py-1 rounded-md bg-primary-600 hover:bg-primary-700 text-white font-medium transition-colors"
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
        </div>
      </div>
    </div>
  );
};

export default OutputsLauncherModal;
