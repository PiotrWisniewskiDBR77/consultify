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
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';
import {
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

const TARGET_ITEMS: {
  type: ConversionTargetType;
  icon: React.ElementType;
  labelKey: string;
}[] = [
  { type: 'initiative', icon: Target, labelKey: 'traceability.convertTo.initiative' },
  { type: 'report', icon: FileText, labelKey: 'traceability.convertTo.report' },
  { type: 'presentation', icon: Presentation, labelKey: 'traceability.convertTo.presentation' },
  {
    type: 'financial_model',
    icon: Calculator,
    labelKey: 'traceability.convertTo.financialModel',
  },
  {
    type: 'budget',
    icon: Wallet,
    labelKey: 'traceability.convertTo.budget',
  },
  {
    type: 'valuation',
    icon: TrendingUp,
    labelKey: 'traceability.convertTo.valuation',
  },
  {
    type: 'analysis',
    icon: BarChart3,
    labelKey: 'traceability.convertTo.analysis',
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

  const handleDialogConvert = async (session: MyWorkSession, targetType: string) => {
    setConverting(true);
    try {
      const result = await createOutputFromSession(
        session.id,
        targetType as ConversionTargetType,
        sourceTitle
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
            {open && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setOpen(false)}
                  aria-hidden="true"
                />
                {/* V5-IDEA-46: Dark/light parity */}
                <div
                  className="absolute top-full left-0 mt-1 z-50 min-w-[220px] rounded-lg bg-white dark:bg-navy-800 border border-slate-200/60 dark:border-white/10 shadow-xl py-1"
                  role="menu"
                >
                  {TARGET_ITEMS.map(({ type, icon: Icon, labelKey }) => (
                    <button
                      key={type}
                      role="menuitem"
                      onClick={() => handleItemClick(type)}
                      className="w-full flex items-center gap-2 h-9 px-3 hover:bg-slate-100/60 dark:hover:bg-white/5 text-left text-sm text-slate-800 dark:text-slate-200 transition-colors"
                    >
                      <Icon size={14} className="text-slate-600 dark:text-slate-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div>{t(labelKey)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-500">
                          {t(
                            'traceability.convertTo.createsSession',
                            'Creates a MyWork session first'
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex items-center gap-1 rounded-lg bg-white dark:bg-navy-800 border border-slate-200/60 dark:border-white/10 p-1">
            {TARGET_ITEMS.map(({ type, icon: Icon, labelKey }) => (
              <button
                key={type}
                onClick={() => handleItemClick(type)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-slate-100/60 dark:hover:bg-white/5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <Icon size={12} />
                {t(labelKey)}
                <span className="text-slate-600 dark:text-slate-500 text-[10px]">
                  ({t('traceability.convertTo.createsSession', 'Creates a MyWork session first')})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default ConvertToOutputMenu;
