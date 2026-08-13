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
  Bot,
  Calendar,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Database,
  Eye,
  EyeOff,
  FileText,
  Flag,
  Flame,
  Folder,
  FolderPlus,
  GanttChart,
  GitBranch,
  History,
  Home,
  Hourglass,
  Inbox,
  Kanban,
  Layers,
  LayoutGrid,
  LayoutList,
  Lightbulb,
  List,
  Lock,
  Rocket,
  Scale,
  Search,
  Sparkles,
  Sprout,
  Star,
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

import { presentationsTabQueryForHomeBridge } from '@/components/ReportsAndPresentations/outputsLibraryTabQuery';
import { HubBarSlotsProvider, useHubBar } from '@/components/shared/HubBarSlots';
import { Menu3DropdownChip } from '@/components/shared/Menu3DropdownChip';
import {
  MENU_2_TAB_ACTIVE,
  MENU_2_TAB_INACTIVE,
  MENU_3_ACTION_DANGER,
  MENU_3_ACTION_NEUTRAL,
  MENU_3_ALL_DOT_CLASS,
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_BASE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_BASE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_INNER_CLASS,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  MENU_3_ROW_CLASS,
} from '@/components/shared/ModuleMenu3';
import { LoadingState } from '@/components/shared/states';
import {
  type WorkspacePanelKey,
  WorkspacePanelStrip,
} from '@/components/shared/WorkspacePanelStrip';
import { useFeatureFlagsContext } from '@/contexts/FeatureFlagsContext';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { useUserCan } from '@/hooks/useUserCan';
import i18n from '@/i18n';
import { useAppStore } from '@/store/useAppStore';
import { useConversationStore } from '@/store/useConversationStore';
import { AppView } from '@/types';
import { createWorkspaceContext, type WorkspaceType } from '@/types/workspace';
import { isAgentPlanEnabled } from '@/utils/agentPlanFlag';
import { buildMyWorkSheetTableOpenPath, getArtifactPath } from '@/utils/artifactLinks';
import {
  dispatchBetaAccessBlocked,
  isBetaLockedForRole,
  isBetaSubareaClosed,
} from '@/utils/betaAccess';
import {
  CANVAS_OBJECT_EDIT_BAR_SLOT_ID,
  isCanvasObjectEditBarEnabled,
} from '@/utils/canvasObjectEditBarFlag';
import { isClientVaultEnabled } from '@/utils/clientVaultFlag';
import { IDEA_TOP_BAR_SLOT_ID, isIdeaTopBarOneLineEnabled } from '@/utils/ideaTopBarOneLineFlag';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import {
  dispatchPilotAccessBlocked,
  getPilotLockedAreaDetail,
  isPilotAllowedMyWorkTab,
  isPilotParticipantRole,
} from '@/utils/pilotAccess';
import {
  downloadSheetArtifactXlsx,
  resolveTablePlatformWorkspaceIdForTable,
} from '@/utils/sheetArtifactOpen';

import { CalendarView } from './Calendar/CalendarView';
import { useObjectEditBarSlotHasContent } from './canvas/objectEditBarDock';
import { type DecisionsBulkBarPayload, DecisionsPanelContent } from './DecisionsPanelContent';
import type { FocusFilter, FocusItem, FocusSort } from './Focus/FocusView';
import type { HomeScreenAction } from './Home/homeV2Types';
import {
  composeIdeaBodyFromSeedIntent,
  deriveIdeaTitleFromSeedIntent,
  getIdeaStageBucketLabel,
  type IdeaWorkspaceSeedIntent,
  normalizePreferredSystem,
} from './ideaEntryTypes';
import type { CanvasToolType } from './ideaSelectionTypes';
import { EMPTY_SELECTION, type IdeaWorkspaceSelection } from './ideaSelectionTypes';
import {
  createDefaultIdeaWorkspaceState,
  type IdeaWorkspaceHubState,
  moveIdeaWorkspaceState,
  patchIdeaWorkspaceState,
  removeIdeaWorkspaceState,
} from './ideaWorkspaceState';
import { getIdeaWorkspaceToolLabel } from './IdeaWorkspaceToolbar';
import { type InboxBulkBarPayload, InboxContent, type InboxCounts } from './InboxContent';
import { MyIdeasListContent } from './MyIdeasListContent';
import type { IdeasBulkBarPayload, IdeasHomeShellPayload, IdeaStage, MyIdea } from './myIdeasTypes';
import { MyTasksListContent } from './MyTasksListContent';
import { NotebookContent } from './NotebookContent';
import { NotebookLibraryContent } from './NotebookLibraryContent';
import { resolveOpenItemRoute } from './openItemRouting';
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
// L-08 (DP-2 IDE-tabs): initiatives open IN-CONTEXT in the document overlay
// using the same self-fetching full view the Initiatives module uses.
const InitiativeFullView = lazyWithRetry(() =>
  import('../Initiatives/InitiativeFullView').then((m) => ({ default: m.InitiativeFullView }))
);
const ExecutiveDashboard = lazyWithRetry(() =>
  import('./Executive/ExecutiveDashboard').then((m) => ({ default: m.ExecutiveDashboard }))
);
const HomeView = lazyWithRetry(() =>
  import('./Home/HomeView').then((m) => ({ default: m.HomeView }))
);
const FocusView = lazyWithRetry(() =>
  import('./Focus/FocusView').then((m) => ({ default: m.FocusView }))
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
// VLT-004 (relokacja Client Vault z menu głównego do My Work). ClientDocumentsVault
// self-gates on isClientVaultEnabled() (returns null when off) — same contract as
// the old sidebar/route entry point, just mounted from a tab instead.
const ClientDocumentsVault = lazyWithRetry(() =>
  import('../../views/vault/ClientDocumentsVault').then((m) => ({
    default: m.ClientDocumentsVault,
  }))
);
// AGT-003 (relokacja Run agent z menu głównego do My Work) + AGT-010 (powłoka
// z 2 zakładkami "Moje procesy"/"Szablony" PRZED launcherem — Piotr 2026-07-24:
// wejście pokazywało od razu 31 gotowców, brakowało warstwy tabeli pozycji jak
// w Decisions). AgentHubShell renderuje AgentPlanWorkspace dopiero po wybraniu
// pozycji z tabeli / utworzeniu nowego procesu — the tab entry below is
// filtered out when isAgentPlanEnabled() is false, mirroring menuConfig.ts.
const AgentHubShell = lazyWithRetry(() =>
  import('../AIChat/AgentHubShell').then((m) => ({ default: m.AgentHubShell }))
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
  | 'manager'
  | 'vault'
  | 'agent';

// Radar (the My Work "home" surface) is temporarily HIDDEN and PAUSED: it is
// memory-heavy and still under active development. Flipping RADAR_ENABLED back to
// true restores the sidebar tab, the default landing, and HomeView rendering — no
// other change required. While disabled, the home tab is removed from the nav and
// HomeView is never mounted (so its scanning hooks never run).
const RADAR_ENABLED = false;
// N2 (Notebook redesign): the legacy 3-icon topbar strip (Tools / Context / AI
// suggestions) is redundant — those panels now live inside the notebook window
// (NotebookRightRail). Hidden by default; flip to `true` to restore the topbar strip.
const SHOW_LEGACY_NOTEBOOK_TOOLS_STRIP = false;
const MY_WORK_FALLBACK_TAB: ModuleTab = 'inbox';
type TaskFilter = 'all' | 'overdue' | 'today' | 'week' | 'urgent';
type TasksViewMode = 'table' | 'kanban' | 'calendar';
type IdeasViewMode = 'table' | 'grid';
type DecisionsViewMode = 'table' | 'kanban' | 'timeline';
type InboxViewMode = 'flat' | 'sections';
type DecisionFilter = 'all' | 'my' | 'awaiting';
type DecisionPriorityFilter = 'all' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

interface MyWorkMainContentClassNameInput {
  activeDocumentId: string | null;
  activeTab: ModuleTab;
  ideasViewMode: IdeasViewMode;
}

export function getMyWorkMainContentClassName({
  activeDocumentId,
  activeTab,
  ideasViewMode,
}: MyWorkMainContentClassNameInput): string {
  const workspaceOwnsScroll =
    !!activeDocumentId ||
    activeTab === 'calendar' ||
    (activeTab === 'ideas' && ideasViewMode === 'table');
  return `flex-1 min-h-0 ${workspaceOwnsScroll ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`;
}

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
    '  • When proposing structural changes to the mindmap, you may include a JSON proposal block:',
    '    ```mindmap-proposal',
    '    {"addNodes":[{"label":"Node A","parentId":"root"}],"removeNodeIds":[],"renameNodes":[]}',
    '    ```',
    '  • The proposal block will be detected and sent to the mindmap for preview/accept/reject.',
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
  vault:
    "You are a knowledge-vault assistant. The user is working with their organisation's stored materials — documents, sources, evidence and their scopes. Help them find what is relevant, explain where a piece of knowledge comes from, and keep provenance explicit. Never invent a source.",
  agent:
    'You are a process-agent assistant. The user is assembling and running an automated process from steps. Help them shape the flow, name each step by what it produces, spot missing inputs, and read run results. Be concrete about what a step will actually do.',
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
  vault: [
    'What do we already know about this?',
    'Which sources back this claim?',
    'What is missing from our evidence?',
  ],
  agent: [
    'Propose a process for this goal',
    'What inputs does this step need?',
    'Why did the last run stop here?',
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
  type: 'task' | 'idea' | 'decision' | 'notification' | 'initiative';
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
      doc.type === 'notification' ||
      doc.type === 'initiative')
  );
}

function isTransientDocumentId(id: string): boolean {
  return TRANSIENT_DOCUMENT_PREFIXES.some((prefix) => id.startsWith(prefix));
}

// D1 (P2, 2026-08-12): this key used to be a single global session-storage
// entry (`moduleHub.openDocuments.mywork`) with no owner. Two identities
// sharing one browser tab (a second user logging in, or the same user
// switching organizations) would inherit each other's open document tabs.
// Scope the key to org+user and require BOTH before touching storage at all
// — an unauthenticated caller (no user/org yet) must never read or write
// under someone else's key.
const LEGACY_MYWORK_OPEN_DOCUMENTS_KEY = 'moduleHub.openDocuments.mywork';

function getMyWorkDocumentsStorageKey(
  userId?: string | null,
  organizationId?: string | null
): string | null {
  if (!userId || !organizationId) return null;
  return `moduleHub.openDocuments.mywork.${organizationId}.${userId}`;
}

function readStoredMyWorkDocuments(
  userId?: string | null,
  organizationId?: string | null
): {
  openDocuments: OpenDocument[];
  activeDocumentId: string | null;
} {
  if (typeof window === 'undefined') {
    return { openDocuments: [], activeDocumentId: null };
  }

  // Best-effort cleanup of the pre-D1 unscoped key so it stops being a leak
  // source. Safe unconditionally: it only ever removes data that was never
  // correctly scoped in the first place, never anything scoped correctly.
  try {
    window.sessionStorage.removeItem(LEGACY_MYWORK_OPEN_DOCUMENTS_KEY);
  } catch {
    // ignore
  }

  const storageKey = getMyWorkDocumentsStorageKey(userId, organizationId);
  if (!storageKey) {
    // No identity yet (e.g. pre-login) — never read under an unscoped or
    // guessed key.
    return { openDocuments: [], activeDocumentId: null };
  }

  try {
    const raw = window.sessionStorage.getItem(storageKey);
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

function writeStoredMyWorkDocuments(
  userId: string | null | undefined,
  organizationId: string | null | undefined,
  state: { openDocuments: OpenDocument[]; activeDocumentId: string | null }
): void {
  if (typeof window === 'undefined') return;
  const storageKey = getMyWorkDocumentsStorageKey(userId, organizationId);
  if (!storageKey) return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

// Exported for regression coverage (D1, 2026-08-12): lets tests exercise the
// org/user-scoped storage key directly instead of rendering the full hub.
export {
  getMyWorkDocumentsStorageKey,
  readStoredMyWorkDocuments,
  writeStoredMyWorkDocuments,
  LEGACY_MYWORK_OPEN_DOCUMENTS_KEY,
};

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
    // Initiatives have no dedicated MyWork list tab; the in-context document
    // overlay (DP-2 IDE-tabs) renders on top of the Tasks surface as host.
    case 'initiative':
      return 'tasks';
  }
}

// ★ LEAK Menu 3 (zgłoszenie właściciela, żywe demo 2026-07-26): dynamiczne
// karty `openDocuments` (task/idea/decision/notification/initiative) mają
// sens WYŁĄCZNIE na zakładkach, które je realnie otwierają — patrz
// `getDocumentTab` wyżej. Przedtem `renderCommandRow` pokazywał je na KAŻDEJ
// zakładce (w tym 'agent'/'vault'), więc np. karta „Proces ofertowania"
// (otwarta wcześniej na Ideas) wisiała nad Run agent, gdzie nie ma sensu.
const OPEN_DOCUMENT_TABS: ModuleTab[] = ['tasks', 'ideas', 'decisions', 'inbox'];

function getInitialMyWorkTab(
  searchParams: URLSearchParams,
  _canViewManager: boolean,
  allowIdeas = true
): ModuleTab {
  if (allowIdeas && (searchParams.get('ideaId') || searchParams.get('idea'))) return 'ideas';
  if (searchParams.get('taskId') || searchParams.get('task')) return 'tasks';
  if (searchParams.get('decisionId') || searchParams.get('decision')) return 'decisions';
  if (searchParams.get('notebook')) return 'notebook';
  // VLT-004/AGT-003 (relokacja z menu głównego): deep-link `?tab=vault`/`?tab=agent`,
  // used by the old /vault and /agent-plan route redirects below. Falls through to
  // the default tab if the surface's flag is off, so a stale link never lands on a
  // hidden/empty tab.
  const tabParam = searchParams.get('tab');
  if (tabParam === 'vault' && isClientVaultEnabled()) return 'vault';
  if (tabParam === 'agent' && isAgentPlanEnabled()) return 'agent';

  return RADAR_ENABLED ? 'home' : MY_WORK_FALLBACK_TAB;
}

function parseMyWorkPathIntent(
  pathname: string,
  isPolish: boolean
): { tab: ModuleTab; doc?: OpenDocument; notebookPageId?: string } | null {
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
        name: i18n.t('myWork.hub.name', 'Idea'),
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
        name: i18n.t('myWork.hub.name2', 'Task'),
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
        name: i18n.t('myWork.hub.name3', 'Decision'),
        status: 'pending',
      },
    };
  }

  if (segments[1] === 'home') return { tab: 'home' };
  if (segments[1] === 'ideas') return { tab: 'ideas' };
  if (segments[1] === 'tasks') return { tab: 'tasks' };
  if (segments[1] === 'decisions') return { tab: 'decisions' };
  // Page-level deep link (/my-work/notebook/<pageId>) — used by canvas
  // save-as-note success links and provenance "Otwórz" entries. Previously the
  // pageId segment was DISCARDED, so a valid link landed on the notebooks
  // library (often "No notebooks yet" — ingested pages have no notebook
  // container). NotebookContent's `openPageId` fetches the page by id
  // directly, so passing it through is the entire fix.
  if (segments[1] === 'notebook' && segments[2]) {
    return { tab: 'notebook', notebookPageId: decodeURIComponent(segments[2]) };
  }
  if (segments[1] === 'notebook') return { tab: 'notebook' };
  if (segments[1] === 'inbox') return { tab: 'inbox' };
  if (segments[1] === 'calendar') return { tab: 'calendar' };
  if (segments[1] === 'manager') return { tab: 'manager' };

  return null;
}

// Main tabs use the shared Menu 2 canon. Menu 3 chip styles below are shared
// with `Decyzje`, the accepted reference card for dynamic command menus.
const BUTTON_INACTIVE = MENU_2_TAB_INACTIVE;
const BUTTON_ACTIVE = MENU_2_TAB_ACTIVE;

// Topbar pills (filters / view tool) — keep consistent with BUTTON_* but smaller text.
const TOPBAR_PILL_BASE =
  'inline-flex items-center gap-2 h-9 rounded-full border px-3 text-xs font-medium transition-colors duration-150 whitespace-nowrap active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
const TOPBAR_PILL_INACTIVE = `${TOPBAR_PILL_BASE} bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-white/[0.06]`;

// Canon §15.2/§19.1: kontrolki Menu 2 = h-9 rounded-full (jeden family z pillami topbara).
// `gap-2` — odstęp ikona/etykieta gdy CTA ma ikonę (AGT-015 §6 D1); nieszkodliwe
// dla CTA bez ikony (pojedyncze dziecko flexa, gap się nie liczy).
const CTA_BASE =
  'inline-flex items-center justify-center gap-2 h-9 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900';
const CTA_TONE: Record<'violet' | 'emerald' | 'amber' | 'indigo' | 'neutral', string> = {
  neutral:
    'border-navy-700/20 bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 dark:border-white/20 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]',
  // Primary CTA = neutral inverted (decyzja Piotra 2026-07-03/04: koniec crimson
  // CTA; primary-* = crimson #85182F). Ten sam wzór co CTA_TONE.neutral.
  violet:
    'border-navy-700/20 bg-navy-900 text-white hover:bg-navy-800 active:bg-navy-950 dark:border-white/20 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF]',
  emerald:
    'border-emerald-500/30 bg-emerald-600 text-white hover:bg-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-500/80 dark:hover:bg-emerald-500',
  amber:
    'border-amber-500/30 bg-amber-600 text-white hover:bg-amber-700 dark:border-amber-400/20 dark:bg-amber-500/85 dark:hover:bg-amber-500',
  indigo:
    'border-indigo-500/30 bg-indigo-600 text-white hover:bg-indigo-700 dark:border-indigo-400/20 dark:bg-indigo-500/80 dark:hover:bg-indigo-500',
};

// Tab styles for dynamic tabs
const TAB_INACTIVE = MENU_3_CHIP_INACTIVE;
const TAB_ACTIVE = MENU_3_CHIP_ACTIVE;

// Type colors for dynamic tabs
const TYPE_COLORS = {
  // v3 identity map (docs/ui-standards/00-foundation/artifact-identity-map.md)
  initiative: 'border-l-blue-500',
  task: 'border-l-emerald-500',
  idea: 'border-l-blue-500',
  decision: 'border-l-amber-500',
  notification: 'border-l-danger-500',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-400',
  completed: 'bg-emerald-400',
  blocked: 'bg-danger-400',
  idea: 'bg-amber-400',
  pending: 'bg-amber-400',
  approved: 'bg-emerald-400',
  rejected: 'bg-danger-400',
  read: 'bg-slate-500',
  unread: 'bg-amber-400',
};

// ★ HubBarSlots (2026-07-27) — karty dokładane do Menu 3 z ekranu-dziecka
// (np. Run agent) używają `OpenDocument`/`ItemStatus` z
// `shared/ModuleHub/types` (kanoniczny 13-status lifecycle), INNY zbiór niż
// lokalny `ItemStatus` powyżej (10 wartości specyficznych dla MyWork). Stąd
// osobna, mała mapa tylko dla tych kart — paleta zgodna z
// `shared/ModuleHub/DynamicTabs.tsx` STATUS_COLORS (SSOT koloru kropki).
const HUB_SLOT_STATUS_DOT: Record<string, string> = {
  DRAFT: 'bg-slate-400',
  PENDING_REVIEW: 'bg-amber-400',
  REVIEW: 'bg-amber-400',
  PROMOTED: 'bg-blue-400',
  PLANNING: 'bg-indigo-400',
  APPROVED: 'bg-emerald-400',
  SCHEDULED: 'bg-blue-400',
  EXECUTING: 'bg-blue-400',
  BLOCKED: 'bg-danger-400',
  DONE: 'bg-green-400',
  TRACKING: 'bg-blue-400',
  CANCELLED: 'bg-gray-400',
  ARCHIVED: 'bg-slate-500',
};

// Ikona per `doc.type` dla kart ze slotu dziecka — te same typy co
// `shared/ModuleHub/types.ts` OpenDocument['type'].
const HUB_SLOT_TYPE_ICON: Record<string, React.ComponentType<{ size?: number }>> = {
  tool: Bot,
  task: CheckSquare,
  idea: Lightbulb,
  decision: Scale,
  notification: Bell,
  initiative: Rocket,
  report: FileText,
  assessment: FileText,
  presentation: FileText,
  conclusion: FileText,
  interview_session: FileText,
  interview_insight: FileText,
  interview_template: FileText,
};

interface MyWorkHubProps {
  onNavigate?: (view: string) => void;
}

/**
 * ★ JEDEN PASEK NA EKRAN (2026-07-27, zgłoszenie właściciela na żywym demo).
 *
 * Hub jest właścicielem Menu 2 i Menu 3 — ekrany-dzieci (Run agent, Client
 * Vault) NIE rysują własnych pasków, tylko DEKLARUJĄ, co ma się w tym jednym
 * pasku pojawić (`useHubBarSlot`, src/components/shared/HubBarSlots.tsx).
 * Przedtem nad obszarem roboczym stały cztery rzędy chrome, z czego dwa były
 * duplikatem — cytat: „za dużo miejsca ucieka".
 *
 * Rozdział na `MyWorkHub` (provider) i `MyWorkHubInner` (treść) jest konieczny,
 * bo kontekstu nie da się czytać w tym samym komponencie, który go zakłada.
 */
const MyWorkHubInner: React.FC<MyWorkHubProps> = ({ onNavigate }) => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  // ★ JEDEN PASEK NA EKRAN — co ekran-dziecko (Run agent, Client Vault)
  // zadeklarował przez `useHubBarSlot`. Poza providerem: zawsze `{}` (no-op).
  const hubBarSlot = useHubBar();
  // Górny pasek Idei w jednej linii (flaga, domyślnie OFF) — steruje TYLKO
  // slotem portalu w rzędzie pilli + kurczliwością tego rzędu. Reszta huba
  // przy OFF jest bajt-w-bajt jak dziś.
  const ideaTopBarOneLine = isIdeaTopBarOneLineEnabled();
  /**
   * ★ DOK PASKA EDYCJI W SCALONEJ LINII (naprawa konfliktu dwóch flag).
   *
   * `ff_canvasObjectEditBar` dokuje pasek edycji obiektu w listwie Menu 3
   * (`IdeaCanvasSecondBar`). `ff_ideaTopBarOneLine` KASUJE Menu 3 w całości —
   * więc obie ON = brak celu portalu = pasek wracał do pływania nad
   * zaznaczeniem (potwierdzone zrzutem, nie testem). Skoro obie flagi mają być
   * stanem domyślnym, ta linia MUSI umieć dokować pasek.
   *
   * Rozwiązanie: rząd pilli wystawia DRUGIEGO gospodarza tego samego slotu
   * (`CANVAS_OBJECT_EDIT_BAR_SLOT_ID`) — ten sam identyfikator DOM, więc
   * `useObjectEditBarSlot()` w Mapie/Tablicy/Procesie działa BEZ ZMIAN i bez
   * prop-drillingu. Kolizji id nie ma: gospodarze wykluczają się wzajemnie
   * (Menu 3 istnieje tylko przy `ideaTopBarOneLine === false`).
   */
  const ideaEditBarDockEnabled = ideaTopBarOneLine && isCanvasObjectEditBarEnabled();
  const ideaEditBarSlotRef = useRef<HTMLDivElement>(null);
  const ideaEditBarActive = useObjectEditBarSlotHasContent(
    ideaEditBarSlotRef,
    ideaEditBarDockEnabled
  );
  const openChatWithContext = useOpenChatWithContext();
  const setWorkspaceContext = useConversationStore((s) => s.setWorkspaceContext);
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentUser,
    currentOrganization,
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
    setMyWorkBreadcrumbs,
  } = useAppStore();

  const lazyFallback = (
    <div className="p-6">
      <LoadingState template="panel" label={t('myWork.hub.label', 'Loading…')} />
    </div>
  );

  // Role-based access – Manager tab restricted to admin/manager/superadmin
  const { isAdmin, isManager, isSuperAdmin } = useUserCan();
  const canViewManager = isAdmin || isManager || isSuperAdmin;
  const isPilotParticipant = isPilotParticipantRole(currentUser?.role);
  // Beta gating for the Ideas tab. Locked only when BOTH:
  //   (1) MYWORK_IDEAS is marked 'closed' in betaAccess.BETA_SUBAREA_STATUS, and
  //   (2) the role is not exempt — with BETA_ADMINS_EXEMPT=true only non-admins
  //       are blocked; flip it to false to block everyone (including admins).
  // Current config: MYWORK_IDEAS='open' + BETA_ADMINS_EXEMPT=true → nobody locked.
  // The product decision of open vs closed lives in betaAccess.ts (SSOT), not here.
  const ideasBetaLocked =
    isBetaSubareaClosed('MYWORK_IDEAS') && isBetaLockedForRole(currentUser?.role);

  // D1 (P2, 2026-08-12): scoped to userId+organizationId so two identities
  // sharing this browser tab never inherit each other's open document tabs
  // — see readStoredMyWorkDocuments above.
  const myWorkDocumentsUserId = currentUser?.id;
  const myWorkDocumentsOrgId = currentOrganization?.id || currentUser?.organizationId;
  const restoredDocumentState = useMemo(
    () => readStoredMyWorkDocuments(myWorkDocumentsUserId, myWorkDocumentsOrgId),
    [myWorkDocumentsUserId, myWorkDocumentsOrgId]
  );
  // Tab state — restore the last live document when possible, otherwise land on Home/path intent.
  const [activeTab, setActiveTab] = useState<ModuleTab>(() => {
    const restoredActiveDoc = restoredDocumentState.activeDocumentId
      ? restoredDocumentState.openDocuments.find(
          (doc) => doc.id === restoredDocumentState.activeDocumentId
        ) || null
      : null;
    return restoredActiveDoc
      ? getDocumentTab(restoredActiveDoc.type)
      : getInitialMyWorkTab(searchParams, canViewManager, !isPilotParticipant);
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Radar (home) is hidden/paused: coerce any 'home' state (deep-links, resets) to
  // the fallback so the nav highlight stays consistent and HomeView never mounts.
  useEffect(() => {
    if (!RADAR_ENABLED && activeTab === 'home') {
      setActiveTab(MY_WORK_FALLBACK_TAB);
    }
  }, [activeTab]);

  // Filter states
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('all');
  const [tasksViewMode, setTasksViewMode] = useState<TasksViewMode>('table');
  const [ideasViewMode, setIdeasViewMode] = useState<IdeasViewMode>('table');
  const [ideaActiveTool, setIdeaActiveTool] = useState<CanvasToolType>('mindmap');
  const [ideaActivePanel, setIdeaActivePanel] = useState<WorkspacePanelKey>(null);
  const [ideaSelection, setIdeaSelection] = useState<IdeaWorkspaceSelection>(EMPTY_SELECTION);
  const [ideaLocked, setIdeaLocked] = useState(true);
  // Graph summary is consumed only when (re)building the AI system prompt below.
  // Kept in a ref — NOT state — because the graph-summary callback fires on every
  // canvas mutation, and a state update here re-renders MyWorkHub, which remounted
  // the active idea-canvas tool and wiped optimistic edits (e.g. a freshly added
  // node). See M07 live-debug 2026-06-20.
  const ideaGraphSummaryRef = useRef<string | null>(null);
  const handleIdeaGraphSummaryChange = useCallback((summary: string | null) => {
    ideaGraphSummaryRef.current = summary;
  }, []);
  const [ideaTableContext, setIdeaTableContext] = useState<Record<string, unknown> | null>(null);
  const [ideaWorkspaceStateById, setIdeaWorkspaceStateById] = useState<
    Record<string, IdeaWorkspaceHubState>
  >({});
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
    | 'this_week'
    /* P-10 (2026-07-28): „Done" zszedł z prawej strony Menu 3 na lewą, do
       filtrów — patrz komentarz przy `presets` niżej. */
    | 'done';
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
  // L1 container (Notatnik) currently open. null => show the notebook library list.
  const [notebookOpenId, setNotebookOpenId] = useState<string | null>(null);
  const [notebookOpenTitle, setNotebookOpenTitle] = useState<string>('');
  // Menu 2 "New notebook" CTA → opens the create-notebook modal inside the library (L1).
  const [notebookCreateNotebookReqId, setNotebookCreateNotebookReqId] = useState(0);
  // Menu 3 (Command Row) page-status presets for the open notebook (L2).
  const [notebookPageStatusFilter, setNotebookPageStatusFilter] = useState<
    'all' | 'inbox' | 'active'
  >('all');
  // Menu 3 (Command Row) scope presets for the notebook library (L1).
  const [notebookScopeFilter, setNotebookScopeFilter] = useState<'all' | 'personal' | 'team'>(
    'all'
  );
  const [notebookScopeCounts, setNotebookScopeCounts] = useState({
    all: 0,
    personal: 0,
    team: 0,
  });
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

  // Lustro `openDocuments` do odczytu z uchwytów, które NIE MOGĄ mieć tej listy
  // w zależnościach (IDE-027: `handleDocumentSaved` jest przekazywany w dół i
  // przeliczanie go przy każdej zmianie listy dokumentów remontowałoby warsztat).
  const openDocumentsRef = useRef<OpenDocument[]>(openDocuments);
  useEffect(() => {
    openDocumentsRef.current = openDocuments;
  }, [openDocuments]);

  useEffect(() => {
    if (!isPilotParticipant) return;
    if (isPilotAllowedMyWorkTab(activeTab)) return;
    setActiveDocumentId((current) => {
      if (!current) return current;
      const activeDoc = openDocuments.find((doc) => doc.id === current);
      return activeDoc?.type === 'idea' ? null : current;
    });
    setActiveTab('home');
    if (
      location.pathname.startsWith('/my-work/ideas') ||
      searchParams.get('ideaId') ||
      searchParams.get('idea')
    ) {
      const detail = getPilotLockedAreaDetail('IDEAS_TAB', 'Ideas');
      dispatchPilotAccessBlocked({
        message: detail.message,
        href: detail.href,
      });
      navigate('/my-work', { replace: true });
    }
  }, [activeTab, isPilotParticipant, location.pathname, navigate, openDocuments, searchParams]);
  // Beta gating: keep non-admins out of the Ideas tab (incl. deep links / initial
  // tab restore) and surface the branded access plate instead.
  useEffect(() => {
    if (!ideasBetaLocked) return;
    const onIdeas =
      activeTab === 'ideas' ||
      location.pathname.startsWith('/my-work/ideas') ||
      Boolean(searchParams.get('ideaId')) ||
      Boolean(searchParams.get('idea'));
    if (!onIdeas) return;
    setActiveDocumentId((current) => {
      if (!current) return current;
      const activeDoc = openDocuments.find((doc) => doc.id === current);
      return activeDoc?.type === 'idea' ? null : current;
    });
    setActiveTab('home');
    dispatchBetaAccessBlocked(t('access.blocked.BETA_LOCKED'));
    if (location.pathname.startsWith('/my-work/ideas')) {
      navigate('/my-work', { replace: true });
    }
  }, [activeTab, ideasBetaLocked, location.pathname, navigate, openDocuments, searchParams, t]);
  useEffect(() => {
    writeStoredMyWorkDocuments(myWorkDocumentsUserId, myWorkDocumentsOrgId, {
      openDocuments,
      activeDocumentId,
    });
  }, [openDocuments, activeDocumentId, myWorkDocumentsUserId, myWorkDocumentsOrgId]);

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
              ? 'notebook'
              : activeTab === 'manager'
                ? 'dashboard'
                : 'general';

    const notebookEntityId = activeTab === 'notebook' ? notebookOpenPageId : null;

    const ctx = createWorkspaceContext(AppView.MY_WORK, typeFromActiveDoc || typeFromTab, {
      projectId: currentProjectId || undefined,
      entityId: activeDoc?.id || notebookEntityId || undefined,
      entityName: activeDoc?.name || undefined,
      entityData: {
        module: 'my_work',
        tab: activeTab,
        open: activeDoc
          ? { type: activeDoc.type, id: activeDoc.id }
          : notebookEntityId
            ? { type: 'notebook', id: notebookEntityId }
            : null,
        url: `${location.pathname}${location.search || ''}`,
        ...(ideaTableContext ? { tableContext: ideaTableContext } : {}),
      },
    });

    setWorkspaceContext(ctx);
  }, [
    activeTab,
    activeDocumentId,
    openDocuments,
    currentProjectId,
    notebookOpenPageId,
    ideaTableContext,
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
  const activeIdeaWorkspaceState = useMemo(
    () =>
      activeIdeaDoc
        ? ideaWorkspaceStateById[activeIdeaDoc.id] || createDefaultIdeaWorkspaceState(activeIdeaDoc)
        : null,
    [activeIdeaDoc, ideaWorkspaceStateById]
  );
  const activeIdeaToolLabel = useMemo(
    () =>
      getIdeaWorkspaceToolLabel(
        activeIdeaWorkspaceState?.activeTool || ideaActiveTool,
        Boolean(isPolish)
      ),
    [activeIdeaWorkspaceState?.activeTool, ideaActiveTool, isPolish]
  );

  const updateActiveIdeaWorkspaceState = useCallback(
    (patch: Partial<IdeaWorkspaceHubState>) => {
      if (!activeIdeaDoc) return;
      setIdeaWorkspaceStateById((prev) => patchIdeaWorkspaceState(prev, activeIdeaDoc, patch));
    },
    [activeIdeaDoc]
  );

  const handleIdeaPanelChange = useCallback(
    (panel: WorkspacePanelKey) => {
      setIdeaActivePanel(panel);
      updateActiveIdeaWorkspaceState({ activePanel: panel });
    },
    [updateActiveIdeaWorkspaceState]
  );

  const handleIdeaToolChange = useCallback(
    (tool: CanvasToolType) => {
      setIdeaActiveTool(tool);
      updateActiveIdeaWorkspaceState({ activeTool: tool });
    },
    [updateActiveIdeaWorkspaceState]
  );

  const handleIdeaSelectionChange = useCallback(
    (selection: IdeaWorkspaceSelection) => {
      setIdeaSelection(selection);
      updateActiveIdeaWorkspaceState({ selection });
    },
    [updateActiveIdeaWorkspaceState]
  );

  const handleIdeaLockedChange = useCallback(
    (locked: boolean) => {
      setIdeaLocked(locked);
      updateActiveIdeaWorkspaceState({ locked });
    },
    [updateActiveIdeaWorkspaceState]
  );

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
      wsCtx.push(`Active system: ${activeIdeaToolLabel}`);
      wsCtx.push(
        activeIdeaWorkspaceState?.locked
          ? 'Stage: spark (not yet accepted)'
          : 'Stage: active (accepted)'
      );
      if (
        activeIdeaWorkspaceState?.selection.type &&
        activeIdeaWorkspaceState.selection.type !== 'none'
      ) {
        wsCtx.push(
          `Selection: ${activeIdeaWorkspaceState.selection.count} ${activeIdeaWorkspaceState.selection.type}(s) selected`
        );
      }
      if (ideaGraphSummaryRef.current) {
        wsCtx.push(`Graph state: ${ideaGraphSummaryRef.current}`);
      }
      prompt += `\n\nWorkspace context:\n${wsCtx.join('\n')}`;
    }

    setChatSystemPrompt(prompt || null);
    setChatQuickPrompts(TAB_QUICK_PROMPTS[activeTab] || null);
  }, [
    activeTab,
    activeIdeaWorkspaceState,
    contextSummary,
    activeIdeaToolLabel,
    setChatSystemPrompt,
    setChatQuickPrompts,
    activeIdeaDoc,
  ]);

  // Update breadcrumbs for the app topbar
  useEffect(() => {
    const TAB_LABELS: Record<ModuleTab, string> = {
      home: 'Radar',
      ideas: t('myWork.hub.ideas', 'Ideas'),
      notebook: t('myWork.hub.notebook', 'Notebook'),
      inbox: t('myWork.hub.inbox', 'Inbox'),
      calendar: t('myWork.hub.calendar', 'Calendar'),
      tasks: t('myWork.hub.tasks', 'Tasks'),
      decisions: t('myWork.hub.decisions', 'Decisions'),
      manager: t('myWork.hub.manager', 'Manager'),
      vault: t('myWork.hub.vault', 'Sejf klienta'),
      agent: t('myWork.hub.agent', 'Run agent'),
    };
    const base = t('myWork.hub.myWork', 'My Work');
    const tabLabel = TAB_LABELS[activeTab] || activeTab;
    const crumbs = [base, tabLabel];

    if (activeIdeaDoc && activeTab === 'ideas') {
      crumbs.push(activeIdeaDoc.name || t('myWork.hub.idea', 'Idea'));
      if (activeIdeaToolLabel) crumbs.push(activeIdeaToolLabel);
    }
    setMyWorkBreadcrumbs(crumbs);
    return () => setMyWorkBreadcrumbs(null);
  }, [activeTab, activeIdeaDoc, activeIdeaToolLabel, isPolish, setMyWorkBreadcrumbs]);

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

  // M03 L-02 (D-01): the server session-context was write-only — this POST fired
  // every 5s but nothing ever read it back (no GET consumer anywhere in the FE),
  // so it never provided continuity. Cross-session restore is already handled
  // locally via readStoredMyWorkDocuments() (openDocuments from localStorage).
  // Removed the dead write rather than half-wire a server read nobody asked for.

  // F1: EventBus — refresh tabs when cross-tab events fire
  useEffect(() => {
    if (!myWorkEvent) return;
    setRefreshTrigger((prev) => prev + 1);
    clearMyWorkEvent();
  }, [myWorkEvent, clearMyWorkEvent]);

  // F3: Handle mywork-open-item custom event (dispatched by KnowledgePulse, detail views, etc.)
  const { isEnabled } = useFeatureFlagsContext();
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
            toast.success(t('myWork.hub.toastSuccess', 'Downloaded spreadsheet (.xlsx)'));
          } else {
            toast.error(
              t('myWork.hub.couldNotDownloadSpreadsheet', 'Could not download spreadsheet')
            );
          }
        })();
        return;
      }
      // DP-2 (IDE-tabs doc, L-08): light work items — initiative/task/decision/
      // idea/notebook/notification — open IN-CONTEXT via the dynamic document
      // overlay instead of hard-navigating away from My Work. Only the heavy
      // artifact types still navigate to their own module (deck/doc → Canvas,
      // budget/valuation/report → full module). SSOT: resolveOpenItemRoute.
      if (resolveOpenItemRoute(type) === 'navigate') {
        navigate(getArtifactPath(type as any, String(id)));
        return;
      }
      const tabMap: Record<string, ModuleTab> = {
        task: 'tasks',
        decision: 'decisions',
        idea: 'ideas',
        notification: 'inbox',
        notebook: 'notebook',
        initiative: 'tasks',
      };
      if (tabMap[type]) setActiveTab(tabMap[type]);
      if (type === 'notebook') {
        setNotebookOpenPageId(String(id));
        return;
      }
      if (type !== 'notebook') {
        handleOpenDocument({
          id,
          type: type as 'task' | 'idea' | 'decision' | 'notification' | 'initiative',
          name: name || type,
          status:
            type === 'notification'
              ? ('unread' as const)
              : type === 'decision'
                ? ('pending' as const)
                : type === 'idea'
                  ? ('idea' as const)
                  : type === 'initiative'
                    ? ('in_progress' as const)
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
        name: t('myWork.hub.name4', 'Task'),
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
        name: t('myWork.hub.name5', 'Decision'),
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
        name: t('myWork.hub.name6', 'Idea'),
        status: 'idea',
      };
      setActiveTab('ideas');
      if (activeTab === 'ideas') handleOpenDocument(nextDoc);
      else setPendingDocument(nextDoc);
      setPendingUrlCleanup({ documentId: ideaId, keys: ['ideaId', 'idea'] });
    }
  }, [activeTab, handleOpenDocument, searchParams, isPolish]);

  // Notebook container deep-link: ?notebook=<id> persists in the URL so a notebook
  // is shareable and survives refresh (unlike the transient task/idea deep-links
  // above). Reconcile URL -> state; covers cold load and browser back/forward.
  // Page-level open (notebookOpenPageId) stays owned by the legacy intent/action
  // flows and is intentionally not reconciled here.
  useEffect(() => {
    const nbId = searchParams.get('notebook');
    if ((nbId || null) === (notebookOpenId || null)) return;
    if (!nbId) {
      setNotebookOpenId(null);
      setNotebookOpenTitle('');
      return;
    }
    setActiveTab('notebook');
    setNotebookOpenId(nbId);
    setNotebookOpenTitle('');
    setNotebookOpenPageId(null);
    let cancelled = false;
    void (async () => {
      try {
        const { Api } = await import('@/services/api');
        const nb = await Api.getNotebook(nbId);
        if (!cancelled && nb?.title) setNotebookOpenTitle(String(nb.title));
      } catch {
        /* title is best-effort; header falls back to the default label */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, notebookOpenId]);

  useEffect(() => {
    const intent = parseMyWorkPathIntent(location.pathname, isPolish);
    if (!intent) return;
    setActiveTab(intent.tab);
    // /my-work/notebook/<pageId> opens the page editor directly (bypasses the
    // notebooks library, which knows nothing about container-less ingested
    // pages such as canvas save-as-note materializations).
    if (intent.notebookPageId) {
      setNotebookOpenPageId(intent.notebookPageId);
    }
    const nextDoc = intent.doc;
    if (!nextDoc) return;
    if (nextDoc.type === 'idea' && nextDoc.data?.initialTool) {
      const deepLinkTool = nextDoc.data.initialTool as CanvasToolType;
      // A deep link (/whiteboard, /mind-map, /process-flow, /table) is
      // AUTHORITATIVE about which tool opens. Setting only the `ideaActiveTool`
      // fallback is not enough: the workspace renders
      // `activeIdeaWorkspaceState?.activeTool || ideaActiveTool`, and
      // `activeIdeaWorkspaceState` is derived from the PERSISTED
      // `ideaWorkspaceStateById[id]`. If the idea was previously opened with a
      // different tool (e.g. Process Flow), that stale saved tool wins over the
      // deep link — the documented `forcedIdeaDeepLinkRef` fix never actually
      // landed in code, so the race was still live (Harvard R4 #10 / #3).
      // Patch the persisted state too so the deep-linked tool wins
      // deterministically regardless of mount ordering.
      setIdeaActiveTool(deepLinkTool);
      setIdeaWorkspaceStateById((prev) =>
        patchIdeaWorkspaceState(prev, nextDoc, { activeTool: deepLinkTool })
      );
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
        color: 'bg-sky-500',
        requiresManagerAccess: false,
      },
      {
        id: 'ideas' as ModuleTab,
        label: t('myWork.hub.label2', 'Ideas'),
        icon: <Lightbulb size={16} />,
        count: tabCounts.ideas,
        color: 'bg-amber-500',
        requiresManagerAccess: false,
        isLocked: isPilotParticipant || ideasBetaLocked,
        betaLocked: ideasBetaLocked,
      },
      {
        id: 'notebook' as ModuleTab,
        label: t('myWork.hub.label3', 'Notebook'),
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
        color: 'bg-blue-500',
        requiresManagerAccess: false,
      },
      {
        id: 'calendar' as ModuleTab,
        label: t('myWork.hub.label4', 'Calendar'),
        icon: <Calendar size={16} />,
        count: tabCounts.calendar,
        color: 'bg-indigo-500',
        requiresManagerAccess: false,
      },
      {
        id: 'tasks' as ModuleTab,
        label: t('myWork.hub.label5', 'Tasks'),
        icon: <CheckSquare size={16} />,
        count: tabCounts.tasks,
        color: 'bg-blue-500',
        requiresManagerAccess: false,
      },
      {
        id: 'decisions' as ModuleTab,
        label: t('myWork.hub.label6', 'Decisions'),
        icon: <Scale size={16} />,
        count: tabCounts.decisions,
        color: 'bg-blue-500',
        requiresManagerAccess: false,
      },
      // VLT-004 (relokacja Client Vault). Same gate as the old sidebar entry
      // (isClientVaultEnabled) — hidden entirely when off, so removing the
      // sidebar item doesn't leave a dangling tab if the flag is ever flipped OFF.
      {
        id: 'vault' as ModuleTab,
        label: t('sidebar.clientVault', 'Client Vault'),
        icon: <Database size={16} />,
        color: 'bg-slate-500',
        requiresManagerAccess: false,
        requiresVaultFlag: true,
      },
      // AGT-003 (relokacja Run agent). Same gate as the old sidebar entry
      // (isAgentPlanEnabled).
      {
        id: 'agent' as ModuleTab,
        label: t('sidebar.agentPlan', 'Run agent'),
        icon: <Bot size={16} />,
        color: 'bg-slate-500',
        requiresManagerAccess: false,
        requiresAgentFlag: true,
      },
      {
        id: 'manager' as ModuleTab,
        label: 'Manager',
        icon: <Users size={16} />,
        count: tabCounts.manager,
        color: 'bg-sky-500',
        requiresManagerAccess: true,
      },
    ];

    return allTabs.filter((tab) => {
      if (tab.id === 'home' && !RADAR_ENABLED) return false;
      if (tab.requiresManagerAccess && !canViewManager) return false;
      if ('requiresVaultFlag' in tab && tab.requiresVaultFlag && !isClientVaultEnabled())
        return false;
      if ('requiresAgentFlag' in tab && tab.requiresAgentFlag && !isAgentPlanEnabled())
        return false;
      return true;
    });
  }, [isPilotParticipant, ideasBetaLocked, isPolish, tabCounts, canViewManager]);

  // Task filters configuration
  const taskFilters = useMemo(
    () => [
      {
        id: 'all' as TaskFilter,
        label: t('myWork.hub.label7', 'All'),
        icon: <LayoutGrid size={14} />,
        color: 'bg-slate-400',
      },
      {
        id: 'overdue' as TaskFilter,
        label: t('myWork.hub.label8', 'Overdue'),
        icon: <AlertCircle size={14} />,
        color: 'bg-danger-500',
        count: taskFilterCounts.overdue,
      },
      {
        id: 'today' as TaskFilter,
        label: t('myWork.hub.label9', 'Today'),
        icon: <Calendar size={14} />,
        color: 'bg-blue-500',
        count: taskFilterCounts.today,
      },
      {
        id: 'week' as TaskFilter,
        label: t('myWork.hub.label10', 'This Week'),
        icon: <CalendarDays size={14} />,
        color: 'bg-slate-500',
        count: taskFilterCounts.week,
      },
      {
        id: 'urgent' as TaskFilter,
        label: t('myWork.hub.label11', 'Urgent'),
        icon: <Flame size={14} />,
        color: 'bg-amber-500',
        count: taskFilterCounts.urgent,
      },
      {
        id: 'new' as TaskFilter,
        label: t('myWork.hub.label12', 'New'),
        icon: <Inbox size={14} />,
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
        label: t('myWork.hub.label13', 'All'),
        icon: <LayoutGrid size={12} />,
        color: 'bg-slate-400',
        count: tabCounts.decisions,
      },
      {
        id: 'my' as DecisionFilter,
        label: t('myWork.hub.label14', 'My decisions to make'),
        icon: <User size={12} />,
        color: 'bg-blue-500',
        count: decisionFilterCounts.my,
      },
      {
        id: 'awaiting' as DecisionFilter,
        label: t('myWork.hub.label15', 'My requests pending'),
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
      setIdeaWorkspaceStateById((prev) => removeIdeaWorkspaceState(prev, id));
      if (activeDocumentId === id) {
        setActiveDocumentId(null);
      }
    },
    [activeDocumentId]
  );

  // Powrót do listy Idei z rzędu pilli — chip „Lista". Przy scalonym górnym
  // pasku (flaga `ff_ideaTopBarOneLine`) to JEDYNE wejście „w górę" w tym
  // rzędzie (strzałka wstecz powłoki znika razem z breadcrumbem), więc musi
  // działać dla każdego typu dokumentu. Działa: zeruje aktywny dokument, a hub
  // wraca do listy aktywnej zakładki (dla Idei — listy Idei).
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
      name: t('myWork.hub.name7', 'New Task'),
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
      const body = composeIdeaBodyFromSeedIntent(seedIntent);
      const title = deriveIdeaTitleFromSeedIntent(seedIntent, t('myWork.hub.newIdea', 'New Idea'));
      const startTool = preferredSystem || 'mindmap';
      handleOpenDocument({
        id: newId,
        type: 'idea',
        name: title,
        status: 'idea',
        data: {
          isNew: true,
          // A new idea has NO saved map yet, so hydrate() cannot restore the tool
          // the user picked in the build window — it MUST ride on the doc. Without
          // this, createDefaultIdeaWorkspaceState() falls back to 'mindmap' and the
          // workspace opens a mind map no matter which area was chosen (IDE-001).
          initialTool: startTool,
          seedIntent,
          creationPayload: {
            title,
            body,
            tags: [],
            sourceType: 'manual',
          },
        },
      });
      // The hub feeds IdeaMapWorkspace `activeTool = perIdeaState?.activeTool ||
      // ideaActiveTool`. The patch below is a no-op for a brand-new id (default
      // state already equals the patch, so patchIdeaWorkspaceState's "unchanged"
      // guard drops it), which left the hub falling back to ideaActiveTool='mindmap'
      // — the root cause of "New Idea always opens a map". Seed the fallback too so
      // the controlled activeTool prop reflects the chosen tool from the first frame.
      setIdeaActiveTool(startTool);
      setIdeaWorkspaceStateById((prev) =>
        patchIdeaWorkspaceState(
          prev,
          { id: newId, data: { isNew: true, initialTool: startTool } },
          {
            activeTool: startTool,
            activePanel: 'tools',
            selection: EMPTY_SELECTION,
            locked: true,
          }
        )
      );
    },
    [handleOpenDocument, isPolish]
  );

  const handleIdeaClick = useCallback(
    (
      ideaId: string,
      ideaData?: MyIdea,
      options?: { openMap?: boolean; initialTool?: CanvasToolType }
    ) => {
      handleOpenDocument({
        id: ideaId,
        type: 'idea',
        name: ideaData?.title || t('myWork.hub.idea2', 'Idea'),
        status: 'idea',
        data: {
          ...ideaData,
          openMap: options?.openMap ?? ideaData?.openMap,
          initialTool: options?.initialTool,
        },
      });
      if (options?.initialTool) {
        setIdeaWorkspaceStateById((prev) =>
          patchIdeaWorkspaceState(
            prev,
            { id: ideaId, data: { initialTool: options.initialTool } },
            { activeTool: options.initialTool }
          )
        );
      }
    },
    [handleOpenDocument, isPolish]
  );

  // Decision handlers
  const handleCreateDecision = useCallback(() => {
    const newId = `new-decision-${Date.now()}`;
    handleOpenDocument({
      id: newId,
      type: 'decision',
      name: t('myWork.hub.name8', 'New Decision'),
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

  // Initiative handler — L-08 (DP-2): open IN-CONTEXT in the document overlay
  // (parallel to task/decision) instead of hard-navigating to the M13 module.
  const handleInitiativeClick = useCallback(
    (initiativeId: string, initiativeData?: any) => {
      handleOpenDocument({
        id: String(initiativeId),
        type: 'initiative',
        name: initiativeData?.name || initiativeData?.title || 'Initiative',
        status: 'in_progress',
        data: initiativeData,
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
        // ★ IDE-027: stan warsztatu MUSI przeżyć podmianę identyfikatora, nawet
        // jeśli nikt nie zmaterializował wpisu pod identyfikatorem roboczym
        // (strażnik „bez zmian" w patchIdeaWorkspaceState go nie zakłada, gdy
        // łatka równa się stanowi domyślnemu — czyli DOKŁADNIE przy świeżej
        // Idei z wybranym narzędziem). Wyliczamy stan z dokumentu SPRZED
        // nadpisania i podajemy jako awaryjny.
        const dokumentPrzed = openDocumentsRef.current.find((d) => d.id === docId) || null;
        const stanPrzed = dokumentPrzed
          ? createDefaultIdeaWorkspaceState(dokumentPrzed as any)
          : null;
        setIdeaWorkspaceStateById((prev) => moveIdeaWorkspaceState(prev, docId, nextId, stanPrzed));
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
              // ★ IDE-027: SCALAJ, nie nadpisuj. `updatedData` to rekord Idei
              // z serwera — nie zna `initialTool` ani `seedIntent`. Podstawienie
              // go w miejsce `data` kasowało wybór narzędzia użytkownika, przez
              // co Idea otwierała się jako Mapa myśli niezależnie od wyboru.
              // `isNew` gaśnie, bo Idea już istnieje na serwerze.
              data: { ...(existing.data || {}), ...updatedData, isNew: false },
            },
          ];
        });
        setActiveDocumentId((cur) => (cur === docId ? nextId : cur));
      } else {
        setOpenDocuments((prev) =>
          prev.map((doc) =>
            doc.id === docId
              ? {
                  ...doc,
                  name: updatedData.title || doc.name,
                  // Ta sama zasada co wyżej — zapis nie może gubić kontekstu
                  // utworzenia (narzędzie, seedIntent) trzymanego w `data`.
                  data: { ...(doc.data || {}), ...updatedData },
                }
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

  // S1-U1: home-shell (folders + starred + recents) published by the Ideas
  // list; rendered as dropdown chips inside the single Command Row.
  const [ideasHomeShell, setIdeasHomeShell] = useState<IdeasHomeShellPayload | null>(null);
  const handleIdeasHomeShellChange = useCallback((payload: IdeasHomeShellPayload | null) => {
    setIdeasHomeShell(payload);
  }, []);

  // S1-U2b: single SSOT for leaving an open notebook — used by BOTH the
  // Command-Row breadcrumb and NotebookContent's sidebar back button.
  const handleNotebookBackToLibrary = useCallback(() => {
    setNotebookOpenId(null);
    setNotebookOpenTitle('');
    setNotebookOpenPageId(null);
    const next = new URLSearchParams(searchParams);
    next.delete('notebook');
    next.delete('note');
    setSearchParams(next, { replace: false });
  }, [searchParams, setSearchParams]);

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
    setInboxStatusTab(next === 'saved' ? 'saved' : next === 'done' ? 'done' : 'open');
    setInboxSection(next === 'today' ? 'today' : next === 'this_week' ? 'this_week' : 'all');
    setInboxActionRequiredOnly(next === 'action_required');
  }, []);

  /* P-10 (2026-07-28): `handleInboxStatusTabSelect` usunięty razem z segmentem
     `Open | Done | Saved` z prawej strony Menu 3 — jego mapowanie
     preset ↔ statusTab przejął w całości `applyInboxPreset` powyżej. */

  const openTabAiContext = useCallback(
    async (tab: 'inbox' | 'tasks' | 'decisions') => {
      const isInbox = tab === 'inbox';
      const isDecisions = tab === 'decisions';
      const entityType = isInbox ? 'notification' : isDecisions ? 'decision' : 'task';
      const entityId = isInbox
        ? 'my-work-inbox'
        : isDecisions
          ? 'my-work-decisions'
          : 'my-work-tasks';
      const entityName = isInbox
        ? t('myWork.hub.inbox2', 'Inbox')
        : isDecisions
          ? t('myWork.hub.decisions2', 'Decisions')
          : t('myWork.hub.tasks2', 'Tasks');
      await openChatWithContext({
        entityType,
        entityId,
        entityName,
        contextData: {
          module: 'my_work',
          tab,
          inboxStatusTab: isInbox ? inboxStatusTab : undefined,
          taskFilter: tab === 'tasks' ? taskFilter : undefined,
          tasksViewMode: tab === 'tasks' ? tasksViewMode : undefined,
          decisionFilter: isDecisions ? decisionFilter : undefined,
          decisionPriorityFilter: isDecisions ? decisionPriorityFilter : undefined,
          source: 'menu3',
        },
      });
      setChatKickoffMessage(
        isInbox
          ? t('myWork.hub.analyzeMyInboxAnd', 'Analyze my inbox and propose the next best action.')
          : isDecisions
            ? t(
                'myWork.hub.analyzeMyDecisionsAnd',
                'Analyze my decisions and propose which to make first.'
              )
            : t(
                'myWork.hub.analyzeMyTasksAnd',
                'Analyze my tasks and propose priorities for today.'
              )
      );
      if (isChatCollapsed) {
        toggleChatCollapse();
      }
    },
    [
      decisionFilter,
      decisionPriorityFilter,
      inboxStatusTab,
      isChatCollapsed,
      isPolish,
      openChatWithContext,
      setChatKickoffMessage,
      taskFilter,
      tasksViewMode,
      toggleChatCollapse,
    ]
  );

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
      setIdeasHomeShell(null);
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
            navigate(`/presentations?tab=${presentationsTabQueryForHomeBridge('outputs_all')}`);
            return;
          }
          if (action.target === 'outputs_mine') {
            navigate(`/presentations?tab=${presentationsTabQueryForHomeBridge('outputs_mine')}`);
            return;
          }
          if (action.target === 'outputs_review') {
            navigate(`/presentations?tab=${presentationsTabQueryForHomeBridge('outputs_review')}`);
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
                  t('myWork.hub.downloadedSpreadsheetXlsx', 'Downloaded spreadsheet (.xlsx)')
                );
              } else {
                toast.error(
                  t('myWork.hub.couldNotDownloadSpreadsheet2', 'Could not download spreadsheet')
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
        case 'handoff': {
          const { executeTriageHandoff } = await import('./Home/useRadarTriageData');
          const result = await executeTriageHandoff(action.signalId);
          if (result) {
            const mod = action.targetModule;
            if (mod === 'initiatives' || mod === 'Inicjatywy') {
              setActiveTab('ideas');
            } else if (mod === 'execution' || mod === 'Wdrożenia') {
              setActiveTab('tasks');
            } else if (mod === 'notebook' || mod === 'Notatki') {
              setActiveTab('notebook');
              setNotebookCreateReqId((value) => value + 1);
            }
          }
          return;
        }
        case 'radar_feedback': {
          const actionType = action.feedback === 'watch' ? 'add_to_watchlist' : 'less_like_this';
          const payload = {
            ...(action.topic ? { topic: action.topic } : {}),
            ...(action.source ? { source: action.source } : {}),
          };
          const Api = (await import('@/services/api')).default;
          await Api.post('/my-work/radar/actions', {
            signalId: action.signalId,
            actionType,
            payload,
          }).catch(() => null);
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
          label: t('myWork.hub.label16', 'Add event'),
          onClick: () => setCalendarCreateReqId((v) => v + 1),
          tone: 'violet' as const,
          variant: 'primary' as const,
        };
      case 'tasks':
        return {
          label: t('myWork.hub.label17', 'New Task'),
          onClick: handleCreateTask,
          tone: 'violet' as const,
          variant: 'primary' as const,
        };
      case 'ideas':
        return {
          label: t('myWork.hub.label18', 'New Idea'),
          onClick: handleCreateIdea,
          tone: 'violet' as const,
          variant: 'primary' as const,
        };
      case 'decisions':
        return {
          label: t('myWork.hub.label19', 'New Decision'),
          onClick: handleCreateDecision,
          tone: 'violet' as const,
          variant: 'primary' as const,
        };
      case 'notebook':
        // Inside a notebook (L2) → create a note. On the library list (L1) → create a notebook.
        return notebookOpenId
          ? {
              label: t('myWork.hub.label20', 'New note'),
              onClick: () => setNotebookCreateReqId((v) => v + 1),
              tone: 'violet' as const,
              variant: 'primary' as const,
            }
          : {
              label: t('myWork.hub.label21', 'New notebook'),
              onClick: () => setNotebookCreateNotebookReqId((v) => v + 1),
              tone: 'violet' as const,
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
    setNotebookCreateNotebookReqId,
    notebookOpenId,
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

  // Render Dynamic Tabs — hub's own openDocuments (gated to the tabs that
  // actually open them, OPEN_DOCUMENT_TABS) PLUS cards DOKLEJONE from a
  // child screen's HubBarSlots registration (`hubBarSlot.openItems`, e.g.
  // Run agent's open processes). Both live in the SAME row/List button —
  // in practice they never populate on the same tab at once (a child clears
  // its slot on unmount), but rendering them side by side is the general,
  // correct form and matches what the owner asked for: ONE Menu 3.
  const renderDynamicTabs = () => {
    const hubDocs = OPEN_DOCUMENT_TABS.includes(activeTab) ? openDocuments : [];
    const childItems = hubBarSlot.openItems ?? [];
    if (hubDocs.length === 0 && childItems.length === 0) return null;

    const childActiveId = hubBarSlot.activeItemId ?? null;
    const isListActive = activeDocumentId === null && childActiveId === null;
    const handleListClick = () => {
      handleShowList();
      hubBarSlot.onShowList?.();
    };

    // ★ TRYB EDYCJI OBIEKTU w scalonej linii. Zaznaczenie na płótnie →
    // narzędzie portaluje pasek edycji do slotu na środku belki. Belka jest
    // ciasna (tożsamość + ~9 grup kontrolek + 5-elementowy klaster poleceń),
    // więc lewa strona KURCZY SIĘ do samego tytułu: znikają „Lista",
    // separator i pille nieaktywnych dokumentów. Odznaczenie = powrót.
    // Dokładnie to, o co prosił właściciel: „na środku tej belki".
    const editing = ideaEditBarActive;
    const visibleHubDocs = editing ? hubDocs.filter((doc) => doc.id === activeDocumentId) : hubDocs;
    const visibleChildItems = editing
      ? childItems.filter((doc) => doc.id === childActiveId)
      : childItems;
    // CIASNOTA PRZY WĄSKIM OKNIE — kolejność ustępowania jest ŚWIADOMA:
    // najpierw ustępuje TOŻSAMOŚĆ (jest powtórzona w tytule karty i w prawym
    // panelu), potem etykieta paska, a NIGDY same kontrolki edycji — właściciel
    // prosił o nie o to, żeby były pod ręką, więc żadna nie ląduje w kebabie.
    // Poniżej 1280 px sam TYTUŁ zwija się do zera (`max-w-0`), zostaje ikona +
    // kropka statusu jako klikalny powrót do dokumentu. Zysk ~300 px dla
    // kontrolek na oknie 900 px.
    const docNameClass = editing ? 'max-w-0 xl:max-w-[150px] truncate' : 'max-w-[150px] truncate';

    return (
      <div className={MENU_3_ROW_CLASS}>
        <div
          className={
            // ⚠ ZNALEZIONE WZROKIEM (nie z testów): `MENU_3_INNER_CLASS` ma
            // `overflow-x-auto`, a `overflow-x: auto` wymusza `overflow-y: auto`
            // — czyli rząd PRZYCINA wszystko, co z niego wystaje w dół. Przy
            // scalonym pasku mieszka tu kebab `⋯`, więc jego rozwijane menu
            // było niewidoczne (klik działał, menu nie było widać). Przy fladze
            // ON zdejmujemy przewijanie z rzędu — przewija się KLASTER PILLI
            // (własne `overflow-x-auto` niżej), więc nic nie ucieka poza ekran.
            ideaTopBarOneLine
              ? 'flex min-h-8 items-center justify-between gap-3 whitespace-nowrap'
              : MENU_3_INNER_CLASS
          }
        >
          <div
            className={`${MENU_3_LEFT_CLASS} overflow-x-auto whitespace-nowrap no-scrollbar ${
              // Jedna linia: pille muszą KURCZYĆ SIĘ i przewijać we własnym
              // kontenerze, żeby klaster poleceń po prawej nigdy nie uciekł
              // poza ekran ani nie nachodził na karty (wąskie okno).
              // W trybie edycji lewa strona przestaje być „elastyczna": oddaje
              // resztę linii paskowi edycji i sama zwęża się do tytułu.
              ideaTopBarOneLine
                ? editing
                  ? 'min-w-0 flex-none max-w-[38%]'
                  : 'min-w-0 flex-1'
                : ''
            }`}
            data-testid={ideaTopBarOneLine ? 'idea-one-line-identity' : undefined}
            data-editing={editing ? 'true' : undefined}
          >
            {/* List button — w trybie edycji ustępuje miejsca kontrolkom. */}
            {editing ? null : (
              <>
                <button
                  onClick={handleListClick}
                  className={
                    isListActive
                      ? TAB_ACTIVE.replace('border-l-2', '')
                      : TAB_INACTIVE.replace('border-l-2', '')
                  }
                  style={{ flexShrink: 0 }}
                >
                  <List size={14} />
                  <span>{t('myWork.hub.list', 'List')}</span>
                </button>

                {/* Separator */}
                <div className="w-px h-6 bg-slate-200/70 dark:bg-white/[0.06] shrink-0" />
              </>
            )}

            {/* Document Tabs (hub's own — tasks/ideas/decisions/inbox) */}
            {visibleHubDocs.map((doc) => {
              const isActive = doc.id === activeDocumentId;
              const leftBorderColor = TYPE_COLORS[doc.type];
              const statusColor = STATUS_COLORS[doc.status] || 'bg-slate-400';

              return (
                <div
                  key={doc.id}
                  className={`group shrink-0 ${isActive ? TAB_ACTIVE : TAB_INACTIVE} ${leftBorderColor} border-l-2`}
                  onClick={() => setActiveDocumentId(doc.id)}
                >
                  {/* Type Icon */}
                  {doc.type === 'task' && <CheckSquare size={14} />}
                  {doc.type === 'idea' && <Lightbulb size={14} />}
                  {doc.type === 'decision' && <Scale size={14} />}
                  {doc.type === 'notification' && <Bell size={14} />}
                  {doc.type === 'initiative' && <Rocket size={14} />}

                  {/* Name (truncated) */}
                  <span className={docNameClass}>{doc.name}</span>

                  {/* Status Dot */}
                  <span className={`w-2 h-2 rounded-full ${statusColor}`} title={doc.status} />

                  {/* Close Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseDocument(doc.id);
                    }}
                    // Sam „X" nie mowi czytnikowi ekranu NIC, a takich przyciskow
                    // jest tyle, ile otwartych kart — nazwa musi wskazywac ktora.
                    title={t('myWork.closeOpenDocument', { nazwa: doc.name })}
                    aria-label={t('myWork.closeOpenDocument', { nazwa: doc.name })}
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.06] transition-all"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}

            {/* Child cards DOKLEJONE z HubBarSlots (np. Run agent — otwarte
                procesy). Te same klasy TAB_ACTIVE/TAB_INACTIVE co karty huba
                wyżej — jedna wizualna rodzina, tylko inne źródło danych. */}
            {visibleChildItems.map((doc) => {
              const isActive = doc.id === childActiveId;
              const Icon = HUB_SLOT_TYPE_ICON[doc.type] || Bot;
              const statusColor = HUB_SLOT_STATUS_DOT[doc.status] || 'bg-slate-400';

              return (
                <div
                  key={doc.id}
                  className={`group shrink-0 ${isActive ? TAB_ACTIVE : TAB_INACTIVE} border-l-2 border-l-indigo-500`}
                  onClick={() => hubBarSlot.onSelectItem?.(doc.id)}
                >
                  <Icon size={14} />
                  <span className={docNameClass}>{doc.name}</span>
                  <span className={`w-2 h-2 rounded-full ${statusColor}`} title={doc.status} />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      hubBarSlot.onCloseItem?.(doc.id);
                    }}
                    title={t('myWork.closeOpenDocument', { nazwa: doc.name })}
                    aria-label={t('myWork.closeOpenDocument', { nazwa: doc.name })}
                    className="p-1 rounded-md opacity-0 group-hover:opacity-100 text-slate-500 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-white/[0.06] transition-all"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          {/*
           * UI-L12 (Editor Shell Canon §2 GÓRNA): removed the "AI Kontekst" button.
           * It was a duplicate entry into Teresa — the canvas command-row already
           * exposes "Omów z Teresą / Discuss with Teresa" (IdeaWorkspaceToolbar).
           * One AI entry per shell; no double doors.
           */}

          {/*
           * SCALENIE GÓRNEGO PASKA IDEI W JEDNĄ LINIĘ (flaga
           * `ff_ideaTopBarOneLine`, domyślnie OFF). Ten pusty węzeł jest CELEM
           * portalu dla klastra poleceń Menu 1 powłoki Idei (Etap · Zapisano ·
           * Teresa · ⋯ · Konwertuj) — patrz `TopBar.mergeSlotId`. Renderujemy
           * go WYŁĄCZNIE przy fladze ON: przy OFF węzła nie ma, więc powłoka
           * sama zostaje przy starym, dwurzędowym układzie.
           */}
          {/*
           * ★ PASEK EDYCJI OBIEKTU — DRUGIE GNIAZDO tej samej belki
           * (`ff_ideaTopBarOneLine` + `ff_canvasObjectEditBar`). Menu 3, gdzie
           * pasek dokował się dotąd, przy jednej linii nie istnieje; bez tego
           * węzła narzędzia wracały do PŁYWAJĄCEGO paska nad zaznaczeniem
           * (zobaczone na zrzucie). Ten sam `id` co gniazdo w Menu 3 — obaj
           * gospodarze wykluczają się wzajemnie, więc `getElementById` w
           * `useObjectEditBarSlot()` zawsze trafia w ten, który akurat żyje.
           *
           * `contents` gdy pusty: nie tworzy pudełka, nie łapie `gap` rodzica,
           * więc belka bez zaznaczenia wygląda BAJT W BAJT jak przed zmianą.
           * `min-w-0` + `flex-1` gdy pełny: kontrolki dostają środek linii i
           * przewijają się WEWNĄTRZ siebie (`ObjectEditBar` ma własny
           * `overflow-x-auto`) — klaster poleceń po prawej nigdy nie ucieka
           * poza ekran, nawet przy 900 px.
           */}
          {ideaEditBarDockEnabled ? (
            <div
              id={CANVAS_OBJECT_EDIT_BAR_SLOT_ID}
              ref={ideaEditBarSlotRef}
              className={editing ? 'flex min-w-0 flex-1 items-center px-1' : 'contents'}
              data-testid="canvas-object-edit-bar-slot"
            />
          ) : null}

          {ideaTopBarOneLine ? (
            <div
              id={IDEA_TOP_BAR_SLOT_ID}
              className="flex shrink-0 items-center gap-1.5 pl-2"
              data-testid="idea-top-bar-one-line-slot"
            />
          ) : null}
        </div>
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
                  ? t('myWork.hub.searchTasks', 'Search tasks...')
                  : activeTab === 'ideas'
                    ? t('myWork.hub.searchIdeas', 'Search ideas...')
                    : activeTab === 'decisions'
                      ? t('myWork.hub.searchDecisions', 'Search decisions...')
                      : activeTab === 'notebook'
                        ? t('myWork.hub.searchNotes', 'Search notes...')
                        : t('myWork.hub.searchInbox', 'Search inbox...')
              }
              autoFocus
              className="w-full pl-10 pr-10 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-600 text-slate-900 dark:text-white placeholder:text-slate-500 dark:text-slate-400 dark:placeholder-slate-500 focus:border-c-focus-solid focus:ring-1 focus:ring-c-focus transition-all"
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

    // 2) Dynamic tabs row (when documents open — hub's own, gated to the
    // tabs that open them — OR a child screen declared cards via HubBarSlots,
    // e.g. Run agent's open processes on the 'agent' tab).
    const hasHubDocsToShow = openDocuments.length > 0 && OPEN_DOCUMENT_TABS.includes(activeTab);
    const hasChildItems = (hubBarSlot.openItems?.length ?? 0) > 0;
    if (!hasBulkMode && (hasHubDocsToShow || hasChildItems)) {
      return renderDynamicTabs();
    }

    // 3) Context counters row (list view default)
    if (activeDocumentId) return null;

    // Notebook library (L1): scope presets in the single Command Row.
    if (activeTab === 'notebook' && !notebookOpenId) {
      const presets: Array<{ id: 'all' | 'personal' | 'team'; label: string; count: number }> = [
        { id: 'all', label: t('myWork.hub.label22', 'All'), count: notebookScopeCounts.all },
        {
          id: 'personal',
          label: t('myWork.hub.label23', 'Personal'),
          count: notebookScopeCounts.personal,
        },
        {
          // #11-extend: mirrors NotebookLibraryContent "Team"→"Organization" fix (#11) —
          // Consultify has no sub-team concept below the org, scope value stays 'team'.
          id: 'team',
          label: t('myWork.hub.label24', 'Organization'),
          count: notebookScopeCounts.team,
        },
      ];
      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
              {presets.map((p) => {
                const isActive = notebookScopeFilter === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setNotebookScopeFilter(p.id)}
                    className={`${MENU_3_CHIP_BASE} ${isActive ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}`}
                    title={p.label}
                  >
                    {p.id === 'all' ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                    ) : p.id === 'personal' ? (
                      <Lock size={12} />
                    ) : (
                      <Users size={12} />
                    )}
                    {p.label}
                    <span
                      className={`${MENU_3_BADGE_BASE} ${isActive ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}`}
                    >
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

    // Notebook L2 (open notebook, no open page): breadcrumb back + page-status
    // filters in ONE Command Row (S1-U2b/c — no drill-down trap, no extra rows).
    if (activeTab === 'notebook' && notebookOpenId && !notebookOpenPageId) {
      // NOTE: the old "Today" preset was superseded on HEAD by the N5 view
      // lenses (Pinned/Recent/To review/Fresh) inside the notebook column.
      const statusPresets: Array<{
        id: 'all' | 'inbox' | 'active';
        label: string;
        icon: React.ReactNode;
      }> = [
        {
          id: 'all',
          label: t('myWork.hub.label25', 'All'),
          icon: <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />,
        },
        {
          id: 'inbox',
          label: t('myWork.hub.label26', 'Inbox'),
          icon: <Inbox size={14} className="text-c-text-muted" />,
        },
        {
          id: 'active',
          label: t('myWork.hub.label27', 'Active'),
          icon: <Sparkles size={14} className="text-c-text-muted" />,
        },
      ];
      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
              {/* Breadcrumb — always-visible way OUT of the notebook (S1-U2b). */}
              <button
                type="button"
                data-testid="notebook-breadcrumb-back"
                onClick={handleNotebookBackToLibrary}
                className={MENU_3_CHIP_INACTIVE}
                title={t('myWork.hub.title', 'Back to notebooks')}
              >
                <ChevronDown size={14} className="rotate-90 text-c-text-muted" />
                {t('myWork.hub.notebooks', 'Notebooks')}
              </button>
              <span className="px-0.5 text-[11px] text-c-text-muted" aria-hidden="true">
                /
              </span>
              <span className="max-w-[180px] truncate text-[12px] font-semibold text-c-text">
                {notebookOpenTitle || t('myWork.hub.notebook2', 'Notebook')}
              </span>
              <span className="mx-1.5 h-4 w-px shrink-0 bg-c-border-subtle" aria-hidden="true" />
              {statusPresets.map((p) => {
                const isActive = notebookPageStatusFilter === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setNotebookPageStatusFilter(p.id)}
                    className={`${MENU_3_CHIP_BASE} ${isActive ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}`}
                    title={p.label}
                  >
                    {p.icon}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Tasks: filters as a single Command Row (no extra toolbars/strips).
    if (activeTab === 'tasks') {
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;

      // V3-A03: bulk selection is a *mode* of the same command row (no extra line).
      if (tasksBulkUi?.selectedCount) {
        const bulk = tasksBulkActionsRef.current;
        const bulkGhostPill =
          'inline-flex h-8 items-center rounded-full px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/[0.06]';

        return (
          <div className={MENU_3_ROW_CLASS}>
            <div className={MENU_3_INNER_CLASS}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {tasksBulkUi.selectedCount} {t('myWork.hub.selected', 'selected')}
                </span>
                <button onClick={() => bulk?.selectAllVisible()} className={bulkGhostPill}>
                  {t('myWork.hub.selectAll', 'Select all')}
                </button>
                <button onClick={() => bulk?.clearSelection()} className={bulkGhostPill}>
                  {t('myWork.hub.clear', 'Clear')}
                </button>
              </div>

              <div className={MENU_3_RIGHT_CLASS}>
                <button onClick={() => bulk?.changePriority()} className={MENU_3_ACTION_NEUTRAL}>
                  <Flag size={14} />
                  {t('myWork.hub.priority', 'Priority')}
                </button>
                <button onClick={() => bulk?.changeDueDate()} className={MENU_3_ACTION_NEUTRAL}>
                  <Calendar size={14} />
                  {t('myWork.hub.dueDate', 'Due date')}
                </button>
                <button onClick={() => bulk?.complete()} className={MENU_3_ACTION_NEUTRAL}>
                  <CheckSquare size={14} />
                  {t('myWork.hub.done', 'Done')}
                </button>
                <button onClick={() => bulk?.deleteSelected()} className={MENU_3_ACTION_DANGER}>
                  <Trash2 size={14} />
                  {t('myWork.hub.delete', 'Delete')}
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
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
                    {f.id === 'all' ? (
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 dark:bg-slate-500" />
                    ) : (
                      f.icon
                    )}
                    <span>{f.label}</span>
                    <span className={`${badgeBase} ${isActive ? badgeActive : badgeInactive}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={MENU_3_RIGHT_CLASS}>
              <button
                onClick={() => void openTabAiContext('tasks')}
                className={MENU_3_ACTION_NEUTRAL}
                type="button"
              >
                <Sparkles size={14} />
                {t('myWork.hub.aIPriorities', 'AI Priorities')}
              </button>
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
          label: t('myWork.hub.label28', 'ALL'),
          count: c?.counts.open ?? tabCounts.inbox,
        },
        { id: 'overdue', label: t('myWork.hub.label29', 'Overdue'), count: c?.overdue ?? 0 },
        { id: 'saved', label: t('myWork.hub.label30', 'Saved'), count: c?.counts.saved ?? 0 },
        { id: 'ai', label: t('myWork.hub.label31', 'AI'), count: c?.ai ?? 0 },
        { id: 'critical', label: t('myWork.hub.label32', 'Critical'), count: c?.critical ?? 0 },
        {
          id: 'action_required',
          label: t('myWork.hub.label33', 'Action required'),
          count: c?.actionRequired ?? 0,
        },
        { id: 'today', label: t('myWork.hub.label34', 'Today'), count: c?.newToday ?? 0 },
        {
          id: 'this_week',
          label: t('myWork.hub.label35', 'This week'),
          count: c?.newThisWeek ?? 0,
        },
        /**
         * P-10 (Piotr, OBR-18/22, 2026-07-27): „Menu trzecie — straszny bałagan.
         * Po prawej stronie te przyciski nie są potrzebne. Zostawiłbym tylko
         * AI Triage, pozostałe są tak samo widoczne po lewej stronie."
         *
         * Segment `Open | Done | Saved`, który stał po PRAWEJ, był w dwóch
         * trzecich dosłownym duplikatem lewej strony: `Open` pokazywał tę samą
         * liczbę co `ALL` (oba = counts.open), a `Saved` istniał tu i tam.
         * Jedyną wartością nie do odzyskania po lewej był `Done` — więc tu
         * dołącza jako zwykły filtr, a prawa strona zostaje slotem AI (kanon A3).
         */
        { id: 'done', label: t('myWork.hub.label37', 'Done'), count: c?.counts.done ?? 0 },
      ];

      const menu3RowClass = MENU_3_ROW_CLASS;
      const menu3InnerClass = MENU_3_INNER_CLASS;
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;

      // V3-A03: bulk selection is a *mode* of the same command row (no extra line).
      if (inboxBulkUi?.selectedCount) {
        const bulkActions = inboxBulkActionsRef.current;
        const bulkGhostPill =
          'inline-flex h-8 items-center rounded-full px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/[0.06]';

        return (
          <div className={MENU_3_ROW_CLASS}>
            <div className={MENU_3_INNER_CLASS}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {inboxBulkUi.selectedCount} {t('myWork.hub.selected2', 'selected')}
                </span>
                <button onClick={() => bulkActions?.selectAllVisible()} className={bulkGhostPill}>
                  {t('myWork.hub.selectAll2', 'Select all')}
                </button>
                <button onClick={() => bulkActions?.clearSelection()} className={bulkGhostPill}>
                  {t('myWork.hub.clear2', 'Clear')}
                </button>
              </div>

              <div className={MENU_3_RIGHT_CLASS}>
                <button
                  onClick={() => bulkActions?.triage('accept_today')}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <Zap size={14} />
                  {t('myWork.hub.focusToday', 'Focus: Today')}
                </button>
                <button
                  onClick={() => bulkActions?.triage('accept_week')}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <CalendarClock size={14} />
                  {t('myWork.hub.thisWeek', 'This week')}
                </button>
                <button
                  onClick={() => bulkActions?.triage('done')}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <CheckSquare size={14} />
                  {t('myWork.hub.done2', 'Done')}
                </button>
                <button
                  onClick={() => bulkActions?.triage('save')}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <FileText size={14} />
                  {t('myWork.hub.save', 'Save')}
                </button>
                <button
                  onClick={() => bulkActions?.triage('dismiss')}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <X size={14} />
                  {t('myWork.hub.dismiss', 'Dismiss')}
                </button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className={menu3RowClass}>
          <div className={menu3InnerClass}>
            <div className={MENU_3_LEFT_CLASS}>
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
                    {p.id === 'all' ? <span className={MENU_3_ALL_DOT_CLASS} /> : null}
                    <span>{p.label}</span>
                    <span className={`${badgeBase} ${isActive ? badgeActive : badgeInactive}`}>
                      {p.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* P-10: prawa strona Menu 3 = wyłącznie AI Triage (kanon A3).
                Segment `Open | Done | Saved` zjechał do filtrów po lewej. */}
            <div className={MENU_3_RIGHT_CLASS}>
              <button
                onClick={() => void openTabAiContext('inbox')}
                className={MENU_3_ACTION_NEUTRAL}
                type="button"
              >
                <Sparkles size={14} />
                {t('myWork.hub.aITriage', 'AI Triage')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Decisions: filters live in Command Row (chips). Priority filter (#39):
    // moved OUT of this row back to the topbar Navigation Bar, left of the
    // view-mode toggle (table/kanban) — see renderNavigationBar/JSX around
    // "Decisions View Mode Toggle". Piotr: priority filter must sit directly
    // left of the view switcher, not down here.
    if (activeTab === 'decisions' && !activeDocumentId && !decisionsBulkUi?.selectedCount) {
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;

      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
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
                    {f.id === 'all' ? <span className={MENU_3_ALL_DOT_CLASS} /> : f.icon}
                    <span>{f.label}</span>
                    <span className={`${badgeBase} ${isActive ? badgeActive : badgeInactive}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={MENU_3_RIGHT_CLASS}>
              {/* #39: Priority chip moved to Navigation Bar (left of view-mode
                  toggle) — see "Decisions View Mode Toggle" in the JSX above
                  renderCommandRow(). Only the AI action stays in this row. */}
              <button
                onClick={() => void openTabAiContext('decisions')}
                className={MENU_3_ACTION_NEUTRAL}
                type="button"
              >
                <Sparkles size={14} />
                {t('myWork.hub.aIDecisions', 'AI Decisions')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Decisions: bulk selection is a *mode* of the same command row (no extra line).
    if (activeTab === 'decisions' && decisionsBulkUi?.selectedCount) {
      const bulk = decisionsBulkActionsRef.current;
      const bulkGhostPill =
        'inline-flex h-8 items-center rounded-full px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/[0.06]';

      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {decisionsBulkUi.selectedCount} {t('myWork.hub.selected3', 'selected')}
              </span>
              <button onClick={() => bulk?.selectAllVisible()} className={bulkGhostPill}>
                {t('myWork.hub.selectAll3', 'Select all')}
              </button>
              <button onClick={() => bulk?.clearSelection()} className={bulkGhostPill}>
                {t('myWork.hub.clear3', 'Clear')}
              </button>
            </div>

            <div className={MENU_3_RIGHT_CLASS}>
              {bulk?.approve ? (
                <button onClick={() => bulk?.approve?.()} className={MENU_3_ACTION_NEUTRAL}>
                  <Check size={14} />
                  {t('myWork.hub.approve', 'Approve')}
                </button>
              ) : null}
              {bulk?.reject ? (
                <button onClick={() => bulk?.reject?.()} className={MENU_3_ACTION_DANGER}>
                  <X size={14} />
                  {t('myWork.hub.reject', 'Reject')}
                </button>
              ) : null}
              {bulk?.remind ? (
                <button onClick={() => bulk?.remind?.()} className={MENU_3_ACTION_NEUTRAL}>
                  <Bell size={14} />
                  {t('myWork.hub.remind', 'Remind')}
                </button>
              ) : null}
              {bulk?.escalate ? (
                <button onClick={() => bulk?.escalate?.()} className={MENU_3_ACTION_NEUTRAL}>
                  <TrendingUp size={14} />
                  {t('myWork.hub.escalate', 'Escalate')}
                </button>
              ) : null}
              {bulk?.snoozeTomorrow ? (
                <button onClick={() => bulk?.snoozeTomorrow?.()} className={MENU_3_ACTION_NEUTRAL}>
                  <Clock size={14} />
                  {t('myWork.hub.snoozeTomorrow', 'Snooze (tomorrow)')}
                </button>
              ) : null}
              {bulk?.changePriority ? (
                <button onClick={() => bulk?.changePriority?.()} className={MENU_3_ACTION_NEUTRAL}>
                  <Flag size={14} />
                  {t('myWork.hub.priority2', 'Priority')}
                </button>
              ) : null}
              {bulk?.deleteSelected ? (
                <button onClick={() => bulk?.deleteSelected?.()} className={MENU_3_ACTION_DANGER}>
                  <Trash2 size={14} />
                  {t('myWork.hub.delete2', 'Delete')}
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
      const menu3RowClass = MENU_3_ROW_CLASS;
      const menu3InnerClass = MENU_3_INNER_CLASS;
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;

      if (ideasBulkUi?.selectedCount) {
        const bulk = ideasBulkActionsRef.current;
        const bulkGhostPill =
          'inline-flex h-8 items-center rounded-full px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:text-slate-300 dark:hover:bg-navy-800 dark:ring-offset-navy-900';

        return (
          <div className={menu3RowClass}>
            <div className={menu3InnerClass}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {ideasBulkUi.selectedCount} {t('myWork.hub.selected4', 'selected')}
                </span>
                <button onClick={() => bulk?.selectAllVisible()} className={bulkGhostPill}>
                  {t('myWork.hub.selectAll4', 'Select all')}
                </button>
                <button onClick={() => bulk?.clearSelection()} className={bulkGhostPill}>
                  {t('myWork.hub.clear4', 'Clear')}
                </button>
              </div>
              <div className={MENU_3_RIGHT_CLASS}>
                <button onClick={() => bulk?.convert()} className={MENU_3_ACTION_NEUTRAL}>
                  <Sparkles size={14} />
                  {t('myWork.hub.convert', 'Convert')}
                </button>
                <button onClick={() => bulk?.tag()} className={MENU_3_ACTION_NEUTRAL}>
                  <Tag size={14} />
                  {t('myWork.hub.tag', 'Tag')}
                </button>
                <button onClick={() => bulk?.deleteSelected()} className={MENU_3_ACTION_DANGER}>
                  <Trash2 size={14} />
                  {t('myWork.hub.delete3', 'Delete')}
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
          label: t('myWork.hub.label39', 'ALL'),
          icon: null,
          count: ideasStageCounts.total,
        },
        {
          id: 'spark',
          // SSOT 2026-07-24 (jak IdeasTableContent.tsx:~506): etykieta z
          // getIdeaStageBucketLabel, nie z osobnego klucza t() — te dryfowały
          // (PL "Kształtuje" bez "się" w translation.json vs SSOT poniżej).
          label: getIdeaStageBucketLabel('spark', isPolish),
          icon: <Lightbulb size={14} className="text-amber-600 dark:text-amber-300" />,
          count: ideasStageCounts.spark,
        },
        {
          id: 'incubating',
          label: getIdeaStageBucketLabel('incubating', isPolish),
          icon: <Sprout size={14} className="text-emerald-600 dark:text-emerald-300" />,
          count: ideasStageCounts.incubating,
        },
        {
          id: 'shaping',
          label: getIdeaStageBucketLabel('shaping', isPolish),
          icon: <TreePine size={14} className="text-blue-600 dark:text-blue-300" />,
          count: ideasStageCounts.shaping,
        },
        {
          id: 'ready',
          label: getIdeaStageBucketLabel('ready', isPolish),
          icon: <CheckCircle2 size={14} className="text-blue-600 dark:text-blue-300" />,
          count: ideasStageCounts.ready,
        },
        {
          id: 'promoted',
          label: getIdeaStageBucketLabel('promoted', isPolish),
          icon: <Rocket size={14} className="text-blue-600 dark:text-blue-300" />,
          count: ideasStageCounts.promoted,
        },
      ];

      // S1-U1: folders + starred + recents live in THIS row as dropdown/toggle
      // chips (right cluster) — never as extra rows above the table.
      const shell = ideasHomeShell;
      const activeFolder = shell?.folders.find((f) => f.id === shell.activeFolderId) || null;
      const showStarChip = Boolean(shell && (shell.starredCount > 0 || shell.showStarredOnly));

      return (
        <div className={menu3RowClass}>
          <div className={menu3InnerClass}>
            <div className={MENU_3_LEFT_CLASS}>
              {stagePresets.map((p) => {
                const isActive = ideaStageFilter === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setIdeaStageFilter(isActive && p.id !== 'all' ? 'all' : p.id)}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                  >
                    {p.icon || <span className={MENU_3_ALL_DOT_CLASS} />}
                    <span>{p.label}</span>
                    <span className={`${badgeBase} ${isActive ? badgeActive : badgeInactive}`}>
                      {p.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className={MENU_3_RIGHT_CLASS}>
              {shell?.foldersAvailable ? (
                <Menu3DropdownChip
                  data-testid="ideas-folder-chip"
                  icon={<Folder size={14} className="text-c-text-muted" />}
                  label={activeFolder ? activeFolder.name : t('myWork.hub.name9', 'Folder')}
                  active={Boolean(activeFolder)}
                  ariaLabel={t('myWork.hub.ariaLabel', 'Filter by folder')}
                  align="right"
                  items={[
                    {
                      id: 'all',
                      label: t('myWork.hub.label45', 'All ideas'),
                      icon: <Layers size={14} />,
                      active: !activeFolder,
                      onSelect: () => shell.selectFolder(null),
                    },
                    ...shell.folders.map((f) => ({
                      id: f.id,
                      label: f.name,
                      icon: <Folder size={14} />,
                      active: shell.activeFolderId === f.id,
                      trailing: shell.activeFolderId === f.id ? '✓' : undefined,
                      onSelect: () => shell.selectFolder(f.id),
                    })),
                    {
                      id: 'new-folder',
                      label: t('myWork.hub.label46', 'New folder…'),
                      icon: <FolderPlus size={14} />,
                      dividerBefore: true,
                      onSelect: () => shell.createFolder(),
                    },
                    ...(activeFolder
                      ? [
                          {
                            id: 'delete-folder',
                            label: t('myWork.hub.label47', 'Delete this folder'),
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onSelect: () => shell.deleteFolder(activeFolder.id),
                          },
                        ]
                      : []),
                  ]}
                />
              ) : null}
              {showStarChip && shell ? (
                <button
                  type="button"
                  data-testid="ideas-starred-chip"
                  onClick={() => shell.toggleStarredOnly()}
                  aria-pressed={shell.showStarredOnly}
                  title={t('myWork.hub.title2', 'Starred only')}
                  className={shell.showStarredOnly ? chipActive : chipInactive}
                >
                  <Star
                    size={14}
                    className={
                      shell.showStarredOnly ? 'fill-amber-400 text-amber-400' : 'text-c-text-muted'
                    }
                  />
                  <span>{t('myWork.hub.starred', 'Starred')}</span>
                  <span
                    className={`${badgeBase} ${shell.showStarredOnly ? badgeActive : badgeInactive}`}
                  >
                    {shell.starredCount}
                  </span>
                </button>
              ) : null}
              {shell && shell.recents.length > 0 ? (
                <Menu3DropdownChip
                  data-testid="ideas-recent-chip"
                  icon={<History size={14} className="text-c-text-muted" />}
                  label={t('myWork.hub.label48', 'Recent')}
                  ariaLabel={t('myWork.hub.ariaLabel2', 'Recently opened')}
                  align="right"
                  items={shell.recents.map((r) => ({
                    id: r.id,
                    label: r.title,
                    icon: <Lightbulb size={14} />,
                    onSelect: () => shell.openRecent(r.id),
                  }))}
                />
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    /**
     * PILNE-6 (przegląd 128 zrzutów, 2026-07-27; uwaga Piotra P-17 o Sejfie:
     * „Ta tabela jest w ogóle wbrew jakimkolwiek standardom"):
     *
     * Poniższy pasek to fallback „alerty z innych zakładek" (Overdue / Urgent /
     * Decisions (pending) / Inbox). Dla zakładek `vault` i `agent` — które mają
     * WŁASNE tabele, ale nie mają jeszcze własnych filtrów — oznaczało to, że
     * na ekranie dokumentów klienta stały liczniki zaległych ZADAŃ i oczekujących
     * DECYZJI. Oba ekrany pokazywały co do sztuki te same cztery chipy, bo brały
     * je z tego samego miejsca; użytkownik dostawał filtry, które nie filtrują
     * niczego, co widzi pod spodem.
     *
     * Menu 3 należy do tabeli, nad którą stoi. Skoro te dwie jeszcze nie mają
     * czym go wypełnić, pasek się nie renderuje — to zdejmuje przy okazji jedną
     * z czterech warstw nagłówkowych, na które Piotr zwrócił uwagę (P-17/P-18).
     */
    if (activeTab === 'vault' || activeTab === 'agent') return null;

    // Default cross-tab alerts (tasks/decisions/inbox)
    const chips: Array<{ key: string; label: string; count: number; onClick: () => void }> = [
      {
        key: 'tasks-overdue',
        label: t('myWork.hub.label49', 'Overdue'),
        count: taskFilterCounts.overdue,
        onClick: () => {
          setActiveTab('tasks');
          setTaskFilter('overdue');
          setActiveDocumentId(null);
        },
      },
      {
        key: 'tasks-urgent',
        label: t('myWork.hub.label50', 'Urgent'),
        count: taskFilterCounts.urgent,
        onClick: () => {
          setActiveTab('tasks');
          setTaskFilter('urgent');
          setActiveDocumentId(null);
        },
      },
      {
        key: 'decisions-pending',
        label: t('myWork.hub.label51', 'Decisions (pending)'),
        count: decisionFilterCounts.my + decisionFilterCounts.awaiting,
        onClick: () => {
          setActiveTab('decisions');
          setDecisionFilter('my');
          setActiveDocumentId(null);
        },
      },
      {
        key: 'inbox',
        label: t('myWork.hub.label52', 'Inbox'),
        count: tabCounts.inbox,
        onClick: () => {
          setActiveTab('inbox');
          setActiveDocumentId(null);
        },
      },
    ];

    const visible = chips.filter((c2) => c2.count > 0).slice(0, 4);
    return (
      <div className={MENU_3_ROW_CLASS}>
        <div className={MENU_3_INNER_CLASS}>
          <div className={MENU_3_LEFT_CLASS}>
            {visible.length > 0 ? (
              visible.map((c2) => (
                <button key={c2.key} onClick={c2.onClick} className={MENU_3_CHIP_INACTIVE}>
                  <span>{c2.label}</span>
                  <span className={MENU_3_BADGE_INACTIVE}>{c2.count}</span>
                </button>
              ))
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('myWork.hub.noAlerts', 'No alerts')}
              </div>
            )}
          </div>
          <div className="shrink-0" />
        </div>
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
              activeTool={activeIdeaWorkspaceState?.activeTool || ideaActiveTool}
              onActiveToolChange={handleIdeaToolChange}
              activePanel={activeIdeaWorkspaceState?.activePanel || ideaActivePanel}
              onActivePanelChange={handleIdeaPanelChange}
              onSelectionChange={handleIdeaSelectionChange}
              onLockedChange={handleIdeaLockedChange}
              onGraphSummaryChange={handleIdeaGraphSummaryChange}
              onTableContextChange={setIdeaTableContext}
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
      case 'initiative':
        return (
          <React.Suspense fallback={lazyFallback}>
            <InitiativeFullView
              initiativeId={activeDoc.id}
              onBack={() => handleCloseDocument(activeDoc.id)}
              onStatusChange={() => setRefreshTrigger((n) => n + 1)}
            />
          </React.Suspense>
        );
      default:
        return null;
    }
  };

  // Render list content based on active tab
  const renderListContent = () => {
    // Radar (home) is hidden/paused — never mount HomeView (its scanning hooks are
    // memory-heavy); fall back to the inbox surface instead.
    const tabToRender: ModuleTab =
      !RADAR_ENABLED && activeTab === 'home' ? MY_WORK_FALLBACK_TAB : activeTab;
    switch (tabToRender) {
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
                  {t(
                    'myWork.hub.accessRestrictedAdminOr',
                    'Access restricted. Admin or Manager role required.'
                  )}
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
              onInitiativeClick={(initiativeId) => handleInitiativeClick(String(initiativeId))}
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
            onHomeShellChange={handleIdeasHomeShellChange}
            refreshTrigger={refreshTrigger}
          />
        );
      case 'notebook':
        // Show the L1 library only when neither a notebook nor a specific page
        // is targeted. A deep-linked page (e.g. "open source note" from a task)
        // bypasses the library and opens the editor directly.
        if (!notebookOpenId && !notebookOpenPageId) {
          return (
            <NotebookLibraryContent
              searchQuery={searchQuery}
              refreshTrigger={refreshTrigger}
              createRequestId={notebookCreateNotebookReqId}
              scopeFilter={notebookScopeFilter}
              onScopeCountsChange={setNotebookScopeCounts}
              onOpenNotebook={(nb) => {
                setNotebookOpenId(nb.id);
                setNotebookOpenTitle(nb.title);
                setNotebookOpenPageId(null);
                const next = new URLSearchParams(searchParams);
                next.set('notebook', nb.id);
                next.delete('note');
                setSearchParams(next, { replace: false });
              }}
            />
          );
        }
        return (
          <React.Suspense fallback={lazyFallback}>
            <NotebookContent
              projectId={null}
              notebookId={notebookOpenId}
              notebookTitle={notebookOpenTitle}
              onBackToLibrary={handleNotebookBackToLibrary}
              searchQuery={searchQuery}
              openPageId={notebookOpenPageId}
              pageStatusFilter={notebookPageStatusFilter}
              onPageStatusFilterChange={setNotebookPageStatusFilter}
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
        // Timeline view is intentionally disabled for Decisions — it is not exposed in the
        // view switcher and must never render even if a stale 'timeline' value is present;
        // fall through to the default list (table) view below.
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
      case 'vault':
        // VLT-004 (relokacja Client Vault z menu głównego). ClientDocumentsVault
        // self-gates on isClientVaultEnabled() — the tab entry is already filtered
        // out when the flag is off, this is a second, defensive gate.
        return (
          <React.Suspense fallback={lazyFallback}>
            {/**
             * P-17 (czwarta warstwa Sejfu) rozwiązany po stronie samego Sejfu,
             * mechanizmem `useHubBarSlot` — zakładka wstrzykuje swoją lupę do
             * paska TEGO huba, zamiast rysować własny.
             *
             * Scalenie 2026-07-28: ta sama uwaga była naprawiana równolegle w
             * dwóch sesjach. Moja wersja przekazywała frazę propem
             * `searchQuery`; wersja z demo jest pełniejsza (zachowuje
             * wyszukiwanie zamiast je usuwać), więc to ona zostaje. Prop
             * zniknął CELOWO — komponent go nie przyjmuje, a React ignoruje
             * nieznane propy po cichu (regresja 07-26 kosztowała na tym dzień).
             */}
            <ClientDocumentsVault />
          </React.Suspense>
        );
      case 'agent':
        // AGT-010: powłoka (Moje procesy | Szablony) PRZED AgentPlanWorkspace —
        // patrz komentarz przy lazy import AgentHubShell powyżej.
        return (
          <React.Suspense fallback={lazyFallback}>
            <AgentHubShell />
          </React.Suspense>
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
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200/60 dark:border-white/[0.05]">
        {/* Main Navigation Row */}
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          {/* Left: Search + Main Tabs */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-full border transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                showSearch
                  ? 'bg-slate-900/[0.07] dark:bg-white/10 border-slate-300 dark:border-white/25 text-slate-900 dark:text-slate-100'
                  : 'bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.06] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
              }`}
              title={t('myWork.hub.title3', 'Search')}
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
                      if (tab.isLocked) {
                        if (tab.betaLocked) {
                          dispatchBetaAccessBlocked(t('access.blocked.BETA_LOCKED'));
                        } else {
                          const detail = getPilotLockedAreaDetail('IDEAS_TAB', tab.label);
                          dispatchPilotAccessBlocked({
                            message: detail.message,
                            href: detail.href,
                          });
                        }
                        return;
                      }
                      setActiveTab(tab.id);
                      // Close document when switching tabs to show list view
                      setActiveDocumentId(null);
                    }}
                    className={isActive ? BUTTON_ACTIVE : BUTTON_INACTIVE}
                    data-testid={`mywork-tab-${tab.id}`}
                    title={
                      tab.isLocked
                        ? tab.betaLocked
                          ? t('access.blocked.BETA_LOCKED')
                          : getPilotLockedAreaDetail('IDEAS_TAB', tab.label).message
                        : undefined
                    }
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.isLocked && <Lock size={14} className="opacity-70" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right cluster (KANON v3, left→right): Filters → View → Tool → Add → Area */}
          <div className="flex items-center gap-3 min-w-0 flex-shrink-0">
            {/* Scrollable controls (keep primary action always visible) */}
            <div className="flex items-center gap-3 min-w-0 overflow-x-auto whitespace-nowrap">
              {/* HubBarSlots — filtr zadeklarowany przez ekran-dziecko (np.
                  Run agent "Moje procesy | Szablony"). Kontrakt:
                  filterControls → lewa część prawego klastra (patrz
                  HubBarSlots.tsx). Dziecko samo decyduje KIEDY go rejestruje
                  (np. tylko na liście, nie w otwartym procesie). */}
              {hubBarSlot.filterControls}

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
                    focus:border-c-focus-solid focus:ring-2 focus:ring-c-focus
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

              {/* Decisions: priority filter moved INTO the Command Row (Menu-3
                  dropdown chip) — S1-U1 single dynamic line, no topbar select. */}

              {/* View tools */}
              {/* Tasks View Mode Toggle (icons; no dropdown) */}
              {activeTab === 'tasks' && !activeDocumentId && (
                <div
                  className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
                  role="radiogroup"
                  aria-label={t('myWork.hub.ariaLabel3', 'Tasks view mode')}
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
                        className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                          isActive
                            ? 'bg-white/80 dark:bg-navy-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
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

              {/* #39: Priority filter — moved here (left of the view-mode
                  toggle) per Piotr: filter musi być NA LEWO od przełącznika
                  widoków. Previously lived in the Command Row (Menu 3) as a
                  Menu3DropdownChip; same component, same behavior, new spot. */}
              {activeTab === 'decisions' &&
                !activeDocumentId &&
                (() => {
                  const decisionsPriorityOptions: Array<{
                    id: DecisionPriorityFilter;
                    label: string;
                  }> = [
                    { id: 'all', label: t('myWork.hub.label53', 'All') },
                    { id: 'CRITICAL', label: t('myWork.hub.label54', 'Critical') },
                    { id: 'HIGH', label: t('myWork.hub.label55', 'High') },
                    { id: 'MEDIUM', label: t('myWork.hub.label56', 'Medium') },
                    { id: 'LOW', label: t('myWork.hub.label57', 'Low') },
                  ];
                  const activeDecisionsPriority = decisionsPriorityOptions.find(
                    (p) => p.id === decisionPriorityFilter
                  );
                  const decisionsPriorityActive = decisionPriorityFilter !== 'all';
                  return (
                    <Menu3DropdownChip
                      data-testid="mywork-decisions-priority-chip"
                      // P-15: ten chip stoi w Menu 2, wiec ma miec h-9 jak sasiedzi.
                      bar="menu2"
                      icon={<Flag size={14} className="text-c-text-muted" />}
                      label={
                        decisionsPriorityActive && activeDecisionsPriority
                          ? `${t('myWork.hub.priority3', 'Priority')}: ${activeDecisionsPriority.label}`
                          : t('myWork.hub.priority4', 'Priority')
                      }
                      active={decisionsPriorityActive}
                      ariaLabel={t('myWork.hub.ariaLabel4', 'Priority filter')}
                      align="left"
                      items={decisionsPriorityOptions.map((p) => ({
                        id: p.id,
                        label: p.label,
                        active: decisionPriorityFilter === p.id,
                        trailing: decisionPriorityFilter === p.id ? '✓' : undefined,
                        onSelect: () => setDecisionPriorityFilter(p.id),
                      }))}
                    />
                  );
                })()}

              {/* Decisions View Mode Toggle (icons; no dropdown) */}
              {activeTab === 'decisions' && !activeDocumentId && (
                <div
                  className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
                  role="radiogroup"
                  aria-label={t('myWork.hub.ariaLabel5', 'Decisions view mode')}
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
                      // Timeline (Day/Week/Month/Quarter) view intentionally hidden — not a
                      // sensible view for Decisions. Component retained but unselectable.
                    ] as const
                  ).map(({ id, icon: Icon, titlePl, titleEn }) => {
                    const isActive = decisionsViewMode === id;
                    return (
                      <button
                        key={id}
                        onClick={() => setDecisionsViewMode(id)}
                        className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                          isActive
                            ? 'bg-white/80 dark:bg-navy-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
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
                  aria-label={t('myWork.hub.ariaLabel6', 'View mode')}
                >
                  <button
                    onClick={() => setInboxViewMode('flat')}
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                      inboxViewMode === 'flat'
                        ? 'bg-white/80 dark:bg-navy-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'
                    }`}
                    title={t('myWork.hub.title4', 'List')}
                    role="radio"
                    aria-checked={inboxViewMode === 'flat'}
                  >
                    <LayoutList size={16} />
                  </button>
                  <button
                    onClick={() => setInboxViewMode('sections')}
                    className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                      inboxViewMode === 'sections'
                        ? 'bg-white/80 dark:bg-navy-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'
                    }`}
                    title={t('myWork.hub.title5', 'Cards')}
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
                <WorkspacePanelStrip
                  value={activeIdeaWorkspaceState?.activePanel || ideaActivePanel}
                  onChange={handleIdeaPanelChange}
                />
              )}

              {/* Ideas: canonical view mode switcher — table / grid */}
              {activeTab === 'ideas' && !activeDocumentId && (
                <div
                  className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
                  role="radiogroup"
                  aria-label={t('myWork.hub.ariaLabel7', 'Ideas view mode')}
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
                      className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
                        ideasViewMode === id
                          ? 'bg-white/80 dark:bg-navy-800 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
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

              {/* Workspace 3-tools strip — Notebook only (when the editor is shown,
                  i.e. inside an open notebook or on a deep-linked page).
                  N2 redesign: redundant — Tools/Context/AI panels now live inside the
                  notebook window (NotebookRightRail). Hidden behind a reversible flag;
                  flip SHOW_LEGACY_NOTEBOOK_TOOLS_STRIP back to `true` to restore. */}
              {SHOW_LEGACY_NOTEBOOK_TOOLS_STRIP &&
                activeTab === 'notebook' &&
                !activeDocumentId &&
                (notebookOpenId || notebookOpenPageId) && (
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

            {/* Primary Action Button (New Task/Decision/Notification) —
                HubBarSlots: gdy ekran-dziecko (np. Run agent "Nowy agent")
                zadeklarował `primaryCta`, WYGRYWA nad hub-owym per-tab
                `actionButton` (kontrakt HubBarSlots.tsx — jeden CTA na
                ekran, kontekstowy dla tego, co user właśnie widzi). Ikona
                (AGT-015 §6 D1) — te same klasy/rozmiar co `StandardModuleBar`
                `primaryCta.icon` (`size={16}`, patrz `StandardModuleBar.tsx`
                ok. linii 383): opcjonalna, dziecko może jej nie podać. */}
            {hubBarSlot.primaryCta ? (
              <button
                onClick={hubBarSlot.primaryCta.onClick}
                disabled={hubBarSlot.primaryCta.disabled}
                className={`${CTA_BASE} ${CTA_TONE.violet} disabled:opacity-60 disabled:cursor-not-allowed`}
                data-testid={hubBarSlot.primaryCta.testId || 'mywork-action-button'}
              >
                {hubBarSlot.primaryCta.icon ? <hubBarSlot.primaryCta.icon size={16} /> : null}
                <span>{hubBarSlot.primaryCta.label}</span>
              </button>
            ) : (
              actionButton && (
                <button
                  onClick={actionButton.onClick}
                  className={`${CTA_BASE} ${CTA_TONE[actionButton.tone]}`}
                  data-testid="mywork-action-button"
                >
                  <span>{actionButton.label}</span>
                </button>
              )
            )}

            {/* D-01 (Piotr, OBR-28 2026-07-27): uniwersalny „+ New" USUNIĘTY —
                CTA jest kontekstowe per zakładka (`actionButton` wyżej).
                Zakładki bez własnego tworzenia (Inbox, Client Vault, Home,
                Manager) świadomie nie mają CTA. Launcher 3-w-1 był jedynym
                żywym callerem `NewDecisionModal` — decyzje tworzy się dziś
                przez „New Decision" (DecisionDetailView). */}

            {/* Ideas detail AI action lives in Menu 3 right slot. */}
          </div>
        </div>
      </div>
      {/* Command Row (search | dynamic tabs | counters) */}
      {renderCommandRow()}

      {/* Main Content Area — calendar needs overflow-hidden + flex-col so FC owns the scroll (sticky headers) */}
      <div
        className={getMyWorkMainContentClassName({
          activeDocumentId,
          activeTab,
          ideasViewMode,
        })}
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

/**
 * Publiczny MyWorkHub = provider slotów paska + treść huba.
 * Ekrany-dzieci (AgentHubShell, ClientDocumentsVault) deklarują swoje elementy
 * paska przez `useHubBarSlot`; `MyWorkHubInner` czyta je przez `useHubBar`
 * i wplata w SWOJE Menu 2/3 — zamiast pozwalać dziecku rysować drugi pasek.
 */
export const MyWorkHub: React.FC<MyWorkHubProps> = (props) => (
  <HubBarSlotsProvider>
    <MyWorkHubInner {...props} />
  </HubBarSlotsProvider>
);

export default MyWorkHub;
