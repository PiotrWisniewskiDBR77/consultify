import { CheckCircle, Copy, Download, Eye, RefreshCw, Trash2, TrendingUp } from 'lucide-react';
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { shouldFallbackToLegacyFinance, V8FinanceApi } from '@/services/api/v8/finance';

import { type RowAction } from '../../shared/RowActionsMenu';
import { type FinanceModelRow, type FinanceRow, type FinanceStatementRow } from '../financeTypes';

async function computeModelWithFallback(modelId: string) {
  try {
    return await V8FinanceApi.computeModel(modelId);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post(`/api/financial-modeling/models/${modelId}/compute`, {});
  }
}

interface UseFinanceRowActionsParams {
  handleOpenFull: (row: FinanceRow) => void;
  handleExport: (row: FinanceRow) => void;
  handleCreateModelFromStatement: (row: FinanceStatementRow) => void;
  handleCreateAnalysisFromStatements: (row: FinanceStatementRow) => void;
  loadStatements: () => Promise<void>;
  loadModels: () => Promise<void>;
  loadAnalyses: () => Promise<void>;
  loadBudgets: () => Promise<void>;
  loadValuations: () => Promise<void>;
  loadPredictionPreview: (modelId: string) => Promise<void>;
  loadBudgetPreviewScenarios: (budgetRawId: string) => Promise<void>;
  loadValuationPreviewResults: (valuationId: string) => Promise<void>;
  getBudgetRawId: (rowId: string) => string;
}

export function useFinanceRowActions({
  handleOpenFull,
  handleExport,
  handleCreateModelFromStatement,
  handleCreateAnalysisFromStatements,
  loadStatements,
  loadModels,
  loadAnalyses,
  loadBudgets,
  loadValuations,
  loadPredictionPreview,
  loadBudgetPreviewScenarios,
  loadValuationPreviewResults,
  getBudgetRawId,
}: UseFinanceRowActionsParams) {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const handleDelete = useCallback(
    async (row: FinanceRow) => {
      const confirmMsg = isPl
        ? `Czy na pewno chcesz usunąć "${row.title}"?`
        : `Are you sure you want to delete "${row.title}"?`;
      if (!window.confirm(confirmMsg)) return;

      try {
        if (row.kind === 'statements') {
          await Api.delete(`/api/finance-statements/packs/${row.id}`);
          await loadStatements();
        } else if (
          row.kind === 'models' ||
          (row.kind === 'prediction' && (row as FinanceModelRow).predictionType === 'model')
        ) {
          await Api.delete(`/api/financial-modeling/models/${row.id}`);
          await loadModels();
        } else if (
          row.kind === 'prediction' &&
          (row as FinanceModelRow).predictionType === 'budget'
        ) {
          const rawId = getBudgetRawId(row.id);
          await Api.delete(`/api/economics/budgets/${rawId}`);
          await loadBudgets();
        } else if (row.kind === 'analysis' || row.kind === 'investment') {
          try {
            await V8FinanceApi.deleteAnalysis(row.id);
          } catch (error) {
            if (!shouldFallbackToLegacyFinance(error)) {
              throw error;
            }
            await Api.delete(`/api/economics/financial-analyses/${row.id}`);
          }
          await loadAnalyses();
        } else if (row.kind === 'valuation') {
          await Api.delete(`/api/economics/valuations/${row.id}`);
          await loadValuations();
        }
        toast.success(t('finance.toast.deleted', 'Usunięto'));
      } catch (e: any) {
        toast.error(
          e?.response?.data?.error || t('finance.toast.deleteFailed', 'Nie udało się usunąć')
        );
      }
    },
    [isPl, loadStatements, loadModels, loadAnalyses, loadBudgets, loadValuations, getBudgetRawId, t]
  );

  const handleDuplicate = useCallback(
    async (row: FinanceRow) => {
      try {
        const copyTitle = `${row.title} (${isPl ? 'kopia' : 'copy'})`;
        if (row.kind === 'statements') {
          toast.error(
            t('finance.toast.statementDuplicateUnsupported', 'Duplikacja statementu nie jest wspierana')
          );
          return;
        } else if (
          row.kind === 'models' ||
          (row.kind === 'prediction' && (row as FinanceModelRow).predictionType === 'model')
        ) {
          const detail = (await Api.get(`/api/financial-modeling/models/${row.id}`)) as any;
          await Api.post('/api/financial-modeling/models', {
            name: copyTitle,
            startDate: detail.start_date,
            horizonMonths: detail.horizon_months,
            granularity: detail.granularity,
            currency: detail.currency,
            assumptions: detail.assumptions || {},
          });
          await loadModels();
        } else if (
          row.kind === 'prediction' &&
          (row as FinanceModelRow).predictionType === 'budget'
        ) {
          const rawId = getBudgetRawId(row.id);
          const detail = (await Api.get(`/api/economics/budgets/${rawId}`)) as any;
          await Api.post('/api/economics/budgets', {
            title: copyTitle,
            periodStart: detail.periodStart || detail.period_start,
            periodEnd: detail.periodEnd || detail.period_end,
          });
          await loadBudgets();
        } else if (row.kind === 'analysis' || row.kind === 'investment') {
          try {
            await V8FinanceApi.createAnalysis({
              title: copyTitle,
              analysisType: row.kind === 'investment' ? 'investment_case' : 'comprehensive',
              currency: 'PLN',
            });
          } catch (error) {
            if (!shouldFallbackToLegacyFinance(error)) {
              throw error;
            }
            await Api.post('/api/economics/financial-analyses', {
              title: copyTitle,
              analysisType: row.kind === 'investment' ? 'investment_case' : 'comprehensive',
              currency: 'PLN',
            });
          }
          await loadAnalyses();
        } else if (row.kind === 'valuation') {
          const detail = (await Api.get(`/api/economics/valuations/${row.id}`)) as any;
          const v = detail?.valuation || detail;
          await Api.post('/api/economics/valuations', {
            title: copyTitle,
            sourceType: v?.source_type || v?.sourceType || 'manual',
            sourceId: v?.source_id || v?.sourceId || null,
            horizonYears: v?.horizon_years || v?.horizonYears || 5,
            currency: v?.currency || 'PLN',
          });
          await loadValuations();
        }
        toast.success(t('finance.toast.duplicated', 'Zduplikowano'));
      } catch (e: any) {
        toast.error(
          e?.response?.data?.error ||
            t('finance.toast.duplicateFailed', 'Nie udało się zduplikować')
        );
      }
    },
    [isPl, loadModels, loadAnalyses, loadBudgets, loadValuations, getBudgetRawId, t]
  );

  const getRowActions = useCallback(
    (row: FinanceRow): RowAction[] => {
      const common: RowAction[] = [
        {
          id: 'open',
          label: t('common.open', 'Otwórz'),
          icon: Eye,
          onClick: () => handleOpenFull(row),
        },
        ...(row.kind === 'statements'
          ? []
          : [
              {
                id: 'duplicate',
                label: t('common.duplicate', 'Duplikuj'),
                icon: Copy,
                onClick: () => handleDuplicate(row),
              },
            ]),
        ...(row.kind === 'analysis' ||
        row.kind === 'investment' ||
        row.kind === 'models' ||
        row.kind === 'valuation' ||
        (row.kind === 'prediction' && (row as FinanceModelRow).predictionType === 'model')
          ? [
              {
                id: 'export',
                label: t('finance.row.export', 'Eksportuj'),
                icon: Download,
                onClick: () => handleExport(row),
              },
            ]
          : []),
      ];

      const tabSpecific: RowAction[] = [];

      if (row.kind === 'statements') {
        const statementRow = row as FinanceStatementRow;
        tabSpecific.push(
          {
            id: 'createModel',
            label: t('finance.row.createModelFromStatement', 'Utwórz model'),
            icon: TrendingUp,
            variant: 'primary',
            disabled: !statementRow.isWorkable,
            onClick: () => handleCreateModelFromStatement(statementRow),
          },
          {
            id: 'createAnalysis',
            label: t('finance.row.createAnalysisFromStatement', 'Utwórz analizę'),
            icon: Eye,
            disabled: !statementRow.isWorkable,
            onClick: () => handleCreateAnalysisFromStatements(statementRow),
          }
        );
        if (!statementRow.isWorkable) {
          tabSpecific.push({
            id: 'recovery',
            label: t('finance.row.needsRecovery', 'Wymaga recovery'),
            icon: RefreshCw,
            onClick: () => handleOpenFull(statementRow),
          });
        }
        if (statementRow.isWorkable && String(statementRow.rawStatus || '').toLowerCase() !== 'confirmed') {
          tabSpecific.push({
            id: 'confirm',
            label: t('finance.row.confirmStatement', 'Potwierdź'),
            icon: CheckCircle,
            onClick: async () => {
              try {
                await Api.post(`/api/finance-statements/${statementRow.id}/confirm`, {});
                await loadStatements();
                toast.success(t('finance.toast.statementConfirmed', 'Statement potwierdzony'));
              } catch (e: any) {
                toast.error(
                  e?.response?.data?.error ||
                    t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                );
              }
            },
          });
        }
      }

      if (row.kind === 'models') {
        if (row.status !== 'APPROVED') {
          tabSpecific.push({
            id: 'approve',
            label: t('finance.row.approve', 'Zatwierdź'),
            icon: CheckCircle,
            variant: 'primary',
            onClick: async () => {
              try {
                await Api.post(`/api/financial-modeling/models/${row.id}/approve`, {});
                await loadModels();
                toast.success(t('finance.toast.modelApproved', 'Model zatwierdzony'));
              } catch (e: any) {
                toast.error(
                  e?.response?.data?.error ||
                    t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                );
              }
            },
          });
        }
      }

      if (row.kind === 'analysis' || row.kind === 'investment') {
        if (row.status !== 'APPROVED') {
          tabSpecific.push({
            id: 'approve',
            label: t('finance.row.approve', 'Zatwierdź'),
            icon: CheckCircle,
            variant: 'primary',
            onClick: async () => {
              try {
                try {
                  await V8FinanceApi.approveAnalysis(row.id);
                } catch (error) {
                  if (!shouldFallbackToLegacyFinance(error)) {
                    throw error;
                  }
                  await Api.post(`/api/economics/financial-analyses/${row.id}/approve`, {});
                }
                await loadAnalyses();
                toast.success(t('finance.toast.analysisApproved', 'Analiza zatwierdzona'));
              } catch (e: any) {
                toast.error(
                  e?.response?.data?.error ||
                    t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                );
              }
            },
          });
        }
        tabSpecific.push({
          id: 'reanalyze',
          label: t('finance.row.reanalyze', 'Przelicz ponownie'),
          icon: RefreshCw,
          onClick: async () => {
            try {
              try {
                await V8FinanceApi.runAnalysis(row.id);
              } catch (error) {
                if (!shouldFallbackToLegacyFinance(error)) {
                  throw error;
                }
                await Api.post(`/api/economics/financial-analyses/${row.id}/run`, {});
              }
              await loadAnalyses();
              toast.success(t('finance.toast.reanalyzed', 'Analiza przeliczona'));
            } catch (e: any) {
              toast.error(
                e?.response?.data?.error ||
                  t('finance.toast.reanalyzeFailed', 'Nie udało się przeliczyć')
              );
            }
          },
        });
        tabSpecific.push({
          id: 'createValuation',
          label: t('finance.row.createValuation', 'Utwórz wycenę'),
          icon: TrendingUp,
          onClick: () =>
            window.location.assign(
              `/economics?tab=valuation&createFrom=financial_analysis&sourceId=${row.id}`
            ),
        });
      }

      if (row.kind === 'prediction') {
        const pRow = row as FinanceModelRow;
        if (pRow.predictionType === 'budget') {
          tabSpecific.push({
            id: 'generate',
            label: t('finance.row.generateProjections', 'Generuj prognozy'),
            icon: TrendingUp,
            variant: 'primary',
            onClick: async () => {
              try {
                const rawId = getBudgetRawId(row.id);
                const detail = await Api.get(`/api/economics/budgets/${rawId}`);
                const scens = (detail as any)?.scenarios || [];
                for (const sc of scens)
                  await Api.post(`/api/economics/budgets/${rawId}/scenarios/${sc.id}/project`, {});
                await loadBudgetPreviewScenarios(rawId);
                toast.success(t('finance.toast.projected', 'Prognozy wygenerowane'));
              } catch (e: any) {
                toast.error(
                  e?.response?.data?.error ||
                    t('finance.toast.projectionFailed', 'Nie udało się wygenerować')
                );
              }
            },
          });
          if (pRow.status !== 'APPROVED') {
            tabSpecific.push({
              id: 'approve',
              label: t('finance.row.approve', 'Zatwierdź'),
              icon: CheckCircle,
              variant: 'primary',
              onClick: async () => {
                try {
                  const rawId = getBudgetRawId(row.id);
                  await Api.post(`/api/economics/budgets/${rawId}/approve`, {});
                  await loadBudgets();
                  toast.success(t('finance.toast.budgetApproved', 'Budżet zatwierdzony'));
                } catch (e: any) {
                  toast.error(
                    e?.response?.data?.error ||
                      t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                  );
                }
              },
            });
          }
        } else {
          tabSpecific.push({
            id: 'compute',
            label: t('finance.row.compute', 'Przelicz'),
            icon: RefreshCw,
            variant: 'primary',
            onClick: async () => {
              try {
                await computeModelWithFallback(row.id);
                await loadPredictionPreview(row.id);
                toast.success(t('finance.toast.computed', 'Prognoza przeliczona'));
              } catch (e: any) {
                toast.error(
                  e?.response?.data?.error ||
                    t('finance.toast.computeFailed', 'Nie udało się przeliczyć')
                );
              }
            },
          });
        }
      }

      if (row.kind === 'valuation') {
        tabSpecific.push({
          id: 'computeDcf',
          label: t('finance.row.computeDcf', 'Oblicz DCF'),
          icon: RefreshCw,
          variant: 'primary',
          onClick: async () => {
            try {
              await Api.post(`/api/economics/valuations/${row.id}/compute`, {});
              await loadValuations();
              await loadValuationPreviewResults(row.id);
              toast.success(t('finance.toast.valuationComputed', 'Wycena obliczona'));
            } catch (e: any) {
              toast.error(
                e?.response?.data?.error ||
                  t('finance.toast.computeFailed', 'Nie udało się obliczyć')
              );
            }
          },
        });
        if (row.status !== 'APPROVED') {
          tabSpecific.push({
            id: 'approve',
            label: t('finance.row.approve', 'Zatwierdź'),
            icon: CheckCircle,
            onClick: async () => {
              try {
                await Api.post(`/api/economics/valuations/${row.id}/approve`, {});
                await loadValuations();
                toast.success(t('finance.toast.valuationApproved', 'Wycena zatwierdzona'));
              } catch (e: any) {
                toast.error(
                  e?.response?.data?.error ||
                    t('finance.toast.approveFailed', 'Nie udało się zatwierdzić')
                );
              }
            },
          });
        }
        tabSpecific.push({
          id: 'exportPptx',
          label: t('finance.row.exportPptx', 'Eksportuj PPTX'),
          icon: Download,
          onClick: async () => {
            try {
              const result = await Api.post(`/api/economics/valuations/${row.id}/export/pptx`, {
                language: isPl ? 'pl' : 'en',
                theme: 'corporate',
                confidentiality: 'confidential',
              });
              toast.success(t('finance.toast.pptxExported', 'PPTX wygenerowany'));
              const downloadUrl = (result as any)?.downloadUrl;
              if (downloadUrl) window.open(downloadUrl, '_blank');
            } catch (e: any) {
              toast.error(
                e?.response?.data?.error ||
                  t('finance.toast.exportFailed', 'Nie udało się wyeksportować')
              );
            }
          },
        });
      }

      const deleteAction: RowAction = {
        id: 'delete',
        label: t('common.delete', 'Usuń'),
        icon: Trash2,
        variant: 'danger',
        divider: true,
        onClick: () => handleDelete(row),
      };

      return [...tabSpecific, ...common, deleteAction];
    },
    [
      t,
      isPl,
      handleOpenFull,
      handleCreateModelFromStatement,
      handleCreateAnalysisFromStatements,
      handleDelete,
      handleDuplicate,
      loadStatements,
      loadPredictionPreview,
      loadAnalyses,
      loadBudgets,
      loadBudgetPreviewScenarios,
      getBudgetRawId,
      loadValuations,
      loadValuationPreviewResults,
      handleExport,
      loadModels,
    ]
  );

  return { getRowActions, handleDelete, handleDuplicate };
}
