import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ToolImpactHypothesis, ToolSession, useToolStore } from '@/store/useToolStore';

function coerceNumber(value: string): number | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function ImpactHypothesisStep(props: { session: ToolSession; isPolish: boolean }) {
  const { session } = props;
  const { t } = useTranslation();
  const { updateInputData } = useToolStore();

  const flow = (session.inputData as any)?.flow || {};
  const impactHypothesis: ToolImpactHypothesis = {
    metricName: '',
    baseline: null,
    target: null,
    unit: '',
    timeframe: '',
    assumptions: [],
    ...(flow.impactHypothesis || {}),
  };

  const [assumptionDraft, setAssumptionDraft] = useState('');

  const baselineText = useMemo(
    () => (impactHypothesis.baseline == null ? '' : String(impactHypothesis.baseline)),
    [impactHypothesis.baseline]
  );
  const targetText = useMemo(
    () => (impactHypothesis.target == null ? '' : String(impactHypothesis.target)),
    [impactHypothesis.target]
  );

  const patch = (next: Partial<ToolImpactHypothesis>) => {
    updateInputData({
      flow: {
        ...flow,
        impactHypothesis: { ...impactHypothesis, ...next },
      },
    });
  };

  const addAssumption = () => {
    const value = assumptionDraft.trim();
    if (!value) return;
    const existing = Array.isArray(impactHypothesis.assumptions)
      ? impactHypothesis.assumptions
      : [];
    patch({ assumptions: [...existing, value] });
    setAssumptionDraft('');
  };

  const removeAssumption = (idx: number) => {
    const existing = Array.isArray(impactHypothesis.assumptions)
      ? impactHypothesis.assumptions
      : [];
    patch({ assumptions: existing.filter((_, i) => i !== idx) });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsSteps.impactHypothesisStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsSteps.impactHypothesisStep.subtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.impactHypothesisStep.metric')}
          </label>
          <input
            value={impactHypothesis.metricName}
            onChange={(e) => patch({ metricName: e.target.value })}
            placeholder={t('discoveryToolsSteps.impactHypothesisStep.metricPlaceholder')}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.impactHypothesisStep.unit')}
          </label>
          <input
            value={impactHypothesis.unit}
            onChange={(e) => patch({ unit: e.target.value })}
            placeholder={t('discoveryToolsSteps.impactHypothesisStep.unitPlaceholder')}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.impactHypothesisStep.baseline')}
          </label>
          <input
            inputMode="decimal"
            value={baselineText}
            onChange={(e) => patch({ baseline: coerceNumber(e.target.value) })}
            placeholder={t('discoveryToolsSteps.impactHypothesisStep.baselinePlaceholder')}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.impactHypothesisStep.target')}
          </label>
          <input
            inputMode="decimal"
            value={targetText}
            onChange={(e) => patch({ target: coerceNumber(e.target.value) })}
            placeholder={t('discoveryToolsSteps.impactHypothesisStep.targetPlaceholder')}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>

        <div className="space-y-1 md:col-span-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            {t('discoveryToolsSteps.impactHypothesisStep.timeframe')}
          </label>
          <input
            value={impactHypothesis.timeframe}
            onChange={(e) => patch({ timeframe: e.target.value })}
            placeholder={t('discoveryToolsSteps.impactHypothesisStep.timeframePlaceholder')}
            className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {t('discoveryToolsSteps.impactHypothesisStep.assumptions')}
        </div>
        <div className="flex gap-2">
          <input
            value={assumptionDraft}
            onChange={(e) => setAssumptionDraft(e.target.value)}
            placeholder={t('discoveryToolsSteps.impactHypothesisStep.assumptionPlaceholder')}
            className="flex-1 px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
          />
          <button
            onClick={addAssumption}
            disabled={!assumptionDraft.trim()}
            className="px-4 py-3 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
          >
            {t('discoveryToolsSteps.impactHypothesisStep.add')}
          </button>
        </div>

        {impactHypothesis.assumptions.length === 0 ? (
          <div className="p-6 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600 text-sm">
            {t('discoveryToolsSteps.impactHypothesisStep.noAssumptions')}
          </div>
        ) : (
          <ul className="space-y-2">
            {impactHypothesis.assumptions.map((a, idx) => (
              <li
                key={`${idx}-${a}`}
                className="flex items-start justify-between gap-3 p-3 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
              >
                <div className="text-sm text-slate-700 dark:text-slate-200">{a}</div>
                <button
                  onClick={() => removeAssumption(idx)}
                  className="text-xs text-slate-500 hover:text-danger-600"
                >
                  {t('discoveryToolsSteps.impactHypothesisStep.remove')}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
