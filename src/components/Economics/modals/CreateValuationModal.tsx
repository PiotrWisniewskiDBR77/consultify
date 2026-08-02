import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { type FinanceValuationRow, normalizeStatus } from '../financeTypes';

interface CreateValuationModalProps {
  initialSourceType?: 'financial_model' | 'financial_analysis' | 'budget' | 'manual';
  initialSourceId?: string;
  initialTitle?: string;
  onCreated: (row: FinanceValuationRow) => void;
  onClose: () => void;
}

export const CreateValuationModal: React.FC<CreateValuationModalProps> = ({
  initialSourceType,
  initialSourceId,
  initialTitle = '',
  onCreated,
  onClose,
}) => {
  const { t } = useTranslation();

  const [title, setTitle] = useState(initialTitle);
  const [sourceType, setSourceType] = useState<
    'financial_model' | 'financial_analysis' | 'budget' | 'manual'
  >(initialSourceType || 'manual');
  const [sourceId, setSourceId] = useState(initialSourceId || '');
  const [horizonYears, setHorizonYears] = useState(5);
  const [creating, setCreating] = useState(false);
  const [sources, setSources] = useState<{
    budgets: any[];
    financialModels: any[];
    financialAnalyses: any[];
  }>({
    budgets: [],
    financialModels: [],
    financialAnalyses: [],
  });

  useEffect(() => {
    Api.get('/api/economics/valuations/sources')
      .then((data) => {
        const s = (data as any)?.sources;
        setSources({
          budgets: s?.budgets || [],
          financialModels: s?.financialModels || [],
          financialAnalyses: s?.financialAnalyses || [],
        });
      })
      .catch(() => setSources({ budgets: [], financialModels: [], financialAnalyses: [] }));
  }, []);

  /**
   * FIN-005: the currency was hardcoded 'PLN'. A valuation built ON a EUR
   * source (the Atelier FY2014 model/analysis) was stored and displayed as
   * zlotys, contradicting the source it is derived from. Inherit the source's
   * currency; 'PLN' stays only as the fallback for a manual/uncurrencied source.
   *
   * This lookup lives in RENDER scope on purpose. `sources` is filled by an
   * async fetch after the first render, so resolving it inside the submit
   * callback made the value a closure dependency. When FinanceHub opens the
   * modal pre-seeded (`initialSourceType` / `initialSourceId` / `initialTitle`
   * — "create a valuation from THIS model"), nothing in the callback's
   * dependency list changes between mount and submit, so the first-render
   * callback survived, `find()` ran against the still-empty arrays, and the
   * payload silently fell back to 'PLN' — reinstating the exact bug this code
   * removes, while reading as if it were fixed. Derived at render, the value
   * cannot go stale regardless of the dependency list below.
   */
  const sourceCurrency = useMemo(() => {
    const selectedSource =
      sourceType === 'financial_model'
        ? sources.financialModels.find((item: any) => String(item.id) === sourceId)
        : sourceType === 'financial_analysis'
          ? sources.financialAnalyses.find((item: any) => String(item.id) === sourceId)
          : sourceType === 'budget'
            ? sources.budgets.find((item: any) => String(item.id) === sourceId)
            : null;
    return String((selectedSource as any)?.currency || '').trim();
  }, [sourceType, sourceId, sources]);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    if (sourceType !== 'manual' && !sourceId) {
      toast.error(t('valuation.create.sourceRequired', 'Select a source'));
      return;
    }
    setCreating(true);
    try {
      const result = await Api.post('/api/economics/valuations', {
        title: title.trim(),
        sourceType,
        sourceId: sourceType === 'manual' ? null : sourceId,
        horizonYears,
        currency: sourceCurrency || 'PLN',
      });
      const created = result as any;
      toast.success(t('finance.toast.valuationCreated', 'Valuation created'));
      onCreated({
        id: String(created.id),
        title: String(created.title || title),
        kind: 'valuation',
        status: normalizeStatus(created.status),
        sourceType: String(created.sourceType || created.source_type || sourceType),
        method: 'DCF',
        currency: String(created.currency || sourceCurrency || 'PLN'),
        horizonYears: Number(created.horizonYears ?? created.horizon_years ?? horizonYears),
        updatedAt: String(created.updated_at || new Date().toISOString()),
      });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t('finance.toast.createFailed', 'Failed to create'));
    } finally {
      setCreating(false);
    }
  }, [title, sourceType, sourceId, sourceCurrency, horizonYears, onCreated, t]);

  return (
    <div className="fixed inset-0 z-overlay bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('finance.valuation.createTitle', 'Nowa wycena przedsiębiorstwa')}
        </h3>
        <div>
          <label className="text-xs text-slate-500">
            {t('finance.valuation.name', 'Nazwa wyceny')}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('finance.valuation.namePlaceholder', 'np. Wycena DCF Q1 2026') as string}
            className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">
            {t('finance.valuation.sourceType', 'Źródło danych')}
          </label>
          <select
            value={sourceType}
            onChange={(e) => {
              setSourceType(e.target.value as any);
              setSourceId('');
            }}
            className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
          >
            <option value="manual">{t('finance.preview.sourceManualData', 'Manual data')}</option>
            <option value="financial_model">
              {t('finance.preview.financialModelLabel', 'Financial model')}
            </option>
            <option value="financial_analysis">
              {t('finance.preview.financialAnalysisLabel', 'Financial analysis')}
            </option>
            <option value="budget">{t('finance.prediction.budget', 'Budget')}</option>
          </select>
        </div>
        {sourceType !== 'manual' && (
          <div>
            <label className="text-xs text-slate-500">
              {sourceType === 'financial_model'
                ? t('finance.preview.selectModel', 'Select model')
                : sourceType === 'financial_analysis'
                  ? t('finance.preview.selectAnalysis', 'Select analysis')
                  : t('finance.preview.selectBudget', 'Select budget')}
            </label>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
            >
              <option value="">{t('finance.preview.selectPlaceholder', '— select —')}</option>
              {sourceType === 'financial_model'
                ? sources.financialModels.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name || m.title || m.id}
                    </option>
                  ))
                : sourceType === 'financial_analysis'
                  ? sources.financialAnalyses.map((analysis: any) => (
                      <option key={analysis.id} value={analysis.id}>
                        {analysis.title || analysis.id}
                      </option>
                    ))
                  : sources.budgets.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.title || b.name || b.id}
                      </option>
                    ))}
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-slate-500">
            {t('finance.valuation.horizonYears', 'Horyzont (lata)')}
          </label>
          <input
            type="number"
            min={1}
            max={20}
            value={horizonYears}
            onChange={(e) => setHorizonYears(Number(e.target.value) || 5)}
            className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
          />
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
            disabled={!title.trim() || creating || (sourceType !== 'manual' && !sourceId)}
            className="px-4 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-500 disabled:opacity-50"
          >
            {t('common.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};
