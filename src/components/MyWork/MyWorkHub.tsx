/**
 * MyWorkHub
 * Unified My Work module with ModuleHub pattern (Golden Standard)
 *
 * Features:
 * - Dynamic tabs for open documents (tasks, decisions, notifications)
 * - Context-sensitive filters and action buttons
 * - Full document view when selected
 *
 * @see docs/wdrozenia/UI_UX_GOLDEN_STANDARD.md
 */

import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FileText,
  Flame,
  Hourglass,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Scale,
  Search,
  Target,
  User,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import { DecisionsPanelContent } from './DecisionsPanelContent';
import { ExecutiveDashboard } from './Executive/ExecutiveDashboard';
import { FocusView, type FocusItem } from './Focus/FocusView';
import { MyTasksListContent } from './MyTasksListContent';
import { NotificationsContent } from './NotificationsContent';
import { TaskDetailView } from './TaskDetailView';
import { DecisionDetailView } from './DecisionDetailView';
import { NotificationDetailView } from './NotificationDetailView';

// Types
type ModuleTab = 'executive' | 'focus' | 'tasks' | 'decisions' | 'notifications';
type TaskFilter = 'all' | 'overdue' | 'today' | 'week' | 'urgent';
type DecisionFilter = 'my' | 'awaiting';
type NotificationFilter = 'all' | 'unread' | 'today' | 'week';
type ItemStatus = 'todo' | 'in_progress' | 'completed' | 'blocked' | 'pending' | 'approved' | 'rejected' | 'read' | 'unread';

interface TabCounts {
  executive: number;
  focus: number;
  tasks: number;
  decisions: number;
  notifications: number;
}

interface TaskFilterCounts {
  overdue: number;
  today: number;
  week: number;
  urgent: number;
}

interface DecisionFilterCounts {
  my: number;
  awaiting: number;
}

interface NotificationFilterCounts {
  unread: number;
  today: number;
  week: number;
}

// Open Document interface for dynamic tabs
interface OpenDocument {
  id: string;
  type: 'task' | 'decision' | 'notification';
  name: string;
  status: ItemStatus;
  data?: any;
}

// Shared button styles (Golden Standard - same as InterviewHub)
const BUTTON_BASE = `
  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
  border transition-all duration-200
`;

const BUTTON_INACTIVE = `
  ${BUTTON_BASE}
  bg-slate-50 dark:bg-navy-800
  border-slate-200 dark:border-navy-600
  text-slate-700 dark:text-slate-300
  hover:bg-slate-100 dark:hover:bg-navy-700
  hover:border-slate-300 dark:hover:border-slate-500
  hover:text-slate-900 dark:hover:text-white
`;

const BUTTON_ACTIVE = `
  ${BUTTON_BASE}
  bg-primary-500/15 border-primary-500 text-primary-400
  shadow-sm shadow-primary-500/10
`;

// Tab styles for dynamic tabs
const TAB_BASE = `
  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
  border border-l-2 transition-all duration-200 cursor-pointer
`;

const TAB_INACTIVE = `
  ${TAB_BASE}
  bg-slate-50 dark:bg-navy-800
  border-slate-200 dark:border-navy-600
  text-slate-600 dark:text-slate-400
  hover:bg-slate-100 dark:hover:bg-navy-700
  hover:border-slate-300 dark:hover:border-slate-500
  hover:text-slate-900 dark:hover:text-white
`;

const TAB_ACTIVE = `
  ${TAB_BASE}
  bg-primary-500/15 border-primary-500 text-primary-400
  shadow-sm shadow-primary-500/10
`;

// Type colors for dynamic tabs
const TYPE_COLORS = {
  task: 'border-l-blue-500',
  decision: 'border-l-purple-500',
  notification: 'border-l-amber-500',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-400',
  completed: 'bg-emerald-400',
  blocked: 'bg-red-400',
  pending: 'bg-amber-400',
  approved: 'bg-emerald-400',
  rejected: 'bg-red-400',
  read: 'bg-slate-500',
  unread: 'bg-amber-400',
};

interface MyWorkHubProps {
  onNavigate?: (view: string) => void;
}

export const MyWorkHub: React.FC<MyWorkHubProps> = ({ onNavigate }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const { currentUser } = useAppStore();

  // Tab state
  const [activeTab, setActiveTab] = useState<ModuleTab>('tasks');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Filter states
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('my');
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all');

  // Counts
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    executive: 0,
    focus: 0,
    tasks: 0,
    decisions: 0,
    notifications: 0,
  });
  const [taskFilterCounts, setTaskFilterCounts] = useState<TaskFilterCounts>({
    overdue: 0,
    today: 0,
    week: 0,
    urgent: 0,
  });
  const [decisionFilterCounts, setDecisionFilterCounts] = useState<DecisionFilterCounts>({
    my: 0,
    awaiting: 0,
  });
  const [notificationFilterCounts, setNotificationFilterCounts] = useState<NotificationFilterCounts>({
    unread: 0,
    today: 0,
    week: 0,
  });

  // Dynamic documents state
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'executive' as ModuleTab,
        label: isPolish ? 'Executive' : 'Executive',
        icon: <FileText size={16} />,
        count: tabCounts.executive,
        color: 'bg-violet-500',
      },
      {
        id: 'focus' as ModuleTab,
        label: isPolish ? 'Focus' : 'Focus',
        icon: <Target size={16} />,
        count: tabCounts.focus,
        color: 'bg-amber-500',
      },
      {
        id: 'tasks' as ModuleTab,
        label: isPolish ? 'Zadania' : 'Tasks',
        icon: <CheckSquare size={16} />,
        count: tabCounts.tasks,
        color: 'bg-blue-500',
      },
      {
        id: 'decisions' as ModuleTab,
        label: isPolish ? 'Decyzje' : 'Decisions',
        icon: <Scale size={16} />,
        count: tabCounts.decisions,
        color: 'bg-purple-500',
      },
      {
        id: 'notifications' as ModuleTab,
        label: isPolish ? 'Powiadomienia' : 'Notifications',
        icon: <Bell size={16} />,
        count: tabCounts.notifications,
        color: 'bg-amber-500',
      },
    ],
    [isPolish, tabCounts]
  );

  // Task filters configuration
  const taskFilters = useMemo(
    () => [
      {
        id: 'all' as TaskFilter,
        label: isPolish ? 'Wszystkie' : 'All',
        icon: <LayoutGrid size={12} />,
        color: 'bg-slate-400',
      },
      {
        id: 'overdue' as TaskFilter,
        label: isPolish ? 'Zaległe' : 'Overdue',
        icon: <AlertCircle size={12} />,
        color: 'bg-red-500',
        count: taskFilterCounts.overdue,
      },
      {
        id: 'today' as TaskFilter,
        label: isPolish ? 'Dzisiaj' : 'Today',
        icon: <Calendar size={12} />,
        color: 'bg-blue-500',
        count: taskFilterCounts.today,
      },
      {
        id: 'week' as TaskFilter,
        label: isPolish ? 'Ten tydzień' : 'This Week',
        icon: <CalendarDays size={12} />,
        color: 'bg-slate-500',
        count: taskFilterCounts.week,
      },
      {
        id: 'urgent' as TaskFilter,
        label: isPolish ? 'Pilne' : 'Urgent',
        icon: <Flame size={12} />,
        color: 'bg-orange-500',
        count: taskFilterCounts.urgent,
      },
    ],
    [isPolish, taskFilterCounts]
  );

  // Decision filters configuration
  const decisionFilters = useMemo(
    () => [
      {
        id: 'my' as DecisionFilter,
        label: isPolish ? 'Moje decyzje' : 'My Decisions',
        icon: <User size={12} />,
        color: 'bg-purple-500',
        count: decisionFilterCounts.my,
      },
      {
        id: 'awaiting' as DecisionFilter,
        label: isPolish ? 'Oczekujące' : 'Awaiting Others',
        icon: <Hourglass size={12} />,
        color: 'bg-amber-500',
        count: decisionFilterCounts.awaiting,
      },
    ],
    [isPolish, decisionFilterCounts]
  );

  // Notification filters configuration
  const notificationFilters = useMemo(
    () => [
      {
        id: 'all' as NotificationFilter,
        label: isPolish ? 'Wszystkie' : 'All',
        icon: <LayoutGrid size={12} />,
        color: 'bg-slate-400',
      },
      {
        id: 'unread' as NotificationFilter,
        label: isPolish ? 'Nieprzeczytane' : 'Unread',
        icon: <Bell size={12} />,
        color: 'bg-blue-500',
        count: notificationFilterCounts.unread,
      },
      {
        id: 'today' as NotificationFilter,
        label: isPolish ? 'Dzisiaj' : 'Today',
        icon: <Calendar size={12} />,
        color: 'bg-emerald-500',
        count: notificationFilterCounts.today,
      },
      {
        id: 'week' as NotificationFilter,
        label: isPolish ? 'Ten tydzień' : 'This Week',
        icon: <CalendarDays size={12} />,
        color: 'bg-slate-500',
        count: notificationFilterCounts.week,
      },
    ],
    [isPolish, notificationFilterCounts]
  );

  // Handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
  };

  // Document handlers (Dynamic Tabs)
  const handleOpenDocument = useCallback((doc: OpenDocument) => {
    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(doc.id);
  }, []);

  const handleCloseDocument = useCallback((id: string) => {
    setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDocumentId === id) {
      setActiveDocumentId(null);
    }
  }, [activeDocumentId]);

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, []);

  // Task handlers
  const handleCreateTask = useCallback(() => {
    // Open new task as a tab
    const newId = `new-task-${Date.now()}`;
    handleOpenDocument({
      id: newId,
      type: 'task',
      name: isPolish ? 'Nowe zadanie' : 'New Task',
      status: 'todo',
      data: { isNew: true },
    });
  }, [handleOpenDocument, isPolish]);

  const handleTaskClick = useCallback((taskId: string, taskData?: any) => {
    handleOpenDocument({
      id: taskId,
      type: 'task',
      name: taskData?.title || 'Task',
      status: (taskData?.status?.toLowerCase() || 'todo') as ItemStatus,
      data: taskData,
    });
  }, [handleOpenDocument]);

  // Decision handlers
  const handleCreateDecision = useCallback(() => {
    const newId = `new-decision-${Date.now()}`;
    handleOpenDocument({
      id: newId,
      type: 'decision',
      name: isPolish ? 'Nowa decyzja' : 'New Decision',
      status: 'pending',
      data: { isNew: true },
    });
  }, [handleOpenDocument, isPolish]);

  const handleDecisionClick = useCallback((decisionId: string, decisionData?: any) => {
    handleOpenDocument({
      id: decisionId,
      type: 'decision',
      name: decisionData?.title || 'Decision',
      status: (decisionData?.status?.toLowerCase() || 'pending') as ItemStatus,
      data: decisionData,
    });
  }, [handleOpenDocument]);

  // Notification handlers
  const handleNotificationClick = useCallback((notificationId: string, notificationData?: any) => {
    handleOpenDocument({
      id: notificationId,
      type: 'notification',
      name: notificationData?.title || 'Notification',
      status: notificationData?.isRead ? 'read' : 'unread',
      data: notificationData,
    });
  }, [handleOpenDocument]);

  // Handle document saved/updated
  const handleDocumentSaved = useCallback((docId: string, updatedData?: any) => {
    if (updatedData) {
      setOpenDocuments((prev) =>
        prev.map((doc) =>
          doc.id === docId
            ? { ...doc, name: updatedData.title || doc.name, data: updatedData }
            : doc
        )
      );
    }
    // Optionally close after save
    // handleCloseDocument(docId);
  }, []);

  // Count update handlers
  const handleTaskCountsChange = useCallback(
    (counts: { total: number; overdue: number; today: number; week: number; urgent: number }) => {
      setTabCounts((prev) => ({ ...prev, tasks: counts.total }));
      setTaskFilterCounts({
        overdue: counts.overdue,
        today: counts.today,
        week: counts.week,
        urgent: counts.urgent,
      });
    },
    []
  );

  const handleDecisionCountsChange = useCallback(
    (counts: { total: number; my: number; awaiting: number }) => {
      setTabCounts((prev) => ({ ...prev, decisions: counts.total }));
      setDecisionFilterCounts({
        my: counts.my,
        awaiting: counts.awaiting,
      });
    },
    []
  );

  const handleNotificationCountsChange = useCallback(
    (counts: { total: number; unread: number; today: number; week: number }) => {
      setTabCounts((prev) => ({ ...prev, notifications: counts.total }));
      setNotificationFilterCounts({
        unread: counts.unread,
        today: counts.today,
        week: counts.week,
      });
    },
    []
  );

  // Get action button config based on active tab
  const actionButton = useMemo(() => {
    // Don't show action button when viewing a document
    if (activeDocumentId) return null;

    switch (activeTab) {
      case 'executive':
      case 'focus':
        return null;
      case 'tasks':
        return {
          label: isPolish ? 'Nowe zadanie' : 'New Task',
          icon: <Plus size={16} />,
          onClick: handleCreateTask,
          color: 'from-blue-500 to-blue-600',
          variant: 'primary' as const,
        };
      case 'decisions':
        return {
          label: isPolish ? 'Nowa decyzja' : 'New Decision',
          icon: <Plus size={16} />,
          onClick: handleCreateDecision,
          color: 'from-purple-500 to-purple-600',
          variant: 'primary' as const,
        };
      case 'notifications':
        return {
          label: isPolish ? 'Nowe powiadomienie' : 'New Notification',
          icon: <Plus size={16} />,
          onClick: () => {
            toast.success(isPolish ? 'Funkcja w przygotowaniu' : 'Feature coming soon');
          },
          color: 'from-amber-500 to-amber-600',
          variant: 'primary' as const,
        };
      default:
        return null;
    }
  }, [activeTab, isPolish, handleCreateTask, handleCreateDecision, activeDocumentId]);


  // Get current filters based on active tab
  const currentFilters = useMemo(() => {
    if (activeDocumentId) return []; // Hide filters when viewing document
    switch (activeTab) {
      case 'tasks':
        return taskFilters;
      case 'decisions':
        return decisionFilters;
      case 'notifications':
        return notificationFilters;
      case 'executive':
      case 'focus':
      default:
        return [];
    }
  }, [activeTab, taskFilters, decisionFilters, notificationFilters, activeDocumentId]);

  // Get current filter value
  const currentFilterValue = useMemo(() => {
    switch (activeTab) {
      case 'tasks':
        return taskFilter;
      case 'decisions':
        return decisionFilter;
      case 'notifications':
        return notificationFilter;
      default:
        return 'all';
    }
  }, [activeTab, taskFilter, decisionFilter, notificationFilter]);

  // Handle filter change
  const handleFilterChange = useCallback(
    (filterId: string) => {
      switch (activeTab) {
        case 'tasks':
          setTaskFilter(filterId as TaskFilter);
          break;
        case 'decisions':
          setDecisionFilter(filterId as DecisionFilter);
          break;
        case 'notifications':
          setNotificationFilter(filterId as NotificationFilter);
          break;
      }
    },
    [activeTab]
  );

  // Render Dynamic Tabs
  const renderDynamicTabs = () => {
    if (openDocuments.length === 0) return null;

    const isListActive = activeDocumentId === null;

    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
        {/* List button */}
        <button
          onClick={handleShowList}
          className={isListActive ? TAB_ACTIVE.replace('border-l-2', '') : TAB_INACTIVE.replace('border-l-2', '')}
        >
          <List size={14} />
          <span>{isPolish ? 'Lista' : 'List'}</span>
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-200 dark:bg-navy-600" />

        {/* Document Tabs */}
        {openDocuments.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          const leftBorderColor = TYPE_COLORS[doc.type];
          const statusColor = STATUS_COLORS[doc.status] || 'bg-slate-400';

          return (
            <div
              key={doc.id}
              className={`group ${isActive ? TAB_ACTIVE : TAB_INACTIVE} ${leftBorderColor}`}
              onClick={() => setActiveDocumentId(doc.id)}
            >
              {/* Type Icon */}
              {doc.type === 'task' && <CheckSquare size={14} />}
              {doc.type === 'decision' && <Scale size={14} />}
              {doc.type === 'notification' && <Bell size={14} />}

              {/* Name (truncated) */}
              <span className="max-w-[150px] truncate">{doc.name}</span>

              {/* Status Dot */}
              <span className={`w-2 h-2 rounded-full ${statusColor}`} title={doc.status} />

              {/* Close Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseDocument(doc.id);
                }}
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-600 transition-all"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  // Render document content (full view)
  const renderDocumentContent = () => {
    const activeDoc = openDocuments.find((d) => d.id === activeDocumentId);
    if (!activeDoc) return null;

    switch (activeDoc.type) {
      case 'task':
        return (
          <TaskDetailView
            taskId={activeDoc.data?.isNew ? null : activeDoc.id}
            onClose={() => handleCloseDocument(activeDoc.id)}
            onSaved={(data) => handleDocumentSaved(activeDoc.id, data)}
            onOpenDecision={(decisionId) => handleDecisionClick(decisionId)}
          />
        );
      case 'decision':
        return (
          <DecisionDetailView
            decisionId={activeDoc.data?.isNew ? null : activeDoc.id}
            onClose={() => handleCloseDocument(activeDoc.id)}
            onSaved={(data) => handleDocumentSaved(activeDoc.id, data)}
          />
        );
      case 'notification':
        return (
          <NotificationDetailView
            notificationId={activeDoc.id}
            onClose={() => handleCloseDocument(activeDoc.id)}
            onNavigateToSource={(type, id) => {
              if (type === 'task') {
                handleTaskClick(id);
              } else if (type === 'decision') {
                handleDecisionClick(id);
              }
            }}
          />
        );
      default:
        return null;
    }
  };

  // Render list content based on active tab
  const renderListContent = () => {
    switch (activeTab) {
      case 'executive':
        return (
          <ExecutiveDashboard
            onNavigate={(section) => {
              if (section === 'tasks') setActiveTab('tasks');
              if (section === 'decisions') setActiveTab('decisions');
              if (section === 'focus') setActiveTab('focus');
            }}
          />
        );
      case 'focus':
        return (
          <FocusView
            onItemClick={(item: FocusItem) => {
              // FocusView uses ids like task-<id> / decision-<id>
              if (item.type === 'task') {
                const id = String(item.id).replace(/^task-/, '');
                handleTaskClick(id);
              } else if (item.type === 'decision') {
                const id = String(item.id).replace(/^decision-/, '');
                handleDecisionClick(id);
              }
            }}
          />
        );
      case 'tasks':
        return (
          <MyTasksListContent
            activeFilter={taskFilter}
            searchQuery={searchQuery}
            onTaskClick={handleTaskClick}
            onCreateTask={handleCreateTask}
            onCountsChange={handleTaskCountsChange}
          />
        );
      case 'decisions':
        return (
          <DecisionsPanelContent
            viewMode={decisionFilter}
            searchQuery={searchQuery}
            onDecisionClick={handleDecisionClick}
            onCountsChange={handleDecisionCountsChange}
          />
        );
      case 'notifications':
        return (
          <NotificationsContent
            filter={notificationFilter}
            searchQuery={searchQuery}
            onOpenTask={handleTaskClick}
            onOpenDecision={handleDecisionClick}
            onNotificationClick={handleNotificationClick}
            onCountsChange={handleNotificationCountsChange}
          />
        );
      default:
        return null;
    }
  };

  // Main render content
  const renderContent = () => {
    if (activeDocumentId) {
      return renderDocumentContent();
    }
    return renderListContent();
  };

  return (
    <div className="flex flex-col min-h-full bg-white dark:bg-navy-950">
      {/* Navigation Bar (Golden Standard - same as InterviewHub) */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        {/* Main Navigation Row */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Search + Main Tabs */}
          <div className="flex items-center gap-3">
            {/* Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg border transition-all duration-200 ${
                showSearch
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-slate-50 dark:bg-navy-800 border-slate-200 dark:border-navy-600 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-slate-500'
              }`}
              title={isPolish ? 'Szukaj' : 'Search'}
            >
              <Search size={18} />
            </button>

            {/* Main Tabs */}
            <div className="flex items-center gap-2">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      // Don't close document when switching tabs
                    }}
                    className={isActive ? BUTTON_ACTIVE : BUTTON_INACTIVE}
                    data-testid={`mywork-tab-${tab.id}`}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span
                        className={`px-1.5 py-0.5 text-xs rounded-full ${
                          isActive
                            ? 'bg-primary-500/30 text-primary-300'
                            : 'bg-slate-200 dark:bg-navy-700 text-slate-600 dark:text-slate-400'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Context Filters + Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Context-sensitive Filter Dropdown (only show when viewing list) */}
            {currentFilters.length > 0 && (
              <div className="relative">
                <select
                  value={currentFilterValue}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="appearance-none pl-4 pr-10 py-2.5 rounded-xl text-sm font-medium bg-white dark:bg-navy-700 border border-slate-200 dark:border-navy-500 text-slate-700 dark:text-slate-200 hover:border-primary-300 dark:hover:border-primary-500 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer min-w-[140px]"
                >
                  {currentFilters.map((filter) => (
                    <option key={filter.id} value={filter.id}>
                      {filter.label}
                      {filter.count !== undefined && filter.count > 0 ? ` (${filter.count})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none" />
              </div>
            )}

            {/* Separator */}
            {(currentFilters.length > 0 || actionButton) && (
              <div className="w-px h-6 bg-slate-200 dark:bg-navy-600" />
            )}

            {/* Primary Action Button (New Task/Decision/Notification) */}
            {actionButton && (
              <button
                onClick={actionButton.onClick}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r ${actionButton.color} text-white border border-white/20 hover:brightness-110 shadow-lg shadow-primary-500/25 transition-all duration-200`}
                data-testid="mywork-action-button"
              >
                {actionButton.icon}
                <span>{actionButton.label}</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar (expandable) */}
        {showSearch && !activeDocumentId && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={
                  activeTab === 'tasks'
                    ? isPolish
                      ? 'Szukaj zadań...'
                      : 'Search tasks...'
                    : activeTab === 'decisions'
                      ? isPolish
                        ? 'Szukaj decyzji...'
                        : 'Search decisions...'
                      : isPolish
                        ? 'Szukaj powiadomień...'
                        : 'Search notifications...'
                }
                autoFocus
                className="w-full pl-10 pr-10 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={handleCloseSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Dynamic Tabs Row */}
      {renderDynamicTabs()}

      {/* Main Content Area */}
      <div className="flex-1">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeDocumentId || activeTab}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
};

export default MyWorkHub;
