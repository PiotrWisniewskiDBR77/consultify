/**
 * PendingActionsIndicator
 *
 * Inline indicator for pending AI actions in the UnifiedChatPanel.
 * Provides quick visibility of actions awaiting user approval,
 * with quick-approve/reject functionality.
 *
 * Part of the Enterprise AI Readiness - Action Clarity initiative.
 *
 * @version 1.0.0
 */

import {
  AlertTriangle,
  Briefcase,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  RefreshCw,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

// ============================================================================
// Types
// ============================================================================

interface PendingAction {
  id: string;
  action_type: string;
  status: string;
  created_at: string;
  payload: {
    title?: string;
    name?: string;
    description?: string;
    riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
    draftType?: string;
  };
  draft_content?: {
    title?: string;
    name?: string;
  };
}

interface PendingActionsIndicatorProps {
  /** Optional project ID to filter actions */
  projectId?: string;
  /** Whether to show in compact mode */
  compact?: boolean;
  /** Callback when user clicks "View All" */
  onViewAll?: () => void;
  /** Callback when an action is approved/rejected */
  onActionDecided?: (actionId: string, decision: 'approved' | 'rejected') => void;
  /** Maximum number of actions to show in preview */
  maxPreview?: number;
  /** Custom class name */
  className?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

const getActionIcon = (actionType: string) => {
  switch (actionType) {
    case 'CREATE_DRAFT_TASK':
      return <Briefcase size={12} className="text-blue-500" />;
    case 'CREATE_DRAFT_INITIATIVE':
      return <FileText size={12} className="text-c-text-secondary" />;
    case 'SUGGEST_ROADMAP_CHANGE':
      return <Calendar size={12} className="text-emerald-500" />;
    case 'GENERATE_REPORT':
      return <FileText size={12} className="text-amber-500" />;
    case 'ANALYZE_RISKS':
      return <AlertTriangle size={12} className="text-danger-500" />;
    default:
      return <Zap size={12} className="text-c-text-secondary" />;
  }
};

const formatActionType = (type: string): string => {
  return type
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (l) => l.toUpperCase());
};

const getTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const getRiskBadge = (risk?: string) => {
  if (!risk) return null;

  const colors = {
    LOW: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    MEDIUM: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    HIGH: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400',
  };

  return (
    <span
      className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${colors[risk as keyof typeof colors] || colors.LOW}`}
    >
      {risk}
    </span>
  );
};

// ============================================================================
// Component
// ============================================================================

export const PendingActionsIndicator: React.FC<PendingActionsIndicatorProps> = ({
  projectId,
  compact = false,
  onViewAll,
  onActionDecided,
  maxPreview = 3,
  className = '',
}) => {
  const { t } = useTranslation();
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch pending actions
  const fetchActions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getPendingAIActions(projectId);
      setActions(data || []);
    } catch (err) {
      console.error('[PendingActionsIndicator] Failed to fetch actions:', err);
      setActions([]);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchActions();

    // Poll for updates every 30 seconds
    const interval = setInterval(fetchActions, 30000);
    return () => clearInterval(interval);
  }, [fetchActions]);

  // Handle approve
  const handleApprove = useCallback(
    async (actionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setProcessingId(actionId);

      try {
        await Api.approveAIAction(actionId);
        setActions((prev) => prev.filter((a) => a.id !== actionId));
        toast.success(t('ai.actions.approved', 'Action approved'));
        onActionDecided?.(actionId, 'approved');
      } catch (err) {
        console.error('[PendingActionsIndicator] Failed to approve:', err);
        toast.error(t('ai.actions.approveFailed', 'Failed to approve action'));
      } finally {
        setProcessingId(null);
      }
    },
    [t, onActionDecided]
  );

  // Handle reject
  const handleReject = useCallback(
    async (actionId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setProcessingId(actionId);

      try {
        await Api.rejectAIAction(actionId);
        setActions((prev) => prev.filter((a) => a.id !== actionId));
        toast.success(t('ai.actions.rejected', 'Action rejected'));
        onActionDecided?.(actionId, 'rejected');
      } catch (err) {
        console.error('[PendingActionsIndicator] Failed to reject:', err);
        toast.error(t('ai.actions.rejectFailed', 'Failed to reject action'));
      } finally {
        setProcessingId(null);
      }
    },
    [t, onActionDecided]
  );

  // Don't render if no pending actions
  if (!loading && actions.length === 0) {
    return null;
  }

  // Compact mode - just show count badge
  if (compact && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className={`inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-xs font-medium transition-colors ${className}`}
      >
        <Zap size={12} className="animate-pulse" />
        {loading ? (
          <RefreshCw size={10} className="animate-spin" />
        ) : (
          <span>{actions.length} pending</span>
        )}
      </button>
    );
  }

  const displayActions = expanded ? actions : actions.slice(0, maxPreview);

  return (
    <div
      className={`bg-gradient-to-r from-amber-50/80 to-amber-50/80 dark:from-amber-900/10 dark:to-amber-900/10 border border-amber-200/60 dark:border-amber-700/30 rounded-xl overflow-hidden ${className}`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-amber-100/50 dark:hover:bg-amber-900/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <div className="p-1 bg-amber-200/60 dark:bg-amber-700/30 rounded-md">
            <Zap size={14} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              {t('ai.actions.pending', 'Pending Actions')}
            </span>
            <span className="ml-2 px-1.5 py-0.5 bg-amber-200/80 dark:bg-amber-700/50 text-amber-800 dark:text-amber-200 text-[10px] font-bold rounded-full">
              {loading ? '...' : actions.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {onViewAll && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewAll();
              }}
              className="p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-200/50 dark:hover:bg-amber-700/30 rounded-md transition-colors"
              title={t('ai.actions.viewAll', 'View All')}
            >
              <ExternalLink size={14} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              fetchActions();
            }}
            className="p-1 text-amber-600 dark:text-amber-400 hover:bg-amber-200/50 dark:hover:bg-amber-700/30 rounded-md transition-colors"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
          <ChevronRight
            size={14}
            className={`text-amber-600 dark:text-amber-400 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        </div>
      </div>

      {/* Actions List */}
      {expanded && (
        <div className="border-t border-amber-200/60 dark:border-amber-700/30 divide-y divide-amber-200/40 dark:divide-amber-700/20">
          {displayActions.map((action) => {
            const title =
              action.draft_content?.title ||
              action.draft_content?.name ||
              action.payload?.title ||
              action.payload?.name ||
              formatActionType(action.action_type);
            const isProcessing = processingId === action.id;

            return (
              <div
                key={action.id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-amber-100/40 dark:hover:bg-amber-900/20 transition-colors"
              >
                {/* Icon */}
                <div className="p-1.5 bg-white dark:bg-navy-800 rounded-md shadow-sm">
                  {getActionIcon(action.action_type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                      {title}
                    </span>
                    {getRiskBadge(action.payload?.riskLevel)}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">
                      {formatActionType(action.action_type)}
                    </span>
                    <span className="text-[10px] text-slate-600 dark:text-slate-500 flex items-center gap-0.5">
                      <Clock size={8} />
                      {getTimeAgo(action.created_at)}
                    </span>
                  </div>
                </div>

                {/* Quick Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => handleApprove(action.id, e)}
                    disabled={isProcessing}
                    className="p-1.5 bg-emerald-100 dark:bg-emerald-900/30 hover:bg-emerald-200 dark:hover:bg-emerald-800/40 text-emerald-600 dark:text-emerald-400 rounded-md transition-colors disabled:opacity-50"
                    title={t('ai.actions.approve', 'Approve')}
                  >
                    {isProcessing ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Check size={12} />
                    )}
                  </button>
                  <button
                    onClick={(e) => handleReject(action.id, e)}
                    disabled={isProcessing}
                    className="p-1.5 bg-danger-100 dark:bg-danger-900/30 hover:bg-danger-200 dark:hover:bg-danger-800/40 text-danger-600 dark:text-danger-400 rounded-md transition-colors disabled:opacity-50"
                    title={t('ai.actions.reject', 'Reject')}
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Show More */}
          {!expanded && actions.length > maxPreview && (
            <button
              onClick={() => setExpanded(true)}
              className="w-full px-3 py-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-100/40 dark:hover:bg-amber-900/20 transition-colors text-center"
            >
              {t('common.showMore', 'Show {{count}} more', { count: actions.length - maxPreview })}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default PendingActionsIndicator;
