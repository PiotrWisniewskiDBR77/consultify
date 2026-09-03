/**
 * DecisionsByInitiative - View decisions grouped by initiative/project
 * Shows a hierarchical view of decisions organized by their context
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Clock,
  FileText,
  FolderKanban,
  RefreshCw,
  Search,
  Target,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState } from '@/components/ui/primitives';

import { Api } from '../../services/api';
import { useAppStore } from '../../store/useAppStore';
import DecisionCard, { Decision } from './DecisionCard';

interface GroupedDecisions {
  id: string;
  name: string;
  type: 'project' | 'initiative' | 'assessment' | 'tool';
  decisions: Decision[];
  counts: {
    total: number;
    overdue: number;
    critical: number;
  };
}

interface DecisionsByInitiativeProps {
  projectId?: string;
  initiativeId?: string;
  onDecisionClick?: (decisionId: string) => void;
  onInitiativeClick?: (initiativeId: string) => void;
}

const GroupHeader: React.FC<{
  group: GroupedDecisions;
  isExpanded: boolean;
  onToggle: () => void;
  onClick?: () => void;
}> = ({ group, isExpanded, onToggle, onClick }) => {
  const { t } = useTranslation();

  const getIcon = () => {
    switch (group.type) {
      case 'project':
        return <FolderKanban size={16} className="text-primary-500" />;
      case 'initiative':
        return <Target size={16} className="text-blue-500" />;
      case 'assessment':
        return <FileText size={16} className="text-emerald-500" />;
      case 'tool':
        return <FileText size={16} className="text-amber-500" />;
      default:
        return <FileText size={16} className="text-slate-500" />;
    }
  };

  const getTypeBadge = () => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      project: {
        bg: 'bg-primary-100 dark:bg-primary-900/30',
        text: 'text-primary-700 dark:text-primary-300',
        label: 'Project',
      },
      initiative: {
        bg: 'bg-blue-100 dark:bg-blue-900/30',
        text: 'text-blue-700 dark:text-blue-300',
        label: 'Initiative',
      },
      assessment: {
        bg: 'bg-emerald-100 dark:bg-emerald-900/30',
        text: 'text-emerald-700 dark:text-emerald-300',
        label: 'Assessment',
      },
      tool: {
        bg: 'bg-amber-100 dark:bg-amber-900/30',
        text: 'text-amber-700 dark:text-amber-300',
        label: 'Tool',
      },
    };
    return badges[group.type] || badges.project;
  };

  const badge = getTypeBadge();

  return (
    <div
      className={`
        flex items-center justify-between p-3 cursor-pointer
        bg-white dark:bg-navy-900
        border border-slate-200 dark:border-navy-700
        rounded-lg
        hover:border-primary-300 dark:hover:border-primary-500/50
        transition-all duration-150
        ${group.counts.overdue > 0 ? 'border-l-4 border-l-amber-500' : ''}
        ${group.counts.critical > 0 ? 'border-l-4 border-l-danger-500' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        <button onClick={onToggle} className="p-1 -m-1">
          {isExpanded ? (
            <ChevronDown size={16} className="text-slate-600 dark:text-slate-500" />
          ) : (
            <ChevronRight size={16} className="text-slate-600 dark:text-slate-500" />
          )}
        </button>

        {getIcon()}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button
              onClick={onClick}
              className="font-medium text-sm text-navy-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors truncate"
            >
              {group.name}
            </button>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${badge.bg} ${badge.text}`}
            >
              {badge.label}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {group.counts.overdue > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
            <AlertTriangle size={10} />
            {group.counts.overdue} {t('decisions.overdue', 'overdue')}
          </span>
        )}
        {group.counts.critical > 0 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300 font-medium">
            {group.counts.critical} critical
          </span>
        )}
        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-400 font-medium">
          {group.counts.total} {t('decisions.decisions', 'decisions')}
        </span>
      </div>
    </div>
  );
};

export const DecisionsByInitiative: React.FC<DecisionsByInitiativeProps> = ({
  projectId,
  initiativeId,
  onDecisionClick,
  onInitiativeClick,
}) => {
  const { t } = useTranslation();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  const currentProjectId = useAppStore((state) => state.currentProjectId);
  const currentUserId = useAppStore((state) => state.currentUser?.id);
  const effectiveProjectId = projectId || currentProjectId;

  // Fetch decisions
  const fetchDecisions = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        let url = '/decisions?includeAll=true';
        if (effectiveProjectId) {
          url += `&projectId=${effectiveProjectId}`;
        }
        if (initiativeId) {
          url += `&relatedObjectId=${initiativeId}`;
        }

        const data = await Api.get(url);
        const decisionsList = Array.isArray(data) ? data : data?.decisions || [];

        // Enhance decisions
        const enhanced = decisionsList.map((d: Decision) => {
          const daysWaiting =
            d.daysWaiting ||
            Math.floor((Date.now() - new Date(d.createdAt).getTime()) / (1000 * 60 * 60 * 24));
          return {
            ...d,
            daysWaiting,
            isOverdue: daysWaiting > 7,
            daysOverdue: Math.max(0, daysWaiting - 7),
          };
        });

        setDecisions(enhanced.filter((d: Decision) => ['PENDING', 'ESCALATED'].includes(d.status)));
      } catch (error) {
        console.error('Failed to fetch decisions:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [effectiveProjectId, initiativeId]
  );

  useEffect(() => {
    fetchDecisions();
  }, [fetchDecisions]);

  // Group decisions by initiative/project
  const groupedDecisions: GroupedDecisions[] = useMemo(() => {
    const groups: Map<string, GroupedDecisions> = new Map();

    // Filter by search
    let filtered = decisions;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = decisions.filter(
        (d) =>
          d.title.toLowerCase().includes(query) ||
          d.description?.toLowerCase().includes(query) ||
          d.projectName?.toLowerCase().includes(query) ||
          d.relatedObjectName?.toLowerCase().includes(query)
      );
    }

    filtered.forEach((decision) => {
      // Determine group key and type
      let groupKey: string;
      let groupName: string;
      let groupType: 'project' | 'initiative' | 'assessment' | 'tool';

      if (decision.relatedObjectType === 'initiative' && decision.relatedObjectId) {
        groupKey = `initiative-${decision.relatedObjectId}`;
        groupName =
          decision.relatedObjectName || `Initiative ${decision.relatedObjectId.slice(0, 8)}`;
        groupType = 'initiative';
      } else if (decision.relatedObjectType === 'assessment' && decision.relatedObjectId) {
        groupKey = `assessment-${decision.relatedObjectId}`;
        groupName =
          decision.relatedObjectName || `Assessment ${decision.relatedObjectId.slice(0, 8)}`;
        groupType = 'assessment';
      } else if (decision.relatedObjectType === 'tool' && decision.relatedObjectId) {
        groupKey = `tool-${decision.relatedObjectId}`;
        groupName = decision.relatedObjectName || `Tool ${decision.relatedObjectId.slice(0, 8)}`;
        groupType = 'tool';
      } else if (decision.projectId) {
        groupKey = `project-${decision.projectId}`;
        groupName = decision.projectName || `Project ${decision.projectId.slice(0, 8)}`;
        groupType = 'project';
      } else {
        groupKey = 'unassigned';
        groupName = t('decisions.unassigned', 'Unassigned');
        groupType = 'project';
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          id: decision.relatedObjectId || decision.projectId || 'unassigned',
          name: groupName,
          type: groupType,
          decisions: [],
          counts: { total: 0, overdue: 0, critical: 0 },
        });
      }

      const group = groups.get(groupKey)!;
      group.decisions.push(decision);
      group.counts.total++;
      if (decision.isOverdue) group.counts.overdue++;
      if (decision.priority === 'CRITICAL') group.counts.critical++;
    });

    // Sort groups: most urgent first (by overdue count, then total)
    return Array.from(groups.values()).sort((a, b) => {
      if (a.counts.overdue !== b.counts.overdue) return b.counts.overdue - a.counts.overdue;
      if (a.counts.critical !== b.counts.critical) return b.counts.critical - a.counts.critical;
      return b.counts.total - a.counts.total;
    });
  }, [decisions, searchQuery, t]);

  // Toggle group expansion
  const toggleGroup = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Expand all with issues by default
  useEffect(() => {
    const groupsWithIssues = groupedDecisions
      .filter((g) => g.counts.overdue > 0 || g.counts.critical > 0)
      .map((g) => g.id);
    setExpandedGroups(new Set(groupsWithIssues));
  }, [groupedDecisions.length]);

  // Handlers
  const handleApprove = async (id: string) => {
    try {
      await Api.put(`/decisions/${id}/decide`, {
        status: 'APPROVED',
        outcome: t('decisions.defaultApproveRationale', 'Approved via quick action'),
      });
      fetchDecisions(true);
    } catch (error) {
      console.error('Failed to approve:', error);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await Api.put(`/decisions/${id}/decide`, {
        status: 'REJECTED',
        outcome: t('decisions.defaultRejectRationale', 'Rejected via quick action'),
      });
      fetchDecisions(true);
    } catch (error) {
      console.error('Failed to reject:', error);
    }
  };

  if (loading) {
    return <LoadingState variant="spinner" className="p-8" />;
  }

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 shadow-sm"
      data-testid="decisions-by-initiative"
    >
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-primary-600 text-white rounded-lg shadow-sm">
              <Target size={20} />
            </div>
            <div>
              <h2 className="font-bold text-navy-900 dark:text-white">
                {t('decisions.byInitiative', 'Decisions by Initiative')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {groupedDecisions.length} {t('decisions.groups', 'groups')} • {decisions.length}{' '}
                {t('decisions.totalDecisions', 'total decisions')}
              </p>
            </div>
          </div>

          <button
            onClick={() => fetchDecisions(true)}
            disabled={refreshing}
            className="p-2 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg transition-colors"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('decisions.searchByInitiative', 'Search initiatives and decisions...')}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-sm text-navy-900 dark:text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {groupedDecisions.length > 0 ? (
          <div className="space-y-3">
            {groupedDecisions.map((group) => (
              <div key={group.id} className="space-y-2">
                <GroupHeader
                  group={group}
                  isExpanded={expandedGroups.has(group.id)}
                  onToggle={() => toggleGroup(group.id)}
                  onClick={() => onInitiativeClick?.(group.id)}
                />

                <AnimatePresence>
                  {expandedGroups.has(group.id) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden pl-6 space-y-2"
                    >
                      {group.decisions.map((decision) => (
                        <DecisionCard
                          key={decision.id}
                          decision={decision}
                          variant="compact"
                          isMyDecision={decision.decisionOwnerId === currentUserId}
                          showActions={decision.decisionOwnerId === currentUserId}
                          onApprove={handleApprove}
                          onReject={handleReject}
                          onClick={onDecisionClick}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Clock />}
            title={t('decisions.noGroupedDecisions', 'No pending decisions')}
            description={t(
              'decisions.allInitiativesClear',
              'All initiatives are clear of pending decisions'
            )}
          />
        )}
      </div>
    </div>
  );
};

export default DecisionsByInitiative;
