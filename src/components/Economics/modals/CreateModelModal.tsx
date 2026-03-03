import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { type FinanceModelRow, normalizeModelStatus } from '../financeTypes';

interface CreateModelModalProps {
  onCreated: (row: FinanceModelRow) => void;
  onClose: () => void;
}

export const CreateModelModal: React.FC<CreateModelModalProps> = ({ onCreated, onClose }) => {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: '',
    startDate: new Date().toISOString().slice(0, 10),
    horizonMonths: 60,
    granularity: 'monthly',
    currency: 'PLN',
  });

  const handleCreate = useCallback(async () => {
    if (!form.name || !form.startDate) return;
    setCreating(true);
    try {
      const created = await Api.post('/api/financial-modeling/models', {
        name: form.name, startDate: form.startDate, horizonMonths: form.horizonMonths,
        granularity: form.granularity, currency: form.currency,
        assumptions: { initialCash: 0, initialEquity: 0, initialDebt: 0, initialPPE: 0 },
      });
      const createdId = String((created as any)?.id || '');
      let model = created as any;
      if (createdId) {
        try { model = await Api.get(`/api/financial-modeling/models/${createdId}`); } catch { /* use created */ }
      }
      toast.success(t('finance.toast.modelCreated', 'Model utworzony'));
      onCreated({
        id: String(model?.id || createdId),
        title: String(model?.name || form.name),
        kind: 'models',
        predictionType: 'model',
        status: normalizeModelStatus(model?.status),
        scenario: String(model?.scenario || 'base'),
        currency: String(model?.currency || form.currency),
        horizonMonths: Number(model?.horizon_months || form.horizonMonths),
        startDate: String(model?.start_date || form.startDate),
        updatedAt: String(model?.updated_at || new Date().toISOString()),
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t('finance.toast.createFailed', 'Nie udało się utworzyć modelu'));
    } finally {
      setCreating(false);
    }
  }, [form, onCreated, t]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('finance.model.createModel', 'Create Financial Model')}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500">{t('finance.model.modelName', 'Model Name')}</label>
            <input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={t('finance.model.modelNamePlaceholder', 'e.g. Initiative Alpha — 5yr projection') as string}
              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">{t('finance.model.startDate', 'Start Date')}</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800" />
            </div>
            <div>
              <label className="text-xs text-slate-500">{t('finance.model.horizon', 'Horizon (months)')}</label>
              <input type="number" value={form.horizonMonths} onChange={(e) => setForm((p) => ({ ...p, horizonMonths: parseInt(e.target.value, 10) || 60 }))}
                className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800" />
            </div>
            <div>
              <label className="text-xs text-slate-500">{t('finance.model.granularity', 'Granularity')}</label>
              <select value={form.granularity} onChange={(e) => setForm((p) => ({ ...p, granularity: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800">
                <option value="monthly">{t('finance.model.monthly', 'Monthly')}</option>
                <option value="quarterly">{t('finance.model.quarterly', 'Quarterly')}</option>
                <option value="annual">{t('finance.model.annual', 'Annual')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">{t('finance.model.currency', 'Currency')}</label>
              <select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800">
                {['PLN', 'EUR', 'USD', 'GBP', 'CZK', 'CHF'].map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm">
            {t('common.cancel', 'Cancel')}
          </button>
          <button onClick={handleCreate} disabled={!form.name || creating}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50">
            {t('common.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};
