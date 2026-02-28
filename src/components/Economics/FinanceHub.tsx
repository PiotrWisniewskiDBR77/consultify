/**
 * FinanceHub (Economics route)
 *
 * KANON v3 (Golden Standard Table+Preview):
 * - 4 main functional buttons as tabs: Modele / Analiza / Predykcja / Wycena przedsiębiorstw
 * - Table + Preview layout: FilterableTable + TableWithPreviewLayout (gap-1.5, preview width clamp, no divider)
 * - Table canvas padding: pl-4 pr-1.5 pt-3 pb-4
 * - Preview footer zones: AI hints → divider → relations (2 rows) → divider → actions
 */

import { BarChart3, Calculator, Clock, MoreVertical, Target, TrendingUp } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import {
  FilterableTable,
  FilterChip,
  ItemStatus,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { TableWithPreviewLayout, type PreviewableItem } from '../shared/TableWithPreviewLayout';

type FinanceStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';
type FinanceKind = 'models' | 'analysis' | 'prediction' | 'valuation';

type FinanceRowBase = PreviewableItem & {
  kind: FinanceKind;
  status: FinanceStatus;
  updatedAt: string;
};

type FinanceModelRow = FinanceRowBase & {
  kind: 'models' | 'prediction';
  scenario: string;
  currency: string;
  horizonMonths: number;
  startDate: string;
};

type FinanceAnalysisRow = FinanceRowBase & {
  kind: 'analysis';
  analysisType: string;
  currency: string;
  periodCount: number;
};

type FinanceValuationRow = FinanceRowBase & {
  kind: 'valuation';
  sourceType: string;
  currency: string;
  horizonYears: number;
};

type FinanceRow = FinanceModelRow | FinanceAnalysisRow | FinanceValuationRow;

function normalizeModelStatus(raw: any): FinanceStatus {
  const s = String(raw || '').toLowerCase();
  if (s === 'approved') return 'APPROVED';
  if (s === 'review') return 'REVIEW';
  return 'DRAFT';
}

function normalizeStatus(raw: any): FinanceStatus {
  const s = String(raw || '').toUpperCase();
  if (s === 'APPROVED') return 'APPROVED';
  if (s === 'REVIEW') return 'REVIEW';
  return 'DRAFT';
}

function statusToItemStatus(s: FinanceStatus): ItemStatus {
  if (s === 'APPROVED') return 'APPROVED';
  if (s === 'REVIEW') return 'REVIEW';
  return 'DRAFT';
}

function getTypeCode(kind: FinanceKind): string {
  switch (kind) {
    case 'models':
      return 'MDL';
    case 'analysis':
      return 'ANL';
    case 'prediction':
      return 'PRD';
    case 'valuation':
      return 'VAL';
  }
}

const CANVAS_PADDING = 'pl-4 pr-1.5 pt-3 pb-4';

export const FinanceHub: React.FC = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<ModuleTab>('models');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<FinanceRow | null>(null);

  const [models, setModels] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [valuations, setValuations] = useState<any[]>([]);
  const [loadingTab, setLoadingTab] = useState<FinanceKind | null>('models');

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<FinanceRow | null>(null);

  const [predictionValidations, setPredictionValidations] = useState<{
    total: number;
    pass: number;
    fail: number;
    warning: number;
  } | null>(null);

  // Reset selection on tab change (KANON: preview default OFF unless user clicks a row)
  useEffect(() => {
    setSelectedId(null);
    setSelectedItem(null);
    setPredictionValidations(null);
    setActiveFilters([]);
  }, [activeTab]);

  const loadModels = useCallback(async () => {
    const data = await Api.get('/api/financial-modeling/models');
    setModels(Array.isArray(data) ? data : []);
  }, []);

  const loadAnalyses = useCallback(async () => {
    const data = await Api.get('/api/economics/financial-analyses');
    setAnalyses(Array.isArray((data as any)?.analyses) ? (data as any).analyses : []);
  }, []);

  const loadValuations = useCallback(async () => {
    const data = await Api.get('/api/economics/valuations');
    setValuations(Array.isArray((data as any)?.valuations) ? (data as any).valuations : []);
  }, []);

  // Load tab data on demand
  useEffect(() => {
    const kind: FinanceKind =
      activeTab === 'models'
        ? 'models'
        : activeTab === 'analysis'
          ? 'analysis'
          : activeTab === 'prediction'
            ? 'prediction'
            : 'valuation';

    let cancelled = false;
    const run = async () => {
      setLoadingTab(kind);
      try {
        if (kind === 'models' || kind === 'prediction') {
          await loadModels();
        } else if (kind === 'analysis') {
          await loadAnalyses();
        } else if (kind === 'valuation') {
          await loadValuations();
        }
      } catch (e) {
        console.error('[FinanceHub] Failed to load:', e);
        toast.error(t('common.loadFailed', { defaultValue: 'Failed to load' }) as any);
      } finally {
        if (!cancelled) setLoadingTab(null);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [activeTab, loadModels, loadAnalyses, loadValuations, t]);

  const tabs = useMemo(
    () => [
      {
        id: 'models' as ModuleTab,
        label: t('finance.tabs.models', { defaultValue: 'Modele' }) as any,
        icon: <Calculator size={16} />,
        count: models.length,
      },
      {
        id: 'analysis' as ModuleTab,
        label: t('finance.tabs.analysis', { defaultValue: 'Analiza' }) as any,
        icon: <BarChart3 size={16} />,
        count: analyses.length,
      },
      {
        id: 'prediction' as ModuleTab,
        label: t('finance.tabs.prediction', { defaultValue: 'Predykcja' }) as any,
        icon: <TrendingUp size={16} />,
        count: models.length,
      },
      {
        id: 'valuation' as ModuleTab,
        label: t('finance.tabs.valuation', { defaultValue: 'Wycena przedsiębiorstw' }) as any,
        icon: <Target size={16} />,
        count: valuations.length,
      },
    ],
    [t, models.length, analyses.length, valuations.length]
  );

  const rowsForActiveTab: FinanceRow[] = useMemo(() => {
    if (activeTab === 'models' || activeTab === 'prediction') {
      const kind: FinanceKind = activeTab === 'models' ? 'models' : 'prediction';
      return (models || []).map((m: any) => ({
        id: String(m.id),
        title: String(m.name || t('common.untitled', { defaultValue: 'Untitled' })),
        kind,
        status: normalizeModelStatus(m.status),
        scenario: String(m.scenario || 'base'),
        currency: String(m.currency || 'PLN'),
        horizonMonths: Number(m.horizon_months || 0),
        startDate: String(m.start_date || ''),
        updatedAt: String(m.updated_at || m.created_at || new Date().toISOString()),
      }));
    }
    if (activeTab === 'analysis') {
      return (analyses || []).map((a: any) => ({
        id: String(a.id),
        title: String(a.title || t('common.untitled', { defaultValue: 'Untitled' })),
        kind: 'analysis',
        status: normalizeStatus(a.status),
        analysisType: String(a.analysisType || a.analysis_type || 'comprehensive'),
        currency: String(a.currency || 'PLN'),
        periodCount: Array.isArray(a.periods) ? a.periods.length : 0,
        updatedAt: String(
          a.updatedAt ||
            a.updated_at ||
            a.createdAt ||
            a.created_at ||
            new Date().toISOString()
        ),
      }));
    }
    return (valuations || []).map((v: any) => ({
      id: String(v.id),
      title: String(v.title || t('common.untitled', { defaultValue: 'Untitled' })),
      kind: 'valuation',
      status: normalizeStatus(v.status),
      sourceType: String(v.sourceType || v.source_type || 'manual'),
      currency: String(v.currency || 'PLN'),
      horizonYears: Number(v.horizonYears ?? v.horizon_years ?? 0),
      updatedAt: String(v.updatedAt || v.updated_at || new Date().toISOString()),
    }));
  }, [activeTab, models, analyses, valuations, t]);

  const filteredRows = useMemo(() => {
    let rows = rowsForActiveTab;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      rows = rows.filter((r) => r.title.toLowerCase().includes(q));
    }

    const statusFilterValues = activeFilters.filter((f) => f.column === 'status').map((f) => f.value);
    if (statusFilterValues.length) {
      rows = rows.filter((r) => statusFilterValues.includes(r.status));
    }

    return rows;
  }, [rowsForActiveTab, searchQuery, activeFilters]);

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
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => setActiveFilters([]), []);

  const statusFilterOptions = useMemo(
    () => [
      {
        value: 'DRAFT',
        label: t('common.status.draft', { defaultValue: 'Draft' }) as any,
        color: 'bg-slate-400',
      },
      {
        value: 'REVIEW',
        label: t('common.status.review', { defaultValue: 'In Review' }) as any,
        color: 'bg-amber-400',
      },
      {
        value: 'APPROVED',
        label: t('common.status.approved', { defaultValue: 'Approved' }) as any,
        color: 'bg-emerald-400',
      },
    ],
    [t]
  );

  const baseColumns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('common.type', { defaultValue: 'Type' }) as any,
        width: '80px',
        render: (row: FinanceRow) => {
          const code = getTypeCode(row.kind);
          const icon =
            row.kind === 'models' ? (
              <Calculator size={14} className="text-slate-500 dark:text-slate-300" />
            ) : row.kind === 'analysis' ? (
              <BarChart3 size={14} className="text-slate-500 dark:text-slate-300" />
            ) : row.kind === 'prediction' ? (
              <TrendingUp size={14} className="text-slate-500 dark:text-slate-300" />
            ) : (
              <Target size={14} className="text-slate-500 dark:text-slate-300" />
            );
          return (
            <div className="flex items-center gap-2">
              {icon}
              <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-300">
                {code}
              </span>
            </div>
          );
        },
      },
      {
        id: 'title',
        label: t('common.name', { defaultValue: 'Name' }) as any,
        render: (row: FinanceRow) => (
          <div className="min-w-0">
            <span className="block text-sm text-slate-900 dark:text-white font-medium truncate">
              {row.title}
            </span>
          </div>
        ),
      },
      {
        id: 'status',
        label: t('common.status', { defaultValue: 'Status' }) as any,
        width: '140px',
        filterable: true,
        filterOptions: statusFilterOptions,
      },
      {
        id: 'updatedAt',
        label: t('common.updated', { defaultValue: 'Updated' }) as any,
        width: '120px',
        sortable: true,
      },
    ],
    [t, statusFilterOptions]
  );

  const columnsForActiveTab: TableColumn[] = useMemo(() => {
    if (activeTab === 'models' || activeTab === 'prediction') {
      return [
        baseColumns[0],
        baseColumns[1],
        {
          id: 'scenario',
          label: t('finance.columns.scenario', { defaultValue: 'Scenario' }) as any,
          width: '120px',
          render: (row: FinanceRow) =>
            row.kind === 'models' || row.kind === 'prediction' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.scenario}</span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'horizon',
          label: t('finance.columns.horizon', { defaultValue: 'Horizon' }) as any,
          width: '120px',
          render: (row: FinanceRow) =>
            row.kind === 'models' || row.kind === 'prediction' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {t('finance.horizonMonths', {
                  defaultValue: '{{n}} mo',
                  n: row.horizonMonths,
                }) as any}
              </span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        baseColumns[2],
        baseColumns[3],
      ];
    }

    if (activeTab === 'analysis') {
      return [
        baseColumns[0],
        baseColumns[1],
        {
          id: 'periodCount',
          label: t('finance.columns.periods', { defaultValue: 'Periods' }) as any,
          width: '110px',
          render: (row: FinanceRow) =>
            row.kind === 'analysis' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.periodCount}</span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        {
          id: 'currency',
          label: t('common.currency', { defaultValue: 'Currency' }) as any,
          width: '110px',
          render: (row: FinanceRow) =>
            row.kind === 'analysis' ? (
              <span className="text-sm text-slate-700 dark:text-slate-200">{row.currency}</span>
            ) : (
              <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
            ),
        },
        baseColumns[2],
        baseColumns[3],
      ];
    }

    return [
      baseColumns[0],
      baseColumns[1],
      {
        id: 'sourceType',
        label: t('finance.columns.source', { defaultValue: 'Source' }) as any,
        width: '140px',
        render: (row: FinanceRow) =>
          row.kind === 'valuation' ? (
            <span className="text-sm text-slate-700 dark:text-slate-200">{row.sourceType}</span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
          ),
      },
      {
        id: 'horizonYears',
        label: t('finance.columns.horizonYears', { defaultValue: 'Horizon' }) as any,
        width: '120px',
        render: (row: FinanceRow) =>
          row.kind === 'valuation' ? (
            <span className="text-sm text-slate-700 dark:text-slate-200">
              {t('finance.horizonYears', { defaultValue: '{{n}} y', n: row.horizonYears }) as any}
            </span>
          ) : (
            <span className="text-sm text-slate-500 dark:text-slate-400">—</span>
          ),
      },
      baseColumns[2],
      baseColumns[3],
    ];
  }, [activeTab, baseColumns, t]);

  const loadPredictionPreview = useCallback(async (modelId: string) => {
    try {
      const val = await Api.get(`/api/financial-modeling/models/${modelId}/validations`);
      setPredictionValidations((val as any)?.summary || null);
    } catch {
      setPredictionValidations(null);
    }
  }, []);

  const onSelectRow = useCallback(
    (row: FinanceRow) => {
      setSelectedId(row.id);
      setSelectedItem(row);
      if (row.kind === 'prediction') {
        loadPredictionPreview(row.id);
      } else {
        setPredictionValidations(null);
      }
    },
    [loadPredictionPreview]
  );

  const renderPreviewBody = useCallback(
    (row: FinanceRow) => {
      const metaPill = (label: string, value: string | React.ReactNode) => (
        <div className="inline-flex items-center gap-2 h-8 px-3 rounded-full border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200">
          <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
          <span className="text-xs font-medium">{value}</span>
        </div>
      );

      const detailsHeader = (title: string) => (
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </div>
          <button
            className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
            title={t('common.more', { defaultValue: 'More' }) as any}
            aria-label={t('common.more', { defaultValue: 'More' }) as any}
            onClick={() => toast(t('common.comingSoon', { defaultValue: 'Coming soon' }) as any)}
          >
            <MoreVertical size={14} />
          </button>
        </div>
      );

      return (
        <div className="space-y-4">
          {/* Brief / Meta row */}
          <div className="flex flex-wrap gap-2">
            {metaPill(t('common.type', { defaultValue: 'Type' }) as any, getTypeCode(row.kind))}
            {metaPill(t('common.status', { defaultValue: 'Status' }) as any, row.status)}
            {metaPill(
              t('common.updated', { defaultValue: 'Updated' }) as any,
              <span className="inline-flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                <span>{new Date(row.updatedAt).toLocaleDateString()}</span>
              </span>
            )}
          </div>

          {/* Details */}
          <div className="space-y-2">
            {detailsHeader(t('common.details', { defaultValue: 'Details' }) as any)}
            <div className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
              {(() => {
                switch (row.kind) {
                  case 'models':
                  case 'prediction':
                    return t('finance.preview.modelDetails', {
                      defaultValue:
                        'Scenario: {{scenario}}\nCurrency: {{currency}}\nHorizon: {{horizon}} months\nStart: {{start}}',
                      scenario: row.scenario,
                      currency: row.currency,
                      horizon: row.horizonMonths,
                      start: row.startDate || '—',
                    }) as any;
                  case 'analysis':
                    return t('finance.preview.analysisDetails', {
                      defaultValue: 'Type: {{type}}\nCurrency: {{currency}}\nPeriods: {{periods}}',
                      type: row.analysisType,
                      currency: row.currency,
                      periods: row.periodCount,
                    }) as any;
                  case 'valuation':
                    return t('finance.preview.valuationDetails', {
                      defaultValue: 'Source: {{source}}\nCurrency: {{currency}}\nHorizon: {{horizon}} years',
                      source: row.sourceType,
                      currency: row.currency,
                      horizon: row.horizonYears,
                    }) as any;
                }
              })()}
            </div>
          </div>
        </div>
      );
    },
    [t]
  );

  const renderPreviewFooter = useCallback(
    (row: FinanceRow) => {
      const divider = <div className="h-px bg-slate-200/70 dark:bg-white/[0.06]" />;

      const hintChip = (label: string) => (
        <button
          className="h-8 px-3 rounded-full border border-slate-200/70 dark:border-white/[0.08] text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
          onClick={() => toast(t('common.comingSoon', { defaultValue: 'Coming soon' }) as any)}
        >
          {label}
        </button>
      );

      const primaryPill = (label: string, onClick: () => void) => (
        <button
          onClick={onClick}
          className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium bg-hig-primary text-white hover:bg-hig-primary-hover transition-colors"
        >
          {label}
        </button>
      );

      const secondaryPill = (label: string, onClick: () => void) => (
        <button
          onClick={onClick}
          className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
        >
          {label}
        </button>
      );

      const aiKebab = (
        <button
          className="p-1.5 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
          title={t('common.more', { defaultValue: 'More' }) as any}
          aria-label={t('common.more', { defaultValue: 'More' }) as any}
          onClick={() => toast(t('common.comingSoon', { defaultValue: 'Coming soon' }) as any)}
        >
          <MoreVertical size={14} />
        </button>
      );

      return (
        <div className="space-y-3">
          {/* AI hints */}
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              AI
            </div>
            {aiKebab}
          </div>
          <div className="flex flex-wrap gap-2">
            {hintChip(t('finance.aiHints.why', { defaultValue: 'Dlaczego?' }) as any)}
            {hintChip(t('finance.aiHints.plan', { defaultValue: 'Plan działania' }) as any)}
            {hintChip(t('finance.aiHints.help', { defaultValue: 'Kto może pomóc?' }) as any)}
          </div>

          {divider}

          {/* Relations (2 rows reserved) */}
          <div className="space-y-2">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('common.relations', { defaultValue: 'Relations' }) as any}
            </div>
            <div className="min-h-[56px] flex flex-col justify-center gap-2">
              <div className="text-sm text-slate-500 dark:text-slate-400">
                {t('common.noRelations', { defaultValue: 'No relations' }) as any}
              </div>
            </div>
          </div>

          {divider}

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {row.kind === 'prediction'
                ? primaryPill(
                    t('finance.actions.compute', { defaultValue: 'Przelicz' }) as any,
                    async () => {
                      try {
                        await Api.post(`/api/financial-modeling/models/${row.id}/compute`, {});
                        await loadPredictionPreview(row.id);
                        toast.success(
                          t('finance.toast.computed', { defaultValue: 'Prognoza przeliczona' }) as any
                        );
                      } catch (e: any) {
                        toast.error(
                          e?.response?.data?.error ||
                            t('finance.toast.computeFailed', {
                              defaultValue: 'Nie udało się przeliczyć',
                            }) ||
                            'Compute failed'
                        );
                      }
                    }
                  )
                : null}
              {secondaryPill(t('common.open', { defaultValue: 'Otwórz' }) as any, () => handleOpenFull(row))}
            </div>
            {row.kind === 'prediction' && predictionValidations ? (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('finance.prediction.validationSummary', {
                  defaultValue: 'Validations: {{pass}} pass • {{warning}} warn • {{fail}} fail',
                  pass: predictionValidations.pass,
                  warning: predictionValidations.warning,
                  fail: predictionValidations.fail,
                }) as any}
              </div>
            ) : null}
          </div>
        </div>
      );
    },
    [t, handleOpenFull, predictionValidations, loadPredictionPreview]
  );

  const tableWithPreview = useMemo(() => {
    const emptyMessage =
      activeTab === 'models'
        ? (t('finance.empty.models', {
            defaultValue: 'Brak modeli. Dodaj pierwszy model finansowy.',
          }) as any)
        : activeTab === 'analysis'
          ? (t('finance.empty.analysis', {
              defaultValue: 'Brak analiz. Utwórz pierwszą analizę.',
            }) as any)
          : activeTab === 'prediction'
            ? (t('finance.empty.prediction', {
                defaultValue: 'Brak danych do predykcji. Najpierw utwórz model.',
              }) as any)
            : (t('finance.empty.valuation', {
                defaultValue: 'Brak wycen. Utwórz pierwszą wycenę.',
              }) as any);

    return (
      <TableWithPreviewLayout
        selectedId={selectedId}
        selectedItem={selectedItem}
        onSelect={(id) => {
          if (!id) {
            setSelectedId(null);
            setSelectedItem(null);
            setPredictionValidations(null);
            return;
          }
          const row = filteredRows.find((r) => r.id === id) || null;
          if (row) onSelectRow(row);
        }}
        onOpenFull={(id) => {
          const row = filteredRows.find((r) => r.id === id);
          if (row) handleOpenFull(row);
        }}
        renderKicker={(item) => {
          const label =
            item.kind === 'models'
              ? t('finance.kicker.models', { defaultValue: 'Model finansowy' })
              : item.kind === 'analysis'
                ? t('finance.kicker.analysis', { defaultValue: 'Analiza finansowa' })
                : item.kind === 'prediction'
                  ? t('finance.kicker.prediction', { defaultValue: 'Predykcja finansowa' })
                  : t('finance.kicker.valuation', { defaultValue: 'Wycena przedsiębiorstwa' });
          return String(label);
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
          onRowClick={(row) => onSelectRow(row as any)}
          onRowDoubleClick={(row) => handleOpenFull(row as any)}
          onRowAction={(action, row) => {
            if (action === 'preview' || action === 'edit' || action === 'open') {
              handleOpenFull(row as any);
            }
          }}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage={emptyMessage}
        />
      </TableWithPreviewLayout>
    );
  }, [
    activeTab,
    t,
    selectedId,
    selectedItem,
    filteredRows,
    columnsForActiveTab,
    activeFilters,
    onSelectRow,
    handleOpenFull,
    renderPreviewBody,
    renderPreviewFooter,
  ]);

  const fullView = useMemo(() => {
    if (!activeDocumentId || !activeDocument) return null;
    const code = getTypeCode(activeDocument.kind);
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
              {t('common.backToList', { defaultValue: 'Wróć do listy' }) as any}
            </button>
          </div>
          <div className="p-4">
            <pre className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
              {JSON.stringify(activeDocument, null, 2)}
            </pre>
          </div>
        </div>
      </div>
    );
  }, [activeDocumentId, activeDocument, t, handleShowList]);

  const content = useMemo(() => {
    if (loadingTab) {
      return (
        <div className="flex items-center justify-center h-full py-24">
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {t('common.loading', { defaultValue: 'Loading…' }) as any}
          </div>
        </div>
      );
    }
    if (activeDocumentId && activeDocument) return fullView;
    return tableWithPreview;
  }, [loadingTab, t, activeDocumentId, activeDocument, fullView, tableWithPreview]);

  return (
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
      availableViewModes={['table']}
      rightControls={null}
    >
      {content}
    </ModuleHub>
  );
};

export default FinanceHub;

