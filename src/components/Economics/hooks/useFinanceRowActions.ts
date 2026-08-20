import {
  Archive,
  CheckCircle,
  ChevronRight,
  Copy,
  Download,
  Eye,
  MessageCircle,
  RefreshCw,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useCallback } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  approveCanonicalFinancialAnalysis,
  approveCanonicalValuation,
  approveFinanceModel,
  createRegisteredValuation,
  exportCanonicalLegacyValuationPptx,
  resolveLegacyFinanceArtifact,
  runCanonicalFinancialAnalysis,
} from '@/services/api/financeV2.api';
import {
  shouldFallbackToLegacyFinance,
  V8FinanceApi,
  type V8FinanceModelCreatePayload,
} from '@/services/api/v8/finance';

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

async function approveCanonicalModel(legacyModelId: string) {
  const identity = await resolveLegacyFinanceArtifact('financial_models', legacyModelId);
  if (identity.status !== 'RESOLVED') {
    throw new Error(
      identity.status === 'QUARANTINED'
        ? identity.reason || 'Model identity is quarantined'
        : 'Model has no canonical identity. Run the Finance backfill before approval.'
    );
  }
  return approveFinanceModel({
    modelArtifactId: identity.artifactId,
    idempotencyKey: crypto.randomUUID(),
  });
}

async function createModelWithFallback(body: V8FinanceModelCreatePayload) {
  try {
    return await V8FinanceApi.createModel(body);
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.post('/api/financial-modeling/models', body);
  }
}

async function getModelDetailWithFallback(modelId: string) {
  try {
    const data = await V8FinanceApi.getModel(modelId);
    return data?.model ?? null;
  } catch (error) {
    if (!shouldFallbackToLegacyFinance(error)) {
      throw error;
    }
    return await Api.get(`/api/financial-modeling/models/${modelId}`);
  }
}

interface UseFinanceRowActionsParams {
  handleOpenFull: (row: FinanceRow) => void;
  /** Opens the side preview pane for the row (canon §9.2 "Otwórz podgląd"). */
  handleOpenPreview?: (row: FinanceRow) => void;
  handleExport: (row: FinanceRow) => void;
  handleOpenEntityChat?: (row: FinanceRow) => void;
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
  /**
   * FIN-005: names currently present in the tenant for the given record kind.
   * Used to keep a duplicate's title collision-free — see `uniqueCopyTitle`.
   * Optional so callers that never expose "Duplikuj" need not supply it.
   */
  getExistingTitles?: (kind: FinanceRow['kind']) => string[];
}

/**
 * Build a copy title that does not collide with an existing record.
 *
 * FIN-005 root cause: the staging Finance → Models tab held FOUR rows literally
 * named `DBR77 Staging Finance Model (kopia)`. They were not a database or
 * upsert defect — the old code was
 *
 *   const copyTitle = `${row.title} (${t('finance.preview.copySuffix', 'copy')})`;
 *
 * and every duplicate was taken from the SAME source row, so N clicks on
 * "Duplikuj" produced N byte-identical names. Nothing downstream could tell the
 * copies apart, and the list looked like corrupted data.
 *
 * The first copy keeps the plain `(kopia)` form a user expects; only a genuine
 * collision gets a counter, so the common case stays clean.
 */
export function uniqueCopyTitle(
  baseTitle: string,
  copySuffix: string,
  existingTitles: string[]
): string {
  const taken = new Set(
    existingTitles
      .map((title) =>
        String(title ?? '')
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );
  const base = String(baseTitle ?? '').trim();
  const suffix = String(copySuffix ?? '').trim();
  const first = suffix ? `${base} (${suffix})` : base;
  if (!taken.has(first.toLowerCase())) return first;

  // Cap the search so a pathological list can never spin the UI thread.
  for (let counter = 2; counter <= 999; counter += 1) {
    const candidate = suffix ? `${base} (${suffix} ${counter})` : `${base} ${counter}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return first;
}

export function useFinanceRowActions({
  handleOpenFull,
  handleOpenPreview,
  handleExport,
  handleOpenEntityChat,
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
  getExistingTitles,
}: UseFinanceRowActionsParams) {
  const { t, i18n } = useTranslation();

  const deleteModelWithFallback = useCallback(async (modelId: string) => {
    try {
      await V8FinanceApi.deleteModel(modelId);
    } catch (error) {
      if (!shouldFallbackToLegacyFinance(error)) {
        throw error;
      }
      await Api.delete(`/api/financial-modeling/models/${modelId}`);
    }
  }, []);

  const handleDelete = useCallback(
    async (row: FinanceRow) => {
      const confirmMsg = t(
        'finance.preview.confirmDelete',
        'Are you sure you want to delete "{{title}}"?',
        { title: row.title }
      );
      if (!window.confirm(confirmMsg)) return;

      try {
        if (row.kind === 'statements') {
          await Api.delete(`/api/finance-statements/packs/${row.id}`);
          await loadStatements();
        } else if (
          row.kind === 'models' ||
          (row.kind === 'prediction' && (row as FinanceModelRow).predictionType === 'model')
        ) {
          await deleteModelWithFallback(row.id);
          await loadModels();
        } else if (
          row.kind === 'prediction' &&
          (row as FinanceModelRow).predictionType === 'budget'
        ) {
          const rawId = getBudgetRawId(row.id);
          await Api.delete(`/api/economics/budgets/${rawId}`);
          await loadBudgets();
        } else if (row.kind === 'analysis' || row.kind === 'investment') {
          await V8FinanceApi.deleteAnalysis(row.id);
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
    [
      deleteModelWithFallback,
      t,
      loadStatements,
      loadModels,
      loadAnalyses,
      loadBudgets,
      loadValuations,
      getBudgetRawId,
    ]
  );

  const handleDuplicate = useCallback(
    async (row: FinanceRow) => {
      try {
        const copyTitle = uniqueCopyTitle(
          row.title,
          t('finance.preview.copySuffix', 'copy'),
          getExistingTitles?.(row.kind) ?? []
        );
        if (row.kind === 'statements') {
          toast.error(
            t(
              'finance.toast.statementDuplicateUnsupported',
              'Duplikacja statementu nie jest wspierana'
            )
          );
          return;
        } else if (
          row.kind === 'models' ||
          (row.kind === 'prediction' && (row as FinanceModelRow).predictionType === 'model')
        ) {
          const detail = (await getModelDetailWithFallback(row.id)) as any;
          await createModelWithFallback({
            name: copyTitle,
            startDate: detail.start_date,
            horizonMonths: detail.horizon_months,
            granularity: detail.granularity,
            currency: detail.currency,
            assumptions: detail.assumptions || detail.assumptions_json || {},
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
          // FIN-005: was hardcoded 'PLN', so duplicating a EUR analysis minted a
          // PLN copy and broke the one-currency rule inside the same tenant.
          // Inherit from the source row, as the `valuation` branch below does.
          const sourceCurrency = String((row as { currency?: string }).currency || '').trim();
          const analysisPayload = {
            title: copyTitle,
            analysisType: (row.kind === 'investment' ? 'investment_case' : 'comprehensive') as
              | 'investment_case'
              | 'comprehensive',
            currency: sourceCurrency || 'PLN',
          };
          await V8FinanceApi.createAnalysis(analysisPayload);
          await loadAnalyses();
        } else if (row.kind === 'valuation') {
          const detail = (await Api.get(`/api/economics/valuations/${row.id}`)) as any;
          const v = detail?.valuation || detail;
          await createRegisteredValuation({
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
    [t, loadModels, loadAnalyses, loadBudgets, loadValuations, getBudgetRawId, getExistingTitles]
  );

  const getRowActions = useCallback(
    (row: FinanceRow): RowAction[] => {
      // Contextual extras (chat / duplicate / export) — sit ABOVE the fixed manifest.
      const contextExtras: RowAction[] = [
        ...(handleOpenEntityChat
          ? [
              {
                id: 'chat',
                label: t('common.chatAbout', 'Chat'),
                icon: MessageCircle,
                onClick: () => handleOpenEntityChat(row),
              },
            ]
          : []),
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

      // Fixed Bottom Manifest (canon §9.2): Otwórz podgląd → Archiwizuj.
      // Finance rows have no due_date, so the Delay slot is correctly omitted.
      // 'edit' was removed from this manifest 2026-07-26 (TYPE 11 fix): it called
      // the exact same handler as onOpenFull/header "Otwórz" — a literal duplicate,
      // not a distinct "enter edit mode" action. See useFinanceRowActions ^ handleOpenFull.
      const manifest: RowAction[] = [
        {
          id: 'preview',
          label: t('common.openPreview', 'Otwórz podgląd'),
          icon: ChevronRight,
          divider: true,
          onClick: () => (handleOpenPreview ?? handleOpenFull)(row),
        },
        {
          id: 'archive',
          label: t('common.archive', 'Archiwizuj'),
          icon: Archive,
          disabled: true,
          description: t('common.comingSoonBackend', 'Wkrótce (backend)'),
          onClick: () => undefined,
        },
      ];

      const common: RowAction[] = [...contextExtras, ...manifest];

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
        if (
          statementRow.isWorkable &&
          String(statementRow.rawStatus || '').toLowerCase() !== 'confirmed'
        ) {
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
                await approveCanonicalModel(row.id);
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
                await approveCanonicalFinancialAnalysis(row.id);
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
              await runCanonicalFinancialAnalysis(row.id);
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
                  t('finance.toast.computeDcfFailed', 'Nie udało się obliczyć DCF')
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
                await approveCanonicalValuation(row.id);
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
              const result = await exportCanonicalLegacyValuationPptx(row.id, {
                language: i18n.language?.startsWith('pl') ? 'pl' : 'en',
                theme: 'corporate',
                confidentiality: 'confidential',
              });
              toast.success(t('finance.toast.pptxExported', 'PPTX wygenerowany'));
              const downloadUrl = result.downloadUrl;
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
      i18n,
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
