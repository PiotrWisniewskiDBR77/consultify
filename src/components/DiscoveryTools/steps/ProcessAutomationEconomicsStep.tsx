import React, { useMemo } from 'react';

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
  const { session, isPolish, currency = 'USD' } = props;
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
          {isPolish ? 'Ekonomia' : 'Economics'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zbuduj szybki business case: oszczędności, koszty, payback.'
            : 'Build a fast business case: savings, costs, payback.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {isPolish ? 'Fully loaded cost / godzina' : 'Fully loaded cost / hour'}
          </label>
          <input
            inputMode="decimal"
            value={
              economics.fullyLoadedCostPerHour == null
                ? ''
                : String(economics.fullyLoadedCostPerHour)
            }
            onChange={(e) => patch({ fullyLoadedCostPerHour: coerceNumber(e.target.value) })}
            placeholder={isPolish ? 'np. 45' : 'e.g. 45'}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {isPolish ? 'Koszt jednorazowy' : 'One-time cost'}
          </label>
          <input
            inputMode="decimal"
            value={economics.oneTimeCost == null ? '' : String(economics.oneTimeCost)}
            onChange={(e) => patch({ oneTimeCost: coerceNumber(e.target.value) })}
            placeholder={isPolish ? 'np. 20000' : 'e.g. 20000'}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {isPolish ? 'Koszt miesięczny (run)' : 'Monthly run cost'}
          </label>
          <input
            inputMode="decimal"
            value={economics.monthlyCost == null ? '' : String(economics.monthlyCost)}
            onChange={(e) => patch({ monthlyCost: coerceNumber(e.target.value) })}
            placeholder={isPolish ? 'np. 800' : 'e.g. 800'}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {isPolish ? 'Waluta (info)' : 'Currency (info)'}
          </label>
          <input
            value={currency}
            readOnly
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 text-slate-700 dark:text-slate-300"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {isPolish ? 'Baseline hours/week (opcjonalnie)' : 'Baseline hours/week (optional)'}
          </label>
          <input
            inputMode="decimal"
            value={
              economics.baselineHoursPerWeek == null ? '' : String(economics.baselineHoursPerWeek)
            }
            onChange={(e) => patch({ baselineHoursPerWeek: coerceNumber(e.target.value) })}
            placeholder={
              measuredBaselineHours == null
                ? isPolish
                  ? 'np. 120'
                  : 'e.g. 120'
                : `${measuredBaselineHours.toFixed(1)} (${isPolish ? 'z pomiaru' : 'from measurement'})`
            }
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {isPolish ? 'Target hours/week (opcjonalnie)' : 'Target hours/week (optional)'}
          </label>
          <input
            inputMode="decimal"
            value={economics.targetHoursPerWeek == null ? '' : String(economics.targetHoursPerWeek)}
            onChange={(e) => patch({ targetHoursPerWeek: coerceNumber(e.target.value) })}
            placeholder={
              measuredTargetHours == null
                ? isPolish
                  ? 'np. 60'
                  : 'e.g. 60'
                : `${measuredTargetHours.toFixed(1)} (${isPolish ? 'z re-estymacji' : 'from re-estimation'})`
            }
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div className="p-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {isPolish ? 'Wynik' : 'Output'}
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-slate-700 dark:text-slate-300">
          <div>
            {isPolish ? 'Godziny oszczędzone / tydzień' : 'Hours saved / week'}:{' '}
            {hoursSavedPerWeek == null ? '—' : hoursSavedPerWeek.toFixed(1)}
          </div>
          <div>
            {isPolish ? 'Oszczędność brutto / tydzień' : 'Gross savings / week'}:{' '}
            {weeklyGrossSavings == null ? '—' : formatMoney(weeklyGrossSavings, currency)}
          </div>
          <div>
            {isPolish ? 'Oszczędność netto / miesiąc' : 'Net savings / month'}:{' '}
            {monthlyNetSavings == null ? '—' : formatMoney(monthlyNetSavings, currency)}
          </div>
          <div>
            {isPolish ? 'Payback (mies.)' : 'Payback (months)'}:{' '}
            {paybackMonths == null ? '—' : paybackMonths.toFixed(1)}
          </div>
        </div>
        <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Uwaga: to szybki model (52 tygodnie/rok, bez dyskonta). Doprecyzuj założenia przed zatwierdzeniem.'
            : 'Note: quick model (52 weeks/year, no discounting). Refine assumptions before approval.'}
        </div>
      </div>
    </div>
  );
}
