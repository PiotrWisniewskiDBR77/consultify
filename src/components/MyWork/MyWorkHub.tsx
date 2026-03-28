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
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Flame,
  GanttChart,
  GitBranch,
  Home,
  Hourglass,
  Inbox,
  Kanban,
  Layers,
  LayoutGrid,
  LayoutList,
  Lightbulb,
  List,
  Loader2,
  Plus,
  Rocket,
  Scale,
  Search,
  Sparkles,
  Sprout,
  Tag,
  Target,
  Trash2,
  TreePine,
  TrendingUp,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import {
  type WorkspacePanelKey,
  WorkspacePanelStrip,
} from '@/components/shared/WorkspacePanelStrip';
import { useFeatureFlags } from '@/hooks/useFeatureFlags';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { useUserCan } from '@/hooks/useUserCan';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { createWorkspaceContext, type WorkspaceType } from '@/types/workspace';
import { buildMyWorkSheetTableOpenPath, getArtifactPath } from '@/utils/artifactLinks';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import {
  downloadSheetArtifactXlsx,
  resolveTablePlatformWorkspaceIdForTable,
} from '@/utils/sheetArtifactOpen';

import { type DecisionsBulkBarPayload, DecisionsPanelContent } from './DecisionsPanelContent';
import type { FocusFilter, FocusItem, FocusSort } from './Focus/FocusView';
import type { HomeScreenAction } from './Home/homeV2Types';
import {
  composeIdeaBodyFromSeedIntent,
  deriveIdeaTitleFromSeedIntent,
  type IdeaWorkspaceSeedIntent,
  normalizePreferredSystem,
} from './ideaEntryTypes';
import type { CanvasToolType } from './ideaSelectionTypes';
import { EMPTY_SELECTION, type IdeaWorkspaceSelection } from './ideaSelectionTypes';
import { type InboxBulkBarPayload, InboxContent, type InboxCounts } from './InboxContent';
import type { IdeasBulkBarPayload, IdeaStage, MyIdea } from './MyIdeasListContent';
import { MyIdeasListContent } from './MyIdeasListContent';
import { MyTasksListContent } from './MyTasksListContent';
import { IdeaStartupTemplates } from './table/IdeaStartupTemplates';

// Heavy sub-views (TipTap, DnD, calendars, detailed editors) are lazy-loaded.
// This keeps initial My Work navigation snappy and avoids loading unused tabs upfront.
const TaskDetailView = lazyWithRetry(() =>
  import('./TaskDetailView').then((m) => ({ default: m.TaskDetailView }))
);
const IdeaMapWorkspace = lazyWithRetry(() =>
  import('./IdeaMapWorkspace').then((m) => ({ default: m.IdeaMapWorkspace }))
);
const DecisionDetailView = lazyWithRetry(() =>
  import('./DecisionDetailView').then((m) => ({ default: m.DecisionDetailView }))
);
const NotificationDetailView = lazyWithRetry(() =>
  import('./NotificationDetailView').then((m) => ({ default: m.NotificationDetailView }))
);
const ExecutiveDashboard = lazyWithRetry(() =>
  import('./Executive/ExecutiveDashboard').then((m) => ({ default: m.ExecutiveDashboard }))
);
const HomeView = lazyWithRetry(() =>
  import('./Home/HomeView').then((m) => ({ default: m.HomeView }))
);
const CalendarView = lazyWithRetry(() =>
  import('./Calendar/CalendarView').then((m) => ({ default: m.CalendarView }))
);
const FocusView = lazyWithRetry(() =>
  import('./Focus/FocusView').then((m) => ({ default: m.FocusView }))
);
const NotebookContent = lazyWithRetry(() =>
  import('./NotebookContent').then((m) => ({ default: m.NotebookContent }))
);
const TasksKanbanBoard = lazyWithRetry(() =>
  import('./TasksKanbanBoard').then((m) => ({ default: m.TasksKanbanBoard }))
);
const TasksCalendarView = lazyWithRetry(() =>
  import('./TasksCalendarView').then((m) => ({ default: m.TasksCalendarView }))
);
const DecisionsKanbanBoard = lazyWithRetry(() =>
  import('./DecisionsKanbanBoard').then((m) => ({ default: m.DecisionsKanbanBoard }))
);
const DecisionsTimelineContainer = lazyWithRetry(() =>
  import('./DecisionsTimelineView').then((m) => ({ default: m.DecisionsTimelineContainer }))
);

// Types
type ModuleTab =
  | 'home'
  | 'ideas'
  | 'notebook'
  | 'inbox'
  | 'calendar'
  | 'tasks'
  | 'decisions'
  | 'manager';
type TaskFilter = 'all' | 'overdue' | 'today' | 'week' | 'urgent';
type TasksViewMode = 'table' | 'kanban' | 'calendar';
type IdeasViewMode = 'table' | 'grid';
type DecisionsViewMode = 'table' | 'kanban' | 'timeline';
type InboxViewMode = 'flat' | 'sections';
type DecisionFilter = 'all' | 'my' | 'awaiting';
type DecisionPriorityFilter = 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

// Q1: Per-tab system prompts for contextual chat
const TAB_SYSTEM_PROMPTS: Record<ModuleTab, string> = {
  home: "You are an AI transformation companion operating from the user's live Home screen. Synthesize signals across ideas, decisions, execution, team alignment, and industry context. Help the user understand what matters now, frame transformation moves, and convert signals into action. Stay strategic, concise, and highly relevant.",
  ideas: [
    'You have two roles inside the Idea Workspace:',
    '',
    "BUILDER — create structure on the user's behalf:",
    '  • generate mind maps, process flows, tables, whiteboard clusters',
    '  • expand branches, add nodes, propose layouts',
    '  • convert selections into tasks, initiatives, decisions, reports',
    '  • always propose changes for preview before applying',
    '',
    "EXPERT — challenge, question, and improve the user's thinking:",
    '  • challenge assumptions and identify blind spots',
    '  • suggest missing dimensions, risks, and frameworks',
    '  • recommend measurements, KPIs, and next steps',
    '  • explain trade-offs and simplify complexity',
    '',
    'Rules:',
    '  • Never silently overwrite workspace content — always propose, preview, then apply.',
    '  • Be concise. Prefer structured output (bullets, numbered lists, tables) over paragraphs.',
    '  • When the user describes a problem, default to Builder mode and propose an initial structure.',
    '  • When the user asks "why", "what if", or "am I missing", switch to Expert mode.',
    '  • Reference the active system (mind map, whiteboard, process flow, table) when relevant.',
  ].join('\n'),
  notebook:
    'You are a knowledge companion. Help the user develop ideas, structure notes, extract insights, and connect concepts. Be thoughtful and build on existing content.',
  inbox:
    'You are a triage assistant. Help the user quickly process incoming items — prioritize, categorize, and suggest actions (accept, defer, delegate, dismiss). Be efficient and action-oriented.',
  calendar:
    'You are a scheduling assistant. Help the user plan their time, find conflicts, suggest optimal time slots for deep work, and coordinate across calendars. Be practical and time-aware.',
  tasks:
    'You are an execution manager. Help the user manage tasks — break down work, estimate effort, identify blockers, suggest delegation, and track progress. Be practical and specific.',
  decisions:
    'You are a decision advisor. Help analyze decisions — weigh pros/cons, assess risks, identify stakeholders, and recommend approaches. Structure thinking clearly.',
  manager:
    'You are a C-level strategic advisor. The user is a manager reviewing portfolio health, KPIs, and team performance. Focus on high-level insights, risks, and strategic recommendations. Be concise and data-driven.',
};

// Q3: Per-tab quick prompts shown as chips in the chat panel
const TAB_QUICK_PROMPTS: Record<ModuleTab, string[]> = {
  home: [
    'What deserves the highest attention right now?',
    'Translate these signals into a plan',
    'What is the strongest transformation move this week?',
    'Where are we losing momentum?',
  ],
  ideas: [
    'Build an initial structure for my idea',
    'Challenge my assumptions',
    'What am I missing?',
    'Suggest next steps',
    'Turn this into a decision matrix',
    'Find root causes',
  ],
  notebook: ['Summarize this note', 'Extract action items', 'What perspectives am I missing?'],
  inbox: [
    'Triage all new items for me',
    'Summarize notifications since yesterday',
    'What needs urgent attention?',
  ],
  calendar: [
    'Find a free slot for deep work this week',
    'What conflicts do I have tomorrow?',
    'Suggest an optimal schedule for today',
  ],
  tasks: [
    'Reprioritize my tasks',
    'Summarize what I did this week',
    'Which tasks should I delegate?',
    'Break down my top task',
  ],
  decisions: [
    'Summarize pending decisions',
    'Analyze the most urgent decision',
    'What decisions are blocking progress?',
  ],
  manager: [
    'Give me a 30-second briefing',
    'What needs my attention most?',
    'Portfolio risk summary',
    'Team capacity overview',
  ],
};
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
  home: number;
  ideas: number;
  notebook: number;
  inbox: number;
  calendar: number;
  tasks: number;
  decisions: number;
  manager: number;
}

interface TaskFilterCounts {
  overdue: number;
  today: number;
  week: number;
  urgent: number;
  newUntriaged: number;
}

interface DecisionFilterCounts {
  my: number;
  awaiting: number;
}

// Open Document interface for dynamic tabs
interface OpenDocument {
  id: string;
  type: 'task' | 'idea' | 'decision' | 'notification';
  name: string;
  status: ItemStatus;
  data?: any;
}

const TRANSIENT_DOCUMENT_PREFIXES = ['new-task-', 'new-idea-', 'new-decision-'] as const;

function isOpenDocument(value: unknown): value is OpenDocument {
  if (!value || typeof value !== 'object') return false;
  const doc = value as Partial<OpenDocument>;
  return (
    typeof doc.id === 'string' &&
    typeof doc.name === 'string' &&
    typeof doc.status === 'string' &&
    (doc.type === 'task' ||
      doc.type === 'idea' ||
      doc.type === 'decision' ||
      doc.type === 'notification')
  );
}

function isTransientDocumentId(id: string): boolean {
  return TRANSIENT_DOCUMENT_PREFIXES.some((prefix) => id.startsWith(prefix));
}

function readStoredMyWorkDocuments(): {
  openDocuments: OpenDocument[];
  activeDocumentId: string | null;
} {
  if (typeof window === 'undefined') {
    return { openDocuments: [], activeDocumentId: null };
  }

  try {
    const raw = window.sessionStorage.getItem('moduleHub.openDocuments.mywork');
    if (!raw) return { openDocuments: [], activeDocumentId: null };

    const parsed = JSON.parse(raw);
    const openDocuments: OpenDocument[] = Array.isArray(parsed?.openDocuments)
      ? parsed.openDocuments
          .filter(isOpenDocument)
          // Temporary "new-*" placeholders should not survive a full page reload.
          .filter((doc: OpenDocument) => !isTransientDocumentId(doc.id))
      : [];
    const activeDocumentId =
      typeof parsed?.activeDocumentId === 'string' &&
      openDocuments.some((doc: OpenDocument) => doc.id === parsed.activeDocumentId)
        ? parsed.activeDocumentId
        : null;

    return { openDocuments, activeDocumentId };
  } catch {
    return { openDocuments: [], activeDocumentId: null };
  }
}

function getDocumentTab(type: OpenDocument['type']): ModuleTab {
  switch (type) {
    case 'task':
      return 'tasks';
    case 'idea':
      return 'ideas';
    case 'decision':
      return 'decisions';
    case 'notification':
      return 'inbox';
  }
}

function getInitialMyWorkTab(searchParams: URLSearchParams, _canViewManager: boolean): ModuleTab {
  if (searchParams.get('ideaId') || searchParams.get('idea')) return 'ideas';
  if (searchParams.get('taskId') || searchParams.get('task')) return 'tasks';
  if (searchParams.get('decisionId') || searchParams.get('decision')) return 'decisions';

  return 'home';
}

function parseMyWorkPathIntent(
  pathname: string,
  isPolish: boolean
): { tab: ModuleTab; doc?: OpenDocument } | null {
  const parseIdeaTool = (segment?: string): CanvasToolType | undefined => {
    switch (segment) {
      case 'mind-map':
      case 'mindmap':
        return 'mindmap';
      case 'whiteboard':
        return 'whiteboard';
      case 'process-flow':
      case 'process_flow':
      case 'flow':
        return 'process_flow';
      case 'table':
        return 'table';
      default:
        return undefined;
    }
  };
  const normalized = pathname.replace(/\/+$/, '');
  if (!normalized.startsWith('/my-work')) return null;
  const segments = normalized.split('/').filter(Boolean);
  if (segments.length < 2) return null;

  if (segments[1] === 'ideas' && segments[2]) {
    const ideaId = decodeURIComponent(segments[2]);
    const openMap = segments[3] === 'workspace';
    const initialTool = openMap ? parseIdeaTool(segments[4]) : undefined;
    return {
      tab: 'ideas',
      doc: {
        id: ideaId,
        type: 'idea',
        name: isPolish ? 'Pomysł' : 'Idea',
        status: 'idea',
        data: { openMap, initialTool },
      },
    };
  }

  if (segments[1] === 'tasks' && segments[2]) {
    return {
      tab: 'tasks',
      doc: {
        id: decodeURIComponent(segments[2]),
        type: 'task',
        name: isPolish ? 'Zadanie' : 'Task',
        status: 'todo',
      },
    };
  }

  if (segments[1] === 'decisions' && segments[2]) {
    return {
      tab: 'decisions',
      doc: {
        id: decodeURIComponent(segments[2]),
        type: 'decision',
        name: isPolish ? 'Decyzja' : 'Decision',
        status: 'pending',
      },
    };
  }

  if (segments[1] === 'home') return { tab: 'home' };
  if (segments[1] === 'ideas') return { tab: 'ideas' };
  if (segments[1] === 'tasks') return { tab: 'tasks' };
  if (segments[1] === 'decisions') return { tab: 'decisions' };
  if (segments[1] === 'notebook') return { tab: 'notebook' };
  if (segments[1] === 'inbox') return { tab: 'inbox' };
  if (segments[1] === 'calendar') return { tab: 'calendar' };
  if (segments[1] === 'manager') return { tab: 'manager' };

  return null;
}

// Shared button styles (KANON v3): pill buttons, h-9, hover = bg-only.
// SSOT: docs/ui-standards/00-foundation/visual-language.md (8.3) + UI_UX_CANON_V3.md (buttons).
const BUTTON_BASE = `
  inline-flex items-center gap-2 h-9 px-3 rounded-full text-sm font-medium
  border transition-colors duration-150
  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1
  ring-offset-white dark:ring-offset-navy-900
  active:scale-[0.98]
`;

const BUTTON_INACTIVE = `
  ${BUTTON_BASE}
  bg-white/70 dark:bg-white/[0.04]
  border-slate-200/70 dark:border-white/[0.06]
  text-slate-700 dark:text-slate-300
  hover:bg-slate-100 dark:hover:bg-white/[0.06]
`;

const BUTTON_ACTIVE = `
  ${BUTTON_BASE}
  bg-primary-50 dark:bg-primary-500/10
  border-primary-200 dark:border-primary-500/30
  text-primary-700 dark:text-primary-200
`;

// Topbar pills (filters / view tool) — keep consistent with BUTTON_* but smaller text.
const TOPBAR_PILL_BASE =
  'inline-flex items-center gap-2 h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
const TOPBAR_PILL_INACTIVE = `${TOPBAR_PILL_BASE} bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`;

// Tab styles for dynamic tabs
const TAB_BASE = `
  flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-medium
  border border-l-2 transition-all duration-200 cursor-pointer
`;

const TAB_INACTIVE = `
  ${TAB_BASE}
  bg-slate-50 dark:bg-navy-800
  border-slate-200 dark:border-navy-600
  text-slate-600 dark:text-slate-400
  hover:bg-slate-100 dark:hover:bg-navy-700
`;

const TAB_ACTIVE = `
  ${TAB_BASE}
  bg-primary-500/15 border-primary-500 text-primary-400
  shadow-sm shadow-primary-500/10
`;

// Type colors for dynamic tabs
const TYPE_COLORS = {
  // v3 identity map (docs/ui-standards/00-foundation/artifact-identity-map.md)
  task: 'border-l-emerald-500',
  idea: 'border-l-violet-500',
  decision: 'border-l-amber-500',
  notification: 'border-l-red-500',
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
  const openChatWithContext = useOpenChatWithContext();
  const setWorkspaceContext = useConversationStore((s) => s.setWorkspaceContext);
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentUser,
    currentProjectId,
    myWorkIntent,
    clearMyWorkIntent,
    myWorkEvent,
    clearMyWorkEvent,
    setChatSystemPrompt,
    setChatQuickPrompts,
    setChatKickoffMessage,
    isChatCollapsed,
    toggleChatCollapse,
  } = useAppStore();

  const lazyFallback = (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>{isPolish ? 'Ładowanie…' : 'Loading…'}</span>
      </div>
    </div>
  );

  // Role-based access – Manager tab restricted to admin/manager/superadmin
  const { isAdmin, isManager, isSuperAdmin } = useUserCan();
  const canViewManager = isAdmin || isManager || isSuperAdmin;

  const restoredDocumentState = useMemo(() => readStoredMyWorkDocuments(), []);
  // Tab state — restore the last live document when possible, otherwise land on Home/path intent.
  const [activeTab, setActiveTab] = useState<ModuleTab>(() => {
    const restoredActiveDoc = restoredDocumentState.activeDocumentId
      ? restoredDocumentState.openDocuments.find(
          (doc) => doc.id === restoredDocumentState.activeDocumentId
        ) || null
      : null;
    return restoredActiveDoc
      ? getDocumentTab(restoredActiveDoc.type)
      : getInitialMyWorkTab(searchParams, canViewManager);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Filter states
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [tasksViewMode, setTasksViewMode] = useState<TasksViewMode>('table');
  const [ideasViewMode, setIdeasViewMode] = useState<IdeasViewMode>('table');
  const [ideaActiveTool, setIdeaActiveTool] = useState<CanvasToolType>('mindmap');
  const [ideaActivePanel, setIdeaActivePanel] = useState<WorkspacePanelKey>(null);
  const [ideaSelection, setIdeaSelection] = useState<IdeaWorkspaceSelection>(EMPTY_SELECTION);
  const [ideaLocked, setIdeaLocked] = useState(true);
  const [showStartupTemplates, setShowStartupTemplates] = useState(false);
  const [ideaStageFilter, setIdeaStageFilter] = useState<IdeaStage | 'all'>('all');
  const [ideasStageCounts, setIdeasStageCounts] = useState<{
    total: number;
    spark: number;
    incubating: number;
    shaping: number;
    ready: number;
    promoted: number;
  }>({ total: 0, spark: 0, incubating: 0, shaping: 0, ready: 0, promoted: 0 });
  const [ideasBulkUi, setIdeasBulkUi] = useState<{
    selectedCount: number;
    allSelected: boolean;
    someSelected: boolean;
  } | null>(null);
  const ideasBulkActionsRef = useRef<Pick<
    IdeasBulkBarPayload,
    'selectAllVisible' | 'clearSelection' | 'convert' | 'tag' | 'deleteSelected'
  > | null>(null);

  const handleIdeaPanelChange = useCallback((panel: WorkspacePanelKey) => {
    setIdeaActivePanel(panel);
  }, []);

  const [decisionsViewMode, setDecisionsViewMode] = useState<DecisionsViewMode>('table');
  const [inboxViewMode, setInboxViewMode] = useState<InboxViewMode>('flat');
  const [inboxStatusTab, setInboxStatusTab] = useState<'open' | 'done' | 'saved' | 'all'>('open');
  const [inboxSection, setInboxSection] = useState<'today' | 'this_week' | 'all'>('all');
  const [inboxActionRequiredOnly, setInboxActionRequiredOnly] = useState(false);
  type InboxPreset =
    | 'all'
    | 'overdue'
    | 'saved'
    | 'ai'
    | 'critical'
    | 'action_required'
    | 'today'
    | 'this_week';
  const [inboxPreset, setInboxPreset] = useState<InboxPreset>('all');
  const [inboxCounts, setInboxCounts] = useState<InboxCounts | null>(null);
  const [inboxBulkUi, setInboxBulkUi] = useState<{
    selectedCount: number;
    allSelected: boolean;
    someSelected: boolean;
  } | null>(null);
  const inboxBulkActionsRef = useRef<Pick<
    InboxBulkBarPayload,
    'selectAllVisible' | 'clearSelection' | 'triage'
  > | null>(null);
  const [notebookLinkedIdeasOpen, setNotebookLinkedIdeasOpen] = useState(false);
  const [notebookTopicsOpen, setNotebookTopicsOpen] = useState(false);
  const [notebookChatOpen, setNotebookChatOpen] = useState(false);
  const [notebookOpenPageId, setNotebookOpenPageId] = useState<string | null>(null);
  const notebookActivePanel: WorkspacePanelKey = notebookChatOpen
    ? 'tools'
    : notebookLinkedIdeasOpen
      ? 'context'
      : notebookTopicsOpen
        ? 'ai_suggestions'
        : null;
  const [notebookCreateReqId, setNotebookCreateReqId] = useState(0);
  const [calendarCreateReqId, setCalendarCreateReqId] = useState(0);

  // Focus (KANON v3): no extra toolbars inside content — controls live in Command Row / Tool slot
  const [focusFilter, setFocusFilter] = useState<FocusFilter>('all');
  const [focusHideCompleted, setFocusHideCompleted] = useState(false);
  const [focusSort, setFocusSort] = useState<FocusSort>('manual');
  const [focusShowAIPlan, setFocusShowAIPlan] = useState(false);
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('my');
  const [decisionPriorityFilter, setDecisionPriorityFilter] =
    useState<DecisionPriorityFilter>('all');
  // Counts
  const [tabCounts, setTabCounts] = useState<TabCounts>({
    home: 0,
    ideas: 0,
    notebook: 0,
    inbox: 0,
    calendar: 0,
    tasks: 0,
    decisions: 0,
    manager: 0,
  });
  const [taskFilterCounts, setTaskFilterCounts] = useState<TaskFilterCounts>({
    overdue: 0,
    today: 0,
    week: 0,
    urgent: 0,
    newUntriaged: 0,
  });
  const [tasksBulkUi, setTasksBulkUi] = useState<{ selectedCount: number } | null>(null);
  const tasksBulkActionsRef = useRef<{
    selectAllVisible: () => void;
    clearSelection: () => void;
    complete: () => void;
    changePriority: () => void;
    changeDueDate: () => void;
    deleteSelected: () => void;
  } | null>(null);
  const [decisionFilterCounts, setDecisionFilterCounts] = useState<DecisionFilterCounts>({
    my: 0,
    awaiting: 0,
  });
  const [decisionsBulkUi, setDecisionsBulkUi] = useState<{
    selectedCount: number;
    allSelected: boolean;
    someSelected: boolean;
  } | null>(null);
  const decisionsBulkActionsRef = useRef<Pick<
    NonNullable<DecisionsBulkBarPayload>,
    | 'selectAllVisible'
    | 'clearSelection'
    | 'approve'
    | 'reject'
    | 'deleteSelected'
    | 'changePriority'
    | 'remind'
    | 'escalate'
    | 'snoozeTomorrow'
  > | null>(null);
  // V3-A02: Dynamic documents state with sessionStorage persistence
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>(
    () => restoredDocumentState.openDocuments
  );
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(
    () => restoredDocumentState.activeDocumentId
  );
  const [pendingDocument, setPendingDocument] = useState<OpenDocument | null>(null);
  const [pendingUrlCleanup, setPendingUrlCleanup] = useState<{
    documentId: string;
    keys: string[];
  } | null>(null);
  useEffect(() => {
    try {
      window.sessionStorage.setItem(
        'moduleHub.openDocuments.mywork',
        JSON.stringify({ openDocuments, activeDocumentId })
      );
    } catch {
      /* ignore */
    }
  }, [openDocuments, activeDocumentId]);

  // Keep chat "screen context" aligned with My Work sub-page (tab + open artifact)
  useEffect(() => {
    const activeDoc = activeDocumentId
      ? openDocuments.find((d) => d.id === activeDocumentId) || null
      : null;

    const typeFromActiveDoc: WorkspaceType | null =
      activeDoc?.type === 'task'
        ? 'task'
        : activeDoc?.type === 'decision'
          ? 'decision'
          : activeDoc?.type === 'notification'
            ? 'general'
            : activeDoc?.type === 'idea'
              ? 'general'
              : null;

    const typeFromTab: WorkspaceType =
      activeTab === 'tasks'
        ? 'task'
        : activeTab === 'decisions'
          ? 'decision'
          : activeTab === 'calendar'
            ? 'general'
            : activeTab === 'notebook'
              ? 'document'
              : activeTab === 'manager'
                ? 'dashboard'
                : 'general';

    const ctx = createWorkspaceContext(AppView.MY_WORK, typeFromActiveDoc || typeFromTab, {
      projectId: currentProjectId || undefined,
      entityId: activeDoc?.id || undefined,
      entityName: activeDoc?.name || undefined,
      entityData: {
        module: 'my_work',
        tab: activeTab,
        open: activeDoc ? { type: activeDoc.type, id: activeDoc.id } : null,
        url: `${location.pathname}${location.search || ''}`,
      },
    });

    setWorkspaceContext(ctx);
  }, [
    activeTab,
    activeDocumentId,
    openDocuments,
    currentProjectId,
    location.pathname,
    location.search,
    setWorkspaceContext,
  ]);

  // Auto-open Tools panel only for freshly created ideas.
  const prevDocIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (activeTab !== 'ideas' || !activeDocumentId) return;
    if (activeDocumentId === prevDocIdRef.current) return;
    prevDocIdRef.current = activeDocumentId;
    const isNewIdeaDoc = Boolean(
      openDocuments.find((doc) => doc.id === activeDocumentId)?.data?.isNew ||
      String(activeDocumentId).startsWith('new-idea-')
    );
    setIdeaActivePanel(isNewIdeaDoc ? 'tools' : null);
  }, [activeTab, activeDocumentId, openDocuments]);

  // EventBus refresh counter — incremented when cross-tab events fire.
  // Child tab components include this in their fetch dependency arrays.
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Loading state
  const [isLoading, setIsLoading] = useState(false);

  // M1: Chat context enrichment — aggregated workload summary
  const [contextSummary, setContextSummary] = useState<Record<string, any> | null>(null);

  useEffect(() => {
    const fetchContext = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/my-work/context-summary', {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (res.ok) setContextSummary(await res.json());

        // L7: Restore previous session context for continuity
        try {
          const sessionRes = await fetch('/api/my-work/session-context', {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });
          if (sessionRes.ok) {
            const { context } = await sessionRes.json();
            if (context?.lastViewedItems?.length) {
              // Could append to system prompt: "In your last session, you worked on..."
            }
          }
        } catch {
          /* ignore */
        }
      } catch {
        /* ignore — partial enrichment is fine */
      }
    };
    fetchContext();
    const interval = setInterval(fetchContext, 300_000);
    return () => clearInterval(interval);
  }, []);

  // Document handlers (Dynamic Tabs) - defined early to avoid hoisting issues
  const programmaticTabSwitchRef = useRef(false);
  const handleOpenDocument = useCallback((doc: OpenDocument) => {
    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    programmaticTabSwitchRef.current = true;
    setActiveTab(getDocumentTab(doc.type));
    setActiveDocumentId(doc.id);
  }, []);

  useEffect(() => {
    if (!pendingDocument) return;
    if (getDocumentTab(pendingDocument.type) !== activeTab) return;

    handleOpenDocument(pendingDocument);
    setPendingDocument(null);
  }, [activeTab, handleOpenDocument, pendingDocument]);

  useEffect(() => {
    if (!pendingUrlCleanup) return;
    if (activeDocumentId !== pendingUrlCleanup.documentId) return;

    const next = new URLSearchParams(searchParams);
    pendingUrlCleanup.keys.forEach((key) => next.delete(key));
    setSearchParams(next, { replace: true });
    setPendingUrlCleanup(null);
  }, [activeDocumentId, pendingUrlCleanup, searchParams, setSearchParams]);

  // Close document only when the user manually switches the main tab (not programmatic).
  const previousActiveTabRef = useRef<ModuleTab>(activeTab);
  useEffect(() => {
    if (previousActiveTabRef.current !== activeTab) {
      if (programmaticTabSwitchRef.current) {
        programmaticTabSwitchRef.current = false;
      } else {
        setActiveDocumentId(null);
      }
      previousActiveTabRef.current = activeTab;
    }
  }, [activeTab]);

  // Update per-tab chat context (Q1/Q3) enriched with M1 workload summary + V5 workspace context.
  const activeIdeaDoc = useMemo(() => {
    if (activeTab !== 'ideas' || !activeDocumentId) return null;
    return openDocuments.find((d) => d.id === activeDocumentId && d.type === 'idea') || null;
  }, [activeTab, activeDocumentId, openDocuments]);

  useEffect(() => {
    let prompt = TAB_SYSTEM_PROMPTS[activeTab] || '';
    if (contextSummary) {
      const ctx: string[] = [];
      if (contextSummary.totalOpenTasks) ctx.push(`${contextSummary.totalOpenTasks} open tasks`);
      if (contextSummary.overdueCount) ctx.push(`${contextSummary.overdueCount} overdue`);
      if (contextSummary.pendingDecisionCount)
        ctx.push(`${contextSummary.pendingDecisionCount} pending decisions`);
      if (contextSummary.inboxUnprocessed)
        ctx.push(`${contextSummary.inboxUnprocessed} unread inbox items`);
      if (contextSummary.focusTodayCount)
        ctx.push(`${contextSummary.focusTodayCount} items in today's focus`);
      if (ctx.length) {
        prompt += `\n\nUser's current workload: ${ctx.join(', ')}.`;
      }
    }

    if (activeIdeaDoc) {
      const wsCtx: string[] = [];
      wsCtx.push(`Active idea: "${activeIdeaDoc.name}"`);
      wsCtx.push(`Active system: ${ideaActiveTool}`);
      wsCtx.push(ideaLocked ? 'Stage: seed (not yet accepted)' : 'Stage: active (accepted)');
      if (ideaSelection.type !== 'none') {
        wsCtx.push(`Selection: ${ideaSelection.count} ${ideaSelection.type}(s) selected`);
      }
      prompt += `\n\nWorkspace context:\n${wsCtx.join('\n')}`;
    }

    setChatSystemPrompt(prompt || null);
    setChatQuickPrompts(TAB_QUICK_PROMPTS[activeTab] || null);
  }, [
    activeTab,
    contextSummary,
    setChatSystemPrompt,
    setChatQuickPrompts,
    activeIdeaDoc,
    ideaActiveTool,
    ideaLocked,
    ideaSelection,
  ]);

  // Deep link support: header dropdown → open inside My Work
  useEffect(() => {
    if (!myWorkIntent) return;
    if (myWorkIntent.tab) {
      // Block navigation to manager tab for unauthorized users
      const targetTab = myWorkIntent.tab as ModuleTab;
      if (targetTab === 'manager' && !canViewManager) {
        clearMyWorkIntent();
        return;
      }
      setActiveTab(targetTab);
    }
    setActiveDocumentId(null);
    if (myWorkIntent.open) {
      const o = myWorkIntent.open;
      const nextDoc: OpenDocument = {
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
      };

      if (myWorkIntent.tab && getDocumentTab(nextDoc.type) !== activeTab) {
        setPendingDocument(nextDoc);
      } else {
        handleOpenDocument(nextDoc);
      }
    }
    clearMyWorkIntent();
  }, [activeTab, myWorkIntent, clearMyWorkIntent, handleOpenDocument]);

  // L7: Save session context for cross-session continuity
  useEffect(() => {
    const saveContext = () => {
      const lastViewedItems = openDocuments.map((d) => ({
        type: d.type,
        id: d.id,
        name: d.name,
      }));
      try {
        const token = localStorage.getItem('token');
        fetch('/api/my-work/session-context', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ lastViewedItems, activeTab }),
        }).catch(() => {});
      } catch {
        /* ignore */
      }
    };
    const timer = setTimeout(saveContext, 5000);
    return () => clearTimeout(timer);
  }, [activeTab, openDocuments]);

  // F1: EventBus — refresh tabs when cross-tab events fire
  useEffect(() => {
    if (!myWorkEvent) return;
    setRefreshTrigger((prev) => prev + 1);
    clearMyWorkEvent();
  }, [myWorkEvent, clearMyWorkEvent]);

  // F3: Handle mywork-open-item custom event (dispatched by KnowledgePulse, detail views, etc.)
  const navigate = useNavigate();
  const { isEnabled } = useFeatureFlags();
  useEffect(() => {
    const handler = (e: Event) => {
      const { type, id, name } = (e as CustomEvent).detail || {};
      if (!type || !id) return;
      if (type === 'sheet') {
        void (async () => {
          const tableId = String(id);
          if (isEnabled('tablePlatformMetadataFirst')) {
            const ws = await resolveTablePlatformWorkspaceIdForTable(tableId);
            if (ws) {
              navigate(buildMyWorkSheetTableOpenPath(ws, tableId));
              return;
            }
          }
          const ok = await downloadSheetArtifactXlsx(tableId);
          if (ok) {
            toast.success(isPolish ? 'Pobrano arkusz (.xlsx)' : 'Downloaded spreadsheet (.xlsx)');
          } else {
            toast.error(
              isPolish ? 'Nie udało się pobrać arkusza' : 'Could not download spreadsheet'
            );
          }
        })();
        return;
      }
      if (
        [
          'initiative',
          'assessment',
          'report',
          'presentation',
          'meeting',
          'financial_model',
          'budget',
          'valuation',
          'analysis',
          'tool',
        ].includes(type)
      ) {
        navigate(getArtifactPath(type as any, String(id)));
        return;
      }
      const tabMap: Record<string, ModuleTab> = {
        task: 'tasks',
        decision: 'decisions',
        idea: 'ideas',
        notification: 'inbox',
        notebook: 'notebook',
      };
      if (tabMap[type]) setActiveTab(tabMap[type]);
      if (type === 'notebook') {
        setNotebookOpenPageId(String(id));
        return;
      }
      if (type !== 'notebook') {
        handleOpenDocument({
          id,
          type: type as 'task' | 'idea' | 'decision' | 'notification',
          name: name || type,
          status:
            type === 'notification'
              ? ('unread' as const)
              : type === 'decision'
                ? ('pending' as const)
                : type === 'idea'
                  ? ('idea' as const)
                  : ('todo' as const),
        });
      }
    };
    window.addEventListener('mywork-open-item', handler);
    return () => window.removeEventListener('mywork-open-item', handler);
  }, [handleOpenDocument, isEnabled, isPolish, navigate]);

  // URL deep link support:
  // - /my-work?taskId=...
  // - /my-work?decisionId=...
  // - /my-work?ideaId=...
  // Back-compat:
  // - /my-work?decision=...  (used by backend notification actionUrl)
  // - /my-work?task=...      (legacy/manual links)
  useEffect(() => {
    const taskId = searchParams.get('taskId') || searchParams.get('task');
    const decisionId = searchParams.get('decisionId') || searchParams.get('decision');
    const ideaId = searchParams.get('ideaId') || searchParams.get('idea');
    if (!taskId && !decisionId && !ideaId) return;

    if (taskId) {
      const nextDoc: OpenDocument = {
        id: taskId,
        type: 'task',
        name: isPolish ? 'Zadanie' : 'Task',
        status: 'todo',
      };
      setActiveTab('tasks');
      if (activeTab === 'tasks') handleOpenDocument(nextDoc);
      else setPendingDocument(nextDoc);
      setPendingUrlCleanup({ documentId: taskId, keys: ['taskId', 'task'] });
    }

    if (decisionId) {
      const nextDoc: OpenDocument = {
        id: decisionId,
        type: 'decision',
        name: isPolish ? 'Decyzja' : 'Decision',
        status: 'pending',
      };
      setActiveTab('decisions');
      if (activeTab === 'decisions') handleOpenDocument(nextDoc);
      else setPendingDocument(nextDoc);
      setPendingUrlCleanup({ documentId: decisionId, keys: ['decisionId', 'decision'] });
    }

    if (ideaId) {
      const nextDoc: OpenDocument = {
        id: ideaId,
        type: 'idea',
        name: isPolish ? 'Pomysł' : 'Idea',
        status: 'idea',
      };
      setActiveTab('ideas');
      if (activeTab === 'ideas') handleOpenDocument(nextDoc);
      else setPendingDocument(nextDoc);
      setPendingUrlCleanup({ documentId: ideaId, keys: ['ideaId', 'idea'] });
    }
  }, [activeTab, handleOpenDocument, searchParams, isPolish]);

  useEffect(() => {
    const intent = parseMyWorkPathIntent(location.pathname, isPolish);
    if (!intent) return;
    setActiveTab(intent.tab);
    const nextDoc = intent.doc;
    if (!nextDoc) return;
    if (nextDoc.type === 'idea' && nextDoc.data?.initialTool) {
      setIdeaActiveTool(nextDoc.data.initialTool as CanvasToolType);
    }
    if (activeTab === intent.tab) {
      handleOpenDocument(nextDoc);
      return;
    }
    setPendingDocument((prev) => {
      if (
        prev?.id === nextDoc.id &&
        prev?.type === nextDoc.type &&
        prev?.data?.openMap === nextDoc.data?.openMap &&
        prev?.data?.initialTool === nextDoc.data?.initialTool
      ) {
        return prev;
      }
      return nextDoc;
    });
  }, [activeTab, handleOpenDocument, location.pathname, isPolish]);

  // Tab configuration — new order: Home > Ideas > Notebook > Inbox > Calendar > Tasks > Decisions > Manager
  const tabs = useMemo(() => {
    const allTabs = [
      {
        id: 'home' as ModuleTab,
        label: 'Radar',
        icon: <Home size={16} />,
        count: tabCounts.home,
        color: 'bg-primary-500',
        requiresManagerAccess: false,
      },
      {
        id: 'ideas' as ModuleTab,
        label: isPolish ? 'Pomysły' : 'Ideas',
        icon: <Lightbulb size={16} />,
        count: tabCounts.ideas,
        color: 'bg-amber-500',
        requiresManagerAccess: false,
      },
      {
        id: 'notebook' as ModuleTab,
        label: isPolish ? 'Notatnik' : 'Notebook',
        icon: <FileText size={16} />,
        count: tabCounts.notebook,
        color: 'bg-slate-500',
        requiresManagerAccess: false,
      },
      {
        id: 'inbox' as ModuleTab,
        label: 'Inbox',
        icon: <Inbox size={16} />,
        count: tabCounts.inbox,
        color: 'bg-red-500',
        requiresManagerAccess: false,
      },
      {
        id: 'calendar' as ModuleTab,
        label: isPolish ? 'Kalendarz' : 'Calendar',
        icon: <Calendar size={16} />,
        count: tabCounts.calendar,
        color: 'bg-indigo-500',
        requiresManagerAccess: false,
      },
      {
        id: 'tasks' as ModuleTab,
        label: isPolish ? 'Zadania' : 'Tasks',
        icon: <CheckSquare size={16} />,
        count: tabCounts.tasks,
        color: 'bg-blue-500',
        requiresManagerAccess: false,
      },
      {
        id: 'decisions' as ModuleTab,
        label: isPolish ? 'Decyzje' : 'Decisions',
        icon: <Scale size={16} />,
        count: tabCounts.decisions,
        color: 'bg-purple-500',
        requiresManagerAccess: false,
      },
      {
        id: 'manager' as ModuleTab,
        label: 'Manager',
        icon: <Users size={16} />,
        count: tabCounts.manager,
        color: 'bg-violet-500',
        requiresManagerAccess: true,
      },
    ];

    return allTabs.filter((tab) => !tab.requiresManagerAccess || canViewManager);
  }, [isPolish, tabCounts, canViewManager]);

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
      {
        id: 'new' as TaskFilter,
        label: isPolish ? 'Nowe' : 'New',
        icon: <Inbox size={12} />,
        color: 'bg-emerald-500',
        count: taskFilterCounts.newUntriaged,
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
        label: isPolish ? 'Moje do decyzji' : 'My decisions to make',
        icon: <User size={12} />,
        color: 'bg-purple-500',
        count: decisionFilterCounts.my,
      },
      {
        id: 'awaiting' as DecisionFilter,
        label: isPolish ? 'Moje prośby (pending)' : 'My requests pending',
        icon: <Hourglass size={12} />,
        color: 'bg-amber-500',
        count: decisionFilterCounts.awaiting,
      },
    ],
    [isPolish, decisionFilterCounts, tabCounts.decisions]
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
    setShowStartupTemplates(true);
  }, []);

  const handleStartupTemplateSelect = useCallback(
    (seedIntent: IdeaWorkspaceSeedIntent) => {
      const newId = `new-idea-${Date.now()}`;
      const preferredSystem = normalizePreferredSystem(seedIntent.preferredSystem);
      if (preferredSystem) {
        setIdeaActiveTool(preferredSystem);
      }
      const body = composeIdeaBodyFromSeedIntent(seedIntent);
      const title = deriveIdeaTitleFromSeedIntent(
        seedIntent,
        isPolish ? 'Nowy pomysł' : 'New Idea'
      );
      handleOpenDocument({
        id: newId,
        type: 'idea',
        name: title,
        status: 'idea',
        data: {
          isNew: true,
          seedIntent,
          creationPayload: {
            title,
            body,
            tags: [],
            sourceType: 'manual',
          },
        },
      });
    },
    [handleOpenDocument, isPolish]
  );

  const handleIdeaClick = useCallback(
    (
      ideaId: string,
      ideaData?: MyIdea,
      options?: { openMap?: boolean; initialTool?: CanvasToolType }
    ) => {
      if (options?.initialTool) {
        setIdeaActiveTool(options.initialTool);
      }
      handleOpenDocument({
        id: ideaId,
        type: 'idea',
        name: ideaData?.title || (isPolish ? 'Pomysł' : 'Idea'),
        status: 'idea',
        data: {
          ...ideaData,
          openMap: options?.openMap ?? ideaData?.openMap,
          initialTool: options?.initialTool,
        },
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
      setRefreshTrigger((prev) => prev + 1);
    }
    // Optionally close after save
    // handleCloseDocument(docId);
  }, []);

  // Count update handlers
  const handleTaskCountsChange = useCallback(
    (counts: {
      total: number;
      overdue: number;
      today: number;
      week: number;
      urgent: number;
      newUntriaged?: number;
    }) => {
      setTabCounts((prev) => ({ ...prev, tasks: counts.total }));
      setTaskFilterCounts({
        overdue: counts.overdue,
        today: counts.today,
        week: counts.week,
        urgent: counts.urgent,
        newUntriaged: counts.newUntriaged ?? 0,
      });
    },
    []
  );

  const handleTasksBulkBarChange = useCallback(
    (
      payload: {
        selectedCount: number;
        selectAllVisible: () => void;
        clearSelection: () => void;
        complete: () => void;
        changePriority: () => void;
        changeDueDate: () => void;
        deleteSelected: () => void;
      } | null
    ) => {
      if (!payload) {
        setTasksBulkUi(null);
        tasksBulkActionsRef.current = null;
        return;
      }
      setTasksBulkUi({ selectedCount: payload.selectedCount });
      tasksBulkActionsRef.current = {
        selectAllVisible: payload.selectAllVisible,
        clearSelection: payload.clearSelection,
        complete: payload.complete,
        changePriority: payload.changePriority,
        changeDueDate: payload.changeDueDate,
        deleteSelected: payload.deleteSelected,
      };
    },
    []
  );

  useEffect(() => {
    if (activeTab !== 'tasks') {
      setTasksBulkUi(null);
      tasksBulkActionsRef.current = null;
    }
  }, [activeTab]);

  const handleDecisionsBulkBarChange = useCallback((payload: DecisionsBulkBarPayload) => {
    if (!payload) {
      setDecisionsBulkUi(null);
      decisionsBulkActionsRef.current = null;
      return;
    }
    setDecisionsBulkUi({
      selectedCount: payload.selectedCount,
      allSelected: payload.allSelected,
      someSelected: payload.someSelected,
    });
    decisionsBulkActionsRef.current = {
      selectAllVisible: payload.selectAllVisible,
      clearSelection: payload.clearSelection,
      approve: payload.approve,
      reject: payload.reject,
      deleteSelected: payload.deleteSelected,
      changePriority: payload.changePriority,
      remind: payload.remind,
      escalate: payload.escalate,
      snoozeTomorrow: payload.snoozeTomorrow,
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'decisions') {
      setDecisionsBulkUi(null);
      decisionsBulkActionsRef.current = null;
    }
  }, [activeTab]);

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

  const handleIdeaCountsChange = useCallback(
    (counts: {
      total: number;
      spark: number;
      incubating: number;
      shaping: number;
      ready: number;
      promoted: number;
    }) => {
      setTabCounts((prev) => ({ ...prev, ideas: counts.total }));
      setIdeasStageCounts(counts);
    },
    []
  );

  const handleIdeasBulkBarChange = useCallback((payload: IdeasBulkBarPayload | null) => {
    if (!payload) {
      setIdeasBulkUi(null);
      ideasBulkActionsRef.current = null;
      return;
    }
    setIdeasBulkUi({
      selectedCount: payload.selectedCount,
      allSelected: payload.allSelected,
      someSelected: payload.someSelected,
    });
    ideasBulkActionsRef.current = {
      selectAllVisible: payload.selectAllVisible,
      clearSelection: payload.clearSelection,
      convert: payload.convert,
      tag: payload.tag,
      deleteSelected: payload.deleteSelected,
    };
  }, []);

  const handleNotebookCountsChange = useCallback((counts: { total: number }) => {
    setTabCounts((prev) => ({ ...prev, notebook: counts.total }));
  }, []);

  const handleInboxCountsChange = useCallback((counts: InboxCounts) => {
    setTabCounts((prev) => ({ ...prev, inbox: counts.total }));
    setInboxCounts(counts);
  }, []);

  const applyInboxPreset = useCallback((next: InboxPreset) => {
    // Canon v3: "ALL" means no preset filters are active.
    setInboxPreset(next);
    setInboxStatusTab(next === 'saved' ? 'saved' : 'open');
    setInboxSection(next === 'today' ? 'today' : next === 'this_week' ? 'this_week' : 'all');
    setInboxActionRequiredOnly(next === 'action_required');
  }, []);

  const handleInboxBulkBarChange = useCallback((payload: InboxBulkBarPayload | null) => {
    if (!payload) {
      setInboxBulkUi(null);
      inboxBulkActionsRef.current = null;
      return;
    }
    setInboxBulkUi({
      selectedCount: payload.selectedCount,
      allSelected: payload.allSelected,
      someSelected: payload.someSelected,
    });
    inboxBulkActionsRef.current = {
      selectAllVisible: payload.selectAllVisible,
      clearSelection: payload.clearSelection,
      triage: payload.triage,
    };
  }, []);

  useEffect(() => {
    if (activeTab !== 'inbox') {
      setInboxBulkUi(null);
      inboxBulkActionsRef.current = null;
      setInboxPreset('all');
      setInboxStatusTab('open');
      setInboxSection('all');
      setInboxActionRequiredOnly(false);
    }
    if (activeTab !== 'ideas') {
      setIdeasBulkUi(null);
      ideasBulkActionsRef.current = null;
      setIdeaStageFilter('all');
    }
  }, [activeTab]);

  const handleHomeAction = useCallback(
    async (action: HomeScreenAction) => {
      switch (action.type) {
        case 'create':
          if (action.target === 'idea') {
            setActiveTab('ideas');
            handleCreateIdea();
            return;
          }
          if (action.target === 'note') {
            setActiveTab('notebook');
            setNotebookCreateReqId((value) => value + 1);
            return;
          }
          if (action.target === 'task') {
            setActiveTab('tasks');
            handleCreateTask();
            return;
          }
          if (action.target === 'decision') {
            setActiveTab('decisions');
            handleCreateDecision();
            return;
          }
          return;
        case 'navigate':
          if (action.target === 'outputs_all') {
            navigate('/presentations?tab=all');
            return;
          }
          if (action.target === 'outputs_mine') {
            navigate('/presentations?tab=mine');
            return;
          }
          if (action.target === 'outputs_review') {
            navigate('/presentations?tab=needs_review');
            return;
          }
          setActiveTab(action.target);
          return;
        case 'open':
          if (action.target === 'idea') {
            handleIdeaClick(action.id);
            return;
          }
          if (action.target === 'note') {
            setActiveTab('notebook');
            setNotebookOpenPageId(action.id);
            return;
          }
          if (action.target === 'task') {
            handleTaskClick(action.id);
            return;
          }
          if (action.target === 'decision') {
            handleDecisionClick(action.id);
            return;
          }
          if (action.target === 'report' || action.target === 'presentation') {
            navigate(getArtifactPath(action.target, action.id));
            return;
          }
          if (action.target === 'sheet') {
            void (async () => {
              const tableId = String(action.id);
              if (isEnabled('tablePlatformMetadataFirst')) {
                const ws = await resolveTablePlatformWorkspaceIdForTable(tableId);
                if (ws) {
                  navigate(buildMyWorkSheetTableOpenPath(ws, tableId));
                  return;
                }
              }
              const ok = await downloadSheetArtifactXlsx(tableId);
              if (ok) {
                toast.success(
                  isPolish ? 'Pobrano arkusz (.xlsx)' : 'Downloaded spreadsheet (.xlsx)'
                );
              } else {
                toast.error(
                  isPolish ? 'Nie udało się pobrać arkusza' : 'Could not download spreadsheet'
                );
              }
            })();
            return;
          }
          return;
        case 'chat': {
          const packet = action.packet;
          const entityType = packet.entityType || 'home';
          const entityId = packet.entityId || `home-${packet.sourceBlock}`;

          await openChatWithContext({
            entityType,
            entityId,
            entityName: packet.entityName || packet.title,
            contextData: {
              sourceBlock: packet.sourceBlock,
              intent: packet.intent,
              title: packet.title,
              ...(packet.contextData || {}),
            },
            pmoContext:
              entityType === 'task'
                ? { taskId: entityId }
                : entityType === 'decision'
                  ? { decisionId: entityId }
                  : undefined,
          });

          setChatKickoffMessage(packet.starterPrompt);
          return;
        }
        default:
          return;
      }
    },
    [
      handleCreateDecision,
      handleCreateIdea,
      handleCreateTask,
      handleDecisionClick,
      handleIdeaClick,
      handleTaskClick,
      isEnabled,
      isPolish,
      navigate,
      openChatWithContext,
      setChatKickoffMessage,
    ]
  );

  // Get action button config based on active tab
  const actionButton = useMemo(() => {
    // Don't show action button when viewing a document
    if (activeDocumentId) return null;

    switch (activeTab) {
      case 'home':
      case 'manager':
      case 'inbox':
        return null;
      case 'calendar':
        return {
          label: isPolish ? 'Dodaj wydarzenie' : 'Add event',
          icon: <Plus size={16} />,
          onClick: () => setCalendarCreateReqId((v) => v + 1),
          color: 'from-violet-500 to-purple-600',
          variant: 'primary' as const,
        };
      case 'tasks':
        return {
          label: isPolish ? 'Nowe zadanie' : 'New Task',
          icon: <Plus size={16} />,
          onClick: handleCreateTask,
          // v3 identity map: Task = emerald
          color: 'from-emerald-500 to-emerald-600',
          variant: 'primary' as const,
        };
      case 'ideas':
        return {
          label: isPolish ? 'Nowy pomysł' : 'New Idea',
          icon: <Plus size={16} />,
          onClick: handleCreateIdea,
          // v3 identity map: Idea = violet
          color: 'from-violet-500 to-violet-600',
          variant: 'primary' as const,
        };
      case 'decisions':
        return {
          label: isPolish ? 'Nowa decyzja' : 'New Decision',
          icon: <Plus size={16} />,
          onClick: handleCreateDecision,
          // v3 identity map: Decision = amber
          color: 'from-amber-500 to-amber-600',
          variant: 'primary' as const,
        };
      case 'notebook':
        return {
          label: isPolish ? 'Nowa notatka' : 'New note',
          icon: <Plus size={16} />,
          onClick: () => setNotebookCreateReqId((v) => v + 1),
          // v3 identity map: Notebook page = indigo
          color: 'from-indigo-500 to-indigo-600',
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
    setCalendarCreateReqId,
    activeDocumentId,
  ]);

  // Get current filters based on active tab
  const currentFilters = useMemo((): Array<{ id: string; label: string; count?: number }> => {
    if (activeDocumentId) return []; // Hide filters when viewing document
    switch (activeTab) {
      case 'tasks':
        // KANON v3 (MyWork): filters live in Command Row (chips), not as extra dropdown in topbar.
        return [];
      case 'decisions':
        // KANON v3 (MyWork): decision "All/My/Awaiting" lives in Command Row; topbar keeps only ONE select (priority).
        return [];
      case 'home':
      case 'calendar':
      case 'manager':
      case 'inbox':
      default:
        return [];
    }
  }, [activeTab, activeDocumentId]);

  // Get current filter value
  const currentFilterValue = useMemo(() => {
    switch (activeTab) {
      case 'tasks':
        return taskFilter;
      case 'decisions':
        return decisionFilter;
      default:
        return 'all';
    }
  }, [activeTab, taskFilter, decisionFilter]);

  // KANON v3: view modes are icon toggles (no dropdown lists), so we don't need label resolvers.

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
      }
    },
    [activeTab]
  );

  // Render Dynamic Tabs
  const renderDynamicTabs = () => {
    if (openDocuments.length === 0) return null;

    const isListActive = activeDocumentId === null;

    return (
      <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto min-w-0 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
        {/* List button */}
        <button
          onClick={handleShowList}
          className={
            isListActive
              ? TAB_ACTIVE.replace('border-l-2', '')
              : TAB_INACTIVE.replace('border-l-2', '')
          }
          style={{ flexShrink: 0 }}
        >
          <List size={14} />
          <span>{isPolish ? 'Lista' : 'List'}</span>
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-200 dark:bg-navy-600 shrink-0" />

        {/* Document Tabs */}
        {openDocuments.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          const leftBorderColor = TYPE_COLORS[doc.type];
          const statusColor = STATUS_COLORS[doc.status] || 'bg-slate-400';

          return (
            <div
              key={doc.id}
              className={`group shrink-0 ${isActive ? TAB_ACTIVE : TAB_INACTIVE} ${leftBorderColor}`}
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
                className="p-1 rounded-md opacity-0 group-hover:opacity-100 text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.06] transition-all"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    );
  };

  const renderCommandRow = () => {
    // V3-A03 MUST: single command row under topbar
    // Priority (MUST): Bulk (multi-select) > Search > Dynamic Tabs > Counters
    const hasBulkMode =
      !activeDocumentId &&
      ((activeTab === 'tasks' && !!tasksBulkUi?.selectedCount) ||
        (activeTab === 'inbox' && !!inboxBulkUi?.selectedCount) ||
        (activeTab === 'decisions' && !!decisionsBulkUi?.selectedCount) ||
        (activeTab === 'ideas' && !!ideasBulkUi?.selectedCount));

    // 1) Search row (when enabled)
    if (!hasBulkMode && showSearch && !activeDocumentId) {
      return (
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
                      : activeTab === 'notebook'
                        ? isPolish
                          ? 'Szukaj notatek...'
                          : 'Search notes...'
                        : isPolish
                          ? 'Szukaj w Inbox...'
                          : 'Search inbox...'
              }
              autoFocus
              className="w-full pl-10 pr-10 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-900 dark:text-white placeholder:text-slate-500 dark:text-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
            />
            {searchQuery && (
              <button
                onClick={handleCloseSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.06]"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      );
    }

    // 2) Dynamic tabs row (when documents open)
    if (!hasBulkMode && openDocuments.length > 0) {
      return renderDynamicTabs();
    }

    // 3) Context counters row (list view default)
    if (activeDocumentId) return null;

    // Tasks: filters as a single Command Row (no extra toolbars/strips).
    if (activeTab === 'tasks') {
      const chipBase =
        'inline-flex items-center gap-1.5 h-8 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
      const chipInactive =
        'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]';
      const chipActive =
        'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-200';

      // V3-A03: bulk selection is a *mode* of the same command row (no extra line).
      if (tasksBulkUi?.selectedCount) {
        const bulk = tasksBulkActionsRef.current;
        const bulkGhostPill =
          'inline-flex items-center h-8 px-2.5 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
        const bulkPillBase =
          'inline-flex items-center gap-2 h-8 px-2.5 rounded-full border text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';

        return (
          <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {tasksBulkUi.selectedCount} {isPolish ? 'zaznaczonych' : 'selected'}
                </span>
                <button onClick={() => bulk?.selectAllVisible()} className={bulkGhostPill}>
                  {isPolish ? 'Zaznacz wszystkie' : 'Select all'}
                </button>
                <button onClick={() => bulk?.clearSelection()} className={bulkGhostPill}>
                  {isPolish ? 'Odznacz' : 'Clear'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulk?.changePriority()}
                  className={`${bulkPillBase} ${chipInactive}`}
                >
                  <Flag size={14} />
                  {isPolish ? 'Priorytet' : 'Priority'}
                </button>
                <button
                  onClick={() => bulk?.changeDueDate()}
                  className={`${bulkPillBase} ${chipInactive}`}
                >
                  <Calendar size={14} />
                  {isPolish ? 'Termin' : 'Due date'}
                </button>
                <button
                  onClick={() => bulk?.complete()}
                  className={`${bulkPillBase} border-green-300/40 dark:border-green-500/20 bg-white/70 dark:bg-white/[0.04] text-green-700 dark:text-green-300 hover:bg-green-50/60 dark:hover:bg-green-500/10`}
                >
                  <CheckSquare size={14} />
                  {isPolish ? 'Gotowe' : 'Done'}
                </button>
                <button
                  onClick={() => bulk?.deleteSelected()}
                  className={`${bulkPillBase} border-red-300/40 dark:border-red-500/20 bg-white/70 dark:bg-white/[0.04] text-red-700 dark:text-red-300 hover:bg-red-50/60 dark:hover:bg-red-500/10`}
                >
                  <Trash2 size={14} />
                  {isPolish ? 'Usuń' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            <div className="inline-flex items-center gap-1">
              {taskFilters.map((f) => {
                const isActive = taskFilter === f.id;
                const count =
                  f.id === 'all' ? tabCounts.tasks : typeof f.count === 'number' ? f.count : 0;
                return (
                  <button
                    key={f.id}
                    onClick={() => setTaskFilter(f.id)}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                    title={f.label}
                  >
                    {f.icon}
                    <span>{f.label}</span>
                    <span className="rounded-full bg-slate-200 dark:bg-navy-700 px-2 py-0.5 text-[11px] text-slate-700 dark:text-slate-200">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Inbox: render all controls as a single Command Row (SSOT: module-hub + app-table).
    if (activeTab === 'inbox') {
      const c = inboxCounts;
      const presets: Array<{
        id: InboxPreset;
        label: string;
        count: number;
      }> = [
        {
          id: 'all',
          label: isPolish ? 'Wszystkie' : 'ALL',
          count: c?.counts.open ?? tabCounts.inbox,
        },
        { id: 'overdue', label: isPolish ? 'Zaległe' : 'Overdue', count: c?.overdue ?? 0 },
        { id: 'saved', label: isPolish ? 'Zapisane' : 'Saved', count: c?.counts.saved ?? 0 },
        { id: 'ai', label: isPolish ? 'AI' : 'AI', count: c?.ai ?? 0 },
        { id: 'critical', label: isPolish ? 'Krytyczne' : 'Critical', count: c?.critical ?? 0 },
        {
          id: 'action_required',
          label: isPolish ? 'Wymaga akcji' : 'Action required',
          count: c?.actionRequired ?? 0,
        },
        { id: 'today', label: isPolish ? 'Dziś' : 'Today', count: c?.newToday ?? 0 },
        {
          id: 'this_week',
          label: isPolish ? 'Ten tydz.' : 'This week',
          count: c?.newThisWeek ?? 0,
        },
      ];

      const chipBase =
        'inline-flex items-center gap-1.5 h-8 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
      const chipInactive =
        'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]';
      const chipActive =
        'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-200';

      // V3-A03: bulk selection is a *mode* of the same command row (no extra line).
      if (inboxBulkUi?.selectedCount) {
        const bulkActions = inboxBulkActionsRef.current;
        const bulkGhostPill =
          'inline-flex items-center h-8 px-2.5 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
        const bulkPillBase =
          'inline-flex items-center gap-2 h-8 px-2.5 rounded-full border text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';

        return (
          <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {inboxBulkUi.selectedCount} {isPolish ? 'zaznaczonych' : 'selected'}
                </span>
                <button onClick={() => bulkActions?.selectAllVisible()} className={bulkGhostPill}>
                  {isPolish ? 'Zaznacz wszystkie' : 'Select all'}
                </button>
                <button onClick={() => bulkActions?.clearSelection()} className={bulkGhostPill}>
                  {isPolish ? 'Odznacz' : 'Clear'}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulkActions?.triage('accept_today')}
                  className={`${bulkPillBase} border-emerald-300/40 dark:border-emerald-500/20 bg-white/70 dark:bg-white/[0.04] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-500/10`}
                >
                  <Zap size={14} />
                  {isPolish ? 'Focus: Dziś' : 'Focus: Today'}
                </button>
                <button
                  onClick={() => bulkActions?.triage('accept_week')}
                  className={`${bulkPillBase} border-blue-300/40 dark:border-blue-500/20 bg-white/70 dark:bg-white/[0.04] text-blue-700 dark:text-blue-300 hover:bg-blue-50/60 dark:hover:bg-blue-500/10`}
                >
                  <CalendarClock size={14} />
                  {isPolish ? 'Ten tydz.' : 'This week'}
                </button>
                <button
                  onClick={() => bulkActions?.triage('done')}
                  className={`${bulkPillBase} border-green-300/40 dark:border-green-500/20 bg-white/70 dark:bg-white/[0.04] text-green-700 dark:text-green-300 hover:bg-green-50/60 dark:hover:bg-green-500/10`}
                >
                  <CheckSquare size={14} />
                  {isPolish ? 'Gotowe' : 'Done'}
                </button>
                <button
                  onClick={() => bulkActions?.triage('save')}
                  className={`${bulkPillBase} border-amber-300/40 dark:border-amber-500/20 bg-white/70 dark:bg-white/[0.04] text-amber-800 dark:text-amber-300 hover:bg-amber-50/60 dark:hover:bg-amber-500/10`}
                >
                  <FileText size={14} />
                  {isPolish ? 'Zapisz' : 'Save'}
                </button>
                <button
                  onClick={() => bulkActions?.triage('dismiss')}
                  className={`${bulkPillBase} ${chipInactive}`}
                >
                  <X size={14} />
                  {isPolish ? 'Odłóż' : 'Dismiss'}
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            {presets.map((p) => {
              const isActive = inboxPreset === p.id;
              const disabled = p.id !== 'all' && p.count === 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => applyInboxPreset(isActive ? 'all' : p.id)}
                  className={`${chipBase} ${isActive ? chipActive : chipInactive} ${
                    disabled ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                >
                  <span>{p.label}</span>
                  <span className="rounded-full bg-slate-200 dark:bg-navy-700 px-2 py-0.5 text-[10px] text-slate-700 dark:text-slate-200">
                    {p.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    // Decisions: filters live in Command Row (chips). Topbar keeps only ONE select (priority).
    if (activeTab === 'decisions' && !activeDocumentId && !decisionsBulkUi?.selectedCount) {
      const chipBase =
        'inline-flex items-center gap-1.5 h-8 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
      const chipInactive =
        'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]';
      const chipActive =
        'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-200';

      return (
        <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            <div className="inline-flex items-center gap-1">
              {decisionFilters.map((f) => {
                const isActive = decisionFilter === f.id;
                const count =
                  f.id === 'all' ? tabCounts.decisions : typeof f.count === 'number' ? f.count : 0;
                return (
                  <button
                    key={f.id}
                    onClick={() => setDecisionFilter(f.id as DecisionFilter)}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                    title={f.label}
                    data-testid={`mywork-decisions-filter-${f.id}`}
                  >
                    {f.icon}
                    <span>{f.label}</span>
                    <span className="rounded-full bg-slate-200 dark:bg-navy-700 px-2 py-0.5 text-[10px] text-slate-700 dark:text-slate-200">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Decisions: bulk selection is a *mode* of the same command row (no extra line).
    if (activeTab === 'decisions' && decisionsBulkUi?.selectedCount) {
      const bulk = decisionsBulkActionsRef.current;
      const bulkGhostPill =
        'inline-flex items-center h-8 px-2.5 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
      const bulkPillBase =
        'inline-flex items-center gap-2 h-8 px-2.5 rounded-full border text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
      const chipInactive =
        'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]';

      return (
        <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {decisionsBulkUi.selectedCount} {isPolish ? 'zaznaczonych' : 'selected'}
              </span>
              <button onClick={() => bulk?.selectAllVisible()} className={bulkGhostPill}>
                {isPolish ? 'Zaznacz wszystkie' : 'Select all'}
              </button>
              <button onClick={() => bulk?.clearSelection()} className={bulkGhostPill}>
                {isPolish ? 'Odznacz' : 'Clear'}
              </button>
            </div>

            <div className="flex items-center gap-2">
              {bulk?.approve ? (
                <button
                  onClick={() => bulk?.approve?.()}
                  className={`${bulkPillBase} border-emerald-300/40 dark:border-emerald-500/20 bg-white/70 dark:bg-white/[0.04] text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50/60 dark:hover:bg-emerald-500/10`}
                >
                  <Check size={14} />
                  {isPolish ? 'Przyjęta' : 'Approve'}
                </button>
              ) : null}
              {bulk?.reject ? (
                <button
                  onClick={() => bulk?.reject?.()}
                  className={`${bulkPillBase} border-red-300/40 dark:border-red-500/20 bg-white/70 dark:bg-white/[0.04] text-red-700 dark:text-red-300 hover:bg-red-50/60 dark:hover:bg-red-500/10`}
                >
                  <X size={14} />
                  {isPolish ? 'Odrzuć' : 'Reject'}
                </button>
              ) : null}
              {bulk?.remind ? (
                <button
                  onClick={() => bulk?.remind?.()}
                  className={`${bulkPillBase} ${chipInactive}`}
                >
                  <Bell size={14} />
                  {isPolish ? 'Przypomnij' : 'Remind'}
                </button>
              ) : null}
              {bulk?.escalate ? (
                <button
                  onClick={() => bulk?.escalate?.()}
                  className={`${bulkPillBase} border-amber-300/40 dark:border-amber-500/20 bg-white/70 dark:bg-white/[0.04] text-amber-800 dark:text-amber-300 hover:bg-amber-50/60 dark:hover:bg-amber-500/10`}
                >
                  <TrendingUp size={14} />
                  {isPolish ? 'Eskaluj' : 'Escalate'}
                </button>
              ) : null}
              {bulk?.snoozeTomorrow ? (
                <button
                  onClick={() => bulk?.snoozeTomorrow?.()}
                  className={`${bulkPillBase} ${chipInactive}`}
                >
                  <Clock size={14} />
                  {isPolish ? 'Odłóż (jutro)' : 'Snooze (tomorrow)'}
                </button>
              ) : null}
              {bulk?.changePriority ? (
                <button
                  onClick={() => bulk?.changePriority?.()}
                  className={`${bulkPillBase} ${chipInactive}`}
                >
                  <Flag size={14} />
                  {isPolish ? 'Priorytet' : 'Priority'}
                </button>
              ) : null}
              {bulk?.deleteSelected ? (
                <button
                  onClick={() => bulk?.deleteSelected?.()}
                  className={`${bulkPillBase} border-red-300/40 dark:border-red-500/20 bg-white/70 dark:bg-white/[0.04] text-red-700 dark:text-red-300 hover:bg-red-50/60 dark:hover:bg-red-500/10`}
                >
                  <Trash2 size={14} />
                  {isPolish ? 'Usuń' : 'Delete'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    // Home and Calendar tabs have no command row (content is self-contained)
    if (activeTab === 'home' || activeTab === 'calendar' || activeTab === 'manager') {
      return null;
    }

    // Ideas: stage presets in Command Row (same pattern as Inbox/Tasks)
    if (activeTab === 'ideas' && !activeDocumentId) {
      const chipBase =
        'inline-flex items-center gap-1.5 h-8 rounded-full border px-2.5 text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
      const chipInactive =
        'border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]';
      const chipActive =
        'border-purple-500/40 bg-purple-500/10 text-purple-700 dark:text-purple-200';

      if (ideasBulkUi?.selectedCount) {
        const bulk = ideasBulkActionsRef.current;
        const bulkGhostPill =
          'inline-flex items-center h-8 px-2.5 rounded-full text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-white/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
        const bulkPillBase =
          'inline-flex items-center gap-2 h-8 px-2.5 rounded-full border text-[11px] font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';

        return (
          <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
            <div className="flex items-center justify-between gap-3 overflow-x-auto whitespace-nowrap">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {ideasBulkUi.selectedCount} {isPolish ? 'zaznaczonych' : 'selected'}
                </span>
                <button onClick={() => bulk?.selectAllVisible()} className={bulkGhostPill}>
                  {isPolish ? 'Zaznacz wszystkie' : 'Select all'}
                </button>
                <button onClick={() => bulk?.clearSelection()} className={bulkGhostPill}>
                  {isPolish ? 'Odznacz' : 'Clear'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => bulk?.convert()}
                  className={`${bulkPillBase} ${chipInactive}`}
                >
                  <Sparkles size={14} />
                  {isPolish ? 'Konwertuj' : 'Convert'}
                </button>
                <button onClick={() => bulk?.tag()} className={`${bulkPillBase} ${chipInactive}`}>
                  <Tag size={14} />
                  {isPolish ? 'Taguj' : 'Tag'}
                </button>
                <button
                  onClick={() => bulk?.deleteSelected()}
                  className={`${bulkPillBase} border-red-300/40 dark:border-red-500/20 bg-white/70 dark:bg-white/[0.04] text-red-700 dark:text-red-300 hover:bg-red-50/60 dark:hover:bg-red-500/10`}
                >
                  <Trash2 size={14} />
                  {isPolish ? 'Usuń' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        );
      }

      const stagePresets: Array<{
        id: IdeaStage | 'all';
        label: string;
        icon: React.ReactNode;
        count: number;
      }> = [
        {
          id: 'all',
          label: isPolish ? 'Wszystkie' : 'ALL',
          icon: null,
          count: ideasStageCounts.total,
        },
        {
          id: 'spark',
          label: isPolish ? 'Iskra' : 'Spark',
          icon: <Lightbulb size={14} />,
          count: ideasStageCounts.spark,
        },
        {
          id: 'incubating',
          label: isPolish ? 'Rośnie' : 'Growing',
          icon: <Sprout size={14} />,
          count: ideasStageCounts.incubating,
        },
        {
          id: 'shaping',
          label: isPolish ? 'Kształtuje' : 'Shaping',
          icon: <TreePine size={14} />,
          count: ideasStageCounts.shaping,
        },
        {
          id: 'ready',
          label: isPolish ? 'Gotowy' : 'Ready',
          icon: <CheckCircle2 size={14} />,
          count: ideasStageCounts.ready,
        },
        {
          id: 'promoted',
          label: isPolish ? 'Promowany' : 'Promoted',
          icon: <Rocket size={14} />,
          count: ideasStageCounts.promoted,
        },
      ];

      return (
        <div className="px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
          <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap">
            <div className="inline-flex items-center gap-1">
              {stagePresets.map((p) => {
                const isActive = ideaStageFilter === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setIdeaStageFilter(isActive && p.id !== 'all' ? 'all' : p.id)}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                  >
                    {p.icon}
                    <span>{p.label}</span>
                    <span className="rounded-full bg-slate-200 dark:bg-navy-700 px-2 py-0.5 text-[10px] text-slate-700 dark:text-slate-200">
                      {p.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Default cross-tab alerts (tasks/decisions/inbox)
    const chips: Array<{ key: string; label: string; count: number; onClick: () => void }> = [
      {
        key: 'tasks-overdue',
        label: isPolish ? 'Zaległe' : 'Overdue',
        count: taskFilterCounts.overdue,
        onClick: () => {
          setActiveTab('tasks');
          setTaskFilter('overdue');
          setActiveDocumentId(null);
        },
      },
      {
        key: 'tasks-urgent',
        label: isPolish ? 'Pilne' : 'Urgent',
        count: taskFilterCounts.urgent,
        onClick: () => {
          setActiveTab('tasks');
          setTaskFilter('urgent');
          setActiveDocumentId(null);
        },
      },
      {
        key: 'decisions-pending',
        label: isPolish ? 'Decyzje (pending)' : 'Decisions (pending)',
        count: decisionFilterCounts.my + decisionFilterCounts.awaiting,
        onClick: () => {
          setActiveTab('decisions');
          setDecisionFilter('my');
          setActiveDocumentId(null);
        },
      },
      {
        key: 'inbox',
        label: isPolish ? 'Inbox' : 'Inbox',
        count: tabCounts.inbox,
        onClick: () => {
          setActiveTab('inbox');
          setActiveDocumentId(null);
        },
      },
    ];

    const visible = chips.filter((c2) => c2.count > 0).slice(0, 4);
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
        {visible.length > 0 ? (
          visible.map((c2) => (
            <button
              key={c2.key}
              onClick={c2.onClick}
              className="inline-flex items-center gap-1.5 h-8 rounded-full border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] px-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            >
              <span>{c2.label}</span>
              <span className="rounded-full bg-slate-200 dark:bg-navy-700 px-2 py-0.5 text-[10px] text-slate-700 dark:text-slate-200">
                {c2.count}
              </span>
            </button>
          ))
        ) : (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {isPolish ? 'Brak alertów' : 'No alerts'}
          </div>
        )}
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
            <IdeaMapWorkspace
              key={`idea-workspace-${activeDoc.id}`}
              ideaId={activeDoc.id}
              initialOpenMap={Boolean((activeDoc as any)?.data?.openMap)}
              initialTool={(activeDoc as any)?.data?.initialTool}
              creationPayload={(activeDoc as any)?.data?.creationPayload}
              seedIntent={(activeDoc as any)?.data?.seedIntent}
              onClose={() => handleCloseDocument(activeDoc.id)}
              onSaved={(data) => handleDocumentSaved(activeDoc.id, data)}
              activeTool={ideaActiveTool}
              onActiveToolChange={setIdeaActiveTool}
              activePanel={ideaActivePanel}
              onActivePanelChange={handleIdeaPanelChange}
              onSelectionChange={setIdeaSelection}
              onLockedChange={setIdeaLocked}
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
      case 'home':
        return (
          <React.Suspense fallback={lazyFallback}>
            <HomeView
              userName={currentUser?.firstName}
              refreshTrigger={refreshTrigger}
              onAction={handleHomeAction}
            />
          </React.Suspense>
        );
      case 'manager':
        if (!canViewManager) {
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
              onNavigate={(section, options) => {
                if (section === 'tasks') {
                  setActiveTab('tasks');
                  if (options?.filter) setTaskFilter(options.filter as TaskFilter);
                }
                if (section === 'decisions') {
                  setActiveTab('decisions');
                  if (options?.filter === 'pending') setDecisionFilter('my');
                }
                if (section === 'focus') setActiveTab('home');
                if (section === 'inbox') setActiveTab('inbox');
              }}
              refreshTrigger={refreshTrigger}
            />
          </React.Suspense>
        );
      case 'calendar':
        return (
          <React.Suspense fallback={lazyFallback}>
            <CalendarView
              refreshTrigger={refreshTrigger}
              createRequestId={calendarCreateReqId}
              onTaskClick={handleTaskClick}
              onDecisionClick={handleDecisionClick}
              onInitiativeClick={(initiativeId) => {
                navigate(getArtifactPath('initiative', String(initiativeId)));
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
            onBulkBarChange={handleInboxBulkBarChange}
            refreshTrigger={refreshTrigger}
            viewMode={inboxViewMode}
            onViewModeChange={setInboxViewMode}
            statusTab={inboxStatusTab}
            onStatusTabChange={setInboxStatusTab}
            inboxSection={inboxSection}
            onInboxSectionChange={setInboxSection}
            actionRequiredOnly={inboxActionRequiredOnly}
            onActionRequiredOnlyChange={setInboxActionRequiredOnly}
            criticalOnly={inboxPreset === 'critical'}
            overdueOnly={inboxPreset === 'overdue'}
            aiOnly={inboxPreset === 'ai'}
          />
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
              refreshTrigger={refreshTrigger}
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
              refreshTrigger={refreshTrigger}
            />
          </React.Suspense>
        ) : (
          <MyTasksListContent
            activeFilter={taskFilter}
            searchQuery={searchQuery}
            onTaskClick={handleTaskClick}
            onCreateTask={handleCreateTask}
            onCountsChange={handleTaskCountsChange}
            onBulkBarChange={handleTasksBulkBarChange}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'ideas':
        return (
          <MyIdeasListContent
            viewMode={ideasViewMode}
            searchQuery={searchQuery}
            stageFilter={ideaStageFilter}
            onIdeaClick={handleIdeaClick}
            onCreateIdea={handleCreateIdea}
            onCountsChange={handleIdeaCountsChange}
            onBulkBarChange={handleIdeasBulkBarChange}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'notebook':
        return (
          <React.Suspense fallback={lazyFallback}>
            <NotebookContent
              projectId={null}
              searchQuery={searchQuery}
              openPageId={notebookOpenPageId}
              linkedIdeasOpen={notebookLinkedIdeasOpen}
              onLinkedIdeasOpenChange={(v) => {
                setNotebookLinkedIdeasOpen(v);
                if (v) {
                  setNotebookTopicsOpen(false);
                  setNotebookChatOpen(false);
                }
              }}
              topicsOpen={notebookTopicsOpen}
              onTopicsOpenChange={(v) => {
                setNotebookTopicsOpen(v);
                if (v) {
                  setNotebookLinkedIdeasOpen(false);
                  setNotebookChatOpen(false);
                }
              }}
              chatOpen={notebookChatOpen}
              onChatOpenChange={(v) => {
                setNotebookChatOpen(v);
                if (v) {
                  setNotebookLinkedIdeasOpen(false);
                  setNotebookTopicsOpen(false);
                }
              }}
              createPageRequestId={notebookCreateReqId}
              onCountsChange={handleNotebookCountsChange}
              refreshTrigger={refreshTrigger}
            />
          </React.Suspense>
        );
      case 'decisions':
        if (decisionsViewMode === 'timeline') {
          return (
            <React.Suspense fallback={lazyFallback}>
              <DecisionsTimelineContainer
                viewMode={decisionFilter}
                searchQuery={searchQuery}
                onDecisionClick={handleDecisionClick}
                onCountsChange={handleDecisionCountsChange}
                refreshTrigger={refreshTrigger}
              />
            </React.Suspense>
          );
        }
        if (decisionsViewMode === 'kanban') {
          return (
            <React.Suspense fallback={lazyFallback}>
              <DecisionsKanbanBoard
                viewMode={decisionFilter}
                priorityFilter={decisionPriorityFilter}
                searchQuery={searchQuery}
                onDecisionClick={handleDecisionClick}
                onCreateDecision={handleCreateDecision}
                onCountsChange={handleDecisionCountsChange}
                refreshTrigger={refreshTrigger}
              />
            </React.Suspense>
          );
        }
        return (
          <DecisionsPanelContent
            viewMode={decisionFilter}
            priorityFilter={decisionPriorityFilter}
            searchQuery={searchQuery}
            onDecisionClick={handleDecisionClick}
            onCountsChange={handleDecisionCountsChange}
            onBulkBarChange={handleDecisionsBulkBarChange}
            refreshTrigger={refreshTrigger}
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
      setNotebookTopicsOpen(false);
      setNotebookChatOpen(false);
    }
  }, [activeTab]);

  // Focus tools should not leak across tabs (legacy — kept for FocusView if reused)
  useEffect(() => {
    if (activeTab !== 'home') {
      setFocusShowAIPlan(false);
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950">
      {/* Navigation Bar (Golden Standard - same as InterviewHub) */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        {/* Main Navigation Row */}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          {/* Left: Search + Main Tabs */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-full border transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                showSearch
                  ? 'bg-primary-50 dark:bg-primary-500/10 border-primary-200 dark:border-primary-500/30 text-primary-700 dark:text-primary-200'
                  : 'bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
              }`}
              title={isPolish ? 'Szukaj' : 'Search'}
            >
              <Search size={18} />
            </button>

            {/* Main Tabs */}
            <div className="flex items-center gap-2 min-w-0 overflow-x-auto whitespace-nowrap">
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
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right cluster (KANON v3, left→right): Filters → View → Tool → Add → Area */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
            {/* Scrollable controls (keep primary action always visible) */}
            <div className="flex items-center gap-3 min-w-0 overflow-x-auto whitespace-nowrap">
              {/* Filters (furthest left in right cluster) */}
              {/* Context-sensitive Filter Dropdown (only show when viewing list) */}
              {currentFilters.length > 0 && (
                <div className="relative">
                  <select
                    value={currentFilterValue}
                    onChange={(e) => handleFilterChange(e.target.value)}
                    className="
                    appearance-none h-9 pl-3 pr-9 rounded-full text-xs font-medium
                    bg-white/70 dark:bg-white/[0.04]
                    border border-slate-200/70 dark:border-white/[0.06]
                    text-slate-700 dark:text-slate-200
                    hover:bg-slate-100/70 dark:hover:bg-white/[0.06]
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
                    appearance-none h-9 pl-3 pr-9 rounded-full text-xs font-medium
                    bg-white/70 dark:bg-white/[0.04]
                    border border-slate-200/70 dark:border-white/[0.06]
                    text-slate-700 dark:text-slate-200
                    hover:bg-slate-100/70 dark:hover:bg-white/[0.06]
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
                    <option value="LOW">{isPolish ? 'Priorytet: niski' : 'Priority: low'}</option>
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none"
                  />
                </div>
              )}

              {/* View tools */}
              {/* Tasks View Mode Toggle (icons; no dropdown) */}
              {activeTab === 'tasks' && !activeDocumentId && (
                <div
                  className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
                  role="radiogroup"
                  aria-label={isPolish ? 'Tryb widoku zadań' : 'Tasks view mode'}
                >
                  {(
                    [
                      {
                        id: 'table' as TasksViewMode,
                        icon: LayoutList,
                        titlePl: 'Lista',
                        titleEn: 'List',
                      },
                      {
                        id: 'kanban' as TasksViewMode,
                        icon: Kanban,
                        titlePl: 'Kanban',
                        titleEn: 'Kanban',
                      },
                      {
                        id: 'calendar' as TasksViewMode,
                        icon: CalendarDays,
                        titlePl: 'Kalendarz',
                        titleEn: 'Calendar',
                      },
                    ] as const
                  ).map(({ id, icon: Icon, titlePl, titleEn }) => {
                    const isActive = tasksViewMode === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setTasksViewMode(id)}
                        className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                          isActive
                            ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'
                        }`}
                        title={isPolish ? titlePl : titleEn}
                        role="radio"
                        aria-checked={isActive}
                        data-testid={`mywork-tasks-view-${id}`}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Decisions View Mode Toggle (icons; no dropdown) */}
              {activeTab === 'decisions' && !activeDocumentId && (
                <div
                  className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
                  role="radiogroup"
                  aria-label={isPolish ? 'Tryb widoku decyzji' : 'Decisions view mode'}
                >
                  {(
                    [
                      {
                        id: 'table' as DecisionsViewMode,
                        icon: LayoutList,
                        titlePl: 'Lista',
                        titleEn: 'List',
                      },
                      {
                        id: 'kanban' as DecisionsViewMode,
                        icon: Kanban,
                        titlePl: 'Kanban',
                        titleEn: 'Kanban',
                      },
                      {
                        id: 'timeline' as DecisionsViewMode,
                        icon: GanttChart,
                        titlePl: 'Timeline',
                        titleEn: 'Timeline',
                      },
                    ] as const
                  ).map(({ id, icon: Icon, titlePl, titleEn }) => {
                    const isActive = decisionsViewMode === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setDecisionsViewMode(id)}
                        className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                          isActive
                            ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
                            : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'
                        }`}
                        title={isPolish ? titlePl : titleEn}
                        role="radio"
                        aria-checked={isActive}
                        data-testid={`mywork-decisions-view-${id}`}
                      >
                        <Icon size={16} />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Inbox View Mode Toggle (list / cards) — match screenshot (pill container + dark bg) */}
              {activeTab === 'inbox' && !activeDocumentId && (
                <div
                  className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
                  role="radiogroup"
                  aria-label={isPolish ? 'Tryb widoku' : 'View mode'}
                >
                  <button
                    onClick={() => setInboxViewMode('flat')}
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                      inboxViewMode === 'flat'
                        ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'
                    }`}
                    title={isPolish ? 'Lista' : 'List'}
                    role="radio"
                    aria-checked={inboxViewMode === 'flat'}
                  >
                    <LayoutList size={16} />
                  </button>
                  <button
                    onClick={() => setInboxViewMode('sections')}
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                      inboxViewMode === 'sections'
                        ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'
                    }`}
                    title={isPolish ? 'Karty' : 'Cards'}
                    role="radio"
                    aria-checked={inboxViewMode === 'sections'}
                  >
                    <LayoutGrid size={16} />
                  </button>
                </div>
              )}

              {/* Tools */}

              {/* Ideas workspace — panel strip (block 2: Tools / Context / AI) */}
              {activeTab === 'ideas' && activeDocumentId && (
                <WorkspacePanelStrip value={ideaActivePanel} onChange={handleIdeaPanelChange} />
              )}

              {/* Ideas: canonical view mode switcher — table / grid */}
              {activeTab === 'ideas' && !activeDocumentId && (
                <div
                  className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
                  role="radiogroup"
                  aria-label={isPolish ? 'Tryb widoku pomyslow' : 'Ideas view mode'}
                >
                  {(
                    [
                      {
                        id: 'table' as IdeasViewMode,
                        icon: LayoutList,
                        label: 'Table',
                        labelPl: 'Tabela',
                      },
                      {
                        id: 'grid' as IdeasViewMode,
                        icon: LayoutGrid,
                        label: 'Grid',
                        labelPl: 'Siatka',
                      },
                    ] as const
                  ).map(({ id, icon: Icon, label, labelPl }) => (
                    <button
                      key={id}
                      onClick={() => setIdeasViewMode(id)}
                      className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                        ideasViewMode === id
                          ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'
                      }`}
                      title={isPolish ? labelPl : label}
                      role="radio"
                      aria-checked={ideasViewMode === id}
                    >
                      <Icon size={16} />
                    </button>
                  ))}
                </div>
              )}

              {/* Workspace 3-tools strip — Notebook only */}
              {activeTab === 'notebook' && !activeDocumentId && (
                <WorkspacePanelStrip
                  value={notebookActivePanel}
                  onChange={(next) => {
                    setNotebookChatOpen(next === 'tools');
                    setNotebookLinkedIdeasOpen(next === 'context');
                    setNotebookTopicsOpen(next === 'ai_suggestions');
                  }}
                />
              )}
            </div>

            {/* Primary Action Button (New Task/Decision/Notification) */}
            {actionButton && (
              <button
                onClick={actionButton.onClick}
                className={`flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-gradient-to-r ${actionButton.color} text-white border border-white/20 hover:brightness-110 shadow-lg shadow-black/10 dark:shadow-black/30 transition-all duration-200`}
                data-testid="mywork-action-button"
              >
                {actionButton.icon}
                <span>{actionButton.label}</span>
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Command Row (search | dynamic tabs | counters) */}
      {renderCommandRow()}

      {/* Main Content Area — calendar needs overflow-hidden + flex-col so FC owns the scroll (sticky headers) */}
      <div
        className={`flex-1 min-h-0 ${activeTab === 'calendar' ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}
      >
        {renderContent()}
      </div>

      {/* Startup template picker */}
      <IdeaStartupTemplates
        open={showStartupTemplates}
        onClose={() => setShowStartupTemplates(false)}
        onSelect={handleStartupTemplateSelect}
      />
    </div>
  );
};

export default MyWorkHub;
