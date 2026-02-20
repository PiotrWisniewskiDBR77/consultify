import React, { useMemo } from 'react';

import { ProcessAutomationFlow, ToolSession, useToolStore } from '@/store/useToolStore';

function coerceNumber(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function ProcessAutomationMeasurementStep(props: {
  session: ToolSession;
  isPolish: boolean;
  mode: 'measurement' | 're-estimation';
}) {
  const { session, isPolish, mode } = props;
  const { updateInputData } = useToolStore();

  const flow = (session.inputData as any)?.flow || {};
  const pa: ProcessAutomationFlow = {
    processName: '',
    owner: '',
    volumePerWeek: null,
    baselineMinutesPerCycle: null,
    targetMinutesPerCycle: null,
    errorRateBaselinePct: null,
    errorRateTargetPct: null,
    ...(flow.processAutomation || {}),
  };

  const patch = (next: Partial<ProcessAutomationFlow>) => {
    updateInputData({
      flow: {
        ...flow,
        processAutomation: { ...pa, ...next },
      },
    });
  };

  const baselineHoursPerWeek = useMemo(() => {
    if (pa.volumePerWeek == null || pa.baselineMinutesPerCycle == null) return null;
    return (pa.volumePerWeek * pa.baselineMinutesPerCycle) / 60;
  }, [pa.volumePerWeek, pa.baselineMinutesPerCycle]);

  const targetHoursPerWeek = useMemo(() => {
    if (pa.volumePerWeek == null || pa.targetMinutesPerCycle == null) return null;
    return (pa.volumePerWeek * pa.targetMinutesPerCycle) / 60;
  }, [pa.volumePerWeek, pa.targetMinutesPerCycle]);

  const title =
    mode === 'measurement'
      ? isPolish
        ? 'Pomiar'
        : 'Measurement'
      : isPolish
        ? 'Re-estymacja'
        : 'Re-estimation';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {mode === 'measurement'
            ? isPolish
              ? 'Zbierz baseline: wolumen, czas i błędy.'
              : 'Capture the baseline: volume, time, and errors.'
            : isPolish
              ? 'Oszacuj target po redesignie: czas i błędy.'
              : 'Estimate the target after redesign: time and errors.'}
        </p>
      </div>

      {mode === 'measurement' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isPolish ? 'Nazwa procesu' : 'Process name'}
            </label>
            <input
              value={pa.processName}
              onChange={(e) => patch({ processName: e.target.value })}
              placeholder={
                isPolish
                  ? 'np. obsługa faktur, przyjęcie zamówienia...'
                  : 'e.g. invoice processing, order intake...'
              }
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isPolish ? 'Właściciel (rola/osoba)' : 'Owner (role/person)'}
            </label>
            <input
              value={pa.owner}
              onChange={(e) => patch({ owner: e.target.value })}
              placeholder={isPolish ? 'np. AP Manager' : 'e.g. AP Manager'}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isPolish ? 'Wolumen / tydzień' : 'Volume / week'}
            </label>
            <input
              inputMode="decimal"
              value={pa.volumePerWeek == null ? '' : String(pa.volumePerWeek)}
              onChange={(e) => patch({ volumePerWeek: coerceNumber(e.target.value) })}
              placeholder={isPolish ? 'np. 250' : 'e.g. 250'}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isPolish ? 'Baseline: min/cykl' : 'Baseline: min/cycle'}
            </label>
            <input
              inputMode="decimal"
              value={pa.baselineMinutesPerCycle == null ? '' : String(pa.baselineMinutesPerCycle)}
              onChange={(e) => patch({ baselineMinutesPerCycle: coerceNumber(e.target.value) })}
              placeholder={isPolish ? 'np. 12' : 'e.g. 12'}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isPolish ? 'Baseline: error rate (%)' : 'Baseline: error rate (%)'}
            </label>
            <input
              inputMode="decimal"
              value={pa.errorRateBaselinePct == null ? '' : String(pa.errorRateBaselinePct)}
              onChange={(e) => patch({ errorRateBaselinePct: coerceNumber(e.target.value) })}
              placeholder={isPolish ? 'np. 3.5' : 'e.g. 3.5'}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      )}

      {mode === 're-estimation' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isPolish ? 'Target: min/cykl' : 'Target: min/cycle'}
            </label>
            <input
              inputMode="decimal"
              value={pa.targetMinutesPerCycle == null ? '' : String(pa.targetMinutesPerCycle)}
              onChange={(e) => patch({ targetMinutesPerCycle: coerceNumber(e.target.value) })}
              placeholder={isPolish ? 'np. 5' : 'e.g. 5'}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              {isPolish ? 'Target: error rate (%)' : 'Target: error rate (%)'}
            </label>
            <input
              inputMode="decimal"
              value={pa.errorRateTargetPct == null ? '' : String(pa.errorRateTargetPct)}
              onChange={(e) => patch({ errorRateTargetPct: coerceNumber(e.target.value) })}
              placeholder={isPolish ? 'np. 1' : 'e.g. 1'}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
            />
          </div>
        </div>
      )}

      <div className="p-4 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {isPolish ? 'Szacowane godziny / tydzień' : 'Estimated hours / week'}
        </div>
        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-700 dark:text-slate-300">
          <div>
            {isPolish ? 'Baseline' : 'Baseline'}:{' '}
            {baselineHoursPerWeek == null ? '—' : baselineHoursPerWeek.toFixed(1)}
          </div>
          <div>
            {isPolish ? 'Target' : 'Target'}:{' '}
            {targetHoursPerWeek == null ? '—' : targetHoursPerWeek.toFixed(1)}
          </div>
        </div>
      </div>
    </div>
  );
}
