/**
 * DecisionInbox - Central inbox for all decisions across modules
 * Shows unified view of decisions from initiatives, tasks, assessments, tools, etc.
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock,
  Filter,
  Hourglass,
  Plus,
  RefreshCw,
  Search,
  TrendingUp,
  User,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/ui/primitives';
import { StatusChip } from '@/components/ui/primitives/chips';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import DecisionCard, { Decision } from './DecisionCard';

type ViewMode = 'my' | 'awaiting' | 'all';
type FilterType = 'all' | 'overdue' | 'thisWeek' | 'blocking' | 'critical' | 'high';
type SortOrder = 'newest' | 'oldest' | 'urgency' | 'priority';
type ContextFilter = 'all' | 'initiative' | 'task' | 'analysis' | 'assessment' | 'tool';

interface DecisionCounts {
  total: number;
  my: number;
  awaiting: number;
  overdue: number;
  escalated: number;
}

interface DecisionInboxProps {
  projectId?: string;
  onDecisionClick?: (decisionId: string) => void;
  onCreateDecision?: () => void;
  showHeader?: boolean;
  embedded?: boolean;
  /** Optional callback fired whenever counts change — lets parent hubs update their Menu 3 badges */
  onCountsChange?: (counts: DecisionCounts) => void;
}

export const DecisionInbox: React.FC<DecisionInboxProps> = ({
  projectId,
  onDecisionClick,
  onCreateDecision,
  showHeader = true,
  embedded = false,
  onCountsChange,
}) => {
  const { t } = useTranslation();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('my');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [contextFilter, setContextFilter] = useState<ContextFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('urgency');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentUserId = useAppStore((state) => state.currentUser?.id);
  const effectiveProjectId = projectId || currentProjectId;

  // Fetch decisions
  const fetchDecisions = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setLoadError(null);

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
        console.error('Failed to fetch decisions:', error);
        setLoadError(t('decisions.loadError', 'Failed to load decisions'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [effectiveProjectId, t]
  );

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  // Calculate counts
  const counts: DecisionCounts = useMemo(() => {
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

  // Fire onCountsChange whenever counts update (lets parent hubs update Menu 3 badges)
  useEffect(() => {
    onCountsChange?.(counts);
  }, [counts, onCountsChange]);

  // Filter and sort decisions
  const filteredDecisions = useMemo(() => {
    let filtered = decisions.filter((d) => ['PENDING', 'ESCALATED'].includes(d.status));

    // View mode filter
    switch (viewMode) {
      case 'my':
        filtered = filtered.filter((d) => d.decisionOwnerId === currentUserId);
        break;
      case 'awaiting':
        filtered = filtered.filter(
          (d) => d.requestedById === currentUserId && d.decisionOwnerId !== currentUserId
        );
        break;
    }

    // Context filter
    if (contextFilter !== 'all') {
      filtered = filtered.filter(
        (d) =>
          d.contextType === contextFilter || d.relatedObjectType?.toLowerCase() === contextFilter
      );
    }

    // Type filter
    switch (filterType) {
      case 'overdue':
        filtered = filtered.filter((d) => d.isOverdue);
        break;
      case 'thisWeek':
        filtered = filtered.filter((d) => (d.daysWaiting || 0) <= 7);
        break;
      case 'blocking':
        filtered = filtered.filter((d) => (d.blockedItemsCount || 0) > 0);
        break;
      case 'critical':
        filtered = filtered.filter((d) => d.priority === 'CRITICAL');
        break;
      case 'high':
        filtered = filtered.filter((d) => d.priority === 'HIGH' || d.priority === 'CRITICAL');
        break;
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(query) ||
          d.description?.toLowerCase().includes(query) ||
          d.projectName?.toLowerCase().includes(query)
      );
    }

    // Sort
    const priorityOrder: Record<string, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    filtered.sort((a, b) => {
      switch (sortOrder) {
        case 'oldest':
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case 'urgency':
          // Sort by: escalated first, then overdue, then by days waiting
          if (a.status === 'ESCALATED' && b.status !== 'ESCALATED') return -1;
          if (b.status === 'ESCALATED' && a.status !== 'ESCALATED') return 1;
          if (a.isOverdue && !b.isOverdue) return -1;
          if (b.isOverdue && !a.isOverdue) return 1;
          return (b.daysWaiting || 0) - (a.daysWaiting || 0);
        case 'priority':
          return (
            (priorityOrder[b.priority || 'MEDIUM'] || 2) -
            (priorityOrder[a.priority || 'MEDIUM'] || 2)
          );
        case 'newest':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return filtered;
  }, [decisions, viewMode, filterType, contextFilter, sortOrder, searchQuery, currentUserId]);

  // Handlers
  const handleApprove = async (id: string) => {
    if (!id) {
      toast.error(t('decisions.error', 'Missing decision ID'));
      return;
    }
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
  };

  const handleReject = async (id: string) => {
    if (!id) {
      toast.error(t('decisions.error', 'Missing decision ID'));
      return;
    }
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
  };

  const handleEscalate = async (id: string) => {
    if (!id) {
      toast.error(t('decisions.error', 'Missing decision ID'));
      return;
    }
    try {
      await Api.post(`/decisions/${id}/escalate`, {});
      toast.success(t('decisions.escalated', 'Decision escalated'));
      fetchDecisions(true);
    } catch (error) {
      console.error('Failed to escalate:', error);
      toast.error(t('decisions.escalateError', 'Failed to escalate decision'));
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className={`${embedded ? 'p-4' : 'p-8'} py-0`} />;
  }

  // Distinguish error from empty: a failed load should not look like "no decisions".
  if (loadError) {
    return (
      <div className={embedded ? 'p-4' : 'p-8'}>
        <ErrorState message={loadError} retry={() => fetchDecisions()} />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col h-full ${embedded ? '' : 'bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm'}`}
      data-testid="decision-inbox"
    >
      {/* Header */}
      {showHeader && (
        <div className="shrink-0 p-4 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-primary-500 to-pink-600 text-slate-900 dark:text-white rounded-lg shadow-sm">
                <Bell size={20} />
              </div>
              <div>
                <h2 className="font-bold text-navy-900 dark:text-white">
                  {t('decisions.inbox', 'Decision Inbox')}
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span>
                    {counts.total} {t('decisions.pending', 'pending')}
                  </span>
                  {counts.overdue > 0 && (
                    <StatusChip
                      tone="danger"
                      label={`${counts.overdue} ${t('decisions.overdue', 'overdue')}`}
                    />
                  )}
                  {counts.escalated > 0 && (
                    <StatusChip
                      tone="warning"
                      label={`${counts.escalated} ${t('decisions.escalated', 'escalated')}`}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchDecisions(true)}
                disabled={refreshing}
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
              {onCreateDecision && (
                <button
                  onClick={onCreateDecision}
                  className="px-4 py-2 rounded-lg text-white dark:text-navy-950 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] transition-colors font-medium text-sm flex items-center gap-2"
                >
                  <Plus size={16} />
                  {t('decisions.new', 'New')}
                </button>
              )}
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-navy-800 rounded-lg mb-3">
            <button
              onClick={() => setViewMode('my')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                viewMode === 'my'
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              <User size={14} />
              {t('decisions.myDecisions', 'My Decisions')}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  viewMode === 'my'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-slate-200 dark:bg-white/10'
                }`}
              >
                {counts.my}
              </span>
            </button>
            <button
              onClick={() => setViewMode('awaiting')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                viewMode === 'awaiting'
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              <Hourglass size={14} />
              {t('decisions.awaiting', 'Awaiting Others')}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  viewMode === 'awaiting'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-slate-200 dark:bg-white/10'
                }`}
              >
                {counts.awaiting}
              </span>
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                viewMode === 'all'
                  ? 'bg-white dark:bg-navy-700 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-navy-900 dark:hover:text-white'
              }`}
            >
              {t('decisions.all', 'All')}
              <span
                className={`px-2 py-0.5 rounded-full text-xs ${
                  viewMode === 'all'
                    ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                    : 'bg-slate-200 dark:bg-white/10'
                }`}
              >
                {counts.total}
              </span>
            </button>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="flex-1 relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('decisions.search', 'Search decisions...')}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-navy-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              />
            </div>

            {/* Context Filter */}
            <select
              value={contextFilter}
              onChange={(e) => setContextFilter(e.target.value as ContextFilter)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-navy-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <option value="all">{t('decisions.allContexts', 'All Contexts')}</option>
              <option value="initiative">🎯 {t('decisions.initiatives', 'Initiatives')}</option>
              <option value="task">✅ {t('decisions.tasks', 'Tasks')}</option>
              <option value="assessment">📊 {t('decisions.assessments', 'Assessments')}</option>
              <option value="tool">🔧 {t('decisions.tools', 'Tools')}</option>
              <option value="analysis">💰 {t('decisions.analyses', 'Economic Analyses')}</option>
            </select>

            {/* Filter Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-2 transition-colors ${
                  filterType !== 'all'
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-slate-200 dark:border-navy-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                <Filter size={16} />
                {filterType === 'all' ? t('decisions.filter', 'Filter') : filterType}
              </button>

              {showFilters && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 py-1 z-20">
                  {(
                    ['all', 'overdue', 'thisWeek', 'blocking', 'critical', 'high'] as FilterType[]
                  ).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => {
                        setFilterType(filter);
                        setShowFilters(false);
                      }}
                      className={`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5 flex items-center gap-2 ${
                        filterType === filter
                          ? 'text-primary-600 dark:text-primary-400 font-medium'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {filter === 'overdue' && (
                        <AlertCircle size={14} className="text-danger-500" />
                      )}
                      {filter === 'blocking' && <Clock size={14} className="text-amber-500" />}
                      {filter === 'critical' && (
                        <TrendingUp size={14} className="text-danger-500" />
                      )}
                      {filter === 'high' && <TrendingUp size={14} className="text-amber-500" />}
                      {filter === 'all'
                        ? t('decisions.filterAll', 'All')
                        : filter === 'overdue'
                          ? t('decisions.filterOverdue', 'Overdue')
                          : filter === 'thisWeek'
                            ? t('decisions.filterThisWeek', 'This Week')
                            : filter === 'blocking'
                              ? t('decisions.filterBlocking', 'Blocking')
                              : filter === 'critical'
                                ? t('decisions.filterCritical', 'Critical')
                                : t('decisions.filterHigh', 'High+')}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Sort */}
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="px-3 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-navy-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <option value="urgency">⚠️ {t('decisions.sortUrgency', 'Urgency')}</option>
              <option value="newest">↓ {t('decisions.sortNewest', 'Newest')}</option>
              <option value="oldest">↑ {t('decisions.sortOldest', 'Oldest')}</option>
              <option value="priority">🚨 {t('decisions.sortPriority', 'Priority')}</option>
            </select>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="popLayout">
          {filteredDecisions.length > 0 ? (
            <div className="space-y-3">
              {filteredDecisions.map((decision) => (
                <DecisionCard
                  key={decision.id}
                  decision={decision}
                  variant="full"
                  isMyDecision={decision.decisionOwnerId === currentUserId}
                  showActions={viewMode === 'my'}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onEscalate={handleEscalate}
                  onClick={onDecisionClick}
                />
              ))}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-12"
            >
              <CheckCircle2 size={48} className="mx-auto mb-4 text-green-400 dark:text-green-600" />
              <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
                {viewMode === 'my'
                  ? t('decisions.noMyDecisions', 'No decisions awaiting your action')
                  : viewMode === 'awaiting'
                    ? t('decisions.noAwaitingOthers', 'No decisions pending from others')
                    : t('decisions.noDecisions', 'No pending decisions')}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-500">
                {t('decisions.allCaughtUp', 'All caught up!')}
              </p>
              {onCreateDecision && (
                <button
                  onClick={onCreateDecision}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white dark:text-navy-950 bg-navy-900 hover:bg-navy-800 dark:bg-[#F4F7FB] dark:hover:bg-[#DDE5EF] transition-colors"
                >
                  <Plus size={14} />
                  {t('decisions.create', 'Create Decision Request')}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default DecisionInbox;
