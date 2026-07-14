/**
 * NotificationsContent - Notifications table for MyWorkHub
 * Professional table design with resizable columns matching Decisions and Tasks modules
 * Enhanced with time-based grouping, inline quick actions, and snooze functionality
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Bell,
  BellOff,
  BookOpen,
  Bot,
  Check,
  CheckSquare,
  ChevronRight,
  Clock,
  CreditCard,
  Eye,
  FolderOpen,
  Info,
  Megaphone,
  MessageSquare,
  Minus,
  Sparkles,
  Square,
  Target,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { type RowActionSection, RowActionsMenu } from '@/components/shared/RowActionsMenu';
import { SELECTED_ROW_CLASS } from '@/components/shared/selectionTokens';
import { EmptyState } from '@/components/ui/composed/EmptyState';
import { LoadingState } from '@/components/ui/primitives';
import {
  BulkActionBar,
  type ColumnDef,
  ColumnResizer,
  type ColumnWidths,
  createNotificationBulkActions,
  NOTIFICATION_TYPE_FILTER_OPTIONS,
  type TableFilters,
} from '@/components/ui/ResizableTable';
import { FilterDropdown } from '@/components/ui/ResizableTable/FilterDropdown';
import { type SnoozePreset, useNotificationSnooze } from '@/hooks/useNotificationSnooze';
import i18n from '@/i18n';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import {
  clearMutedNotificationTypesForSession,
  getMutedNotificationTypes,
  isNotificationTypeMuted,
  NOTIFICATION_MUTE_SESSION_CHANGED_EVENT,
  unmuteNotificationTypeForSession,
} from '@/utils/notificationMuteSession';

type NotificationFilter = 'all' | 'unread' | 'today' | 'week';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  body?: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  priority?: string;
  category?: string;
  read: boolean;
  isRead?: boolean;
  readAt?: string;
  createdAt: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
  projectId?: string;
  projectName?: string;
  data?: Record<string, unknown>;
}

interface NotificationCounts {
  total: number;
  unread: number;
  today: number;
  week: number;
}

interface NotificationsContentProps {
  filter: NotificationFilter;
  searchQuery: string;
  onOpenTask?: (taskId: string, taskData?: any) => void;
  onOpenDecision?: (decisionId: string, decisionData?: any) => void;
  onOpenInitiative?: (initiativeId: string) => void;
  onNotificationClick?: (notificationId: string, notificationData?: Notification) => void;
  onCountsChange: (counts: NotificationCounts) => void;
}

// Format relative time
const formatRelativeTime = (dateString: string, isPolish: boolean = false): string => {
  if (!dateString) return i18n.t('myWork.notificationsContent.recently', 'Recently');
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return i18n.t('myWork.notificationsContent.recently2', 'Recently');

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return i18n.t('myWork.notificationsContent.justNow', 'Just now');
  if (diffMins < 60) return isPolish ? `${diffMins} min temu` : `${diffMins}m ago`;
  if (diffHours < 24) return isPolish ? `${diffHours} godz. temu` : `${diffHours}h ago`;
  if (diffDays < 7) return isPolish ? `${diffDays} dni temu` : `${diffDays}d ago`;
  return date.toLocaleDateString(
    i18n.t('myWork.notificationsContent.dateToLocaleDateString', 'en-US')
  );
};

// Time group types
type TimeGroup = 'today' | 'yesterday' | 'this_week' | 'earlier';

// Get time group for a notification
const getTimeGroup = (dateString: string): TimeGroup => {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (date >= today) return 'today';
  if (date >= yesterday) return 'yesterday';
  if (date >= weekAgo) return 'this_week';
  return 'earlier';
};

// Time group labels
const TIME_GROUP_LABELS: Record<TimeGroup, { en: string; pl: string }> = {
  today: { en: 'Today', pl: 'Dzisiaj' },
  yesterday: { en: 'Yesterday', pl: 'Wczoraj' },
  this_week: { en: 'This Week', pl: 'Ten tydzień' },
  earlier: { en: 'Earlier', pl: 'Wcześniej' },
};

// Get notification type config — neutral monochromatic (type is a label, not a status)
const NEUTRAL_TYPE_STYLE = {
  color: 'text-c-text-secondary',
  bg: 'bg-c-surface-raised',
};

const getTypeConfig = (type: string) => {
  const typeUpper = type?.toUpperCase() || '';

  if (typeUpper.includes('TASK')) {
    return {
      label: i18n.t('myWork.notificationsContent.type.task', 'Task'),
      icon: CheckSquare,
      ...NEUTRAL_TYPE_STYLE,
    };
  }
  if (typeUpper.includes('DECISION')) {
    return {
      label: i18n.t('myWork.notificationsContent.type.decision', 'Decision'),
      icon: AlertCircle,
      ...NEUTRAL_TYPE_STYLE,
    };
  }
  if (typeUpper.includes('AI') || typeUpper.includes('RECOMMENDATION')) {
    return {
      label: i18n.t('myWork.notificationsContent.type.aiInsight', 'AI Insight'),
      icon: Sparkles,
      ...NEUTRAL_TYPE_STYLE,
    };
  }
  if (typeUpper.includes('GATE') || typeUpper.includes('APPROVAL')) {
    return {
      label: i18n.t('myWork.notificationsContent.type.approval', 'Approval'),
      icon: Target,
      ...NEUTRAL_TYPE_STYLE,
    };
  }
  if (typeUpper.includes('SYSTEM') || typeUpper.includes('SECURITY')) {
    return {
      label: i18n.t('myWork.notificationsContent.type.system', 'System'),
      icon: Bot,
      ...NEUTRAL_TYPE_STYLE,
    };
  }
  if (
    typeUpper.includes('BILLING') ||
    typeUpper.includes('PAYMENT') ||
    typeUpper.includes('SUBSCRIPTION') ||
    typeUpper.includes('USAGE') ||
    typeUpper.includes('INVOICE') ||
    typeUpper.includes('LIMIT')
  ) {
    return {
      label: i18n.t('myWork.notificationsContent.type.billing', 'Billing'),
      icon: CreditCard,
      ...NEUTRAL_TYPE_STYLE,
    };
  }
  if (typeUpper.startsWith('DBR77_') || typeUpper.includes('DBR77')) {
    const icon =
      typeUpper.includes('KB') || typeUpper.includes('INSTRUCTION') ? BookOpen : Megaphone;
    return {
      label: i18n.t('myWork.notificationsContent.type.dbr77', 'DBR77'),
      icon,
      ...NEUTRAL_TYPE_STYLE,
    };
  }
  return {
    label: i18n.t('myWork.notificationsContent.type.alert', 'Alert'),
    icon: Bell,
    ...NEUTRAL_TYPE_STYLE,
  };
};

// Get severity config — alarm for CRITICAL/WARNING, neutral for INFO
const getSeverityConfig = (severity: string) => {
  switch (severity) {
    case 'CRITICAL':
      return {
        label: i18n.t('myWork.notificationsContent.severity.critical', 'Critical'),
        color: 'text-rose-700 dark:text-rose-400',
        bg: 'bg-rose-100 dark:bg-rose-500/20',
        dot: 'bg-rose-500',
        icon: Zap,
      };
    case 'WARNING':
      return {
        label: i18n.t('myWork.notificationsContent.severity.warning', 'Warning'),
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-500/20',
        dot: 'bg-amber-500',
        icon: AlertTriangle,
      };
    default:
      return {
        label: i18n.t('myWork.notificationsContent.severity.info', 'Info'),
        color: 'text-c-text-secondary',
        bg: 'bg-c-surface-raised',
        dot: 'bg-slate-400 dark:bg-slate-500',
        icon: Info,
      };
  }
};

// Get source/related object config
const getSourceConfig = (relatedType?: string) => {
  switch (relatedType?.toUpperCase()) {
    case 'TASK':
      return {
        label: i18n.t('myWork.notificationsContent.source.task', 'Task'),
        icon: CheckSquare,
      };
    case 'DECISION':
      return {
        label: i18n.t('myWork.notificationsContent.source.decision', 'Decision'),
        icon: AlertCircle,
      };
    case 'PROJECT':
      return {
        label: i18n.t('myWork.notificationsContent.source.project', 'Project'),
        icon: FolderOpen,
      };
    case 'USER':
      return { label: i18n.t('myWork.notificationsContent.source.user', 'User'), icon: Bell };
    default:
      return null;
  }
};

// Severity filter options
const SEVERITY_FILTER_OPTIONS = [
  { value: 'critical', label: i18n.t('myWork.notificationsContent.severity.critical', 'Critical') },
  { value: 'warning', label: i18n.t('myWork.notificationsContent.severity.warning', 'Warning') },
  { value: 'info', label: i18n.t('myWork.notificationsContent.severity.info', 'Info') },
];

// Notification table column definitions
const NOTIFICATION_COLUMNS: ColumnDef[] = [
  {
    id: 'select',
    label: '',
    width: 40,
    minWidth: 40,
    maxWidth: 40,
    resizable: false,
    filterable: false,
  },
  {
    id: 'severity',
    label: i18n.t('myWork.notificationsContent.columns.severity', 'Severity'),
    width: 80,
    minWidth: 70,
    maxWidth: 100,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: SEVERITY_FILTER_OPTIONS,
  },
  {
    id: 'type',
    label: i18n.t('myWork.notificationsContent.columns.type', 'Type'),
    width: 130,
    minWidth: 100,
    maxWidth: 170,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: NOTIFICATION_TYPE_FILTER_OPTIONS,
  },
  {
    id: 'content',
    label: i18n.t('myWork.notificationsContent.columns.notification', 'Notification'),
    width: 999, // flex — will stretch to fill remaining space
    minWidth: 300,
    resizable: false,
    filterable: false,
  },
  {
    id: 'source',
    label: i18n.t('myWork.notificationsContent.columns.source', 'Source'),
    width: 140,
    minWidth: 100,
    maxWidth: 200,
    resizable: true,
    filterable: false,
  },
  {
    id: 'time',
    label: i18n.t('myWork.notificationsContent.columns.time', 'Time'),
    width: 120,
    minWidth: 90,
    maxWidth: 160,
    resizable: true,
    filterable: false,
  },
  {
    id: 'actions',
    label: i18n.t('myWork.notificationsContent.columns.actions', 'Actions'),
    width: 80,
    minWidth: 60,
    maxWidth: 100,
    resizable: false,
    filterable: false,
    align: 'right',
  },
];

// Default column widths
const getDefaultColumnWidths = (): ColumnWidths =>
  NOTIFICATION_COLUMNS.reduce((acc, col) => ({ ...acc, [col.id]: col.width }), {});

// Notification Table Row Component
const NotificationTableRow: React.FC<{
  notification: Notification;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (n: Notification) => void;
  onOpenChat?: (n: Notification) => void;
  onSnooze?: (id: string, preset: SnoozePreset) => void;
  isSnoozed?: boolean;
  snoozedUntilLabel?: string | null;
  columnWidths: ColumnWidths;
  isPolish?: boolean;
}> = ({
  notification,
  isSelected,
  onSelect,
  onMarkRead,
  onDelete,
  onClick,
  onOpenChat,
  onSnooze,
  isSnoozed,
  snoozedUntilLabel,
  columnWidths,
  isPolish = false,
}) => {
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  const isRead = notification.read || notification.isRead;
  const severityConfig = getSeverityConfig(notification.severity);
  const typeConfig = getTypeConfig(notification.type);
  const sourceConfig = getSourceConfig(notification.relatedObjectType);
  const TypeIcon = typeConfig.icon;
  const SeverityIcon = severityConfig.icon;

  return (
    <motion.tr
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -10 }}
      onClick={() => {
        if (!isRead) onMarkRead(notification.id);
        onClick(notification);
      }}
      className={`
        group relative cursor-pointer border-b border-slate-200/60 dark:border-white/[0.03]
        transition-colors duration-150
        ${isSelected ? SELECTED_ROW_CLASS : ''}
        hover:bg-slate-50/70 dark:hover:bg-white/[0.03]
      `}
    >
      {/* Select Checkbox */}
      <td className="w-10 px-2 py-2.5" style={{ width: columnWidths.select }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSelect(notification.id);
          }}
          className={`
            h-3.5 w-3.5 rounded-[4px] border flex items-center justify-center transition-all
            ${
              isSelected
                ? 'bg-c-text border-c-text text-c-surface opacity-100'
                : 'border-c-border-strong bg-white/80 text-transparent opacity-0 hover:border-c-border-strong group-hover:opacity-100 focus:opacity-100 dark:border-white/[0.14] dark:bg-white/[0.035]'
            }
          `}
        >
          {isSelected && <CheckSquare size={12} />}
        </button>
      </td>

      {/* Severity with unread indicator */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.severity }}>
        <div className="flex items-center gap-2">
          {/* Unread dot */}
          <div className="w-2">
            {!isRead && (
              <div
                className={`w-2 h-2 rounded-full ${severityConfig.dot} ${
                  notification.severity === 'CRITICAL' ? 'animate-pulse' : ''
                }`}
              />
            )}
          </div>
          {/* Severity badge */}
          <span
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${severityConfig.bg} ${severityConfig.color}`}
          >
            <SeverityIcon size={10} />
          </span>
        </div>
      </td>

      {/* Type Badge */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.type }}>
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium ${typeConfig.bg} ${typeConfig.color}`}
        >
          <TypeIcon size={12} />
          {typeConfig.label}
        </span>
      </td>

      {/* Notification Content */}
      <td className="px-3 py-2.5 w-full" style={{ minWidth: 300 }}>
        <div className="flex flex-col">
          <span
            className={`text-sm ${isRead ? 'text-c-text-secondary' : 'text-c-text font-medium'}`}
          >
            {notification.title}
          </span>
          {notification.message && (
            <span className="text-xs text-c-text-muted mt-0.5 line-clamp-1">
              {notification.message}
            </span>
          )}
        </div>
      </td>

      {/* Source/Context */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.source }}>
        {sourceConfig ? (
          <div className="flex items-center gap-1.5 text-xs text-c-text-secondary">
            <sourceConfig.icon size={12} />
            <span className="truncate">{sourceConfig.label}</span>
          </div>
        ) : notification.projectName ? (
          <div className="flex items-center gap-1.5 text-xs text-c-text-secondary">
            <FolderOpen size={12} />
            <span className="truncate max-w-[80px]">{notification.projectName}</span>
          </div>
        ) : (
          <span className="text-xs text-c-text-muted">-</span>
        )}
      </td>

      {/* Time */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.time }}>
        <div className="flex items-center gap-1.5 text-xs text-c-text-muted">
          <Clock size={12} />
          <span>{formatRelativeTime(notification.createdAt)}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.actions }}>
        <div className="flex items-center justify-end gap-1">
          {/* Snoozed indicator */}
          {isSnoozed && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded">
              <Clock size={10} />
              {snoozedUntilLabel || i18n.t('myWork.notificationsContent.snoozed', 'Snoozed')}
            </span>
          )}

          {/* Inline quick actions (visible on hover) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Chat button */}
            {onOpenChat && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChat(notification);
                }}
                className="p-1.5 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-c-text-muted hover:text-c-text transition-colors"
                title={i18n.t('myWork.notificationsContent.title', 'Chat')}
              >
                <MessageSquare size={14} />
              </button>
            )}

            {/* Snooze button with dropdown */}
            {onSnooze && !isSnoozed && (
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSnoozeMenu(!showSnoozeMenu);
                  }}
                  className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-900/30 text-c-text-muted hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                  title={i18n.t('myWork.notificationsContent.title2', 'Snooze')}
                >
                  <Clock size={14} />
                </button>
                {showSnoozeMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSnoozeMenu(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 py-1 bg-c-surface-raised rounded-lg shadow-lg border border-c-border min-w-[100px]">
                      {[
                        {
                          preset: '1h' as SnoozePreset,
                          label: i18n.t('myWork.notificationsContent.label', '1 hour'),
                        },
                        {
                          preset: '4h' as SnoozePreset,
                          label: i18n.t('myWork.notificationsContent.label2', '4 hours'),
                        },
                        {
                          preset: '1d' as SnoozePreset,
                          label: i18n.t('myWork.notificationsContent.label3', '1 day'),
                        },
                        {
                          preset: '3d' as SnoozePreset,
                          label: i18n.t('myWork.notificationsContent.label4', '3 days'),
                        },
                      ].map(({ preset, label }) => (
                        <button
                          key={preset}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSnooze(notification.id, preset);
                            setShowSnoozeMenu(false);
                          }}
                          className="w-full px-3 py-1.5 text-left text-xs text-c-text-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mark as read button (only for unread) */}
            {!isRead && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onMarkRead(notification.id);
                }}
                className="p-1.5 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-c-text-muted hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                title={i18n.t('myWork.notificationsContent.title3', 'Mark as read')}
              >
                <Check size={14} />
              </button>
            )}
          </div>

          {/* View button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(notification);
            }}
            className="p-1.5 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06] text-c-text-muted hover:text-c-text transition-colors"
            title={i18n.t('myWork.notificationsContent.title4', 'View')}
          >
            <Eye size={14} />
          </button>

          {/* 3-dot menu — canonical RowActionsMenu (§9) */}
          <div onClick={(e) => e.stopPropagation()}>
            {(() => {
              const sections: RowActionSection[] = [
                {
                  id: 'context',
                  kind: 'context',
                  actions: [
                    {
                      id: 'view',
                      label: i18n.t('myWork.notificationsContent.label5', 'View Details'),
                      icon: Eye,
                      variant: 'primary',
                      onClick: () => onClick(notification),
                    },
                    ...(onOpenChat
                      ? [
                          {
                            id: 'chat',
                            label: i18n.t('myWork.notificationsContent.label6', 'Open Chat'),
                            icon: MessageSquare,
                            onClick: () => onOpenChat(notification),
                          },
                        ]
                      : []),
                    ...(!isRead
                      ? [
                          {
                            id: 'mark-read',
                            label: i18n.t('myWork.notificationsContent.label7', 'Mark as Read'),
                            icon: Check,
                            onClick: () => onMarkRead(notification.id),
                          },
                        ]
                      : []),
                    ...(notification.relatedObjectId
                      ? [
                          {
                            id: 'go-source',
                            label: i18n.t('myWork.notificationsContent.label8', 'Go to Source'),
                            icon: ArrowRight,
                            onClick: () => onClick(notification),
                          },
                        ]
                      : []),
                  ],
                },
                // DÓŁ — FIXED BOTTOM MANIFEST (canon §9.2).
                // Notifications carry no `due_date`, so the Delay slot (pos. 4) is N/A.
                {
                  id: 'fixed',
                  kind: 'manage',
                  actions: [
                    {
                      id: 'open-preview',
                      label: i18n.t('myWork.notificationsContent.label9', 'Open preview'),
                      icon: ChevronRight,
                      onClick: () => onClick(notification),
                    },
                    {
                      id: 'edit',
                      label: i18n.t('myWork.notificationsContent.label10', 'Edit'),
                      icon: Eye,
                      disabled: true,
                      description: i18n.t(
                        'myWork.notificationsContent.description',
                        'Coming soon (backend)'
                      ),
                      onClick: () => {},
                    },
                    {
                      id: 'archive',
                      label: i18n.t('myWork.notificationsContent.label11', 'Archive'),
                      icon: Archive,
                      disabled: true,
                      description: i18n.t(
                        'myWork.notificationsContent.description2',
                        'Coming soon (backend)'
                      ),
                      onClick: () => {},
                    },
                  ],
                },
                {
                  id: 'danger',
                  kind: 'danger',
                  actions: [
                    {
                      id: 'delete',
                      label: i18n.t('myWork.notificationsContent.label12', 'Delete'),
                      icon: Trash2,
                      variant: 'danger',
                      onClick: () => onDelete(notification.id),
                    },
                  ],
                },
              ];
              return <RowActionsMenu sections={sections} iconVariant="vertical" />;
            })()}
          </div>
        </div>
      </td>
    </motion.tr>
  );
};

export const NotificationsContent: React.FC<NotificationsContentProps> = ({
  filter,
  searchQuery,
  onOpenTask,
  onOpenDecision,
  onOpenInitiative,
  onNotificationClick,
  onCountsChange,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Column widths state (for resizable columns)
  const [columnWidths, setColumnWidths] = useState<ColumnWidths>(getDefaultColumnWidths());

  // Filter state (session only)
  const [tableFilters, setTableFilters] = useState<TableFilters>({});

  // Open filter dropdown state
  const [openFilterId, setOpenFilterId] = useState<string | null>(null);

  // Session-muted types UI
  const [mutedTypesOpen, setMutedTypesOpen] = useState(false);
  const [mutedTypes, setMutedTypes] = useState<string[]>(() => getMutedNotificationTypes());

  useEffect(() => {
    if (mutedTypes.length === 0 && mutedTypesOpen) setMutedTypesOpen(false);
  }, [mutedTypes.length, mutedTypesOpen]);

  // Snooze hook
  const { snooze, isSnoozed, formatRemainingTime, getSnoozedIds } = useNotificationSnooze();

  // Chat integration
  const { isChatCollapsed, toggleChatCollapse } = useAppStore();
  const { updateWorkspaceFromView } = useConversationStore();

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getNotifications();
      // Ensure severity is properly mapped from backend response
      const mapped = (Array.isArray(data) ? data : []).map((n: any) => ({
        ...n,
        severity: n.severity || 'INFO',
        message: n.message || n.body || '',
        isRead: n.isRead ?? (n.read === true || n.read === 1),
        data: n.data || n.metadata || {},
      }));
      setNotifications(mapped.filter((n: any) => !isNotificationTypeMuted(n.type)));
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error(
        t('myWork.notificationsContent.toast.loadFailed', 'Failed to load notifications')
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Refresh on session mute changes
  useEffect(() => {
    const handle = () => {
      setMutedTypes(getMutedNotificationTypes());
      fetchNotifications();
    };
    window.addEventListener(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT, handle as any);
    return () => window.removeEventListener(NOTIFICATION_MUTE_SESSION_CHANGED_EVENT, handle as any);
  }, [fetchNotifications]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let result = notifications;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (n) => n.title?.toLowerCase().includes(query) || n.message?.toLowerCase().includes(query)
      );
    }

    // Status filter
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    switch (filter) {
      case 'unread':
        result = result.filter((n) => !(n.read || n.isRead));
        break;
      case 'today':
        result = result.filter((n) => new Date(n.createdAt) >= today);
        break;
      case 'week':
        result = result.filter((n) => new Date(n.createdAt) >= weekAgo);
        break;
    }

    // Sort by date (newest first)
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return result;
  }, [notifications, searchQuery, filter]);

  // Calculate counts
  useEffect(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const counts: NotificationCounts = {
      total: notifications.length,
      unread: notifications.filter((n) => !(n.read || n.isRead)).length,
      today: notifications.filter((n) => new Date(n.createdAt) >= today).length,
      week: notifications.filter((n) => new Date(n.createdAt) >= weekAgo).length,
    };
    onCountsChange(counts);
  }, [notifications, onCountsChange]);

  // Handlers
  const handleMarkRead = async (id: string) => {
    try {
      await Api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true, isRead: true } : n))
      );
    } catch (error) {
      toast.error(
        t('myWork.notificationsContent.toast.markReadFailed', 'Failed to mark notification as read')
      );
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await Api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success(t('myWork.notificationsContent.toast.deleted', 'Notification deleted'));
    } catch (error) {
      toast.error(
        t('myWork.notificationsContent.toast.deleteFailed', 'Failed to delete notification')
      );
    }
  };

  const handleClick = (notification: Notification) => {
    if (!notification.read && !notification.isRead) {
      handleMarkRead(notification.id);
    }

    // Open notification in dynamic tab
    if (onNotificationClick) {
      onNotificationClick(notification.id, notification);
    }
    // Also handle related object navigation if needed
    else if (
      notification.relatedObjectType === 'TASK' &&
      notification.relatedObjectId &&
      onOpenTask
    ) {
      onOpenTask(notification.relatedObjectId);
    } else if (
      notification.relatedObjectType === 'DECISION' &&
      notification.relatedObjectId &&
      onOpenDecision
    ) {
      onOpenDecision(notification.relatedObjectId);
    } else if (
      (notification.relatedObjectType === 'INITIATIVE' ||
        notification.relatedObjectType === 'initiative') &&
      notification.relatedObjectId &&
      onOpenInitiative
    ) {
      onOpenInitiative(notification.relatedObjectId);
    }
  };

  // Handle opening chat with notification context
  const handleOpenChat = (notification: Notification) => {
    // Ensure chat panel is visible
    if (isChatCollapsed) {
      toggleChatCollapse();
    }

    // Push notification context into the unified chat workspace context
    updateWorkspaceFromView(AppView.MY_WORK, notification.id, {
      type: 'notification',
      id: notification.id,
      notificationType: notification.type,
      severity: notification.severity,
      title: notification.title,
      message: notification.message,
      relatedEntity:
        notification.relatedObjectType && notification.relatedObjectId
          ? {
              type: notification.relatedObjectType,
              id: notification.relatedObjectId,
            }
          : null,
      projectId: notification.projectId || null,
      projectName: notification.projectName || null,
    });

    toast.success(t('myWork.notificationsContent.toastSuccess', 'Chat opened'));
  };

  // Handle snoozing a notification
  const handleSnooze = (notificationId: string, preset: SnoozePreset) => {
    const until = snooze(notificationId, preset);
    const presetLabels: Record<SnoozePreset, { en: string; pl: string }> = {
      '1h': { en: '1 hour', pl: '1 godzinę' },
      '4h': { en: '4 hours', pl: '4 godziny' },
      '1d': { en: '1 day', pl: '1 dzień' },
      '3d': { en: '3 days', pl: '3 dni' },
    };
    toast.success(
      isPolish
        ? `Powiadomienie odłożone na ${presetLabels[preset].pl}`
        : `Notification snoozed for ${presetLabels[preset].en}`
    );
  };

  // Selection helpers
  const allVisibleNotificationIds = useMemo(() => {
    return new Set(filteredNotifications.map((n) => n.id));
  }, [filteredNotifications]);

  const allSelected = selectedIds.size > 0 && selectedIds.size === allVisibleNotificationIds.size;
  const someSelected = selectedIds.size > 0 && selectedIds.size < allVisibleNotificationIds.size;

  // Selection handlers
  const handleSelectNotification = (notificationId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(notificationId)) {
        next.delete(notificationId);
      } else {
        next.add(notificationId);
      }
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(allVisibleNotificationIds));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Column resize handler
  const handleColumnResize = (columnId: string, newWidth: number) => {
    setColumnWidths((prev) => ({
      ...prev,
      [columnId]: newWidth,
    }));
  };

  // Filter handler
  const handleFilterChange = (columnId: string, values: string[]) => {
    setTableFilters((prev) => ({
      ...prev,
      [columnId]: values.length > 0 ? values : undefined,
    }));
  };

  // Bulk actions
  const handleBulkMarkRead = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.markNotificationRead(id)));
      setNotifications((prev) =>
        prev.map((n) => (selectedIds.has(n.id) ? { ...n, read: true, isRead: true } : n))
      );
      toast.success(
        t(
          'myWork.notificationsContent.toast.bulkMarkedRead',
          '{{count}} notifications marked as read',
          {
            count: selectedIds.size,
          }
        )
      );
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(
        t(
          'myWork.notificationsContent.toast.bulkMarkReadFailed',
          'Failed to mark notifications as read'
        )
      );
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.deleteNotification(id)));
      setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      toast.success(
        t('myWork.notificationsContent.toast.bulkDeleted', '{{count}} notifications deleted', {
          count: selectedIds.size,
        })
      );
      setSelectedIds(new Set());
    } catch (error) {
      toast.error(
        t('myWork.notificationsContent.toast.bulkDeleteFailed', 'Failed to delete notifications')
      );
    }
  };

  // Create bulk action configuration
  const handleBulkArchive = async () => {
    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => Api.patch(`/notifications/${id}`, { archived: true }))
      );
      setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      toast.success(
        t('myWork.notificationsContent.toast.bulkArchived', '{{count}} notifications archived', {
          count: selectedIds.size,
        })
      );
      setSelectedIds(new Set());
    } catch {
      toast.error(
        t('myWork.notificationsContent.toast.bulkArchiveFailed', 'Failed to archive notifications')
      );
    }
  };

  const bulkActions = createNotificationBulkActions({
    onMarkRead: handleBulkMarkRead,
    onDelete: handleBulkDelete,
    onArchive: handleBulkArchive,
  });

  // Apply table filters and exclude snoozed notifications
  const displayedNotifications = useMemo(() => {
    let result = filteredNotifications;

    // Filter out snoozed notifications
    const snoozedIds = getSnoozedIds();
    result = result.filter((n) => !snoozedIds.includes(n.id));

    const severityFilter = tableFilters.severity as string[] | undefined;
    const typeFilter = tableFilters.type as string[] | undefined;

    if (severityFilter?.length) {
      result = result.filter((n) => severityFilter.includes(n.severity?.toLowerCase() || ''));
    }
    if (typeFilter?.length) {
      result = result.filter((n) => {
        const type = getTypeConfig(n.type).label.toLowerCase();
        return typeFilter.includes(type);
      });
    }

    return result;
  }, [filteredNotifications, tableFilters, getSnoozedIds]);

  // Group notifications by time
  const groupedNotifications = useMemo(() => {
    const groups: Record<TimeGroup, Notification[]> = {
      today: [],
      yesterday: [],
      this_week: [],
      earlier: [],
    };

    displayedNotifications.forEach((n) => {
      const group = getTimeGroup(n.createdAt);
      groups[group].push(n);
    });

    return groups;
  }, [displayedNotifications]);

  // Check if we should show grouping (more than one group has items)
  const showGrouping = useMemo(() => {
    const nonEmptyGroups = Object.values(groupedNotifications).filter((g) => g.length > 0);
    return nonEmptyGroups.length > 1;
  }, [groupedNotifications]);

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <LoadingState variant="spinner" />
      </div>
    );
  }

  if (filteredNotifications.length === 0) {
    return (
      <EmptyState
        icon={<Bell />}
        title={t('myWork.notificationsContent.emptyState.title', 'No notifications')}
        description={t(
          'myWork.notificationsContent.emptyState.description',
          "You're all caught up!"
        )}
        className="h-full"
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-c-bg">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl overflow-hidden">
          {/* Session-muted types (lightweight control) */}
          {mutedTypes.length > 0 && (
            <div className="flex items-center justify-end px-3 py-2 border-b border-c-border-subtle bg-c-surface-raised">
              <div className="relative" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => setMutedTypesOpen((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-c-border text-c-text-secondary hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                  title={t('myWork.notificationsContent.title5', 'Muted types (session)')}
                >
                  <BellOff size={13} className="text-c-text-muted" />
                  {t('myWork.notificationsContent.muted', 'Muted')} ({mutedTypes.length})
                </button>

                {mutedTypesOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMutedTypesOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-xl bg-c-surface-raised border border-c-border shadow-xl overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-200/60 dark:border-white/[0.03] flex items-center justify-between">
                        <span className="text-xs font-semibold text-c-text-secondary">
                          {t(
                            'myWork.notificationsContent.mutedTypesSession',
                            'Muted types (session)'
                          )}
                        </span>
                        <button
                          onClick={() => setMutedTypesOpen(false)}
                          className="p-1 rounded hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                        >
                          <X size={14} className="text-c-text-muted" />
                        </button>
                      </div>

                      <div className="max-h-56 overflow-auto">
                        {/* REALNY BUG (fix przy zerowaniu type-checka): param `t`
                            przesłaniał i18n-owe `t` — t('…unmute') wywoływało
                            string jak funkcję → TypeError przy renderze listy. */}
                        {mutedTypes.map((mutedType) => (
                          <div
                            key={mutedType}
                            className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                          >
                            <span className="text-xs text-c-text-secondary truncate">
                              {mutedType.replace(/_/g, ' ')}
                            </span>
                            <button
                              onClick={() => unmuteNotificationTypeForSession(mutedType)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium border border-c-border text-c-text-muted hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition-colors"
                            >
                              {t('myWork.notificationsContent.unmute', 'Unmute')}
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="px-3 py-2 border-t border-c-border-subtle flex justify-end">
                        <button
                          onClick={() => clearMutedNotificationTypesForSession()}
                          className="text-[11px] font-medium text-c-text-muted hover:text-c-text"
                        >
                          {t('myWork.notificationsContent.clearAll', 'Clear all')}
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
          <table className="w-full table-fixed" style={{ minWidth: 800 }}>
            <thead>
              <tr className="border-b border-c-border-subtle bg-c-surface sticky top-0 z-10">
                {/* Select All */}
                <th className="w-10 px-2 py-2">
                  <button
                    onClick={() => handleSelectAll(!allSelected)}
                    className={`
                      h-4 w-4 rounded-[4px] border flex items-center justify-center transition-colors
                      ${
                        allSelected
                          ? 'bg-c-text border-c-text text-c-surface'
                          : someSelected
                            ? 'bg-c-text/60 border-c-text text-c-surface'
                            : 'border-c-border hover:border-c-border-strong text-transparent hover:text-c-text-muted'
                      }
                    `}
                  >
                    {allSelected ? (
                      <CheckSquare size={14} />
                    ) : someSelected ? (
                      <Minus size={14} />
                    ) : (
                      <Square size={14} />
                    )}
                  </button>
                </th>

                {/* Severity with Filter */}
                <th
                  className="px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider relative group/header"
                  style={{ width: columnWidths.severity }}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className={
                        (tableFilters.severity as string[])?.length ? 'text-c-text-secondary' : ''
                      }
                    >
                      Severity
                    </span>
                    <FilterDropdown
                      column={NOTIFICATION_COLUMNS.find((c) => c.id === 'severity')!}
                      value={tableFilters.severity as string[]}
                      onChange={(val) => handleFilterChange('severity', val as string[])}
                      isOpen={openFilterId === 'severity'}
                      onToggle={() =>
                        setOpenFilterId(openFilterId === 'severity' ? null : 'severity')
                      }
                      onClose={() => setOpenFilterId(null)}
                    />
                  </div>
                  <ColumnResizer
                    columnId="severity"
                    currentWidth={columnWidths.severity}
                    minWidth={70}
                    maxWidth={100}
                    onResize={handleColumnResize}
                  />
                </th>

                {/* Type with Filter */}
                <th
                  className="px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider relative group/header"
                  style={{ width: columnWidths.type }}
                >
                  <div className="flex items-center gap-1">
                    <span
                      className={
                        (tableFilters.type as string[])?.length ? 'text-c-text-secondary' : ''
                      }
                    >
                      Type
                    </span>
                    <FilterDropdown
                      column={NOTIFICATION_COLUMNS.find((c) => c.id === 'type')!}
                      value={tableFilters.type as string[]}
                      onChange={(val) => handleFilterChange('type', val as string[])}
                      isOpen={openFilterId === 'type'}
                      onToggle={() => setOpenFilterId(openFilterId === 'type' ? null : 'type')}
                      onClose={() => setOpenFilterId(null)}
                    />
                  </div>
                  <ColumnResizer
                    columnId="type"
                    currentWidth={columnWidths.type}
                    minWidth={80}
                    maxWidth={130}
                    onResize={handleColumnResize}
                  />
                </th>

                <th className="px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider w-full">
                  Notification
                </th>
                <th
                  className="px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider relative group/header"
                  style={{ width: columnWidths.source }}
                >
                  <span>{t('myWork.notificationsContent.columns.source', 'Source')}</span>
                  <ColumnResizer
                    columnId="source"
                    currentWidth={columnWidths.source}
                    minWidth={80}
                    maxWidth={160}
                    onResize={handleColumnResize}
                  />
                </th>
                <th
                  className="px-3 py-2 text-left text-[11px] font-semibold text-c-text-muted uppercase tracking-wider relative group/header"
                  style={{ width: columnWidths.time }}
                >
                  <span>{t('myWork.notificationsContent.columns.time', 'Time')}</span>
                  <ColumnResizer
                    columnId="time"
                    currentWidth={columnWidths.time}
                    minWidth={80}
                    maxWidth={140}
                    onResize={handleColumnResize}
                  />
                </th>
                <th
                  className="px-3 py-2 text-right text-[11px] font-semibold text-c-text-muted uppercase tracking-wider"
                  style={{ width: columnWidths.actions }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {showGrouping
                  ? // Render with time grouping
                    (['today', 'yesterday', 'this_week', 'earlier'] as TimeGroup[]).map((group) => {
                      const groupNotifications = groupedNotifications[group];
                      if (groupNotifications.length === 0) return null;

                      return (
                        <React.Fragment key={group}>
                          {/* Group header */}
                          <tr className="bg-c-surface-raised">
                            <td colSpan={7} className="px-4 py-2">
                              <span className="text-xs font-semibold text-c-text-secondary uppercase tracking-wider">
                                {isPolish
                                  ? TIME_GROUP_LABELS[group].pl
                                  : TIME_GROUP_LABELS[group].en}
                                <span className="ml-2 text-c-text-muted font-normal">
                                  ({groupNotifications.length})
                                </span>
                              </span>
                            </td>
                          </tr>
                          {/* Group notifications */}
                          {groupNotifications.map((notification) => (
                            <NotificationTableRow
                              key={notification.id}
                              notification={notification}
                              isSelected={selectedIds.has(notification.id)}
                              onSelect={handleSelectNotification}
                              onMarkRead={handleMarkRead}
                              onDelete={handleDelete}
                              onClick={handleClick}
                              onOpenChat={handleOpenChat}
                              onSnooze={handleSnooze}
                              isSnoozed={isSnoozed(notification.id)}
                              snoozedUntilLabel={formatRemainingTime(notification.id, isPolish)}
                              columnWidths={columnWidths}
                              isPolish={isPolish}
                            />
                          ))}
                        </React.Fragment>
                      );
                    })
                  : // Render without grouping
                    displayedNotifications.map((notification) => (
                      <NotificationTableRow
                        key={notification.id}
                        notification={notification}
                        isSelected={selectedIds.has(notification.id)}
                        onSelect={handleSelectNotification}
                        onMarkRead={handleMarkRead}
                        onDelete={handleDelete}
                        onClick={handleClick}
                        onOpenChat={handleOpenChat}
                        onSnooze={handleSnooze}
                        isSnoozed={isSnoozed(notification.id)}
                        snoozedUntilLabel={formatRemainingTime(notification.id, isPolish)}
                        columnWidths={columnWidths}
                        isPolish={isPolish}
                      />
                    ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onClearSelection={handleClearSelection}
        actions={bulkActions}
      />
    </div>
  );
};

export default NotificationsContent;
