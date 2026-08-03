import { X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  type CreateKeyResultInput,
  createOkrKeyResult,
  updateOkrKeyResult,
} from '@/services/api/okrStrategic';
import { V8ResultsApi } from '@/services/api/v8/results';

export interface OkrKeyResultModalKeyResult {
  id: string;
  label: string;
  baseline?: number;
  target?: number;
  current?: number;
  weight?: number;
  kpiId?: string | null;
  krType?: 'metric' | 'milestone';
  kind?: 'committed' | 'aspirational';
}

interface OkrKeyResultModalProps {
  projectId?: string;
  objectiveId: string;
  keyResult?: OkrKeyResultModalKeyResult | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Create/edit a Key Result under an Objective — reuses the KPICreateModal
 * fetch-then-submit pattern.
 *
 * D7 (Piotr, 2026-07-12): "OKRy są indywidualne, zatem ręcznie tylko, one są
 * niezależne" — Key Results are scored EXCLUSIVELY from the manual
 * baseline/target/current triple (updated via check-ins), never automatically
 * from a KPI. `kpiId` is an optional, purely informational reference to a
 * live KPI for context/navigation — it never feeds the score.
 */
export const OkrKeyResultModal: React.FC<OkrKeyResultModalProps> = ({
  projectId,
  objectiveId,
  keyResult,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const isEdit = Boolean(keyResult?.id);
  const [saving, setSaving] = useState(false);
  const [kpis, setKpis] = useState<Array<{ id: string; name: string }>>([]);

  const [label, setLabel] = useState(keyResult?.label ?? '');
  const [baseline, setBaseline] = useState(keyResult?.baseline?.toString() ?? '');
  const [target, setTarget] = useState(keyResult?.target?.toString() ?? '');
  const [current, setCurrent] = useState(keyResult?.current?.toString() ?? '');
  const [kpiId, setKpiId] = useState(keyResult?.kpiId ?? '');
  const [krType, setKrType] = useState<'metric' | 'milestone'>(keyResult?.krType ?? 'metric');
  const [kind, setKind] = useState<'committed' | 'aspirational'>(keyResult?.kind ?? 'aspirational');

  useEffect(() => {
    (async () => {
      try {
        const res = await V8ResultsApi.getKpiCatalog();
        const list = (res as any)?.data?.kpis ?? (res as any)?.kpis ?? [];
        setKpis(list.map((k: any) => ({ id: k.id, name: k.name })));
      } catch {
        // silently fail — KPI link stays optional
      }
    })();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!label.trim()) return;
      setSaving(true);
      const payload: CreateKeyResultInput = {
        label: label.trim(),
        baseline: baseline ? Number(baseline) : null,
        target: target ? Number(target) : null,
        current: current ? Number(current) : null,
        kpiId: kpiId || null,
        krType,
        kind,
      };
      try {
        if (isEdit && keyResult) {
          await updateOkrKeyResult(projectId, keyResult.id, payload);
          toast.success(t('results.okr.krUpdated', 'Key Result updated'));
        } else {
          await createOkrKeyResult(projectId, objectiveId, payload);
          toast.success(t('results.okr.krCreated', 'Key Result created'));
        }
        onSuccess();
      } catch (error: any) {
        toast.error(
          error?.message || t('results.okr.krSaveFailed', 'Failed to save the key result')
        );
      } finally {
        setSaving(false);
      }
    },
    [
      isEdit,
      keyResult,
      label,
      baseline,
      target,
      current,
      kpiId,
      krType,
      kind,
      projectId,
      objectiveId,
      onSuccess,
      t,
    ]
  );

  const inputCls =
    'w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors';
  const selectCls = `${inputCls} appearance-none`;
  const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {isEdit
              ? t('results.okr.editKeyResult', 'Edit Key Result')
              : t('results.okr.newKeyResult', 'New Key Result')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>{t('results.okr.label', 'Key Result')} *</label>
            <input
              className={inputCls}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={t('results.okr.krLabelPlaceholder', 'e.g. Grow ARR from €1M to €3M')}
              required
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>
              {t('results.okr.linkedKpi', 'Related KPI (reference only, optional)')}
            </label>
            <select className={selectCls} value={kpiId} onChange={(e) => setKpiId(e.target.value)}>
              <option value="">{t('results.okr.noKpiLink', '— No related KPI —')}</option>
              {kpis.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {t(
                'results.okr.linkedKpiHint',
                'Informational link only — this Key Result is always scored manually via check-ins, never from the KPI value.'
              )}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{t('results.columns.baseline', 'Baseline')}</label>
              <input
                className={inputCls}
                type="number"
                value={baseline}
                onChange={(e) => setBaseline(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelCls}>{t('results.columns.target', 'Target')}</label>
              <input
                className={inputCls}
                type="number"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                placeholder="100"
              />
            </div>
            <div>
              <label className={labelCls}>{t('results.okr.current', 'Current')}</label>
              <input
                className={inputCls}
                type="number"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('results.okr.krType', 'Type')}</label>
              <select
                className={selectCls}
                value={krType}
                onChange={(e) => setKrType(e.target.value as 'metric' | 'milestone')}
              >
                <option value="metric">{t('results.okr.krTypeMetric', 'Metric')}</option>
                <option value="milestone">{t('results.okr.krTypeMilestone', 'Milestone')}</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('results.okr.kind', 'Kind')}</label>
              <select
                className={selectCls}
                value={kind}
                onChange={(e) => setKind(e.target.value as 'committed' | 'aspirational')}
              >
                <option value="aspirational">
                  {t('results.okr.kindAspirational', 'Aspirational (stretch)')}
                </option>
                <option value="committed">{t('results.okr.kindCommitted', 'Committed')}</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-sm font-medium rounded-full border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={!label.trim() || saving}
              className="h-9 px-5 text-sm font-medium rounded-full bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {saving
                ? t('common.saving', 'Saving...')
                : isEdit
                  ? t('common.save', 'Save')
                  : t('results.okr.createKeyResult', 'Create Key Result')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OkrKeyResultModal;
