/**
 * BenefitsHub
 * Unified Benefits Realization module with 3 tabs (Completed, KPIs, ROI)
 * Uses shared ModuleHub components for consistent UX
 */

import {
  AlertCircle,
  Archive,
  Ban,
  BarChart3,
  Calculator,
  CheckCircle2,
  DollarSign,
  FileText,
  PieChart,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { LoadingState } from '@/components/shared/states';
import { Api } from '@/services/api';
import { getStatusesForModule, STATUS_METADATA } from '@/services/initiativeLifecycle';
import type { InitiativeKPI } from '@/types/core';

import { InitiativeStatus } from '../../types';
import { InitiativeDocumentView } from '../Initiatives/InitiativeDocumentView';
import { extractInitiativeKpiRows } from '../Initiatives/initiativeKpiContract';
import {
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ItemStatus,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { StandardModuleBar } from '../standard/StandardModuleBar';
import { BudgetWorkspace } from './BudgetWorkspace';
import { FinancialAnalysisWorkspace } from './FinancialAnalysisWorkspace';
import { FinancialMappingPanel } from './FinancialMappingPanel';
import { KPIAttributionPanel } from './KPIAttributionPanel';
import { ROITrackingPanel } from './ROITrackingPanel';
import { ValuationWorkspace } from './ValuationWorkspace';

// Initiative interface for this view
interface BenefitsInitiative {
  id: string;
  name: string;
  summary?: string;
  axis: string;
  status: InitiativeStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  costCapex?: number;
  expectedRoi?: number;
  completedAt?: string;
  blockedReason?: string;
  cancelledReason?: string;
  projectId?: string;
  projectName?: string;
  progress?: number;
  updatedAt?: string;
}

const MODULE_STATUSES = getStatusesForModule('benefits');
const BENEFITS_STATUSES: InitiativeStatus[] =
  MODULE_STATUSES.length > 0 ? MODULE_STATUSES : [InitiativeStatus.DONE];

const STATUS_META: Record<
  InitiativeStatus,
  { label: string; dotColor: string; icon: React.ReactNode }
> = {
  [InitiativeStatus.PENDING_REVIEW]: {
    label: STATUS_METADATA[InitiativeStatus.PENDING_REVIEW].label,
    dotColor: STATUS_METADATA[InitiativeStatus.PENDING_REVIEW].dotColor,
    icon: <FileText size={14} />,
  },
  [InitiativeStatus.PROMOTED]: {
    label: STATUS_METADATA[InitiativeStatus.PROMOTED].label,
    dotColor: STATUS_METADATA[InitiativeStatus.PROMOTED].dotColor,
    icon: <TrendingUp size={14} />,
  },
  [InitiativeStatus.DONE]: {
    label: STATUS_METADATA[InitiativeStatus.DONE].label,
    dotColor: STATUS_METADATA[InitiativeStatus.DONE].dotColor,
    icon: <CheckCircle2 size={14} />,
  },
  [InitiativeStatus.BLOCKED]: {
    label: STATUS_METADATA[InitiativeStatus.BLOCKED].label,
    dotColor: STATUS_METADATA[InitiativeStatus.BLOCKED].dotColor,
    icon: <AlertCircle size={14} />,
  },
  [InitiativeStatus.CANCELLED]: {
    label: STATUS_METADATA[InitiativeStatus.CANCELLED].label,
    dotColor: STATUS_METADATA[InitiativeStatus.CANCELLED].dotColor,
    icon: <Ban size={14} />,
  },
  [InitiativeStatus.ARCHIVED]: {
    label: STATUS_METADATA[InitiativeStatus.ARCHIVED].label,
    dotColor: STATUS_METADATA[InitiativeStatus.ARCHIVED].dotColor,
    icon: <Archive size={14} />,
  },
  [InitiativeStatus.PLANNING]: {
    label: STATUS_METADATA[InitiativeStatus.PLANNING].label,
    dotColor: STATUS_METADATA[InitiativeStatus.PLANNING].dotColor,
    icon: <Target size={14} />,
  },
  [InitiativeStatus.REVIEW]: {
    label: STATUS_METADATA[InitiativeStatus.REVIEW].label,
    dotColor: STATUS_METADATA[InitiativeStatus.REVIEW].dotColor,
    icon: <FileText size={14} />,
  },
  [InitiativeStatus.APPROVED]: {
    label: STATUS_METADATA[InitiativeStatus.APPROVED].label,
    dotColor: STATUS_METADATA[InitiativeStatus.APPROVED].dotColor,
    icon: <CheckCircle2 size={14} />,
  },
  [InitiativeStatus.SCHEDULED]: {
    label: STATUS_METADATA[InitiativeStatus.SCHEDULED].label,
    dotColor: STATUS_METADATA[InitiativeStatus.SCHEDULED].dotColor,
    icon: <Target size={14} />,
  },
  [InitiativeStatus.EXECUTING]: {
    label: STATUS_METADATA[InitiativeStatus.EXECUTING].label,
    dotColor: STATUS_METADATA[InitiativeStatus.EXECUTING].dotColor,
    icon: <Target size={14} />,
  },
  [InitiativeStatus.TRACKING]: {
    label: STATUS_METADATA[InitiativeStatus.TRACKING].label,
    dotColor: STATUS_METADATA[InitiativeStatus.TRACKING].dotColor,
    icon: <BarChart3 size={14} />,
  },
  [InitiativeStatus.DRAFT]: {
    label: STATUS_METADATA[InitiativeStatus.DRAFT].label,
    dotColor: STATUS_METADATA[InitiativeStatus.DRAFT].dotColor,
    icon: <FileText size={14} />,
  },
};

// Type codes
const getTypeCode = (axis: string): string => {
  const codes: Record<string, string> = {
    PROCESSES: 'PRC',
    DIGITAL: 'DIG',
    MODELS: 'MDL',
    DATA: 'DAT',
    CULTURE: 'CUL',
    CYBERSECURITY: 'SEC',
    AI: 'AI',
  };
  return codes[axis] || 'BEN';
};

interface BenefitsHubProps {
  initialTab?: ModuleTab;
}

export const BenefitsHub: React.FC<BenefitsHubProps> = ({ initialTab = 'list' }) => {
  const { t } = useTranslation();

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Data state
  const [initiatives, setInitiatives] = useState<BenefitsInitiative[]>([]);
  const [kpis, setKpis] = useState<{ initiative: BenefitsInitiative; kpis: InitiativeKPI[] }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [selectedInitiative, setSelectedInitiative] = useState<BenefitsInitiative | null>(null);
  // canon §7.1: selected row id for side-preview (Benefits 'list' tab)
  const [selectedBenefitId, setSelectedBenefitId] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await Api.get(`/initiatives/by-status/${BENEFITS_STATUSES.join(',')}`);
        const mapped = (response.initiatives || []) as BenefitsInitiative[];
        setInitiatives(mapped);

        // Fetch KPIs for DONE initiatives
        const doneInitiatives = mapped.filter((i) => i.status === InitiativeStatus.DONE);
        const kpiPromises = doneInitiatives.map(async (i) => {
          try {
            const kpiResponse = await Api.get(`/initiatives/${i.id}/kpis`);
            return { initiative: i, kpis: extractInitiativeKpiRows(kpiResponse) };
          } catch {
            return { initiative: i, kpis: [] };
          }
        });
        const kpiResults = await Promise.all(kpiPromises);
        setKpis(kpiResults);
      } catch (err) {
        console.error('[BenefitsHub] Failed to load:', err);
        toast.error('Failed to load benefits data');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  // Calculate stats
  const stats = useMemo(
    () => ({
      done: initiatives.filter((i) => i.status === InitiativeStatus.DONE).length,
      blocked: initiatives.filter((i) => i.status === InitiativeStatus.BLOCKED).length,
      cancelled: initiatives.filter((i) => i.status === InitiativeStatus.CANCELLED).length,
      archived: initiatives.filter((i) => i.status === InitiativeStatus.ARCHIVED).length,
    }),
    [initiatives]
  );

  const kpiStats = useMemo(() => {
    const result = { onTarget: 0, belowTarget: 0, total: 0 };
    kpis.forEach((item) => {
      item.kpis.forEach((kpi) => {
        result.total++;
        if (kpi.isOnTarget) result.onTarget++;
        else result.belowTarget++;
      });
    });
    return result;
  }, [kpis]);

  // Filter initiatives
  const filteredInitiatives = useMemo(() => {
    let result = initiatives;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          i.name.toLowerCase().includes(query) || (i.summary || '').toLowerCase().includes(query)
      );
    }

    activeFilters.forEach((filter: FilterChip) => {
      if (filter.column === 'status') {
        result = result.filter((i) => i.status === filter.value);
      }
    });

    return result;
  }, [initiatives, searchQuery, activeFilters]);

  // Extended tab type with custom IDs
  type BenefitsTab = ModuleTab | 'attribution' | 'financial' | 'valuation';
  const [extendedTab, setExtendedTab] = useState<BenefitsTab>(initialTab);

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: t('benefits.tabs.completed', 'Completed'),
        icon: <CheckCircle2 size={16} />,
        count: filteredInitiatives.length,
      },
      {
        id: 'reports' as ModuleTab,
        label: t('benefits.tabs.kpis', 'KPIs'),
        icon: <BarChart3 size={16} />,
        count: kpiStats.belowTarget > 0 ? kpiStats.belowTarget : undefined,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: t('benefits.tabs.roi', 'ROI Tracking'),
        icon: <TrendingUp size={16} />,
        count: undefined,
      },
      {
        id: 'attribution' as ModuleTab,
        label: t('benefits.tabs.attribution', 'Attribution'),
        icon: <PieChart size={16} />,
        count: undefined,
      },
      {
        id: 'financial' as ModuleTab,
        label: t('benefits.tabs.financial', 'Financial Mapping'),
        icon: <DollarSign size={16} />,
        count: undefined,
      },
      {
        id: 'analysis' as ModuleTab,
        label: t('finance.analysis.tabLabel', 'Analysis'),
        icon: <BarChart3 size={16} />,
        count: undefined,
      },
      {
        id: 'budget' as ModuleTab,
        label: t('finance.budget.tabLabel', 'Budget'),
        icon: <Calculator size={16} />,
        count: undefined,
      },
      {
        id: 'valuation' as ModuleTab,
        label: t('valuation.tabLabel', 'Valuation'),
        icon: <DollarSign size={16} />,
        count: undefined,
      },
    ],
    [t, filteredInitiatives.length, kpiStats.belowTarget]
  );

  // Table columns
  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'type',
        label: t('benefits.columns.type', 'Type'),
        width: '80px',
        render: (row) => {
          const code = getTypeCode(row.axis);
          return (
            <div className="flex items-center gap-2">
              <Target size={14} className="text-green-400" />
              <span className="font-mono text-xs font-bold text-c-text-secondary">{code}</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: t('benefits.columns.name', 'Name'),
        render: (row) => (
          <div>
            <span className="text-sm text-c-text dark:text-white font-medium">{row.name}</span>
            {(row.blockedReason || row.cancelledReason) && (
              <p className="text-xs text-rose-400 mt-0.5">
                {row.blockedReason || row.cancelledReason}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        label: t('benefits.columns.status', 'Status'),
        width: '130px',
        filterable: true,
        filterOptions: BENEFITS_STATUSES.map((status) => ({
          value: status,
          label: STATUS_META[status].label,
          color: STATUS_META[status].dotColor,
        })),
      },
      {
        id: 'roi',
        label: t('benefits.columns.roi', 'ROI'),
        width: '100px',
        render: (row) => {
          if (!row.expectedRoi || row.expectedRoi <= 0) {
            return <span className="text-c-text-muted text-sm">-</span>;
          }
          return <span className="text-green-400 text-sm font-medium">{row.expectedRoi}x</span>;
        },
      },
      {
        id: 'budget',
        label: t('benefits.columns.budget', 'Budget'),
        width: '120px',
        render: (row) => {
          if (!row.costCapex) return <span className="text-c-text-muted text-sm">-</span>;
          const formatted =
            row.costCapex >= 1000000
              ? `${(row.costCapex / 1000000).toFixed(1)}M`
              : row.costCapex >= 1000
                ? `${(row.costCapex / 1000).toFixed(0)}k`
                : row.costCapex;
          return <span className="text-c-text-secondary text-sm">{formatted} PLN</span>;
        },
      },
      {
        id: 'updatedAt',
        label: t('benefits.columns.completed', 'Completed'),
        width: '100px',
        sortable: true,
      },
    ],
    [t]
  );

  // Handlers
  const handleOpenDocument = useCallback((row: BenefitsInitiative) => {
    const code = getTypeCode(row.axis);

    const doc: OpenDocument = {
      id: row.id,
      type: 'initiative',
      subType: code,
      name: row.name,
      status:
        row.status === InitiativeStatus.DONE
          ? 'DONE'
          : row.status === InitiativeStatus.BLOCKED
            ? 'BLOCKED'
            : 'DRAFT',
    };

    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(row.id);
  }, []);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
      }
    },
    [activeDocumentId]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleRowAction = useCallback(
    (action: string, row: BenefitsInitiative) => {
      if (action === 'preview' || action === 'view' || action === 'edit') {
        handleOpenDocument(row);
      } else if (action === 'add-kpi') {
        setSelectedInitiative(row);
        setShowKpiModal(true);
      }
    },
    [handleOpenDocument]
  );

  const handleAddKpi = useCallback(() => {
    setShowKpiModal(true);
  }, []);

  // Convert to grid items
  const gridItems: GridItem[] = useMemo(() => {
    return filteredInitiatives.map((item) => ({
      ...item,
      type: getTypeCode(item.axis),
      typeColor: 'green',
      progress: item.progress || 100,
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      status: (item.status === InitiativeStatus.DONE
        ? 'DONE'
        : item.status === InitiativeStatus.BLOCKED
          ? 'BLOCKED'
          : 'DRAFT') as ItemStatus,
    }));
  }, [filteredInitiatives]);

  // Render KPIs Dashboard
  const renderKPIsDashboard = () => {
    return (
      <div className="p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-c-surface-raised dark:bg-c-surface-raised rounded-xl p-4 border border-c-border dark:border-c-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-c-info/20 rounded-lg">
                <Target className="w-5 h-5 text-c-info" />
              </div>
              <div>
                <p className="text-sm text-c-text-muted dark:text-c-text-muted">
                  {t('benefits.kpiCards.totalKpis', 'Total KPIs')}
                </p>
                <p className="text-2xl font-bold text-c-text dark:text-white">{kpiStats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-c-surface-raised dark:bg-c-surface-raised rounded-xl p-4 border border-c-border dark:border-c-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-c-text-secondary">
                  {t('benefits.kpiCards.onTarget', 'On Target')}
                </p>
                <p className="text-2xl font-bold text-green-400">{kpiStats.onTarget}</p>
              </div>
            </div>
          </div>
          <div className="bg-c-surface-raised dark:bg-c-surface-raised rounded-xl p-4 border border-c-border dark:border-c-border">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/20 rounded-lg">
                <TrendingDown className="w-5 h-5 text-rose-400" />
              </div>
              <div>
                <p className="text-sm text-c-text-muted dark:text-c-text-muted">
                  {t('benefits.kpiCards.belowTarget', 'Below Target')}
                </p>
                <p className="text-2xl font-bold text-rose-400">{kpiStats.belowTarget}</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs by Initiative */}
        {kpis.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BarChart3 className="w-12 h-12 text-c-text-secondary mb-3" />
            <p className="text-c-text-muted dark:text-c-text-muted">
              {t('benefits.kpiEmpty.noKpis', 'No KPIs defined yet')}
            </p>
            <p className="text-sm text-c-text-muted mt-1">
              {t(
                'benefits.kpiEmpty.completeToTrack',
                'Complete initiatives and add KPIs to track benefits'
              )}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {kpis.map(({ initiative, kpis: initiativeKpis }) => (
              <div
                key={initiative.id}
                className="bg-c-surface-raised dark:bg-c-surface-raised rounded-xl border border-c-border dark:border-c-border overflow-hidden"
              >
                <div className="px-4 py-3 bg-white dark:bg-c-surface border-b border-c-border dark:border-c-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <h3 className="font-semibold text-c-text dark:text-white">{initiative.name}</h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedInitiative(initiative);
                      setShowKpiModal(true);
                    }}
                    className="flex items-center gap-1 text-sm text-c-info hover:opacity-80"
                  >
                    <Plus size={14} />
                    {t('benefits.kpiActions.addKpi', 'Add KPI')}
                  </button>
                </div>

                {initiativeKpis.length === 0 ? (
                  <div className="p-6 text-center text-c-text-muted">
                    {t(
                      'benefits.kpiEmpty.noKpisForInitiative',
                      'No KPIs defined for this initiative'
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-c-border-subtle">
                    {initiativeKpis.map((kpi) => (
                      <div
                        key={kpi.id}
                        className="p-4 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised/50"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg ${kpi.isOnTarget ? 'bg-green-500/20' : 'bg-rose-500/20'}`}
                            >
                              {kpi.isOnTarget ? (
                                <TrendingUp className="w-4 h-4 text-green-400" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-rose-400" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium text-c-text dark:text-white">
                                {kpi.name}
                              </h4>
                              {kpi.description && (
                                <p className="text-sm text-c-text-muted dark:text-c-text-muted">
                                  {kpi.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <p className="text-xs text-c-text-muted">
                                {t('benefits.kpiLabels.current', 'Current')}
                              </p>
                              <p
                                className={`text-lg font-bold ${kpi.isOnTarget ? 'text-green-400' : 'text-rose-400'}`}
                              >
                                {kpi.latestValue ?? '-'} {kpi.unit}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-c-text-muted">
                                {t('benefits.kpiLabels.target', 'Target')}
                              </p>
                              <p className="text-lg font-bold text-c-text dark:text-white">
                                {kpi.targetValue ?? '-'} {kpi.unit}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render content
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="h-full p-6">
          <LoadingState template="list" rows={6} />
        </div>
      );
    }

    if (activeDocumentId) {
      return (
        <InitiativeDocumentView
          initiativeId={activeDocumentId}
          onBack={handleShowList}
          onStatusChange={() => {}}
          sourceModule="benefits"
        />
      );
    }

    // Tab: Completed (default)
    if (activeTab === 'list') {
      if (viewMode === 'grid') {
        return (
          <GridView
            items={gridItems}
            onItemClick={(item: GridItem) =>
              handleOpenDocument(item as unknown as BenefitsInitiative)
            }
            onItemAction={(action: string, item: GridItem) =>
              handleRowAction(action, item as unknown as BenefitsInitiative)
            }
            emptyMessage={t('benefits.empty.noCompleted', 'No completed initiatives yet.')}
          />
        );
      }
      // canon §2+§7.1: wrap in TableWithPreviewLayout; single-click → preview, double → full view
      type BenefitItemWithTitle = BenefitsInitiative & { title: string };
      const toBenefitItem = (row: BenefitsInitiative): BenefitItemWithTitle => ({
        ...row,
        title: row.name || 'Initiative',
      });
      const selectedBenefitRow = selectedBenefitId
        ? (filteredInitiatives.find((r) => r.id === selectedBenefitId) ?? null)
        : null;
      const selectedBenefitItem: BenefitItemWithTitle | null = selectedBenefitRow
        ? toBenefitItem(selectedBenefitRow)
        : null;

      return (
        <TableWithPreviewLayout<BenefitItemWithTitle>
          selectedId={selectedBenefitId}
          selectedItem={selectedBenefitItem}
          onSelect={setSelectedBenefitId}
          onOpenFull={(id) => {
            const row = filteredInitiatives.find((r) => r.id === id);
            if (row) handleOpenDocument(row);
          }}
          itemIds={filteredInitiatives.map((r) => r.id)}
          getItemById={(id) => {
            const r = filteredInitiatives.find((x) => x.id === id);
            return r ? toBenefitItem(r) : null;
          }}
          renderPreview={(item) => {
            const initiative = item as BenefitsInitiative;
            const meta = STATUS_META[initiative.status];
            return (
              <div className="space-y-4 px-4 pt-2">
                {/* Status pill */}
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${meta?.dotColor ?? 'bg-c-border-strong'}`}
                  />
                  <span className="text-xs font-medium text-c-text-secondary dark:text-c-text-secondary">
                    {meta?.label ?? initiative.status}
                  </span>
                </div>
                {/* Summary */}
                {initiative.summary && (
                  <p className="text-xs text-c-text-secondary dark:text-c-text-secondary leading-relaxed">
                    {initiative.summary}
                  </p>
                )}
                {/* Key metrics */}
                <div className="space-y-1.5">
                  {initiative.axis && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-c-text-muted">{t('benefits.axis', 'Axis')}</span>
                      <span className="text-c-text-secondary dark:text-c-text-secondary font-medium">
                        {initiative.axis}
                      </span>
                    </div>
                  )}
                  {initiative.progress != null && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-c-text-muted">
                        {t('benefits.progress', 'Progress')}
                      </span>
                      <span className="text-c-text-secondary dark:text-c-text-secondary font-medium">
                        {initiative.progress}%
                      </span>
                    </div>
                  )}
                  {initiative.expectedRoi != null && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-c-text-muted">{t('benefits.roi', 'Expected ROI')}</span>
                      <span className="text-c-text-secondary dark:text-c-text-secondary font-medium">
                        {initiative.expectedRoi}%
                      </span>
                    </div>
                  )}
                  {initiative.projectName && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-c-text-muted">{t('benefits.project', 'Project')}</span>
                      <span className="text-c-text-secondary dark:text-c-text-secondary font-medium truncate max-w-[120px]">
                        {initiative.projectName}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          }}
        >
          <div className="pl-4 pr-1.5 pt-3 pb-4">
            <FilterableTable
              columns={columns}
              data={filteredInitiatives}
              onRowClick={(row: any) => setSelectedBenefitId((row as BenefitsInitiative).id)}
              onRowDoubleClick={(row: any) => handleOpenDocument(row as BenefitsInitiative)}
              onRowAction={(action: string, row: any) =>
                handleRowAction(action, row as BenefitsInitiative)
              }
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              emptyMessage={t('benefits.empty.noCompleted', 'No completed initiatives yet.')}
            />
          </div>
        </TableWithPreviewLayout>
      );
    }

    // Tab: KPIs
    if (activeTab === 'reports') {
      return renderKPIsDashboard();
    }

    // Tab: ROI Tracking (T046)
    if (activeTab === 'initiatives') {
      return <ROITrackingPanel />;
    }

    // Tab: Attribution (T048)
    if ((activeTab as string) === 'attribution') {
      return <KPIAttributionPanel />;
    }

    // Tab: Financial Mapping (T049)
    if ((activeTab as string) === 'financial') {
      return <FinancialMappingPanel />;
    }
    if ((activeTab as string) === 'analysis') {
      return <FinancialAnalysisWorkspace />;
    }
    if ((activeTab as string) === 'budget') {
      return <BudgetWorkspace />;
    }
    if ((activeTab as string) === 'valuation') {
      return <ValuationWorkspace />;
    }

    return null;
  };

  // Category button for adding KPI
  const categoryButtons = useMemo(() => {
    if (activeTab === 'reports') {
      return [
        {
          id: 'add-kpi',
          label: t('benefits.kpiActions.addKpi', 'Add KPI'),
          icon: <Plus size={16} />,
          count: 0,
          onClick: handleAddKpi,
        },
      ];
    }
    return [];
  }, [activeTab, handleAddKpi]);

  return (
    <>
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setExtendedTab(tab as BenefitsTab);
        }}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openItems={openDocuments}
        activeItemId={activeDocumentId}
        onSelectItem={setActiveDocumentId}
        onCloseItem={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        categoryButtons={categoryButtons.length > 0 ? categoryButtons : undefined}
      >
        {renderContent()}
      </StandardModuleBar>

      {/* Add KPI Modal */}
      {showKpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-c-text dark:text-white mb-4">
              Add KPI {selectedInitiative ? `for ${selectedInitiative.name}` : ''}
            </h2>
            <p className="text-c-text-muted dark:text-c-text-muted text-sm mb-6">
              KPI creation form placeholder - connect to existing KPI component
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowKpiModal(false);
                  setSelectedInitiative(null);
                }}
                className="px-4 py-2 text-sm text-c-text-muted dark:text-c-text-muted hover:text-c-text dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toast.success('KPI creation would happen here');
                  setShowKpiModal(false);
                  setSelectedInitiative(null);
                }}
                className="px-4 py-2 bg-c-text text-c-bg hover:opacity-90 text-sm font-medium rounded-lg"
              >
                Create KPI
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default BenefitsHub;
