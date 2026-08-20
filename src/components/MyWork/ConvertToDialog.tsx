/**
 * ConvertToDialog (V3-C03)
 * Dialog shown when user converts MyWork item to output (Initiative/Report/Deck).
 * Creates a MyWork ToolSession as canonical source before creating the output.
 * DBR77: Layer-2 modal, rounded-xl.
 */

import { FileOutput, Loader2, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '@/services/funnelAnalytics';
import type { BudgetConversionConfig } from '@/services/conversionService';
import { materializeMyWorkSession } from '@/services/traceabilityService';
import type { MyWorkDerivedSource, MyWorkSession } from '@/types/domain/traceability';

export type ConvertTargetType =
  | 'initiative'
  | 'report'
  | 'presentation'
  | 'financial_model'
  | 'budget'
  | 'valuation'
  | 'analysis';

export interface ConvertToDialogProps {
  open: boolean;
  onClose: () => void;
  sources: MyWorkDerivedSource[];
  targetType?: ConvertTargetType;
  onConvert: (
    session: MyWorkSession,
    targetType: string,
    budgetConfig?: BudgetConversionConfig
  ) => void;
}

const TARGET_LABELS: Record<ConvertTargetType, { en: string; pl: string }> = {
  initiative: { en: 'Initiative', pl: 'Inicjatywa' },
  report: { en: 'Report', pl: 'Raport' },
  presentation: { en: 'Presentation', pl: 'Prezentacja' },
  financial_model: { en: 'Financial Model', pl: 'Model finansowy' },
  budget: { en: 'Budget', pl: 'Budżet' },
  valuation: { en: 'Valuation', pl: 'Wycena' },
  analysis: { en: 'Financial Analysis', pl: 'Analiza finansowa' },
};

export const ConvertToDialog: React.FC<ConvertToDialogProps> = ({
  open,
  onClose,
  sources,
  targetType: initialTargetType,
  onConvert,
}) => {
  const { t } = useTranslation();
  const [targetType, setTargetType] = useState<ConvertTargetType>(
    initialTargetType ?? 'initiative'
  );
  const [creating, setCreating] = useState(false);
  const [budgetConfig, setBudgetConfig] = useState<BudgetConversionConfig>({
    periodStart: '',
    periodEnd: '',
    granularity: 'monthly',
    currency: 'PLN',
  });

  const targetLabel = t(
    `traceability.convertTo.${targetType}`,
    TARGET_LABELS[targetType]?.en ?? targetType
  );

  const handleConfirm = async () => {
    if (!sources?.length) return;
    if (
      targetType === 'budget' &&
      (!budgetConfig.periodStart ||
        !budgetConfig.periodEnd ||
        budgetConfig.periodStart >= budgetConfig.periodEnd)
    )
      return;
    setCreating(true);
    try {
      const session = await materializeMyWorkSession(sources);
      trackFunnelEvent('artifact_convert_clicked', {
        from: sources.map((s) => s.type).join(','),
        to: targetType,
      });
      onConvert(session, targetType, targetType === 'budget' ? budgetConfig : undefined);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create session';
      console.error('[ConvertToDialog]', msg);
      throw err;
    } finally {
      setCreating(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-navy-900 rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden border border-slate-200/60 dark:border-white/[0.06]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200/60 dark:border-white/[0.06]">
          <div className="flex items-center gap-2">
            <FileOutput size={16} className="text-primary-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('traceability.convertTo.title', 'Convert to output')}
            </h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close', 'Close')}
            className="p-1 rounded-md text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {t('traceability.convertTo.description', {
              defaultValue: 'This will create a MyWork session as the source for your {{target}}.',
              target: targetLabel,
            })}
          </p>

          <div>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t('traceability.convertTo.sourceItems', 'Source items')}
            </span>
            <ul className="mt-1.5 space-y-1">
              {sources.map((s, i) => (
                <li
                  key={`${s.type}-${s.id}-${i}`}
                  className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-2"
                >
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-primary-500/20 text-primary-400">
                    {s.type}
                  </span>
                  {s.title}
                </li>
              ))}
            </ul>
          </div>

          {!initialTargetType && (
            <div>
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {t('traceability.convertTo.targetType', 'Target type')}
              </span>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {(Object.keys(TARGET_LABELS) as ConvertTargetType[]).map((tt) => (
                  <button
                    key={tt}
                    type="button"
                    onClick={() => setTargetType(tt)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      targetType === tt
                        ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t(`traceability.convertTo.${tt}`, TARGET_LABELS[tt].en)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {targetType === 'budget' && (
            <fieldset className="space-y-3 rounded-lg border border-slate-200/60 p-3 dark:border-white/10">
              <legend className="px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('traceability.convertTo.budgetPeriod', 'Budget period')}
              </legend>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'traceability.convertTo.budgetPeriodHint',
                  'Choose the exact governed period. Dates are never inferred from today.'
                )}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs text-slate-600 dark:text-slate-400">
                  {t('common.startDate', 'Start date')}
                  <input
                    aria-label={t('common.startDate', 'Start date')}
                    type="date"
                    value={budgetConfig.periodStart}
                    onChange={(event) =>
                      setBudgetConfig((current) => ({
                        ...current,
                        periodStart: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-navy-800"
                  />
                </label>
                <label className="text-xs text-slate-600 dark:text-slate-400">
                  {t('common.endDate', 'End date')}
                  <input
                    aria-label={t('common.endDate', 'End date')}
                    type="date"
                    value={budgetConfig.periodEnd}
                    onChange={(event) =>
                      setBudgetConfig((current) => ({
                        ...current,
                        periodEnd: event.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-navy-800"
                  />
                </label>
                <label className="text-xs text-slate-600 dark:text-slate-400">
                  {t('finance.granularity', 'Granularity')}
                  <select
                    aria-label={t('finance.granularity', 'Granularity')}
                    value={budgetConfig.granularity}
                    onChange={(event) =>
                      setBudgetConfig((current) => ({
                        ...current,
                        granularity: event.target.value as BudgetConversionConfig['granularity'],
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-navy-800"
                  >
                    <option value="monthly">{t('finance.monthly', 'Monthly')}</option>
                    <option value="quarterly">{t('finance.quarterly', 'Quarterly')}</option>
                    <option value="annual">{t('finance.annual', 'Annual')}</option>
                  </select>
                </label>
                <label className="text-xs text-slate-600 dark:text-slate-400">
                  {t('finance.currency', 'Currency')}
                  <select
                    aria-label={t('finance.currency', 'Currency')}
                    value={budgetConfig.currency}
                    onChange={(event) =>
                      setBudgetConfig((current) => ({ ...current, currency: event.target.value }))
                    }
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm dark:border-white/10 dark:bg-navy-800"
                  >
                    {['PLN', 'EUR', 'USD', 'GBP'].map((currency) => (
                      <option key={currency} value={currency}>
                        {currency}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {budgetConfig.periodStart &&
                budgetConfig.periodEnd &&
                budgetConfig.periodStart >= budgetConfig.periodEnd && (
                  <p role="alert" className="text-xs text-red-600">
                    {t('finance.periodOrderError', 'End date must be after start date.')}
                  </p>
                )}
            </fieldset>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-200/60 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.02]">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            {t('traceability.convertTo.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              creating ||
              !sources?.length ||
              (targetType === 'budget' &&
                (!budgetConfig.periodStart ||
                  !budgetConfig.periodEnd ||
                  budgetConfig.periodStart >= budgetConfig.periodEnd))
            }
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-c-text text-c-bg text-xs font-semibold hover:bg-c-text-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {creating && <Loader2 size={12} className="animate-spin" />}
            {t('traceability.convertTo.confirm', 'Confirm & create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConvertToDialog;
