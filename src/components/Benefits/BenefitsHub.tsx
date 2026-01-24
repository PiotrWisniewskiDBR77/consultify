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
  CheckCircle2,
  FileText,
  Loader2,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { getStatusesForModule, STATUS_METADATA } from '@/services/initiativeLifecycle';

import { InitiativeKPI, InitiativeStatus } from '../../types';
import {
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ItemStatus,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';

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
  [InitiativeStatus.EXECUTING]: {
    label: STATUS_METADATA[InitiativeStatus.EXECUTING].label,
    dotColor: STATUS_METADATA[InitiativeStatus.EXECUTING].dotColor,
    icon: <Target size={14} />,
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
            return { initiative: i, kpis: kpiResponse.kpis || [] };
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
        label: t('benefits.tabs.roi', 'ROI Analysis'),
        icon: <TrendingUp size={16} />,
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
        label: 'Type',
        width: '80px',
        render: (row) => {
          const code = getTypeCode(row.axis);
          return (
            <div className="flex items-center gap-2">
              <Target size={14} className="text-green-400" />
              <span className="font-mono text-xs font-bold text-slate-300">{code}</span>
            </div>
          );
        },
      },
      {
        id: 'name',
        label: 'Name',
        render: (row) => (
          <div>
            <span className="text-sm text-white font-medium">{row.name}</span>
            {(row.blockedReason || row.cancelledReason) && (
              <p className="text-xs text-red-400 mt-0.5">
                {row.blockedReason || row.cancelledReason}
              </p>
            )}
          </div>
        ),
      },
      {
        id: 'status',
        label: 'Status',
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
        label: 'ROI',
        width: '100px',
        render: (row) => {
          if (!row.expectedRoi || row.expectedRoi <= 0) {
            return <span className="text-slate-500 text-sm">-</span>;
          }
          return <span className="text-green-400 text-sm font-medium">{row.expectedRoi}x</span>;
        },
      },
      {
        id: 'budget',
        label: 'Budget',
        width: '120px',
        render: (row) => {
          if (!row.costCapex) return <span className="text-slate-500 text-sm">-</span>;
          const formatted =
            row.costCapex >= 1000000
              ? `${(row.costCapex / 1000000).toFixed(1)}M`
              : row.costCapex >= 1000
                ? `${(row.costCapex / 1000).toFixed(0)}k`
                : row.costCapex;
          return <span className="text-slate-300 text-sm">{formatted} PLN</span>;
        },
      },
      {
        id: 'updatedAt',
        label: 'Completed',
        width: '100px',
        sortable: true,
      },
    ],
    []
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
          ? 'completed'
          : row.status === InitiativeStatus.BLOCKED
            ? 'in_review'
            : 'draft',
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
      if (action === 'view' || action === 'edit') {
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
        ? 'completed'
        : item.status === InitiativeStatus.BLOCKED
          ? 'in_review'
          : 'draft') as ItemStatus,
    }));
  }, [filteredInitiatives]);

  // Render KPIs Dashboard
  const renderKPIsDashboard = () => {
    return (
      <div className="p-6 space-y-6">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Total KPIs</p>
                <p className="text-2xl font-bold text-white">{kpiStats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">On Target</p>
                <p className="text-2xl font-bold text-green-400">{kpiStats.onTarget}</p>
              </div>
            </div>
          </div>
          <div className="bg-navy-800 rounded-xl p-4 border border-navy-700">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <TrendingDown className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-slate-400">Below Target</p>
                <p className="text-2xl font-bold text-red-400">{kpiStats.belowTarget}</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs by Initiative */}
        {kpis.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BarChart3 className="w-12 h-12 text-slate-600 mb-3" />
            <p className="text-slate-400">No KPIs defined yet</p>
            <p className="text-sm text-slate-500 mt-1">
              Complete initiatives and add KPIs to track benefits
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {kpis.map(({ initiative, kpis: initiativeKpis }) => (
              <div
                key={initiative.id}
                className="bg-navy-800 rounded-xl border border-navy-700 overflow-hidden"
              >
                <div className="px-4 py-3 bg-navy-900 border-b border-navy-700 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <h3 className="font-semibold text-white">{initiative.name}</h3>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedInitiative(initiative);
                      setShowKpiModal(true);
                    }}
                    className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300"
                  >
                    <Plus size={14} />
                    Add KPI
                  </button>
                </div>

                {initiativeKpis.length === 0 ? (
                  <div className="p-6 text-center text-slate-500">
                    No KPIs defined for this initiative
                  </div>
                ) : (
                  <div className="divide-y divide-navy-700">
                    {initiativeKpis.map((kpi) => (
                      <div key={kpi.id} className="p-4 hover:bg-navy-700/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className={`p-2 rounded-lg ${kpi.isOnTarget ? 'bg-green-500/20' : 'bg-red-500/20'}`}
                            >
                              {kpi.isOnTarget ? (
                                <TrendingUp className="w-4 h-4 text-green-400" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-400" />
                              )}
                            </div>
                            <div>
                              <h4 className="font-medium text-white">{kpi.name}</h4>
                              {kpi.description && (
                                <p className="text-sm text-slate-400">{kpi.description}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-6 text-right">
                            <div>
                              <p className="text-xs text-slate-500">Current</p>
                              <p
                                className={`text-lg font-bold ${kpi.isOnTarget ? 'text-green-400' : 'text-red-400'}`}
                              >
                                {kpi.latestValue ?? '-'} {kpi.unit}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500">Target</p>
                              <p className="text-lg font-bold text-white">
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
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
        </div>
      );
    }

    if (activeDocumentId) {
      const doc = openDocuments.find((d) => d.id === activeDocumentId);
      const initiative = initiatives.find((i) => i.id === activeDocumentId);
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-400/50" />
            <p className="text-lg text-white">Benefits Details: {doc?.name}</p>
            <p className="text-sm text-slate-400">
              ({doc?.subType} - {STATUS_META[initiative?.status || InitiativeStatus.DONE]?.label})
            </p>
            <p className="mt-4 text-xs">Connect to existing benefits workspace</p>
          </div>
        </div>
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
            emptyMessage="No completed initiatives yet."
          />
        );
      }
      return (
        <FilterableTable
          columns={columns}
          data={filteredInitiatives}
          onRowClick={(row: any) => handleOpenDocument(row as BenefitsInitiative)}
          onRowAction={(action: string, row: any) =>
            handleRowAction(action, row as BenefitsInitiative)
          }
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage="No completed initiatives yet."
        />
      );
    }

    // Tab: KPIs
    if (activeTab === 'reports') {
      return renderKPIsDashboard();
    }

    // Tab: ROI Analysis
    if (activeTab === 'initiatives') {
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 text-emerald-400/50" />
            <p className="text-lg text-white">ROI Analysis</p>
            <p className="text-sm text-slate-400">Return on investment calculations</p>
            <p className="mt-4 text-xs">Connect to existing ROI component</p>
          </div>
        </div>
      );
    }

    return null;
  };

  // Category button for adding KPI
  const categoryButtons = useMemo(() => {
    if (activeTab === 'reports') {
      return [
        {
          id: 'add-kpi',
          label: 'Add KPI',
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
      <ModuleHub
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        categoryButtons={categoryButtons.length > 0 ? categoryButtons : undefined}
      >
        {renderContent()}
      </ModuleHub>

      {/* Add KPI Modal */}
      {showKpiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">
              Add KPI {selectedInitiative ? `for ${selectedInitiative.name}` : ''}
            </h2>
            <p className="text-slate-400 text-sm mb-6">
              KPI creation form placeholder - connect to existing KPI component
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowKpiModal(false);
                  setSelectedInitiative(null);
                }}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  toast.success('KPI creation would happen here');
                  setShowKpiModal(false);
                  setSelectedInitiative(null);
                }}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500"
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
