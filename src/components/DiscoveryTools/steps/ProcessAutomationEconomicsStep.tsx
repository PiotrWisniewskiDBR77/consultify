import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { ToolFlowEconomics, ToolSession, useToolStore } from '@/store/useToolStore';

function coerceNumber(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(0)} ${currency}`;
  }
}

export function ProcessAutomationEconomicsStep(props: {
  session: ToolSession;
  isPolish: boolean;
  currency?: string;
}) {
  const { session, currency = 'USD' } = props;
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();

  const flow = (session.inputData as any)?.flow || {};
  const economics: ToolFlowEconomics = {
    fullyLoadedCostPerHour: null,
    baselineHoursPerWeek: null,
    targetHoursPerWeek: null,
    oneTimeCost: null,
    monthlyCost: null,
    ...(flow.economics || {}),
  };

  const pa = (flow.processAutomation || {}) as {
    volumePerWeek?: number | null;
    baselineMinutesPerCycle?: number | null;
    targetMinutesPerCycle?: number | null;
  };

  const measuredBaselineHours = useMemo(() => {
    if (pa.volumePerWeek == null || pa.baselineMinutesPerCycle == null) return null;
    return (pa.volumePerWeek * pa.baselineMinutesPerCycle) / 60;
  }, [pa.volumePerWeek, pa.baselineMinutesPerCycle]);

  const measuredTargetHours = useMemo(() => {
    if (pa.volumePerWeek == null || pa.targetMinutesPerCycle == null) return null;
    return (pa.volumePerWeek * pa.targetMinutesPerCycle) / 60;
  }, [pa.volumePerWeek, pa.targetMinutesPerCycle]);

  const effectiveBaselineHours =
    economics.baselineHoursPerWeek != null ? economics.baselineHoursPerWeek : measuredBaselineHours;
  const effectiveTargetHours =
    economics.targetHoursPerWeek != null ? economics.targetHoursPerWeek : measuredTargetHours;

  const hoursSavedPerWeek =
    effectiveBaselineHours != null && effectiveTargetHours != null
      ? Math.max(0, effectiveBaselineHours - effectiveTargetHours)
      : null;

  const weeklyGrossSavings =
    hoursSavedPerWeek != null && economics.fullyLoadedCostPerHour != null
      ? hoursSavedPerWeek * economics.fullyLoadedCostPerHour
      : null;

  const monthlyGrossSavings = weeklyGrossSavings != null ? weeklyGrossSavings * (52 / 12) : null;
  const monthlyNetSavings =
    monthlyGrossSavings != null ? monthlyGrossSavings - (economics.monthlyCost || 0) : null;

  const paybackMonths =
    monthlyNetSavings != null &&
    monthlyNetSavings > 0 &&
    economics.oneTimeCost != null &&
    economics.oneTimeCost > 0
      ? economics.oneTimeCost / monthlyNetSavings
      : null;

  const patch = (next: Partial<ToolFlowEconomics>) => {
    updateInputData({
      flow: {
        ...flow,
        economics: { ...economics, ...next },
      },
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsSteps.processAutomationEconomicsStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsSteps.processAutomationEconomicsStep.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.processAutomationEconomicsStep.fullyLoadedCostPerHour')}
          </label>
          <input
            inputMode="decimal"
            value={
              economics.fullyLoadedCostPerHour == null
                ? ''
                : String(economics.fullyLoadedCostPerHour)
            }
            onChange={(e) => patch({ fullyLoadedCostPerHour: coerceNumber(e.target.value) })}
            placeholder={t(
              'discoveryToolsSteps.processAutomationEconomicsStep.fullyLoadedCostPlaceholder'
            )}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.processAutomationEconomicsStep.oneTimeCost')}
          </label>
          <input
            inputMode="decimal"
            value={economics.oneTimeCost == null ? '' : String(economics.oneTimeCost)}
            onChange={(e) => patch({ oneTimeCost: coerceNumber(e.target.value) })}
            placeholder={t(
              'discoveryToolsSteps.processAutomationEconomicsStep.oneTimeCostPlaceholder'
            )}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.processAutomationEconomicsStep.monthlyCost')}
          </label>
          <input
            inputMode="decimal"
            value={economics.monthlyCost == null ? '' : String(economics.monthlyCost)}
            onChange={(e) => patch({ monthlyCost: coerceNumber(e.target.value) })}
            placeholder={t(
              'discoveryToolsSteps.processAutomationEconomicsStep.monthlyCostPlaceholder'
            )}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.processAutomationEconomicsStep.currencyInfo')}
          </label>
          <input
            value={currency}
            readOnly
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-slate-700 dark:text-slate-300"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.processAutomationEconomicsStep.baselineHoursPerWeek')}
          </label>
          <input
            inputMode="decimal"
            value={
              economics.baselineHoursPerWeek == null ? '' : String(economics.baselineHoursPerWeek)
            }
            onChange={(e) => patch({ baselineHoursPerWeek: coerceNumber(e.target.value) })}
            placeholder={
              measuredBaselineHours == null
                ? t(
                    'discoveryToolsSteps.processAutomationEconomicsStep.baselineHoursPlaceholder'
                  )
                : `${measuredBaselineHours.toFixed(1)} (${t(
                    'discoveryToolsSteps.processAutomationEconomicsStep.fromMeasurement'
                  )})`
            }
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.processAutomationEconomicsStep.targetHoursPerWeek')}
          </label>
          <input
            inputMode="decimal"
            value={economics.targetHoursPerWeek == null ? '' : String(economics.targetHoursPerWeek)}
            onChange={(e) => patch({ targetHoursPerWeek: coerceNumber(e.target.value) })}
            placeholder={
              measuredTargetHours == null
                ? t('discoveryToolsSteps.processAutomationEconomicsStep.targetHoursPlaceholder')
                : `${measuredTargetHours.toFixed(1)} (${t(
                    'discoveryToolsSteps.processAutomationEconomicsStep.fromReEstimation'
                  )})`
            }
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {t('discoveryToolsSteps.processAutomationEconomicsStep.output')}
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300">
          <div>
            {t('discoveryToolsSteps.processAutomationEconomicsStep.hoursSavedPerWeek')}:{' '}
            {hoursSavedPerWeek == null ? '—' : hoursSavedPerWeek.toFixed(1)}
          </div>
          <div>
            {t('discoveryToolsSteps.processAutomationEconomicsStep.grossSavingsPerWeek')}:{' '}
            {weeklyGrossSavings == null ? '—' : formatMoney(weeklyGrossSavings, currency)}
          </div>
          <div>
            {t('discoveryToolsSteps.processAutomationEconomicsStep.netSavingsPerMonth')}:{' '}
            {monthlyNetSavings == null ? '—' : formatMoney(monthlyNetSavings, currency)}
          </div>
          <div>
            {t('discoveryToolsSteps.processAutomationEconomicsStep.paybackMonths')}:{' '}
            {paybackMonths == null ? '—' : paybackMonths.toFixed(1)}
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {t('discoveryToolsSteps.processAutomationEconomicsStep.disclaimer')}
        </div>
      </div>
    </div>
  );
}
