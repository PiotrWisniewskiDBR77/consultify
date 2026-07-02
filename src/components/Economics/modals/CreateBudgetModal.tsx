import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { type FinanceModelRow, normalizeStatus } from '../financeTypes';

interface CreateBudgetModalProps {
  onCreated: (row: FinanceModelRow) => void;
  onClose: () => void;
  initialTitle?: string;
}

export const CreateBudgetModal: React.FC<CreateBudgetModalProps> = ({
  onCreated,
  onClose,
  initialTitle = '',
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle);
  const [periodStart, setPeriodStart] = useState('2026-01');
  const [periodEnd, setPeriodEnd] = useState('2026-12');
  const [granularity, setGranularity] = useState<'monthly' | 'quarterly' | 'annual'>('monthly');
  const [creating, setCreating] = useState(false);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const result = await Api.post('/api/economics/budgets', {
        title: title.trim(),
        periodStart,
        periodEnd,
        granularity,
      });
      const created = (result as any)?.budget || result;
      toast.success(t('finance.toast.budgetCreated', 'Budżet utworzony'));
      onCreated({
        id: `budget-${created.id}`,
        title: String(created.title || title),
        kind: 'prediction',
        predictionType: 'budget',
        status: normalizeStatus(created.status),
        scenario: 'base/opt/cons',
        currency: String(created.currency || 'PLN'),
        horizonMonths: 0,
        startDate: String(created.periodStart || periodStart),
        periodStart: String(created.periodStart || periodStart),
        periodEnd: String(created.periodEnd || periodEnd),
        updatedAt: String(created.updated_at || new Date().toISOString()),
      });
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error || t('finance.toast.createFailed', 'Nie udało się utworzyć')
      );
    } finally {
      setCreating(false);
    }
  }, [title, periodStart, periodEnd, granularity, onCreated, t]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('finance.prediction.createTitle', 'Nowy budżet / scenariusz')}
        </h3>
        <div>
          <label className="text-xs text-slate-500">
            {t('finance.prediction.budgetName', 'Nazwa')}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              t('finance.prediction.namePlaceholder', 'e.g., Budget 2026 Q1-Q4') as string
            }
            className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-slate-500">
              {t('finance.prediction.periodStart', 'Okres od')}
            </label>
            <input
              type="month"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">
              {t('finance.prediction.periodEnd', 'Okres do')}
            </label>
            <input
              type="month"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
            />
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-500">
            {t('finance.prediction.granularity', 'Granulacja')}
          </label>
          <select
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as any)}
            className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
          >
            <option value="monthly">{t('finance.prediction.monthly', 'Miesięczna')}</option>
            <option value="quarterly">{t('finance.prediction.quarterly', 'Kwartalna')}</option>
            <option value="annual">{t('finance.prediction.annual', 'Roczna')}</option>
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm"
          >
            {t('common.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || creating}
            className="px-4 py-2 bg-c-text text-c-bg text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {t('common.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};
