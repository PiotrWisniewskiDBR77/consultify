/**
 * NotificationsContent - Notifications table for MyWorkHub
 * Professional table design with resizable columns matching Decisions and Tasks modules
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Bot,
  Check,
  CheckSquare,
  Clock,
  Eye,
  FolderOpen,
  Info,
  Loader2,
  Minus,
  MoreVertical,
  Sparkles,
  Square,
  Target,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import {
  BulkActionBar,
  ColumnResizer,
  createNotificationBulkActions,
  type ColumnDef,
  type ColumnWidths,
  type TableFilters,
  NOTIFICATION_TYPE_FILTER_OPTIONS,
} from '@/components/ui/ResizableTable';
import { FilterDropdown } from '@/components/ui/ResizableTable/FilterDropdown';

type NotificationFilter = 'all' | 'unread' | 'today' | 'week';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  read: boolean;
  isRead?: boolean;
  readAt?: string;
  createdAt: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
  projectId?: string;
  projectName?: string;
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
  onNotificationClick?: (notificationId: string, notificationData?: Notification) => void;
  onCountsChange: (counts: NotificationCounts) => void;
}

// Format relative time
const formatRelativeTime = (dateString: string): string => {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recently';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

// Get notification type config
const getTypeConfig = (type: string) => {
  const typeUpper = type?.toUpperCase() || '';

  if (typeUpper.includes('TASK')) {
    return {
      label: 'Task',
      icon: CheckSquare,
      color: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-100 dark:bg-blue-500/20',
    };
  }
  if (typeUpper.includes('DECISION')) {
    return {
      label: 'Decision',
      icon: AlertCircle,
      color: 'text-purple-700 dark:text-purple-400',
      bg: 'bg-purple-100 dark:bg-purple-500/20',
    };
  }
  if (typeUpper.includes('AI') || typeUpper.includes('RECOMMENDATION')) {
    return {
      label: 'AI Insight',
      icon: Sparkles,
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-100 dark:bg-emerald-500/20',
    };
  }
  if (typeUpper.includes('GATE') || typeUpper.includes('APPROVAL')) {
    return {
      label: 'Approval',
      icon: Target,
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-100 dark:bg-amber-500/20',
    };
  }
  if (typeUpper.includes('SYSTEM') || typeUpper.includes('SECURITY')) {
    return {
      label: 'System',
      icon: Bot,
      color: 'text-slate-700 dark:text-slate-400',
      bg: 'bg-slate-100 dark:bg-slate-500/20',
    };
  }
  return {
    label: 'Alert',
    icon: Bell,
    color: 'text-slate-700 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-500/20',
  };
};

// Get severity config
const getSeverityConfig = (severity: string) => {
  switch (severity) {
    case 'CRITICAL':
      return {
        label: 'Critical',
        color: 'text-red-700 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-500/20',
        dot: 'bg-red-500',
        icon: Zap,
      };
    case 'WARNING':
      return {
        label: 'Warning',
        color: 'text-amber-700 dark:text-amber-400',
        bg: 'bg-amber-100 dark:bg-amber-500/20',
        dot: 'bg-amber-500',
        icon: AlertTriangle,
      };
    default:
      return {
        label: 'Info',
        color: 'text-blue-700 dark:text-blue-400',
        bg: 'bg-blue-100 dark:bg-blue-500/20',
        dot: 'bg-blue-500',
        icon: Info,
      };
  }
};

// Get source/related object config
const getSourceConfig = (relatedType?: string) => {
  switch (relatedType?.toUpperCase()) {
    case 'TASK':
      return { label: 'Task', icon: CheckSquare };
    case 'DECISION':
      return { label: 'Decision', icon: AlertCircle };
    case 'PROJECT':
      return { label: 'Project', icon: FolderOpen };
    case 'USER':
      return { label: 'User', icon: Bell };
    default:
      return null;
  }
};

// Severity filter options
const SEVERITY_FILTER_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'info', label: 'Info' },
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
    label: 'Severity',
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
    label: 'Type',
    width: 100,
    minWidth: 80,
    maxWidth: 130,
    resizable: true,
    filterable: true,
    filterType: 'multiselect',
    filterOptions: NOTIFICATION_TYPE_FILTER_OPTIONS,
  },
  {
    id: 'content',
    label: 'Notification',
    width: 300,
    minWidth: 200,
    resizable: false,
    filterable: false,
  },
  {
    id: 'source',
    label: 'Source',
    width: 120,
    minWidth: 80,
    maxWidth: 160,
    resizable: true,
    filterable: false,
  },
  {
    id: 'time',
    label: 'Time',
    width: 100,
    minWidth: 80,
    maxWidth: 140,
    resizable: true,
    filterable: false,
  },
  {
    id: 'actions',
    label: 'Actions',
    width: 100,
    minWidth: 80,
    maxWidth: 120,
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
  columnWidths: ColumnWidths;
}> = ({ notification, isSelected, onSelect, onMarkRead, onDelete, onClick, columnWidths }) => {
  const [showMenu, setShowMenu] = useState(false);

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
      whileHover={{
        y: -2,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
        transition: { duration: 0.2 },
      }}
      onClick={() => {
        if (!isRead) onMarkRead(notification.id);
        onClick(notification);
      }}
      className={`
        group cursor-pointer border-b border-slate-200 dark:border-navy-700/50
        transition-colors duration-150
        ${isSelected ? 'bg-primary-50 dark:bg-primary-500/10' : isRead ? 'bg-slate-50/50 dark:bg-navy-900/30' : 'bg-white dark:bg-navy-900'}
        hover:bg-slate-50 dark:hover:bg-navy-800/50
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
            w-5 h-5 rounded border flex items-center justify-center transition-all
            ${isSelected
              ? 'bg-primary-500 border-primary-500 text-white'
              : 'border-slate-300 dark:border-navy-500 hover:border-primary-400'
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
      <td className="px-3 py-2.5" style={{ minWidth: 200 }}>
        <div className="flex flex-col">
          <span
            className={`text-sm ${
              isRead
                ? 'text-slate-600 dark:text-slate-400'
                : 'text-slate-900 dark:text-white font-medium'
            }`}
          >
            {notification.title}
          </span>
          {notification.message && (
            <span className="text-xs text-slate-500 mt-0.5 line-clamp-1">
              {notification.message}
            </span>
          )}
        </div>
      </td>

      {/* Source/Context */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.source }}>
        {sourceConfig ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <sourceConfig.icon size={12} />
            <span className="truncate">{sourceConfig.label}</span>
          </div>
        ) : notification.projectName ? (
          <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <FolderOpen size={12} />
            <span className="truncate max-w-[80px]">{notification.projectName}</span>
          </div>
        ) : (
          <span className="text-xs text-slate-400 dark:text-slate-600">-</span>
        )}
      </td>

      {/* Time */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.time }}>
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Clock size={12} />
          <span>{formatRelativeTime(notification.createdAt)}</span>
        </div>
      </td>

      {/* Actions */}
      <td className="px-3 py-2.5" style={{ width: columnWidths.actions }}>
        <div className="flex items-center justify-end gap-1">
          {/* Mark as read button (only for unread) */}
          {!isRead && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(notification.id);
              }}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
              title="Mark as read"
            >
              <Check size={14} />
            </button>
          )}

          {/* View button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClick(notification);
            }}
            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            title="View"
          >
            <Eye size={14} />
          </button>

          {/* 3-dot menu */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-navy-600 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <MoreVertical size={14} />
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-40 bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 rounded-lg shadow-xl overflow-hidden">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onClick(notification);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                  >
                    <Eye size={14} />
                    View Details
                  </button>
                  {!isRead && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkRead(notification.id);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-700"
                    >
                      <Check size={14} />
                      Mark as Read
                    </button>
                  )}
                  {notification.relatedObjectId && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onClick(notification);
                        setShowMenu(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-700 dark:text-blue-400 hover:bg-slate-50 dark:hover:bg-navy-700"
                    >
                      <ArrowRight size={14} />
                      Go to Source
                    </button>
                  )}
                  <div className="border-t border-slate-200 dark:border-navy-600" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(notification.id);
                      setShowMenu(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-slate-50 dark:hover:bg-navy-700"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </>
            )}
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
  onNotificationClick,
  onCountsChange,
}) => {
  const { t } = useTranslation();
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

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await Api.getNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let result = notifications;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title?.toLowerCase().includes(query) || n.message?.toLowerCase().includes(query)
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
      toast.error('Failed to mark notification as read');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await Api.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      toast.success('Notification deleted');
    } catch (error) {
      toast.error('Failed to delete notification');
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
    }
  };

  // Selection helpers
  const allVisibleNotificationIds = useMemo(() => {
    return new Set(filteredNotifications.map(n => n.id));
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
        prev.map((n) =>
          selectedIds.has(n.id) ? { ...n, read: true, isRead: true } : n
        )
      );
      toast.success(`${selectedIds.size} notifications marked as read`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to mark notifications as read');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(Array.from(selectedIds).map((id) => Api.deleteNotification(id)));
      setNotifications((prev) => prev.filter((n) => !selectedIds.has(n.id)));
      toast.success(`${selectedIds.size} notifications deleted`);
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Failed to delete notifications');
    }
  };

  // Create bulk action configuration
  const bulkActions = createNotificationBulkActions({
    onMarkRead: handleBulkMarkRead,
    onDelete: handleBulkDelete,
    onArchive: () => toast('Archive coming soon'),
  });

  // Apply table filters
  const displayedNotifications = useMemo(() => {
    let result = filteredNotifications;
    
    const severityFilter = tableFilters.severity as string[] | undefined;
    const typeFilter = tableFilters.type as string[] | undefined;
    
    if (severityFilter?.length) {
      result = result.filter(n => severityFilter.includes(n.severity?.toLowerCase() || ''));
    }
    if (typeFilter?.length) {
      result = result.filter(n => {
        const type = getTypeConfig(n.type).label.toLowerCase();
        return typeFilter.includes(type);
      });
    }
    
    return result;
  }, [filteredNotifications, tableFilters]);

  // Early returns AFTER all hooks
  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-amber-500" size={32} />
      </div>
    );
  }

  if (filteredNotifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Bell size={48} className="text-slate-400 dark:text-slate-600 mb-4" />
        <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">
          No notifications
        </h3>
        <p className="text-sm text-slate-500">You're all caught up!</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-navy-950">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
          <table className="w-full" style={{ minWidth: 800 }}>
            <thead>
              <tr className="border-b border-slate-200 dark:border-navy-700/50 bg-slate-50 dark:bg-navy-900/50 sticky top-0 z-10">
                {/* Select All */}
                <th className="w-10 px-2 py-2">
                  <button
                    onClick={() => handleSelectAll(!allSelected)}
                    className={`
                      w-5 h-5 rounded border flex items-center justify-center transition-colors
                      ${
                        allSelected
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : someSelected
                            ? 'bg-primary-500/50 border-primary-500 text-white'
                            : 'border-slate-300 dark:border-navy-500 hover:border-primary-400 text-transparent hover:text-slate-400'
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
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths.severity }}>
                  <div className="flex items-center gap-1">
                    <span className={(tableFilters.severity as string[])?.length ? 'text-primary-500' : ''}>Severity</span>
                    <FilterDropdown
                      column={NOTIFICATION_COLUMNS.find(c => c.id === 'severity')!}
                      value={tableFilters.severity as string[]}
                      onChange={(val) => handleFilterChange('severity', val as string[])}
                      isOpen={openFilterId === 'severity'}
                      onToggle={() => setOpenFilterId(openFilterId === 'severity' ? null : 'severity')}
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
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths.type }}>
                  <div className="flex items-center gap-1">
                    <span className={(tableFilters.type as string[])?.length ? 'text-primary-500' : ''}>Type</span>
                    <FilterDropdown
                      column={NOTIFICATION_COLUMNS.find(c => c.id === 'type')!}
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
                
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Notification
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths.source }}>
                  <span>Source</span>
                  <ColumnResizer
                    columnId="source"
                    currentWidth={columnWidths.source}
                    minWidth={80}
                    maxWidth={160}
                    onResize={handleColumnResize}
                  />
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wider relative group/header" style={{ width: columnWidths.time }}>
                  <span>Time</span>
                  <ColumnResizer
                    columnId="time"
                    currentWidth={columnWidths.time}
                    minWidth={80}
                    maxWidth={140}
                    onResize={handleColumnResize}
                  />
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase tracking-wider" style={{ width: columnWidths.actions }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {displayedNotifications.map((notification) => (
                  <NotificationTableRow
                    key={notification.id}
                    notification={notification}
                    isSelected={selectedIds.has(notification.id)}
                    onSelect={handleSelectNotification}
                    onMarkRead={handleMarkRead}
                    onDelete={handleDelete}
                    onClick={handleClick}
                    columnWidths={columnWidths}
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
