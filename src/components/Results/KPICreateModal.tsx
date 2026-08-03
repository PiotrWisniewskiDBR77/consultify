import { X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyResults,
  V8ResultsApi,
  type V8ResultsCreateKpiMappingPayload,
  type V8ResultsCreateKpiPayload,
} from '@/services/api/v8/results';

interface KPICreateModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialInitiativeId?: string;
}

interface Initiative {
  id: string;
  name: string;
}

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

export const KPICreateModal: React.FC<KPICreateModalProps> = ({
  onClose,
  onSuccess,
  initialInitiativeId,
}) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [baseline, setBaseline] = useState('');
  const [target, setTarget] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [direction, setDirection] = useState<'increase' | 'decrease'>('increase');
  const [initiativeSearch, setInitiativeSearch] = useState('');
  const [initiativeIds, setInitiativeIds] = useState<string[]>([]);

  useEffect(() => {
    if (initialInitiativeId) {
      setInitiativeIds([initialInitiativeId]);
    }
  }, [initialInitiativeId]);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await Api.get('/initiatives');
        const data = (res?.data ?? res) as any;
        setInitiatives((data || []).map((i: any) => ({ id: i.id, name: i.name || i.title })));
      } catch {
        // silently fail
      }
    })();
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      setSaving(true);

      const kpiDirection = direction === 'decrease' ? 'LOWER_IS_BETTER' : 'HIGHER_IS_BETTER';
      const payload: V8ResultsCreateKpiPayload = {
        name: name.trim(),
        description: description.trim() || undefined,
        unit: unit.trim() || undefined,
        baselineValue: baseline ? Number(baseline) : null,
        targetValue: target ? Number(target) : null,
        measurementFrequency: frequency,
        // Canon v3: deterministic evaluation relies on direction + thresholds.
        direction: kpiDirection,
        thresholdMode: 'PERCENT_FROM_TARGET',
        amberThresholdPct: 0.1,
        redThresholdPct: 0.2,
      };

      try {
        // Always create as a global KPI and (optionally) link to initiatives via mappings.
        // This keeps Results compatible with the V3 SSOT mapping model (N↔N).
        let created: any;
        try {
          created = await V8ResultsApi.createKpi(payload);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          created = await Api.post('/benefits/kpis', payload);
        }
        const kpiId =
          (created as any)?.data?.id ||
          (created as any)?.id ||
          (created as any)?.data?.data?.id ||
          (created as any)?.data?.data ||
          null;
        if (!kpiId) {
          throw new Error(
            t(
              'results.createModal.missingId',
              'KPI was created without a stable identifier. The result list was not refreshed.'
            )
          );
        }

        if (initiativeIds.length > 0 && kpiId) {
          const mappingPayloads: V8ResultsCreateKpiMappingPayload[] = initiativeIds.map((id) => ({
            initiativeId: id,
            kpiId: String(kpiId),
            impactWeight: 1.0,
            impactDirection: direction === 'decrease' ? 'decrease' : 'increase',
            confidence: 'medium',
            notes: 'Linked from Results KPI create',
          }));

          await Promise.all(
            mappingPayloads.map(async (mapping) => {
              try {
                await V8ResultsApi.createKpiMapping(mapping);
              } catch (error) {
                if (!shouldFallbackToLegacyResults(error)) {
                  throw error;
                }
                await Api.post('/benefits/kpi-mappings', mapping);
              }
            })
          );
        }

        toast.success(t('results.createModal.created', 'KPI created'));
        onSuccess();
      } catch (error: any) {
        toast.error(
          error?.message || t('results.createModal.createFailed', 'Failed to create KPI')
        );
      } finally {
        setSaving(false);
      }
    },
    [name, description, unit, baseline, target, frequency, direction, initiativeIds, onSuccess]
  );

  const inputCls =
    'w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus:ring-c-focus focus-visible:border-c-focus-solid transition-colors';
  const selectCls = `${inputCls} appearance-none`;
  const labelCls = 'block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-navy-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('results.createModal.title', 'New KPI')}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className={labelCls}>{t('results.createModal.name', 'Name')} *</label>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('results.createModal.namePlaceholder', 'e.g. Revenue Growth %')}
              required
              autoFocus
            />
          </div>

          <div>
            <label className={labelCls}>
              {t('results.createModal.description', 'Description')}
            </label>
            <textarea
              className={`${inputCls} h-20 resize-none py-2`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t(
                'results.createModal.descriptionPlaceholder',
                'What does this KPI measure?'
              )}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>{t('results.createModal.unit', 'Unit')}</label>
              <input
                className={inputCls}
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="%"
              />
            </div>
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('results.createModal.frequency', 'Frequency')}</label>
              <select
                className={selectCls}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as Frequency)}
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
                <option value="MONTHLY">Monthly</option>
                <option value="QUARTERLY">Quarterly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{t('results.createModal.direction', 'Direction')}</label>
              <select
                className={selectCls}
                value={direction}
                onChange={(e) => setDirection(e.target.value as 'increase' | 'decrease')}
              >
                <option value="increase">{t('results.direction.increase', 'Increase')}</option>
                <option value="decrease">{t('results.direction.decrease', 'Decrease')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              {t('results.createModal.initiative', 'Initiatives (optional)')}
            </label>
            <input
              className={inputCls}
              value={initiativeSearch}
              onChange={(e) => setInitiativeSearch(e.target.value)}
              placeholder={t('common.search', 'Search')}
            />
            <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50/40 dark:bg-navy-800/40">
              {(() => {
                const q = initiativeSearch.trim().toLowerCase();
                const list = q
                  ? initiatives.filter((i) =>
                      String(i.name || '')
                        .toLowerCase()
                        .includes(q)
                    )
                  : initiatives;
                if (list.length === 0) {
                  return (
                    <div className="p-3 text-sm text-slate-500">
                      {t('results.createModal.noInitiatives', 'No initiatives found.')}
                    </div>
                  );
                }
                return (
                  <div className="divide-y divide-slate-200 dark:divide-navy-700">
                    {list.map((i) => {
                      const checked = initiativeIds.includes(i.id);
                      return (
                        <label
                          key={i.id}
                          className="flex items-start gap-2 p-3 cursor-pointer hover:bg-white/60 dark:hover:bg-navy-800/70 transition-colors"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked;
                              setInitiativeIds((prev) =>
                                next
                                  ? Array.from(new Set([...prev, i.id]))
                                  : prev.filter((id) => id !== i.id)
                              );
                            }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {i.name}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {t('results.createModal.globalKpi', 'Global KPI if nothing selected.')} (
              {initiativeIds.length}/{initiatives.length})
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 text-sm font-medium rounded-full border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="h-9 px-5 text-sm font-medium rounded-full bg-navy-900 dark:bg-[#F4F7FB] text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving
                ? t('common.saving', 'Saving...')
                : t('results.createModal.create', 'Create KPI')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default KPICreateModal;
