import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { shouldFallbackToLegacyFinance, V8FinanceApi } from '@/services/api/v8/finance';

import {
  type FinanceAnalysisRow,
  type FinanceStatementRow,
  normalizeStatus,
} from '../financeTypes';

interface CreateAnalysisModalProps {
  onCreated: (row: FinanceAnalysisRow) => void;
  onClose: () => void;
  defaultAnalysisType?: string;
  availableStatements?: FinanceStatementRow[];
  initialStatementPackId?: string | null;
  initialTitle?: string;
}

export const CreateAnalysisModal: React.FC<CreateAnalysisModalProps> = ({
  onCreated,
  onClose,
  defaultAnalysisType = 'comprehensive',
  availableStatements = [],
  initialStatementPackId = null,
  initialTitle = '',
}) => {
  const { t } = useTranslation();
  const isInvestmentCase = defaultAnalysisType === 'investment_case';
  const [title, setTitle] = useState(initialTitle);
  const [creating, setCreating] = useState(false);
  const [selectedStatementPackId, setSelectedStatementPackId] = useState(
    initialStatementPackId || ''
  );
  const [initialInvestment, setInitialInvestment] = useState('');
  const [horizon, setHorizon] = useState('5');
  const [discountRatePct, setDiscountRatePct] = useState('10');
  const [annualBenefits, setAnnualBenefits] = useState('');

  const selectedStatementPack = useMemo(
    () => availableStatements.find((statement) => statement.id === selectedStatementPackId) || null,
    [availableStatements, selectedStatementPackId]
  );
  /**
   * FIN-005: the payload already takes its currency from the selected pack, but
   * the input LABELS hardcoded "(PLN)" — and `finance.investment.capex` /
   * `finance.investment.benefits` have no entry in any locale file, so that
   * hardcoded fallback is literally what renders. On the EUR Atelier golden
   * flow the investment-case form therefore asked for zlotys while storing
   * euros. Label and payload must name the same currency.
   */
  const inputCurrency = String(selectedStatementPack?.currency || '').trim() || 'PLN';

  const selectStatementPack = useCallback((statementPackId: string) => {
    setSelectedStatementPackId(statementPackId);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const investmentPayload = isInvestmentCase
        ? {
            initialInvestment: initialInvestment ? parseFloat(initialInvestment) : undefined,
            horizon: horizon ? parseInt(horizon, 10) : undefined,
            discountRatePct: discountRatePct ? parseFloat(discountRatePct) : undefined,
            annualBenefits: annualBenefits ? parseFloat(annualBenefits) : undefined,
          }
        : {};
      let result: any;
      try {
        result = await V8FinanceApi.createAnalysis({
          title: title.trim(),
          analysisType: defaultAnalysisType,
          currency: selectedStatementPack?.currency || 'PLN',
          sourceStatementPackId: selectedStatementPackId || undefined,
          ...investmentPayload,
        });
      } catch (error) {
        if (!shouldFallbackToLegacyFinance(error)) {
          throw error;
        }
        result = await Api.post('/api/economics/financial-analyses', {
          title: title.trim(),
          analysisType: defaultAnalysisType,
          currency: selectedStatementPack?.currency || 'PLN',
          sourceStatementPackId: selectedStatementPackId || undefined,
          ...investmentPayload,
        });
      }
      const created = result as any;
      const analysis = created?.analysis || created;
      toast.success(t('finance.toast.analysisCreated', 'Analiza utworzona'));
      onCreated({
        id: String(analysis?.id || ''),
        title: String(analysis?.title || title),
        kind: defaultAnalysisType === 'investment_case' ? 'investment' : 'analysis',
        status: normalizeStatus(analysis?.status),
        analysisType: String(
          analysis?.analysisType || analysis?.analysis_type || defaultAnalysisType
        ),
        currency: String(analysis?.currency || selectedStatementPack?.currency || 'PLN'),
        periodCount: Array.isArray(analysis?.periods) ? analysis.periods.length : 0,
        sourceStatementIds: Array.isArray(analysis?.sourceStatementIds)
          ? analysis.sourceStatementIds
          : Array.isArray(analysis?.source_statement_ids)
            ? analysis.source_statement_ids
            : selectedStatementPack?.statementIds,
        sourceStatementPackId:
          analysis?.sourceStatementPackId ||
          analysis?.source_statement_pack_id ||
          selectedStatementPackId ||
          undefined,
        updatedAt: String(analysis?.updated_at || new Date().toISOString()),
      });
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error || t('finance.toast.createFailed', 'Nie udało się utworzyć')
      );
    } finally {
      setCreating(false);
    }
  }, [
    annualBenefits,
    defaultAnalysisType,
    discountRatePct,
    horizon,
    initialInvestment,
    isInvestmentCase,
    onCreated,
    selectedStatementPack,
    selectedStatementPackId,
    t,
    title,
  ]);

  return (
    <div className="fixed inset-0 z-overlay bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {isInvestmentCase
            ? t('finance.investment.createTitle', 'New Investment Case')
            : t('finance.analysis.createTitle', 'New Financial Analysis')}
        </h3>
        <div>
          <label className="text-xs text-slate-500">
            {t('finance.analysis.analysisName', 'Analysis Name')}
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              t('finance.analysis.titlePlaceholder', 'e.g., Q4 2025 Financial Review') as string
            }
            className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
          />
        </div>
        {isInvestmentCase && (
          <div className="space-y-3 rounded-xl border border-amber-200 dark:border-amber-700/40 bg-amber-50/60 dark:bg-amber-900/10 p-4">
            <div className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
              {t('finance.investment.inputs', 'Investment parameters')}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">
                  {t('finance.investment.capex', 'Initial investment ({{currency}})', {
                    currency: inputCurrency,
                  })}
                </label>
                <input
                  type="number"
                  value={initialInvestment}
                  onChange={(e) => setInitialInvestment(e.target.value)}
                  placeholder="1 000 000"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">
                  {t('finance.investment.horizon', 'Horizon (years)')}
                </label>
                <input
                  type="number"
                  value={horizon}
                  onChange={(e) => setHorizon(e.target.value)}
                  min="1"
                  max="30"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">
                  {t('finance.investment.rate', 'Discount rate (%)')}
                </label>
                <input
                  type="number"
                  value={discountRatePct}
                  onChange={(e) => setDiscountRatePct(e.target.value)}
                  min="0"
                  max="100"
                  step="0.5"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">
                  {t('finance.investment.benefits', 'Annual benefits ({{currency}}/yr)', {
                    currency: inputCurrency,
                  })}
                </label>
                <input
                  type="number"
                  value={annualBenefits}
                  onChange={(e) => setAnnualBenefits(e.target.value)}
                  placeholder="250 000"
                  className="mt-1 w-full px-3 py-2 border border-slate-200 dark:border-navy-600 rounded-lg text-sm bg-white dark:bg-navy-800"
                />
              </div>
            </div>
          </div>
        )}
        <div className="space-y-2 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-500">
              {t('finance.analysis.sourceStatements', 'Source statement pack')}
            </label>
            <span className="text-[11px] text-slate-600">
              {selectedStatementPackId
                ? t('finance.analysis.selectedOne', 'selected')
                : '0 selected'}
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {availableStatements.map((statement) => (
              <button
                key={statement.id}
                type="button"
                onClick={() => selectStatementPack(statement.id)}
                className={`w-full flex items-start gap-3 rounded-lg border px-3 py-2 text-sm text-left ${
                  selectedStatementPackId === statement.id
                    ? 'border-emerald-300 bg-emerald-50/70 dark:border-emerald-600/40 dark:bg-emerald-900/10'
                    : 'border-slate-200 dark:border-navy-700'
                }`}
              >
                <div className="mt-0.5 text-xs">
                  {selectedStatementPackId === statement.id ? '●' : '○'}
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {statement.entityName || statement.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {statement.periodLabel || statement.periodEnd} • {statement.currency} •{' '}
                    {statement.completenessLabel || statement.rawStatus}
                  </div>
                </div>
              </button>
            ))}
            {availableStatements.length === 0 && (
              <div className="text-xs text-slate-600">
                {t('finance.analysis.noStatements', 'No statements available')}
              </div>
            )}
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
            disabled={!title.trim() || creating || !selectedStatementPackId}
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500 disabled:opacity-50"
          >
            {t('common.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};
