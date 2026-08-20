/**
 * ConvertToOutputMenu (V3-C02)
 * Dropdown menu for "Convert to..." output actions (Initiative, Report, Presentation).
 * Opens ConvertToDialog on click. DBR77: rounded-lg, bg-navy-800, border-white/10.
 */

import {
  BarChart3,
  Calculator,
  ChevronDown,
  FileOutput,
  FileText,
  Presentation,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { useAnchorFixedMenuPosition } from '@/hooks/useFixedMenuPosition';
import { Api } from '@/services/api';
import {
  type BudgetConversionConfig,
  type ConversionSourceType,
  type ConversionTargetType,
  createOutputFromSession,
} from '@/services/conversionService';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { MyWorkDerivedSource, MyWorkSession } from '@/types/domain/traceability';

import { ConvertToConfirmation } from './ConvertToConfirmation';
import { ConvertToDialog } from './ConvertToDialog';

export interface ConvertToOutputMenuProps {
  sourceType: ConversionSourceType;
  sourceId: string;
  sourceTitle: string;
  onConvertComplete: (outputType: string, outputId: string) => void;
  className?: string;
  /** Render as dropdown trigger (default) or inline menu */
  variant?: 'dropdown' | 'inline';
  /** Compact: icon-only trigger for tight spaces (e.g. notebook hover bar) */
  compact?: boolean;
  /** Optional additional sources (e.g. for multi-select) */
  additionalSources?: MyWorkDerivedSource[];
}

// FALA 1 / „surowe identyfikatory w UI" (2026-07-27): `financialModel` NIE
// istniał w słownikach (`public/locales/*/translation.json` ma
// `traceability.convertTo.financial_model`), a `t(labelKey)` było wołane BEZ
// wartości domyślnej — i18next zwracał wtedy sam klucz, który w wąskim pasku
// „Co dalej" ucinał się do „traceability.convertT". Klucz poprawiony, a każdy
// element ma teraz twardy `fallback` — brak tłumaczenia nigdy nie wypuści
// surowego klucza do UI.
const TARGET_ITEMS: {
  type: ConversionTargetType;
  icon: React.ElementType;
  labelKey: string;
  fallback: string;
}[] = [
  {
    type: 'initiative',
    icon: Target,
    labelKey: 'traceability.convertTo.initiative',
    fallback: 'Initiative',
  },
  {
    type: 'report',
    icon: FileText,
    labelKey: 'traceability.convertTo.report',
    fallback: 'Report',
  },
  {
    type: 'presentation',
    icon: Presentation,
    labelKey: 'traceability.convertTo.presentation',
    fallback: 'Presentation',
  },
  {
    type: 'financial_model',
    icon: Calculator,
    labelKey: 'traceability.convertTo.financial_model',
    fallback: 'Financial model',
  },
  {
    type: 'budget',
    icon: Wallet,
    labelKey: 'traceability.convertTo.budget',
    fallback: 'Budget',
  },
  {
    type: 'valuation',
    icon: TrendingUp,
    labelKey: 'traceability.convertTo.valuation',
    fallback: 'Valuation',
  },
  {
    type: 'analysis',
    icon: BarChart3,
    labelKey: 'traceability.convertTo.analysis',
    fallback: 'Analysis',
  },
];

function toDerivedSource(
  sourceType: ConversionSourceType,
  sourceId: string,
  sourceTitle: string
): MyWorkDerivedSource {
  return { type: sourceType, id: sourceId, title: sourceTitle };
}

export const ConvertToOutputMenu: React.FC<ConvertToOutputMenuProps> = ({
  sourceType,
  sourceId,
  sourceTitle,
  onConvertComplete,
  className = '',
  variant = 'dropdown',
  compact = false,
  additionalSources = [],
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTarget, setDialogTarget] = useState<ConversionTargetType | undefined>();
  const [converting, setConverting] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // #6k/#22 — this dropdown renders inline (no portal) inside scrollable lists
  // (e.g. the notebook row hover bar); a plain `absolute top-full` menu got
  // clipped by the ancestor's overflow and could run off the bottom of the
  // viewport. Anchor it to the trigger button and portal it to <body> so it
  // always renders on top, flipped/clamped to stay on-screen.
  const { ref: menuRef, style: menuStyle } = useAnchorFixedMenuPosition(triggerRef.current, open);

  const sources: MyWorkDerivedSource[] = [
    toDerivedSource(sourceType, sourceId, sourceTitle),
    ...additionalSources,
  ];

  const handleItemClick = (targetType: ConversionTargetType) => {
    trackFunnelEvent('mywork_convert_clicked', {
      from: sourceType,
      to: targetType,
    });
    setOpen(false);
    setDialogTarget(targetType);
    setDialogOpen(true);
  };

  const handleDialogConvert = async (
    session: MyWorkSession,
    targetType: string,
    budgetConfig?: BudgetConversionConfig
  ) => {
    setConverting(true);
    try {
      const result = await createOutputFromSession(
        session.id,
        targetType as ConversionTargetType,
        sourceTitle,
        budgetConfig
      );
      if (result.success) {
        if (sourceType === 'notebook') {
          await Api.appendNotebookConvertedOutput(sourceId, {
            type: targetType,
            id: result.outputId,
          });
        }
        setDialogOpen(false);
        ConvertToConfirmation.show({
          outputType: targetType,
          outputId: result.outputId,
          sourceTitle,
          sessionId: result.sessionId,
          onOpenOutput: () => {
            if (targetType === 'initiative') {
              navigate(`/initiatives?open=${encodeURIComponent(result.outputId)}&mode=doc`);
            } else if (targetType === 'report') {
              navigate(`/reports/builder/${encodeURIComponent(result.outputId)}`);
            } else if (targetType === 'presentation') {
              navigate(`/presentations?deck=${encodeURIComponent(result.outputId)}`);
            } else if (targetType === 'financial_model') {
              navigate(`/economics?tab=models&open=${encodeURIComponent(result.outputId)}`);
            } else if (targetType === 'budget') {
              navigate(`/economics?tab=prediction&open=${encodeURIComponent(result.outputId)}`);
            } else if (targetType === 'valuation') {
              navigate(`/economics?tab=valuation&open=${encodeURIComponent(result.outputId)}`);
            } else if (targetType === 'analysis') {
              navigate(`/economics?tab=analysis&open=${encodeURIComponent(result.outputId)}`);
            }
            onConvertComplete(targetType, result.outputId);
          },
          onOpenSession: () => {
            window.dispatchEvent(
              new CustomEvent('mywork-open-item', {
                detail: { type: 'notebook', id: result.sessionId, name: sourceTitle },
              })
            );
            onConvertComplete(targetType, result.outputId);
          },
        });
        onConvertComplete(targetType, result.outputId);
      } else {
        throw new Error(result.error);
      }
    } finally {
      setConverting(false);
    }
  };

  // Shown ONCE for the whole group, always at the TOP of the menu (ANEKS #4 —
  // `_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md` #4/#254: this note previously had
  // two independent renders — one per variant branch, the inline one at the
  // BOTTOM — flagged as a dubel. Single definition below, reused by both,
  // both positioned above the item list.
  const createsSessionNote = (
    <div className="mb-1 border-b border-slate-200/60 px-3 pb-1.5 pt-1 text-[10px] text-slate-500 dark:border-white/10 dark:text-slate-500">
      {t('traceability.convertTo.createsSession', 'Creates a MyWork session first')}
    </div>
  );

  return (
    <>
      <ConvertToDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setDialogTarget(undefined);
        }}
        sources={sources}
        targetType={dialogTarget}
        onConvert={handleDialogConvert}
      />

      <div className={`relative ${className}`}>
        {variant === 'dropdown' ? (
          <>
            <button
              ref={triggerRef}
              onClick={() => setOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg text-xs font-medium bg-white dark:bg-navy-800 border border-slate-200/60 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white transition-colors ${
                compact ? 'p-1' : 'px-2.5 py-1.5'
              }`}
              aria-expanded={open}
              aria-haspopup="true"
              aria-label={t('traceability.convertTo.title', 'Convert to output')}
              title={t('traceability.convertTo.title', 'Convert to output')}
            >
              <FileOutput size={compact ? 12 : 14} />
              {!compact && (
                <>
                  {t('traceability.convertTo.title', 'Convert to output')}
                  <ChevronDown
                    size={12}
                    className={`transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </>
              )}
            </button>
            {open &&
              createPortal(
                <>
                  <div
                    className="fixed inset-0 z-dropdown"
                    onClick={() => setOpen(false)}
                    aria-hidden="true"
                  />
                  {/* V5-IDEA-46: Dark/light parity. #6k/#22 — fixed + viewport-clamped
                      (see useAnchorFixedMenuPosition) so it never runs off-screen when
                      the trigger sits near a screen edge (e.g. notebook row hover bar). */}
                  <div
                    ref={menuRef}
                    className="z-overlay min-w-[220px] overflow-y-auto rounded-lg bg-white dark:bg-navy-800 border border-slate-200/60 dark:border-white/10 shadow-xl py-1"
                    style={menuStyle}
                    role="menu"
                  >
                    {createsSessionNote}
                    {TARGET_ITEMS.map(({ type, icon: Icon, labelKey, fallback }) => (
                      <button
                        key={type}
                        role="menuitem"
                        onClick={() => handleItemClick(type)}
                        className="w-full flex items-center gap-2 h-9 px-3 hover:bg-slate-100/60 dark:hover:bg-white/5 text-left text-sm text-slate-800 dark:text-slate-200 transition-colors"
                      >
                        <Icon size={14} className="text-slate-600 dark:text-slate-400 shrink-0" />
                        <span className="flex-1 min-w-0 truncate">{t(labelKey, fallback)}</span>
                      </button>
                    ))}
                  </div>
                </>,
                document.body
              )}
          </>
        ) : (
          <div className="flex flex-col gap-1 rounded-lg bg-white dark:bg-navy-800 border border-slate-200/60 dark:border-white/10 p-1">
            {createsSessionNote}
            <div className="flex items-center gap-1">
              {TARGET_ITEMS.map(({ type, icon: Icon, labelKey, fallback }) => (
                <button
                  key={type}
                  onClick={() => handleItemClick(type)}
                  title={t(labelKey, fallback)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-slate-100/60 dark:hover:bg-white/5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  <Icon size={12} />
                  {t(labelKey, fallback)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ConvertToOutputMenu;
