import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Copy, Download, Eye, RefreshCw, Trash2, TrendingUp } from 'lucide-react';

import { Api } from '@/services/api';

import {
  type FinanceRow,
  type FinanceModelRow,
} from '../financeTypes';
import { type RowAction } from '../../shared/RowActionsMenu';

interface UseFinanceRowActionsParams {
  handleOpenFull: (row: FinanceRow) => void;
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

  const handleDelete = useCallback(async (row: FinanceRow) => {
    const confirmMsg = isPl
      ? `Czy na pewno chcesz usunąć "${row.title}"?`
      : `Are you sure you want to delete "${row.title}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      if (row.kind === 'models' || (row.kind === 'prediction' && (row as FinanceModelRow).predictionType === 'model')) {
        await Api.delete(`/api/financial-modeling/models/${row.id}`);
        await loadModels();
      } else if (row.kind === 'prediction' && (row as FinanceModelRow).predictionType === 'budget') {
        const rawId = getBudgetRawId(row.id);
        await Api.delete(`/api/economics/budgets/${rawId}`);
        await loadBudgets();
      } else if (row.kind === 'analysis') {
        await Api.delete(`/api/economics/financial-analyses/${row.id}`);
        await loadAnalyses();
      } else if (row.kind === 'valuation') {
        await Api.delete(`/api/economics/valuations/${row.id}`);
        await loadValuations();
      }
      toast.success(t('finance.toast.deleted', 'Usunięto'));
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t('finance.toast.deleteFailed', 'Nie udało się usunąć'));
    }
  }, [isPl, loadModels, loadAnalyses, loadBudgets, loadValuations, getBudgetRawId, t]);

  const handleDuplicate = useCallback(async (row: FinanceRow) => {
    try {
      const copyTitle = `${row.title} (${isPl ? 'kopia' : 'copy'})`;
      if (row.kind === 'models' || (row.kind === 'prediction' && (row as FinanceModelRow).predictionType === 'model')) {
        const detail = await Api.get(`/api/financial-modeling/models/${row.id}`) as any;
        await Api.post('/api/financial-modeling/models', {
          name: copyTitle, startDate: detail.start_date, horizonMonths: detail.horizon_months,
          granularity: detail.granularity, currency: detail.currency,
          assumptions: detail.assumptions || {},
        });
        await loadModels();
      } else if (row.kind === 'prediction' && (row as FinanceModelRow).predictionType === 'budget') {
        const rawId = getBudgetRawId(row.id);
        const detail = await Api.get(`/api/economics/budgets/${rawId}`) as any;
        await Api.post('/api/economics/budgets', {
          title: copyTitle, periodStart: detail.periodStart || detail.period_start,
          periodEnd: detail.periodEnd || detail.period_end,
        });
        await loadBudgets();
      } else if (row.kind === 'analysis') {
        await Api.post('/api/economics/financial-analyses', {
          title: copyTitle, analysisType: 'comprehensive', currency: 'PLN',
        });
        await loadAnalyses();
      } else if (row.kind === 'valuation') {
        const detail = await Api.get(`/api/economics/valuations/${row.id}`) as any;
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
      toast.error(e?.response?.data?.error || t('finance.toast.duplicateFailed', 'Nie udało się zduplikować'));
    }
  }, [isPl, loadModels, loadAnalyses, loadBudgets, loadValuations, getBudgetRawId, t]);

  const getRowActions = useCallback(
    (row: FinanceRow): RowAction[] => {
      const common: RowAction[] = [
        { id: 'open', label: t('common.open', 'Otwórz'), icon: Eye, onClick: () => handleOpenFull(row) },
        { id: 'duplicate', label: t('common.duplicate', 'Duplikuj'), icon: Copy, onClick: () => handleDuplicate(row) },
        ...(row.kind !== 'valuation'
          ? [{ id: 'export', label: t('finance.row.export', 'Eksportuj'), icon: Download, onClick: () => toast(t('common.comingSoon', 'Coming soon')) }]
          : []),
      ];

      const tabSpecific: RowAction[] = [];

      if (row.kind === 'models') {
        if (row.status !== 'APPROVED') {
          tabSpecific.push({
            id: 'approve', label: t('finance.row.approve', 'Zatwierdź'), icon: CheckCircle, variant: 'primary',
            onClick: () => toast(t('common.comingSoon', 'Coming soon')),
          });
        }
      }

      if (row.kind === 'analysis') {
        if (row.status !== 'APPROVED') {
          tabSpecific.push({
            id: 'approve', label: t('finance.row.approve', 'Zatwierdź'), icon: CheckCircle, variant: 'primary',
            onClick: async () => {
              try {
                await Api.post(`/api/economics/financial-analyses/${row.id}/approve`, {});
                await loadAnalyses();
                toast.success(t('finance.toast.analysisApproved', 'Analiza zatwierdzona'));
              } catch (e: any) {
                toast.error(e?.response?.data?.error || t('finance.toast.approveFailed', 'Nie udało się zatwierdzić'));
              }
            },
          });
        }
        tabSpecific.push({
          id: 'reanalyze', label: t('finance.row.reanalyze', 'Przelicz ponownie'), icon: RefreshCw,
          onClick: async () => {
            try {
              await Api.post(`/api/economics/financial-analyses/${row.id}/run`, {});
              await loadAnalyses();
              toast.success(t('finance.toast.reanalyzed', 'Analiza przeliczona'));
            } catch (e: any) {
              toast.error(e?.response?.data?.error || t('finance.toast.reanalyzeFailed', 'Nie udało się przeliczyć'));
            }
          },
        });
      }

      if (row.kind === 'prediction') {
        const pRow = row as FinanceModelRow;
        if (pRow.predictionType === 'budget') {
          tabSpecific.push({
            id: 'generate', label: t('finance.row.generateProjections', 'Generuj prognozy'), icon: TrendingUp, variant: 'primary',
            onClick: async () => {
              try {
                const rawId = getBudgetRawId(row.id);
                const detail = await Api.get(`/api/economics/budgets/${rawId}`);
                const scens = (detail as any)?.scenarios || [];
                for (const sc of scens) await Api.post(`/api/economics/budgets/${rawId}/scenarios/${sc.id}/project`, {});
                await loadBudgetPreviewScenarios(rawId);
                toast.success(t('finance.toast.projected', 'Prognozy wygenerowane'));
              } catch (e: any) {
                toast.error(e?.response?.data?.error || t('finance.toast.projectionFailed', 'Nie udało się wygenerować'));
              }
            },
          });
          if (pRow.status !== 'APPROVED') {
            tabSpecific.push({
              id: 'approve', label: t('finance.row.approve', 'Zatwierdź'), icon: CheckCircle, variant: 'primary',
              onClick: async () => {
                try {
                  const rawId = getBudgetRawId(row.id);
                  await Api.post(`/api/economics/budgets/${rawId}/approve`, {});
                  await loadBudgets();
                  toast.success(t('finance.toast.budgetApproved', 'Budżet zatwierdzony'));
                } catch (e: any) {
                  toast.error(e?.response?.data?.error || t('finance.toast.approveFailed', 'Nie udało się zatwierdzić'));
                }
              },
            });
          }
        } else {
          tabSpecific.push({
            id: 'compute', label: t('finance.row.compute', 'Przelicz'), icon: RefreshCw, variant: 'primary',
            onClick: async () => {
              try {
                await Api.post(`/api/financial-modeling/models/${row.id}/compute`, {});
                await loadPredictionPreview(row.id);
                toast.success(t('finance.toast.computed', 'Prognoza przeliczona'));
              } catch (e: any) {
                toast.error(e?.response?.data?.error || t('finance.toast.computeFailed', 'Nie udało się przeliczyć'));
              }
            },
          });
        }
      }

      if (row.kind === 'valuation') {
        tabSpecific.push({
          id: 'computeDcf', label: t('finance.row.computeDcf', 'Oblicz DCF'), icon: RefreshCw, variant: 'primary',
          onClick: async () => {
            try {
              await Api.post(`/api/economics/valuations/${row.id}/compute`, {});
              await loadValuations();
              await loadValuationPreviewResults(row.id);
              toast.success(t('finance.toast.valuationComputed', 'Wycena obliczona'));
            } catch (e: any) {
              toast.error(e?.response?.data?.error || t('finance.toast.computeFailed', 'Nie udało się obliczyć'));
            }
          },
        });
        if (row.status !== 'APPROVED') {
          tabSpecific.push({
            id: 'approve', label: t('finance.row.approve', 'Zatwierdź'), icon: CheckCircle,
            onClick: async () => {
              try {
                await Api.post(`/api/economics/valuations/${row.id}/approve`, {});
                await loadValuations();
                toast.success(t('finance.toast.valuationApproved', 'Wycena zatwierdzona'));
              } catch (e: any) {
                toast.error(e?.response?.data?.error || t('finance.toast.approveFailed', 'Nie udało się zatwierdzić'));
              }
            },
          });
        }
        tabSpecific.push({
          id: 'exportPptx', label: t('finance.row.exportPptx', 'Eksportuj PPTX'), icon: Download,
          onClick: async () => {
            try {
              const result = await Api.post(`/api/economics/valuations/${row.id}/export/pptx`, {
                language: isPl ? 'pl' : 'en', theme: 'corporate', confidentiality: 'confidential',
              });
              toast.success(t('finance.toast.pptxExported', 'PPTX wygenerowany'));
              const downloadUrl = (result as any)?.downloadUrl;
              if (downloadUrl) window.open(downloadUrl, '_blank');
            } catch (e: any) {
              toast.error(e?.response?.data?.error || t('finance.toast.exportFailed', 'Nie udało się wyeksportować'));
            }
          },
        });
      }

      const deleteAction: RowAction = {
        id: 'delete', label: t('common.delete', 'Usuń'), icon: Trash2, variant: 'danger', divider: true,
        onClick: () => handleDelete(row),
      };

      return [...tabSpecific, ...common, deleteAction];
    },
    [t, isPl, handleOpenFull, handleDelete, handleDuplicate,
      loadPredictionPreview, loadAnalyses, loadBudgets, loadBudgetPreviewScenarios,
      getBudgetRawId, loadValuations, loadValuationPreviewResults]
  );

  return { getRowActions, handleDelete, handleDuplicate };
}
