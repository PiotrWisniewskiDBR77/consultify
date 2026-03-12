import React, { useCallback, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

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
  initialStatementIds?: string[];
  initialTitle?: string;
}

export const CreateAnalysisModal: React.FC<CreateAnalysisModalProps> = ({
  onCreated,
  onClose,
  defaultAnalysisType = 'comprehensive',
  availableStatements = [],
  initialStatementIds = [],
  initialTitle = '',
}) => {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initialTitle);
  const [creating, setCreating] = useState(false);
  const [selectedStatementIds, setSelectedStatementIds] = useState<string[]>(initialStatementIds);

  const selectedStatements = useMemo(
    () =>
      availableStatements.filter((statement) =>
        selectedStatementIds.includes(statement.id)
      ),
    [availableStatements, selectedStatementIds]
  );

  const toggleStatement = useCallback((statementId: string) => {
    setSelectedStatementIds((prev) =>
      prev.includes(statementId) ? prev.filter((id) => id !== statementId) : [...prev, statementId]
    );
  }, []);

  const handleCreate = useCallback(async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const result = await Api.post('/api/economics/financial-analyses', {
        title: title.trim(),
        analysisType: defaultAnalysisType,
        currency: selectedStatements[0]?.currency || 'PLN',
        sourceStatementIds: selectedStatementIds,
      });
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
        currency: String(analysis?.currency || selectedStatements[0]?.currency || 'PLN'),
        periodCount: Array.isArray(analysis?.periods) ? analysis.periods.length : 0,
        sourceStatementIds: selectedStatementIds,
        updatedAt: String(analysis?.updated_at || new Date().toISOString()),
      });
    } catch (e: any) {
      toast.error(
        e?.response?.data?.error || t('finance.toast.createFailed', 'Nie udało się utworzyć')
      );
    } finally {
      setCreating(false);
    }
  }, [defaultAnalysisType, selectedStatementIds, selectedStatements, title, onCreated, t]);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-navy-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          {t('finance.analysis.createTitle', 'New Financial Analysis')}
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
        <div className="space-y-2 rounded-xl border border-slate-200 dark:border-navy-700 p-4">
          <div className="flex items-center justify-between">
            <label className="text-xs text-slate-500">
              {t('finance.analysis.sourceStatements', 'Source statements')}
            </label>
            <span className="text-[11px] text-slate-400">
              {selectedStatementIds.length} {t('finance.analysis.selected', 'selected')}
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {availableStatements.map((statement) => (
              <label
                key={statement.id}
                className="flex items-start gap-3 rounded-lg border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  checked={selectedStatementIds.includes(statement.id)}
                  onChange={() => toggleStatement(statement.id)}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div className="font-medium text-slate-900 dark:text-white">
                    {statement.periodLabel || statement.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {statement.statementType} • {statement.currency} • {statement.rawStatus}
                  </div>
                </div>
              </label>
            ))}
            {availableStatements.length === 0 && (
              <div className="text-xs text-slate-400">
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
            disabled={!title.trim() || creating}
            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500 disabled:opacity-50"
          >
            {t('common.create', 'Create')}
          </button>
        </div>
      </div>
    </div>
  );
};
