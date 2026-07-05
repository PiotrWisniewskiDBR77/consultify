/**
 * NotificationQuickActions - Context-aware quick action buttons for notifications
 * Shows different actions based on notification type
 * Enhanced with snooze presets, chat integration, and type-specific navigation
 */

import {
  Check,
  CheckSquare,
  ChevronDown,
  Clock,
  ExternalLink,
  MessageSquare,
  Scale,
  Sparkles,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  UserPlus,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { SnoozePreset } from '@/hooks/useNotificationSnooze';

interface NotificationData {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  isRead: boolean;
  relatedObjectType?: string;
  relatedObjectId?: string;
}

interface NotificationQuickActionsProps {
  notification: NotificationData;
  onNavigate: () => void;
  onMarkRead: () => void;
  onDelete: () => void;
  onSnooze?: (preset: SnoozePreset) => void;
  onOpenChat?: () => void;
  onOpenTask?: (taskId: string) => void;
  onOpenDecision?: (decisionId: string) => void;
  onOpenInitiative?: (initiativeId: string) => void;
  canNavigate: boolean;
  navigationLabel: string;
  isSnoozed?: boolean;
  snoozedUntilLabel?: string | null;
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
 * Returns array of action keys that should be shown
 */
const getTypeActions = (type: string): string[] => {
  switch (type) {
    case 'TASK_ASSIGNED':
      return ['open_task', 'snooze', 'chat'];
    case 'TASK_OVERDUE':
      return ['open_task', 'snooze', 'chat'];
    case 'TASK_BLOCKED':
      return ['open_task', 'chat'];
    case 'DECISION_REQUIRED':
      return ['open_decision', 'snooze', 'chat'];
    case 'DECISION_OVERDUE':
      return ['open_decision', 'chat'];
    case 'GATE_PENDING_APPROVAL':
      return ['open_initiative', 'chat'];
    case 'AI_RECOMMENDATION':
      return ['apply', 'dismiss', 'chat'];
    case 'AI_RISK_DETECTED':
      return ['open', 'discuss', 'chat'];
    case 'INITIATIVE_STARTED':
    case 'INITIATIVE_STALLED':
    case 'INITIATIVE_COMPLETED':
      return ['open_initiative', 'chat'];
    default:
      return ['open', 'chat'];
  }
};

/**
 * Snooze preset options with labels
 */
const SNOOZE_PRESETS: { preset: SnoozePreset; labelEn: string; labelPl: string }[] = [
  { preset: '1h', labelEn: '1 hour', labelPl: '1 godzina' },
  { preset: '4h', labelEn: '4 hours', labelPl: '4 godziny' },
  { preset: '1d', labelEn: '1 day', labelPl: '1 dzień' },
  { preset: '3d', labelEn: '3 days', labelPl: '3 dni' },
];

export const NotificationQuickActions: React.FC<NotificationQuickActionsProps> = ({
  notification,
  onNavigate,
  onMarkRead,
  onDelete,
  onSnooze,
  onOpenChat,
  onOpenTask,
  onOpenDecision,
  onOpenInitiative,
  canNavigate,
  navigationLabel,
  isSnoozed,
  snoozedUntilLabel,
  onApprove,
  onReject,
  onReassign,
  onDiscuss,
  onApplyRecommendation,
  onDismissRecommendation,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const typeActions = getTypeActions(notification.type);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  const renderPrimaryAction = () => {
    // Task-specific navigation
    if (typeActions.includes('open_task') && onOpenTask && notification.relatedObjectId) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenTask(notification.relatedObjectId!);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <CheckSquare size={12} />
          {isPolish ? 'Otwórz dokument' : 'Open document'}
        </button>
      );
    }

    // Decision-specific navigation
    if (typeActions.includes('open_decision') && onOpenDecision && notification.relatedObjectId) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenDecision(notification.relatedObjectId!);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-c-text hover:bg-c-text-secondary text-c-bg text-xs font-medium rounded-lg transition-colors"
        >
          <Scale size={12} />
          {isPolish ? 'Otwórz dokument' : 'Open document'}
        </button>
      );
    }

    // Initiative-specific navigation
    if (
      typeActions.includes('open_initiative') &&
      onOpenInitiative &&
      notification.relatedObjectId
    ) {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenInitiative(notification.relatedObjectId!);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          <Target size={12} />
          {isPolish ? 'Otwórz dokument' : 'Open document'}
        </button>
      );
    }

    // Decision actions (approve/reject)
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
              className="flex items-center gap-1.5 px-3 py-1.5 bg-danger-500 hover:bg-danger-600 text-white text-xs font-medium rounded-lg transition-colors"
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
            className="flex items-center gap-1.5 px-3 py-1.5 bg-c-text hover:bg-c-text-secondary text-c-bg text-xs font-medium rounded-lg transition-colors"
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

        {/* Chat button - always available */}
        {typeActions.includes('chat') && onOpenChat && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenChat();
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-xs font-medium rounded-lg transition-colors border border-primary-200 dark:border-primary-800"
          >
            <MessageSquare size={12} />
            {isPolish ? 'Czat' : 'Chat'}
          </button>
        )}

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
        {/* Snooze with dropdown */}
        {typeActions.includes('snooze') && onSnooze && (
          <div className="relative">
            {isSnoozed ? (
              <span className="flex items-center gap-1 px-2 py-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                <Clock size={12} />
                {snoozedUntilLabel || (isPolish ? 'Odłożone' : 'Snoozed')}
              </span>
            ) : (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSnoozeMenu(!showSnoozeMenu);
                  }}
                  className="flex items-center gap-1 p-1.5 text-slate-600 dark:text-slate-500 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded transition-colors"
                  title={isPolish ? 'Odłóż' : 'Snooze'}
                >
                  <Clock size={14} />
                  <ChevronDown size={10} />
                </button>
                {showSnoozeMenu && (
                  <div className="absolute right-0 top-full mt-1 py-1 bg-white dark:bg-navy-800 rounded-lg shadow-lg border border-slate-200 dark:border-navy-700 z-50 min-w-[120px]">
                    {SNOOZE_PRESETS.map(({ preset, labelEn, labelPl }) => (
                      <button
                        key={preset}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSnooze(preset);
                          setShowSnoozeMenu(false);
                        }}
                        className="w-full px-3 py-1.5 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-navy-700 transition-colors"
                      >
                        {isPolish ? labelPl : labelEn}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Mark as Read */}
        {!notification.isRead && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMarkRead();
            }}
            className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
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
          className="p-1.5 text-slate-600 dark:text-slate-500 hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded transition-colors"
          title={t('notifications.actions.delete', 'Delete')}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
};

export default NotificationQuickActions;
