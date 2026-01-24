/**
 * NotificationQuickActions - Context-aware quick action buttons for notifications
 * Shows different actions based on notification type
 */

import {
  Check,
  Clock,
  ExternalLink,
  Eye,
  MessageSquare,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserPlus,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface NotificationData {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  isRead: boolean;
  relatedObjectType?: string;
}

interface NotificationQuickActionsProps {
  notification: NotificationData;
  onNavigate: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
  onSnooze?: (hours: number) => void;
  canNavigate: boolean;
  navigationLabel: string;
  // Optional type-specific handlers
  onApprove?: () => void;
  onReject?: () => void;
  onReassign?: () => void;
  onDiscuss?: () => void;
  onApplyRecommendation?: () => void;
  onDismissRecommendation?: () => void;
}

/**
 * Get type-specific actions for a notification
 */
const getTypeActions = (type: string): string[] => {
  switch (type) {
    case 'TASK_ASSIGNED':
    case 'TASK_OVERDUE':
    case 'TASK_BLOCKED':
      return ['open', 'reassign', 'snooze'];
    case 'DECISION_REQUIRED':
    case 'DECISION_OVERDUE':
      return ['approve', 'reject', 'discuss'];
    case 'GATE_PENDING_APPROVAL':
      return ['open', 'approve'];
    case 'AI_RECOMMENDATION':
      return ['apply', 'dismiss', 'explain'];
    case 'AI_RISK_DETECTED':
      return ['open', 'discuss'];
    default:
      return ['open'];
  }
};

export const NotificationQuickActions: React.FC<NotificationQuickActionsProps> = ({
  notification,
  onNavigate,
  onMarkRead,
  onDelete,
  onSnooze,
  canNavigate,
  navigationLabel,
  onApprove,
  onReject,
  onReassign,
  onDiscuss,
  onApplyRecommendation,
  onDismissRecommendation,
}) => {
  const { t } = useTranslation();
  const typeActions = getTypeActions(notification.type);

  const renderPrimaryAction = () => {
    // Decision actions
    if (typeActions.includes('approve') && onApprove) {
      return (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApprove();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <ThumbsUp size={12} />
            {t('notifications.actions.approve', 'Approve')}
          </button>
          {onReject && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onReject();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
            >
              <ThumbsDown size={12} />
              {t('notifications.actions.reject', 'Reject')}
            </button>
          )}
        </div>
      );
    }

    // AI Recommendation actions
    if (typeActions.includes('apply') && onApplyRecommendation) {
      return (
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onApplyRecommendation();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-medium rounded-lg transition-colors"
          >
            <Sparkles size={12} />
            {t('notifications.actions.apply', 'Apply')}
          </button>
          {onDismissRecommendation && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismissRecommendation();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg transition-colors"
            >
              {t('notifications.actions.dismiss', 'Dismiss')}
            </button>
          )}
        </div>
      );
    }

    // Default: Open/Navigate action
    if (canNavigate) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <ExternalLink size={12} />
          {navigationLabel}
        </button>
      );
    }

    return null;
  };

  return (
    <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/50 dark:border-navy-700">
      {/* Primary Actions */}
      <div className="flex items-center gap-2">
        {renderPrimaryAction()}

        {/* Reassign for tasks */}
        {typeActions.includes('reassign') && onReassign && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReassign();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 text-xs rounded-lg transition-colors"
          >
            <UserPlus size={12} />
            {t('notifications.actions.reassign', 'Reassign')}
          </button>
        )}

        {/* Discuss */}
        {typeActions.includes('discuss') && onDiscuss && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDiscuss();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 text-xs rounded-lg transition-colors"
          >
            <MessageSquare size={12} />
            {t('notifications.actions.discuss', 'Discuss')}
          </button>
        )}
      </div>

      {/* Secondary Actions */}
      <div className="flex items-center gap-1">
        {/* Snooze */}
        {typeActions.includes('snooze') && onSnooze && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSnooze(24);
            }}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
            title={t('notifications.actions.snooze', 'Snooze 24h')}
          >
            <Clock size={14} />
          </button>
        )}

        {/* Mark as Read */}
        {!notification.isRead && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
            title={t('notifications.actions.markRead', 'Mark as read')}
          >
            <Check size={14} />
          </button>
        )}

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
          title={t('notifications.actions.delete', 'Delete')}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default NotificationQuickActions;
