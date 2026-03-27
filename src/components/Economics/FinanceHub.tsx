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

import {
  BarChart3,
  Calculator,
  ChevronDown,
  FileText,
  Plus,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useEffect } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyFinance,
  V8FinanceApi,
  type V8FinanceDashboard,
} from '@/services/api/v8/finance';

import { BudgetWorkspace } from '../Benefits/BudgetWorkspace';
import { FinancialAnalysisWorkspace } from '../Benefits/FinancialAnalysisWorkspace';
import { ValuationWorkspace } from '../Benefits/ValuationWorkspace';
import { ExportToOutputDialog } from '../Finance/ExportToOutputDialog';
import { FinancialStatementImportWizard } from '../Finance/FinancialStatementImportWizard';
import { FinancialStatementPackWorkspace } from '../Finance/FinancialStatementPackWorkspace';
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
import { FinanceModelDocumentView } from './FinanceModelDocumentView';
import { useFinancePreview } from './FinancePreviewPanel';
import {
  CANVAS_PADDING,
  type FinanceAnalysisRow,
  type FinanceKind,
  type FinanceModelRow,
  type FinanceRow,
  type FinanceStatementRow,
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
    (searchParams.get('tab') as ModuleTab) || 'statements'
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
  const [showAnalyzeMenu, setShowAnalyzeMenu] = useState(false);
  const [v8Dashboard, setV8Dashboard] = useState<V8FinanceDashboard | null>(null);
  const [createModelSourceStatementPackId, setCreateModelSourceStatementPackId] = useState<
    string | null
  >(null);
  const [analysisSourceStatementPackId, setAnalysisSourceStatementPackId] = useState<string | null>(
    null
  );
  const [analysisInitialTitle, setAnalysisInitialTitle] = useState('');
  const [budgetInitialTitle, setBudgetInitialTitle] = useState('');
  const [valuationInitialSource, setValuationInitialSource] = useState<{
    type?: 'financial_model' | 'financial_analysis' | 'budget' | 'manual';
    id?: string;
  }>({});
  const [valuationInitialTitle, setValuationInitialTitle] = useState('');
  const analyzeMenuRef = useRef<HTMLDivElement | null>(null);

  // ---- Extracted hooks ----
  const {
    statements,
    models,
    analyses,
    valuations,
    budgets,
    loadingTab,
    loadError,
    loadStatements,
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
    statementPreviewDetail,
    statementPreviewRatios,
    modelPreviewDetail,
    predictionValidations,
    analysisPreviewRatios,
    budgetPreviewScenarios,
    valuationPreviewResults,
    valuationPreviewDetail,
    getBudgetRawId,
    loadModelPreview,
    loadPredictionPreview,
    loadBudgetPreviewScenarios,
    loadAnalysisPreviewRatios,
    loadValuationPreviewResults,
    onSelectRow,
    deselectRow,
  } = useFinanceSelection(activeTab);

  useEffect(() => {
    let cancelled = false;
    const loadV8Dashboard = async () => {
      try {
        const response = await V8FinanceApi.getDashboard();
        if (!cancelled) setV8Dashboard(response.dashboard);
      } catch {
        if (!cancelled) setV8Dashboard(null);
      }
    };
    void loadV8Dashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeDocument) return;
    if (
      activeDocument.kind === 'models' ||
      (activeDocument.kind === 'prediction' &&
        (activeDocument as FinanceModelRow).predictionType === 'model')
    ) {
      void loadModelPreview(activeDocument as FinanceModelRow);
    }
  }, [activeDocument, loadModelPreview]);

  const statementRows = useMemo(
    () =>
      (statements || []).map((statement: any): FinanceStatementRow => {
        const childStatements = Array.isArray(statement.statements)
          ? statement.statements.map((row: any) => ({
              id: String(row.id),
              statementType: String(row.statement_type || ''),
              rawStatus: String(row.status || 'draft'),
              readinessStatus: String(row.readiness_status || 'pending'),
              readinessScore: Number(row.readiness_score ?? 0),
              validationStatus: String(row.validation_status || 'pending'),
              mappedLineCount: Number(row.mapped_line_count ?? 0),
              totalLineCount: Number(row.total_line_count ?? 0),
              unmappedLineCount: Number(row.unmapped_line_count ?? 0),
              sourceFileName: String(row.source_file_name || ''),
              updatedAt: String(row.updated_at || row.created_at || ''),
            }))
          : [];
        const presentTypes = new Set<string>();
        if (Number(statement.pl_count ?? 0) > 0) presentTypes.add('P&L');
        if (Number(statement.bs_count ?? 0) > 0) presentTypes.add('BS');
        if (Number(statement.cf_count ?? 0) > 0) presentTypes.add('CF');
        for (const row of childStatements) {
          if (row.statementType) presentTypes.add(row.statementType);
        }
        const mappedLineCount = childStatements.reduce(
          (sum: number, row: any) => sum + Number(row.mappedLineCount || 0),
          0
        );
        const unmappedLineCount = childStatements.reduce(
          (sum: number, row: any) => sum + Number(row.unmappedLineCount || 0),
          0
        );
        const totalLineCount = mappedLineCount + unmappedLineCount;
        const effectiveReadiness = String(
          statement.pack_readiness_status || statement.readiness_status || 'pending'
        ).toLowerCase();
        const missingStatementTypes =
          typeof statement.missing_statement_types === 'string' &&
          statement.missing_statement_types.trim().startsWith('[')
            ? JSON.parse(statement.missing_statement_types)
            : Array.isArray(statement.missing_statement_types)
              ? statement.missing_statement_types
              : [];
        return {
          id: String(statement.id),
          title: String(
            statement.entity_name ||
              statement.period_label ||
              `${t('finance.pack.titleFallback', 'Statement Pack')} ${statement.period_end || ''}`
          ),
          kind: 'statements',
          status:
            effectiveReadiness === 'ready'
              ? 'APPROVED'
              : effectiveReadiness === 'recoverable'
                ? 'REVIEW'
                : 'DRAFT',
          statementType: 'PACK',
          statementPackId: String(statement.id),
          entityName: String(statement.entity_name || ''),
          periodStart: String(statement.period_start || ''),
          periodEnd: String(statement.period_end || ''),
          periodLabel: String(statement.period_label || ''),
          currency: String(statement.currency || 'PLN'),
          scaling: String(statement.scaling || 'units'),
          sourceFileName: childStatements
            .map((row: any) => row.sourceFileName)
            .filter(Boolean)
            .join(', '),
          validationStatus: String(statement.pack_status || 'pending'),
          mappedLineCount,
          totalLineCount,
          unmappedLineCount,
          sourceStatementCount: Number(
            statement.source_statement_count ??
              childStatements.length ??
              Number(statement.pl_count ?? 0) +
                Number(statement.bs_count ?? 0) +
                Number(statement.cf_count ?? 0)
          ),
          statementIds: childStatements.map((row: any) => row.id),
          missingStatementTypes: missingStatementTypes.map((value: unknown) => String(value)),
          completenessLabel: ['P&L', 'BS', 'CF']
            .map((type) => (presentTypes.has(type) ? type : `—${type}`))
            .join(' / '),
          childStatements,
          nonFinancialLineCount: Number(statement.non_financial_line_count ?? 0),
          overallConfidence: Number(statement.overall_confidence ?? 0),
          rawStatus: String(statement.pack_status || statement.status || 'draft'),
          readinessStatus: effectiveReadiness,
          readinessScore: Number(statement.pack_readiness_score ?? statement.readiness_score ?? 0),
          readinessSummary: String(
            statement.pack_quality_summary || statement.quality_summary || ''
          ),
          readinessReasonCodes:
            typeof statement.pack_quality_reason_codes === 'string' &&
            statement.pack_quality_reason_codes.trim().startsWith('[')
              ? JSON.parse(statement.pack_quality_reason_codes)
              : Array.isArray(statement.pack_quality_reason_codes)
                ? statement.pack_quality_reason_codes
                : [],
          documentClass: String(statement.document_class || ''),
          extractionStrategy: String(statement.extraction_strategy || ''),
          templateFamily: statement.template_family ? String(statement.template_family) : null,
          valuesVersion: Number(statement.values_version ?? 0),
          isWorkable: effectiveReadiness === 'ready',
          updatedAt: String(
            statement.updated_at || statement.created_at || new Date().toISOString()
          ),
        };
      }),
    [statements, t]
  );
  const readyStatementRows = useMemo(
    () => statementRows.filter((statement) => statement.isWorkable),
    [statementRows]
  );
  const analyzeContextRow = useMemo(
    () => activeDocument ?? selectedItem ?? null,
    [activeDocument, selectedItem]
  );

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
      activeTab === 'statements'
        ? 'statements'
        : activeTab === 'models'
          ? 'models'
          : activeTab === 'analysis'
            ? 'analysis'
            : activeTab === 'investment'
              ? 'investment'
              : activeTab === 'prediction'
                ? 'prediction'
                : 'valuation';
    if (kind === 'statements') loadStatements().catch(() => {});
    if (kind === 'analysis' || kind === 'investment') loadAnalyses().catch(() => {});
    if (kind === 'models') loadModels().catch(() => {});
    if (kind === 'prediction') {
      loadModels().catch(() => {});
      loadBudgets().catch(() => {});
    }
    if (kind === 'valuation') loadValuations().catch(() => {});
  }, [activeTab, loadStatements, loadAnalyses, loadModels, loadBudgets, loadValuations]);

  const handleRemoveFilter = useCallback(
    (id: string) => setActiveFilters((prev) => prev.filter((f) => f.id !== id)),
    []
  );
  const handleClearFilters = useCallback(() => setActiveFilters([]), []);
  const focusStatementQueue = useCallback(
    (status: 'APPROVED' | 'REVIEW' | 'DRAFT') => {
      const label =
        status === 'APPROVED'
          ? t('finance.counters.readyStatements', 'Ready Statements')
          : status === 'REVIEW'
            ? t('finance.counters.recoveryQueue', 'Recovery Queue')
            : t('finance.counters.rejectedImports', 'Rejected Imports');
      setActiveFilters((prev) => [
        ...prev.filter((filter) => filter.column !== 'status'),
        {
          id: `status-${status}`,
          column: 'status',
          value: status,
          label,
        },
      ]);
    },
    [t]
  );
  const buildAnalyzeTitle = useCallback((base: string, suffix: string) => {
    const trimmedBase = String(base || '')
      .trim()
      .replace(/\s+/g, ' ');
    return trimmedBase ? `${trimmedBase} ${suffix}` : suffix;
  }, []);
  const openAnalysisFlow = useCallback(
    (options?: {
      title?: string;
      statementPackId?: string | null;
      analysisType?: 'comprehensive' | 'investment_case';
    }) => {
      setShowAnalyzeMenu(false);
      setAnalysisInitialTitle(options?.title || '');
      setAnalysisSourceStatementPackId(options?.statementPackId || null);
      const targetTab = options?.analysisType === 'investment_case' ? 'investment' : 'analysis';
      setActiveTab(targetTab);
      setShowAnalysisCreateModal(true);
    },
    []
  );
  const openModelFlow = useCallback((statementPackId?: string | null) => {
    setShowAnalyzeMenu(false);
    setCreateModelSourceStatementPackId(statementPackId || null);
    setActiveTab('models');
    setShowCreateModelModal(true);
  }, []);
  const openBudgetFlow = useCallback((title?: string) => {
    setShowAnalyzeMenu(false);
    setBudgetInitialTitle(title || '');
    setActiveTab('prediction');
    setShowPredictionCreateModal(true);
  }, []);
  const openValuationFlow = useCallback(
    (options?: {
      title?: string;
      sourceType?: 'financial_model' | 'financial_analysis' | 'budget' | 'manual';
      sourceId?: string;
    }) => {
      setShowAnalyzeMenu(false);
      setValuationInitialTitle(options?.title || '');
      setValuationInitialSource(
        options?.sourceType ? { type: options.sourceType, id: options.sourceId } : {}
      );
      setActiveTab('valuation');
      setShowValuationCreateModal(true);
    },
    []
  );

  const handleModelChanged = useCallback(async () => {
    await loadModels();
  }, [loadModels]);
  const handleStatementChanged = useCallback(async () => {
    await loadStatements();
  }, [loadStatements]);
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

  const handleCreateModelFromStatement = useCallback((row: FinanceStatementRow) => {
    setCreateModelSourceStatementPackId(row.id);
    setShowCreateModelModal(true);
  }, []);

  const handleCreateAnalysisFromStatements = useCallback(
    (row: FinanceStatementRow) => {
      setAnalysisSourceStatementPackId(row.id);
      setAnalysisInitialTitle(
        buildAnalyzeTitle(
          row.entityName || row.periodLabel || row.title,
          isPl ? 'analiza' : 'analysis'
        )
      );
      setShowAnalysisCreateModal(true);
    },
    [buildAnalyzeTitle, isPl]
  );

  // ---- Row actions ----
  const { getRowActions } = useFinanceRowActions({
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
  });

  // ---- Preview ----
  const { renderPreviewBody, renderPreviewFooter } = useFinancePreview({
    statementPreviewDetail,
    statementPreviewRatios,
    modelPreviewDetail,
    predictionValidations,
    analysisPreviewRatios,
    budgetPreviewScenarios,
    valuationPreviewResults,
    valuationPreviewDetail,
    handleOpenFull,
    handleExport,
    handleCreateModelFromStatement,
    handleCreateAnalysisFromStatements,
    loadStatements,
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
    const createFrom = searchParams.get('createFrom') as
      | 'financial_model'
      | 'financial_analysis'
      | 'budget'
      | null;
    const sourceId = searchParams.get('sourceId');

    if (
      tab &&
      ['statements', 'models', 'analysis', 'prediction', 'valuation', 'investment'].includes(tab)
    ) {
      setActiveTab(tab as ModuleTab);
    }

    if (createFrom && tab === 'valuation') {
      setValuationInitialSource({ type: createFrom, id: sourceId || undefined });
      setShowValuationCreateModal(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!showAnalyzeMenu) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (analyzeMenuRef.current?.contains(event.target as Node)) return;
      setShowAnalyzeMenu(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showAnalyzeMenu]);

  // ---- Tabs ----
  const tabs = useMemo(
    () => [
      {
        id: 'statements' as ModuleTab,
        label: t('finance.tabs.statements', 'Statements'),
        icon: <FileText size={16} />,
        count: statements.length,
      },
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
    [t, statements.length, models.length, analyses, valuations.length, budgets.length]
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
    if (activeTab === 'statements') {
      return [
        baseTypeCol,
        baseTitleCol,
        {
          id: 'completeness',
          label: t('finance.columns.statementType', 'Completeness'),
          width: '170px',
          render: (row: FinanceRow) =>
            row.kind === 'statements' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {row.completenessLabel || '—'}
              </span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'period',
          label: t('finance.columns.period', 'Period'),
          width: '170px',
          render: (row: FinanceRow) =>
            row.kind === 'statements' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {row.periodLabel || `${row.periodStart} → ${row.periodEnd}`}
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
            row.kind === 'statements' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.currency}</span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'sourceStatementCount',
          label: t('finance.columns.mappedLines', 'Docs'),
          width: '90px',
          render: (row: FinanceRow) =>
            row.kind === 'statements' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {row.sourceStatementCount ?? row.statementIds?.length ?? 0}
              </span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        baseStatusCol,
        baseUpdatedCol,
      ];
    }
    if (activeTab === 'models') {
      return [
        baseTypeCol,
        baseTitleCol,
        {
          id: 'sourceDocument',
          label: t('finance.columns.document', 'Document'),
          width: '220px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                {row.sourceDocumentTitle || '—'}
              </span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'forecastWindow',
          label: t('finance.columns.forecastWindow', 'Forecast'),
          width: '120px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {row.forecastWindowLabel}
              </span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'variants',
          label: t('finance.columns.variants', 'Variants'),
          width: '190px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.variantLabel}</span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'analyticsDepth',
          label: t('finance.columns.analyticsDepth', 'Levels'),
          width: '90px',
          render: (row: FinanceRow) =>
            row.kind === 'models' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {row.analyticalDepthLabel}
              </span>
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
          row.kind === 'statements'
            ? `${(row as FinanceStatementRow).completenessLabel || 'PACK'} • ${(row as FinanceStatementRow).currency} • ${((row as FinanceStatementRow).periodLabel || (row as FinanceStatementRow).periodEnd) ?? ''}`
            : row.kind === 'models'
              ? `${(row as FinanceModelRow).sourceDocumentTitle || (isPl ? 'Model prognostyczny' : 'Forecast model')} • ${(row as FinanceModelRow).forecastWindowLabel || ''} • ${(row as FinanceModelRow).variantLabel || ''}`
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
      statements: t('finance.cta.importStatement', '+ Importuj statement'),
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
          if (currentKind === 'statements') setShowImportWizard(true);
          else if (currentKind === 'models') setShowCreateModelModal(true);
          else if (currentKind === 'analysis' || currentKind === 'investment')
            setShowAnalysisCreateModal(true);
          else if (currentKind === 'prediction') setShowPredictionCreateModal(true);
          else if (currentKind === 'valuation') {
            setValuationInitialSource({});
            setShowValuationCreateModal(true);
          }
        }}
        className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-cyan-600 text-white shadow-sm hover:bg-cyan-700 transition-all duration-150 active:scale-[0.97]"
      >
        <Plus size={14} strokeWidth={2.5} />
        <span>{labels[currentKind] || labels.models}</span>
      </button>
    );
  }, [activeTab, t]);

  const analyzeActions = useMemo(() => {
    const contextRow = analyzeContextRow;
    const readyStatementContext =
      contextRow?.kind === 'statements' && (contextRow as FinanceStatementRow).isWorkable
        ? (contextRow as FinanceStatementRow)
        : readyStatementRows.length === 1
          ? readyStatementRows[0]
          : null;
    const modelContext: FinanceModelRow | null =
      contextRow &&
      (contextRow.kind === 'models' ||
        (contextRow.kind === 'prediction' &&
          (contextRow as FinanceModelRow).predictionType === 'model'))
        ? (contextRow as FinanceModelRow)
        : null;
    const budgetContext: FinanceModelRow | null =
      contextRow?.kind === 'prediction' &&
      (contextRow as FinanceModelRow).predictionType === 'budget'
        ? (contextRow as FinanceModelRow)
        : null;
    const analysisContext =
      contextRow && (contextRow.kind === 'analysis' || contextRow.kind === 'investment')
        ? (contextRow as FinanceAnalysisRow)
        : null;

    if (activeTab === 'statements') {
      return [
        {
          id: 'model',
          label: t('finance.analyze.modeling', 'Modelowanie'),
          description: t(
            'finance.analyze.modelingHint',
            'Utwórz model finansowy z gotowego statementu.'
          ),
          disabled: readyStatementRows.length === 0,
          onSelect: () => openModelFlow(readyStatementContext?.id || null),
        },
        {
          id: 'budget',
          label: t('finance.analyze.budgeting', 'Budżetowanie'),
          description: t(
            'finance.analyze.budgetingHint',
            'Przejdź do budżetu i utwórz nową pozycję planowania.'
          ),
          disabled: false,
          onSelect: () =>
            openBudgetFlow(
              readyStatementContext
                ? buildAnalyzeTitle(
                    readyStatementContext.periodLabel || readyStatementContext.title,
                    isPl ? 'budżet' : 'budget'
                  )
                : ''
            ),
        },
        {
          id: 'analysis',
          label: t('finance.analyze.financialAnalysis', 'Analiza finansowa'),
          description: t(
            'finance.analyze.financialAnalysisHint',
            'Utwórz analizę finansową na bazie gotowych statementów.'
          ),
          disabled: readyStatementRows.length === 0,
          onSelect: () =>
            openAnalysisFlow({
              title: readyStatementContext
                ? buildAnalyzeTitle(
                    readyStatementContext.periodLabel || readyStatementContext.title,
                    isPl ? 'analiza finansowa' : 'financial analysis'
                  )
                : '',
              statementPackId: readyStatementContext ? readyStatementContext.id : null,
            }),
        },
        {
          id: 'valuation',
          label: t('finance.analyze.valuation', 'Wycena przedsiębiorstwa'),
          description: t(
            'finance.analyze.valuationFromStatementsHint',
            'Wycena jest dostępna po utworzeniu modelu, budżetu lub analizy finansowej.'
          ),
          disabled: true,
          onSelect: () => undefined,
        },
      ];
    }

    if (activeTab === 'models' || modelContext) {
      return [
        {
          id: 'analysis',
          label: t('finance.analyze.financialAnalysis', 'Analiza finansowa'),
          description: t(
            'finance.analyze.analysisFromModelHint',
            'Przejdź do Analizy i utwórz draft w kontekście bieżącego modelu.'
          ),
          disabled: !modelContext,
          onSelect: () =>
            openAnalysisFlow({
              title: modelContext
                ? buildAnalyzeTitle(
                    modelContext.title,
                    isPl ? 'analiza finansowa' : 'financial analysis'
                  )
                : '',
            }),
        },
        {
          id: 'valuation',
          label: t('finance.analyze.valuation', 'Wycena przedsiębiorstwa'),
          description: t(
            'finance.analyze.valuationFromModelHint',
            'Przejdź do Wyceny i utwórz pozycję na bazie bieżącego modelu.'
          ),
          disabled: !modelContext,
          onSelect: () =>
            openValuationFlow({
              title: modelContext
                ? buildAnalyzeTitle(modelContext.title, isPl ? 'wycena' : 'valuation')
                : '',
              sourceType: 'financial_model',
              sourceId: modelContext?.id,
            }),
        },
      ];
    }

    if (activeTab === 'prediction') {
      return [
        {
          id: 'analysis',
          label: t('finance.analyze.financialAnalysis', 'Analiza finansowa'),
          description: t(
            'finance.analyze.analysisFromPredictionHint',
            'Przejdź do Analizy i utwórz draft w kontekście bieżącego budżetu lub scenariusza.'
          ),
          disabled: !budgetContext && !modelContext,
          onSelect: () =>
            openAnalysisFlow({
              title: budgetContext
                ? buildAnalyzeTitle(
                    budgetContext.title,
                    isPl ? 'analiza finansowa' : 'financial analysis'
                  )
                : '',
            }),
        },
        {
          id: 'valuation',
          label: t('finance.analyze.valuation', 'Wycena przedsiębiorstwa'),
          description: t(
            'finance.analyze.valuationFromPredictionHint',
            'Przejdź do Wyceny i utwórz pozycję na bazie bieżącego modelu lub budżetu.'
          ),
          disabled: !budgetContext && !modelContext,
          onSelect: () =>
            openValuationFlow(
              budgetContext
                ? {
                    title: buildAnalyzeTitle(budgetContext.title, isPl ? 'wycena' : 'valuation'),
                    sourceType: 'budget',
                    sourceId: getBudgetRawId(budgetContext.id),
                  }
                : {
                    title: '',
                    sourceType: 'financial_model',
                    sourceId: undefined,
                  }
            ),
        },
      ];
    }

    if (activeTab === 'analysis' || activeTab === 'investment') {
      return [
        {
          id: 'valuation',
          label: t('finance.analyze.valuation', 'Wycena przedsiębiorstwa'),
          description: t(
            'finance.analyze.valuationFromAnalysisHint',
            'Przejdź do Wyceny i utwórz pozycję na bazie bieżącej analizy.'
          ),
          disabled: !analysisContext,
          onSelect: () =>
            openValuationFlow({
              title: analysisContext
                ? buildAnalyzeTitle(analysisContext.title, isPl ? 'wycena' : 'valuation')
                : '',
              sourceType: 'financial_analysis',
              sourceId: analysisContext?.id,
            }),
        },
      ];
    }

    return [];
  }, [
    activeTab,
    analyzeContextRow,
    readyStatementRows,
    openModelFlow,
    openBudgetFlow,
    openAnalysisFlow,
    openValuationFlow,
    buildAnalyzeTitle,
    getBudgetRawId,
    isPl,
    t,
  ]);

  const analyzeActionIcons: Record<string, React.ReactNode> = useMemo(
    () => ({
      model: <Calculator size={14} className="text-blue-500" />,
      budget: <TrendingUp size={14} className="text-purple-500" />,
      analysis: <BarChart3 size={14} className="text-emerald-500" />,
      valuation: <Target size={14} className="text-amber-500" />,
    }),
    []
  );

  const rightControls = useMemo(() => {
    if (analyzeActions.length === 0) return null;

    return (
      <div ref={analyzeMenuRef} className="relative">
        <button
          onClick={() => setShowAnalyzeMenu((prev) => !prev)}
          aria-expanded={showAnalyzeMenu}
          aria-haspopup="menu"
          className={`inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium border transition-all duration-150 ${
            showAnalyzeMenu
              ? 'border-cyan-400/40 bg-cyan-100/80 text-cyan-800 dark:border-cyan-400/30 dark:bg-cyan-500/15 dark:text-cyan-200'
              : 'border-cyan-200/70 bg-cyan-50/80 text-cyan-700 hover:bg-cyan-100/60 dark:border-cyan-400/20 dark:bg-cyan-500/10 dark:text-cyan-300 dark:hover:bg-cyan-500/15'
          }`}
        >
          <Sparkles size={13} />
          <span>{t('finance.analyze.cta', 'Analyze')}</span>
          <ChevronDown
            size={13}
            className={`transition-transform duration-200 ${showAnalyzeMenu ? 'rotate-180' : ''}`}
          />
        </button>
        {showAnalyzeMenu && (
          <div
            className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-lg shadow-xl dark:border-white/[0.08] dark:bg-navy-900/95 p-1.5 z-20"
            role="menu"
          >
            <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              {t('finance.analyze.menuTitle', 'Choose next step')}
            </div>
            <div className="space-y-0.5">
              {analyzeActions.map((action) => (
                <button
                  key={action.id}
                  role="menuitem"
                  onClick={action.onSelect}
                  disabled={action.disabled}
                  title={
                    action.disabled
                      ? isPl
                        ? 'Wymaga gotowego statementu lub modelu'
                        : 'Requires a ready statement or model'
                      : undefined
                  }
                  className="group flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                >
                  <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100/80 transition-colors group-hover:bg-slate-200/60 dark:bg-white/[0.06] dark:group-hover:bg-white/[0.08]">
                    {analyzeActionIcons[action.id] || (
                      <BarChart3 size={14} className="text-slate-500" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-slate-900 dark:text-white">
                      {action.label}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                      {action.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }, [analyzeActions, showAnalyzeMenu, analyzeActionIcons, isPl, t]);

  // ---- Command Row ----
  const commandRowContent = useMemo(() => {
    const total = rowsForActiveTab.length;
    const dotColors: Record<string, string> = {
      all: 'bg-slate-400',
      DRAFT: 'bg-slate-400',
      REVIEW: 'bg-amber-400',
      APPROVED: 'bg-emerald-400',
    };
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
        label:
          activeTab === 'statements'
            ? t('finance.counters.rejectedImports', 'Rejected Imports')
            : t('finance.counters.draft', 'Draft'),
        count: statusCounts.DRAFT,
        active: activeFilters.some((f) => f.column === 'status' && f.value === 'DRAFT'),
      },
      {
        id: 'REVIEW',
        label:
          activeTab === 'statements'
            ? t('finance.counters.recoveryQueue', 'Recovery Queue')
            : t('finance.counters.review', 'Review'),
        count: statusCounts.REVIEW,
        active: activeFilters.some((f) => f.column === 'status' && f.value === 'REVIEW'),
      },
      {
        id: 'APPROVED',
        label:
          activeTab === 'statements'
            ? t('finance.counters.readyStatements', 'Ready Statements')
            : t('finance.counters.approved', 'Approved'),
        count: statusCounts.APPROVED,
        active: activeFilters.some((f) => f.column === 'status' && f.value === 'APPROVED'),
      },
    ];
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto">
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
            className={`h-8 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium border transition-all duration-150 whitespace-nowrap ${
              chip.active
                ? 'bg-cyan-50/80 text-cyan-700 border-cyan-300/60 shadow-sm dark:bg-cyan-500/10 dark:text-cyan-200 dark:border-cyan-400/30'
                : 'bg-white/60 text-slate-600 border-slate-200/60 hover:bg-slate-50 hover:border-slate-300/60 dark:bg-white/[0.02] dark:text-slate-400 dark:border-white/[0.06] dark:hover:bg-white/[0.04]'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColors[chip.id] || dotColors.all}`}
            />
            <span>{chip.label}</span>
            <span
              className={`ml-0.5 px-1.5 py-0.5 text-[10px] rounded-md font-semibold tabular-nums leading-none ${
                chip.active
                  ? 'bg-cyan-200/60 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-200'
                  : 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400'
              }`}
            >
              {chip.count}
            </span>
          </button>
        ))}
        {v8Dashboard && (
          <>
            <div className="mx-1 h-5 w-px shrink-0 bg-slate-200/70 dark:bg-white/[0.08]" />
            <div className="h-8 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium border whitespace-nowrap bg-white/60 text-slate-600 border-slate-200/60 dark:bg-white/[0.02] dark:text-slate-300 dark:border-white/[0.06]">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 flex-shrink-0" />
              <span>{t('finance.v8.ingestion', 'V8 Ingestion')}</span>
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] rounded-md font-semibold tabular-nums leading-none bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                {v8Dashboard.ingestionPipeline.totalCount}
              </span>
            </div>
            <div className="h-8 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium border whitespace-nowrap bg-white/60 text-slate-600 border-slate-200/60 dark:bg-white/[0.02] dark:text-slate-300 dark:border-white/[0.06]">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
              <span>{t('finance.v8.escalations', 'Escalations')}</span>
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] rounded-md font-semibold tabular-nums leading-none bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                {v8Dashboard.unresolvedEscalationsCount}
              </span>
            </div>
            <div className="h-8 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium border whitespace-nowrap bg-white/60 text-slate-600 border-slate-200/60 dark:bg-white/[0.02] dark:text-slate-300 dark:border-white/[0.06]">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 flex-shrink-0" />
              <span>{t('finance.v8.linkages', 'Linkages')}</span>
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] rounded-md font-semibold tabular-nums leading-none bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                {v8Dashboard.linkageHealth.totalLinkages}
              </span>
            </div>
            <div className="h-8 inline-flex items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium border whitespace-nowrap bg-white/60 text-slate-600 border-slate-200/60 dark:bg-white/[0.02] dark:text-slate-300 dark:border-white/[0.06]">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span>{t('finance.v8.gates', 'Gate pass')}</span>
              <span className="ml-0.5 px-1.5 py-0.5 text-[10px] rounded-md font-semibold tabular-nums leading-none bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-300">
                {v8Dashboard.promotionGatePassRate == null
                  ? '—'
                  : `${Math.round(v8Dashboard.promotionGatePassRate * 100)}%`}
              </span>
            </div>
          </>
        )}
      </div>
    );
  }, [rowsForActiveTab.length, statusCounts, activeFilters, activeTab, t, v8Dashboard]);

  const emptyMessage = useMemo(() => {
    const activeStatusFilter = activeFilters.find((filter) => filter.column === 'status')?.value;
    const messages: Record<FinanceKind | 'investment', string> = {
      statements:
        activeStatusFilter === 'APPROVED'
          ? t(
              'finance.empty.readyStatements',
              'No ready statements in the working set. Imports that are not ready stay in Recovery Queue or Rejected Imports.'
            )
          : activeStatusFilter === 'REVIEW'
            ? t(
                'finance.empty.recoveryQueue',
                'Recovery Queue is empty. Imports that still need remap, re-validation, or scale fixes will appear here.'
              )
            : activeStatusFilter === 'DRAFT'
              ? t(
                  'finance.empty.rejectedImports',
                  'Rejected Imports is empty. Documents that fail the minimum recognition contract will appear here.'
                )
              : t(
                  'finance.empty.statements',
                  'No statements in the current view. Ready items go to the working set, recoverable items go to Recovery Queue, and rejected ones stay outside downstream flows.'
                ),
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
  }, [activeFilters, activeTab, t]);

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
        getItemById={(id) => filteredRows.find((x) => x.id === id) ?? null}
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
    const openStatement = activeDocument.kind === 'statements';
    const isModelWorkspace =
      activeDocument.kind === 'models' ||
      (activeDocument.kind === 'prediction' && activeModelRow.predictionType === 'model');
    const openAnalysis = activeDocument.kind === 'analysis' || activeDocument.kind === 'investment';
    const openValuation = activeDocument.kind === 'valuation';
    const needsFullHeight =
      openStatement || isModelWorkspace || openAnalysis || isBudgetPrediction || openValuation;
    return (
      <div className="p-4 lg:p-6">
        <div className="bg-white/70 dark:bg-navy-900/70 backdrop-blur border border-slate-200/70 dark:border-white/[0.06] rounded-xl overflow-hidden">
          {!openStatement && (
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
          )}
          <div
            className={
              needsFullHeight
                ? 'flex h-[calc(100vh-120px)] min-h-[620px] flex-col overflow-hidden'
                : 'p-4'
            }
          >
            {isBudgetPrediction ? (
              <BudgetWorkspace
                initialBudgetId={getBudgetRawId(activeDocument.id)}
                hideSidebar
                onBudgetChanged={handleBudgetChanged}
              />
            ) : openStatement ? (
              <FinancialStatementPackWorkspace
                statementPackId={activeDocument.id}
                onStatementChanged={handleStatementChanged}
                onCreateModelFromPack={handleCreateModelFromStatement}
                onCreateAnalysisFromPack={handleCreateAnalysisFromStatements}
              />
            ) : isModelWorkspace ? (
              <FinanceModelDocumentView
                row={activeDocument as FinanceModelRow}
                detail={modelPreviewDetail}
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
    handleStatementChanged,
    handleValuationChanged,
    getBudgetRawId,
    t,
    handleShowList,
    handleCreateModelFromStatement,
    handleCreateAnalysisFromStatements,
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
    if (!activeDocumentId && loadError)
      return (
        <div className="flex items-center justify-center h-full p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-amber-200/70 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-500/10 p-6">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {t('finance.errors.realSourceTitle', 'Real finance source needs attention')}
            </div>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{loadError}</div>
            <div className="mt-4 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {t(
                'finance.errors.realSourceHint',
                'No synthetic demo fallback was injected. Verify active DB, organization scope, and data-context before retrying.'
              )}
            </div>
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
    loadError,
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
        commandRowContent={commandRowContent}
        rightControls={rightControls}
      >
        {content}
      </ModuleHub>

      {showCreateModelModal && (
        <CreateModelModal
          availableStatements={readyStatementRows}
          initialSourceStatementPackId={createModelSourceStatementPackId}
          onClose={() => {
            setShowCreateModelModal(false);
            setCreateModelSourceStatementPackId(null);
          }}
          onCreated={async (row) => {
            await loadModels();
            setShowCreateModelModal(false);
            setCreateModelSourceStatementPackId(null);
            handleOpenFull(row);
          }}
        />
      )}

      {showImportWizard && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
          <FinancialStatementImportWizard
            onClose={() => setShowImportWizard(false)}
            onComplete={async (statementId) => {
              setShowImportWizard(false);
              const statementDetail = (await Api.get(
                `/api/finance-statements/${statementId}`
              )) as any;
              const statementPackId = String(
                statementDetail.statement_pack_id || statementDetail.statementPackId || ''
              );
              let packs: any[] = [];
              try {
                const data = await V8FinanceApi.getStatementPacks();
                packs = Array.isArray(data?.statementPacks) ? data.statementPacks : [];
              } catch (error) {
                if (!shouldFallbackToLegacyFinance(error)) {
                  throw error;
                }
                const data = await Api.get('/api/finance-statements/packs');
                packs = Array.isArray(data) ? data : [];
              }
              await loadStatements();
              const pack = Array.isArray(packs)
                ? packs.find((item: any) => String(item.id) === statementPackId)
                : null;
              const statementRow: FinanceStatementRow = pack
                ? {
                    id: String(pack.id),
                    title: String(pack.entity_name || pack.period_label || pack.id),
                    kind: 'statements',
                    status:
                      String(pack.pack_readiness_status || '').toLowerCase() === 'ready'
                        ? 'APPROVED'
                        : String(pack.pack_readiness_status || '').toLowerCase() === 'recoverable'
                          ? 'REVIEW'
                          : 'DRAFT',
                    statementType: 'PACK',
                    statementPackId: String(pack.id),
                    entityName: String(pack.entity_name || ''),
                    periodStart: String(pack.period_start || ''),
                    periodEnd: String(pack.period_end || ''),
                    periodLabel: String(pack.period_label || ''),
                    currency: String(pack.currency || 'PLN'),
                    scaling: String(pack.scaling || 'units'),
                    sourceFileName: '',
                    validationStatus: String(pack.pack_status || 'pending'),
                    mappedLineCount: 0,
                    totalLineCount: 0,
                    unmappedLineCount: 0,
                    sourceStatementCount: Number(pack.source_statement_count ?? 0),
                    statementIds: [],
                    missingStatementTypes:
                      typeof pack.missing_statement_types === 'string' &&
                      pack.missing_statement_types.trim().startsWith('[')
                        ? JSON.parse(pack.missing_statement_types)
                        : Array.isArray(pack.missing_statement_types)
                          ? pack.missing_statement_types
                          : [],
                    completenessLabel: '',
                    childStatements: [],
                    overallConfidence: 0,
                    rawStatus: String(pack.pack_status || 'draft'),
                    readinessStatus: String(pack.pack_readiness_status || 'pending'),
                    readinessScore: Number(pack.pack_readiness_score ?? 0),
                    readinessSummary: String(pack.pack_quality_summary || ''),
                    readinessReasonCodes: [],
                    isWorkable: String(pack.pack_readiness_status || '').toLowerCase() === 'ready',
                    updatedAt: String(pack.updated_at || new Date().toISOString()),
                  }
                : statementRows.find((row) => row.id === statementPackId) || statementRows[0];
              if (!statementRow) return;
              setActiveTab('statements');
              focusStatementQueue(statementRow.status);
              handleOpenFull(statementRow);
              toast.success(
                statementRow.isWorkable
                  ? t('finance.importWizard.completed', 'Import zakończony')
                  : statementRow.readinessStatus === 'rejected'
                    ? t(
                        'finance.importWizard.rejected',
                        'Import zakończony, ale plik został odrzucony i wymaga ponownego podejścia.'
                      )
                    : t(
                        'finance.importWizard.requiresReview',
                        'Import zakończony. Statement trafił do recovery queue i wymaga domknięcia jakości.'
                      )
              );
            }}
          />
        </div>
      )}

      {showAnalysisCreateModal && (
        <CreateAnalysisModal
          defaultAnalysisType={activeTab === 'investment' ? 'investment_case' : 'comprehensive'}
          availableStatements={readyStatementRows}
          initialStatementPackId={analysisSourceStatementPackId}
          initialTitle={analysisInitialTitle}
          onClose={() => {
            setShowAnalysisCreateModal(false);
            setAnalysisSourceStatementPackId(null);
            setAnalysisInitialTitle('');
          }}
          onCreated={async (row) => {
            await loadAnalyses();
            setShowAnalysisCreateModal(false);
            setAnalysisSourceStatementPackId(null);
            setAnalysisInitialTitle('');
            handleOpenFull(row);
          }}
        />
      )}

      {showPredictionCreateModal && (
        <CreateBudgetModal
          initialTitle={budgetInitialTitle}
          onClose={() => {
            setShowPredictionCreateModal(false);
            setBudgetInitialTitle('');
          }}
          onCreated={async (row) => {
            await loadBudgets();
            setShowPredictionCreateModal(false);
            setBudgetInitialTitle('');
            handleOpenFull(row);
          }}
        />
      )}

      {showValuationCreateModal && (
        <CreateValuationModal
          initialSourceType={valuationInitialSource.type}
          initialSourceId={valuationInitialSource.id}
          initialTitle={valuationInitialTitle}
          onClose={() => {
            setShowValuationCreateModal(false);
            setValuationInitialSource({});
            setValuationInitialTitle('');
          }}
          onCreated={async (row) => {
            await loadValuations();
            setShowValuationCreateModal(false);
            setValuationInitialSource({});
            setValuationInitialTitle('');
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
