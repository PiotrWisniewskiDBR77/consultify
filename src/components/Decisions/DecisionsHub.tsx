/**
 * DecisionsHub
 * Decision Management module with ModuleHub UI pattern
 * Uses shared ModuleHub components for consistent UX
 *
 * Tabs: My Decisions, Awaiting Others, All
 * Views: Table, Grid
 */

import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  Loader2,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

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
import DecisionCard, { Decision } from './DecisionCard';
import { useAppStore } from '../../store/useAppStore';

// Decision status mapping
const STATUS_META: Record<
  string,
  { label: string; dotColor: string; itemStatus: ItemStatus }
> = {
  PENDING: { label: 'Pending', dotColor: 'bg-amber-400', itemStatus: 'in_review' },
  APPROVED: { label: 'Approved', dotColor: 'bg-emerald-400', itemStatus: 'completed' },
  REJECTED: { label: 'Rejected', dotColor: 'bg-red-400', itemStatus: 'completed' },
  ESCALATED: { label: 'Escalated', dotColor: 'bg-orange-400', itemStatus: 'in_review' },
};

// Priority badge colors
const PRIORITY_META: Record<string, { label: string; color: string }> = {
  CRITICAL: { label: 'Critical', color: 'text-red-400 bg-red-500/20' },
  HIGH: { label: 'High', color: 'text-orange-400 bg-orange-500/20' },
  MEDIUM: { label: 'Medium', color: 'text-amber-400 bg-amber-500/20' },
  LOW: { label: 'Low', color: 'text-slate-400 bg-slate-500/20' },
};

// Context type icons
const getContextIcon = (contextType: string): string => {
  const icons: Record<string, string> = {
    initiative: '🎯',
    task: '✅',
    assessment: '📊',
    tool: '🔧',
    analysis: '💰',
  };
  return icons[contextType?.toLowerCase()] || '📋';
};

interface DecisionsHubProps {
  projectId?: string;
  initialTab?: ModuleTab;
  onDecisionClick?: (decisionId: string) => void;
  onCreateDecision?: () => void;
}

export const DecisionsHub: React.FC<DecisionsHubProps> = ({
  projectId,
  initialTab = 'list',
  onDecisionClick,
  onCreateDecision,
}) => {
  const { t } = useTranslation();

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Data state
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);

  // App store
  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentUserId = useAppStore((state) => state.currentUser?.id);
  const effectiveProjectId = projectId || currentProjectId;

  // Fetch decisions
  const fetchDecisions = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setIsLoading(true);

      const url = effectiveProjectId
        ? `/decisions?projectId=${effectiveProjectId}&includeAll=true`
        : '/decisions?includeAll=true';

      const data = await Api.get(url);
      const decisionsList = Array.isArray(data) ? data : data?.decisions || [];

      // Enhance decisions with computed fields
      const enhanced = decisionsList.map((d: Decision) => {
        const daysWaiting =
          d.daysWaiting ||
          Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = daysWaiting > 7;
        const daysOverdue = Math.max(0, daysWaiting - 7);
        return {
          ...d,
          daysWaiting,
          isOverdue,
          daysOverdue,
          escalationLevel: d.escalationLevel || 0,
        };
      });

      setDecisions(enhanced);
    } catch (error) {
      console.error('[DecisionsHub] Failed to fetch decisions:', error);
      toast.error(t('decisions.fetchError', 'Failed to load decisions'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [effectiveProjectId, t]);

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  // Calculate stats
  const stats = useMemo(() => {
    const pending = decisions.filter((d) => ['PENDING', 'ESCALATED'].includes(d.status));
    return {
      total: pending.length,
      my: pending.filter((d) => d.decisionOwnerId === currentUserId).length,
      awaiting: pending.filter(
        (d) => d.requestedById === currentUserId && d.decisionOwnerId !== currentUserId
      ).length,
      overdue: pending.filter((d) => d.isOverdue).length,
      escalated: pending.filter((d) => d.status === 'ESCALATED').length,
    };
  }, [decisions, currentUserId]);

  // Filter decisions based on active tab
  const getFilteredByTab = useCallback(
    (tab: ModuleTab): Decision[] => {
      let filtered = decisions.filter((d) => ['PENDING', 'ESCALATED'].includes(d.status));

      switch (tab) {
        case 'list': // My Decisions
          filtered = filtered.filter((d) => d.decisionOwnerId === currentUserId);
          break;
        case 'reports': // Awaiting Others
          filtered = filtered.filter(
            (d) => d.requestedById === currentUserId && d.decisionOwnerId !== currentUserId
          );
          break;
        case 'initiatives': // All
          // No additional filter, show all pending
          break;
      }

      return filtered;
    },
    [decisions, currentUserId]
  );

  // Filter and sort decisions
  const filteredDecisions = useMemo(() => {
    let filtered = getFilteredByTab(activeTab);

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(query) ||
          d.description?.toLowerCase().includes(query) ||
          d.projectName?.toLowerCase().includes(query)
      );
    }

    // Apply column filters
    activeFilters.forEach((filter: FilterChip) => {
      if (filter.column === 'status') {
        filtered = filtered.filter((d) => d.status === filter.value);
      }
      if (filter.column === 'priority') {
        filtered = filtered.filter((d) => d.priority === filter.value);
      }
      if (filter.column === 'context') {
        filtered = filtered.filter(
          (d) =>
            d.contextType === filter.value ||
            d.relatedObjectType?.toLowerCase() === filter.value
        );
      }
    });

    // Sort by urgency by default (escalated first, then overdue, then by days waiting)
    filtered.sort((a, b) => {
      if (a.status === 'ESCALATED' && b.status !== 'ESCALATED') return -1;
      if (b.status === 'ESCALATED' && a.status !== 'ESCALATED') return 1;
      if (a.isOverdue && !b.isOverdue) return -1;
      if (b.isOverdue && !a.isOverdue) return 1;
      return (b.daysWaiting || 0) - (a.daysWaiting || 0);
    });

    return filtered;
  }, [activeTab, getFilteredByTab, searchQuery, activeFilters]);

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: t('decisions.myDecisions', 'My Decisions'),
        icon: <User size={16} />,
        count: stats.my,
      },
      {
        id: 'reports' as ModuleTab,
        label: t('decisions.awaiting', 'Awaiting Others'),
        icon: <Hourglass size={16} />,
        count: stats.awaiting,
      },
      {
        id: 'initiatives' as ModuleTab,
        label: t('decisions.all', 'All'),
        icon: <Clock size={16} />,
        count: stats.total,
      },
    ],
    [t, stats]
  );

  // Table columns
  const columns: TableColumn[] = useMemo(
    () => [
      {
        id: 'priority',
        label: t('decisions.priority', 'Priority'),
        width: '100px',
        filterable: true,
        filterOptions: Object.entries(PRIORITY_META).map(([value, meta]) => ({
          value,
          label: meta.label,
          color: meta.color,
        })),
        render: (row: Decision) => {
          const meta = PRIORITY_META[row.priority || 'MEDIUM'] || PRIORITY_META.MEDIUM;
          return (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${meta.color}`}>
              {meta.label}
            </span>
          );
        },
      },
      {
        id: 'title',
        label: t('decisions.title', 'Title'),
        render: (row: Decision) => (
          <div>
            <span className="text-sm text-white font-medium">{row.title}</span>
            {row.projectName && (
              <p className="text-xs text-slate-400 mt-0.5">{row.projectName}</p>
            )}
          </div>
        ),
      },
      {
        id: 'context',
        label: t('decisions.context', 'Context'),
        width: '120px',
        render: (row: Decision) => {
          const contextType = row.contextType || row.relatedObjectType || 'task';
          return (
            <div className="flex items-center gap-2">
              <span>{getContextIcon(contextType)}</span>
              <span className="text-sm text-slate-300 capitalize">{contextType}</span>
            </div>
          );
        },
      },
      {
        id: 'status',
        label: t('decisions.status', 'Status'),
        width: '130px',
        filterable: true,
        filterOptions: Object.entries(STATUS_META).map(([value, meta]) => ({
          value,
          label: meta.label,
          color: meta.dotColor,
        })),
        render: (row: Decision) => {
          const meta = STATUS_META[row.status] || STATUS_META.PENDING;
          return (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
              <span className="text-sm text-slate-300">{meta.label}</span>
            </div>
          );
        },
      },
      {
        id: 'daysWaiting',
        label: t('decisions.waiting', 'Waiting'),
        width: '100px',
        sortable: true,
        render: (row: Decision) => {
          const days = row.daysWaiting || 0;
          const isOverdue = row.isOverdue;
          return (
            <div className="flex items-center gap-1">
              {isOverdue && <AlertTriangle size={14} className="text-red-400" />}
              <span className={`text-sm ${isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                {days}d
              </span>
            </div>
          );
        },
      },
    ],
    [t]
  );

  // Handlers
  const handleOpenDocument = useCallback((decision: Decision) => {
    const statusMeta = STATUS_META[decision.status] || STATUS_META.PENDING;

    const doc: OpenDocument = {
      id: decision.id,
      type: 'initiative', // Using 'initiative' as it's the closest match
      subType: decision.priority || 'MEDIUM',
      name: decision.title,
      status: statusMeta.itemStatus,
    };

    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(decision.id);
    setSelectedDecision(decision);

    // Callback for external handlers
    if (onDecisionClick) {
      onDecisionClick(decision.id);
    }
  }, [onDecisionClick]);

  const handleCloseDocument = useCallback(
    (id: string) => {
      setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
        setSelectedDecision(null);
      }
    },
    [activeDocumentId]
  );

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
    setSelectedDecision(null);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleRowAction = useCallback(
    (action: string, row: Decision) => {
      if (action === 'view' || action === 'edit') {
        handleOpenDocument(row);
      }
    },
    [handleOpenDocument]
  );

  const handleApprove = useCallback(async (id: string) => {
    try {
      await Api.put(`/decisions/${id}/decide`, {
        status: 'APPROVED',
        outcome: t('decisions.defaultApproveRationale', 'Approved via quick action'),
      });
      toast.success(t('decisions.approved', 'Decision approved'));
      fetchDecisions(true);
    } catch (error) {
      console.error('Failed to approve:', error);
      toast.error(t('decisions.approveError', 'Failed to approve decision'));
    }
  }, [fetchDecisions, t]);

  const handleReject = useCallback(async (id: string) => {
    try {
      await Api.put(`/decisions/${id}/decide`, {
        status: 'REJECTED',
        outcome: t('decisions.defaultRejectRationale', 'Rejected via quick action'),
      });
      toast.success(t('decisions.rejected', 'Decision rejected'));
      fetchDecisions(true);
    } catch (error) {
      console.error('Failed to reject:', error);
      toast.error(t('decisions.rejectError', 'Failed to reject decision'));
    }
  }, [fetchDecisions, t]);

  const handleEscalate = useCallback(async (id: string) => {
    try {
      await Api.post(`/decisions/${id}/escalate`, {});
      toast.success(t('decisions.escalated', 'Decision escalated'));
      fetchDecisions(true);
    } catch (error) {
      console.error('Failed to escalate:', error);
      toast.error(t('decisions.escalateError', 'Failed to escalate decision'));
    }
  }, [fetchDecisions, t]);

  // Convert to grid items
  const gridItems: GridItem[] = useMemo(() => {
    return filteredDecisions.map((item) => {
      const statusMeta = STATUS_META[item.status] || STATUS_META.PENDING;
      const daysWaiting = item.daysWaiting || 0;
      return {
        id: item.id,
        name: item.title,
        type: item.priority || 'MEDIUM',
        typeColor: item.priority === 'CRITICAL' ? 'red' : item.priority === 'HIGH' ? 'orange' : 'amber',
        status: statusMeta.itemStatus,
        progress: Math.max(0, Math.min(100, 100 - daysWaiting * 10)), // Visual indicator
        updatedAt: new Date(item.createdAt),
      };
    });
  }, [filteredDecisions]);

  // Render decision detail view
  const renderDecisionDetail = () => {
    if (!selectedDecision) return null;

    const isMyDecision = selectedDecision.decisionOwnerId === currentUserId;

    return (
      <div className="flex flex-col h-full">
        {/* Context Bar */}
        <div className="bg-gradient-to-r from-purple-600/10 to-pink-600/10 border-b border-purple-500/20 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Clock size={20} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{selectedDecision.title}</h3>
              <p className="text-xs text-slate-400">
                {selectedDecision.projectName || 'No project'}
                {' • '}
                <span className={selectedDecision.isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'}>
                  {selectedDecision.daysWaiting}d waiting
                </span>
              </p>
            </div>
          </div>
          {isMyDecision && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleApprove(selectedDecision.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors"
              >
                <CheckCircle2 size={14} />
                {t('decisions.approve', 'Approve')}
              </button>
              <button
                onClick={() => handleReject(selectedDecision.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
              >
                {t('decisions.reject', 'Reject')}
              </button>
              <button
                onClick={() => handleEscalate(selectedDecision.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-400 hover:text-white hover:bg-navy-800/40 rounded-lg transition-colors"
              >
                <AlertTriangle size={14} />
                {t('decisions.escalate', 'Escalate')}
              </button>
            </div>
          )}
        </div>

        {/* Decision Content */}
        <div className="flex-1 overflow-auto p-6">
          <DecisionCard
            decision={selectedDecision}
            variant="full"
            isMyDecision={isMyDecision}
            showActions={isMyDecision}
            onApprove={handleApprove}
            onReject={handleReject}
            onEscalate={handleEscalate}
          />
        </div>
      </div>
    );
  };

  // Render empty state
  const renderEmptyState = () => {
    const getMessage = () => {
      switch (activeTab) {
        case 'list':
          return t('decisions.noMyDecisions', 'No decisions awaiting your action');
        case 'reports':
          return t('decisions.noAwaitingOthers', 'No decisions pending from others');
        default:
          return t('decisions.noDecisions', 'No pending decisions');
      }
    };

    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
        <h3 className="text-lg font-semibold text-white mb-2">{getMessage()}</h3>
        <p className="text-sm text-slate-400 mb-6">
          {t('decisions.allCaughtUp', 'All caught up!')}
        </p>
        {onCreateDecision && (
          <button
            onClick={onCreateDecision}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors"
          >
            {t('decisions.create', 'Create Decision Request')}
          </button>
        )}
      </div>
    );
  };

  // Render content
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      );
    }

    // Show decision detail if document is open
    if (activeDocumentId && selectedDecision) {
      return renderDecisionDetail();
    }

    // Show empty state if no decisions
    if (filteredDecisions.length === 0) {
      return renderEmptyState();
    }

    // Render based on view mode
    if (viewMode === 'grid') {
      return (
        <GridView
          items={gridItems}
          onItemClick={(item: GridItem) => {
            const decision = decisions.find((d) => d.id === item.id);
            if (decision) handleOpenDocument(decision);
          }}
          onItemAction={(action: string, item: GridItem) => {
            const decision = decisions.find((d) => d.id === item.id);
            if (decision) handleRowAction(action, decision);
          }}
          onNewItem={onCreateDecision}
          newItemLabel={t('decisions.new', 'New Decision')}
          emptyMessage={t('decisions.noDecisions', 'No pending decisions')}
        />
      );
    }

    return (
      <FilterableTable
        columns={columns}
        data={filteredDecisions}
        onRowClick={(row: any) => handleOpenDocument(row as Decision)}
        onRowAction={(action: string, row: any) =>
          handleRowAction(action, row as Decision)
        }
        activeFilters={activeFilters}
        onFilterChange={setActiveFilters}
        emptyMessage={t('decisions.noDecisions', 'No pending decisions')}
      />
    );
  };

  return (
    <ModuleHub
      persistViewModeKey="decisions"
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
        const decision = decisions.find((d) => d.id === id);
        if (decision) setSelectedDecision(decision);
      }}
      onCloseDocument={handleCloseDocument}
      onShowList={handleShowList}
      activeFilters={activeFilters}
      onRemoveFilter={handleRemoveFilter}
      onClearFilters={handleClearFilters}
      onNewItem={onCreateDecision}
      newItemLabel={t('decisions.new', 'New Decision')}
      availableViewModes={['table', 'grid']}
    >
      {renderContent()}
    </ModuleHub>
  );
};

export default DecisionsHub;
