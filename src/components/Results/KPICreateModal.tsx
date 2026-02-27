import { X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '@/services/api';

interface KPICreateModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface Initiative {
  id: string;
  name: string;
}

type Direction = 'increase' | 'decrease' | 'maintain';
type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY';

export const KPICreateModal: React.FC<KPICreateModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [baseline, setBaseline] = useState('');
  const [target, setTarget] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [direction, setDirection] = useState<Direction>('increase');
  const [initiativeId, setInitiativeId] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/initiatives`, { headers: getHeaders() });
        if (res.ok) {
          const data = await res.json();
          setInitiatives((data || []).map((i: any) => ({ id: i.id, name: i.name || i.title })));
        }
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

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        unit: unit.trim() || undefined,
        baselineValue: baseline ? Number(baseline) : null,
        targetValue: target ? Number(target) : null,
        measurementFrequency: frequency,
        alertDirection: direction === 'decrease' ? 'BELOW' : 'ABOVE',
        isPrimary: false,
        sortOrder: 0,
      };

      try {
        const url = initiativeId
          ? `${API_URL}/initiatives/${initiativeId}/kpis`
          : `${API_URL}/benefits/kpi-mappings`;

        const res = await fetch(url, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          onSuccess();
        }
      } catch {
        // silently fail
      } finally {
        setSaving(false);
      }
    },
    [name, description, unit, baseline, target, frequency, direction, initiativeId, onSuccess]
  );

  const inputCls =
    'w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-colors';
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
                onChange={(e) => setDirection(e.target.value as Direction)}
              >
                <option value="increase">{t('results.direction.increase', 'Increase')}</option>
                <option value="decrease">{t('results.direction.decrease', 'Decrease')}</option>
                <option value="maintain">{t('results.direction.maintain', 'Maintain')}</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>
              {t('results.createModal.initiative', 'Initiative (optional)')}
            </label>
            <select
              className={selectCls}
              value={initiativeId}
              onChange={(e) => setInitiativeId(e.target.value)}
            >
              <option value="">
                {t('results.createModal.globalKpi', '— Global KPI (no initiative) —')}
              </option>
              {initiatives.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
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
              className="h-9 px-5 text-sm font-medium rounded-full bg-primary-500 text-white hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
