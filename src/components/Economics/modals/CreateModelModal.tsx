import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyFinance,
  V8FinanceApi,
  type V8FinanceModelCreatePayload,
} from '@/services/api/v8/finance';

import {
  type FinanceModelRow,
  type FinanceStatementRow,
  normalizeModelStatus,
} from '../financeTypes';

interface CreateModelModalProps {
  onCreated: (row: FinanceModelRow) => void;
  onClose: () => void;
  availableStatements?: FinanceStatementRow[];
  initialSourceStatementPackId?: string | null;
}

function toForecastStartDate(periodEnd?: string): string {
  if (!periodEnd) return new Date().toISOString().slice(0, 10);
  const [year, month] = String(periodEnd).slice(0, 10).split('-').map(Number);
  if (!year || !month) return new Date().toISOString().slice(0, 10);
  const next = new Date(Date.UTC(year, month, 1));
  return next.toISOString().slice(0, 10);
}

export const CreateModelModal: React.FC<CreateModelModalProps> = ({
  onCreated,
  onClose,
  availableStatements = [],
  initialSourceStatementPackId,
}) => {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);

  // DEC-3: a model is DEFAULT-grounded on the most recent Approved statement.
  // `availableStatements` is already filtered to workable/Approved packs by the
  // hub, so the newest one (by updatedAt) is the default seed. Starting from
  // zero is a deliberate opt-out, not the default.
  const newestApprovedStatement = useMemo(() => {
    if (availableStatements.length === 0) return null;
    return [...availableStatements].sort((a, b) =>
      String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
    )[0];
  }, [availableStatements]);

  const [mode, setMode] = useState<'manual' | 'statement'>(
    initialSourceStatementPackId || newestApprovedStatement ? 'statement' : 'manual'
  );
  const [sourceStatementPackId, setSourceStatementPackId] = useState(
    initialSourceStatementPackId || newestApprovedStatement?.id || ''
  );
  const [form, setForm] = useState({
    name: '',
    startDate: new Date().toISOString().slice(0, 10),
    horizonMonths: 60,
    granularity: 'monthly',
    currency: 'PLN',
  });

  const selectedStatement = useMemo(
    () => availableStatements.find((statement) => statement.id === sourceStatementPackId) || null,
    [availableStatements, sourceStatementPackId]
  );

  const updateFromStatement = useCallback(
    (statementPackId: string) => {
      setSourceStatementPackId(statementPackId);
      const statement = availableStatements.find((item) => item.id === statementPackId) || null;
      if (!statement) return;
      setForm((prev) => ({
        ...prev,
        name:
          prev.name ||
          `${
            statement.periodLabel || statement.title
          } ${t('finance.model.defaultForecastSuffix', 'forecast')}`,
        startDate: toForecastStartDate(statement.periodEnd),
        currency: statement.currency || prev.currency,
      }));
    },
    [availableStatements, t]
  );

  // Seed the form from the initial pack (deep-link) or, absent that, from the
  // newest Approved statement (DEC-3 default grounding). Runs once on mount.
  useEffect(() => {
    const seedId = initialSourceStatementPackId || newestApprovedStatement?.id;
    if (seedId) {
      updateFromStatement(seedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createModelWithFallback = useCallback(async (payload: V8FinanceModelCreatePayload) => {
    try {
      return await V8FinanceApi.createModel(payload);
    } catch (error) {
      if (!shouldFallbackToLegacyFinance(error)) {
        throw error;
      }
      return await Api.post('/api/financial-modeling/models', payload);
    }
  }, []);

  const getModelDetailWithFallback = useCallback(async (modelId: string) => {
    try {
      const data = await V8FinanceApi.getModel(modelId);
      return data?.model ?? null;
    } catch (error) {
      if (!shouldFallbackToLegacyFinance(error)) {
        throw error;
      }
      return await Api.get(`/api/financial-modeling/models/${modelId}`).catch(() => null);
    }
  }, []);

  const handleCreate = useCallback(async () => {
    if (!form.name || !form.startDate) return;
    if (mode === 'statement' && !sourceStatementPackId) return;
    setCreating(true);
    try {
      const payload = {
        name: form.name,
        startDate: form.startDate,
        horizonMonths: form.horizonMonths,
        granularity: form.granularity,
        currency: form.currency,
        sourceStatementPackId: mode === 'statement' ? sourceStatementPackId : undefined,
        assumptions:
          mode === 'statement'
            ? undefined
            : { initialCash: 0, initialEquity: 0, initialDebt: 0, initialPPE: 0 },
      };
      const created = (await createModelWithFallback(payload)) as any;
      const createdModel = created?.model || created;
      const createdId = String(createdModel?.id || created?.id || '');
      let model = createdModel;
      if (createdId && !created?.model) {
        try {
          model = await getModelDetailWithFallback(createdId);
        } catch {
          /* use created */
        }
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
        sourceStatementPackId:
          model?.source_statement_pack_id ||
          model?.sourceStatementPackId ||
          (mode === 'statement' ? sourceStatementPackId : undefined),
        updatedAt: String(model?.updated_at || new Date().toISOString()),
      });
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error || t('finance.toast.createFailed', 'Nie udało się utworzyć modelu')
      );
    } finally {
      setCreating(false);
    }
  }, [
    createModelWithFallback,
    form,
    getModelDetailWithFallback,
    mode,
    onCreated,
    sourceStatementPackId,
    t,
  ]);

  return (
    <div className="fixed inset-0 z-overlay bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('finance.model.createModel', 'Create Financial Model')}
        </h3>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 dark:bg-navy-800 p-1">
          <button
            onClick={() => setMode('statement')}
            disabled={availableStatements.length === 0}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-40 ${
              mode === 'statement'
                ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-300'
            }`}
          >
            {t('finance.model.fromStatementMode', 'Ground on statement')}
          </button>
          <button
            onClick={() => setMode('manual')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'manual'
                ? 'bg-white dark:bg-navy-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-300'
            }`}
          >
            {t('finance.model.manualMode', 'Start from zero')}
          </button>
        </div>
        <div className="space-y-3">
          {mode === 'statement' && (
            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-500">
                    {t('finance.model.sourceStatement', 'Source statement')}
                  </label>
                  {newestApprovedStatement &&
                    sourceStatementPackId === newestApprovedStatement.id && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                        {t('finance.model.defaultLatestApproved', 'Latest approved (default)')}
                      </span>
                    )}
                </div>
                <select
                  value={sourceStatementPackId}
                  onChange={(e) => updateFromStatement(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                >
                  <option value="">
                    {t('finance.model.selectStatement', 'Select statement pack')}
                  </option>
                  {availableStatements.map((statement) => (
                    <option key={statement.id} value={statement.id}>
                      {statement.entityName || statement.title} -{' '}
                      {statement.periodLabel || statement.periodEnd} - {statement.currency}
                    </option>
                  ))}
                </select>
              </div>
              {selectedStatement && (
                <div className="rounded-lg bg-slate-50 dark:bg-navy-800/70 p-3 text-xs text-slate-600 dark:text-slate-300">
                  <div>
                    {t('finance.model.seedEntity', 'Entity')}: {selectedStatement.entityName || '—'}
                  </div>
                  <div>
                    {t('finance.model.seedPeriod', 'Period')}:{' '}
                    {selectedStatement.periodLabel || '—'}
                  </div>
                  <div>
                    {t('finance.model.seedStatus', 'Seed status')}:{' '}
                    {String(selectedStatement.readinessStatus || '').toLowerCase() === 'ready'
                      ? t('finance.model.seedReady', 'ready')
                      : t('finance.model.seedNeedsConfirmation', 'requires confirmation')}
                  </div>
                  <div>
                    {t('finance.model.seedStartDate', 'Forecast start')}: {form.startDate}
                  </div>
                </div>
              )}
            </div>
          )}
          {mode === 'manual' && (
            <div className="rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50/60 dark:bg-amber-900/10 p-3 text-xs text-amber-800 dark:text-amber-200">
              {t(
                'finance.model.manualModeNotice',
                'No source statement — historical lines will not be pulled in. Opening balances start at zero. Use "Ground on statement" to seed the model from an approved statement.'
              )}
            </div>
          )}
          <div>
            <label className="text-xs text-slate-500">
              {t('finance.model.modelName', 'Model Name')}
            </label>
            <input
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder={
                t(
                  'finance.model.modelNamePlaceholder',
                  'e.g. Initiative Alpha — 5yr projection'
                ) as string
              }
              className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">
                {t('finance.model.startDate', 'Start Date')}
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">
                {t('finance.model.horizon', 'Horizon (months)')}
              </label>
              <input
                type="number"
                value={form.horizonMonths}
                onChange={(e) =>
                  setForm((p) => ({ ...p, horizonMonths: parseInt(e.target.value, 10) || 60 }))
                }
                className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">
                {t('finance.model.granularity', 'Granularity')}
              </label>
              <select
                value={form.granularity}
                onChange={(e) => setForm((p) => ({ ...p, granularity: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
              >
                <option value="monthly">{t('finance.model.monthly', 'Monthly')}</option>
                <option value="quarterly">{t('finance.model.quarterly', 'Quarterly')}</option>
                <option value="annual">{t('finance.model.annual', 'Annual')}</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">
                {t('finance.model.currency', 'Currency')}
              </label>
              <select
                value={form.currency}
                onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))}
                className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
              >
                {['PLN', 'EUR', 'USD', 'GBP', 'CZK', 'CHF'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
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
            disabled={!form.name || creating || (mode === 'statement' && !sourceStatementPackId)}
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50"
          >
            {t('common.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};
