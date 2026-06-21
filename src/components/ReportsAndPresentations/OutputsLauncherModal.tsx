/**
 * OutputsLauncherModal — wspólne wejście „Nowy" dla generatorów deliverable (M17–M20, E1).
 *
 * Jedno wejście, trzy wyjścia: Raport · Prezentacja · Tabela. Świadomy wybór typu
 * (wyjście jest różne), flow PO wyborze identyczny — wzorzec SSOT
 * docs/product/DELIVERABLES_GENERATORS_SPEC.md §1. Wybór typu emituje `onSelectType`;
 * spięcie z silnikiem generacji / „paczką kontekstu" = sub-moduł E3.
 *
 * Styl/kanon wzorowany na MyWork/notebook/NewPageModal (overlay + backdrop-dismiss + Escape).
 */

import { FileText, Presentation, Table2, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export type DeliverableType = 'report' | 'presentation' | 'table';

interface LauncherTile {
  type: DeliverableType;
  icon: React.ReactNode;
  gradient: string;
  labelKey: string;
  labelFallback: string;
  hintKey: string;
  hintFallback: string;
}

const TILES: LauncherTile[] = [
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

export interface OutputsLauncherModalProps {
  open: boolean;
  onClose: () => void;
  /** Wywoływane po wyborze typu deliverable. */
  onSelectType: (type: DeliverableType) => void;
}

export const OutputsLauncherModal: React.FC<OutputsLauncherModalProps> = ({
  open,
  onClose,
  onSelectType,
}) => {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [open, onClose]);

  const handleSelect = useCallback(
    (type: DeliverableType) => {
      onSelectType(type);
      onClose();
    },
    [onSelectType, onClose]
  );

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
          <h2
            id="outputs-launcher-title"
            className="text-base font-semibold text-slate-900 dark:text-white"
          >
            {t('rap.outputs.launcher.title', 'New output')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
            aria-label={t('common.close', 'Close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {t('rap.outputs.launcher.subtitle', 'Pick what you want to create')}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {TILES.map((tile) => {
              const label = t(tile.labelKey, tile.labelFallback);
              return (
                <button
                  key={tile.type}
                  type="button"
                  onClick={() => handleSelect(tile.type)}
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
        </div>
      </div>
    </div>
  );
};

export default OutputsLauncherModal;
