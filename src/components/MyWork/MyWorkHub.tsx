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

import {
  AlertCircle,
  Bell,
  Calendar,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FileText,
  Flame,
  GitBranch,
  HeartPulse,
  Hourglass,
  Inbox,
  Kanban,
  LayoutGrid,
  LayoutList,
  Lightbulb,
  Flower2,
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
import { useSearchParams } from 'react-router-dom';

import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { useUserCan } from '@/hooks/useUserCan';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import { DecisionsPanelContent } from './DecisionsPanelContent';
import { InboxContent } from './InboxContent';
import type { FocusItem } from './Focus/FocusView';
import type { MyIdea } from './MyIdeasListContent';
import { MyIdeasListContent } from './MyIdeasListContent';
import { MyTasksListContent } from './MyTasksListContent';
import { NotificationsContent } from './NotificationsContent';

// Heavy sub-views (TipTap, DnD, calendars, detailed editors) are lazy-loaded.
// This keeps initial My Work navigation snappy and avoids loading unused tabs upfront.
const TaskDetailView = React.lazy(() =>
  import('./TaskDetailView').then((m) => ({ default: m.TaskDetailView }))
);
const IdeaDetailView = React.lazy(() =>
  import('./IdeaDetailView').then((m) => ({ default: m.IdeaDetailView }))
);
const DecisionDetailView = React.lazy(() =>
  import('./DecisionDetailView').then((m) => ({ default: m.DecisionDetailView }))
);
const NotificationDetailView = React.lazy(() =>
  import('./NotificationDetailView').then((m) => ({ default: m.NotificationDetailView }))
);
const ExecutiveDashboard = React.lazy(() =>
  import('./Executive/ExecutiveDashboard').then((m) => ({ default: m.ExecutiveDashboard }))
);
const FocusView = React.lazy(() => import('./Focus/FocusView').then((m) => ({ default: m.FocusView })));
const NotebookContent = React.lazy(() =>
  import('./NotebookContent').then((m) => ({ default: m.NotebookContent }))
);
const TasksKanbanBoard = React.lazy(() =>
  import('./TasksKanbanBoard').then((m) => ({ default: m.TasksKanbanBoard }))
);
const TasksCalendarView = React.lazy(() =>
  import('./TasksCalendarView').then((m) => ({ default: m.TasksCalendarView }))
);
const DecisionsKanbanBoard = React.lazy(() =>
  import('./DecisionsKanbanBoard').then((m) => ({ default: m.DecisionsKanbanBoard }))
);
const NotificationsKanbanBoard = React.lazy(() =>
  import('./NotificationsKanbanBoard').then((m) => ({ default: m.NotificationsKanbanBoard }))
);

// Types
type ModuleTab =
  | 'executive'
  | 'inbox'
  | 'focus'
  | 'tasks'
  | 'notebook'
  | 'ideas'
  | 'decisions'
  | 'notifications';
type TaskFilter = 'all' | 'overdue' | 'today' | 'week' | 'urgent';
type TasksViewMode = 'table' | 'kanban' | 'calendar';
type IdeasViewMode = 'list' | 'cards' | 'garden' | 'mindmap';
type DecisionsViewMode = 'list' | 'kanban';
type NotificationsViewMode = 'list' | 'kanban';
type DecisionFilter = 'all' | 'my' | 'awaiting';
type DecisionPriorityFilter = 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type NotificationFilter = 'all' | 'unread' | 'today' | 'week';
type ItemStatus =
  | 'todo'
  | 'in_progress'
  | 'completed'
  | 'blocked'
  | 'idea'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'read'
  | 'unread';

interface TabCounts {
  executive: number;
  inbox: number;
  focus: number;
  tasks: number;
  notebook: number;
  ideas: number;
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
  type: 'task' | 'idea' | 'decision' | 'notification';
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
  idea: 'border-l-amber-500',
  decision: 'border-l-purple-500',
  notification: 'border-l-amber-500',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-400',
  completed: 'bg-emerald-400',
  blocked: 'bg-red-400',
  idea: 'bg-amber-400',
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentUser, myWorkIntent, clearMyWorkIntent } = useAppStore();
  const { isEnabled } = useFeatureFlagsContext();
  const notebookEnabled = isEnabled('myWorkNotebookV2');

  const lazyFallback = (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{isPolish ? 'Ładowanie…' : 'Loading…'}</span>
      </div>
    </div>
  );

  // A1.2: Role-based access – Executive tab restricted to admin/manager/superadmin
  const { isAdmin, isManager, isSuperAdmin } = useUserCan();
  const canViewExecutive = isAdmin || isManager || isSuperAdmin;

  // Tab state — managers land on Executive, regular users on Focus
  const [activeTab, setActiveTab] = useState<ModuleTab>(
    canViewExecutive ? 'executive' : 'focus'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Filter states
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [tasksViewMode, setTasksViewMode] = useState<TasksViewMode>('table');
  const [ideasViewMode, setIdeasViewMode] = useState<IdeasViewMode>('garden');
  const [decisionsViewMode, setDecisionsViewMode] = useState<DecisionsViewMode>('list');
  const [notificationsViewMode, setNotificationsViewMode] = useState<NotificationsViewMode>('list');
  const [notebookLinkedIdeasOpen, setNotebookLinkedIdeasOpen] = useState(false);
  const [notebookPulseOpen, setNotebookPulseOpen] = useState(false);
  const [notebookCreateReqId, setNotebookCreateReqId] = useState(0);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('my');
  const [decisionPriorityFilter, setDecisionPriorityFilter] =
    useState<DecisionPriorityFilter>('all');
  const [notificationFilter, setNotificationFilter] = useState<NotificationFilter>('all');

  // Counts
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    executive: 0,
    inbox: 0,
    focus: 0,
    tasks: 0,
    notebook: 0,
    ideas: 0,
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
  const [notificationFilterCounts, setNotificationFilterCounts] =
    useState<NotificationFilterCounts>({
      unread: 0,
      today: 0,
      week: 0,
    });

  // Dynamic documents state
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // Document handlers (Dynamic Tabs) - defined early to avoid hoisting issues
  const handleOpenDocument = useCallback((doc: OpenDocument) => {
    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(doc.id);
  }, []);

  // Robust: whenever user switches main tab, always show list view (close any open document)
  useEffect(() => {
    setActiveDocumentId(null);
  }, [activeTab]);

  // Deep link support: header dropdown → open inside My Work
  useEffect(() => {
    if (!myWorkIntent) return;
    if (myWorkIntent.tab) {
      // A1.2: Block navigation to executive tab for unauthorized users
      const targetTab = myWorkIntent.tab as ModuleTab;
      if (targetTab === 'executive' && !canViewExecutive) {
        clearMyWorkIntent();
        return;
      }
      if (targetTab === 'notebook' && !notebookEnabled) {
        clearMyWorkIntent();
        return;
      }
      setActiveTab(targetTab);
    }
    setActiveDocumentId(null);
    if (myWorkIntent.open) {
      const o = myWorkIntent.open;
      handleOpenDocument({
        id: o.id,
        type: o.type,
        name:
          o.name ||
          (o.type === 'notification'
            ? 'Notification'
            : o.type === 'decision'
              ? 'Decision'
              : o.type === 'idea'
                ? 'Idea'
                : 'Task'),
        status:
          o.type === 'notification'
            ? ('unread' as const)
            : o.type === 'decision'
              ? ('pending' as const)
              : o.type === 'idea'
                ? ('idea' as const)
                : ('todo' as const),
        data: o.data,
      });
    }
    clearMyWorkIntent();
  }, [myWorkIntent, clearMyWorkIntent, handleOpenDocument]);

  // URL deep link support:
  // - /my-work?taskId=...
  // - /my-work?decisionId=...
  // Back-compat:
  // - /my-work?decision=...  (used by backend notification actionUrl)
  // - /my-work?task=...      (legacy/manual links)
  useEffect(() => {
    const taskId = searchParams.get('taskId') || searchParams.get('task');
    const decisionId = searchParams.get('decisionId') || searchParams.get('decision');
    if (!taskId && !decisionId) return;

    if (taskId) {
      setActiveTab('tasks');
      handleOpenDocument({
        id: taskId,
        type: 'task',
        name: isPolish ? 'Zadanie' : 'Task',
        status: 'todo',
      });
    }

    if (decisionId) {
      setActiveTab('decisions');
      handleOpenDocument({
        id: decisionId,
        type: 'decision',
        name: isPolish ? 'Decyzja' : 'Decision',
        status: 'pending',
      });
    }

    const next = new URLSearchParams(searchParams);
    next.delete('taskId');
    next.delete('task');
    next.delete('decisionId');
    next.delete('decision');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, handleOpenDocument, isPolish]);

  // Tab configuration
  // A1.2: Executive tab only visible to admin/manager/superadmin roles
  const tabs = useMemo(() => {
    const allTabs = [
      {
        id: 'executive' as ModuleTab,
        label: isPolish ? 'Executive' : 'Executive',
        icon: <FileText size={16} />,
        count: tabCounts.executive,
        color: 'bg-violet-500',
        requiresExecutiveAccess: true,
      },
      {
        id: 'inbox' as ModuleTab,
        label: isPolish ? 'Inbox' : 'Inbox',
        icon: <Inbox size={16} />,
        count: tabCounts.inbox,
        color: 'bg-red-500',
        requiresExecutiveAccess: false,
      },
      {
        id: 'focus' as ModuleTab,
        label: isPolish ? 'Focus' : 'Focus',
        icon: <Target size={16} />,
        count: tabCounts.focus,
        color: 'bg-amber-500',
        requiresExecutiveAccess: false,
      },
      {
        id: 'tasks' as ModuleTab,
        label: isPolish ? 'Zadania' : 'Tasks',
        icon: <CheckSquare size={16} />,
        count: tabCounts.tasks,
        color: 'bg-blue-500',
        requiresExecutiveAccess: false,
      },
      {
        id: 'decisions' as ModuleTab,
        label: isPolish ? 'Decyzje' : 'Decisions',
        icon: <Scale size={16} />,
        count: tabCounts.decisions,
        color: 'bg-purple-500',
        requiresExecutiveAccess: false,
      },
      {
        id: 'notifications' as ModuleTab,
        label: isPolish ? 'Powiadomienia' : 'Notifications',
        icon: <Bell size={16} />,
        count: tabCounts.notifications,
        color: 'bg-amber-500',
        requiresExecutiveAccess: false,
      },
      ...(notebookEnabled
        ? [
            {
              id: 'notebook' as ModuleTab,
              label: isPolish ? 'Notatnik' : 'Notebook',
              icon: <FileText size={16} />,
              count: tabCounts.notebook,
              color: 'bg-slate-500',
              requiresExecutiveAccess: false,
            },
          ]
        : []),
      {
        id: 'ideas' as ModuleTab,
        label: isPolish ? 'Pomysły' : 'Ideas',
        icon: <Lightbulb size={16} />,
        count: tabCounts.ideas,
        color: 'bg-amber-500',
        requiresExecutiveAccess: false,
      },
    ];

    // A1.2: Filter out Executive tab for users without admin/manager role
    return allTabs.filter((tab) => !tab.requiresExecutiveAccess || canViewExecutive);
  }, [isPolish, tabCounts, canViewExecutive, notebookEnabled]);

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
        id: 'all' as DecisionFilter,
        label: isPolish ? 'Wszystkie' : 'All',
        icon: <LayoutGrid size={12} />,
        color: 'bg-slate-400',
        count: tabCounts.decisions,
      },
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
    [isPolish, decisionFilterCounts, tabCounts.decisions]
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

  const handleTaskClick = useCallback(
    (taskId: string, taskData?: any) => {
      handleOpenDocument({
        id: taskId,
        type: 'task',
        name: taskData?.title || 'Task',
        status: (taskData?.status?.toLowerCase() || 'todo') as ItemStatus,
        data: taskData,
      });
    },
    [handleOpenDocument]
  );

  // Idea handlers
  const handleCreateIdea = useCallback(() => {
    const newId = `new-idea-${Date.now()}`;
    handleOpenDocument({
      id: newId,
      type: 'idea',
      name: isPolish ? 'Nowy pomysł' : 'New Idea',
      status: 'idea',
      data: { isNew: true },
    });
  }, [handleOpenDocument, isPolish]);

  const handleIdeaClick = useCallback(
    (ideaId: string, ideaData?: MyIdea) => {
      handleOpenDocument({
        id: ideaId,
        type: 'idea',
        name: ideaData?.title || (isPolish ? 'Pomysł' : 'Idea'),
        status: 'idea',
        data: ideaData,
      });
    },
    [handleOpenDocument, isPolish]
  );

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

  const handleDecisionClick = useCallback(
    (decisionId: string, decisionData?: any) => {
      handleOpenDocument({
        id: decisionId,
        type: 'decision',
        name: decisionData?.title || 'Decision',
        status: (decisionData?.status?.toLowerCase() || 'pending') as ItemStatus,
        data: decisionData,
      });
    },
    [handleOpenDocument]
  );

  // Notification handlers
  const handleNotificationClick = useCallback(
    (notificationId: string, notificationData?: any) => {
      handleOpenDocument({
        id: notificationId,
        type: 'notification',
        name: notificationData?.title || 'Notification',
        status: notificationData?.isRead ? 'read' : 'unread',
        data: notificationData,
      });
    },
    [handleOpenDocument]
  );

  // Handle document saved/updated
  const handleDocumentSaved = useCallback((docId: string, updatedData?: any) => {
    if (updatedData) {
      const nextId =
        typeof updatedData?.id === 'string' && updatedData.id && docId.startsWith('new-')
          ? updatedData.id
          : null;

      if (nextId && nextId !== docId) {
        setOpenDocuments((prev) => {
          const existing = prev.find((d) => d.id === docId);
          if (!existing) return prev;
          const without = prev.filter((d) => d.id !== docId);
          if (without.some((d) => d.id === nextId)) return without;
          return [
            ...without,
            {
              ...existing,
              id: nextId,
              name: updatedData.title || existing.name,
              data: updatedData,
            },
          ];
        });
        setActiveDocumentId((cur) => (cur === docId ? nextId : cur));
      } else {
        setOpenDocuments((prev) =>
          prev.map((doc) =>
            doc.id === docId
              ? { ...doc, name: updatedData.title || doc.name, data: updatedData }
              : doc
          )
        );
      }
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

  const handleIdeaCountsChange = useCallback(
    (counts: { total: number }) => {
      setTabCounts((prev) => ({ ...prev, ideas: counts.total }));
    },
    []
  );

  const handleNotebookCountsChange = useCallback(
    (counts: { total: number }) => {
      setTabCounts((prev) => ({ ...prev, notebook: counts.total }));
    },
    []
  );

  const handleInboxCountsChange = useCallback((counts: { total: number; critical: number }) => {
    setTabCounts((prev) => ({ ...prev, inbox: counts.total }));
  }, []);

  // Get action button config based on active tab
  const actionButton = useMemo(() => {
    // Don't show action button when viewing a document
    if (activeDocumentId) return null;

    switch (activeTab) {
      case 'executive':
      case 'focus':
      case 'inbox':
        return null;
      case 'tasks':
        return {
          label: isPolish ? 'Nowe zadanie' : 'New Task',
          icon: <Plus size={16} />,
          onClick: handleCreateTask,
          color: 'from-blue-500 to-blue-600',
          variant: 'primary' as const,
        };
      case 'ideas':
        return {
          label: isPolish ? 'Nowy pomysł' : 'New Idea',
          icon: <Plus size={16} />,
          onClick: handleCreateIdea,
          color: 'from-amber-500 to-amber-600',
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
            const newId = `new-notification-${Date.now()}`;
            handleOpenDocument({
              id: newId,
              type: 'notification',
              name: isPolish ? 'Nowe powiadomienie' : 'New Notification',
              status: 'unread',
              data: { isNew: true },
            });
          },
          color: 'from-amber-500 to-amber-600',
          variant: 'primary' as const,
        };
      case 'notebook':
        return {
          label: isPolish ? 'Nowa notatka' : 'New note',
          icon: <Plus size={16} />,
          onClick: () => setNotebookCreateReqId((v) => v + 1),
          color: 'from-slate-600 to-slate-700',
          variant: 'primary' as const,
        };
      default:
        return null;
    }
  }, [
    activeTab,
    isPolish,
    handleCreateTask,
    handleCreateIdea,
    handleCreateDecision,
    setNotebookCreateReqId,
    activeDocumentId,
  ]);

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
      case 'inbox':
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
          className={
            isListActive
              ? TAB_ACTIVE.replace('border-l-2', '')
              : TAB_INACTIVE.replace('border-l-2', '')
          }
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
              {doc.type === 'idea' && <Lightbulb size={14} />}
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
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-navy-600 transition-all"
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
          <React.Suspense fallback={lazyFallback}>
            <TaskDetailView
              taskId={activeDoc.data?.isNew ? null : activeDoc.id}
              onClose={() => handleCloseDocument(activeDoc.id)}
              onSaved={(data) => handleDocumentSaved(activeDoc.id, data)}
              onOpenDecision={(decisionId) => handleDecisionClick(decisionId)}
            />
          </React.Suspense>
        );
      case 'idea':
        return (
          <React.Suspense fallback={lazyFallback}>
            <IdeaDetailView
              ideaId={activeDoc.id}
              onClose={() => handleCloseDocument(activeDoc.id)}
              onSaved={(data) => handleDocumentSaved(activeDoc.id, data)}
            />
          </React.Suspense>
        );
      case 'decision':
        return (
          <React.Suspense fallback={lazyFallback}>
            <DecisionDetailView
              decisionId={activeDoc.data?.isNew ? null : activeDoc.id}
              onClose={() => handleCloseDocument(activeDoc.id)}
              onSaved={(data) => handleDocumentSaved(activeDoc.id, data)}
            />
          </React.Suspense>
        );
      case 'notification':
        return (
          <React.Suspense fallback={lazyFallback}>
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
          </React.Suspense>
        );
      default:
        return null;
    }
  };

  // Render list content based on active tab
  const renderListContent = () => {
    switch (activeTab) {
      case 'executive':
        // A1.2: Double-check role access – if user somehow navigated here without permission
        if (!canViewExecutive) {
          return (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {isPolish
                    ? 'Brak dostępu. Wymagana rola Admin lub Manager.'
                    : 'Access restricted. Admin or Manager role required.'}
                </p>
              </div>
            </div>
          );
        }
        return (
          <React.Suspense fallback={lazyFallback}>
            <ExecutiveDashboard
              onNavigate={(section) => {
                if (section === 'tasks') setActiveTab('tasks');
                if (section === 'decisions') setActiveTab('decisions');
                if (section === 'focus') setActiveTab('focus');
                if (section === 'inbox') setActiveTab('inbox');
              }}
            />
          </React.Suspense>
        );
      case 'inbox':
        return (
          <InboxContent
            searchQuery={searchQuery}
            onOpenTask={(id) => handleTaskClick(id)}
            onOpenDecision={(id) => handleDecisionClick(id)}
            onOpenNotification={(id) => handleNotificationClick(id)}
            onCountsChange={handleInboxCountsChange}
          />
        );
      case 'focus':
        return (
          <React.Suspense fallback={lazyFallback}>
            <FocusView
              onItemClick={(item: FocusItem) => {
                // FocusView uses ids like task:<id> / decision:<id>
                if (item.type === 'task') {
                  const id = String(item.id).replace(/^task[:_-]/, '');
                  handleTaskClick(id);
                } else if (item.type === 'decision') {
                  const id = String(item.id).replace(/^decision[:_-]/, '');
                  handleDecisionClick(id);
                }
              }}
              onNavigateToInbox={() => setActiveTab('inbox')}
            />
          </React.Suspense>
        );
      case 'tasks':
        return tasksViewMode === 'kanban' ? (
          <React.Suspense fallback={lazyFallback}>
            <TasksKanbanBoard
              activeFilter={taskFilter}
              searchQuery={searchQuery}
              onTaskClick={handleTaskClick}
              onCreateTask={handleCreateTask}
              onCountsChange={handleTaskCountsChange}
            />
          </React.Suspense>
        ) : tasksViewMode === 'calendar' ? (
          <React.Suspense fallback={lazyFallback}>
            <TasksCalendarView
              activeFilter={taskFilter}
              searchQuery={searchQuery}
              onTaskClick={handleTaskClick}
              onCreateTask={handleCreateTask}
              onCountsChange={handleTaskCountsChange}
            />
          </React.Suspense>
        ) : (
          <MyTasksListContent
            activeFilter={taskFilter}
            searchQuery={searchQuery}
            onTaskClick={handleTaskClick}
            onCreateTask={handleCreateTask}
            onCountsChange={handleTaskCountsChange}
          />
        );
      case 'ideas':
        return (
          <MyIdeasListContent
            viewMode={ideasViewMode}
            searchQuery={searchQuery}
            onIdeaClick={handleIdeaClick}
            onCreateIdea={handleCreateIdea}
            onCountsChange={handleIdeaCountsChange}
          />
        );
      case 'notebook':
        return (
          <React.Suspense fallback={lazyFallback}>
            <NotebookContent
              projectId={null}
              searchQuery={searchQuery}
              linkedIdeasOpen={notebookLinkedIdeasOpen}
              onLinkedIdeasOpenChange={setNotebookLinkedIdeasOpen}
              pulseOpen={notebookPulseOpen}
              onPulseOpenChange={setNotebookPulseOpen}
              createPageRequestId={notebookCreateReqId}
              onCountsChange={handleNotebookCountsChange}
            />
          </React.Suspense>
        );
      case 'decisions':
        return decisionsViewMode === 'kanban' ? (
          <React.Suspense fallback={lazyFallback}>
            <DecisionsKanbanBoard
              viewMode={decisionFilter}
              priorityFilter={decisionPriorityFilter}
              searchQuery={searchQuery}
              onDecisionClick={handleDecisionClick}
              onCreateDecision={handleCreateDecision}
              onCountsChange={handleDecisionCountsChange}
            />
          </React.Suspense>
        ) : (
          <DecisionsPanelContent
            viewMode={decisionFilter}
            priorityFilter={decisionPriorityFilter}
            searchQuery={searchQuery}
            onDecisionClick={handleDecisionClick}
            onCountsChange={handleDecisionCountsChange}
          />
        );
      case 'notifications':
        return notificationsViewMode === 'kanban' ? (
          <React.Suspense fallback={lazyFallback}>
            <NotificationsKanbanBoard
              filter={notificationFilter}
              searchQuery={searchQuery}
              onNotificationClick={handleNotificationClick}
              onCountsChange={handleNotificationCountsChange}
            />
          </React.Suspense>
        ) : (
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

  // Reset stale activeDocumentId if its document was removed
  useEffect(() => {
    if (activeDocumentId && !openDocuments.find((d) => d.id === activeDocumentId)) {
      setActiveDocumentId(null);
    }
  }, [activeDocumentId, openDocuments]);

  // Main render content
  const renderContent = () => {
    if (activeDocumentId) {
      if (!openDocuments.find((d) => d.id === activeDocumentId)) {
        return renderListContent();
      }
      return renderDocumentContent();
    }
    return renderListContent();
  };

  // Notebook tools should not leak across tabs
  useEffect(() => {
    if (activeTab !== 'notebook') {
      setNotebookLinkedIdeasOpen(false);
      setNotebookPulseOpen(false);
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-navy-950">
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
                      // Close document when switching tabs to show list view
                      setActiveDocumentId(null);
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

          {/* Right: View Toggle + Context Filters + Action Buttons */}
          <div className="flex items-center gap-3">
            {/* Tasks View Mode Toggle (table / kanban) — only on Tasks tab */}
            {activeTab === 'tasks' && !activeDocumentId && (
              <div
                className="inline-flex items-center rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-0.5"
                role="radiogroup"
                aria-label={isPolish ? 'Tryb widoku' : 'View mode'}
              >
                <button
                  onClick={() => setTasksViewMode('table')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    tasksViewMode === 'table'
                      ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Widok tabeli' : 'Table view'}
                  role="radio"
                  aria-checked={tasksViewMode === 'table'}
                >
                  <LayoutList size={16} />
                </button>
                <button
                  onClick={() => setTasksViewMode('kanban')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    tasksViewMode === 'kanban'
                      ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Widok kanban' : 'Kanban view'}
                  role="radio"
                  aria-checked={tasksViewMode === 'kanban'}
                >
                  <Kanban size={16} />
                </button>
                <button
                  onClick={() => setTasksViewMode('calendar')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    tasksViewMode === 'calendar'
                      ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Widok kalendarza' : 'Calendar view'}
                  role="radio"
                  aria-checked={tasksViewMode === 'calendar'}
                >
                  <CalendarDays size={16} />
                </button>
              </div>
            )}

            {/* Decisions View Mode Toggle (list / kanban) — only on Decisions tab */}
            {activeTab === 'decisions' && !activeDocumentId && (
              <div
                className="inline-flex items-center rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-0.5"
                role="radiogroup"
                aria-label={isPolish ? 'Tryb widoku' : 'View mode'}
              >
                <button
                  onClick={() => setDecisionsViewMode('list')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    decisionsViewMode === 'list'
                      ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Widok listy' : 'List view'}
                  role="radio"
                  aria-checked={decisionsViewMode === 'list'}
                >
                  <LayoutList size={16} />
                </button>
                <button
                  onClick={() => setDecisionsViewMode('kanban')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    decisionsViewMode === 'kanban'
                      ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Widok kanban' : 'Kanban view'}
                  role="radio"
                  aria-checked={decisionsViewMode === 'kanban'}
                >
                  <Kanban size={16} />
                </button>
              </div>
            )}

            {/* Ideas View Mode Toggle (list / cards / garden) — only on Ideas tab */}
            {activeTab === 'ideas' && !activeDocumentId && (
              <div
                className="inline-flex items-center rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-0.5"
                role="radiogroup"
                aria-label={isPolish ? 'Tryb widoku' : 'View mode'}
              >
                <button
                  onClick={() => setIdeasViewMode('list')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    ideasViewMode === 'list'
                      ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Widok listy' : 'List view'}
                  role="radio"
                  aria-checked={ideasViewMode === 'list'}
                >
                  <LayoutList size={16} />
                </button>
                <button
                  onClick={() => setIdeasViewMode('cards')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    ideasViewMode === 'cards'
                      ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Widok kart' : 'Card view'}
                  role="radio"
                  aria-checked={ideasViewMode === 'cards'}
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setIdeasViewMode('garden')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    ideasViewMode === 'garden'
                      ? 'bg-white dark:bg-navy-800 text-amber-600 dark:text-amber-400 shadow-sm border border-amber-300 dark:border-amber-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400'
                  }`}
                  title={isPolish ? 'Ogród pomysłów' : 'Idea Garden'}
                  role="radio"
                  aria-checked={ideasViewMode === 'garden'}
                >
                  <Flower2 size={16} />
                </button>
                <button
                  onClick={() => setIdeasViewMode('mindmap')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    ideasViewMode === 'mindmap'
                      ? 'bg-white dark:bg-navy-800 text-emerald-600 dark:text-emerald-400 shadow-sm border border-emerald-300 dark:border-emerald-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400'
                  }`}
                  title={isPolish ? 'Mapa myśli' : 'Mind Map'}
                  role="radio"
                  aria-checked={ideasViewMode === 'mindmap'}
                >
                  <GitBranch size={16} />
                </button>
              </div>
            )}

            {/* Notifications View Mode Toggle (list / kanban) — only on Notifications tab */}
            {activeTab === 'notifications' && !activeDocumentId && (
              <div
                className="inline-flex items-center rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-0.5"
                role="radiogroup"
                aria-label={isPolish ? 'Tryb widoku' : 'View mode'}
              >
                <button
                  onClick={() => setNotificationsViewMode('list')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    notificationsViewMode === 'list'
                      ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Widok listy' : 'List view'}
                  role="radio"
                  aria-checked={notificationsViewMode === 'list'}
                >
                  <LayoutList size={16} />
                </button>
                <button
                  onClick={() => setNotificationsViewMode('kanban')}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    notificationsViewMode === 'kanban'
                      ? 'bg-white dark:bg-navy-800 text-primary-600 dark:text-primary-400 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Widok kanban' : 'Kanban view'}
                  role="radio"
                  aria-checked={notificationsViewMode === 'kanban'}
                >
                  <Kanban size={16} />
                </button>
              </div>
            )}

            {/* Notebook tools — only on Notebook tab */}
            {activeTab === 'notebook' && !activeDocumentId && (
              <div
                className="inline-flex items-center rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900 p-0.5"
                role="group"
                aria-label={isPolish ? 'Narzędzia notatnika' : 'Notebook tools'}
              >
                <button
                  onClick={() => setNotebookLinkedIdeasOpen((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    notebookLinkedIdeasOpen
                      ? 'bg-white dark:bg-navy-800 text-amber-600 dark:text-amber-300 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Powiązane pomysły' : 'Linked Ideas'}
                  aria-pressed={notebookLinkedIdeasOpen}
                >
                  <Lightbulb size={16} />
                </button>
                <button
                  onClick={() => setNotebookPulseOpen((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-all duration-150 ${
                    notebookPulseOpen
                      ? 'bg-white dark:bg-navy-800 text-rose-600 dark:text-rose-300 shadow-sm border border-slate-200 dark:border-navy-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                  title={isPolish ? 'Knowledge Pulse' : 'Knowledge Pulse'}
                  aria-pressed={notebookPulseOpen}
                >
                  <HeartPulse size={16} />
                </button>
              </div>
            )}

            {/* Context-sensitive Filter Dropdown (only show when viewing list) */}
            {currentFilters.length > 0 && (
              <div className="relative">
                <select
                  value={currentFilterValue}
                  onChange={(e) => handleFilterChange(e.target.value)}
                  className="
                    appearance-none h-9 pl-3 pr-9 rounded-lg text-sm font-medium
                    bg-white dark:bg-navy-800
                    border border-slate-200 dark:border-navy-600
                    text-slate-700 dark:text-slate-200
                    hover:bg-slate-50/70 dark:hover:bg-navy-800/80
                    focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
                    transition-colors duration-150
                    cursor-pointer min-w-[140px]
                  "
                >
                  {currentFilters.map((filter) => (
                    <option key={filter.id} value={filter.id}>
                      {filter.label}
                      {filter.count !== undefined && filter.count > 0 ? ` (${filter.count})` : ''}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none"
                />
              </div>
            )}

            {/* Decisions: Priority filter */}
            {activeTab === 'decisions' && !activeDocumentId && (
              <div className="relative">
                <select
                  value={decisionPriorityFilter}
                  onChange={(e) =>
                    setDecisionPriorityFilter(e.target.value as DecisionPriorityFilter)
                  }
                  className="
                    appearance-none h-9 pl-3 pr-9 rounded-lg text-sm font-medium
                    bg-white dark:bg-navy-800
                    border border-slate-200 dark:border-navy-600
                    text-slate-700 dark:text-slate-200
                    hover:bg-slate-50/70 dark:hover:bg-navy-800/80
                    focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20
                    transition-colors duration-150
                    cursor-pointer min-w-[170px]
                  "
                  aria-label={isPolish ? 'Priorytet' : 'Priority'}
                  title={isPolish ? 'Filtr priorytetu' : 'Priority filter'}
                >
                  <option value="all">
                    {isPolish ? 'Priorytet: wszystkie' : 'Priority: all'}
                  </option>
                  <option value="CRITICAL">
                    {isPolish ? 'Priorytet: krytyczne' : 'Priority: critical'}
                  </option>
                  <option value="HIGH">
                    {isPolish ? 'Priorytet: wysoki' : 'Priority: high'}
                  </option>
                  <option value="MEDIUM">
                    {isPolish ? 'Priorytet: średni' : 'Priority: medium'}
                  </option>
                  <option value="LOW">
                    {isPolish ? 'Priorytet: niski' : 'Priority: low'}
                  </option>
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none"
                />
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
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
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
                    : activeTab === 'ideas'
                      ? isPolish
                        ? 'Szukaj pomysłów...'
                        : 'Search ideas...'
                      : activeTab === 'decisions'
                        ? isPolish
                          ? 'Szukaj decyzji...'
                          : 'Search decisions...'
                        : isPolish
                          ? 'Szukaj powiadomień...'
                          : 'Search notifications...'
                }
                autoFocus
                className="w-full pl-10 pr-10 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-900 dark:text-white placeholder:text-slate-500 dark:text-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={handleCloseSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
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
      <div className="flex-1 overflow-hidden min-h-0">
        {renderContent()}
      </div>
    </div>
  );
};

export default MyWorkHub;
