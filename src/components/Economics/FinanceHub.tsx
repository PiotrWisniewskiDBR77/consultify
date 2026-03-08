/**
 * FinanceHub (Economics route)
 *
 * KANON v3 (Golden Standard Table+Cards+Preview):
 * - 5 main functional tabs: Modele / Analiza / Predykcja / Wycena przedsiębiorstw / Analiza inwestycyjna
 * - Table + Preview layout: FilterableTable + TableWithPreviewLayout (gap-1.5, preview width clamp, no divider)
 * - Grid/Cards alternative: GridView SSOT with finance type accents
 * - Table canvas padding: pl-4 pr-1.5 pt-3 pb-4
 * - Preview footer zones: AI hints → divider → relations (2 rows) → divider → actions
 * - Topbar right cluster: AI → Primary CTA → View → Filters (flush right)
 * - Command Row: status counters as pills h-9 (one line, swap in place)
 * - Per-tab row actions (kebab ⋮ triage)
 * - Per-tab contextual AI hints in preview
 * - i18n PL/EN via useTranslation
 *
 * SSOT references:
 * - docs/product/FINANCIAL_ANALYSIS_V3.md (5 tabs / domain)
 * - docs/product/UI_UX_GOLDEN_STANDARD_V3_AGENT_PROCEDURE.md
 * - docs/ui-standards/03-modules/golden-standard-table-cards-preview-v3.md
 */

import { BarChart3, Calculator, Plus, Sparkles, Target, TrendingUp } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { BudgetWorkspace } from '../Benefits/BudgetWorkspace';
import { FinancialAnalysisWorkspace } from '../Benefits/FinancialAnalysisWorkspace';
import { ValuationWorkspace } from '../Benefits/ValuationWorkspace';
import { ExportToOutputDialog } from '../Finance/ExportToOutputDialog';
import { FinancialModelWorkspace } from '../Finance/FinancialModelWorkspace';
import { FinancialStatementImportWizard } from '../Finance/FinancialStatementImportWizard';
import {
  FilterableTable,
  FilterChip,
  type GridItem,
  GridView,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { useFinancePreview } from './FinancePreviewPanel';
import {
  CANVAS_PADDING,
  type FinanceAnalysisRow,
  type FinanceKind,
  type FinanceModelRow,
  type FinanceRow,
  type FinanceValuationRow,
  getTypeCode,
  KIND_ICONS,
  statusToItemStatus,
  statusToProgress,
} from './financeTypes';
import { useFinanceData } from './hooks/useFinanceData';
import { useFinanceRowActions } from './hooks/useFinanceRowActions';
import { useFinanceSelection } from './hooks/useFinanceSelection';
import { CreateAnalysisModal } from './modals/CreateAnalysisModal';
import { CreateBudgetModal } from './modals/CreateBudgetModal';
import { CreateModelModal } from './modals/CreateModelModal';
import { CreateValuationModal } from './modals/CreateValuationModal';

function isInvestmentAnalysisType(value: unknown): boolean {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  return (
    normalized === 'financial' ||
    normalized === 'investment_case' ||
    normalized === 'investment' ||
    normalized === 'capex' ||
    normalized.includes('investment') ||
    normalized.includes('capex')
  );
}

export const FinanceHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // ---- View state ----
  const [activeTab, setActiveTab] = useState<ModuleTab>(
    (searchParams.get('tab') as ModuleTab) || 'models'
  );
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<FinanceRow | null>(null);

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportTarget, setExportTarget] = useState<{
    id: string;
    title: string;
    sourceType: 'financial_analysis' | 'financial_model' | 'valuation';
  } | null>(null);

  // ---- Modal visibility ----
  const [showCreateModelModal, setShowCreateModelModal] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showAnalysisCreateModal, setShowAnalysisCreateModal] = useState(false);
  const [showPredictionCreateModal, setShowPredictionCreateModal] = useState(false);
  const [showValuationCreateModal, setShowValuationCreateModal] = useState(false);
  const [valuationInitialSource, setValuationInitialSource] = useState<{
    type?: 'financial_model' | 'budget' | 'manual';
    id?: string;
  }>({});

  // ---- Extracted hooks ----
  const {
    models,
    analyses,
    valuations,
    budgets,
    loadingTab,
    loadModels,
    loadAnalyses,
    loadValuations,
    loadBudgets,
    rowsForActiveTab,
    filteredRows,
    statusCounts,
  } = useFinanceData(activeTab, searchQuery, activeFilters);

  const {
    selectedId,
    selectedItem,
    predictionValidations,
    analysisPreviewRatios,
    budgetPreviewScenarios,
    valuationPreviewResults,
    valuationPreviewDetail,
    getBudgetRawId,
    loadPredictionPreview,
    loadBudgetPreviewScenarios,
    loadAnalysisPreviewRatios,
    loadValuationPreviewResults,
    onSelectRow,
    deselectRow,
  } = useFinanceSelection(activeTab);

  // ---- Document management ----
  const handleOpenFull = useCallback((row: FinanceRow) => {
    const doc: OpenDocument = {
      id: row.id,
      type: 'report',
      subType: 'finance',
      name: row.title,
      status: statusToItemStatus(row.status),
    };
    setOpenDocuments((prev) => (prev.some((d) => d.id === doc.id) ? prev : [...prev, doc]));
    setActiveDocumentId(row.id);
    setActiveDocument(row);
  }, []);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
        setActiveDocument(null);
      }
    },
    [activeDocumentId]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
    setActiveDocument(null);
    const kind: FinanceKind =
      activeTab === 'models'
        ? 'models'
        : activeTab === 'analysis'
          ? 'analysis'
          : activeTab === 'investment'
            ? 'investment'
          : activeTab === 'prediction'
            ? 'prediction'
            : 'valuation';
    if (kind === 'analysis' || kind === 'investment') loadAnalyses().catch(() => {});
    if (kind === 'models') loadModels().catch(() => {});
    if (kind === 'prediction') {
      loadModels().catch(() => {});
      loadBudgets().catch(() => {});
    }
    if (kind === 'valuation') loadValuations().catch(() => {});
  }, [activeTab, loadAnalyses, loadModels, loadBudgets, loadValuations]);

  const handleRemoveFilter = useCallback(
    (id: string) => setActiveFilters((prev) => prev.filter((f) => f.id !== id)),
    []
  );
  const handleClearFilters = useCallback(() => setActiveFilters([]), []);

  const handleModelChanged = useCallback(async () => {
    await loadModels();
  }, [loadModels]);
  const handleAnalysisChanged = useCallback(async () => {
    await loadAnalyses();
  }, [loadAnalyses]);
  const handleBudgetChanged = useCallback(async () => {
    await loadBudgets();
  }, [loadBudgets]);
  const handleValuationChanged = useCallback(async () => {
    await loadValuations();
  }, [loadValuations]);

  const handleExport = useCallback((row: FinanceRow) => {
    const sourceType =
      row.kind === 'analysis' || row.kind === 'investment'
        ? 'financial_analysis'
        : row.kind === 'valuation'
          ? 'valuation'
          : 'financial_model';
    setExportTarget({ id: row.id, title: row.title, sourceType });
    setExportDialogOpen(true);
  }, []);

  // ---- Row actions ----
  const { getRowActions } = useFinanceRowActions({
    handleOpenFull,
    handleExport,
    loadModels,
    loadAnalyses,
    loadBudgets,
    loadValuations,
    loadPredictionPreview,
    loadBudgetPreviewScenarios,
    loadValuationPreviewResults,
    getBudgetRawId,
  });

  // ---- Preview ----
  const { renderPreviewBody, renderPreviewFooter } = useFinancePreview({
    predictionValidations,
    analysisPreviewRatios,
    budgetPreviewScenarios,
    valuationPreviewResults,
    valuationPreviewDetail,
    handleOpenFull,
    handleExport,
    loadModels,
    loadAnalyses,
    loadAnalysisPreviewRatios,
    loadBudgets,
    loadBudgetPreviewScenarios,
    loadPredictionPreview,
    loadValuations,
    loadValuationPreviewResults,
    getBudgetRawId,
  });

  // ---- URL param handling for cross-module deep links ----
  useEffect(() => {
    const tab = searchParams.get('tab');
    const createFrom = searchParams.get('createFrom') as 'financial_model' | 'budget' | null;
    const sourceId = searchParams.get('sourceId');

    if (tab && ['models', 'analysis', 'prediction', 'valuation', 'investment'].includes(tab)) {
      setActiveTab(tab as ModuleTab);
    }

    if (createFrom && tab === 'valuation') {
      setValuationInitialSource({ type: createFrom, id: sourceId || undefined });
      setShowValuationCreateModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // ---- Tabs ----
  const tabs = useMemo(
    () => [
      {
        id: 'models' as ModuleTab,
        label: t('finance.tabs.models', 'Modele'),
        icon: <Calculator size={16} />,
        count: models.length,
      },
      {
        id: 'analysis' as ModuleTab,
        label: t('finance.tabs.analysis', 'Analiza'),
        icon: <BarChart3 size={16} />,
        count: analyses.length,
      },
      {
        id: 'prediction' as ModuleTab,
        label: t('finance.tabs.prediction', 'Predykcja'),
        icon: <TrendingUp size={16} />,
        count: models.length + budgets.length,
      },
      {
        id: 'valuation' as ModuleTab,
        label: t('finance.tabs.valuation', 'Wycena przedsiębiorstw'),
        icon: <Target size={16} />,
        count: valuations.length,
      },
      {
        id: 'investment' as ModuleTab,
        label: t('finance.tabs.investment', 'Analiza inwestycyjna'),
        icon: <Target size={16} />,
        count: analyses.filter((row: any) =>
          isInvestmentAnalysisType(row.analysisType || row.analysis_type)
        ).length,
      },
    ],
    [t, models.length, analyses, valuations.length, budgets.length]
  );

  // ---- Per-tab columns ----
  const statusFilterOptions = useMemo(
    () => [
      { value: 'DRAFT', label: t('common.status.draft', 'Draft'), color: 'bg-slate-400' },
      { value: 'REVIEW', label: t('common.status.review', 'In Review'), color: 'bg-amber-400' },
      {
        value: 'APPROVED',
        label: t('common.status.approved', 'Approved'),
        color: 'bg-emerald-400',
      },
    ],
    [t]
  );

  const baseTypeCol: TableColumn = useMemo(
    () => ({
      id: 'type',
      label: t('common.type', 'Type'),
      width: '80px',
      render: (row: FinanceRow) => (
        <div className="flex items-center gap-2">
          {KIND_ICONS[row.kind]}
          <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-300">
            {getTypeCode(row.kind)}
          </span>
        </div>
      ),
    }),
    [t]
  );

  const baseTitleCol: TableColumn = useMemo(
    () => ({
      id: 'title',
      label: t('common.name', 'Name'),
      render: (row: FinanceRow) => (
        <span className="block text-sm text-slate-900 dark:text-white font-medium truncate">
          {row.title}
        </span>
      ),
    }),
    [t]
  );

  const baseStatusCol: TableColumn = useMemo(
    () => ({
      id: 'status',
      label: t('common.status', 'Status'),
      width: '140px',
      filterable: true,
      filterOptions: statusFilterOptions,
    }),
    [t, statusFilterOptions]
  );

  const baseUpdatedCol: TableColumn = useMemo(
    () => ({
      id: 'updatedAt',
      label: t('common.updated', 'Updated'),
      width: '120px',
      sortable: true,
    }),
    [t]
  );

  const columnsForActiveTab: TableColumn[] = useMemo(() => {
    if (activeTab === 'models') {
      return [
        baseTypeCol,
        baseTitleCol,
        {
          id: 'scenario',
          label: t('finance.columns.scenario', 'Scenario'),
          width: '120px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.scenario}</span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'horizon',
          label: t('finance.columns.horizon', 'Horizon'),
          width: '100px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {row.horizonMonths} {t('finance.units.mo', 'mo')}
              </span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'currency',
          label: t('common.currency', 'Currency'),
          width: '90px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.currency}</span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        baseStatusCol,
        baseUpdatedCol,
      ];
    }
    if (activeTab === 'analysis' || activeTab === 'investment') {
      return [
        baseTypeCol,
        baseTitleCol,
        {
          id: 'analysisType',
          label: t('finance.columns.analysisType', 'Type'),
          width: '140px',
          render: (row: FinanceRow) =>
            row.kind === 'analysis' || row.kind === 'investment' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200 capitalize">
                {row.analysisType}
              </span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'periodCount',
          label: t('finance.columns.periods', 'Periods'),
          width: '100px',
          render: (row: FinanceRow) =>
            row.kind === 'analysis' || row.kind === 'investment' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.periodCount}</span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'currency',
          label: t('common.currency', 'Currency'),
          width: '90px',
          render: (row: FinanceRow) =>
            row.kind === 'analysis' || row.kind === 'investment' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.currency}</span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        baseStatusCol,
        baseUpdatedCol,
      ];
    }
    if (activeTab === 'prediction') {
      return [
        baseTypeCol,
        {
          id: 'predictionSubtype',
          label: t('finance.columns.subtype', 'Subtype'),
          width: '130px',
          render: (row: FinanceRow) => {
            if (row.kind !== 'prediction') return <span className="text-sm text-slate-500">—</span>;
            const pRow = row as FinanceModelRow;
            const isBudget = pRow.predictionType === 'budget';
            return (
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${isBudget ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}
              >
                {isBudget
                  ? t('finance.prediction.budget', 'Budżet')
                  : t('finance.prediction.model', 'Model')}
              </span>
            );
          },
        },
        baseTitleCol,
        {
          id: 'scenario',
          label: t('finance.columns.scenario', 'Scenario'),
          width: '120px',
          render: (row: FinanceRow) =>
            row.kind === 'prediction' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {(row as FinanceModelRow).scenario}
              </span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'horizon',
          label: t('finance.columns.horizon', 'Horizon'),
          width: '120px',
          render: (row: FinanceRow) => {
            if (row.kind !== 'prediction') return <span className="text-sm text-slate-500">—</span>;
            const pRow = row as FinanceModelRow;
            if (pRow.predictionType === 'budget')
              return (
                <span className="text-sm text-slate-700 dark:text-slate-200">
                  {pRow.periodStart && pRow.periodEnd
                    ? `${pRow.periodStart} → ${pRow.periodEnd}`
                    : '—'}
                </span>
              );
            return (
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {pRow.horizonMonths} {t('finance.units.mo', 'mo')}
              </span>
            );
          },
        },
        baseStatusCol,
        baseUpdatedCol,
      ];
    }
    return [
      baseTypeCol,
      baseTitleCol,
      {
        id: 'sourceType',
        label: t('finance.columns.source', 'Source'),
        width: '120px',
        render: (row: FinanceRow) =>
          row.kind === 'valuation' ? (
            <span className="text-sm text-slate-700 dark:text-slate-200 capitalize">
              {row.sourceType}
            </span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
          ),
      },
      {
        id: 'method',
        label: t('finance.columns.method', 'Method'),
        width: '100px',
        render: (row: FinanceRow) =>
          row.kind === 'valuation' ? (
            <span className="text-sm text-slate-700 dark:text-slate-200">{row.method}</span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
          ),
      },
      {
        id: 'horizonYears',
        label: t('finance.columns.horizonYears', 'Horizon'),
        width: '100px',
        render: (row: FinanceRow) =>
          row.kind === 'valuation' ? (
            <span className="text-sm text-slate-700 dark:text-slate-200">
              {row.horizonYears} {t('finance.units.yr', 'yr')}
            </span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
          ),
      },
      baseStatusCol,
      baseUpdatedCol,
    ];
  }, [activeTab, baseTypeCol, baseTitleCol, baseStatusCol, baseUpdatedCol, t]);

  // ---- Grid items ----
  const gridItems: GridItem[] = useMemo(
    () =>
      filteredRows.map((row) => ({
        id: row.id,
        name: row.title,
        type: getTypeCode(row.kind),
        typeColor: row.kind,
        status: row.status,
        progress: statusToProgress(row.status),
        updatedAt: row.updatedAt,
        brief:
          row.kind === 'models'
            ? `${(row as FinanceModelRow).scenario} • ${(row as FinanceModelRow).currency} • ${(row as FinanceModelRow).horizonMonths} ${isPl ? 'mies.' : 'mo'}`
            : row.kind === 'prediction'
              ? (row as FinanceModelRow).predictionType === 'budget'
                ? `${isPl ? 'Budżet' : 'Budget'} • ${(row as FinanceModelRow).periodStart || ''} → ${(row as FinanceModelRow).periodEnd || ''}`
                : `${(row as FinanceModelRow).scenario} • ${(row as FinanceModelRow).currency} • ${(row as FinanceModelRow).horizonMonths} ${isPl ? 'mies.' : 'mo'}`
              : row.kind === 'analysis' || row.kind === 'investment'
                ? `${(row as FinanceAnalysisRow).analysisType} • ${(row as FinanceAnalysisRow).currency} • ${(row as FinanceAnalysisRow).periodCount} ${isPl ? 'okr.' : 'per.'}`
                : `${(row as FinanceValuationRow).method} • ${(row as FinanceValuationRow).currency} • ${(row as FinanceValuationRow).horizonYears} ${isPl ? 'lat' : 'yr'}`,
      })),
    [filteredRows, isPl]
  );

  // ---- Primary CTA ----
  const primaryCta = useMemo(() => {
    const labels: Record<FinanceKind | 'investment', string> = {
      models: t('finance.cta.newModel', '+ Nowy model'),
      analysis: t('finance.cta.newAnalysis', '+ Nowa analiza'),
      prediction: t('finance.cta.newScenario', '+ Nowy scenariusz'),
      valuation: t('finance.cta.newValuation', '+ Nowa wycena'),
      investment: t('finance.cta.newInvestment', '+ Nowy case inwestycyjny'),
    };
    const currentKind = (activeTab === 'investment' ? 'investment' : activeTab) as
      | FinanceKind
      | 'investment';
    return (
      <button
        onClick={() => {
          if (currentKind === 'models') setShowCreateModelModal(true);
          else if (currentKind === 'analysis' || currentKind === 'investment')
            setShowAnalysisCreateModal(true);
          else if (currentKind === 'prediction') setShowPredictionCreateModal(true);
          else if (currentKind === 'valuation') {
            setValuationInitialSource({});
            setShowValuationCreateModal(true);
          }
        }}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-primary-600 text-white hover:bg-primary-700 transition-colors duration-150 active:scale-[0.98]"
      >
        <Plus size={16} />
        <span>{labels[currentKind] || labels.models}</span>
      </button>
    );
  }, [activeTab, t]);

  const rightControls = useMemo(() => {
    if (activeTab === 'models') {
      return (
        <button
          onClick={() => setShowImportWizard(true)}
          className="inline-flex items-center h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors duration-150 active:scale-[0.98]"
        >
          {t('finance.cta.importPdf', 'Import PDF')}
        </button>
      );
    }

    if (activeTab === 'investment') {
      return (
        <div className="inline-flex items-center h-9 px-4 rounded-full text-sm font-medium border border-amber-200/70 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300">
          {t('finance.investment.meta', 'Investment cases: NPV • IRR • Payback • ROI')}
        </div>
      );
    }

    return null;
  }, [activeTab, t]);

  const aiControl = useMemo(
    () => (
      <button
        onClick={() => navigate('/chat?context=finance')}
        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/15 transition-colors duration-150"
      >
        <Sparkles size={14} />
        <span>AI</span>
      </button>
    ),
    [navigate]
  );

  // ---- Command Row ----
  const commandRowContent = useMemo(() => {
    const total = rowsForActiveTab.length;
    const chips: Array<{
      id: 'all' | 'DRAFT' | 'REVIEW' | 'APPROVED';
      label: string;
      count: number;
      active: boolean;
    }> = [
      {
        id: 'all',
        label: t('finance.counters.all', 'Wszystkie'),
        count: total,
        active: !activeFilters.some((f) => f.column === 'status'),
      },
      {
        id: 'DRAFT',
        label: t('finance.counters.draft', 'Draft'),
        count: statusCounts.DRAFT,
        active: activeFilters.some((f) => f.column === 'status' && f.value === 'DRAFT'),
      },
      {
        id: 'REVIEW',
        label: t('finance.counters.review', 'Review'),
        count: statusCounts.REVIEW,
        active: activeFilters.some((f) => f.column === 'status' && f.value === 'REVIEW'),
      },
      {
        id: 'APPROVED',
        label: t('finance.counters.approved', 'Approved'),
        count: statusCounts.APPROVED,
        active: activeFilters.some((f) => f.column === 'status' && f.value === 'APPROVED'),
      },
    ];
    return (
      <div className="flex items-center gap-2">
        {chips.map((chip) => (
          <button
            key={chip.id}
            onClick={() => {
              if (chip.id === 'all') {
                setActiveFilters((prev) => prev.filter((f) => f.column !== 'status'));
                return;
              }
              const statusValue = chip.id;
              if (chip.active) {
                setActiveFilters((prev) =>
                  prev.filter((f) => !(f.column === 'status' && f.value === statusValue))
                );
                return;
              }
              setActiveFilters((prev) => [
                ...prev.filter((f) => f.column !== 'status'),
                {
                  id: `status-${statusValue}`,
                  column: 'status',
                  value: statusValue,
                  label: chip.label,
                },
              ]);
            }}
            className={`h-8 inline-flex items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium border transition-colors whitespace-nowrap ${
              chip.active
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-200 border-purple-500/40'
                : 'bg-slate-50 dark:bg-navy-950/40 text-slate-600 dark:text-slate-400 border-slate-200/70 dark:border-white/[0.06] hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
            }`}
          >
            <span>{chip.label}</span>
            <span
              className={`px-1.5 py-0.5 text-[10px] rounded-full font-semibold tabular-nums leading-none ${
                chip.active
                  ? 'bg-purple-500/30 text-purple-700 dark:text-purple-200'
                  : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              {chip.count}
            </span>
          </button>
        ))}
      </div>
    );
  }, [rowsForActiveTab.length, statusCounts, activeFilters, t]);

  const emptyMessage = useMemo(() => {
    const messages: Record<FinanceKind | 'investment', string> = {
      models: t('finance.empty.models', 'Brak modeli. Dodaj pierwszy model finansowy.'),
      analysis: t('finance.empty.analysis', 'Brak analiz. Utwórz pierwszą analizę.'),
      prediction: t('finance.empty.prediction', 'Brak danych do predykcji. Najpierw utwórz model.'),
      valuation: t('finance.empty.valuation', 'Brak wycen. Utwórz pierwszą wycenę.'),
      investment: t(
        'finance.empty.investment',
        'Brak case studies inwestycyjnych. Utwórz pierwszą analizę inwestycyjną.'
      ),
    };
    const currentKind = (activeTab === 'investment' ? 'investment' : activeTab) as
      | FinanceKind
      | 'investment';
    return messages[currentKind] || messages.models;
  }, [activeTab, t]);

  // ---- Table + Preview ----
  const tableWithPreview = useMemo(
    () => (
      <TableWithPreviewLayout
        selectedId={selectedId}
        selectedItem={selectedItem}
        onSelect={(id) => {
          if (!id) {
            deselectRow();
            return;
          }
          const row = filteredRows.find((r) => r.id === id) || null;
          if (row) onSelectRow(row);
        }}
        onOpenFull={(id) => {
          const row = filteredRows.find((r) => r.id === id);
          if (row) handleOpenFull(row);
        }}
        renderPreview={renderPreviewBody}
        renderPreviewFooter={renderPreviewFooter}
        itemIds={filteredRows.map((r) => r.id)}
      >
        <FilterableTable
          columns={columnsForActiveTab}
          data={filteredRows as any}
          density="compact"
          canvasClassName={CANVAS_PADDING}
          selectedRowId={selectedId}
          onRowClick={(row) => onSelectRow(row as any)}
          onRowDoubleClick={(row) => handleOpenFull(row as any)}
          getRowActions={(row) => getRowActions(row as any)}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage={emptyMessage}
          enableColumnSettings
        />
      </TableWithPreviewLayout>
    ),
    [
      selectedId,
      selectedItem,
      filteredRows,
      columnsForActiveTab,
      activeFilters,
      emptyMessage,
      onSelectRow,
      deselectRow,
      handleOpenFull,
      renderPreviewBody,
      renderPreviewFooter,
      getRowActions,
    ]
  );

  const gridView = useMemo(
    () => (
      <GridView
        items={gridItems}
        selectedItemId={selectedId}
        onItemClick={(item) => {
          const row = filteredRows.find((r) => r.id === item.id);
          if (row) onSelectRow(row);
        }}
        onItemAction={(action, item) => {
          const row = filteredRows.find((r) => r.id === item.id);
          if (!row) return;
          const actionObj = getRowActions(row).find((a) => a.id === action);
          actionObj?.onClick?.();
        }}
        emptyMessage={emptyMessage}
      />
    ),
    [gridItems, selectedId, filteredRows, emptyMessage, onSelectRow, getRowActions]
  );

  // ---- Full view ----
  const fullView = useMemo(() => {
    if (!activeDocumentId || !activeDocument) return null;
    const code = getTypeCode(activeDocument.kind);
    const activeModelRow = activeDocument as FinanceModelRow;
    const isBudgetPrediction =
      activeDocument.kind === 'prediction' && activeModelRow.predictionType === 'budget';
    const isModelWorkspace =
      activeDocument.kind === 'models' ||
      (activeDocument.kind === 'prediction' && activeModelRow.predictionType === 'model');
    const openAnalysis =
      activeDocument.kind === 'analysis' || activeDocument.kind === 'investment';
    const openValuation = activeDocument.kind === 'valuation';
    const needsFullHeight = isModelWorkspace || openAnalysis || isBudgetPrediction || openValuation;
    return (
      <div className="p-4 lg:p-6">
        <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200/70 dark:border-white/[0.06] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200/70 dark:border-white/[0.06] flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {code}
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {activeDocument.title}
              </div>
            </div>
            <button
              className="h-9 px-4 rounded-full border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
              onClick={handleShowList}
            >
              {t('common.backToList', 'Wróć do listy')}
            </button>
          </div>
          <div className={needsFullHeight ? 'h-[72vh] min-h-[620px] overflow-auto' : 'p-4'}>
            {isBudgetPrediction ? (
              <BudgetWorkspace
                initialBudgetId={getBudgetRawId(activeDocument.id)}
                hideSidebar
                onBudgetChanged={handleBudgetChanged}
              />
            ) : isModelWorkspace ? (
              <FinancialModelWorkspace
                initialModelId={activeDocument.id}
                hideSidebar
                onModelChanged={handleModelChanged}
              />
            ) : openAnalysis ? (
              <FinancialAnalysisWorkspace
                initialAnalysisId={activeDocument.id}
                hideSidebar
                onAnalysisChanged={handleAnalysisChanged}
              />
            ) : openValuation ? (
              <ValuationWorkspace
                initialValuationId={activeDocument.id}
                hideSidebar
                onValuationChanged={handleValuationChanged}
              />
            ) : (
              <pre className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
                {JSON.stringify(activeDocument, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    );
  }, [
    activeDocumentId,
    activeDocument,
    handleModelChanged,
    handleAnalysisChanged,
    handleBudgetChanged,
    handleValuationChanged,
    getBudgetRawId,
    t,
    handleShowList,
  ]);

  const content = useMemo(() => {
    if (loadingTab)
      return (
        <div className="flex items-center justify-center h-full py-24">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('common.loading', 'Loading…')}
          </div>
        </div>
      );
    if (!activeDocumentId && activeTab === 'investment' && filteredRows.length === 0)
      return (
        <div className="flex items-center justify-center h-full p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-slate-200/70 dark:border-white/[0.08] bg-white/80 dark:bg-white/[0.04] p-6">
            <div className="flex items-start gap-4">
              <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
                <Target size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-lg font-semibold text-slate-900 dark:text-white">
                  {t('finance.investment.emptyTitle', 'Investment analysis workspace')}
                </div>
                <div className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {t(
                    'finance.investment.emptyBody',
                    'Use this tab for initiative-level investment cases and go/no-go decisions based on NPV, IRR, payback, and ROI.'
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['NPV', 'IRR', 'Payback', 'ROI'].map((metric) => (
                    <span
                      key={metric}
                      className="inline-flex items-center rounded-full bg-slate-100 dark:bg-white/[0.06] px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-200"
                    >
                      {metric}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {t(
                    'finance.investment.emptyHint',
                    'Create a dedicated investment case with NPV, IRR, payback, and ROI metrics from this tab.'
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    if (activeDocumentId && activeDocument) return fullView;
    if (viewMode === 'grid') return gridView;
    return tableWithPreview;
  }, [
    loadingTab,
    t,
    activeDocumentId,
    activeDocument,
    fullView,
    viewMode,
    gridView,
    tableWithPreview,
  ]);

  // ---- Render ----
  return (
    <>
      <ModuleHub
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={(id) => {
          setActiveDocumentId(id);
          const row = rowsForActiveTab.find((r) => r.id === id) || null;
          setActiveDocument(row);
        }}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        availableViewModes={['table', 'grid']}
        primaryCta={primaryCta}
        aiControl={aiControl}
        commandRowContent={commandRowContent}
        rightControls={rightControls}
      >
        {content}
      </ModuleHub>

      {showCreateModelModal && (
        <CreateModelModal
          onClose={() => setShowCreateModelModal(false)}
          onCreated={async (row) => {
            await loadModels();
            setShowCreateModelModal(false);
            handleOpenFull(row);
          }}
        />
      )}

      {showImportWizard && (
        <div className="fixed inset-0 z-50 bg-black/40">
          <FinancialStatementImportWizard
            onClose={() => setShowImportWizard(false)}
            onComplete={async () => {
              setShowImportWizard(false);
              await loadModels();
              toast.success(t('finance.importWizard.completed', 'Import zakończony'));
            }}
          />
        </div>
      )}

      {showAnalysisCreateModal && (
        <CreateAnalysisModal
          defaultAnalysisType={activeTab === 'investment' ? 'investment_case' : 'comprehensive'}
          onClose={() => {
            setShowAnalysisCreateModal(false);
          }}
          onCreated={async (row) => {
            await loadAnalyses();
            setShowAnalysisCreateModal(false);
            handleOpenFull(row);
          }}
        />
      )}

      {showPredictionCreateModal && (
        <CreateBudgetModal
          onClose={() => setShowPredictionCreateModal(false)}
          onCreated={async (row) => {
            await loadBudgets();
            setShowPredictionCreateModal(false);
            handleOpenFull(row);
          }}
        />
      )}

      {showValuationCreateModal && (
        <CreateValuationModal
          initialSourceType={valuationInitialSource.type}
          initialSourceId={valuationInitialSource.id}
          onClose={() => {
            setShowValuationCreateModal(false);
            setValuationInitialSource({});
          }}
          onCreated={async (row) => {
            await loadValuations();
            setShowValuationCreateModal(false);
            setValuationInitialSource({});
            handleOpenFull(row);
          }}
        />
      )}

      {exportDialogOpen && exportTarget && (
        <ExportToOutputDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          analysisId={exportTarget.id}
          analysisTitle={exportTarget.title}
          analysisType={exportTarget.sourceType}
          onExportComplete={(result) => {
            toast.success(t('finance.export.created', 'Output created'));
            setExportDialogOpen(false);
            navigate(`/reports/builder/${result.outputId}`);
          }}
        />
      )}
    </>
  );
};

export default FinanceHub;
