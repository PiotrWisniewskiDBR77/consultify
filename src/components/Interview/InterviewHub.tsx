/**
 * InterviewHub
 * Unified Interview module with ModuleHub pattern (Golden Standard)
 *
 * Tabs: Sessions, Insights, Templates
 * Features:
 * - Dynamic tabs for open documents
 * - Table/Grid views for listing items
 * - Full document view when selected
 * - Command Row: context counters
 *
 * @see docs/wdrozenia/UI_UX_GOLDEN_STANDARD.md
 */

import {
  AlertTriangle,
  Archive,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  Brain,
  Calendar,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Columns3,
  Compass,
  Copy,
  Download,
  Edit2,
  ExternalLink,
  Eye,
  FilePlus,
  FileText,
  Gauge,
  GitFork,
  Grid3X3,
  Inbox,
  LayoutGrid,
  LayoutList,
  Lightbulb,
  List,
  Loader2,
  MessageSquare,
  MoreVertical,
  Presentation,
  Rocket,
  RotateCcw,
  Send,
  ShieldAlert,
  Sparkles,
  Star,
  StarOff,
  Target,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { InitiativeWizardModal } from '@/components/Initiatives/Wizard/InitiativeWizardModal';
import {
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
import { EmptyStateInline } from '@/components/shared/NModeBlocks';
import { EmptyState, LoadingState } from '@/components/shared/states';
import { TeresaMark } from '@/components/shared/TeresaMark';
import {
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';
import { Badge, type BadgeVariant } from '@/components/ui/primitives';
import { AssigneeCell, ProgressCell } from '@/components/ui/primitives/cells';
import {
  categoryTone,
  DueChip,
  EntityStatusChip,
  PriorityChip,
  type PriorityLevel,
  statusChipTone,
} from '@/components/ui/primitives/chips';
import { type TableFilters } from '@/components/ui/ResizableTable';
import { getTypeStyle } from '@/constants/statusColors';
import { useInterviewPermissions } from '@/hooks/useInterviewPermissions';
import { useOpenChatWithContext } from '@/hooks/useOpenChatWithContext';
import { Api, shouldAllowDemoData } from '@/services/api';
import { V8InterviewApi } from '@/services/api/v8/interview';
import { useAppStore } from '@/store/useAppStore';
import { isInterviewPendingReviewTabEnabled } from '@/utils/interviewPendingReviewTabFlag';
import { isInterviewPipelineStepperEnabled } from '@/utils/interviewPipelineStepperFlag';
import { formatListDate } from '@/utils/listDateFormat';

import {
  type FilterChip,
  type ModuleTab,
  type OpenDocument as SharedOpenDocument,
  type ViewMode,
} from '../shared/ModuleHub';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import { RowActionsMenu } from '../shared/RowActionsMenu';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { StandardModuleBar } from '../standard/StandardModuleBar';
import { AssignInterviewModal } from './AssignInterviewModal';
import { InsightCreatorModal } from './InsightCreatorModal';
import { InsightViewer } from './InsightViewer';
import {
  InterviewAssignmentPreviewBody,
  InterviewAssignmentPreviewFooter,
} from './InterviewAssignmentPreview';
import { createInterviewDemoDataset, isInterviewDemoId } from './interviewDemoData';
import { getSafeInterviewErrorMessage } from './interviewErrorCopy';
import { InterviewInitiativePreviewFooter } from './InterviewInitiativePreview';
import {
  InterviewInsightPreviewBody,
  InterviewInsightPreviewFooter,
} from './InterviewInsightPreview';
import { type InterviewPipelineStep, InterviewPipelineStepper } from './InterviewPipelineStepper';
import {
  InterviewSessionPreviewBody,
  InterviewSessionPreviewFooter,
} from './InterviewSessionPreview';
import {
  InterviewTemplatePreviewBody,
  InterviewTemplatePreviewFooter,
} from './InterviewTemplatePreview';
import { InterviewWorkspace } from './InterviewWorkspace';
import { TemplateBuilder } from './TemplateBuilder';
import {
  getTemplateAreaTagLabel,
  getTemplateSourceLabel,
  INTERVIEW_TEMPLATE_AREA_TAG_OPTIONS,
  normalizeInterviewTemplateAreaTags,
  type TemplateScope,
  type TemplateSourceFilter,
} from './templateLibraryMeta';

// Helper function to safely display error messages
const safeToastError = (error: any, defaultMessage: string, _isPolish: boolean) => {
  toast.error(getSafeInterviewErrorMessage(error, defaultMessage));
};

/**
 * Strip raw markdown so an insight's row sub-text reads as clean plain text.
 * Removes leading heading hashes, bold/italic markers, inline-code backticks,
 * list bullets, and collapses markdown table pipes / whitespace. Used ONLY for
 * the Insights table row description preview (not for full rendering).
 */
const stripInsightMarkdownPreview = (raw: string): string => {
  if (!raw) return '';
  return raw
    .replace(/`+/g, '') // inline code / fences
    .replace(/^\s*#{1,6}\s*/gm, '') // leading heading hashes
    .replace(/\*\*/g, '') // bold
    .replace(/[*_]/g, '') // italics / emphasis
    .replace(/^\s*[-+>]\s+/gm, '') // list bullets / blockquotes
    .replace(/\|/g, ' ') // collapse table pipes
    .replace(/\s+/g, ' ') // collapse whitespace/newlines
    .trim();
};

const INTERVIEW_CREATE_SESSION_TOAST_ID = 'interview-create-session';

// #10 — assignment status filter option order (Assignments table columns),
// used to derive the per-column filterOptions in a stable, canonical order.
const ASSIGNMENT_STATUS_OPTION_ORDER = [
  'assigned',
  'in_progress',
  'submitted',
  'sent_back',
  'review',
  'approved',
  'completed',
  'rejected',
  'accepted',
];

// L-07 / D-03 — canonical pipeline stage numerals ①–⑥ over the flat tabs. Lifted
// to module scope so both the `tabs` labels (withStep) and the `pipelineSteps`
// stepper (D-03) derive from one source. Sessions has no numeral (side view).
const INTERVIEW_PIPELINE_NUMERAL: Record<string, string> = {
  templates: '①',
  managed: '②',
  my_assignments: '③',
  pending_review: '④',
  insights: '⑤',
  initiatives: '⑥',
};
// Pipeline stage order (left→right) for the D-03 stepper.
const INTERVIEW_PIPELINE_STAGE_ORDER = [
  'templates',
  'managed',
  'my_assignments',
  'pending_review',
  'insights',
  'initiatives',
] as const;

// (Sessions/Templates/Assignments/Initiatives column-visibility + width
// defaults + persistence keys + hidden-columns/boolean-setting/column-width
// localStorage helpers all retired — StandardTable's own TableSettingsPopover
// + `persistKey` manage these now; Triada standard.)

// Types
interface InterviewSession {
  id: string;
  organizationId: string;
  projectId?: string;
  name: string;
  ownerId: string;
  status: string;
  sessionRuntimeStatus?: string;
  assignmentId?: string;
  assignmentStatus?: string;
  assignmentPriority?: 'low' | 'medium' | 'high' | 'urgent' | string;
  assignmentCreatedBy?: string;
  totalQuestions: number;
  answeredQuestions: number;
  startedAt: string;
  completedAt?: string;
  lastActivityAt?: string;
  templateName?: string;
  templateCategory?: string;
  respondentId?: string;
  respondentName?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  dueAt?: string;
  submittedAt?: string;
  sentBackAt?: string;
  sentBackReason?: string;
}

interface InterviewInsight {
  id: string;
  sessionId?: string;
  organizationId?: string;
  title: string;
  content?: string;
  description?: string;
  sourceQuote?: string;
  type?: string;
  category?: string;
  insightType?: string;
  promptType?: string;
  priority?: 'low' | 'medium' | 'high';
  impactLevel?: string;
  confidence?: string;
  status?: string;
  reviewStatus?: 'draft' | 'in_review' | 'published';
  publishedAt?: string;
  reviewedBy?: string;
  actionable?: boolean;
  exportedToTools?: boolean;
  exportedToAssessment?: boolean;
  archivedAt?: string | null;
  sourceSessionCount?: number;
  tokensUsed?: number;
  generationTimeMs?: number;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface InterviewInitiativeDraft {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  impact?: string;
  effort?: string;
  category?: string;
  sourceType?: string;
  sourceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

// Lineage read-back: decisions/tasks created from interview findings are tagged
// source_type='interview_insight' on the backend. We fetch them via the my-work
// list endpoints with ?source=interview_insight to close the write-only gap and
// surface the lineage in the Initiatives tab. Honest empty state when none.
interface InterviewLineageItem {
  id: string;
  title?: string;
  name?: string;
  status?: string;
  priority?: string;
  sourceType?: string;
  sourceId?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface InterviewTemplate {
  id: string;
  organizationId?: string;
  name: string;
  description: string;
  questionCount: number;
  category: string;
  isDefault: boolean;
  scope?: TemplateScope;
  audience?: string;
  estimatedTimeMinutes?: number;
  runtimeModeDefault?: 'task_list' | 'one_question_per_screen';
  areaTags?: string[];
  status?: string;
  sessionsUsed?: number;
  updatedAt?: string;
  createdAt: string;
}

// NOTE: Synthetic "derived initiatives" generator was intentionally removed.
// The Interview > Initiatives tab MUST show only real persisted initiatives
// returned from /initiatives?source=interview_insight. Honest empty state is
// surfaced via the table empty row + the "Dodaj inicjatywy" wizard CTA.
// Adding fake rows breaks traceability and parity with the Initiatives module.

type InterviewTab =
  | 'my_assignments'
  | 'sessions'
  | 'templates'
  | 'insights'
  | 'initiatives'
  | 'managed'
  | 'pending_review';

/**
 * Pure tab-resolution contract for the Interview hub. Encodes which `?tab=`
 * deep-links are honored and how restricted tabs degrade to the always-safe
 * `my_assignments` inbox when the viewer lacks the relevant permission.
 * Kept side-effect-free so it can be unit-tested in isolation (see
 * `__private__` below).
 */
function isInterviewTab(value: string): value is InterviewTab {
  return (
    value === 'my_assignments' ||
    value === 'sessions' ||
    value === 'templates' ||
    value === 'insights' ||
    value === 'initiatives' ||
    value === 'managed' ||
    value === 'pending_review'
  );
}

function resolveInterviewTabFromSearchParams(
  searchParams: URLSearchParams,
  permissions: { canViewManaged: boolean; canViewTemplates: boolean; canViewInsights: boolean }
): InterviewTab | null {
  const rawTab = String(searchParams.get('tab') || '')
    .trim()
    .toLowerCase();
  if (!isInterviewTab(rawTab)) return null;

  if (rawTab === 'managed' || rawTab === 'sessions') {
    return permissions.canViewManaged ? rawTab : 'my_assignments';
  }
  if (rawTab === 'templates') {
    return permissions.canViewTemplates ? 'templates' : 'my_assignments';
  }
  if (rawTab === 'insights' || rawTab === 'pending_review' || rawTab === 'initiatives') {
    return permissions.canViewInsights ? rawTab : 'my_assignments';
  }
  return rawTab;
}

type InsightsViewMode = 'flat' | 'report';
type ItemStatus =
  | 'draft'
  | 'drafting'
  | 'in_review'
  | 'review'
  | 'approved'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'active'
  | 'archived'
  | 'assigned'
  | 'in_progress'
  | 'submitted'
  | 'sent_back';

// Assignment types
interface InterviewAssignment {
  id: string;
  organizationId: string;
  projectId?: string;
  assigneeUserId: string;
  templateId: string;
  templateVersion: number;
  // NOTE: 'completed' kept for legacy; canonical reviewer approval uses 'approved'
  status: 'assigned' | 'in_progress' | 'submitted' | 'sent_back' | 'approved' | 'completed';
  sessionId?: string;
  dueAt?: string;
  startedAt?: string;
  submittedAt?: string;
  sentBackAt?: string;
  sentBackReason?: string;
  missingItems?: Array<{ key: string; label: string; questionId?: string; sectionId?: string }>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isTeamAssignment: boolean;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  template?: {
    id: string;
    name: string;
    description?: string;
    category?: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  session?: {
    id: string;
    status: string;
    answeredQuestions: number;
    totalQuestions: number;
    completenessPercent: number;
  };
  // Manager AI snapshot (#11b/#9). Populated server-side when the assignment is
  // submitted/evaluated; absent until then. We read it opportunistically and
  // degrade gracefully ("AI assessment not available", "—") when missing.
  aiReview?: {
    overallScore?: number;
    overallVerdict?: 'ready_for_approval' | 'needs_improvement' | 'insufficient' | 'empty';
    recommendations?: string[];
    weakAnswerMap?: Array<{
      key: string;
      label: string;
      score?: number;
      verdict?: string;
      feedback?: string;
      isRequired?: boolean;
    }>;
  } | null;
  aiReviewedAt?: string;
  // Escalation metadata (#9b). The backend escalation engine owns these; the UI
  // only displays them and offers a manual trigger when an endpoint exists.
  escalatedAt?: string;
  escalationTarget?: { id?: string; name?: string; email?: string } | null;
  escalationLevel?: number;
}

function normalizeInterviewAssignmentStatus(status?: string): InterviewAssignment['status'] {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'sent_back') return 'in_progress';
  if (
    normalized === 'assigned' ||
    normalized === 'in_progress' ||
    normalized === 'submitted' ||
    normalized === 'approved' ||
    normalized === 'completed'
  ) {
    return normalized;
  }
  return 'in_progress';
}

function normalizeInterviewAssignmentRecord(assignment: InterviewAssignment): InterviewAssignment {
  return {
    ...assignment,
    status: normalizeInterviewAssignmentStatus(assignment.status),
  };
}

function normalizeInterviewSessionRecord(session: InterviewSession): InterviewSession {
  return {
    ...session,
    status:
      String(session.assignmentStatus || session.status || '').toLowerCase() === 'sent_back'
        ? 'in_progress'
        : session.status,
    assignmentStatus: session.assignmentStatus
      ? normalizeInterviewAssignmentStatus(session.assignmentStatus)
      : session.assignmentStatus,
  };
}

type OpenDocument = SharedOpenDocument;

const INTERVIEW_TABLE_SELECTED_ROW_CLASS = 'bg-c-accent-soft shadow-[inset_2px_0_0_var(--c-info)]';
const INTERVIEW_TABLE_HOVER_ROW_CLASS = 'hover:bg-c-surface-raised';
const INTERVIEW_TABLE_ICON_SURFACE_CLASS =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-c-border bg-c-surface-raised text-c-text-muted';
const INTERVIEW_META_CHIP_CLASS =
  'inline-flex items-center rounded-full border border-c-border bg-c-surface-raised px-2 py-0.5 text-[11px] font-medium text-c-text-secondary';
const INTERVIEW_STATUS_CHIP_BASE_CLASS =
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium';
const INTERVIEW_DUE_CHIP_BASE_CLASS =
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium';
const INTERVIEW_PROGRESS_TRACK_CLASS =
  'h-1.5 max-w-[100px] flex-1 overflow-hidden rounded-full bg-c-border-subtle';
const INTERVIEW_PROGRESS_FILL_CLASS = 'h-full rounded-full bg-c-success transition';

// V-A S5 — canonical template-status chip. The real status enum is
// draft / in_review / approved / archived; the table cell previously showed a
// fabricated Default|Active badge that ignored `template.status` entirely, and
// the cards branch only modeled a binary approved/draft. One helper, used in
// both, so a draft never reads as "Active" again.
function getTemplateStatusChip(
  status: string | undefined,
  t: (key: string) => string
): { label: string; className: string } {
  const s = String(status || 'draft').toLowerCase();
  if (s === 'approved' || s === 'published') {
    return {
      label: t('interview.hub.published'),
      className: `${INTERVIEW_STATUS_CHIP_BASE_CLASS} border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100`,
    };
  }
  if (s === 'in_review') {
    return {
      label: t('interview.hub.inReview'),
      className: `${INTERVIEW_STATUS_CHIP_BASE_CLASS} border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100`,
    };
  }
  if (s === 'archived') {
    return {
      label: t('interview.hub.archived'),
      className: `${INTERVIEW_STATUS_CHIP_BASE_CLASS} border-slate-300/80 bg-slate-100 text-slate-600 dark:border-white/[0.10] dark:bg-white/[0.06] dark:text-slate-300`,
    };
  }
  return {
    label: t('interview.hub.draft'),
    className: `${INTERVIEW_STATUS_CHIP_BASE_CLASS} border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100`,
  };
}

export const InterviewHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    currentProjectId,
    setCurrentProjectId,
    currentOrganization,
    currentUser,
    setInterviewBreadcrumbs,
  } = useAppStore();
  // Fala lekkości — Interview light shell "Zapytaj Teresę" CTA (mirrors
  // FinanceHub/InitiativesHub's openChatWithContext wiring).
  const openChatWithContext = useOpenChatWithContext();
  // Permissions hook
  const {
    canAssign: permissionsCanAssign,
    canViewManaged: permissionsCanViewManaged,
    canViewOverdue: permissionsCanViewOverdue,
    canViewInsights: permissionsCanViewInsights,
    canCreateInsights: permissionsCanCreateInsights,
    canReviewInsights: permissionsCanReviewInsights,
    isLoading: permissionsLoading,
  } = useInterviewPermissions();

  // Get session ID from URL if provided
  const sessionIdFromUrl = searchParams.get('sessionId');
  const assignmentIdFromUrl = searchParams.get('assignmentId');
  const insightIdFromUrl = searchParams.get('insightId');
  const tabFromUrl = searchParams.get('tab');
  const initiativeIdFromUrl = searchParams.get('initiativeId');

  // State - domyślnie Inbox (moje przydziały)
  const [activeTab, setActiveTab] = useState<InterviewTab>('my_assignments');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [assignmentsViewMode, setAssignmentsViewMode] = useState<'list' | 'cards'>('list');
  const [initiativesViewMode, setInitiativesViewMode] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>('all');
  const [templateSourceFilter, setTemplateSourceFilter] = useState<TemplateSourceFilter>('all');
  const [templateAreaTagFilter, setTemplateAreaTagFilter] = useState<string[]>([]);
  const [isTemplateAreaFilterOpen, setIsTemplateAreaFilterOpen] = useState(false);
  // V-A S5 — filter by the real status enum, not isDefault. Was 'all'|'default'|
  // 'active' (which keyed off isDefault, so drafts/archived were unreachable).
  const [templateStatusFilter, setTemplateStatusFilter] = useState<
    'all' | 'draft' | 'in_review' | 'approved' | 'archived'
  >('all');
  const [templatePreviewDetailsMenuOpen, setTemplatePreviewDetailsMenuOpen] = useState(false);
  const [templatePreviewAiMenuOpen, setTemplatePreviewAiMenuOpen] = useState(false);
  const [templatesViewMode, setTemplatesViewMode] = useState<'cards' | 'table'>('table');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateForAssign, setSelectedTemplateForAssign] =
    useState<InterviewTemplate | null>(null);
  const [insightTypeFilter, setInsightTypeFilter] = useState<string>('all');
  const [insightStatusFilter, setInsightStatusFilter] = useState<string>('all');
  // Lifecycle scope (active vs archived) — Menu 3 chip toggles this; drives server query.
  const [insightScope, setInsightScope] = useState<'active' | 'archived'>('active');
  const [insightsViewMode, setInsightsViewMode] = useState<InsightsViewMode>('flat');
  const [initiativeStatusFilter, setInitiativeStatusFilter] = useState<
    'all' | 'draft' | 'pending_review' | 'promoted'
  >('all');
  const [showInterviewInitiativeWizard, setShowInterviewInitiativeWizard] = useState(false);
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string>('all');
  // #6 — Inbox (my_assignments) own-work filter. Deliberately scoped to the
  // logged-in user's own assignments and framed around the worker's workflow
  // (All / Answered / Approved / Sent back) — NOT the org-wide "Overdue"/"To
  // approve" manager framing, which lives on the Assigned tab.
  const [inboxStatusFilter, setInboxStatusFilter] = useState<
    'all' | 'answered' | 'approved' | 'sent_back'
  >('all');
  // #8c — Assigned (managed) lifecycle filter. Mirrors the Sessions lifecycle
  // chip-row UX. Assignments have an archive lifecycle (no trash), filtered
  // server-side via ?lifecycle=active|archived|all. Default = active.
  const [managedLifecycle, setManagedLifecycle] = useState<'active' | 'archived'>('active');
  const [managedLifecycleBusy, setManagedLifecycleBusy] = useState(false);
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [insightPreviewDetailsExpanded, setInsightPreviewDetailsExpanded] = useState(false);
  const [insightPreviewAiActiveId, setInsightPreviewAiActiveId] = useState<string | null>(null);
  // (Initiatives per-column header filters retired — StandardTable's built-in
  // per-column filterOptions replace them; Triada standard.)

  // #10 — pre-filter for Sessions data (status/assignee/template), feeding both
  // StandardTable (table mode) and the grid view. Per-column filter UI itself
  // now lives inside StandardTable (Triada standard) via column `filterOptions`.
  const [sessionsTableFilters, setSessionsTableFilters] = useState<TableFilters>({});

  // (Assigned/Inbox per-column header filters retired — StandardTable's
  // built-in per-column filterOptions replace them; Triada standard.)

  // Reset preview expansion state when changing selection (KANON v3: stabilny panel)
  useEffect(() => {
    setInsightPreviewDetailsExpanded(false);
    setInsightPreviewAiActiveId(null);
  }, [selectedInsightId]);

  useEffect(() => {
    setInsightPreviewDetailsExpanded(false);
  }, [selectedInsightId]);

  // (Sessions/Templates/Initiatives table view-settings popovers retired —
  // StandardTable's own Settings2 pstryczek/TableSettingsPopover replaces
  // them; Triada standard.)

  useEffect(() => {
    // Assigned should open on the full manager list.
    // Narrow slices like "To approve" and "Overdue" are entered explicitly from Command Row chips.
    if (activeTab !== 'managed') return;
    if (
      assignmentStatusFilter === 'submitted' ||
      assignmentStatusFilter === 'overdue' ||
      assignmentStatusFilter === 'sent_back'
    )
      return;
    if (assignmentStatusFilter !== 'all') {
      setAssignmentStatusFilter('all');
    }
  }, [activeTab, assignmentStatusFilter]);

  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  // #8b — Sessions archive/trash lifecycle. The managed-sessions list is filtered
  // server-side via ?lifecycle=active|archived|trash; the active filter also drives
  // which kebab/bulk actions a row exposes (rows in the "Archive" view are archived,
  // rows in the "Trash" view are trashed, etc.).
  const [sessionLifecycle, setSessionLifecycle] = useState<'active' | 'archived' | 'trash'>(
    'active'
  );
  // Type-to-confirm permanent-delete dialog (only reachable from the Trash view).
  const [sessionDeleteTarget, setSessionDeleteTarget] = useState<InterviewSession | null>(null);
  const [sessionDeleteConfirmText, setSessionDeleteConfirmText] = useState('');
  const [sessionLifecycleBusy, setSessionLifecycleBusy] = useState(false);
  const [insights, setInsights] = useState<InterviewInsight[]>([]);
  const [interviewInitiatives, setInterviewInitiatives] = useState<InterviewInitiativeDraft[]>([]);
  // Lineage read-back for decisions/tasks created from interview findings.
  const [interviewDecisions, setInterviewDecisions] = useState<InterviewLineageItem[]>([]);
  const [interviewTasks, setInterviewTasks] = useState<InterviewLineageItem[]>([]);
  const [selectedInterviewInitiativeId, setSelectedInterviewInitiativeId] = useState<string | null>(
    null
  );
  const [showInitiativeWizard, setShowInitiativeWizard] = useState(false);
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingDemoData, setIsUsingDemoData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sessionsLoadError, setSessionsLoadError] = useState<string | null>(null);
  const [insightsLoadError, setInsightsLoadError] = useState<string | null>(null);
  const [initiativesLoadError, setInitiativesLoadError] = useState<string | null>(null);
  const [assignmentsLoadError, setAssignmentsLoadError] = useState<string | null>(null);

  // Assignments state
  const [myAssignments, setMyAssignments] = useState<InterviewAssignment[]>([]);
  const [managedAssignments, setManagedAssignments] = useState<InterviewAssignment[]>([]);
  const [overdueAssignments, setOverdueAssignments] = useState<InterviewAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);
  const allowDemoData = shouldAllowDemoData();

  // Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [showInsightModal, setShowInsightModal] = useState(false);
  // #11b — Manager approve flow with AI snapshot panel.
  const [showApproveModal, setShowApproveModal] = useState(false);
  // #7b — Manager "Change due date" inline modal.
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [dueDateDraft, setDueDateDraft] = useState<string>('');
  const [manageAssignmentBusy, setManageAssignmentBusy] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<InterviewAssignment | null>(null);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedInsightIds, setSelectedInsightIds] = useState<Set<string>>(new Set());
  // Fork in-flight guard (per-row) — przeniesione z InsightViewer toolbara do
  // kebaba wiersza (#55a); zapobiega podwójnemu forkowi tego samego wiersza.
  const [forkingInsightIds, setForkingInsightIds] = useState<Set<string>>(new Set());
  const [selectedInitiativeIds, setSelectedInitiativeIds] = useState<Set<string>>(new Set());
  const [selectedSessionsForInsight, setSelectedSessionsForInsight] = useState<string[]>([]);

  const interviewDemoData = useMemo(
    () =>
      createInterviewDemoDataset({
        currentUserId: currentUser?.id,
        currentUserName: currentUser?.displayName || (currentUser as any)?.name,
        currentUserEmail: currentUser?.email,
        organizationId: currentOrganization?.id,
        organizationName: currentOrganization?.name,
      }),
    [
      currentOrganization?.id,
      currentOrganization?.name,
      currentUser?.displayName,
      currentUser?.email,
      currentUser?.id,
      (currentUser as any)?.name,
    ]
  );
  const canAssign = permissionsCanAssign || isUsingDemoData;
  const canViewManaged = permissionsCanViewManaged || isUsingDemoData;
  const canViewOverdue = permissionsCanViewOverdue || isUsingDemoData;
  const canViewInsights = permissionsCanViewInsights || isUsingDemoData;
  const canCreateInsights = permissionsCanCreateInsights || isUsingDemoData;
  const canReviewInsights = permissionsCanReviewInsights || isUsingDemoData;
  const canViewTemplates = canViewManaged || templates.length > 0 || isUsingDemoData;

  // Interview Inbox preview (Outlook-style) — Assignments
  const [previewAssignmentId, setPreviewAssignmentId] = useState<string | null>(null);
  const [previewAssignmentOpen, setPreviewAssignmentOpen] = useState(false);
  const [previewDetailsMenuOpen, setPreviewDetailsMenuOpen] = useState(false);
  const [previewDetailsOverride, setPreviewDetailsOverride] = useState<string | null>(null);
  const [previewAiMenuOpen, setPreviewAiMenuOpen] = useState(false);
  const [previewAiText, setPreviewAiText] = useState<string | null>(null);
  const [previewAiError, setPreviewAiError] = useState<string | null>(null);
  type AssignmentAiIntent = 'summary' | 'risks' | 'next_steps';
  const [previewAiLastIntent, setPreviewAiLastIntent] = useState<AssignmentAiIntent>('summary');

  // Sessions preview (Outlook-style)
  const [previewSessionId, setPreviewSessionId] = useState<string | null>(null);
  const [sessionPreviewDetailsExpanded, setSessionPreviewDetailsExpanded] = useState(false);

  useEffect(() => {
    setSessionPreviewDetailsExpanded(false);
  }, [previewSessionId]);

  // Template questions cache (for read-only preview)
  const [templateQuestionsById, setTemplateQuestionsById] = useState<Record<string, any[]>>({});
  const [templateQuestionsLoading, setTemplateQuestionsLoading] = useState<Record<string, boolean>>(
    {}
  );

  const normalizeTemplateRecord = useCallback(
    (template: any): InterviewTemplate => ({
      ...(template as InterviewTemplate),
      scope: ((template?.scope || 'private') as TemplateScope) || 'private',
      areaTags: normalizeInterviewTemplateAreaTags(template?.areaTags),
    }),
    []
  );

  const unwrapApiList = useCallback((response: unknown, listKey?: string): any[] => {
    if (Array.isArray(response)) return response;
    const payload = (response as { data?: unknown })?.data;
    if (Array.isArray(payload)) return payload;
    if (listKey) {
      const directList = (response as Record<string, unknown> | null)?.[listKey];
      if (Array.isArray(directList)) return directList;
      const nestedList = (payload as Record<string, unknown> | null)?.[listKey];
      if (Array.isArray(nestedList)) return nestedList;
    }
    return [];
  }, []);

  const loadManagedSessions = useCallback(
    async (lifecycle: 'active' | 'archived' | 'trash' = 'active'): Promise<InterviewSession[]> => {
      // The v8 managed-sessions endpoint ignores lifecycle, so only the default
      // "active" view can use the v8 fast path. Archive/Trash views must go through
      // the legacy /interview/sessions/managed?lifecycle= endpoint (#8b backend).
      const sessionsRes =
        lifecycle === 'active'
          ? await V8InterviewApi.getManagedSessions()
              .then((res) => res.sessions)
              .catch(() => Api.get('/interview/sessions/managed'))
              .catch(() => [])
          : await Api.get(
              `/interview/sessions/managed?lifecycle=${encodeURIComponent(lifecycle)}`
            ).catch(() => []);
      return Array.isArray(sessionsRes)
        ? (sessionsRes as InterviewSession[]).map(normalizeInterviewSessionRecord)
        : [];
    },
    []
  );

  // #8b — Re-fetch only the sessions list (used after lifecycle actions and when
  // the user switches the Active | Archive | Trash filter). Keeps selection in sync.
  const refreshSessions = useCallback(
    async (lifecycle: 'active' | 'archived' | 'trash' = sessionLifecycle) => {
      try {
        const next = await loadManagedSessions(lifecycle);
        setSessions(next);
        setSessionsLoadError(null);
      } catch (error) {
        console.error('[InterviewHub] Failed to refresh sessions:', error);
      }
    },
    [loadManagedSessions, sessionLifecycle]
  );

  const loadMyAssignments = useCallback(async (): Promise<InterviewAssignment[]> => {
    const assignmentsRes = await V8InterviewApi.getMyAssignments()
      .then((res) => res.assignments)
      .catch(() => Api.get('/interview/assignments/my'))
      .catch(() => []);
    return Array.isArray(assignmentsRes)
      ? (assignmentsRes as InterviewAssignment[]).map(normalizeInterviewAssignmentRecord)
      : [];
  }, []);

  // #8c — Managed assignments list is filtered server-side via
  // ?lifecycle=active|archived|all (active = default, excludes archived).
  // The v8 fast path returns only active rows, so non-active views go through
  // the /interview/assignments/managed?lifecycle= endpoint.
  const loadManagedAssignments = useCallback(
    async (lifecycle: 'active' | 'archived' | 'all' = 'active'): Promise<InterviewAssignment[]> => {
      const assignmentsRes =
        lifecycle === 'active'
          ? await V8InterviewApi.getManagedAssignments()
              .then((res) => res.assignments)
              .catch(() => Api.get('/interview/assignments/managed'))
              .catch(() => [])
          : await Api.get(
              `/interview/assignments/managed?lifecycle=${encodeURIComponent(lifecycle)}`
            ).catch(() => []);
      return Array.isArray(assignmentsRes)
        ? (assignmentsRes as InterviewAssignment[]).map(normalizeInterviewAssignmentRecord)
        : [];
    },
    []
  );

  const loadOverdueAssignments = useCallback(async (): Promise<InterviewAssignment[]> => {
    const assignmentsRes = await V8InterviewApi.getOverdueAssignments()
      .then((res) => res.assignments)
      .catch(() => Api.get('/interview/assignments/overdue'))
      .catch(() => []);
    return Array.isArray(assignmentsRes)
      ? (assignmentsRes as InterviewAssignment[]).map(normalizeInterviewAssignmentRecord)
      : [];
  }, []);

  // #8c — Re-fetch only the managed-assignments list (used after archive/restore
  // actions and when the user switches the Active | Archive filter). Mirrors the
  // Sessions refreshSessions pattern.
  const refreshManagedAssignments = useCallback(
    async (lifecycle: 'active' | 'archived' = managedLifecycle) => {
      try {
        const next = await loadManagedAssignments(lifecycle);
        setManagedAssignments(next);
      } catch (error) {
        console.error('[InterviewHub] Failed to refresh managed assignments:', error);
      }
    },
    [loadManagedAssignments, managedLifecycle]
  );

  // V3-A02: Dynamic documents state with sessionStorage persistence (shared hook)
  const { openDocuments, setOpenDocuments, activeDocumentId, setActiveDocumentId } =
    useModuleOpenDocuments('interview');

  useEffect(() => {
    // Close preview menus on context change (avoid “leaking” open menus)
    setPreviewDetailsMenuOpen(false);
    setPreviewAiMenuOpen(false);
    setTemplatePreviewDetailsMenuOpen(false);
    setTemplatePreviewAiMenuOpen(false);
  }, [selectedTemplateId, activeTab, activeDocumentId]);

  useEffect(() => {
    // Preview state should not leak across tabs/docs.
    if (activeTab !== 'my_assignments' && activeTab !== 'managed') {
      setPreviewAssignmentId(null);
      setPreviewAssignmentOpen(false);
      setSelectedAssignmentIds(new Set());
    }
    if (activeTab !== 'sessions') {
      setSelectedSessionIds(new Set());
    }
    if (activeTab !== 'insights') {
      setSelectedInsightIds(new Set());
    }
    if (activeTab !== 'initiatives') {
      setSelectedInitiativeIds(new Set());
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab !== 'sessions') {
      setPreviewSessionId(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeDocumentId) {
      setPreviewAssignmentId(null);
      setPreviewAssignmentOpen(false);
    }
  }, [activeDocumentId]);

  useEffect(() => {
    if (activeDocumentId) {
      setPreviewSessionId(null);
    }
  }, [activeDocumentId]);

  useEffect(() => {
    if (tabFromUrl === 'initiatives') {
      setActiveTab('initiatives');
      setActiveDocumentId(null);
    }
  }, [tabFromUrl, setActiveDocumentId]);

  useEffect(() => {
    if (!initiativeIdFromUrl) return;
    setActiveTab('initiatives');
    setActiveDocumentId(null);
    setSelectedInterviewInitiativeId(initiativeIdFromUrl);
  }, [initiativeIdFromUrl, setActiveDocumentId]);

  useEffect(() => {
    // Templates: selection exists only in list mode (no document open)
    if (activeTab !== 'templates' || activeDocumentId) {
      setSelectedTemplateId(null);
      setSelectedTemplateIds(new Set());
    }
  }, [activeTab, activeDocumentId]);

  // L2.3: Dynamic breadcrumbs for Interview module
  useEffect(() => {
    const base = t('interview.hub.interview');
    const doc = activeDocumentId ? openDocuments.find((d) => d.id === activeDocumentId) : null;

    if (doc) {
      const typeLabel =
        doc.type === 'interview_session'
          ? t('interview.hub.session')
          : doc.type === 'interview_insight'
            ? t('interview.hub.insight')
            : t('interview.hub.template');
      const docName = doc.name || typeLabel;
      setInterviewBreadcrumbs([base, `${typeLabel}: ${docName}`]);
    } else {
      const TAB_LABELS: Record<string, string> = {
        my_assignments: 'Inbox',
        sessions: t('interview.hub.sessions'),
        templates: t('interview.hub.templates'),
        insights: t('interview.hub.insights'),
        initiatives: t('interview.hub.initiatives'),
        managed: t('interview.hub.assigned'),
        pending_review: t('interview.hub.pendingReview'),
      };
      const tabLabel = TAB_LABELS[activeTab];
      setInterviewBreadcrumbs(tabLabel ? [base, tabLabel] : [base]);
    }

    return () => setInterviewBreadcrumbs(null);
  }, [activeTab, activeDocumentId, openDocuments, isPolish, setInterviewBreadcrumbs]);

  useEffect(() => {
    // Reset preview menus/texts on item change
    setPreviewDetailsMenuOpen(false);
    setPreviewAiMenuOpen(false);
    setPreviewAiError(null);
    setPreviewAiText(null);
    setPreviewDetailsOverride(null);
  }, [previewAssignmentId]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const [sessionsRes, insightsRes, initiativesRes, templatesRes, decisionsRes, tasksRes] =
        await Promise.allSettled([
          loadManagedSessions(),
          V8InterviewApi.listInsights()
            .then((r) => r.insights)
            .catch(() => Api.get('/interview/insights')),
          Api.get('/initiatives?source=interview_insight'),
          Api.get('/interview/templates'),
          // Lineage read-back — decisions/tasks tagged source_type='interview_insight'.
          Api.get('/my-work/decisions?source=interview_insight'),
          Api.get('/my-work/tasks?source=interview_insight'),
        ]);

      setIsUsingDemoData(false);

      if (sessionsRes.status === 'fulfilled') {
        setSessions(Array.isArray(sessionsRes.value) ? sessionsRes.value : []);
        setSessionsLoadError(null);
      } else {
        console.error('[InterviewHub] Failed to load sessions:', sessionsRes.reason);
        setSessions([]);
        setSessionsLoadError(t('interview.hub.failedToLoadSessionsTry'));
      }

      if (insightsRes.status === 'fulfilled') {
        setInsights(unwrapApiList(insightsRes.value, 'insights'));
        setInsightsLoadError(null);
      } else {
        // Insights are an admin/consultant surface. A pilot/survey USER legitimately
        // lacks the INTERVIEW_INSIGHTS_VIEW permission, so a 403 here is expected —
        // treat it as "no insights for you" silently instead of a console error + banner.
        const reason = insightsRes.reason as { status?: number; response?: { status?: number } };
        const isForbidden = reason?.status === 403 || reason?.response?.status === 403;
        if (!isForbidden) {
          console.error('[InterviewHub] Failed to load insights:', insightsRes.reason);
        }
        setInsights([]);
        setInsightsLoadError(isForbidden ? null : t('interview.hub.failedToLoadInsightsTry'));
      }

      if (initiativesRes.status === 'fulfilled') {
        setInterviewInitiatives(unwrapApiList(initiativesRes.value, 'initiatives'));
        setInitiativesLoadError(null);
      } else {
        console.error('[InterviewHub] Failed to load initiatives:', initiativesRes.reason);
        setInterviewInitiatives([]);
        setInitiativesLoadError(t('interview.hub.failedToLoadInterviewInitiatives'));
      }

      if (templatesRes.status === 'fulfilled') {
        setTemplates(unwrapApiList(templatesRes.value, 'templates').map(normalizeTemplateRecord));
      } else {
        console.error('[InterviewHub] Failed to load templates:', templatesRes.reason);
        setTemplates([]);
      }

      // Lineage read-back — degrade gracefully to an honest empty state on
      // failure or if the source filter isn't honored yet (no fake data).
      if (decisionsRes.status === 'fulfilled') {
        setInterviewDecisions(unwrapApiList(decisionsRes.value, 'decisions'));
      } else {
        console.error('[InterviewHub] Failed to load interview decisions:', decisionsRes.reason);
        setInterviewDecisions([]);
      }

      if (tasksRes.status === 'fulfilled') {
        setInterviewTasks(unwrapApiList(tasksRes.value, 'tasks'));
      } else {
        console.error('[InterviewHub] Failed to load interview tasks:', tasksRes.reason);
        setInterviewTasks([]);
      }

      const allFailed =
        sessionsRes.status === 'rejected' &&
        insightsRes.status === 'rejected' &&
        initiativesRes.status === 'rejected' &&
        templatesRes.status === 'rejected';
      setLoadError(
        allFailed ? 'Failed to load real interview data from the active data source.' : null
      );

      setIsLoading(false);
    };

    loadData();
  }, [isPolish, loadManagedSessions, normalizeTemplateRecord, unwrapApiList]);

  // #8b — Re-fetch the sessions list when the Active | Archive | Trash filter
  // changes. The first run is skipped (the main load effect already fetched the
  // default "active" list) to avoid a redundant double fetch on mount.
  const sessionLifecycleHydrated = useRef(false);
  useEffect(() => {
    if (!sessionLifecycleHydrated.current) {
      sessionLifecycleHydrated.current = true;
      return;
    }
    setSelectedSessionIds(new Set());
    void refreshSessions(sessionLifecycle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLifecycle]);

  // #8c — Re-fetch the managed-assignments list when the Active | Archive filter
  // changes. First run skipped (main load effect already fetched the default
  // "active" list) to avoid a redundant double fetch on mount.
  const managedLifecycleHydrated = useRef(false);
  useEffect(() => {
    if (!managedLifecycleHydrated.current) {
      managedLifecycleHydrated.current = true;
      return;
    }
    setSelectedAssignmentIds(new Set());
    void refreshManagedAssignments(managedLifecycle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managedLifecycle]);

  // Load insights function (for refresh)
  const loadInsights = useCallback(async () => {
    try {
      const insightsRes = await V8InterviewApi.listInsights({ scope: insightScope })
        .then((r) => r.insights)
        .catch(() =>
          Api.get(`/interview/insights${insightScope !== 'active' ? `?scope=${insightScope}` : ''}`)
        );
      const apiInsights = unwrapApiList(insightsRes, 'insights');
      setInsights(apiInsights);
      setInsightsLoadError(null);
    } catch (error) {
      console.error('[InterviewHub] Failed to load insights:', error);
      setInsightsLoadError(t('interview.hub.failedToLoadInsightsTry'));
    }
  }, [isPolish, unwrapApiList, insightScope]);

  // Reload insights whenever the active/archived scope flips (skip initial mount —
  // the main load already fetches the default 'active' scope).
  const insightScopeDidMount = useRef(false);
  useEffect(() => {
    if (!insightScopeDidMount.current) {
      insightScopeDidMount.current = true;
      return;
    }
    void loadInsights();
  }, [insightScope, loadInsights]);

  const loadInterviewInitiatives = useCallback(async () => {
    try {
      const initiativesRes = await Api.get('/initiatives?source=interview_insight');
      const apiInitiatives = unwrapApiList(initiativesRes, 'initiatives');
      setInterviewInitiatives(apiInitiatives);
      setInitiativesLoadError(null);
    } catch (error) {
      console.error('[InterviewHub] Failed to load interview initiatives:', error);
      setInitiativesLoadError(t('interview.hub.failedToLoadInterviewInitiatives'));
    }
  }, [isPolish, unwrapApiList]);

  // Lineage read-back refresh for decisions/tasks created from interview findings.
  const loadInterviewLineage = useCallback(async () => {
    const [decisionsRes, tasksRes] = await Promise.allSettled([
      Api.get('/my-work/decisions?source=interview_insight'),
      Api.get('/my-work/tasks?source=interview_insight'),
    ]);
    if (decisionsRes.status === 'fulfilled') {
      setInterviewDecisions(unwrapApiList(decisionsRes.value, 'decisions'));
    } else {
      console.error('[InterviewHub] Failed to load interview decisions:', decisionsRes.reason);
      setInterviewDecisions([]);
    }
    if (tasksRes.status === 'fulfilled') {
      setInterviewTasks(unwrapApiList(tasksRes.value, 'tasks'));
    } else {
      console.error('[InterviewHub] Failed to load interview tasks:', tasksRes.reason);
      setInterviewTasks([]);
    }
  }, [unwrapApiList]);

  const loadTemplates = useCallback(async () => {
    try {
      const templatesRes = await Api.get('/interview/templates');
      setTemplates(unwrapApiList(templatesRes, 'templates').map(normalizeTemplateRecord));
    } catch (error) {
      console.error('[InterviewHub] Failed to load templates:', error);
    }
  }, [normalizeTemplateRecord, unwrapApiList]);

  // ── Bulk actions ────────────────────────────────────────────────────────
  // Cheap, fully-wired bulk operations backed by existing endpoints.
  const [bulkActionBusy, setBulkActionBusy] = useState(false);

  const handleBulkRemind = useCallback(async () => {
    const ids = Array.from(selectedAssignmentIds);
    if (ids.length === 0 || bulkActionBusy) return;
    setBulkActionBusy(true);
    let sent = 0;
    for (const id of ids) {
      try {
        await V8InterviewApi.remindAssignment(id);
        sent += 1;
      } catch {
        // continue; per-item failures are tolerated and reflected in the count
      }
    }
    setBulkActionBusy(false);
    setSelectedAssignmentIds(new Set());
    if (sent > 0) {
      toast.success(t('interview.hub.remindersSentCount', { count: sent }));
    } else {
      toast.error(t('interview.hub.couldNotSendReminders'));
    }
  }, [selectedAssignmentIds, bulkActionBusy, isPolish]);

  // #8 — Bulk approve over the selected managed rows. Only 'submitted' rows are
  // approvable; others are skipped honestly (reflected in the count). Backed by
  // the existing per-assignment approve endpoint (no bulk route exists).
  const handleBulkApproveAssignments = useCallback(async () => {
    const ids = Array.from(selectedAssignmentIds);
    if (ids.length === 0 || bulkActionBusy) return;
    const approvable = (managedAssignments || []).filter(
      (a) => ids.includes(a.id) && a.status === 'submitted'
    );
    if (approvable.length === 0) {
      toast.error(t('interview.hub.noSubmittedAssignmentsToApprove'));
      return;
    }
    setBulkActionBusy(true);
    let done = 0;
    for (const a of approvable) {
      try {
        await V8InterviewApi.approveAssignment(a.id);
        done += 1;
      } catch {
        // per-item failures tolerated; reflected in count
      }
    }
    try {
      const [myRes, managedRes, overdueRes] = await Promise.all([
        loadMyAssignments(),
        loadManagedAssignments(),
        loadOverdueAssignments(),
      ]);
      setMyAssignments(myRes);
      setManagedAssignments(managedRes);
      setOverdueAssignments(overdueRes);
    } catch {
      /* ignore refresh failure */
    }
    setBulkActionBusy(false);
    setSelectedAssignmentIds(new Set());
    if (done > 0) {
      toast.success(t('interview.hub.approvedCount', { count: done }));
    } else {
      toast.error(t('interview.hub.couldNotApprove'));
    }
  }, [
    selectedAssignmentIds,
    bulkActionBusy,
    managedAssignments,
    isPolish,
    loadMyAssignments,
    loadManagedAssignments,
    loadOverdueAssignments,
  ]);

  // #8 — Bulk send-back over the selected managed rows. Uses a generic reason
  // (per-item reasons remain available via the single-row Send-back modal).
  const handleBulkSendBackAssignments = useCallback(async () => {
    const ids = Array.from(selectedAssignmentIds);
    if (ids.length === 0 || bulkActionBusy) return;
    const eligible = (managedAssignments || []).filter(
      (a) => ids.includes(a.id) && a.status === 'submitted'
    );
    if (eligible.length === 0) {
      toast.error(t('interview.hub.noSubmittedAssignmentsToSend'));
      return;
    }
    const reason = t('interview.hub.returnedForRevisionBulkAction');
    setBulkActionBusy(true);
    let done = 0;
    for (const a of eligible) {
      try {
        await V8InterviewApi.sendBackAssignment(a.id, { reason });
        done += 1;
      } catch {
        // per-item failures tolerated
      }
    }
    try {
      const [myRes, managedRes, overdueRes] = await Promise.all([
        loadMyAssignments(),
        loadManagedAssignments(),
        loadOverdueAssignments(),
      ]);
      setMyAssignments(myRes);
      setManagedAssignments(managedRes);
      setOverdueAssignments(overdueRes);
    } catch {
      /* ignore refresh failure */
    }
    setBulkActionBusy(false);
    setSelectedAssignmentIds(new Set());
    if (done > 0) {
      toast.success(t('interview.hub.sentBackCount', { count: done }));
    } else {
      toast.error(t('interview.hub.couldNotSendBack'));
    }
  }, [
    selectedAssignmentIds,
    bulkActionBusy,
    managedAssignments,
    isPolish,
    loadMyAssignments,
    loadManagedAssignments,
    loadOverdueAssignments,
  ]);

  // #8 / #8c — Assignment archive lifecycle. Per-row archive/restore backed by
  // POST /interview/assignments/:id/{archive,restore}. After each action we
  // re-fetch the list for the current lifecycle filter so the affected row drops
  // out of view.
  const handleAssignmentLifecycleAction = useCallback(
    async (assignment: InterviewAssignment, action: 'archive' | 'restore') => {
      if (managedLifecycleBusy) return;
      setManagedLifecycleBusy(true);
      try {
        await Api.post(`/interview/assignments/${assignment.id}/${action}`, {});
        toast.success(
          action === 'archive'
            ? t('interview.hub.assignmentArchived')
            : t('interview.hub.assignmentRestored')
        );
        await refreshManagedAssignments();
      } catch (error) {
        toast.error(t('interview.hub.couldNotCompleteTheAction'));
        console.error(`[InterviewHub] Assignment ${action} failed:`, error);
      } finally {
        setManagedLifecycleBusy(false);
      }
    },
    [isPolish, managedLifecycleBusy, refreshManagedAssignments]
  );

  // #8 — Bulk archive/restore over the current selection. No bulk route exists,
  // so we fan out per-assignment archive/restore calls.
  const handleBulkAssignmentLifecycle = useCallback(
    async (action: 'archive' | 'restore') => {
      const ids = Array.from(selectedAssignmentIds);
      if (ids.length === 0 || managedLifecycleBusy) return;
      setManagedLifecycleBusy(true);
      let done = 0;
      for (const id of ids) {
        try {
          await Api.post(`/interview/assignments/${id}/${action}`, {});
          done += 1;
        } catch {
          // per-item failures tolerated; reflected in the count
        }
      }
      await refreshManagedAssignments();
      setManagedLifecycleBusy(false);
      setSelectedAssignmentIds(new Set());
      if (done > 0) {
        toast.success(
          t(action === 'archive' ? 'interview.hub.archivedCount' : 'interview.hub.restoredCount', {
            count: done,
          })
        );
      } else {
        toast.error(t('interview.hub.couldNotCompleteTheAction'));
      }
    },
    [isPolish, managedLifecycleBusy, refreshManagedAssignments, selectedAssignmentIds]
  );

  const downloadCsv = useCallback((rows: string[][], filename: string) => {
    const escapeCell = (value: string) => {
      const v = value ?? '';
      return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    };
    const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleBulkExportSessions = useCallback(() => {
    const ids = selectedSessionIds;
    if (ids.size === 0) return;
    const selected = sessions.filter((s) => ids.has(s.id));
    if (selected.length === 0) return;
    const header = ['id', 'name', 'status', 'assignee', 'startedAt'];
    const rows: string[][] = [
      header,
      ...selected.map((s) => [
        s.id,
        s.name || '',
        normalizeInterviewAssignmentStatus(s.assignmentStatus || s.status || 'in_progress'),
        s.assigneeName || s.respondentName || '',
        s.startedAt || '',
      ]),
    ];
    downloadCsv(rows, `interview-sessions-${new Date().toISOString().slice(0, 10)}.csv`);
    setSelectedSessionIds(new Set());
    toast.success(t('interview.hub.exportDownloaded'));
  }, [selectedSessionIds, sessions, downloadCsv, isPolish]);

  const handleBulkCloneTemplates = useCallback(async () => {
    const ids = Array.from(selectedTemplateIds);
    if (ids.length === 0 || bulkActionBusy) return;
    setBulkActionBusy(true);
    let cloned = 0;
    for (const id of ids) {
      try {
        await Api.post(`/interview/templates/${id}/clone`, {});
        cloned += 1;
      } catch {
        // tolerate per-item failures
      }
    }
    setBulkActionBusy(false);
    setSelectedTemplateIds(new Set());
    if (cloned > 0) {
      await loadTemplates();
      toast.success(t('interview.hub.clonedTemplatesCount', { count: cloned }));
    } else {
      toast.error(t('interview.hub.couldNotCloneTemplates'));
    }
  }, [selectedTemplateIds, bulkActionBusy, isPolish, loadTemplates]);

  const handleBulkArchiveTemplates = useCallback(async () => {
    const ids = Array.from(selectedTemplateIds);
    if (ids.length === 0 || bulkActionBusy) return;
    setBulkActionBusy(true);
    let done = 0;
    for (const id of ids) {
      try {
        await Api.post(`/interview/templates/${id}/archive`, {});
        done += 1;
      } catch {
        // tolerate per-item failures
      }
    }
    setBulkActionBusy(false);
    setSelectedTemplateIds(new Set());
    if (done > 0) {
      const templatesRes = await Api.get('/interview/templates').catch(() => []);
      setTemplates((Array.isArray(templatesRes) ? templatesRes : []).map(normalizeTemplateRecord));
      toast.success(t('interview.hub.archivedTemplatesCount', { count: done }));
    } else {
      toast.error(t('interview.hub.failedToArchiveTemplates'));
    }
  }, [selectedTemplateIds, bulkActionBusy, isPolish]);

  const handleBulkRestoreTemplates = useCallback(async () => {
    const ids = Array.from(selectedTemplateIds);
    if (ids.length === 0 || bulkActionBusy) return;
    setBulkActionBusy(true);
    let done = 0;
    for (const id of ids) {
      try {
        await Api.post(`/interview/templates/${id}/restore`, {});
        done += 1;
      } catch {
        // tolerate per-item failures
      }
    }
    setBulkActionBusy(false);
    setSelectedTemplateIds(new Set());
    if (done > 0) {
      const templatesRes = await Api.get('/interview/templates').catch(() => []);
      setTemplates((Array.isArray(templatesRes) ? templatesRes : []).map(normalizeTemplateRecord));
      toast.success(t('interview.hub.restoredTemplatesCount', { count: done }));
    } else {
      toast.error(t('interview.hub.failedToRestoreTemplates'));
    }
  }, [selectedTemplateIds, bulkActionBusy, isPolish]);

  const handleBulkExportInsights = useCallback(() => {
    const ids = selectedInsightIds;
    if (ids.size === 0) return;
    const selected = insights.filter((i) => ids.has(i.id));
    if (selected.length === 0) return;
    const header = ['id', 'title', 'type', 'status'];
    const rows: string[][] = [
      header,
      ...selected.map((i) => [
        i.id,
        i.title || '',
        i.insightType || i.type || i.category || '',
        i.reviewStatus || i.status || '',
      ]),
    ];
    downloadCsv(rows, `interview-insights-${new Date().toISOString().slice(0, 10)}.csv`);
    setSelectedInsightIds(new Set());
    toast.success(t('interview.hub.exportDownloaded'));
  }, [selectedInsightIds, insights, downloadCsv, isPolish]);

  // Load assignments data
  useEffect(() => {
    const loadAssignments = async () => {
      if (permissionsLoading) return;

      setAssignmentsLoading(true);
      try {
        const apiMyAssignments = await loadMyAssignments();
        setMyAssignments(apiMyAssignments);

        if (permissionsCanViewManaged || isUsingDemoData) {
          const [apiManagedAssignments, apiOverdueAssignments] = await Promise.all([
            loadManagedAssignments(),
            loadOverdueAssignments(),
          ]);
          setManagedAssignments(apiManagedAssignments);
          setOverdueAssignments(apiOverdueAssignments);
        }
        setAssignmentsLoadError(null);
      } catch (error) {
        console.error('[InterviewHub] Failed to load assignments:', error);
        setMyAssignments([]);
        setManagedAssignments([]);
        setOverdueAssignments([]);
        setAssignmentsLoadError(t('interview.hub.failedToLoadInterviewAssignments'));
      } finally {
        setAssignmentsLoading(false);
      }
    };

    loadAssignments();
  }, [
    isPolish,
    isUsingDemoData,
    loadManagedAssignments,
    loadMyAssignments,
    loadOverdueAssignments,
    permissionsCanViewManaged,
    permissionsLoading,
  ]);

  const handleOpenDocument = useCallback((doc: OpenDocument) => {
    setOpenDocuments((prev) => {
      if (prev.find((d) => d.id === doc.id)) return prev;
      return [...prev, doc];
    });
    setActiveDocumentId(doc.id);
  }, []);

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

  const handleViewSession = useCallback(
    (session: InterviewSession) => {
      const workflowStatus = String(session.assignmentStatus || session.status || 'in_progress');
      handleOpenDocument({
        id: session.id,
        type: 'interview_session',
        subType: 'interview',
        name: session.name || 'Interview Session',
        status: (workflowStatus.toUpperCase() || 'DRAFT') as any,
      });
    },
    [handleOpenDocument]
  );

  const handleViewInsight = useCallback(
    (insight: InterviewInsight) => {
      handleOpenDocument({
        id: insight.id,
        type: 'interview_insight',
        subType: 'interview',
        name: insight.title,
        status: (insight.status || 'approved').toUpperCase() as any,
      });
    },
    [handleOpenDocument]
  );

  const handleViewTemplate = useCallback(
    (template: InterviewTemplate) => {
      handleOpenDocument({
        id: template.id,
        type: 'interview_template',
        subType: 'interview',
        name: template.name,
        status: 'APPROVED' as any,
      });
    },
    [handleOpenDocument]
  );

  // Open session from URL
  useEffect(() => {
    if (sessionIdFromUrl && sessions.length > 0) {
      const session = sessions.find((s) => s.id === sessionIdFromUrl);
      if (session) {
        handleViewSession(session);
      }
    }
  }, [sessionIdFromUrl, sessions, handleViewSession]);

  // Open assignment from URL (deep link from notifications)
  useEffect(() => {
    if (!assignmentIdFromUrl) return;
    const allAssignments = [...myAssignments, ...managedAssignments];
    if (allAssignments.length === 0) return;
    const assignment = allAssignments.find((a) => a.id === assignmentIdFromUrl);
    if (!assignment) return;
    const isManagerView = managedAssignments.some((a) => a.id === assignmentIdFromUrl);
    const shouldOpenInSessions =
      isManagerView &&
      Boolean(assignment.sessionId || assignment.session?.id) &&
      ['in_progress', 'submitted', 'sent_back', 'approved', 'completed'].includes(
        assignment.status
      );
    setActiveTab(shouldOpenInSessions ? 'sessions' : isManagerView ? 'managed' : 'my_assignments');
    void openInterviewAssignmentFull(assignment, isManagerView);
    const next = new URLSearchParams(searchParams);
    next.delete('assignmentId');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentIdFromUrl, myAssignments, managedAssignments, searchParams, setSearchParams]);

  // Open insight from URL
  useEffect(() => {
    if (!insightIdFromUrl) return;
    const insight = insights.find((i) => i.id === insightIdFromUrl);
    if (!insight) return;
    handleViewInsight(insight);
    const next = new URLSearchParams(searchParams);
    next.delete('insightId');
    setSearchParams(next, { replace: true });
  }, [insightIdFromUrl, insights, searchParams, setSearchParams, handleViewInsight]);

  // Load template questions when a template doc is opened
  useEffect(() => {
    const doc = openDocuments.find((d) => d.id === activeDocumentId);
    const templateId =
      (doc?.type === 'interview_template' ? doc.id : null) ||
      (activeTab === 'templates' && selectedTemplateId ? selectedTemplateId : null);
    if (!templateId) return;
    if (templateQuestionsById[templateId] || templateQuestionsLoading[templateId]) return;

    setTemplateQuestionsLoading((prev) => ({ ...prev, [templateId]: true }));
    if (isInterviewDemoId(templateId)) {
      setTemplateQuestionsById((prev) => ({
        ...prev,
        [templateId]: interviewDemoData.templateQuestionsById[templateId] || [],
      }));
      setTemplateQuestionsLoading((prev) => ({ ...prev, [templateId]: false }));
      return;
    }

    Api.get(`/interview/templates/${templateId}/questions`)
      .then((rows) => {
        const apiRows = Array.isArray(rows) ? rows : [];
        setTemplateQuestionsById((prev) => ({
          ...prev,
          [templateId]:
            apiRows.length > 0
              ? apiRows
              : interviewDemoData.templateQuestionsById[templateId] || [],
        }));
      })
      .catch((err) => {
        console.error('[InterviewHub] Failed to load template questions:', err);
        setTemplateQuestionsById((prev) => ({
          ...prev,
          [templateId]: interviewDemoData.templateQuestionsById[templateId] || [],
        }));
      })
      .finally(() => {
        setTemplateQuestionsLoading((prev) => ({ ...prev, [templateId]: false }));
      });
  }, [
    activeDocumentId,
    activeTab,
    interviewDemoData.templateQuestionsById,
    openDocuments,
    selectedTemplateId,
    templateQuestionsById,
    templateQuestionsLoading,
  ]);

  const getSessionWorkflowStatus = useCallback(
    (session: InterviewSession) =>
      normalizeInterviewAssignmentStatus(
        session.assignmentStatus || session.status || 'in_progress'
      ),
    []
  );

  const getSessionProgress = useCallback(
    (session: InterviewSession) =>
      session.totalQuestions > 0
        ? Math.round((session.answeredQuestions / session.totalQuestions) * 100)
        : 0,
    []
  );

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Filter by status
    if (sessionStatusFilter !== 'all') {
      result = result.filter((s) => getSessionWorkflowStatus(s) === sessionStatusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          (s.name ?? '').toLowerCase().includes(query) ||
          (s.assigneeName ?? '').toLowerCase().includes(query) ||
          (s.templateName ?? '').toLowerCase().includes(query) ||
          formatListDate(s.startedAt || 0).includes(query)
      );
    }

    // #10 — per-column header filters (AND across columns, OR within a column).
    const statusF = sessionsTableFilters.status as string[] | undefined;
    if (statusF?.length) {
      result = result.filter((s) => statusF.includes(getSessionWorkflowStatus(s)));
    }
    const assigneeF = sessionsTableFilters.assignee as string[] | undefined;
    if (assigneeF?.length) {
      result = result.filter((s) => assigneeF.includes(s.assigneeName || s.respondentName || '—'));
    }
    const templateF = sessionsTableFilters.template as string[] | undefined;
    if (templateF?.length) {
      result = result.filter((s) =>
        templateF.includes(s.templateName || s.templateCategory || '—')
      );
    }

    return result;
  }, [getSessionWorkflowStatus, searchQuery, sessionStatusFilter, sessions, sessionsTableFilters]);

  // #10 — filter-option lists for the Sessions header dropdowns, derived from the
  // current session data (no extra fetch). Status uses the fixed workflow set.
  const sessionFilterOptions = useMemo(() => {
    const statusValues = new Set<string>();
    const assignees = new Set<string>();
    const templatesSet = new Set<string>();
    for (const s of sessions) {
      statusValues.add(getSessionWorkflowStatus(s));
      assignees.add(s.assigneeName || s.respondentName || '—');
      templatesSet.add(s.templateName || s.templateCategory || '—');
    }
    const statusOrder = ['assigned', 'in_progress', 'submitted', 'approved', 'completed'];
    return {
      status: statusOrder
        .filter((v) => statusValues.has(v))
        .map((v) => ({ value: v, label: t(`interview.hub.assignmentStatus.${v}`) || v })),
      assignee: Array.from(assignees)
        .sort()
        .map((v) => ({ value: v, label: v })),
      template: Array.from(templatesSet)
        .sort()
        .map((v) => ({ value: v, label: v })),
    };
  }, [sessions, getSessionWorkflowStatus, isPolish]);

  // Filter insights
  const filteredInsights = useMemo(() => {
    let result = insights;

    // Filter by analysis type (backend uses promptType; fallback to insightType)
    if (insightTypeFilter !== 'all') {
      result = result.filter((i) => {
        const type = (i as any).promptType || (i as any).insightType || 'summary';
        return type === insightTypeFilter;
      });
    }

    // Filter by status (generating | completed | failed)
    if (insightStatusFilter !== 'all') {
      result = result.filter((i) => (i.status || 'completed') === insightStatusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (i) =>
          (i.title ?? '').toLowerCase().includes(query) ||
          (i.content ?? '').toLowerCase().includes(query)
      );
    }

    return result;
  }, [insights, searchQuery, insightTypeFilter, insightStatusFilter]);

  // Get unique insight types
  const insightTypes = useMemo(() => {
    const types = new Set(insights.map((i: any) => i.promptType || i.insightType || 'summary'));
    return Array.from(types).sort();
  }, [insights]);

  const INSIGHT_TYPE_FILTER_OPTIONS = useMemo(
    () => insightTypes.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
    [insightTypes]
  );
  const INSIGHT_STATUS_FILTER_OPTIONS = [
    { value: 'draft', label: 'Draft' },
    { value: 'generating', label: 'Generating' },
    { value: 'completed', label: 'Completed' },
    { value: 'in_review', label: 'In Review' },
    { value: 'published', label: 'Published' },
    { value: 'failed', label: 'Failed' },
  ];

  // Per-column Source / Exported filter derivation — mirrors EXACTLY the rendered
  // cells in renderInsightsTable (Source ~5658, Exported ~5667). Source collapses
  // to "has sessions" vs "no source"; Exported keys off the same boolean flags as
  // the rendered chips (tools / assessment / none).
  const getInsightSourceKey = useCallback((i: (typeof insights)[number]) => {
    const sessionCount = i.sourceSessionCount ? i.sourceSessionCount : i.sessionId ? 1 : 0;
    return sessionCount > 0 ? 'sessions' : 'none';
  }, []);
  const getInsightExportKeys = useCallback((i: (typeof insights)[number]) => {
    const keys: string[] = [];
    if (i.exportedToTools) keys.push('tools');
    if (i.exportedToAssessment) keys.push('assessment');
    if (keys.length === 0) keys.push('none');
    return keys;
  }, []);
  const INSIGHT_SOURCE_FILTER_OPTIONS = useMemo(() => {
    const present = new Set<string>(insights.map((i) => getInsightSourceKey(i)));
    return [
      { value: 'sessions', label: t('interview.hub.fromSessions') },
      { value: 'none', label: t('interview.hub.noSource') },
    ].filter((o) => present.has(o.value));
  }, [insights, getInsightSourceKey, isPolish]);
  const INSIGHT_EXPORTS_FILTER_OPTIONS = useMemo(() => {
    const present = new Set<string>();
    insights.forEach((i) => getInsightExportKeys(i).forEach((k) => present.add(k)));
    return [
      { value: 'tools', label: t('interview.hub.tools') },
      { value: 'assessment', label: t('interview.hub.assessment') },
      { value: 'none', label: t('interview.hub.notExported') },
    ].filter((o) => present.has(o.value));
  }, [insights, getInsightExportKeys, isPolish]);

  // Insights for the table — column-level filtering now lives inside
  // StandardTable's built-in per-column filterOptions (kanon §A4), so this is
  // a plain alias kept for call-site stability (groupBy / preview lookups).
  const insightsForTable = filteredInsights;

  // Insight statistics
  const insightStats = useMemo(() => {
    return {
      total: insights.length,
      draft: insights.filter((i) => (i.reviewStatus || 'draft') === 'draft').length,
      generating: insights.filter((i) => i.status === 'generating').length,
      completed: insights.filter((i) => i.status === 'completed').length,
      inReview: insights.filter((i) => i.reviewStatus === 'in_review' || i.status === 'in_review')
        .length,
      published: insights.filter((i) => i.reviewStatus === 'published' || i.status === 'published')
        .length,
      failed: insights.filter((i) => i.status === 'failed').length,
      exportedToTools: insights.filter((i) => i.exportedToTools).length,
      exportedToAssessment: insights.filter((i) => i.exportedToAssessment).length,
    };
  }, [insights]);

  const filteredInterviewInitiatives = useMemo(() => {
    let result = interviewInitiatives;
    if (initiativeStatusFilter !== 'all') {
      result = result.filter((initiative) => {
        const status = String(initiative.status || 'DRAFT').toUpperCase();
        if (initiativeStatusFilter === 'draft') return status === 'DRAFT';
        if (initiativeStatusFilter === 'pending_review') {
          return ['PENDING_REVIEW', 'IN_REVIEW', 'REVIEW', 'SUBMITTED'].includes(status);
        }
        if (initiativeStatusFilter === 'promoted') {
          return ['PROMOTED', 'PLANNING', 'APPROVED', 'IN_EXECUTION', 'IN_PROGRESS'].includes(
            status
          );
        }
        return false;
      });
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (initiative) =>
          (initiative.title || initiative.name || '').toLowerCase().includes(query) ||
          (initiative.description || '').toLowerCase().includes(query) ||
          (initiative.category || '').toLowerCase().includes(query)
      );
    }
    // (Per-column status/priority/source filters retired — StandardTable's
    // built-in per-column filterOptions replace them; Triada standard.)
    return result;
  }, [interviewInitiatives, initiativeStatusFilter, searchQuery]);

  const interviewInitiativeStats = useMemo(
    () => ({
      total: interviewInitiatives.length,
      draft: interviewInitiatives.filter(
        (item) => String(item.status || 'DRAFT').toUpperCase() === 'DRAFT'
      ).length,
      pendingReview: interviewInitiatives.filter((item) =>
        ['PENDING_REVIEW', 'IN_REVIEW', 'REVIEW', 'SUBMITTED'].includes(
          String(item.status || '').toUpperCase()
        )
      ).length,
      promoted: interviewInitiatives.filter((item) =>
        ['PROMOTED', 'PLANNING', 'APPROVED', 'IN_EXECUTION', 'IN_PROGRESS'].includes(
          String(item.status || '').toUpperCase()
        )
      ).length,
    }),
    [interviewInitiatives]
  );

  const initiativeWizardSourceBasket = useMemo(
    () => [
      ...insights.slice(0, 10).map((insight) => ({
        type: 'interview_insight',
        id: insight.id,
        title: insight.title,
        status: insight.status,
        confidence: insight.confidence,
        sourceSessionIds: insight.sessionId ? [insight.sessionId] : [],
      })),
      ...sessions.slice(0, 10).map((session) => ({
        type: 'interview_session',
        id: session.id,
        title: session.name,
        status: session.status,
      })),
    ],
    [insights, sessions]
  );

  const initiativeWizardManualNotes = useMemo(() => {
    const insightLines = insights
      .slice(0, 5)
      .map((insight, index) => `${index + 1}. ${insight.title}: ${insight.description || ''}`)
      .join('\n');
    return [
      t('interview.hub.createTransformationInitiativesFromInterview'),
      insightLines ? `\n${t('interview.hub.topInsights')}:\n${insightLines}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }, [insights, isPolish]);

  const interviewWizardManualNotes = useMemo(
    () =>
      [
        t('interview.hub.startedFromInterviewModuleTransform'),
        `${t('interview.hub.insights2')}: ${insights.length}`,
        `${t('interview.hub.existingInterviewInitiatives')}: ${interviewInitiatives.length}`,
      ].join('\n'),
    [insights.length, interviewInitiatives.length, isPolish]
  );

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // V-A S5 — filter by the real status enum (draft/in_review/approved/
    // archived). 'approved' also matches legacy 'published'. Default-to-draft
    // for rows with no status so they remain findable. "All" excludes
    // archived (a terminal/hidden state) so archiving actually hides the
    // template; only the explicit "Archived" chip surfaces them.
    if (templateStatusFilter === 'all') {
      result = result.filter((t) => String(t.status || 'draft').toLowerCase() !== 'archived');
    } else {
      result = result.filter((t) => {
        const s = String(t.status || 'draft').toLowerCase();
        if (templateStatusFilter === 'approved') return s === 'approved' || s === 'published';
        return s === templateStatusFilter;
      });
    }

    if (templateSourceFilter !== 'all') {
      result = result.filter((t) => {
        if (templateSourceFilter === 'application') return t.scope === 'system';
        if (templateSourceFilter === 'organization') return t.scope === 'organization';
        if (templateSourceFilter === 'user') return t.scope === 'private';
        return true;
      });
    }

    if (templateAreaTagFilter.length > 0) {
      result = result.filter((t) => {
        const tags = Array.isArray(t.areaTags) ? t.areaTags : [];
        return templateAreaTagFilter.every((tag) => tags.includes(tag));
      });
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          (t.name ?? '').toLowerCase().includes(query) ||
          (t.description ?? '').toLowerCase().includes(query) ||
          (t.category ?? '').toLowerCase().includes(query) ||
          (t.scope ?? '').toLowerCase().includes(query) ||
          (t.areaTags ?? []).join(' ').toLowerCase().includes(query)
      );
    }

    return result;
  }, [templates, searchQuery, templateSourceFilter, templateAreaTagFilter, templateStatusFilter]);

  // Per-column filter options for the Templates table header dropdowns.
  // Category options are derived from the (toolbar-)filtered template list so
  // only categories that can actually appear are offered. Status options are
  // the canonical template-status enum (draft / in_review / approved /
  // archived), labelled via the shared getTemplateStatusChip helper so the
  // dropdown labels match the chips rendered in the rows.
  const TEMPLATE_CATEGORY_FILTER_OPTIONS = useMemo(() => {
    const categories = new Set<string>();
    filteredTemplates.forEach((t) => {
      const c = (t.category ?? '').trim();
      if (c) categories.add(c);
    });
    return Array.from(categories)
      .sort((a, b) => a.localeCompare(b))
      .map((c) => ({ value: c, label: c }));
  }, [filteredTemplates]);

  const TEMPLATE_STATUS_FILTER_OPTIONS = useMemo(
    () =>
      (['draft', 'in_review', 'approved', 'archived'] as const).map((s) => ({
        value: s,
        label: getTemplateStatusChip(s, t).label,
      })),
    [t]
  );

  // Templates for the table — column-level filtering now lives inside
  // StandardTable's built-in per-column filterOptions (kanon §A4), so this is
  // a plain alias kept for call-site stability. Cards renderer uses
  // filteredTemplates directly.
  const templatesForTable = filteredTemplates;

  // -------------------------
  // Assignments (Assigned tab) status filter
  // -------------------------
  const managedAssignmentStatusCounts = useMemo(() => {
    const list = managedAssignments || [];
    return {
      all: list.length,
      assigned: list.filter((a) => a.status === 'assigned').length,
      in_progress: list.filter((a) => a.status === 'in_progress').length,
      sent_back: list.filter((a) => a.status === 'sent_back').length,
      submitted: list.filter((a) => a.status === 'submitted').length, // to approve
      approved: list.filter((a) => a.status === 'approved').length,
      completed: list.filter((a) => a.status === 'completed').length,
    };
  }, [managedAssignments]);

  const filteredManagedAssignments = useMemo(() => {
    if (assignmentStatusFilter === 'overdue') {
      return overdueAssignments || [];
    }
    let result = managedAssignments || [];
    if (assignmentStatusFilter !== 'all') {
      result = result.filter((a) => a.status === assignmentStatusFilter);
    }
    return result;
  }, [managedAssignments, overdueAssignments, assignmentStatusFilter]);

  // Template statistics
  const templateStats = useMemo(() => {
    return {
      total: templates.length,
      default: templates.filter((t) => t.isDefault).length,
      active: templates.filter((t) => !t.isDefault).length,
      totalQuestions: templates.reduce((sum, t) => sum + t.questionCount, 0),
    };
  }, [templates]);

  // Tab configuration - role-based visibility
  // Pracownik (TEAM_MEMBER/VIEWER): tylko Inbox
  // Pending review insights (for triage tab)
  const pendingReviewInsights = useMemo(
    () => insights.filter((i) => i.reviewStatus === 'in_review' || i.status === 'in_review'),
    [insights]
  );

  // #6 — Inbox (my_assignments) own-work counts. Scoped strictly to the
  // logged-in user's own assignments and framed around their workflow, NOT the
  // org-wide manager framing. "Answered" = the user has submitted; "Sent back"
  // = returned to them for revision.
  const inboxStatusCounts = useMemo(() => {
    const list = myAssignments || [];
    return {
      all: list.length,
      answered: list.filter((a) => a.status === 'submitted').length,
      approved: list.filter((a) => a.status === 'approved' || a.status === 'completed').length,
      sent_back: list.filter((a) => a.status === 'sent_back').length,
    };
  }, [myAssignments]);

  const filteredMyAssignments = useMemo(() => {
    const list = myAssignments || [];
    if (inboxStatusFilter === 'answered') return list.filter((a) => a.status === 'submitted');
    if (inboxStatusFilter === 'approved')
      return list.filter((a) => a.status === 'approved' || a.status === 'completed');
    if (inboxStatusFilter === 'sent_back') return list.filter((a) => a.status === 'sent_back');
    return list;
  }, [myAssignments, inboxStatusFilter]);

  // #12 — DECISION: Sessions and Assigned are intentionally SEPARATE tabs and are
  // NOT merged into a single "Work" tab. They model two different mental models:
  //   • Sessions  = the sender/owner view of interview sessions THEY created
  //                 (lifecycle: Active/Archive/Trash, AI insights, exports).
  //   • Assigned  = the manager view of work assigned to OTHERS
  //                 (approve / send-back / reassign / due-date / escalate).
  // Merging them would conflate "my sessions" with "other people's work" and
  // break the role-scoped chip rows + bulk actions below. Keep them distinct.
  // Manager (PM/ADMIN): wszystkie zakładki
  const tabs = useMemo(() => {
    // L-07 / SPEC_13 §5.4 — surface the module as a numbered pipeline ①–⑥ by
    // prefixing each tab with its canonical stage number. The pipeline sequence
    // is: ① Szablony → ② Przydzielone → ③ Inbox (wypełnienie) → ④ Dopuszczenie
    // (review happens inside Przydzielone/Inbox) → ⑤ Wnioski → ⑥ Inicjatywy.
    // PREVIEW: the numbering is an advisory ordering over the existing flat tabs;
    // a dedicated ④ "Dopuszczenie" inbox is not yet a standalone backed view, so
    // the review stage is reached via the Przydzielone tab's approve/send-back.
    const withStep = (id: string, label: string): string =>
      INTERVIEW_PIPELINE_NUMERAL[id] ? `${INTERVIEW_PIPELINE_NUMERAL[id]} ${label}` : label;

    const baseTabs: Array<{
      id: ModuleTab;
      label: string;
      icon: React.ReactNode;
      count?: number;
    }> = [
      {
        id: 'my_assignments' as ModuleTab,
        label: withStep('my_assignments', 'Inbox'),
        icon: <Inbox size={16} />,
        count: myAssignments.filter((a) => a.status !== 'approved' && a.status !== 'completed')
          .length,
      },
    ];

    if (canViewManaged) {
      baseTabs.push({
        id: 'sessions' as ModuleTab,
        label: t('interview.hub.sessions'),
        icon: <MessageSquare size={16} />,
        count: sessions.length,
      });

      baseTabs.push({
        id: 'managed' as ModuleTab,
        label: withStep('managed', t('interview.hub.assigned')),
        icon: <ClipboardList size={16} />,
        count: managedAssignments.length,
      });
    }

    if (canViewTemplates) {
      baseTabs.push({
        id: 'templates' as ModuleTab,
        label: withStep('templates', t('interview.hub.templates')),
        icon: <FileText size={16} />,
        count: templates.length,
      });
    }

    if (canViewInsights) {
      // ④ Dopuszczenie (pending review) — D-04 (DP-5): the stage is fully built
      // (selector `pendingReviewInsights` + the `activeTab === 'pending_review'`
      // render branch). The dedicated tab is hidden by default before client
      // delivery and surfaced only when `isInterviewPendingReviewTabEnabled()`
      // (flag default OFF). When OFF, ④ is still reached via Przydzielone's
      // approve/send-back — identical to current prod behaviour.
      if (isInterviewPendingReviewTabEnabled()) {
        baseTabs.push({
          id: 'pending_review' as ModuleTab,
          label: withStep('pending_review', t('interview.hub.pendingReview2')),
          icon: <CheckCircle2 size={16} />,
          count: pendingReviewInsights.length,
        });
      }

      baseTabs.push({
        id: 'insights' as ModuleTab,
        label: withStep('insights', t('interview.hub.insights')),
        icon: <Lightbulb size={16} />,
        count: insights.length,
      });

      baseTabs.push({
        id: 'initiatives' as ModuleTab,
        label: withStep('initiatives', t('interview.hub.initiatives')),
        icon: <Rocket size={16} />,
        count: interviewInitiativeStats.total,
      });
    }

    // ④ "Pending review" tab is gated above by isInterviewPendingReviewTabEnabled()
    // (D-04 / DP-5) — default OFF, formalizing the previously bare "hidden" comment.

    return baseTabs;
  }, [
    isPolish,
    sessions.length,
    insights.length,
    interviewInitiativeStats.total,
    templates.length,
    myAssignments,
    managedAssignments,
    pendingReviewInsights.length,
    canViewInsights,
    canViewManaged,
    canViewTemplates,
    canReviewInsights,
  ]);

  // D-03 — pipeline stepper steps, DERIVED from the visible `tabs` so permission
  // gating + the ④ pending-review flag stay in one source of truth. Only the
  // numbered pipeline stages appear (Sessions is a side view, excluded); labels
  // are stripped of the numeral prefix the tab bar adds (the pill shows it).
  const pipelineSteps = useMemo<InterviewPipelineStep[]>(() => {
    return INTERVIEW_PIPELINE_STAGE_ORDER.map((id): InterviewPipelineStep | null => {
      const tab = tabs.find((t) => t.id === id);
      if (!tab) return null;
      return {
        id: tab.id,
        numeral: INTERVIEW_PIPELINE_NUMERAL[id] ?? '',
        label: tab.label.replace(/^[①②③④⑤⑥]\s*/, ''),
        count: tab.count,
      };
    }).filter((s): s is InterviewPipelineStep => s !== null);
  }, [tabs]);

  const ensureProjectId = useCallback(async (): Promise<string | null> => {
    if (currentProjectId) return currentProjectId;
    try {
      const projects = await Api.get('/projects').catch(() => []);
      const first = Array.isArray(projects) ? projects.find((p: any) => Boolean(p?.id)) : null;
      if (first?.id) {
        setCurrentProjectId(first.id);
        return first.id as string;
      }
    } catch (e) {
      // ignore, we'll handle via toast at call sites
    }
    return null;
  }, [currentProjectId, setCurrentProjectId]);

  // Handlers
  const handleNewSession = useCallback(async () => {
    const toastId = INTERVIEW_CREATE_SESSION_TOAST_ID;
    try {
      const projectId = await ensureProjectId();
      if (!projectId) {
        toast.error(t('interview.hub.selectAProjectBeforeCreating'));
        return;
      }
      toast.loading(t('interview.hub.creatingInterviewSession'), {
        id: toastId,
      });
      const newSession = await Api.post('/interview/sessions', {
        projectId,
        name: `Interview ${formatListDate(new Date())}`,
      });

      setSessions((prev) => [newSession as InterviewSession, ...prev]);

      // Open the new session (inline to avoid TDZ issues)
      const doc: OpenDocument = {
        id: (newSession as InterviewSession).id,
        type: 'interview_session',
        name: (newSession as InterviewSession).name || 'Interview Session',
        subType: 'interview',
        status: ((newSession as any)?.status || 'IN_PROGRESS').toString().toUpperCase() as any,
      };
      setOpenDocuments((prev) => {
        if (prev.find((d) => d.id === doc.id)) return prev;
        return [...prev, doc];
      });
      setActiveDocumentId(doc.id);

      toast.success(t('interview.hub.newInterviewSessionStarted'), {
        id: toastId,
      });
    } catch (error) {
      console.error('[InterviewHub] Failed to create session:', error);
      toast.error(
        getSafeInterviewErrorMessage(error, t('interview.hub.failedToCreateSessionPlease')),
        { id: toastId, duration: 6000 }
      );
    }
  }, [ensureProjectId, isPolish]);

  const handleSessionComplete = useCallback(
    async (sessionId: string) => {
      toast.success(t('interview.hub.interviewCompleted'));
      const [sessionsRes, myRes, managedRes, overdueRes] = await Promise.all([
        loadManagedSessions(),
        loadMyAssignments(),
        loadManagedAssignments(),
        loadOverdueAssignments(),
      ]);
      setSessions(Array.isArray(sessionsRes) ? sessionsRes : []);
      setMyAssignments(Array.isArray(myRes) ? myRes : []);
      setManagedAssignments(Array.isArray(managedRes) ? managedRes : []);
      setOverdueAssignments(Array.isArray(overdueRes) ? overdueRes : []);
    },
    [
      isPolish,
      loadManagedAssignments,
      loadManagedSessions,
      loadMyAssignments,
      loadOverdueAssignments,
    ]
  );

  const handleSessionChange = useCallback(
    (session: InterviewSession) => {
      setOpenDocuments((prev) =>
        prev.map((doc) =>
          doc.id === session.id ? { ...doc, name: session.name || 'Interview Session' } : doc
        )
      );
      const completenessPercent =
        session.totalQuestions > 0
          ? Math.round((session.answeredQuestions / session.totalQuestions) * 100)
          : 0;
      setSessions((prev) =>
        prev.map((item) => (item.id === session.id ? { ...item, ...session } : item))
      );
      const mergeAssignmentSession = (assignment: InterviewAssignment) =>
        assignment.sessionId === session.id || assignment.session?.id === session.id
          ? {
              ...assignment,
              sessionId: session.id,
              session: {
                ...(assignment.session || {}),
                id: session.id,
                status: session.status,
                answeredQuestions: session.answeredQuestions,
                totalQuestions: session.totalQuestions,
                completenessPercent,
              },
            }
          : assignment;
      setMyAssignments((prev) => prev.map(mergeAssignmentSession));
      setManagedAssignments((prev) => prev.map(mergeAssignmentSession));
      setOverdueAssignments((prev) => prev.map(mergeAssignmentSession));
    },
    [setOpenDocuments]
  );

  // Search is handled by ModuleHub's onSearch prop

  // Template actions
  const handleNewTemplate = useCallback(() => {
    handleOpenDocument({
      id: `new-template:${Date.now()}`,
      type: 'interview_template',
      subType: 'interview',
      name: t('interview.hub.newTemplate'),
      status: 'DRAFT' as any,
    });
  }, [handleOpenDocument, isPolish]);

  const handleEditTemplate = useCallback(
    (templateId: string) => {
      const template = templates.find((item) => item.id === templateId);
      handleOpenDocument({
        id: templateId,
        type: 'interview_template',
        subType: 'interview',
        name: template?.name || t('interview.hub.template'),
        status: (template?.status || 'draft').toUpperCase() as any,
      });
    },
    [handleOpenDocument, isPolish, templates]
  );

  const handleCloneTemplate = useCallback(
    async (template: InterviewTemplate) => {
      try {
        toast.loading(t('interview.hub.cloningTemplate'));
        const cloned = await Api.post(`/interview/templates/${template.id}/clone`, {
          name: `${template.name} (${t('interview.hub.copy')})`,
        });
        toast.dismiss();
        toast.success(t('interview.hub.templateCloned'));

        // Refresh templates
        const templatesRes = await Api.get('/interview/templates').catch(() => []);
        setTemplates(
          (Array.isArray(templatesRes) ? templatesRes : []).map(normalizeTemplateRecord)
        );

        // Open the cloned template in the dynamic document area
        handleOpenDocument({
          id: (cloned as any).id,
          type: 'interview_template',
          subType: 'interview',
          name: (cloned as any).name || `${template.name} (${t('interview.hub.copy')})`,
          status: ((cloned as any).status || 'draft').toUpperCase() as any,
        });
      } catch (error) {
        toast.dismiss();
        toast.error(t('interview.hub.failedToCloneTemplate'));
        console.error('[InterviewHub] Failed to clone template:', error);
      }
    },
    [handleOpenDocument, isPolish]
  );

  const handleDeleteTemplate = useCallback(
    async (template: InterviewTemplate) => {
      if (!confirm(t('interview.hub.confirmDeleteTemplate', { name: template.name }))) {
        return;
      }

      try {
        await Api.delete(`/interview/templates/${template.id}`);
        toast.success(t('interview.hub.templateDeleted'));

        // Refresh templates
        const templatesRes = await Api.get('/interview/templates').catch(() => []);
        setTemplates(
          (Array.isArray(templatesRes) ? templatesRes : []).map(normalizeTemplateRecord)
        );
      } catch (error) {
        toast.error(t('interview.hub.failedToDeleteTemplate'));
        console.error('[InterviewHub] Failed to delete template:', error);
      }
    },
    [isPolish]
  );

  // V-A S5 — Archive / Restore. The backend routes (POST /templates/:id/archive
  // and /restore) were fully implemented but completely unwired in the UI —
  // dead routes, broken lifecycle. Wired here as row actions.
  const handleArchiveTemplate = useCallback(
    async (template: InterviewTemplate) => {
      try {
        await Api.post(`/interview/templates/${template.id}/archive`, {});
        toast.success(t('interview.hub.templateArchived'));
        const templatesRes = await Api.get('/interview/templates').catch(() => []);
        setTemplates(
          (Array.isArray(templatesRes) ? templatesRes : []).map(normalizeTemplateRecord)
        );
      } catch (error) {
        toast.error(t('interview.hub.failedToArchiveTemplate'));
        console.error('[InterviewHub] Failed to archive template:', error);
      }
    },
    [isPolish]
  );

  const handleRestoreTemplate = useCallback(
    async (template: InterviewTemplate) => {
      try {
        await Api.post(`/interview/templates/${template.id}/restore`, {});
        toast.success(t('interview.hub.templateRestored'));
        const templatesRes = await Api.get('/interview/templates').catch(() => []);
        setTemplates(
          (Array.isArray(templatesRes) ? templatesRes : []).map(normalizeTemplateRecord)
        );
      } catch (error) {
        toast.error(t('interview.hub.failedToRestoreTemplate'));
        console.error('[InterviewHub] Failed to restore template:', error);
      }
    },
    [isPolish]
  );

  // #16 — Usage count for a template. Derived from real assignment data (the same
  // source the template preview footer uses), falling back to the backend
  // `sessionsUsed` counter when assignments aren't loaded. No fabricated numbers.
  const getTemplateUsageCount = useCallback(
    (template: InterviewTemplate): number => {
      const fromAssignments =
        (myAssignments || []).filter((a) => a.templateId === template.id).length +
        (managedAssignments || []).filter((a) => a.templateId === template.id).length;
      if (fromAssignments > 0) return fromAssignments;
      return typeof template.sessionsUsed === 'number' ? template.sessionsUsed : 0;
    },
    [myAssignments, managedAssignments]
  );

  // #15 — Set / unset a template as the org default. Single default per org:
  // setting one clears the flag on every other template (enforced server-side).
  // POST /interview/templates/:id/default { isDefault } returns the updated row;
  // we optimistically reconcile local state to keep the kebab label in sync.
  const handleToggleTemplateDefault = useCallback(
    async (template: InterviewTemplate) => {
      const nextDefault = !template.isDefault;
      try {
        await Api.post(`/interview/templates/${template.id}/default`, {
          isDefault: nextDefault,
        });
        setTemplates((prev) =>
          prev.map((t) => {
            if (t.id === template.id) return { ...t, isDefault: nextDefault };
            // Single default per org: clear any other default when setting one.
            if (nextDefault && t.isDefault) return { ...t, isDefault: false };
            return t;
          })
        );
        toast.success(
          nextDefault
            ? t('interview.hub.setAsDefaultTemplate')
            : t('interview.hub.defaultTemplateUnset')
        );
      } catch (error) {
        toast.error(t('interview.hub.failedToChangeDefaultTemplate'));
        console.error('[InterviewHub] Failed to toggle template default:', error);
      }
    },
    [isPolish]
  );

  // #8b — Session archive/trash lifecycle actions. Endpoints live on the legacy
  // /interview router (POST /sessions/:id/{archive,restore,trash,untrash}, DELETE
  // /sessions/:id, POST /sessions/bulk). After each action we re-fetch the list
  // for the currently-active lifecycle filter so the affected row drops out.
  const handleSessionLifecycleAction = useCallback(
    async (session: InterviewSession, action: 'archive' | 'restore' | 'trash' | 'untrash') => {
      if (sessionLifecycleBusy) return;
      setSessionLifecycleBusy(true);
      try {
        await Api.post(`/interview/sessions/${session.id}/${action}`, {});
        toast.success(t(`interview.hub.sessionActionMsg.${action}`));
        await refreshSessions();
      } catch (error) {
        toast.error(t('interview.hub.couldNotCompleteTheAction'));
        console.error(`[InterviewHub] Session ${action} failed:`, error);
      } finally {
        setSessionLifecycleBusy(false);
      }
    },
    [isPolish, refreshSessions, sessionLifecycleBusy]
  );

  // Permanent delete — only valid once a session is trashed (server returns 409
  // otherwise). Gated behind a type-to-confirm dialog.
  const handleConfirmDeleteSession = useCallback(async () => {
    if (!sessionDeleteTarget || sessionLifecycleBusy) return;
    setSessionLifecycleBusy(true);
    try {
      await Api.delete(`/interview/sessions/${sessionDeleteTarget.id}`);
      toast.success(t('interview.hub.sessionPermanentlyDeleted'));
      setSessionDeleteTarget(null);
      setSessionDeleteConfirmText('');
      await refreshSessions();
    } catch (error) {
      toast.error(t('interview.hub.couldNotDeleteSession'));
      console.error('[InterviewHub] Permanent delete failed:', error);
    } finally {
      setSessionLifecycleBusy(false);
    }
  }, [isPolish, refreshSessions, sessionDeleteTarget, sessionLifecycleBusy]);

  // Bulk archive/trash over the current selection (POST /sessions/bulk).
  const handleBulkSessionLifecycle = useCallback(
    async (action: 'archive' | 'restore' | 'trash' | 'untrash') => {
      const ids = Array.from(selectedSessionIds);
      if (ids.length === 0 || sessionLifecycleBusy) return;
      setSessionLifecycleBusy(true);
      try {
        await Api.post('/interview/sessions/bulk', { ids, action });
        toast.success(t(`interview.hub.sessionsActionDoneMsg.${action}`, { count: ids.length }));
        setSelectedSessionIds(new Set());
        await refreshSessions();
      } catch (error) {
        toast.error(t('interview.hub.couldNotCompleteTheAction'));
        console.error(`[InterviewHub] Bulk ${action} failed:`, error);
      } finally {
        setSessionLifecycleBusy(false);
      }
    },
    [isPolish, refreshSessions, selectedSessionIds, sessionLifecycleBusy]
  );

  // Assignment management actions
  const handleOpenReminderModal = useCallback((assignment: InterviewAssignment) => {
    setSelectedAssignment(assignment);
    setShowReminderModal(true);
  }, []);

  const handleOpenSendBackModal = useCallback((assignment: InterviewAssignment) => {
    setSelectedAssignment(assignment);
    setShowSendBackModal(true);
  }, []);

  const handleSendBack = useCallback(
    async (reason: string) => {
      if (!selectedAssignment) return;

      try {
        await V8InterviewApi.sendBackAssignment(selectedAssignment.id, { reason }).catch(() =>
          Api.post(`/interview/assignments/${selectedAssignment.id}/send-back`, { reason })
        );
        toast.success(t('interview.hub.interviewSentBack'));
        setShowSendBackModal(false);
        setSelectedAssignment(null);

        // Refresh all assignments + manager sessions cockpit
        const [myRes, managedRes, overdueRes, sessionsRes] = await Promise.all([
          loadMyAssignments(),
          loadManagedAssignments(),
          loadOverdueAssignments(),
          loadManagedSessions(),
        ]);
        setMyAssignments(myRes);
        setManagedAssignments(managedRes);
        setOverdueAssignments(overdueRes);
        setSessions(Array.isArray(sessionsRes) ? sessionsRes : []);
      } catch (error: any) {
        console.error('[InterviewHub] Failed to send back:', error);
        safeToastError(error, t('interview.hub.failedToSendBack'), isPolish);
      }
    },
    [
      isPolish,
      loadManagedAssignments,
      loadManagedSessions,
      loadMyAssignments,
      loadOverdueAssignments,
      selectedAssignment,
    ]
  );

  const handleApproveAssignment = useCallback(
    async (assignment: InterviewAssignment) => {
      try {
        await V8InterviewApi.approveAssignment(assignment.id).catch(() =>
          Api.post(`/interview/assignments/${assignment.id}/approve`, {})
        );
        toast.success(t('interview.hub.interviewApproved'));

        // Refresh assignments + manager sessions cockpit (post-approval)
        const [myRes, managedRes, overdueRes, sessionsRes] = await Promise.all([
          loadMyAssignments(),
          loadManagedAssignments(),
          loadOverdueAssignments(),
          loadManagedSessions(),
        ]);
        setMyAssignments(myRes);
        setManagedAssignments(managedRes);
        setOverdueAssignments(overdueRes);
        setSessions(Array.isArray(sessionsRes) ? sessionsRes : []);
      } catch (error: any) {
        console.error('[InterviewHub] Failed to approve assignment:', error);
        safeToastError(error, t('interview.hub.failedToApproveInterview'), isPolish);
      }
    },
    [
      isPolish,
      loadManagedSessions,
      loadManagedAssignments,
      loadMyAssignments,
      loadOverdueAssignments,
    ]
  );

  // #11b — Open the manager Approve flow with the AI snapshot panel.
  const handleOpenApproveModal = useCallback((assignment: InterviewAssignment) => {
    setSelectedAssignment(assignment);
    setShowApproveModal(true);
  }, []);

  // #7b — Open the "Change due date" modal, prefilled from the current due date.
  const handleOpenDueDateModal = useCallback((assignment: InterviewAssignment) => {
    setSelectedAssignment(assignment);
    setDueDateDraft(assignment.dueAt ? assignment.dueAt.slice(0, 10) : '');
    setShowDueDateModal(true);
  }, []);

  // #7b — Persist a new due date via the existing manageAssignment endpoint
  // (mode: 'update' keeps the same assignee/template). Honest error surfacing.
  const handleChangeDueDate = useCallback(async () => {
    if (!selectedAssignment || manageAssignmentBusy) return;
    setManageAssignmentBusy(true);
    try {
      await V8InterviewApi.manageAssignment(selectedAssignment.id, {
        assigneeUserId: selectedAssignment.assigneeUserId,
        templateId: selectedAssignment.templateId,
        dueAt: dueDateDraft ? new Date(dueDateDraft).toISOString() : null,
        priority: selectedAssignment.priority,
        notes: selectedAssignment.notes ?? null,
        mode: 'update',
      });
      toast.success(t('interview.hub.dueDateUpdated'));
      setShowDueDateModal(false);
      setSelectedAssignment(null);
      const [myRes, managedRes, overdueRes] = await Promise.all([
        loadMyAssignments(),
        loadManagedAssignments(),
        loadOverdueAssignments(),
      ]);
      setMyAssignments(myRes);
      setManagedAssignments(managedRes);
      setOverdueAssignments(overdueRes);
    } catch (error: any) {
      console.error('[InterviewHub] Failed to change due date:', error);
      safeToastError(error, t('interview.hub.failedToChangeDueDate'), isPolish);
    } finally {
      setManageAssignmentBusy(false);
    }
  }, [
    dueDateDraft,
    isPolish,
    loadManagedAssignments,
    loadMyAssignments,
    loadOverdueAssignments,
    manageAssignmentBusy,
    selectedAssignment,
  ]);

  // Bulk Delay: push each selected assignment's due date by 7 days (from its
  // current due, or from today if none). Reuses manageAssignment (mode:update),
  // same endpoint as single Change-due-date. No bulk route → fan out per id.
  const handleBulkDelay = useCallback(
    async (days: number) => {
      const ids = Array.from(selectedAssignmentIds);
      if (ids.length === 0 || bulkActionBusy) return;
      const pool = [...myAssignments, ...managedAssignments];
      const rows = ids
        .map((id) => pool.find((a) => a.id === id))
        .filter((a): a is InterviewAssignment => Boolean(a));
      if (rows.length === 0) return;
      setBulkActionBusy(true);
      let done = 0;
      for (const a of rows) {
        try {
          const base = a.dueAt ? new Date(a.dueAt) : new Date();
          base.setDate(base.getDate() + days);
          await V8InterviewApi.manageAssignment(a.id, {
            assigneeUserId: a.assigneeUserId,
            templateId: a.templateId,
            dueAt: base.toISOString(),
            priority: a.priority,
            notes: a.notes ?? null,
            mode: 'update',
          });
          done += 1;
        } catch {
          // per-item failure tolerated; reflected in the final count
        }
      }
      try {
        const [myRes, managedRes, overdueRes] = await Promise.all([
          loadMyAssignments(),
          loadManagedAssignments(),
          loadOverdueAssignments(),
        ]);
        setMyAssignments(myRes);
        setManagedAssignments(managedRes);
        setOverdueAssignments(overdueRes);
      } catch {
        /* best-effort refresh */
      }
      setSelectedAssignmentIds(new Set());
      setBulkActionBusy(false);
      toast.success(t('interview.hub.delayedByDaysCount', { days, done }));
    },
    [
      selectedAssignmentIds,
      bulkActionBusy,
      myAssignments,
      managedAssignments,
      isPolish,
      loadMyAssignments,
      loadManagedAssignments,
      loadOverdueAssignments,
    ]
  );

  // Single-row Delay (kebab submenu): push one assignment's due date by N days.
  const handleDelayAssignment = useCallback(
    async (assignment: InterviewAssignment, days: number) => {
      try {
        const base = assignment.dueAt ? new Date(assignment.dueAt) : new Date();
        base.setDate(base.getDate() + days);
        await V8InterviewApi.manageAssignment(assignment.id, {
          assigneeUserId: assignment.assigneeUserId,
          templateId: assignment.templateId,
          dueAt: base.toISOString(),
          priority: assignment.priority,
          notes: assignment.notes ?? null,
          mode: 'update',
        });
        toast.success(t('interview.hub.delayedByDaysOnlyCount', { days }));
        const [myRes, managedRes, overdueRes] = await Promise.all([
          loadMyAssignments(),
          loadManagedAssignments(),
          loadOverdueAssignments(),
        ]);
        setMyAssignments(myRes);
        setManagedAssignments(managedRes);
        setOverdueAssignments(overdueRes);
      } catch (error) {
        safeToastError(error, t('interview.hub.failedToDelay'), isPolish);
      }
    },
    [isPolish, loadMyAssignments, loadManagedAssignments, loadOverdueAssignments]
  );

  // #7b — Reassign: reuse the existing, fully-wired AssignInterviewModal
  // preselected to this assignment's template. The manager picks a new
  // assignee there. (No dedicated reassign endpoint is exposed to the client,
  // so we route through the real assignment-creation flow rather than fabricate
  // a route.)
  const handleReassignAssignment = useCallback(
    (assignment: InterviewAssignment) => {
      const tpl = templates.find((t) => t.id === assignment.templateId) ?? null;
      setSelectedTemplateForAssign(tpl);
      setShowAssignModal(true);
    },
    [templates]
  );

  // #9b — Manual "Escalate now". Triggers the backend escalation engine for a
  // single assignment via POST /interview/assignments/:id/escalate. On success
  // we refresh the managed list so the escalation columns update.
  const [escalateBusyId, setEscalateBusyId] = useState<string | null>(null);
  const handleEscalateNow = useCallback(
    async (assignment: InterviewAssignment) => {
      if (escalateBusyId) return;
      if (assignment.escalatedAt || assignment.escalationTarget) {
        toast(
          assignment.escalationTarget?.name
            ? t('interview.hub.alreadyEscalatedTo', { name: assignment.escalationTarget.name })
            : t('interview.hub.alreadyEscalated'),
          { icon: 'ℹ️' }
        );
        return;
      }
      setEscalateBusyId(assignment.id);
      try {
        await Api.post(`/interview/assignments/${assignment.id}/escalate`, {});
        toast.success(t('interview.hub.escalated'));
        await refreshManagedAssignments();
      } catch (error) {
        toast.error(t('interview.hub.couldNotEscalate'));
        console.error('[InterviewHub] Escalate now failed:', error);
      } finally {
        setEscalateBusyId(null);
      }
    },
    [escalateBusyId, isPolish, refreshManagedAssignments]
  );

  const getManagedAssignmentForSession = useCallback(
    (session: InterviewSession) =>
      managedAssignments.find(
        (assignment) =>
          assignment.id === session.assignmentId || assignment.sessionId === session.id
      ) || null,
    [managedAssignments]
  );

  // #8 — Bulk Approve over the selected sessions. Sessions don't carry their own
  // approve route; each maps to its managed assignment (getManagedAssignmentForSession)
  // and we reuse the SAME per-id handler the Assigned bulk toolbar uses
  // (V8InterviewApi.approveAssignment) in a loop. Only 'submitted' sessions are
  // approvable, mirroring handleBulkApproveAssignments.
  const handleBulkApproveSessions = useCallback(async () => {
    const ids = Array.from(selectedSessionIds);
    if (ids.length === 0 || bulkActionBusy) return;
    const targets = sessions
      .filter((s) => ids.includes(s.id) && getSessionWorkflowStatus(s) === 'submitted')
      .map((s) => getManagedAssignmentForSession(s))
      .filter((a): a is InterviewAssignment => Boolean(a));
    if (targets.length === 0) {
      toast.error(t('interview.hub.noSubmittedSessionsToApprove'));
      return;
    }
    setBulkActionBusy(true);
    let done = 0;
    for (const a of targets) {
      try {
        await V8InterviewApi.approveAssignment(a.id);
        done += 1;
      } catch {
        // per-item failures tolerated; reflected in the count
      }
    }
    try {
      const [myRes, managedRes, overdueRes] = await Promise.all([
        loadMyAssignments(),
        loadManagedAssignments(),
        loadOverdueAssignments(),
      ]);
      setMyAssignments(myRes);
      setManagedAssignments(managedRes);
      setOverdueAssignments(overdueRes);
    } catch {
      /* ignore refresh failure */
    }
    await refreshSessions(sessionLifecycle);
    setBulkActionBusy(false);
    setSelectedSessionIds(new Set());
    if (done > 0) {
      toast.success(t('interview.hub.approvedCount', { count: done }));
    } else {
      toast.error(t('interview.hub.couldNotApprove'));
    }
  }, [
    selectedSessionIds,
    bulkActionBusy,
    sessions,
    getSessionWorkflowStatus,
    getManagedAssignmentForSession,
    isPolish,
    loadMyAssignments,
    loadManagedAssignments,
    loadOverdueAssignments,
    refreshSessions,
    sessionLifecycle,
  ]);

  // #8 — Bulk Send back over the selected sessions. Same mapping to managed
  // assignments + reuse of V8InterviewApi.sendBackAssignment. Reuses the existing
  // reason-prompt pattern (one shared reason for the batch; per-item reasons stay
  // available from the single-session Send-back modal).
  const handleBulkSendBackSessions = useCallback(async () => {
    const ids = Array.from(selectedSessionIds);
    if (ids.length === 0 || bulkActionBusy) return;
    const targets = sessions
      .filter((s) => ids.includes(s.id) && getSessionWorkflowStatus(s) === 'submitted')
      .map((s) => getManagedAssignmentForSession(s))
      .filter((a): a is InterviewAssignment => Boolean(a));
    if (targets.length === 0) {
      toast.error(t('interview.hub.noSubmittedSessionsToSend'));
      return;
    }
    const reason = (
      window.prompt(
        t('interview.hub.reasonForSendingBackShared'),
        t('interview.hub.returnedForRevisionBulkAction')
      ) || ''
    ).trim();
    if (!reason) return;
    setBulkActionBusy(true);
    let done = 0;
    for (const a of targets) {
      try {
        await V8InterviewApi.sendBackAssignment(a.id, { reason });
        done += 1;
      } catch {
        // per-item failures tolerated
      }
    }
    try {
      const [myRes, managedRes, overdueRes] = await Promise.all([
        loadMyAssignments(),
        loadManagedAssignments(),
        loadOverdueAssignments(),
      ]);
      setMyAssignments(myRes);
      setManagedAssignments(managedRes);
      setOverdueAssignments(overdueRes);
    } catch {
      /* ignore refresh failure */
    }
    await refreshSessions(sessionLifecycle);
    setBulkActionBusy(false);
    setSelectedSessionIds(new Set());
    if (done > 0) {
      toast.success(t('interview.hub.sentBackCount', { count: done }));
    } else {
      toast.error(t('interview.hub.couldNotSendBack'));
    }
  }, [
    selectedSessionIds,
    bulkActionBusy,
    sessions,
    getSessionWorkflowStatus,
    getManagedAssignmentForSession,
    isPolish,
    loadMyAssignments,
    loadManagedAssignments,
    loadOverdueAssignments,
    refreshSessions,
    sessionLifecycle,
  ]);

  // Export intentionally not available in this view (KANON v3).

  const copyToClipboard = useCallback(
    async (text: string) => {
      const value = String(text || '');
      if (!value.trim()) {
        toast.error(t('interview.hub.nothingToCopy'));
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        toast.success(t('interview.hub.copied'));
      } catch {
        toast.error(t('interview.hub.copyFailed'));
      }
    },
    [isPolish]
  );

  const openSessionById = useCallback(
    async (sessionId: string) => {
      try {
        const s = (await V8InterviewApi.getSession(sessionId)
          .then((res) => res.session)
          .catch(() => Api.get(`/interview/sessions/${sessionId}`))) as any;
        if (!s?.id) throw new Error('Session not found');
        handleViewSession(s as InterviewSession);
      } catch (error: any) {
        console.error('[InterviewHub] Failed to open session by id:', error);
        safeToastError(error, t('interview.hub.failedToOpenSession'), isPolish);
      }
    },
    [isPolish, handleViewSession]
  );

  type InsightPromptType =
    | 'summary'
    | 'general_analysis'
    | 'trends'
    | 'problems'
    | 'recommendations'
    | 'comparison'
    | 'gaps'
    | 'risk_assessment'
    | 'opportunity_scan'
    | 'maturity'
    | 'stakeholder_map'
    | 'between_the_lines';

  // Generate insight from session
  const handleGenerateInsight = useCallback(
    async (session: InterviewSession, promptType: InsightPromptType = 'summary') => {
      try {
        toast.loading(t('interview.hub.generatingAiInsights'));
        await V8InterviewApi.createInsight({ sessionId: session.id, promptType }).catch(() =>
          Api.post('/interview/insights', { sessionId: session.id, promptType })
        );
        toast.dismiss();
        toast.success(t('interview.hub.insightsGenerated'));

        // Refresh insights
        const insightsRes = await V8InterviewApi.listInsights()
          .then((r) => r.insights)
          .catch(() => Api.get('/interview/insights').catch(() => []));
        setInsights(Array.isArray(insightsRes) ? insightsRes : []);

        // Switch to insights tab
        setActiveTab('insights');
      } catch (error) {
        toast.dismiss();
        toast.error(t('interview.hub.failedToGenerateInsights'));
        console.error('[InterviewHub] Failed to generate insight:', error);
      }
    },
    [isPolish]
  );

  const handleUpdateInterviewInitiativeStatus = useCallback(
    async (
      initiativeId: string,
      status: 'DRAFT' | 'PENDING_REVIEW' | 'REVIEW',
      options?: { openInInitiatives?: boolean }
    ) => {
      try {
        await Api.patch(`/initiatives/${initiativeId}/status`, { status });
        await loadInterviewInitiatives();
        // Moving an initiative forward can spawn lineage work; refresh the strip.
        void loadInterviewLineage();
        if (status === 'PENDING_REVIEW') {
          toast.success(t('interview.hub.initiativeSentToReview'));
        } else if (status === 'REVIEW') {
          toast.success(t('interview.hub.initiativeApprovedAndMovedTo'));
          if (options?.openInInitiatives) {
            navigate(`/initiatives?open=${encodeURIComponent(initiativeId)}&mode=doc`);
          }
        } else {
          toast.success(t('interview.hub.initiativeReturnedToDraft'));
        }
      } catch (error) {
        console.error('[InterviewHub] Failed to update interview initiative:', error);
        toast.error(t('interview.hub.failedToUpdateStatus'));
      }
    },
    [isPolish, loadInterviewInitiatives, loadInterviewLineage, navigate]
  );

  const renderCommandRow = () => {
    // Search and dynamic tabs are now handled by ModuleHub
    if (activeDocumentId) return null;

    // Interview Inbox counters/status chips — Command Row (single line)
    // MUST: Inbox (moja) / Do zatwierdzenia / Zaległe with counters; click sets filter.
    // #6 — Inbox (my_assignments): own-work chips ONLY. All / Answered /
    // Approved / Sent back, derived from the logged-in user's own assignments.
    // Deliberately NO org-wide "Overdue"/"To approve" framing here — that lives
    // on the manager Assigned tab below.
    if (activeTab === 'my_assignments') {
      const selectedCount = selectedAssignmentIds.size;
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;
      const bulkGhostPill =
        'inline-flex h-8 items-center gap-1 rounded-full border border-slate-200/80 px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100/70 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]';

      const buttons: Array<{
        id: 'all' | 'answered' | 'approved' | 'sent_back';
        label: string;
        count: number;
        icon?: React.ElementType;
        onClick: () => void;
      }> = [
        {
          id: 'all',
          label: t('interview.hub.all'),
          count: inboxStatusCounts.all,
          onClick: () => setInboxStatusFilter('all'),
        },
        {
          id: 'answered',
          label: t('interview.hub.answered'),
          count: inboxStatusCounts.answered,
          icon: Send,
          onClick: () => setInboxStatusFilter((prev) => (prev === 'answered' ? 'all' : 'answered')),
        },
        {
          id: 'approved',
          label: t('interview.hub.approved'),
          count: inboxStatusCounts.approved,
          icon: CheckCircle2,
          onClick: () => setInboxStatusFilter((prev) => (prev === 'approved' ? 'all' : 'approved')),
        },
        {
          id: 'sent_back',
          label: t('interview.hub.sentBack'),
          count: inboxStatusCounts.sent_back,
          icon: RotateCcw,
          onClick: () =>
            setInboxStatusFilter((prev) => (prev === 'sent_back' ? 'all' : 'sent_back')),
        },
      ];

      if (selectedCount > 0) {
        return (
          <div className={MENU_3_ROW_CLASS}>
            <div className={MENU_3_INNER_CLASS}>
              <div className={MENU_3_LEFT_CLASS}>
                <span className="text-xs font-semibold text-c-text-secondary">
                  {selectedCount} {t('interview.hub.selected')}
                </span>
                {/* Fixed/universal buttons — same look as the rest (MENU_3_ACTION_NEUTRAL) */}
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentIds(new Set())}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <X size={14} />
                  {t('interview.hub.clear')}
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkAssignmentLifecycle('archive')}
                  disabled={managedLifecycleBusy}
                  className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {managedLifecycleBusy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Archive size={14} />
                  )}
                  {t('interview.hub.archive')}
                </button>
                <span className="mx-1 h-5 w-px bg-slate-200/80 dark:bg-white/10" />
                {/* Context (Inbox): Delay +1 / +3 / +7 days — same look */}
                {[1, 3, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleBulkDelay(d)}
                    disabled={bulkActionBusy}
                    className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <Clock size={14} />
                    {d === 1
                      ? t('interview.hub.plusDaysOne', { count: d })
                      : t('interview.hub.plusDaysOther', { count: d })}
                  </button>
                ))}
              </div>
              <div className="shrink-0" />
            </div>
          </div>
        );
      }

      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
              {buttons.map((b) => {
                const Icon = b.icon;
                const isActive = inboxStatusFilter === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={b.onClick}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                  >
                    {b.id === 'all' ? (
                      <span className={MENU_3_ALL_DOT_CLASS} />
                    ) : Icon ? (
                      <Icon size={14} />
                    ) : null}
                    <span>{b.label}</span>
                    <span className={`${badgeBase} ${isActive ? badgeActive : badgeInactive}`}>
                      {b.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="shrink-0" />
          </div>
        </div>
      );
    }

    // #7b/#8/#8c — Assigned (managed): manager chips + lifecycle chip-row +
    // bulk actions (Approve / Send back / Remind / Archive).
    if (activeTab === 'managed') {
      const selectedCount = selectedAssignmentIds.size;
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;
      const bulkGhostPill =
        'inline-flex h-8 items-center gap-1 rounded-full border border-slate-200/80 px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100/70 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]';

      const buttons: Array<{
        id: 'all' | 'to-approve' | 'overdue' | 'sent_back';
        label: string;
        count: number;
        icon?: React.ElementType;
        onClick: () => void;
      }> = [
        {
          id: 'all',
          label: t('interview.hub.all'),
          count: managedAssignmentStatusCounts.all,
          onClick: () => setAssignmentStatusFilter('all'),
        },
        {
          id: 'to-approve',
          label: t('interview.hub.toApprove'),
          count: managedAssignmentStatusCounts.submitted ?? 0,
          icon: Check,
          onClick: () =>
            setAssignmentStatusFilter((prev) => (prev === 'submitted' ? 'all' : 'submitted')),
        },
        {
          id: 'overdue',
          label: t('interview.hub.overdue'),
          count: overdueAssignments.length,
          icon: AlertTriangle,
          onClick: () =>
            setAssignmentStatusFilter((prev) => (prev === 'overdue' ? 'all' : 'overdue')),
        },
        {
          id: 'sent_back',
          label: t('interview.hub.sentBack'),
          count: managedAssignmentStatusCounts.sent_back ?? 0,
          icon: RotateCcw,
          onClick: () =>
            setAssignmentStatusFilter((prev) => (prev === 'sent_back' ? 'all' : 'sent_back')),
        },
      ];

      const activeChipId =
        assignmentStatusFilter === 'submitted'
          ? 'to-approve'
          : assignmentStatusFilter === 'overdue'
            ? 'overdue'
            : assignmentStatusFilter === 'sent_back'
              ? 'sent_back'
              : 'all';

      if (selectedCount > 0) {
        return (
          <div className={MENU_3_ROW_CLASS}>
            <div className={MENU_3_INNER_CLASS}>
              <div className={MENU_3_LEFT_CLASS}>
                <span className="text-xs font-semibold text-c-text-secondary">
                  {selectedCount} {t('interview.hub.selected')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentIds(new Set())}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <X size={14} />
                  {t('interview.hub.clear')}
                </button>
                <span className="mx-1 h-5 w-px bg-slate-200/80 dark:bg-white/10" />
                <button
                  type="button"
                  onClick={handleBulkApproveAssignments}
                  disabled={bulkActionBusy}
                  className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {bulkActionBusy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  {t('interview.hub.approve')}
                </button>
                <button
                  type="button"
                  onClick={handleBulkSendBackAssignments}
                  disabled={bulkActionBusy}
                  className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <RotateCcw size={14} />
                  {t('interview.hub.sendBack')}
                </button>
                <button
                  type="button"
                  onClick={handleBulkRemind}
                  disabled={bulkActionBusy}
                  className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Bell size={14} />
                  {t('interview.hub.remind')}
                </button>
                {/* #8 — Bulk Archive (active view) / Restore (archive view),
                    backed by POST /interview/assignments/:id/{archive,restore}. */}
                {managedLifecycle === 'archived' ? (
                  <button
                    type="button"
                    onClick={() => handleBulkAssignmentLifecycle('restore')}
                    disabled={managedLifecycleBusy}
                    className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {managedLifecycleBusy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <RotateCcw size={14} />
                    )}
                    {t('interview.hub.restore')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBulkAssignmentLifecycle('archive')}
                    disabled={managedLifecycleBusy}
                    className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {managedLifecycleBusy ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Archive size={14} />
                    )}
                    {t('interview.hub.archive')}
                  </button>
                )}
              </div>
              <div className="shrink-0" />
            </div>
          </div>
        );
      }

      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
              {buttons.map((b) => {
                const Icon = b.icon;
                const isActive = activeChipId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={b.onClick}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                  >
                    {b.id === 'all' ? (
                      <span className={MENU_3_ALL_DOT_CLASS} />
                    ) : Icon ? (
                      <Icon size={14} />
                    ) : null}
                    <span>{b.label}</span>
                    <span className={`${badgeBase} ${isActive ? badgeActive : badgeInactive}`}>
                      {b.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* #8c — Lifecycle filter: Active | Archive, mirroring the Sessions
                chip-row. Passes ?lifecycle= to the managed-assignments fetch
                (assignments have no trash). */}
            <div className="flex shrink-0 items-center gap-1.5">
              {(
                [
                  { id: 'active', label: t('interview.hub.active'), icon: List },
                  { id: 'archived', label: t('interview.hub.archive2'), icon: Archive },
                ] as const
              ).map((lc) => {
                const isActive = managedLifecycle === lc.id;
                const Icon = lc.icon;
                return (
                  <button
                    key={lc.id}
                    type="button"
                    disabled={managedLifecycleBusy}
                    onClick={() => setManagedLifecycle(lc.id)}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive} ${
                      managedLifecycleBusy ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                    aria-pressed={isActive}
                  >
                    <Icon size={14} />
                    <span>{lc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Sessions counters/status chips — Command Row (single line)
    if (activeTab === 'sessions') {
      const selectedCount = selectedSessionIds.size;
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;
      const bulkGhostPill =
        'inline-flex h-8 items-center gap-1 rounded-full border border-slate-200/80 px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100/70 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]';

      const allCount = sessions.length;
      const inProgressCount = sessions.filter(
        (s) => getSessionWorkflowStatus(s) === 'in_progress'
      ).length;
      const submittedCount = sessions.filter(
        (s) => getSessionWorkflowStatus(s) === 'submitted'
      ).length;
      const approvedCount = sessions.filter((s) =>
        ['approved', 'completed'].includes(getSessionWorkflowStatus(s))
      ).length;

      const buttons: Array<{
        id: 'all' | 'in_progress' | 'submitted' | 'approved';
        label: string;
        count: number;
        icon?: React.ElementType;
        onClick: () => void;
      }> = [
        {
          id: 'all',
          label: t('interview.hub.all'),
          count: allCount,
          onClick: () => setSessionStatusFilter('all'),
        },
        {
          id: 'in_progress',
          label: t('interview.hub.inProgress'),
          count: inProgressCount,
          icon: Clock,
          onClick: () =>
            setSessionStatusFilter((prev) => (prev === 'in_progress' ? 'all' : 'in_progress')),
        },
        {
          id: 'submitted',
          label: t('interview.hub.submitted'),
          count: submittedCount,
          icon: Send,
          onClick: () =>
            setSessionStatusFilter((prev) => (prev === 'submitted' ? 'all' : 'submitted')),
        },
        {
          id: 'approved',
          label: t('interview.hub.approved'),
          count: approvedCount,
          icon: Check,
          onClick: () =>
            setSessionStatusFilter((prev) => (prev === 'approved' ? 'all' : 'approved')),
        },
      ];

      const activeId =
        sessionStatusFilter === 'in_progress' ||
        sessionStatusFilter === 'submitted' ||
        sessionStatusFilter === 'approved'
          ? (sessionStatusFilter as 'in_progress' | 'submitted' | 'approved')
          : 'all';

      if (selectedCount > 0) {
        return (
          <div className={MENU_3_ROW_CLASS}>
            <div className={MENU_3_INNER_CLASS}>
              <div className={MENU_3_LEFT_CLASS}>
                <span className="text-xs font-semibold text-c-text-secondary">
                  {selectedCount} {t('interview.hub.selected')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSessionIds(new Set())}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <X size={14} />
                  {t('interview.hub.clear')}
                </button>
                <span className="mx-1 h-5 w-px bg-slate-200/80 dark:bg-white/10" />
                {/* #8 — Bulk Approve / Send back, mapping selected sessions to
                    their managed assignments and reusing the per-id approve /
                    send-back handlers (manager scope). */}
                {canViewManaged ? (
                  <>
                    <button
                      type="button"
                      onClick={handleBulkApproveSessions}
                      disabled={bulkActionBusy}
                      className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {bulkActionBusy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Check size={14} />
                      )}
                      {t('interview.hub.approve')}
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkSendBackSessions}
                      disabled={bulkActionBusy}
                      className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <RotateCcw size={14} />
                      {t('interview.hub.sendBack')}
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSessionsForInsight(Array.from(selectedSessionIds));
                    setShowInsightModal(true);
                  }}
                  disabled={!canCreateInsights}
                  className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  <Sparkles size={14} />
                  {t('interview.hub.aiInsights')}
                </button>
                <button
                  type="button"
                  onClick={handleBulkExportSessions}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <Download size={14} />
                  {t('interview.hub.exportCsv')}
                </button>
                {/* #8b — Bulk lifecycle actions (scoped to the active filter). */}
                {sessionLifecycle === 'active' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBulkSessionLifecycle('archive')}
                      disabled={sessionLifecycleBusy}
                      className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Archive size={14} />
                      {t('interview.hub.archive')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSessionLifecycle('trash')}
                      disabled={sessionLifecycleBusy}
                      className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Trash2 size={14} />
                      {t('interview.hub.trash')}
                    </button>
                  </>
                ) : null}
                {sessionLifecycle === 'archived' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleBulkSessionLifecycle('restore')}
                      disabled={sessionLifecycleBusy}
                      className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <RotateCcw size={14} />
                      {t('interview.hub.restore')}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkSessionLifecycle('trash')}
                      disabled={sessionLifecycleBusy}
                      className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      <Trash2 size={14} />
                      {t('interview.hub.trash')}
                    </button>
                  </>
                ) : null}
                {sessionLifecycle === 'trash' ? (
                  <button
                    type="button"
                    onClick={() => handleBulkSessionLifecycle('untrash')}
                    disabled={sessionLifecycleBusy}
                    className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    <RotateCcw size={14} />
                    {t('interview.hub.restore')}
                  </button>
                ) : null}
              </div>
              <div className="shrink-0" />
            </div>
          </div>
        );
      }

      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
              {buttons.map((b) => {
                const Icon = b.icon;
                const isActive = activeId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={b.onClick}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                  >
                    {b.id === 'all' ? (
                      <span className={MENU_3_ALL_DOT_CLASS} />
                    ) : Icon ? (
                      <Icon size={14} />
                    ) : null}
                    <span>{b.label}</span>
                    <span className={`${badgeBase} ${isActive ? badgeActive : badgeInactive}`}>
                      {b.count}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* #8b — Lifecycle filter: Active | Archive | Trash. Sets the
                ?lifecycle= param on the managed-sessions fetch and refetches. */}
            <div className="flex shrink-0 items-center gap-1.5">
              {(
                [
                  { id: 'active', label: t('interview.hub.active'), icon: List },
                  { id: 'archived', label: t('interview.hub.archive2'), icon: Archive },
                  { id: 'trash', label: t('interview.hub.trash2'), icon: Trash2 },
                ] as const
              ).map((lc) => {
                const Icon = lc.icon;
                const isActive = sessionLifecycle === lc.id;
                return (
                  <button
                    key={lc.id}
                    type="button"
                    onClick={() => setSessionLifecycle(lc.id)}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                    aria-pressed={isActive}
                  >
                    <Icon size={14} />
                    <span>{lc.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      );
    }

    // Templates counters/status chips — Command Row (single line)
    if (activeTab === 'templates') {
      const selectedCount = selectedTemplateIds.size;
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;
      const bulkGhostPill =
        'inline-flex h-8 items-center gap-1 rounded-full border border-slate-200/80 px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-100/70 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/[0.06]';

      const buttons: Array<{
        id: 'all' | 'draft' | 'in_review' | 'approved' | 'archived';
        label: string;
        count: number;
        onClick: () => void;
      }> = [
        {
          id: 'all',
          label: t('interview.hub.all'),
          // "All" excludes archived (matches the filter behavior).
          count: templates.filter((t) => String(t.status || 'draft').toLowerCase() !== 'archived')
            .length,
          onClick: () => setTemplateStatusFilter('all'),
        },
        {
          id: 'draft',
          label: t('interview.hub.draft2'),
          count: templates.filter((t) => !t.status || String(t.status).toLowerCase() === 'draft')
            .length,
          onClick: () => setTemplateStatusFilter('draft'),
        },
        {
          id: 'in_review',
          label: t('interview.hub.inReview'),
          count: templates.filter((t) => String(t.status).toLowerCase() === 'in_review').length,
          onClick: () => setTemplateStatusFilter('in_review'),
        },
        {
          id: 'approved',
          label: t('interview.hub.published2'),
          count: templates.filter((t) => {
            const s = String(t.status).toLowerCase();
            return s === 'approved' || s === 'published';
          }).length,
          onClick: () => setTemplateStatusFilter('approved'),
        },
        {
          id: 'archived',
          label: t('interview.hub.archived2'),
          count: templates.filter((t) => String(t.status).toLowerCase() === 'archived').length,
          onClick: () => setTemplateStatusFilter('archived'),
        },
      ];

      if (selectedCount > 0) {
        const isArchived = templateStatusFilter === 'archived';
        return (
          <div className={MENU_3_ROW_CLASS}>
            <div className={MENU_3_INNER_CLASS}>
              <div className={MENU_3_LEFT_CLASS}>
                <span className="text-xs font-semibold text-c-text-secondary">
                  {selectedCount} {t('interview.hub.selected')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTemplateIds(new Set())}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <X size={14} />
                  {t('interview.hub.clear')}
                </button>
                <span className="mx-1 h-5 w-px bg-slate-200/80 dark:bg-white/10" />
                <button
                  type="button"
                  onClick={handleBulkCloneTemplates}
                  disabled={bulkActionBusy}
                  className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {bulkActionBusy ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Copy size={14} />
                  )}
                  {t('interview.hub.clone')}
                </button>
                {canAssign &&
                  (isArchived ? (
                    <button
                      type="button"
                      onClick={handleBulkRestoreTemplates}
                      disabled={bulkActionBusy}
                      className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {bulkActionBusy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RotateCcw size={14} />
                      )}
                      {t('interview.hub.restore')}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleBulkArchiveTemplates}
                      disabled={bulkActionBusy}
                      className={`${MENU_3_ACTION_NEUTRAL} disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {bulkActionBusy ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Archive size={14} />
                      )}
                      {t('interview.hub.archive')}
                    </button>
                  ))}
              </div>
              <div className="shrink-0" />
            </div>
          </div>
        );
      }

      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
              {buttons.map((b) => (
                <button
                  key={b.id}
                  onClick={b.onClick}
                  className={`${chipBase} ${templateStatusFilter === b.id ? chipActive : chipInactive}`}
                >
                  {b.id === 'all' ? <span className={MENU_3_ALL_DOT_CLASS} /> : null}
                  <span>{b.label}</span>
                  <span
                    className={`${badgeBase} ${
                      templateStatusFilter === b.id ? badgeActive : badgeInactive
                    }`}
                  >
                    {b.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="shrink-0" />
          </div>
        </div>
      );
    }

    if (activeTab === 'insights') {
      const selectedCount = selectedInsightIds.size;
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;

      const buttons: Array<{
        id: 'all' | 'completed' | 'failed' | 'published';
        label: string;
        count: number;
        icon?: React.ElementType;
        onClick: () => void;
      }> = [
        {
          id: 'all',
          label: t('interview.hub.all'),
          count: insightStats.total,
          onClick: () => setInsightStatusFilter('all'),
        },
        {
          id: 'completed',
          label: t('interview.hub.ready'),
          count: insightStats.completed,
          icon: Check,
          onClick: () =>
            setInsightStatusFilter((prev) => (prev === 'completed' ? 'all' : 'completed')),
        },
        {
          id: 'failed',
          label: t('interview.hub.failed'),
          count: insightStats.failed,
          icon: AlertTriangle,
          onClick: () => setInsightStatusFilter((prev) => (prev === 'failed' ? 'all' : 'failed')),
        },
        {
          id: 'published',
          label: t('interview.hub.published2'),
          count: insightStats.published,
          icon: Send,
          onClick: () =>
            setInsightStatusFilter((prev) => (prev === 'published' ? 'all' : 'published')),
        },
      ];
      const activeId =
        insightStatusFilter === 'completed' ||
        insightStatusFilter === 'failed' ||
        insightStatusFilter === 'published'
          ? (insightStatusFilter as 'completed' | 'failed' | 'published')
          : 'all';

      if (selectedCount > 0) {
        return (
          <div className={MENU_3_ROW_CLASS}>
            <div className={MENU_3_INNER_CLASS}>
              <div className={MENU_3_LEFT_CLASS}>
                <span className="text-xs font-semibold text-c-text-secondary">
                  {selectedCount} {t('interview.hub.selected')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInsightIds(new Set())}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <X size={14} />
                  {t('interview.hub.clear')}
                </button>
                <span className="mx-1 h-5 w-px bg-slate-200/80 dark:bg-white/10" />
                <button
                  type="button"
                  onClick={handleBulkExportInsights}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <Download size={14} />
                  {t('interview.hub.exportCsv')}
                </button>
                {insightScope === 'archived' ? (
                  <button
                    type="button"
                    onClick={() => handleBulkSetInsightsArchived(false)}
                    className={MENU_3_ACTION_NEUTRAL}
                  >
                    <RotateCcw size={14} />
                    {t('interview.hub.restore')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleBulkSetInsightsArchived(true)}
                    className={MENU_3_ACTION_NEUTRAL}
                  >
                    <Archive size={14} />
                    {t('interview.hub.archive')}
                  </button>
                )}
              </div>
              <div className="shrink-0" />
            </div>
          </div>
        );
      }

      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
              {buttons.map((button) => {
                const Icon = button.icon;
                const isActive = activeId === button.id;
                return (
                  <button
                    key={button.id}
                    type="button"
                    onClick={button.onClick}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                  >
                    {button.id === 'all' ? (
                      <span className={MENU_3_ALL_DOT_CLASS} />
                    ) : Icon ? (
                      <Icon size={14} />
                    ) : null}
                    <span>{button.label}</span>
                    <span className={`${badgeBase} ${isActive ? badgeActive : badgeInactive}`}>
                      {button.count}
                    </span>
                  </button>
                );
              })}
              {/* Lifecycle scope toggle — Active (default) vs Archived. */}
              <span className="mx-1 h-5 w-px bg-slate-200/80 dark:bg-white/10" />
              <button
                type="button"
                onClick={() =>
                  setInsightScope((prev) => (prev === 'archived' ? 'active' : 'archived'))
                }
                className={`${chipBase} ${insightScope === 'archived' ? chipActive : chipInactive}`}
                title={t('interview.hub.showArchivedInsights')}
              >
                <Archive size={14} />
                <span>{t('interview.hub.archived2')}</span>
              </button>
            </div>
            <div className="shrink-0" />
          </div>
        </div>
      );
    }

    if (activeTab === 'initiatives') {
      const selectedCount = selectedInitiativeIds.size;
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;

      const buttons: Array<{
        id: 'all' | 'draft' | 'pending_review' | 'promoted';
        label: string;
        count: number;
        icon?: React.ElementType;
      }> = [
        {
          id: 'all',
          label: t('interview.hub.all'),
          count: interviewInitiativeStats.total,
        },
        {
          id: 'draft',
          label: t('interview.hub.drafts'),
          count: interviewInitiativeStats.draft,
          icon: Edit2,
        },
        {
          id: 'pending_review',
          label: t('interview.hub.pendingReview3'),
          count: interviewInitiativeStats.pendingReview,
          icon: Clock,
        },
        {
          id: 'promoted',
          label: t('interview.hub.movedForward'),
          count: interviewInitiativeStats.promoted,
          icon: Rocket,
        },
      ];

      const selectedInitiativeList = Array.from(selectedInitiativeIds)
        .map((id) => interviewInitiatives.find((x) => x.id === id))
        .filter(Boolean) as InterviewInitiativeDraft[];
      const draftSelectedCount = selectedInitiativeList.filter(
        (i) => String(i.status || 'DRAFT').toUpperCase() === 'DRAFT'
      ).length;
      const pendingSelectedCount = selectedInitiativeList.filter((i) =>
        ['PENDING_REVIEW', 'IN_REVIEW', 'REVIEW', 'SUBMITTED'].includes(
          String(i.status || '').toUpperCase()
        )
      ).length;
      const bulkInitiativeTransition = async (
        target: 'PENDING_REVIEW' | 'REVIEW',
        from: string[]
      ) => {
        const targetIds = selectedInitiativeList
          .filter((i) => from.includes(String(i.status || 'DRAFT').toUpperCase()))
          .map((i) => i.id);
        if (!targetIds.length) return;
        await Promise.all(
          targetIds.map((id) =>
            Api.patch(`/initiatives/${id}/status`, { status: target }).catch(() => null)
          )
        );
        setSelectedInitiativeIds(new Set());
        await loadInterviewInitiatives();
        toast.success(t('interview.hub.updatedCountParen', { count: targetIds.length }));
      };

      if (selectedCount > 0) {
        // Kanon §15.3 Formuła 2: ZAWSZE ≥1 akcja poza Clear. Lifecycle (Archiwizuj/Usuń) =
        // backlog B-1 — disabled z notą, ale widoczne (slot nie może być pusty).
        const _isPromoted = (raw?: string) => {
          const s = String(raw || 'DRAFT').toUpperCase();
          return [
            'PROMOTED',
            'PLANNING',
            'APPROVED',
            'IN_EXECUTION',
            'IN_PROGRESS',
            'REVIEW',
          ].includes(s);
        };
        const promotedSelectedCount = selectedInitiativeList.filter((i) =>
          _isPromoted(i.status)
        ).length;
        return (
          <div className={MENU_3_ROW_CLASS}>
            <div className={MENU_3_INNER_CLASS}>
              <div className={MENU_3_LEFT_CLASS}>
                <span className="text-xs font-semibold text-c-text-secondary">
                  {selectedCount} {t('interview.hub.selected')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInitiativeIds(new Set())}
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <X size={14} />
                  {t('interview.hub.clear')}
                </button>
                {/* Separator — status-zależne */}
                <span className="mx-1 h-5 w-px bg-slate-200/80 dark:bg-white/10" />
                {/* Wyślij do przeglądu — tylko gdy są zaznaczone drafty */}
                {draftSelectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void bulkInitiativeTransition('PENDING_REVIEW', ['DRAFT'])}
                    className={MENU_3_ACTION_NEUTRAL}
                  >
                    <ArrowRight size={14} />
                    {t('interview.hub.sendToReview')}
                  </button>
                )}
                {/* Zatwierdź — tylko gdy zaznaczone są pending + canReview */}
                {canReviewInsights && pendingSelectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      void bulkInitiativeTransition('REVIEW', [
                        'PENDING_REVIEW',
                        'IN_REVIEW',
                        'REVIEW',
                        'SUBMITTED',
                      ])
                    }
                    className={MENU_3_ACTION_NEUTRAL}
                  >
                    <Rocket size={14} />
                    {t('interview.hub.approveMoveForward')}
                  </button>
                )}
                {/* Otwórz w module — dla zaznaczonych promoted (zawsze dostępna akcja) */}
                {promotedSelectedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const ids = selectedInitiativeList
                        .filter((i) => _isPromoted(i.status))
                        .map((i) => i.id);
                      if (ids[0])
                        navigate(`/initiatives?open=${encodeURIComponent(ids[0])}&mode=doc`);
                    }}
                    className={MENU_3_ACTION_NEUTRAL}
                  >
                    <ExternalLink size={14} />
                    {t('interview.hub.openInModule')}
                  </button>
                )}
                {/* Separator + lifecycle (backlog B-1 — disabled z notą) */}
                <span className="mx-1 h-5 w-px bg-slate-200/80 dark:bg-white/10" />
                <button
                  type="button"
                  disabled
                  title={t('interview.hub.comingSoonBackend')}
                  className={`${MENU_3_ACTION_NEUTRAL} cursor-not-allowed opacity-40`}
                >
                  <Archive size={14} />
                  {t('interview.hub.archive')}
                </button>
              </div>
              <div className="shrink-0" />
            </div>
          </div>
        );
      }

      return (
        <div className={MENU_3_ROW_CLASS}>
          <div className={MENU_3_INNER_CLASS}>
            <div className={MENU_3_LEFT_CLASS}>
              {buttons.map((button) => {
                const Icon = button.icon;
                const isActive = initiativeStatusFilter === button.id;
                return (
                  <button
                    key={button.id}
                    type="button"
                    onClick={() => setInitiativeStatusFilter(button.id)}
                    className={`${chipBase} ${isActive ? chipActive : chipInactive}`}
                  >
                    {button.id === 'all' ? (
                      <span className={MENU_3_ALL_DOT_CLASS} />
                    ) : Icon ? (
                      <Icon size={14} />
                    ) : null}
                    <span>{button.label}</span>
                    <span className={`${badgeBase} ${isActive ? badgeActive : badgeInactive}`}>
                      {button.count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="shrink-0" />
          </div>
        </div>
      );
    }

    return null;
  };

  // Session status configuration
  const getSessionStatusConfig = (status: string) => {
    const configs: Record<
      string,
      { label: { en: string; pl: string }; bgColor: string; textColor: string; dotColor: string }
    > = {
      in_progress: {
        label: { en: 'In Progress', pl: 'W trakcie' },
        bgColor:
          'border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100',
        textColor: 'text-blue-800 dark:text-blue-100',
        dotColor: 'bg-blue-500 dark:bg-blue-300',
      },
      submitted: {
        label: { en: 'Submitted', pl: 'Wysłany' },
        bgColor:
          'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100',
        textColor: 'text-amber-800 dark:text-amber-100',
        dotColor: 'bg-amber-500 dark:bg-amber-300',
      },
      sent_back: {
        label: { en: 'Sent Back', pl: 'Do poprawy' },
        bgColor: 'border-c-danger/30 bg-c-danger/[0.08] text-c-danger',
        textColor: 'text-c-danger',
        dotColor: 'bg-c-danger',
      },
      approved: {
        label: { en: 'Approved', pl: 'Zatwierdzony' },
        bgColor:
          'border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100',
        textColor: 'text-emerald-800 dark:text-emerald-100',
        dotColor: 'bg-emerald-500 dark:bg-emerald-300',
      },
      in_review: {
        label: { en: 'In Review', pl: 'Do przeglądu' },
        bgColor:
          'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100',
        textColor: 'text-amber-800 dark:text-amber-100',
        dotColor: 'bg-amber-500 dark:bg-amber-300',
      },
      completed: {
        label: { en: 'Completed', pl: 'Zakończony' },
        bgColor:
          'border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100',
        textColor: 'text-emerald-800 dark:text-emerald-100',
        dotColor: 'bg-emerald-500 dark:bg-emerald-300',
      },
      paused: {
        label: { en: 'Paused', pl: 'Wstrzymany' },
        bgColor:
          'bg-slate-100 border border-slate-200 dark:bg-slate-500/20 dark:border-slate-500/30',
        textColor: 'text-slate-700 dark:text-slate-300',
        dotColor: 'bg-slate-500 dark:bg-slate-400',
      },
      archived: {
        label: { en: 'Archived', pl: 'Zarchiwizowany' },
        bgColor:
          'bg-slate-100 border border-slate-200 dark:bg-slate-500/20 dark:border-slate-500/30',
        textColor: 'text-slate-700 dark:text-slate-300',
        dotColor: 'bg-slate-500 dark:bg-slate-400',
      },
    };
    return configs[status] || configs.in_progress;
  };

  // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): Interview
  // Sessions (table mode) → StandardTable, mirroring the Inbox pattern
  // 1:1 (moduł deklaruje TYLKO dane + kontrakt kebaba/akcji; chrome pochodzi
  // z fasady StandardTable). §27-exempt custom resizer/FilterDropdown/manual
  // checkbox mechanics retired in favour of the shared facade.
  const renderSessionsTable = (
    rows: InterviewSession[] = filteredSessions,
    opts?: {
      onRowClick?: (id: string) => void;
      onRowDoubleClick?: (id: string) => void;
      selectedId?: string | null;
    }
  ) => {
    // #9 — Overdue computation, mirrors the Assignments-table `getAssignmentDaysToDue`
    // logic. A session is overdue when it has a due date in the past AND has not
    // yet been submitted/approved. Returns the whole-day delta (negative = past).
    const getSessionDaysOverdue = (session: InterviewSession): number | null => {
      if (!session.dueAt) return null;
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const due = new Date(session.dueAt);
      due.setHours(0, 0, 0, 0);
      const diffMs = due.getTime() - now.getTime();
      return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    };

    const sessionColumns: StandardTableColumn[] = [
      {
        id: 'name',
        label: t('interview.hub.name'),
        render: (row: InterviewSession) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className={INTERVIEW_TABLE_ICON_SURFACE_CLASS}>
              <Brain size={15} />
            </div>
            <span className="text-sm font-semibold text-c-text block truncate">
              {row.name || 'Discovery Interview'}
            </span>
          </div>
        ),
      },
      {
        id: 'template',
        label: t('interview.hub.template2'),
        width: '160px',
        filterable: true,
        filterOptions: sessionFilterOptions.template,
        render: (row: InterviewSession) => (
          <span className="text-xs text-c-text-secondary">
            {row.templateName || row.templateCategory || '—'}
          </span>
        ),
      },
      {
        id: 'assignee',
        label: t('interview.hub.assignee'),
        width: '170px',
        filterable: true,
        filterOptions: sessionFilterOptions.assignee,
        render: (row: InterviewSession) => (
          <AssigneeCell
            name={row.assigneeName || row.respondentName || null}
            unassignedLabel={t('interview.hub.unassigned')}
          />
        ),
      },
      {
        id: 'status',
        label: t('interview.hub.status'),
        width: '150px',
        filterable: true,
        filterOptions: sessionFilterOptions.status,
        render: (row: InterviewSession) => {
          const workflowStatus = getSessionWorkflowStatus(row);
          const statusConfig = getSessionStatusConfig(workflowStatus);
          return (
            <EntityStatusChip
              status={workflowStatus}
              label={t(`interview.hub.sessionStatusLabel.${workflowStatus}`, statusConfig.label.en)}
            />
          );
        },
      },
      {
        id: 'progress',
        label: t('interview.hub.progress'),
        width: '130px',
        align: 'right',
        render: (row: InterviewSession) => <ProgressCell value={getSessionProgress(row)} />,
      },
      {
        id: 'due',
        label: t('interview.hub.due'),
        width: '160px',
        sortable: true,
        sortAccessor: (row: InterviewSession) => (row.dueAt ? new Date(row.dueAt).getTime() : 0),
        render: (row: InterviewSession) => {
          // Canon §4.4 — ONE Due column: neutral date, danger when overdue
          // (and not yet submitted/approved). Overdue merged here as a DueChip.
          if (!row.dueAt) return <span className="text-xs text-c-text-muted">—</span>;
          const workflowStatus = getSessionWorkflowStatus(row);
          const isApproved = ['approved', 'completed'].includes(workflowStatus);
          const isSubmitted = workflowStatus === 'submitted';
          const daysToDue = getSessionDaysOverdue(row);
          const resolved = isSubmitted || isApproved;
          const overdue = daysToDue != null && daysToDue < 0 && !resolved;
          const absDays = daysToDue != null ? Math.abs(daysToDue) : 0;
          const dateLabel = formatListDate(row.dueAt);
          return (
            <DueChip
              label={
                overdue
                  ? absDays === 1
                    ? t('interview.hub.overdueDaysOne', { count: absDays })
                    : t('interview.hub.overdueDaysOther', { count: absDays })
                  : dateLabel
              }
              risk={overdue ? 'overdue' : 'none'}
              showIcon
              title={dateLabel}
            />
          );
        },
      },
      {
        id: 'submitted',
        label: t('interview.hub.submitted2'),
        width: '150px',
        sortable: true,
        sortAccessor: (row: InterviewSession) =>
          row.submittedAt ? new Date(row.submittedAt).getTime() : 0,
        render: (row: InterviewSession) =>
          row.submittedAt ? (
            <span className="text-xs text-c-text-secondary">{formatListDate(row.submittedAt)}</span>
          ) : (
            <span className="text-xs text-c-text-muted">—</span>
          ),
      },
    ];

    return (
      <StandardTable
        columns={sessionColumns}
        data={rows as unknown as Array<Record<string, unknown> & { id: string }>}
        selectedRowId={opts?.selectedId ?? null}
        onRowClick={(row) => {
          const session = row as unknown as InterviewSession;
          if (opts?.onRowClick) opts.onRowClick(session.id);
          else handleViewSession(session);
        }}
        onRowDoubleClick={(row) => {
          const session = row as unknown as InterviewSession;
          if (opts?.onRowDoubleClick) opts.onRowDoubleClick(session.id);
          else handleViewSession(session);
        }}
        rowDescription={(row) => {
          const session = row as unknown as InterviewSession;
          const secondaryMeta = session.templateName || session.templateCategory || '—';
          return `${t('interview.hub.template2')}: ${secondaryMeta}`;
        }}
        defaultSort={{ columnId: 'due', direction: 'asc' }}
        persistKey="interview.sessions.list"
        selection={{ selectedIds: selectedSessionIds, onChange: setSelectedSessionIds }}
        empty={{
          icon: Brain,
          title: t('interview.hub.runYourFirstInterview'),
          description: t('interview.hub.startYourFirstStakeholderInterview'),
          actionLabel: t('interview.hub.useATemplate'),
          onAction: () => {
            setActiveTab('templates');
            setActiveDocumentId(null);
          },
        }}
        rowMenu={(row): StandardRowMenu => {
          const session = row as unknown as InterviewSession;
          const workflowStatus = getSessionWorkflowStatus(session);
          const isApproved = ['approved', 'completed'].includes(workflowStatus);
          const isSubmitted = workflowStatus === 'submitted';
          const canRemind = ['in_progress', 'sent_back'].includes(workflowStatus);
          const linkedAssignment = getManagedAssignmentForSession(session);

          return {
            primary: [
              ...(isSubmitted && linkedAssignment
                ? [
                    {
                      id: 'approve',
                      label: t('interview.hub.approve'),
                      icon: Check,
                      onClick: () => handleApproveAssignment(linkedAssignment),
                    },
                  ]
                : []),
              ...(isApproved
                ? [
                    {
                      id: 'generate-insight',
                      label: t('interview.hub.generateAiInsights'),
                      icon: Lightbulb,
                      onClick: () => handleGenerateInsight(session, 'summary'),
                    },
                  ]
                : []),
            ],
            statusTransitions: [
              ...(isSubmitted && linkedAssignment
                ? [
                    {
                      id: 'send-back',
                      label: t('interview.hub.sendBack2'),
                      icon: ArrowRight,
                      onClick: () => handleOpenSendBackModal(linkedAssignment),
                    },
                  ]
                : []),
              ...(canRemind && linkedAssignment
                ? [
                    {
                      id: 'remind',
                      label: t('interview.hub.remind'),
                      icon: Clock,
                      onClick: () => handleOpenReminderModal(linkedAssignment),
                    },
                  ]
                : []),
              // Restore/Untrash to real (non-Archive) labels — Blok 4 "Archive"
              // stays reserved for the active→archived transition only.
              ...(sessionLifecycle === 'archived'
                ? [
                    {
                      id: 'restore',
                      label: t('interview.hub.restore'),
                      icon: RotateCcw,
                      disabled: sessionLifecycleBusy,
                      onClick: () => handleSessionLifecycleAction(session, 'restore'),
                    },
                  ]
                : []),
              ...(sessionLifecycle === 'trash'
                ? [
                    {
                      id: 'untrash',
                      label: t('interview.hub.restore'),
                      icon: RotateCcw,
                      disabled: sessionLifecycleBusy,
                      onClick: () => handleSessionLifecycleAction(session, 'untrash'),
                    },
                  ]
                : []),
            ],
            timeActions: linkedAssignment
              ? [
                  {
                    id: 'delay',
                    label: t('interview.hub.delay'),
                    icon: Clock,
                    submenu: [1, 3, 7].map((d) => ({
                      id: `delay-${d}`,
                      label:
                        d === 1
                          ? t('interview.hub.plusDaysOne', { count: d })
                          : t('interview.hub.plusDaysOther', { count: d }),
                      icon: Clock,
                      onClick: () => void handleDelayAssignment(linkedAssignment, d),
                    })),
                  },
                ]
              : [],
            universalHandlers: {
              preview: () => handleViewSession(session),
              archive:
                sessionLifecycle === 'active'
                  ? () => handleSessionLifecycleAction(session, 'archive')
                  : undefined,
              archiveNote:
                sessionLifecycle === 'active' ? undefined : t('interview.hub.useRestoreAbove'),
              // Brak endpointu edycji sesji — disabled z notą (StandardTable dokłada ją sama).
            },
            destructive:
              sessionLifecycle === 'archived'
                ? {
                    label: t('interview.hub.moveToTrash'),
                    onClick: () => handleSessionLifecycleAction(session, 'trash'),
                  }
                : sessionLifecycle === 'trash'
                  ? {
                      label: t('interview.hub.deleteForever'),
                      onClick: () => {
                        setSessionDeleteConfirmText('');
                        setSessionDeleteTarget(session);
                      },
                    }
                  : {
                      // sessionLifecycle === 'active' — archiwizuj najpierw (StandardTable dokłada notę).
                      note: t('interview.hub.archiveFirst'),
                    },
          };
        }}
      />
    );
  };

  // Render grid view for sessions
  const renderSessionsGrid = ({ onCardClick }: { onCardClick?: (id: string) => void } = {}) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredSessions.map((session) => {
        const progress = getSessionProgress(session);
        const workflowStatus = getSessionWorkflowStatus(session);
        const linkedAssignment = getManagedAssignmentForSession(session);
        const isApproved = ['approved', 'completed'].includes(workflowStatus);
        const isSubmitted = workflowStatus === 'submitted';
        const canRemind = ['in_progress', 'sent_back'].includes(workflowStatus);

        const statusConfig = getSessionStatusConfig(workflowStatus);

        // canon §8.0/§8.1: card kebab = identyczne sekcje co w tabeli (kontekst →
        // fixed bottom manifest → danger). NO status-colored gradients.
        const kebabSections: import('../shared/RowActionsMenu').RowActionSection[] = [
          // GÓRA — kontekstowe (wg statusu sesji) — parytet z tabelą
          {
            id: 'context',
            kind: 'context',
            actions: [
              ...(isSubmitted && linkedAssignment
                ? [
                    {
                      id: 'approve',
                      label: t('interview.hub.approve'),
                      icon: Check,
                      onClick: () => handleApproveAssignment(linkedAssignment),
                    },
                    {
                      id: 'send-back',
                      label: t('interview.hub.sendBack2'),
                      icon: ArrowRight,
                      onClick: () => handleOpenSendBackModal(linkedAssignment),
                      variant: 'danger' as const,
                    },
                  ]
                : []),
              ...(canRemind && linkedAssignment
                ? [
                    {
                      id: 'remind',
                      label: t('interview.hub.remind'),
                      icon: Clock,
                      onClick: () => handleOpenReminderModal(linkedAssignment),
                    },
                  ]
                : []),
              ...(isApproved
                ? [
                    {
                      id: 'generate-insight',
                      label: t('interview.hub.generateAiInsights'),
                      icon: Lightbulb,
                      onClick: () => handleGenerateInsight(session, 'summary'),
                    },
                  ]
                : []),
            ],
          },
          // DÓŁ — FIXED BOTTOM MANIFEST (kanon §9.2): Open preview · Edit · Archiwizuj/Przywróć · [Delay]
          {
            id: 'fixed',
            kind: 'manage',
            actions: [
              {
                id: 'open_preview',
                label: t('interview.hub.openPreview'),
                icon: ChevronRight,
                onClick: () =>
                  onCardClick ? onCardClick(session.id) : setPreviewSessionId(session.id),
              },
              {
                id: 'edit',
                label: t('interview.hub.edit'),
                icon: Edit2,
                disabled: true,
                description: t('interview.hub.comingSoonBackend'),
                onClick: () => {},
              },
              ...(sessionLifecycle === 'active'
                ? [
                    {
                      id: 'archive',
                      label: t('interview.hub.archive'),
                      icon: Archive,
                      disabled: sessionLifecycleBusy,
                      onClick: () => handleSessionLifecycleAction(session, 'archive'),
                    },
                  ]
                : []),
              ...(sessionLifecycle === 'archived'
                ? [
                    {
                      id: 'restore',
                      label: t('interview.hub.restore'),
                      icon: RotateCcw,
                      disabled: sessionLifecycleBusy,
                      onClick: () => handleSessionLifecycleAction(session, 'restore'),
                    },
                  ]
                : []),
              ...(sessionLifecycle === 'trash'
                ? [
                    {
                      id: 'untrash',
                      label: t('interview.hub.restore'),
                      icon: RotateCcw,
                      disabled: sessionLifecycleBusy,
                      onClick: () => handleSessionLifecycleAction(session, 'untrash'),
                    },
                  ]
                : []),
              ...(linkedAssignment
                ? [
                    {
                      id: 'delay',
                      label: t('interview.hub.delay'),
                      icon: Clock,
                      onClick: () => {},
                      submenu: [1, 3, 7].map((d) => ({
                        id: `delay-${d}`,
                        label:
                          d === 1
                            ? t('interview.hub.plusDaysOne', { count: d })
                            : t('interview.hub.plusDaysOther', { count: d }),
                        icon: Clock,
                        onClick: () => void handleDelayAssignment(linkedAssignment, d),
                      })),
                    },
                  ]
                : []),
            ],
          },
          // DANGER — Trash / Delete forever (realny lifecycle) — parytet z tabelą
          {
            id: 'danger',
            kind: 'danger',
            actions: [
              ...(sessionLifecycle === 'active'
                ? [
                    {
                      id: 'trash-from-active',
                      label: t('interview.hub.moveToTrash'),
                      icon: Trash2,
                      variant: 'danger' as const,
                      disabled: true,
                      description: t('interview.hub.archiveFirst'),
                      onClick: () => {},
                    },
                  ]
                : []),
              ...(sessionLifecycle === 'archived'
                ? [
                    {
                      id: 'trash',
                      label: t('interview.hub.moveToTrash'),
                      icon: Trash2,
                      variant: 'danger' as const,
                      disabled: sessionLifecycleBusy,
                      onClick: () => handleSessionLifecycleAction(session, 'trash'),
                    },
                  ]
                : []),
              ...(sessionLifecycle === 'trash'
                ? [
                    {
                      id: 'delete-forever',
                      label: t('interview.hub.deleteForever'),
                      icon: Trash2,
                      variant: 'danger' as const,
                      disabled: sessionLifecycleBusy,
                      onClick: () => {
                        setSessionDeleteConfirmText('');
                        setSessionDeleteTarget(session);
                      },
                    },
                  ]
                : []),
            ],
          },
        ];

        return (
          <div
            key={session.id}
            onClick={() => (onCardClick ? onCardClick(session.id) : handleViewSession(session))}
            className="group relative bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] overflow-hidden cursor-pointer hover:shadow-lg hover:border-c-border-strong transition duration-200"
          >
            {/* Header */}
            <div className="p-4 pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Brain
                    size={16}
                    className={
                      workflowStatus === 'approved' || workflowStatus === 'completed'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : workflowStatus === 'in_progress'
                          ? 'text-blue-600 dark:text-blue-400'
                          : workflowStatus === 'submitted'
                            ? 'text-amber-600 dark:text-amber-400'
                            : workflowStatus === 'sent_back'
                              ? 'text-c-danger'
                              : 'text-c-text-muted'
                    }
                  />
                  <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                    {workflowStatus === 'approved' || workflowStatus === 'completed'
                      ? 'OK'
                      : workflowStatus === 'in_progress'
                        ? 'LIVE'
                        : workflowStatus === 'submitted'
                          ? 'SUB'
                          : workflowStatus === 'sent_back'
                            ? 'FIX'
                            : 'ARCH'}
                  </span>
                </div>
                {/* canon §8: kebab on card */}
                <div onClick={(e) => e.stopPropagation()}>
                  <RowActionsMenu sections={kebabSections} />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="px-4 pb-3">
              <h4 className="text-sm font-medium text-c-text line-clamp-2 min-h-[40px]">
                {session.name || 'Discovery Interview'}
              </h4>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {session.assigneeName || session.respondentName || '—'}
                {' · '}
                {session.templateName || session.templateCategory || '—'}
              </div>
            </div>

            {/* Progress */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition ${
                      progress === 100 ? 'bg-emerald-500' : 'bg-navy-900'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">{progress}%</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 flex items-center justify-between">
              {/* canon §4.1/§8.1: status via EntityStatusChip (statusChipTone → c.*) */}
              <EntityStatusChip
                status={workflowStatus}
                label={t(
                  `interview.hub.sessionStatusLabel.${workflowStatus}`,
                  statusConfig.label.en
                )}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {session.dueAt
                  ? `${t('interview.hub.due2')} ${formatListDate(session.dueAt)}`
                  : formatListDate(session.startedAt)}
              </span>
            </div>

            <div className="px-4 pb-4 flex flex-wrap gap-2">
              {isSubmitted && linkedAssignment && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApproveAssignment(linkedAssignment);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-200 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 transition-colors"
                  >
                    <Check size={12} />
                    {t('interview.hub.approve')}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenSendBackModal(linkedAssignment);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-200 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/25 transition-colors"
                  >
                    <ArrowRight size={12} />
                    {t('interview.hub.sendBack2')}
                  </button>
                </>
              )}
              {canRemind && linkedAssignment && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenReminderModal(linkedAssignment);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-500/30 dark:bg-slate-500/15 dark:text-slate-300 dark:hover:bg-slate-500/25 transition-colors"
                >
                  <Clock size={12} />
                  {t('interview.hub.remind')}
                </button>
              )}
              {isApproved && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateInsight(session, 'summary');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-c-info bg-c-info/10 px-2.5 py-1 text-[11px] font-medium text-c-info hover:bg-c-info/10 dark:border-c-info/30 dark:bg-c-info/15 dark:text-c-info dark:hover:bg-c-info/25 transition-colors"
                >
                  <Lightbulb size={12} />
                  {t('interview.hub.aiInsight')}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Insight promptType config (backend uses promptType)
  const getInsightTypeConfig = (type?: string) => {
    const typeStyle = getTypeStyle(type);
    const neutralBadgeClass = `border border-current/20 ${typeStyle.bg} ${typeStyle.text}`;
    const neutralTextClass = typeStyle.text;
    const configs: Record<
      string,
      { label: { en: string; pl: string }; bgColor: string; textColor: string; accentColor: string }
    > = {
      summary: {
        label: { en: 'Executive Summary', pl: 'Podsumowanie Wykonawcze' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      general_analysis: {
        label: { en: 'General Analysis', pl: 'Analiza Ogólna' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      trends: {
        label: { en: 'Trend Analysis', pl: 'Analiza trendów' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      problems: {
        label: { en: 'Problem Discovery', pl: 'Problemy' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      recommendations: {
        label: { en: 'Recommendations', pl: 'Rekomendacje' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      comparison: {
        label: { en: 'Comparison', pl: 'Porównanie' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      gaps: {
        label: { en: 'Gap Analysis', pl: 'Luki' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      risk_assessment: {
        label: { en: 'Risk Assessment', pl: 'Ryzyka' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      opportunity_scan: {
        label: { en: 'Opportunity Scan', pl: 'Szanse' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      maturity: {
        label: { en: 'Maturity', pl: 'Dojrzałość' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      stakeholder_map: {
        label: { en: 'Stakeholder Map', pl: 'Interesariusze' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      between_the_lines: {
        label: { en: 'Between the Lines', pl: 'Między Wierszami' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
      general: {
        label: { en: 'General', pl: 'Ogólny' },
        bgColor: neutralBadgeClass,
        textColor: neutralTextClass,
        accentColor: 'shadow-[inset_4px_0_0_theme(colors.slate.400)]',
      },
    };
    return configs[type || 'summary'] || configs.summary;
  };

  // Handle export insight to tools
  const handleExportInsightToTools = async (insightId: string) => {
    try {
      // Backend contract: POST /interview/insights/:id/export { target: 'tools' | 'assessment' }
      await V8InterviewApi.exportInsight(insightId, { target: 'tools' }).catch(() =>
        Api.post(`/interview/insights/${insightId}/export`, { target: 'tools' })
      );
      toast.success(t('interview.hub.exportedToTools'));
      // Refresh insights
      const insightsRes = await V8InterviewApi.listInsights()
        .then((r) => r.insights)
        .catch(() => Api.get('/interview/insights').catch(() => []));
      setInsights(Array.isArray(insightsRes) ? insightsRes : []);
    } catch (error) {
      toast.error(t('interview.hub.failedToExport'));
      console.error('[InterviewHub] Failed to export insight:', error);
    }
  };

  const handleExportInsightToAssessment = async (insightId: string) => {
    try {
      await V8InterviewApi.exportInsight(insightId, { target: 'assessment' }).catch(() =>
        Api.post(`/interview/insights/${insightId}/export`, { target: 'assessment' })
      );
      toast.success(t('interview.hub.exportedToAssessment'));
      const insightsRes = await V8InterviewApi.listInsights()
        .then((r) => r.insights)
        .catch(() => Api.get('/interview/insights').catch(() => []));
      setInsights(Array.isArray(insightsRes) ? insightsRes : []);
    } catch (error) {
      toast.error(t('interview.hub.failedToExport'));
      console.error('[InterviewHub] Failed to export insight to assessment:', error);
    }
  };

  // Handle delete insight
  const handleDeleteInsight = async (insightId: string) => {
    if (!confirm(t('interview.hub.areYouSureYouWant'))) {
      return;
    }
    try {
      await V8InterviewApi.deleteInsight(insightId).catch(() =>
        Api.delete(`/interview/insights/${insightId}`)
      );
      toast.success(t('interview.hub.insightDeleted'));
      setInsights((prev) => prev.filter((i) => i.id !== insightId));
    } catch (error) {
      toast.error(t('interview.hub.failedToDelete'));
      console.error('[InterviewHub] Failed to delete insight:', error);
    }
  };

  // Archive / restore an insight (soft, reversible). Row leaves the current scope view.
  const handleSetInsightArchived = async (insightId: string, archived: boolean) => {
    try {
      await V8InterviewApi.updateInsight(insightId, { archived }).catch(() =>
        Api.patch(`/interview/insights/${insightId}`, { archived })
      );
      // Optimistic: row drops out of the current list (active→archived or archived→active).
      setInsights((prev) => prev.filter((i) => i.id !== insightId));
      setSelectedInsightIds((prev) => {
        const next = new Set(prev);
        next.delete(insightId);
        return next;
      });
      toast.success(
        archived ? t('interview.hub.insightArchived') : t('interview.hub.insightRestored')
      );
    } catch (error) {
      toast.error(
        archived ? t('interview.hub.failedToArchive') : t('interview.hub.failedToRestore')
      );
      console.error('[InterviewHub] Failed to set insight archived:', error);
    }
  };

  // #55a — Fork insight (moved from InsightViewer toolbar to the row kebab).
  // Creates an independent copy of the insight (new id), refreshes the list,
  // and opens the copy as a new document tab (same mechanism as "Otwórz").
  const handleForkInsight = async (insightId: string) => {
    if (forkingInsightIds.has(insightId)) return;
    setForkingInsightIds((prev) => new Set(prev).add(insightId));
    try {
      const newInsight = await V8InterviewApi.forkInsight(insightId);
      if (!newInsight?.id) {
        toast.error(t('interview.hub.failedToForkInsight'));
        return;
      }
      toast.success(t('interview.hub.insightForked'));
      const insightsRes = await V8InterviewApi.listInsights()
        .then((r) => r.insights)
        .catch(() => Api.get('/interview/insights').catch(() => []));
      setInsights(Array.isArray(insightsRes) ? insightsRes : []);
      handleOpenDocument({
        id: newInsight.id,
        type: 'interview_insight',
        subType: 'interview',
        name: newInsight.title || t('interview.hub.insight'),
        status: (newInsight.status || 'active').toUpperCase() as any,
      });
    } catch (error) {
      toast.error(t('interview.hub.failedToForkInsight'));
      console.error('[InterviewHub] Failed to fork insight:', error);
    } finally {
      setForkingInsightIds((prev) => {
        const next = new Set(prev);
        next.delete(insightId);
        return next;
      });
    }
  };

  // Bulk archive / restore for the current selection.
  const handleBulkSetInsightsArchived = async (archived: boolean) => {
    const ids = Array.from(selectedInsightIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(
        ids.map((id) =>
          V8InterviewApi.updateInsight(id, { archived }).catch(() =>
            Api.patch(`/interview/insights/${id}`, { archived })
          )
        )
      );
      const idSet = new Set(ids);
      setInsights((prev) => prev.filter((i) => !idSet.has(i.id)));
      setSelectedInsightIds(new Set());
      toast.success(
        t(archived ? 'interview.hub.archivedCountParen' : 'interview.hub.restoredCountParen', {
          count: ids.length,
        })
      );
    } catch (error) {
      toast.error(t('interview.hub.operationPartiallyFailed'));
      console.error('[InterviewHub] Bulk archive/restore failed:', error);
    }
  };

  // Render insights table (optional selection for preview pane)
  const renderInsightsTable = (
    rows: typeof filteredInsights = filteredInsights,
    opts?: {
      onRowClick?: (id: string) => void;
      onRowDoubleClick?: (id: string) => void;
      selectedId?: string | null;
    }
  ) => {
    const insightStatusCopy = (
      insight: (typeof rows)[number]
    ): { label: { en: string; pl: string }; statusKey: string; labelKey: string } => {
      const status =
        (insight.reviewStatus === 'in_review' || insight.reviewStatus === 'published'
          ? insight.reviewStatus
          : insight.status) || 'completed';
      const configs: Record<string, { label: { en: string; pl: string }; statusKey: string }> = {
        draft: { label: { en: 'Draft', pl: 'Szkic' }, statusKey: 'DRAFT' },
        generating: { label: { en: 'Generating', pl: 'Generowanie' }, statusKey: 'GENERATING' },
        completed: { label: { en: 'Completed', pl: 'Gotowe' }, statusKey: 'COMPLETED' },
        in_review: { label: { en: 'In Review', pl: 'W recenzji' }, statusKey: 'IN_REVIEW' },
        published: { label: { en: 'Published', pl: 'Opublikowane' }, statusKey: 'APPROVED' },
        failed: { label: { en: 'Failed', pl: 'Błąd' }, statusKey: 'BLOCKED' },
      };
      const resolvedStatus = configs[status] ? status : 'completed';
      return { ...(configs[status] || configs.completed), labelKey: resolvedStatus };
    };

    const insightColumns: StandardTableColumn[] = [
      {
        id: 'title',
        label: t('interview.hub.title'),
        sortable: true,
        sortAccessor: (row: (typeof rows)[number]) => row.title || '',
        render: (row: (typeof rows)[number]) => (
          <span className="text-sm text-c-text font-medium block truncate" title={row.title}>
            {row.title}
          </span>
        ),
      },
      {
        id: 'type',
        label: t('interview.hub.type'),
        width: '160px',
        filterable: true,
        filterOptions: INSIGHT_TYPE_FILTER_OPTIONS,
        sortable: true,
        sortAccessor: (row: (typeof rows)[number]) =>
          String((row as any).promptType || (row as any).insightType || 'summary'),
        render: (row: (typeof rows)[number]) => {
          const promptType = (row as any).promptType || (row as any).insightType || 'summary';
          const typeConfig = getInsightTypeConfig(promptType);
          return (
            <span className={`${INTERVIEW_META_CHIP_CLASS} gap-1.5`}>
              {categoryTone(promptType) ? (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryTone(promptType)! }}
                />
              ) : null}
              {t(`interview.hub.insightTypeLabel.${promptType}`, typeConfig.label.en)}
            </span>
          );
        },
      },
      {
        id: 'status',
        label: t('interview.hub.status'),
        width: '150px',
        filterable: true,
        filterOptions: INSIGHT_STATUS_FILTER_OPTIONS,
        sortable: true,
        sortAccessor: (row: (typeof rows)[number]) => {
          const s =
            (row.reviewStatus === 'in_review' || row.reviewStatus === 'published'
              ? row.reviewStatus
              : row.status) || 'completed';
          const order: Record<string, number> = {
            draft: 0,
            generating: 1,
            completed: 2,
            in_review: 3,
            published: 4,
            failed: 5,
          };
          return order[s] ?? 99;
        },
        render: (row: (typeof rows)[number]) => {
          const statusCopy = insightStatusCopy(row);
          return (
            <EntityStatusChip
              status={statusCopy.statusKey}
              label={t(
                `interview.hub.insightStatusLabel.${statusCopy.labelKey}`,
                statusCopy.label.en
              )}
            />
          );
        },
      },
      {
        id: 'source',
        label: t('interview.hub.source'),
        width: '150px',
        filterable: true,
        filterOptions: INSIGHT_SOURCE_FILTER_OPTIONS,
        render: (row: (typeof rows)[number]) => {
          const sessionCount = row.sourceSessionCount
            ? row.sourceSessionCount
            : row.sessionId
              ? 1
              : 0;
          if (sessionCount === 0) return <span className="text-xs text-c-text-muted">—</span>;
          return (
            <span className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-slate-300">
              <ClipboardList size={11} />
              {sessionCount}{' '}
              {sessionCount === 1 ? t('interview.hub.session') : t('interview.hub.sessions2')}
            </span>
          );
        },
      },
      {
        id: 'exports',
        label: t('interview.hub.exportedTo'),
        width: '160px',
        filterable: true,
        filterOptions: INSIGHT_EXPORTS_FILTER_OPTIONS,
        render: (row: (typeof rows)[number]) =>
          row.exportedToTools || row.exportedToAssessment ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {row.exportedToTools && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-slate-300">
                  <Send size={10} />
                  {t('interview.hub.tools')}
                </span>
              )}
              {row.exportedToAssessment && (
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.06] dark:text-slate-300">
                  <FileText size={10} />
                  {t('interview.hub.assessment')}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs text-c-text-muted">—</span>
          ),
      },
      {
        id: 'date',
        label: t('interview.hub.date'),
        width: '130px',
        sortable: true,
        sortAccessor: (row: (typeof rows)[number]) =>
          row.createdAt ? new Date(row.createdAt).getTime() : 0,
        render: (row: (typeof rows)[number]) =>
          row.createdAt ? (
            <span className="text-xs text-c-text-muted">{formatListDate(row.createdAt)}</span>
          ) : (
            <span className="text-xs text-c-text-muted">—</span>
          ),
      },
    ];

    return (
      <StandardTable
        columns={insightColumns}
        data={rows as unknown as Array<Record<string, unknown> & { id: string }>}
        selectedRowId={opts?.selectedId ?? null}
        onRowClick={(row) => {
          const insight = row as unknown as (typeof rows)[number];
          if (opts?.onRowClick) opts.onRowClick(insight.id);
          else handleViewInsight(insight);
        }}
        onRowDoubleClick={(row) => {
          const insight = row as unknown as (typeof rows)[number];
          if (opts?.onRowDoubleClick) opts.onRowDoubleClick(insight.id);
          else handleViewInsight(insight);
        }}
        rowDescription={(row) => {
          const insight = row as unknown as (typeof rows)[number];
          const raw = String(
            insight.description || insight.content || insight.sourceQuote || ''
          ).trim();
          return stripInsightMarkdownPreview(raw) || null;
        }}
        defaultSort={{ columnId: 'date', direction: 'desc' }}
        persistKey="interview.insights.list"
        selection={{ selectedIds: selectedInsightIds, onChange: setSelectedInsightIds }}
        empty={{
          icon: Lightbulb,
          title: t('interview.hub.noInsightsYet'),
          description: t('interview.hub.insightsAreGeneratedAutomaticallyBy'),
          actionLabel: canCreateInsights ? t('interview.hub.generateAiInsights') : undefined,
          onAction: canCreateInsights
            ? () => {
                setSelectedSessionsForInsight([]);
                setShowInsightModal(true);
              }
            : undefined,
        }}
        rowMenu={(row): StandardRowMenu => {
          const insight = row as unknown as (typeof rows)[number];
          const isArchived = !!insight.archivedAt || insightScope === 'archived';
          return {
            primary: [
              {
                id: 'download',
                label: t('interview.hub.download'),
                icon: Download,
                onClick: () => {
                  const promptType =
                    (insight as any).promptType || (insight as any).insightType || 'summary';
                  const content = `# ${insight.title}\n\n**Type:** ${promptType}\n**Status:** ${insight.status || 'completed'}\n\n${insight.content || ''}\n`;
                  const blob = new Blob([content], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `insight-${insight.id.slice(0, 8)}.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                },
              },
              // #55a — przeniesione z toolbara edytora (InsightViewer) do
              // kebaba wiersza: tworzy niezależną kopię insightu i otwiera ją.
              {
                id: 'fork',
                label: t('interview.hub.fork'),
                icon: GitFork,
                disabled: forkingInsightIds.has(insight.id),
                onClick: () => handleForkInsight(insight.id),
              },
            ],
            // ANEKS #3a — blok referencyjny CONVERT TO (moduł-wzorzec, patrz
            // `_PRZEGLAD_DOMOWY_WYNIKI_2026-07-10.md` #3/#254). Export-tools/
            // Export-assessment ISTNIAŁY już wcześniej jako konwersje bespoke w
            // bloku primary — tu tylko przeniesione pod wspólny nagłówek grupy
            // "Convert to" (StandardTable buduje sam). Initiative/Presentation
            // = pozycje "soon" z zrzutu Piotra — disabled z notą (brak onClick),
            // NIGDY ukryte, gotowe do podłączenia realnego handlera później.
            convertActions: [
              {
                id: 'export-tools',
                label: insight.exportedToTools
                  ? t('interview.hub.exportedToTools')
                  : t('interview.hub.tools'),
                icon: Send,
                disabled: !!insight.exportedToTools,
                onClick: () => handleExportInsightToTools(insight.id),
              },
              {
                id: 'export-assessment',
                label: insight.exportedToAssessment
                  ? t('interview.hub.exportedToAssessment')
                  : t('interview.hub.assessment'),
                icon: FileText,
                disabled: !!insight.exportedToAssessment,
                onClick: () => handleExportInsightToAssessment(insight.id),
              },
              {
                id: 'convert-initiative',
                label: t('interview.hub.initiative'),
                icon: Target,
                note: t('interview.hub.comingSoonBackend'),
              },
              {
                id: 'convert-presentation',
                label: t('interview.hub.presentation'),
                icon: Presentation,
                note: t('interview.hub.comingSoonBackend'),
              },
            ],
            universalHandlers: {
              preview: () =>
                opts?.onRowClick ? opts.onRowClick(insight.id) : handleViewInsight(insight),
              edit: undefined,
              editNote: t('interview.hub.aiGeneratedReadOnly'),
              archive: isArchived ? undefined : () => handleSetInsightArchived(insight.id, true),
              archiveNote: isArchived ? t('interview.hub.useRestoreBelow') : undefined,
            },
            statusTransitions: isArchived
              ? [
                  {
                    id: 'restore',
                    label: t('interview.hub.restore'),
                    icon: RotateCcw,
                    onClick: () => handleSetInsightArchived(insight.id, false),
                  },
                ]
              : [],
            destructive: {
              label: t('interview.hub.delete'),
              onClick: () => handleDeleteInsight(insight.id),
            },
          };
        }}
      />
    );
  };

  // canon §8.0: single SSOT for the Templates row/card ⋮ sections.
  // Used identically by the table row AND the grid card (zero divergence).
  const buildTemplateRowSections = (
    template: InterviewTemplate
  ): import('../shared/RowActionsMenu').RowActionSection[] => [
    // GÓRA — kontekstowe (typowe dla szablonu)
    {
      id: 'context',
      kind: 'context' as const,
      actions: [
        {
          id: 'use',
          label: t('interview.hub.useTemplate'),
          icon: Sparkles,
          onClick: async () => {
            const projectId = await ensureProjectId();
            if (!projectId) {
              toast.error(t('interview.hub.selectAProjectBeforeCreating'));
              return;
            }
            Api.post(`/interview/templates/${template.id}/use`, {
              projectId,
              name: `${template.name} ${formatListDate(new Date())}`,
            })
              .then((created) => {
                const newSession = created as InterviewSession;
                setSessions((prev) => [newSession, ...prev]);
                handleOpenDocument({
                  id: newSession.id,
                  type: 'interview_session',
                  subType: 'interview',
                  name: newSession.name || 'Interview Session',
                  status: ((newSession as any)?.status || 'in_progress').toUpperCase() as any,
                });
                toast.success(t('interview.hub.sessionCreated'));
              })
              .catch(() => {
                toast.error(t('interview.hub.failedToCreateSession'));
              });
          },
        },
        ...(canAssign
          ? [
              {
                id: 'assign',
                label: t('interview.hub.assign'),
                icon: UserPlus,
                onClick: () => {
                  setSelectedTemplateForAssign(template);
                  setShowAssignModal(true);
                },
              },
            ]
          : []),
        {
          id: 'clone',
          label: t('interview.hub.cloneTemplate'),
          icon: Copy,
          onClick: () => handleCloneTemplate(template),
        },
        {
          id: 'view-usage',
          label: t('interview.hub.viewUsage'),
          icon: BarChart3,
          rightLabel: String(getTemplateUsageCount(template)),
          onClick: () => handleViewTemplate(template),
        },
        ...(canAssign
          ? [
              {
                id: 'toggle-default',
                label: template.isDefault
                  ? t('interview.hub.unsetDefault')
                  : t('interview.hub.setAsDefault'),
                icon: template.isDefault ? StarOff : Star,
                onClick: () => handleToggleTemplateDefault(template),
              },
            ]
          : []),
      ],
    },
    // DÓŁ — stały: Open preview · Edytuj · Archiwizuj/Przywróć.
    // (Templates: brak terminu → Delay N/A.)
    {
      id: 'fixed',
      kind: 'manage' as const,
      actions: [
        {
          id: 'open',
          label: t('interview.hub.openPreview'),
          icon: ChevronRight,
          // canon §9: "Open preview" → side pane, NOT full view
          onClick: () => setSelectedTemplateId(template.id),
        },
        {
          id: 'edit',
          label: t('interview.hub.editTemplate'),
          icon: Edit2,
          disabled: !canAssign,
          description: !canAssign ? t('interview.hub.managerOnly') : undefined,
          onClick: () => canAssign && handleEditTemplate(template.id),
        },
        ...(canAssign && !template.isDefault
          ? String(template.status || '').toLowerCase() === 'archived'
            ? [
                {
                  id: 'restore',
                  label: t('interview.hub.restoreTemplate'),
                  icon: RotateCcw,
                  onClick: () => handleRestoreTemplate(template),
                },
              ]
            : [
                {
                  id: 'archive',
                  label: t('interview.hub.archiveTemplate'),
                  icon: Archive,
                  onClick: () => handleArchiveTemplate(template),
                },
              ]
          : !canAssign
            ? [
                {
                  id: 'archive',
                  label: t('interview.hub.archiveTemplate'),
                  icon: Archive,
                  disabled: true,
                  description: t('interview.hub.managerOnly'),
                  onClick: () => {},
                },
              ]
            : []),
      ],
    },
    // DANGER — Usuń (realny dla canAssign; placeholder dla !canAssign)
    {
      id: 'danger',
      kind: 'danger' as const,
      actions: [
        ...(canAssign && !template.isDefault
          ? [
              {
                id: 'delete',
                label: t('interview.hub.deleteTemplate'),
                icon: Trash2,
                onClick: () => handleDeleteTemplate(template),
                variant: 'danger' as const,
              },
            ]
          : !canAssign
            ? [
                {
                  id: 'delete',
                  label: t('interview.hub.deleteTemplate'),
                  icon: Trash2,
                  variant: 'danger' as const,
                  disabled: true,
                  description: t('interview.hub.managerOnly'),
                  onClick: () => {},
                },
              ]
            : []),
      ],
    },
  ];

  // Render templates table (StandardTable — Triada standard)
  const renderTemplatesTable = (opts?: {
    onSelectRow?: (id: string) => void;
    onOpenFull?: (id: string) => void;
  }) => {
    const templateColumns: StandardTableColumn[] = [
      {
        id: 'name',
        label: t('interview.hub.name'),
        sortable: true,
        sortAccessor: (row: InterviewTemplate) => row.name || '',
        render: (row: InterviewTemplate) => (
          <div className="flex items-center gap-3 min-w-0">
            <div className={INTERVIEW_TABLE_ICON_SURFACE_CLASS}>
              <FileText size={16} />
            </div>
            <span className="text-sm text-c-text font-medium block truncate" title={row.name}>
              {row.name}
            </span>
          </div>
        ),
      },
      {
        id: 'category',
        label: t('interview.hub.category'),
        width: '170px',
        filterable: true,
        filterOptions: TEMPLATE_CATEGORY_FILTER_OPTIONS,
        sortable: true,
        sortAccessor: (row: InterviewTemplate) => (row.category ?? '').trim(),
        render: (row: InterviewTemplate) =>
          (row.category ?? '').trim() ? (
            <span className={`${INTERVIEW_META_CHIP_CLASS} gap-1.5`}>
              {categoryTone(row.category) ? (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: categoryTone(row.category)! }}
                />
              ) : null}
              {row.category}
            </span>
          ) : (
            <span className="text-xs text-c-text-muted">—</span>
          ),
      },
      {
        id: 'questions',
        label: t('interview.hub.questions'),
        width: '110px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: InterviewTemplate) => row.questionCount || 0,
        render: (row: InterviewTemplate) => (
          <span className="text-sm text-c-text-muted tabular-nums">{row.questionCount}</span>
        ),
      },
      {
        id: 'usage',
        label: t('interview.hub.usage'),
        width: '110px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: InterviewTemplate) => getTemplateUsageCount(row),
        render: (row: InterviewTemplate) => {
          const usageCount = getTemplateUsageCount(row);
          return usageCount > 0 ? (
            <span className="text-sm text-c-text-muted tabular-nums">{usageCount}</span>
          ) : (
            <span className="text-xs text-c-text-muted">—</span>
          );
        },
      },
      {
        id: 'lastUsed',
        label: t('interview.hub.lastUsed'),
        width: '140px',
        sortable: true,
        sortAccessor: (row: InterviewTemplate) => {
          const d = row.updatedAt || row.createdAt;
          return d ? new Date(d).getTime() : 0;
        },
        // No dedicated "last used" backend field yet — kept as a placeholder
        // column (canon: empty cell = "—"), same as the hand-rolled table.
        render: () => <span className="text-xs text-c-text-muted">—</span>,
      },
      {
        id: 'status',
        label: t('interview.hub.status'),
        width: '160px',
        filterable: true,
        filterOptions: TEMPLATE_STATUS_FILTER_OPTIONS,
        render: (row: InterviewTemplate) => (
          <div className="inline-flex items-center gap-1.5">
            <EntityStatusChip
              status={String(row.status || 'draft')}
              label={getTemplateStatusChip(row.status, t).label}
            />
            {row.isDefault && (
              <span
                className={INTERVIEW_META_CHIP_CLASS}
                title={t('interview.hub.defaultTemplate')}
              >
                {t('interview.hub.default')}
              </span>
            )}
          </div>
        ),
      },
    ];

    return (
      <StandardTable
        columns={templateColumns}
        data={templatesForTable as unknown as Array<Record<string, unknown> & { id: string }>}
        selectedRowId={selectedTemplateId}
        onRowClick={(row) => {
          const template = row as unknown as InterviewTemplate;
          setSelectedTemplateId(template.id);
          opts?.onSelectRow?.(template.id);
        }}
        onRowDoubleClick={(row) => {
          const template = row as unknown as InterviewTemplate;
          opts?.onOpenFull?.(template.id);
        }}
        rowDescription={(row) => {
          const template = row as unknown as InterviewTemplate;
          const areaTags = normalizeInterviewTemplateAreaTags(template.areaTags);
          return (
            template.description ||
            [
              template.scope ? getTemplateSourceLabel(template.scope, t) : null,
              areaTags
                .slice(0, 2)
                .map((tag) => getTemplateAreaTagLabel(tag, t))
                .join(' · '),
            ]
              .filter(Boolean)
              .join(' · ') ||
            null
          );
        }}
        defaultSort={{ columnId: 'name', direction: 'asc' }}
        persistKey="interview.templates.list"
        selection={{ selectedIds: selectedTemplateIds, onChange: setSelectedTemplateIds }}
        empty={{
          icon: FileText,
          title: t('interview.hub.noTemplatesYet'),
          description: t('interview.hub.createATemplateToSpeed'),
          actionLabel: canAssign ? t('interview.hub.newTemplate2') : undefined,
          onAction: canAssign ? handleNewTemplate : undefined,
        }}
        rowActions={(row) => buildTemplateRowSections(row as unknown as InterviewTemplate)}
      />
    );
  };

  const renderTemplatesCards = (opts?: {
    onSelectRow?: (id: string) => void;
    onOpenFull?: (id: string) => void;
  }) => {
    if (filteredTemplates.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={40} className="text-slate-600 dark:text-navy-600 mb-3" />
          <p className="text-sm text-c-text-muted">{t('interview.hub.noTemplatesFound')}</p>
          {canAssign && (
            <button
              onClick={handleNewTemplate}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 active:scale-[0.98]"
            >
              <FilePlus size={16} />
              {t('interview.hub.newTemplate2')}
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
        {filteredTemplates.map((template) => {
          const isSystem = template.scope === 'system';
          const isOrg = template.scope === 'organization';
          const scopeLabel = isSystem
            ? t('interview.hub.system')
            : isOrg
              ? t('interview.hub.organization')
              : t('interview.hub.private');
          const scopeColor = isSystem
            ? 'border border-slate-300/80 bg-slate-100 text-slate-700 dark:border-white/[0.10] dark:bg-white/[0.065] dark:text-slate-200'
            : isOrg
              ? 'border border-slate-300/80 bg-slate-100 text-slate-700 dark:border-white/[0.10] dark:bg-white/[0.065] dark:text-slate-200'
              : 'border border-slate-300/80 bg-slate-100 text-slate-700 dark:border-white/[0.10] dark:bg-white/[0.065] dark:text-slate-200';
          const statusLabel =
            template.status === 'approved'
              ? t('interview.hub.published')
              : t('interview.hub.draft');
          const statusColor =
            template.status === 'approved'
              ? 'border border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100'
              : 'border border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100';
          const areaTags = normalizeInterviewTemplateAreaTags(template.areaTags);

          return (
            // canon §8.0/§8.1: card root = div role=button (kebab can't nest in a <button>);
            // single-click → side preview/select, double-click/Enter/Space → full view.
            <div
              key={template.id}
              role="button"
              tabIndex={0}
              onClick={() => {
                setSelectedTemplateId(template.id);
                opts?.onSelectRow?.(template.id);
              }}
              onDoubleClick={() => {
                opts?.onOpenFull?.(template.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  opts?.onOpenFull?.(template.id);
                }
              }}
              className={`group relative flex flex-col text-left rounded-2xl border transition hover:shadow-lg cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                selectedTemplateId === template.id
                  ? 'border-slate-300 bg-slate-50 shadow-md dark:border-white/[0.18] dark:bg-white/[0.06]'
                  : 'border-slate-200/60 dark:border-navy-700/60 bg-c-surface hover:border-slate-300 dark:hover:border-navy-600'
              }`}
            >
              <div className="p-4 flex-1 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${scopeColor}`}
                    >
                      {scopeLabel}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusColor}`}
                    >
                      {statusLabel}
                    </span>
                    {template.isDefault && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-c-info/10 text-c-info dark:text-c-info">
                        Default
                      </span>
                    )}
                  </div>
                  {/* canon §8.0/§8.1: kebab = SAME RowActionsMenu sections as the table row */}
                  <div className="-mr-1 -mt-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <RowActionsMenu
                      iconVariant="vertical"
                      sections={buildTemplateRowSections(template)}
                    />
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-c-text line-clamp-2 leading-snug">
                  {template.name}
                </h3>

                {template.description && (
                  <p className="text-xs text-c-text-muted line-clamp-2 leading-relaxed">
                    {template.description}
                  </p>
                )}

                {areaTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {areaTags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-navy-800 text-c-text-muted"
                      >
                        {getTemplateAreaTagLabel(tag, t)}
                      </span>
                    ))}
                    {areaTags.length > 4 && (
                      <span className="text-[10px] text-slate-600 dark:text-slate-500">
                        +{areaTags.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-800 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-500">
                <span>
                  {template.questionCount} {t('interview.hub.questions2')}
                </span>
                {template.estimatedTimeMinutes && <span>{template.estimatedTimeMinutes} min</span>}
                <span>{template.category}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render document content (full view)
  const renderDocumentContent = () => {
    const doc = openDocuments.find((d) => d.id === activeDocumentId);
    if (!doc) return null;

    if (doc.type === 'interview_session') {
      return (
        <InterviewWorkspace
          sessionId={doc.id}
          projectId={currentProjectId || undefined}
          onClose={() => handleCloseDocument(doc.id)}
          onComplete={handleSessionComplete}
          onSessionChange={handleSessionChange}
        />
      );
    }

    if (doc.type === 'interview_insight') {
      return (
        <InsightViewer
          insightId={doc.id}
          onClose={() => handleCloseDocument(doc.id)}
          onRegenerate={async () => {
            const insightsRes = await V8InterviewApi.listInsights()
              .then((r) => r.insights)
              .catch(() => Api.get('/interview/insights').catch(() => []));
            const apiInsights = Array.isArray(insightsRes) ? insightsRes : [];
            setInsights(
              apiInsights.length > 0
                ? apiInsights
                : (interviewDemoData.insights as InterviewInsight[])
            );
          }}
          onSaved={(data) => {
            setInsights((prev) => prev.map((i) => (i.id === data.id ? { ...i, ...data } : i)));
          }}
        />
      );
    }

    if (doc.type === 'interview_template') {
      const isNewTemplateDocument = doc.id.startsWith('new-template:');

      return (
        <TemplateBuilder
          key={doc.id}
          isOpen
          presentation="document"
          templateId={isNewTemplateDocument ? null : doc.id}
          onClose={() => handleCloseDocument(doc.id)}
          onSuccess={async (savedTemplate) => {
            const templatesRes = await Api.get('/interview/templates').catch(() => []);
            const refreshedTemplatesApi = (Array.isArray(templatesRes) ? templatesRes : []).map(
              normalizeTemplateRecord
            );
            const refreshedTemplates = isUsingDemoData
              ? (interviewDemoData.templates as InterviewTemplate[])
              : refreshedTemplatesApi.length > 0
                ? refreshedTemplatesApi
                : (interviewDemoData.templates as InterviewTemplate[]);
            setTemplates(refreshedTemplates);

            if (!savedTemplate?.id) {
              return;
            }

            const savedId: string = savedTemplate.id;

            const nextTemplate =
              refreshedTemplates.find((item) => item.id === savedId) ||
              ({
                ...savedTemplate,
                id: savedId,
                name: savedTemplate.name || doc.name,
              } as InterviewTemplate);

            setOpenDocuments((prev) => {
              const withoutOld = prev.filter((item) => item.id !== doc.id);
              const existingIdx = withoutOld.findIndex((item) => item.id === savedId);

              if (existingIdx >= 0) {
                const next = [...withoutOld];
                next[existingIdx] = {
                  ...next[existingIdx],
                  name: nextTemplate.name,
                  status: (nextTemplate.status || 'draft').toUpperCase() as any,
                };
                return next;
              }

              return [
                ...withoutOld,
                {
                  id: savedId,
                  type: 'interview_template' as const,
                  subType: 'interview',
                  name: nextTemplate.name,
                  status: (nextTemplate.status || 'draft').toUpperCase() as any,
                },
              ];
            });
            setActiveDocumentId(savedId);
          }}
        />
      );
    }

    return null;
  };

  // (Sessions/Insights/Templates/Assignments/Initiatives sort/filter/
  // column-widths/view-settings popover all now live inside StandardTable —
  // Triada standard.)

  const getAssignmentTitle = useCallback(
    (a: InterviewAssignment) => a.template?.name || t('interview.hub.interview'),
    [isPolish]
  );
  const getAssignmentDescription = useCallback(
    (a: InterviewAssignment) => {
      const description = String(a.template?.description || '').trim();
      if (description) return description;
      const category = String(a.template?.category || '').trim();
      if (category) return t('interview.hub.categoryColon', { category });
      const assignee = String(a.assignee?.name || a.assignee?.email || '').trim();
      if (assignee) return t('interview.hub.assignedToColon', { assignee });
      return '';
    },
    [isPolish]
  );

  const getAssignmentStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'assigned':
        return 'border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100';
      case 'drafting':
        return 'border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.10] dark:bg-white/[0.065] dark:text-slate-200';
      case 'in_progress':
        return 'border-blue-300/80 bg-blue-50 text-blue-900 dark:border-blue-300/[0.25] dark:bg-blue-300/[0.12] dark:text-blue-100';
      case 'review':
        return 'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100';
      // VISUAL_STANDARD §5.3 — Submitted belongs to the SUCCESS (green) family,
      // a different color family than Assigned (blue), so the two scan apart.
      case 'submitted':
        return 'border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100';
      case 'sent_back':
      case 'rejected':
        return 'border-c-danger/30 bg-c-danger/[0.08] text-c-danger';
      case 'accepted':
      case 'approved':
      case 'completed':
        return 'border-emerald-300/80 bg-emerald-50 text-emerald-900 dark:border-emerald-300/[0.25] dark:bg-emerald-300/[0.12] dark:text-emerald-100';
      default:
        return 'border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.10] dark:bg-white/[0.065] dark:text-slate-200';
    }
  }, []);

  const getAssignmentStatusLabel = useCallback(
    (status: string) => t(`interview.hub.assignmentStatusFull.${status}`, status),
    [t]
  );

  // VISUAL_STANDARD §5.3 — assignment status badge = TINTED pill (color @~14%
  // bg + full-color text), not a neutral shell with a dot. Submitted (green,
  // success family) vs Assigned (blue, info family) must be distinguishable at
  // a scan. Red stays reserved for destructive/error (sent_back/rejected).
  const getAssignmentStatusBadgeVariant = useCallback((status: string): BadgeVariant => {
    switch (status) {
      case 'assigned':
        return 'info';
      case 'in_progress':
      case 'review':
        return 'warning';
      case 'submitted':
      case 'accepted':
      case 'approved':
      case 'completed':
        return 'success';
      case 'sent_back':
      case 'rejected':
        return 'danger';
      case 'drafting':
      default:
        return 'neutral';
    }
  }, []);

  const getAssignmentDaysToDue = useCallback(
    (dueAt?: string | null) => {
      if (!dueAt) return null;
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const due = new Date(dueAt);
      due.setHours(0, 0, 0, 0);
      const diffMs = due.getTime() - now.getTime();
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      if (days < 0) {
        const absDays = Math.abs(days);
        return {
          days,
          label:
            absDays === 1
              ? t('interview.hub.overdueDaysOne', { count: absDays })
              : t('interview.hub.overdueDaysOther', { count: absDays }),
          colorClass: 'border-c-danger/30 bg-c-danger/[0.08] text-c-danger',
        };
      }
      if (days === 0) {
        return {
          days,
          label: t('interview.hub.today'),
          colorClass: 'border-c-danger/30 bg-c-danger/[0.08] text-c-danger',
        };
      }
      if (days <= 3) {
        return {
          days,
          label:
            days === 1
              ? t('interview.hub.daysLeftOne', { count: days })
              : t('interview.hub.daysLeftOther', { count: days }),
          colorClass:
            'border-amber-300/80 bg-amber-50 text-amber-900 dark:border-amber-300/[0.25] dark:bg-amber-300/[0.12] dark:text-amber-100',
        };
      }
      return {
        days,
        label:
          days === 1
            ? t('interview.hub.daysLeftOne', { count: days })
            : t('interview.hub.daysLeftOther', { count: days }),
        colorClass:
          'border-slate-300/80 bg-slate-100 text-slate-800 dark:border-white/[0.10] dark:bg-white/[0.065] dark:text-slate-200',
      };
    },
    [isPolish]
  );

  const startInterviewAssignment = useCallback(
    async (assignment: InterviewAssignment) => {
      try {
        const projectId = await ensureProjectId();
        if (!projectId) {
          toast.error(t('interview.hub.selectAProjectBeforeStarting'));
          return;
        }
        toast.loading(t('interview.hub.startingInterview'));
        const result = (await V8InterviewApi.startAssignment(assignment.id, {
          projectId,
        }).catch(() =>
          Api.post(`/interview/assignments/${assignment.id}/start`, {
            projectId,
          })
        )) as any;
        toast.dismiss();

        // Open the session - backend returns { assignmentId, session }
        const session = result?.session;
        if (session?.id) {
          toast.success(t('interview.hub.interviewStarted'));
          handleOpenDocument({
            id: session.id,
            type: 'interview_session',
            subType: 'interview',
            name: session.name || 'Interview Session',
            status: (session.status || 'in_progress').toUpperCase() as any,
          });
        } else {
          console.warn('[InterviewHub] No session in result:', result);
          toast.error(t('interview.hub.noSessionInServerResponse'));
        }

        // Refresh assignments
        const [myRes, managedRes] = await Promise.all([
          loadMyAssignments(),
          canViewManaged ? loadManagedAssignments() : Promise.resolve([]),
        ]);
        setMyAssignments(myRes);
        if (canViewManaged) setManagedAssignments(Array.isArray(managedRes) ? managedRes : []);
      } catch (error: any) {
        toast.dismiss();
        console.error('[InterviewHub] Failed to start assignment:', error);
        safeToastError(error, t('interview.hub.failedToStartInterview'), isPolish);
      }
    },
    [
      canViewManaged,
      ensureProjectId,
      handleOpenDocument,
      isPolish,
      loadManagedAssignments,
      loadMyAssignments,
    ]
  );

  const openInterviewAssignmentFull = useCallback(
    async (assignment: InterviewAssignment, isManagerView: boolean) => {
      try {
        // Close preview before opening full (KANON: returning to list should not auto-open preview)
        setPreviewAssignmentId(null);
        setPreviewAssignmentOpen(false);

        const sid = assignment.sessionId || assignment.session?.id;
        if (sid) {
          const demoSession = interviewDemoData.sessionDetailsById[sid]?.session;
          const session = isInterviewDemoId(sid)
            ? demoSession
            : await V8InterviewApi.getSession(sid)
                .then((res) => res.session)
                .catch(() => Api.get(`/interview/sessions/${sid}`))
                .catch(() => demoSession || null);
          if (!session) {
            throw new Error('Failed to load session');
          }
          handleOpenDocument({
            id: (session as InterviewSession).id,
            type: 'interview_session',
            subType: 'interview',
            name: (session as InterviewSession).name || 'Interview Session',
            status: ((session as any)?.status || 'in_progress').toUpperCase() as any,
          });
          return;
        }

        // Assignee view: if not started, start it
        if (!isManagerView && assignment.status === 'assigned') {
          await startInterviewAssignment(assignment);
          return;
        }

        // Manager view: if not started, show info
        if (isManagerView && !assignment.sessionId) {
          toast(t('interview.hub.interviewHasNotBeenStarted'), { duration: 4000, icon: 'ℹ️' });
          return;
        }

        console.warn('[InterviewHub] No action taken for assignment:', assignment);
      } catch (error: any) {
        console.error('[InterviewHub] Failed to open assignment:', error);
        safeToastError(error, t('interview.hub.failedToOpenAssignment'), isPolish);
      }
    },
    [handleOpenDocument, interviewDemoData.sessionDetailsById, isPolish, startInterviewAssignment]
  );

  const runAssignmentAi = useCallback(
    async (
      intent: 'summary' | 'risks' | 'next_steps' | 'expand_details' | 'summarize_details',
      a: InterviewAssignment
    ) => {
      try {
        const title = getAssignmentTitle(a);
        const due = a.dueAt ? formatListDate(a.dueAt) : '—';
        const status = getAssignmentStatusLabel(a.status);
        const progress = a.session?.completenessPercent ?? 0;
        const assignee = a.assignee?.name || a.assignee?.email || '—';
        const category = a.template?.category || '—';

        const intentLine = (() => {
          switch (intent) {
            case 'summary':
              return t('interview.hub.summarizeWhatThisIsAnd');
            case 'risks':
              return t('interview.hub.listRisksAndTypicalBlockers');
            case 'next_steps':
              return t('interview.hub.proposeNextStepsMax5');
            case 'expand_details':
              return t('interview.hub.expandDetailsIntoAShort');
            case 'summarize_details':
              return t('interview.hub.summarizeDetailsIn5Bullets');
          }
        })();

        const prompt = `${intentLine}

Assignment:
- Template: ${title}
- Category: ${category}
- Status: ${status}
- Progress: ${progress}%
- Due: ${due}
- Assignee: ${assignee}

Return ONLY the answer text (no markdown fences).`;

        const aiRes = await Api.post('/ai/chat', {
          message: prompt,
          history: [],
          systemInstruction: t('interview.hub.youAreAPracticalPmo'),
          roleName: 'Interview Inbox Preview',
        });

        const raw = String((aiRes as any)?.text || (aiRes as any)?.content || '').trim();
        const clean = raw
          .replace(/^```[\w-]*\n?/g, '')
          .replace(/```$/g, '')
          .replace(/^["']|["']$/g, '')
          .trim();

        if (!clean) throw new Error('Empty AI response');
        return clean;
      } catch (e: any) {
        return null;
      }
    },
    [getAssignmentStatusLabel, getAssignmentTitle, isPolish]
  );

  // canon §8.0: single SSOT for the Inbox/Assigned assignment row/card ⋮ sections.
  // Used IDENTICALLY by the table row AND the grid card (zero divergence).
  const buildAssignmentRowSections = (
    assignment: InterviewAssignment,
    showAssignee: boolean
  ): import('../shared/RowActionsMenu').RowActionSection[] => [
    // GÓRA — kontekstowe (typowe dla obszaru/statusu)
    {
      id: 'context',
      kind: 'context' as const,
      actions: [
        ...(!showAssignee && assignment.status === 'assigned'
          ? [
              {
                id: 'start',
                label: t('interview.hub.start'),
                icon: Sparkles,
                onClick: () => startInterviewAssignment(assignment),
              },
            ]
          : []),
        ...(!showAssignee && assignment.status === 'in_progress' && assignment.sessionId
          ? [
              {
                id: 'continue',
                label: t('interview.hub.continue'),
                icon: ChevronRight,
                onClick: async () => {
                  const session = await Api.get(`/interview/sessions/${assignment.sessionId}`);
                  handleOpenDocument({
                    id: (session as InterviewSession).id,
                    type: 'interview_session',
                    subType: 'interview',
                    name: (session as InterviewSession).name || 'Interview Session',
                    status: ((session as any)?.status || 'in_progress').toUpperCase() as any,
                  });
                },
              },
            ]
          : []),
        ...(!showAssignee && assignment.status === 'sent_back' && assignment.sessionId
          ? [
              {
                id: 'fix',
                label: t('interview.hub.fixResubmit'),
                icon: RotateCcw,
                onClick: async () => {
                  const session = await Api.get(`/interview/sessions/${assignment.sessionId}`);
                  handleOpenDocument({
                    id: (session as InterviewSession).id,
                    type: 'interview_session',
                    subType: 'interview',
                    name: (session as InterviewSession).name || 'Interview Session',
                    status: ((session as any)?.status || 'in_progress').toUpperCase() as any,
                  });
                },
              },
            ]
          : []),
        ...(showAssignee && canAssign && assignment.status === 'submitted'
          ? [
              {
                id: 'approve',
                label: t('interview.hub.approve'),
                icon: Check,
                onClick: () => handleOpenApproveModal(assignment),
              },
              {
                id: 'sendback',
                label: t('interview.hub.sendBack3'),
                icon: RotateCcw,
                onClick: () => handleOpenSendBackModal(assignment),
                variant: 'danger' as const,
              },
            ]
          : []),
        ...(showAssignee &&
        canAssign &&
        (assignment.status === 'assigned' || assignment.status === 'in_progress')
          ? [
              {
                id: 'reassign',
                label: t('interview.hub.reassign'),
                icon: UserPlus,
                onClick: () => handleReassignAssignment(assignment),
              },
            ]
          : []),
        ...(showAssignee &&
        canAssign &&
        assignment.status !== 'completed' &&
        assignment.status !== 'approved'
          ? [
              {
                id: 'remind',
                label: t('interview.hub.sendReminder'),
                icon: Bell,
                onClick: () => handleOpenReminderModal(assignment),
              },
              {
                id: 'escalate',
                label: t('interview.hub.escalateNow'),
                icon: ArrowUpRight,
                disabled: Boolean(assignment.escalatedAt) || Boolean(assignment.escalationTarget),
                onClick: () => handleEscalateNow(assignment),
              },
            ]
          : []),
      ],
    },
    // DÓŁ — FIXED BOTTOM MANIFEST (kanon §9.2): Open preview · Edytuj · Archiwizuj/Przywróć · Delay▸
    {
      id: 'fixed',
      kind: 'manage' as const,
      actions: [
        {
          id: 'open',
          label: t('interview.hub.openPreview'),
          icon: ChevronRight,
          // canon §9: "Open preview" → side pane, NOT full view
          onClick: () => {
            setPreviewAssignmentId(assignment.id);
            setPreviewAssignmentOpen(true);
          },
        },
        {
          id: 'edit',
          label: t('interview.hub.edit'),
          icon: Edit2,
          // Contextual: manager edits via manage modal; assignee edits answers.
          onClick: () =>
            showAssignee
              ? handleOpenDueDateModal(assignment)
              : startInterviewAssignment(assignment),
        },
        managedLifecycle === 'archived' && showAssignee
          ? {
              id: 'restore',
              label: t('interview.hub.restore'),
              icon: RotateCcw,
              disabled: managedLifecycleBusy,
              onClick: () => handleAssignmentLifecycleAction(assignment, 'restore'),
            }
          : {
              id: 'archive',
              label: t('interview.hub.archive'),
              icon: Archive,
              disabled: managedLifecycleBusy,
              onClick: () => handleAssignmentLifecycleAction(assignment, 'archive'),
            },
        {
          id: 'delay',
          label: t('interview.hub.delay'),
          icon: Clock,
          onClick: () => {},
          submenu: [1, 3, 7].map((d) => ({
            id: `delay-${d}`,
            label:
              d === 1
                ? t('interview.hub.plusDaysOne', { count: d })
                : t('interview.hub.plusDaysOther', { count: d }),
            icon: Clock,
            onClick: () => void handleDelayAssignment(assignment, d),
          })),
        },
      ],
    },
    // DANGER — Usuń (brak endpointu delete → disabled, do backendu)
    {
      id: 'danger',
      kind: 'danger' as const,
      actions: [
        {
          id: 'delete',
          label: t('interview.hub.delete'),
          icon: Trash2,
          variant: 'danger' as const,
          disabled: true,
          description: t('interview.hub.comingSoonBackend'),
          onClick: () => {},
        },
      ],
    },
  ];

  // Render assignments table (reusable for my/managed/overdue)
  const renderAssignmentsTable = (
    assignments: InterviewAssignment[],
    showAssignee: boolean = false
  ) => {
    const getAssignmentTemplateValue = (a: InterviewAssignment) =>
      a.template?.name || t('interview.hub.interview');
    const getAssignmentAssigneeValue = (a: InterviewAssignment) =>
      a.assignee?.name || a.assignee?.email || t('interview.hub.unknown');

    const assignmentColumns: StandardTableColumn[] = [
      {
        id: 'template',
        label: t('interview.hub.template2'),
        width: '320px',
        filterable: true,
        filterOptions: Array.from(new Set(assignments.map(getAssignmentTemplateValue)))
          .sort()
          .map((v) => ({ value: v, label: v })),
        sortAccessor: (row: InterviewAssignment) => getAssignmentTemplateValue(row),
        sortable: true,
        render: (row: InterviewAssignment) => (
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="text-sm font-semibold text-c-text truncate min-w-0"
              title={row.template?.name || 'Interview'}
            >
              {row.template?.name || 'Interview'}
            </span>
            {row.template?.category ? (
              <span
                className="shrink-0 max-w-[160px] truncate inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-[11px] font-medium border border-c-border bg-c-surface-raised text-c-text-secondary"
                title={row.template.category}
              >
                {categoryTone(row.template.category) ? (
                  <span
                    aria-hidden="true"
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: categoryTone(row.template.category)! }}
                  />
                ) : null}
                {row.template.category}
              </span>
            ) : null}
          </div>
        ),
      },
      ...(showAssignee
        ? [
            {
              id: 'assignee',
              label: t('interview.hub.assignee2'),
              width: '170px',
              filterable: true,
              filterOptions: Array.from(new Set(assignments.map(getAssignmentAssigneeValue)))
                .sort()
                .map((v) => ({ value: v, label: v })),
              render: (row: InterviewAssignment) => (
                <AssigneeCell
                  name={row.assignee?.name || row.assignee?.email || null}
                  unassignedLabel={t('interview.hub.unassigned')}
                />
              ),
            } as StandardTableColumn,
          ]
        : []),
      {
        id: 'status',
        label: t('interview.hub.status'),
        width: '150px',
        filterable: true,
        filterOptions: ASSIGNMENT_STATUS_OPTION_ORDER.filter((v) =>
          assignments.some((a) => a.status === v)
        ).map((v) => ({ value: v, label: getAssignmentStatusLabel(v) })),
        sortable: true,
        sortAccessor: (row: InterviewAssignment) => {
          const statusOrder: Record<string, number> = {
            sent_back: 0,
            assigned: 1,
            in_progress: 2,
            submitted: 3,
            approved: 4,
            completed: 5,
          };
          return statusOrder[row.status] ?? 99;
        },
        render: (row: InterviewAssignment) => (
          <Badge
            variant={getAssignmentStatusBadgeVariant(String(row.status || 'assigned'))}
            size="md"
          >
            {getAssignmentStatusLabel(row.status)}
          </Badge>
        ),
      },
      {
        id: 'progress',
        label: t('interview.hub.progress'),
        width: '130px',
        align: 'right',
        sortable: true,
        sortAccessor: (row: InterviewAssignment) => row.session?.completenessPercent || 0,
        render: (row: InterviewAssignment) => (
          <ProgressCell value={row.session?.completenessPercent || 0} />
        ),
      },
      {
        id: 'due',
        label: t('interview.hub.daysToDue'),
        width: '160px',
        sortable: true,
        sortAccessor: (row: InterviewAssignment) =>
          row.dueAt ? new Date(row.dueAt).getTime() : Infinity,
        render: (row: InterviewAssignment) => {
          const dtd = getAssignmentDaysToDue(row.dueAt);
          if (!dtd) return <span className="text-xs text-c-text-muted">—</span>;
          return (
            <DueChip
              label={dtd.label}
              risk={dtd.days < 0 ? 'overdue' : dtd.days <= 3 ? 'soon' : 'none'}
              showIcon
              title={row.dueAt ? formatListDate(row.dueAt) : undefined}
            />
          );
        },
      },
      // #9/#9b — manager-only columns (Submitted / AI Score / Escalation); not
      // meaningful in the worker Inbox view where the data isn't actionable.
      ...(showAssignee
        ? [
            {
              id: 'submitted',
              label: t('interview.hub.submitted3'),
              width: '150px',
              render: (row: InterviewAssignment) =>
                row.submittedAt ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs text-c-text-secondary"
                    title={new Date(row.submittedAt).toLocaleString()}
                  >
                    <Send size={11} className="text-c-text-muted" />
                    {formatListDate(row.submittedAt)}
                  </span>
                ) : (
                  <span className="text-xs text-c-text-muted">—</span>
                ),
            } as StandardTableColumn,
            {
              id: 'aiScore',
              label: t('interview.hub.aiScore'),
              width: '120px',
              align: 'right',
              render: (row: InterviewAssignment) => {
                const score = row.aiReview?.overallScore;
                if (typeof score !== 'number') {
                  return <span className="text-xs text-c-text-muted">—</span>;
                }
                // #48a — overallScore is on the rubric's 1-5 scale (1 = worst, 5 =
                // best), not already a 0-100 percentage. Map linearly (1 -> 0%,
                // 5 -> 100%) so the tone thresholds below are meaningful.
                const pct = Math.round(Math.max(0, Math.min(1, (score - 1) / 4)) * 100);
                const tone =
                  pct >= 75 ? 'text-c-success' : pct >= 50 ? 'text-c-warning' : 'text-c-danger';
                const title = t('interview.hub.aiQualityScoreTitle', { score: score.toFixed(1) });
                return (
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${tone}`}
                    title={title}
                  >
                    <Gauge size={12} />
                    {pct}
                  </span>
                );
              },
            } as StandardTableColumn,
            {
              id: 'escalation',
              label: t('interview.hub.escalation'),
              width: '160px',
              render: (row: InterviewAssignment) =>
                row.escalatedAt || row.escalationTarget ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200"
                    title={
                      row.escalationTarget?.name ||
                      row.escalationTarget?.email ||
                      t('interview.hub.escalated')
                    }
                  >
                    <ArrowUpRight size={11} />
                    {row.escalationTarget?.name ||
                      row.escalationTarget?.email ||
                      t('interview.hub.escalated')}
                  </span>
                ) : (
                  <span className="text-xs text-c-text-muted">—</span>
                ),
            } as StandardTableColumn,
          ]
        : []),
    ];

    return (
      <StandardTable
        columns={assignmentColumns}
        data={assignments as unknown as Array<Record<string, unknown> & { id: string }>}
        selectedRowId={previewAssignmentId}
        onRowClick={(row) => {
          setPreviewAssignmentId(String((row as any).id));
          setPreviewAssignmentOpen(true);
        }}
        onRowDoubleClick={(row) => {
          void openInterviewAssignmentFull(row as unknown as InterviewAssignment, showAssignee);
        }}
        rowDescription={(row) => getAssignmentDescription(row as unknown as InterviewAssignment)}
        defaultSort={{ columnId: 'due', direction: 'asc' }}
        persistKey={showAssignee ? 'interview.managed.list' : 'interview.myAssignments.list'}
        selection={{ selectedIds: selectedAssignmentIds, onChange: setSelectedAssignmentIds }}
        empty={{
          icon: Inbox,
          title: t('interview.hub.noAssignments'),
        }}
        rowActions={(row) =>
          buildAssignmentRowSections(row as unknown as InterviewAssignment, showAssignee)
        }
      />
    );
  };

  // canon §8 / §8.1: LOCAL card grid for Inbox & Assigned — mirrors renderSessionsGrid.
  // Neutral surface (NO border-l status accent), EntityStatusChip status, single-click →
  // side preview, double-click → full view, kebab = SAME buildAssignmentRowSections() as
  // the table row (zero divergence; includes the Fixed Bottom Manifest §9.2).
  const renderAssignmentsGrid = (
    assignments: InterviewAssignment[],
    showAssignee: boolean = false
  ) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {assignments.map((assignment) => {
        const progress = assignment.session?.completenessPercent ?? 0;
        const status = String(assignment.status || 'assigned');
        const statusLabel = getAssignmentStatusLabel(assignment.status);
        const dtd = getAssignmentDaysToDue(assignment.dueAt);
        const kebabSections = buildAssignmentRowSections(assignment, showAssignee);

        return (
          <div
            key={assignment.id}
            onClick={() => {
              setPreviewAssignmentId(assignment.id);
              setPreviewAssignmentOpen(true);
            }}
            onDoubleClick={() => void openInterviewAssignmentFull(assignment, showAssignee)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void openInterviewAssignmentFull(assignment, showAssignee);
              } else if (e.key === ' ') {
                e.preventDefault();
                setPreviewAssignmentId(assignment.id);
                setPreviewAssignmentOpen(true);
              }
            }}
            className={[
              'group relative bg-c-surface rounded-xl border overflow-hidden cursor-pointer transition duration-200',
              'hover:shadow-lg hover:border-c-border-strong',
              previewAssignmentId === assignment.id
                ? 'border-c-accent bg-c-accent-soft'
                : 'border-c-border-subtle',
            ].join(' ')}
          >
            {/* Header */}
            <div className="p-4 pb-2">
              <div className="flex items-start justify-between">
                <div className={INTERVIEW_TABLE_ICON_SURFACE_CLASS}>
                  <ClipboardList size={16} />
                </div>
                {/* canon §8: kebab on card = SAME sections as the table row */}
                <div onClick={(e) => e.stopPropagation()}>
                  <RowActionsMenu sections={kebabSections} />
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="px-4 pb-3">
              <h4 className="text-sm font-medium text-c-text line-clamp-2 min-h-[40px]">
                {getAssignmentTitle(assignment)}
              </h4>
              <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                {assignment.assignee?.name || assignment.assignee?.email || '—'}
                {' · '}
                {assignment.template?.category || assignment.template?.name || '—'}
              </div>
            </div>

            {/* Progress */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition ${
                      progress === 100 ? 'bg-emerald-500' : 'bg-navy-900'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">{progress}%</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 flex items-center justify-between">
              {/* VISUAL_STANDARD §5.3 — tinted status pill (Submitted=green /
                  Assigned=blue), same mapping as the table view. */}
              <Badge variant={getAssignmentStatusBadgeVariant(status)} size="md">
                {statusLabel}
              </Badge>
              {dtd ? (
                <DueChip
                  label={dtd.label}
                  risk={dtd.days < 0 ? 'overdue' : dtd.days <= 3 ? 'soon' : 'none'}
                  showIcon
                  title={assignment.dueAt ? formatListDate(assignment.dueAt) : undefined}
                />
              ) : (
                <span className="text-xs text-slate-600 dark:text-slate-400">—</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  // Render list content based on active tab
  const renderListContent = () => {
    if (isLoading || assignmentsLoading) {
      return (
        <div className="p-6">
          <LoadingState template="list" rows={6} />
        </div>
      );
    }

    if (loadError) {
      return (
        <EmptyState
          variant="error"
          title={t('interview.hub.couldNotLoadYourInterviews')}
          description={t('interview.hub.somethingWentWrongLoadingYour')}
          onRetry={() => window.location.reload()}
        />
      );
    }

    const tabDegradedMessage = (() => {
      if (activeTab === 'sessions') return sessionsLoadError;
      if (activeTab === 'insights') return insightsLoadError;
      if (activeTab === 'initiatives') return initiativesLoadError;
      if (
        activeTab === 'my_assignments' ||
        activeTab === 'managed' ||
        activeTab === 'pending_review'
      )
        return assignmentsLoadError;
      return null;
    })();

    const renderDegradedBanner = () =>
      tabDegradedMessage ? (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-xl border-l-4 border-l-amber-500 border border-amber-300/50 bg-amber-100 px-3 py-2 text-xs text-amber-900 dark:border-amber-400/25 dark:bg-amber-500/10 dark:text-amber-100"
        >
          <span className="font-semibold">{t('interview.hub.degradedMode')}:</span>{' '}
          {tabDegradedMessage}
        </div>
      ) : null;

    if (activeTab === 'sessions') {
      const rows = filteredSessions || [];
      const selected = previewSessionId ? rows.find((s) => s.id === previewSessionId) : null;
      const selectedItem = selected
        ? ({ ...selected, title: selected.name || 'Interview Session' } as InterviewSession & {
            title: string;
          })
        : null;

      return (
        <div className="h-full overflow-hidden">
          {renderDegradedBanner()}
          <TableWithPreviewLayout<InterviewSession & { title: string }>
            selectedId={previewSessionId}
            selectedItem={selectedItem}
            onSelect={(id) => setPreviewSessionId(id)}
            onOpenFull={(id) => {
              const s = rows.find((x) => x.id === id);
              if (s) handleViewSession(s);
            }}
            itemIds={rows.map((r) => r.id)}
            getItemById={(id) => {
              const x = rows.find((i) => i.id === id);
              return x ? ({ ...x, title: x.name || 'Interview Session' } as any) : null;
            }}
            renderPreview={(item) => {
              const s = item as InterviewSession;
              const progress =
                s.totalQuestions > 0
                  ? Math.round((s.answeredQuestions / s.totalQuestions) * 100)
                  : 0;
              const workflowStatus = getSessionWorkflowStatus(s);
              const statusCfg = getSessionStatusConfig(workflowStatus);

              return (
                <InterviewSessionPreviewBody
                  session={s}
                  // FALA 1 (2026-07-27): DETAILS pokazywało `Owner: <UUID>`.
                  // Podajemy czytelną nazwę tylko gdy naprawdę ją znamy —
                  // dziś potrafimy rozpoznać właściciela = zalogowany
                  // użytkownik; w innym wypadku linia znika, a identyfikator
                  // zostaje pod akcją „Kopiuj ID".
                  ownerName={
                    s.ownerId && currentUser?.id && s.ownerId === currentUser.id
                      ? currentUser.displayName ||
                        (currentUser as { name?: string }).name ||
                        currentUser.email ||
                        undefined
                      : undefined
                  }
                  isPolish={isPolish}
                  statusConfig={statusCfg}
                  progress={progress}
                  detailsExpanded={sessionPreviewDetailsExpanded}
                  onToggleDetailsExpanded={() => setSessionPreviewDetailsExpanded((v) => !v)}
                  onCopyStats={() =>
                    copyToClipboard(
                      [
                        `id: ${s.id}`,
                        `status: ${workflowStatus}`,
                        `answered: ${s.answeredQuestions}/${s.totalQuestions}`,
                        `startedAt: ${s.startedAt}`,
                      ].join('\n')
                    )
                  }
                  onCopyId={() => copyToClipboard(s.id)}
                />
              );
            }}
            renderPreviewFooter={(item) => {
              const s = item as InterviewSession;
              const workflowStatus = getSessionWorkflowStatus(s);
              const canRunAi = ['approved', 'completed'].includes(workflowStatus);
              const aiHints = isPolish
                ? ['Podsumuj', 'Ryzyka', 'Następne kroki']
                : ['Summarize', 'Risks', 'Next steps'];
              const hintToType: Record<string, InsightPromptType> = {
                Podsumuj: 'summary',
                Summarize: 'summary',
                Ryzyka: 'risk_assessment',
                Risks: 'risk_assessment',
                'Następne kroki': 'recommendations',
                'Next steps': 'recommendations',
              };
              // FALA 1 / „surowe identyfikatory w UI" (2026-07-27): chipy
              // „Project"/„Org" wypisywały gołe UUID
              // (`Org: a3e05d4a-5397-419d-b486-8e44366c0063`). Pokazujemy
              // nazwę organizacji, gdy sesja należy do bieżącej organizacji;
              // identyfikator zostaje najwyżej w tooltipie. Chip projektu bez
              // czytelnej nazwy w ogóle się nie pojawia — pusty chip jest
              // lepszy niż mylący.
              const orgName =
                currentOrganization?.id && s.organizationId === currentOrganization.id
                  ? currentOrganization.name
                  : null;
              const relations = [
                {
                  label: `${t('interview.hub.assignee3')}: ${s.assigneeName || s.respondentName || '—'}`,
                  tone: 'text-slate-600 dark:text-slate-300',
                },
                {
                  label: `${t('interview.hub.template')}: ${s.templateName || s.templateCategory || '—'}`,
                  tone: 'text-slate-600 dark:text-slate-300',
                },
                ...(orgName
                  ? [
                      {
                        label: `${t('interview.hub.org')}: ${orgName}`,
                        title: s.organizationId,
                        tone: 'text-slate-600 dark:text-slate-300',
                      },
                    ]
                  : []),
              ];

              return (
                <InterviewSessionPreviewFooter
                  session={s}
                  isPolish={isPolish}
                  canRunAi={canRunAi}
                  aiHints={aiHints}
                  onRunAiHint={(hint) => {
                    const type = hintToType[hint] ?? 'summary';
                    void handleGenerateInsight(s, type);
                  }}
                  relations={relations}
                  onOpenFull={() => handleViewSession(s)}
                  onGenerateInsight={
                    canRunAi
                      ? (type) => handleGenerateInsight(s, type as InsightPromptType)
                      : undefined
                  }
                  onCopyId={() => copyToClipboard(s.id)}
                />
              );
            }}
          >
            {viewMode === 'table' ? (
              <div className="pl-4 pr-1.5 pt-3 pb-4">
                {renderSessionsTable(rows, {
                  onRowClick: setPreviewSessionId,
                  onRowDoubleClick: (id) => {
                    const s = rows.find((x) => x.id === id);
                    if (s) handleViewSession(s);
                  },
                  selectedId: previewSessionId,
                })}
              </div>
            ) : (
              /* canon §8: grid inside same TableWithPreviewLayout; single-click → preview */
              <div className="pl-4 pr-1.5 pt-3 pb-4">
                {renderSessionsGrid({ onCardClick: setPreviewSessionId })}
              </div>
            )}
          </TableWithPreviewLayout>
        </div>
      );
    }

    if (activeTab === 'insights') {
      // Presentation mode (KANON): flat list vs grouped "By report" (1/2/... sessions + General)
      const getReportGroupKey = (insight: InterviewInsight) => {
        const count =
          typeof insight.sourceSessionCount === 'number'
            ? insight.sourceSessionCount
            : insight.sessionId
              ? 1
              : 0;
        if (count > 0) {
          const unit =
            count === 1 ? t('interview.hub.sessionUnitOne') : t('interview.hub.sessionUnitOther');
          return `${count} ${unit}`;
        }
        return t('interview.hub.general');
      };

      const groupedInsights = (() => {
        const map: Record<string, typeof insightsForTable> = {};
        insightsForTable.forEach((insight) => {
          const key = getReportGroupKey(insight);
          if (!map[key]) map[key] = [];
          map[key].push(insight);
        });
        return map;
      })();

      const groupEntriesSorted = Object.entries(groupedInsights).sort(([a], [b]) => {
        const generalPl = 'Ogólne';
        const generalEn = 'General';
        const isGeneral = (x: string) => x === generalPl || x === generalEn;
        if (isGeneral(a) && !isGeneral(b)) return 1;
        if (!isGeneral(a) && isGeneral(b)) return -1;

        const na = parseInt(a, 10);
        const nb = parseInt(b, 10);
        const aHasNum = Number.isFinite(na);
        const bHasNum = Number.isFinite(nb);
        if (aHasNum && bHasNum) return na - nb;
        if (aHasNum && !bHasNum) return -1;
        if (!aHasNum && bHasNum) return 1;
        return a.localeCompare(b);
      });

      const selectedInsight = selectedInsightId
        ? (insightsForTable.find((i) => i.id === selectedInsightId) ?? null)
        : null;

      const getInsightTypeLabel = (type?: string) => {
        switch ((type || 'summary').toLowerCase()) {
          case 'summary':
            return t('interview.hub.insightTypeShort.summary');
          case 'trends':
            return t('interview.hub.insightTypeShort.trends');
          case 'problems':
            return t('interview.hub.insightTypeShort.problems');
          case 'opportunities':
            return t('interview.hub.insightTypeShort.opportunities');
          case 'recommendations':
            return t('interview.hub.insightTypeShort.recommendations');
          default:
            return type || '—';
        }
      };

      const insightsTableWithPreview = (
        <TableWithPreviewLayout<InterviewInsight>
          selectedId={selectedInsightId}
          selectedItem={selectedInsight}
          onSelect={setSelectedInsightId}
          onOpenFull={(id) => {
            const insight = insightsForTable.find((i) => i.id === id);
            if (insight) handleViewInsight(insight);
          }}
          renderPreview={(item) => {
            const type = (item.promptType || item.insightType || item.type || 'summary') as string;
            const sourceLabel = item.sourceSessionCount
              ? `${item.sourceSessionCount} ${t('interview.hub.sessions2')}`
              : item.sessionId
                ? // FALA 1 (2026-07-27): było `Sesja f7847468…` — obcięty UUID
                  // nic nie mówi; źródłem jest po prostu jedna sesja wywiadu.
                  t('interview.hub.linkedSession', 'Linked session')
                : '—';
            const dateStr = item.createdAt
              ? new Date(item.createdAt).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—';
            const detailsText = String(
              item.content || item.description || item.sourceQuote || ''
            ).trim();
            const createdAt = item.createdAt ? new Date(item.createdAt) : null;
            const createdRelative = (() => {
              if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
              const diffMs = Date.now() - createdAt.getTime();
              const diffMin = Math.round(diffMs / 60000);
              const rtf = new Intl.RelativeTimeFormat(isPolish ? 'pl' : 'en', { numeric: 'auto' });
              if (Math.abs(diffMin) < 60) return rtf.format(-diffMin, 'minute');
              const diffH = Math.round(diffMin / 60);
              if (Math.abs(diffH) < 48) return rtf.format(-diffH, 'hour');
              const diffD = Math.round(diffH / 24);
              return rtf.format(-diffD, 'day');
            })();

            const status = (item.status || 'completed') as 'generating' | 'completed' | 'failed';
            const statusConfig: Record<
              typeof status,
              { label: { en: string; pl: string }; bg: string; text: string }
            > = {
              generating: {
                label: { en: 'Generating', pl: 'Generowanie' },
                bg: 'bg-amber-500/20',
                text: 'text-amber-600 dark:text-amber-300',
              },
              completed: {
                label: { en: 'Completed', pl: 'Gotowe' },
                bg: 'bg-emerald-500/20',
                text: 'text-emerald-700 dark:text-emerald-300',
              },
              failed: {
                label: { en: 'Failed', pl: 'Błąd' },
                bg: 'bg-c-danger/20',
                text: 'text-c-danger',
              },
            };
            const sc = statusConfig[status] || statusConfig.completed;
            const typeConfig = getInsightTypeConfig(type);

            const aiSuggestions = isPolish
              ? [
                  { id: 'summarize', label: 'Podsumuj' },
                  { id: 'risks', label: 'Wypisz ryzyka' },
                  { id: 'next', label: 'Następne kroki' },
                ]
              : [
                  { id: 'summarize', label: 'Summarize' },
                  { id: 'risks', label: 'Extract risks' },
                  { id: 'next', label: 'Next steps' },
                ];

            const buildAiPrompt = (kind: string) => {
              const base = `Title: ${item.title}\n\nContent:\n${detailsText || '—'}`;
              if (kind === 'summarize') return `Summarize this insight in 5 bullets.\n\n${base}`;
              if (kind === 'risks')
                return `Extract risks (with severity) from this insight.\n\n${base}`;
              if (kind === 'next') return `Propose next steps as a prioritized plan.\n\n${base}`;
              return base;
            };

            return (
              <InterviewInsightPreviewBody
                insight={item}
                isPolish={isPolish}
                typeLabel={getInsightTypeLabel(type)}
                typeConfig={typeConfig}
                statusConfig={sc}
                sourceLabel={sourceLabel}
                dateStr={
                  createdRelative
                    ? t('interview.hub.createdRelative', { relative: createdRelative })
                    : dateStr
                }
                detailsText={detailsText}
                detailsExpanded={insightPreviewDetailsExpanded}
                onToggleDetailsExpanded={() => setInsightPreviewDetailsExpanded((v) => !v)}
                onDetailsAction={(action) => {
                  if (action === 'copy') {
                    copyToClipboard(detailsText || item.title || '');
                  } else if (action === 'copy-summarize-prompt') {
                    copyToClipboard(buildAiPrompt('summarize'));
                  } else if (action === 'export-tools') {
                    if (!item.exportedToTools) handleExportInsightToTools(item.id);
                  } else if (action === 'download') {
                    const promptType =
                      (item as any).promptType || (item as any).insightType || 'summary';
                    const content = `# ${item.title}\n\n**Type:** ${promptType}\n**Status:** ${item.status || 'completed'}\n\n${item.content || ''}\n`;
                    const blob = new Blob([content], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `insight-${item.id.slice(0, 8)}.md`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
              />
            );
          }}
          renderPreviewFooter={(item) => {
            return <InterviewInsightPreviewFooter insight={item} isPolish={isPolish} />;
          }}
          itemIds={insightsForTable.map((i) => i.id)}
          getItemById={(id) => insightsForTable.find((x) => x.id === id) ?? null}
        >
          <div className="pl-4 pr-1.5 pt-3 pb-4">
            <div className="space-y-4">
              {insightsViewMode === 'report' ? (
                groupEntriesSorted.map(([groupName, groupInsights]) => (
                  <div key={groupName}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <FileText size={14} className="text-slate-600" />
                      <span className="text-xs font-semibold text-c-text-muted uppercase tracking-wider">
                        {groupName}
                      </span>
                      <span className="text-xs text-slate-500">({groupInsights.length})</span>
                    </div>
                    {renderInsightsTable(groupInsights, {
                      onRowClick: setSelectedInsightId,
                      onRowDoubleClick: (id) => {
                        const insight = filteredInsights.find((i) => i.id === id);
                        if (insight) handleViewInsight(insight);
                      },
                      selectedId: selectedInsightId,
                    })}
                  </div>
                ))
              ) : (
                <div>
                  {renderInsightsTable(insightsForTable, {
                    onRowClick: setSelectedInsightId,
                    onRowDoubleClick: (id) => {
                      const insight = filteredInsights.find((i) => i.id === id);
                      if (insight) handleViewInsight(insight);
                    },
                    selectedId: selectedInsightId,
                  })}
                </div>
              )}
            </div>
          </div>
        </TableWithPreviewLayout>
      );

      return (
        <div className="h-full overflow-hidden">
          {renderDegradedBanner()}
          {insightsTableWithPreview}
        </div>
      );
    }

    if (activeTab === 'initiatives') {
      const rows = filteredInterviewInitiatives;

      // Status → human label only. Tone/colour comes from EntityStatusChip
      // (statusChipTone → c.* tokens) per canon §4.1 — no legacy getStatusStyle,
      // no status-coloured row/card accent bars (§3.5/§4.0a).
      const statusMeta = (statusValue?: string) => {
        const status = String(statusValue || 'DRAFT').toUpperCase();
        if (status === 'PENDING_REVIEW') {
          return { label: t('interview.hub.pendingReview4') };
        }
        if (['REVIEW', 'PROMOTED', 'PLANNING', 'APPROVED'].includes(status)) {
          return { label: t('interview.hub.movedForward') };
        }
        return { label: t('interview.hub.draft3') };
      };

      // Map initiative priority → canon PriorityChip level (neutral shell + colored dot).
      const priorityLevel = (priorityValue?: string): PriorityLevel => {
        switch (String(priorityValue || '').toLowerCase()) {
          case 'critical':
          case 'urgent':
            return 'urgent';
          case 'high':
            return 'high';
          case 'low':
            return 'low';
          default:
            return 'medium';
        }
      };

      // An initiative "lives" in the Initiatives module only once moved forward.
      // Drafts / pending-review stay in the Interview table (preview), per owner.
      const isInitiativePromoted = (raw?: string) => {
        const s = String(raw || 'DRAFT').toUpperCase();
        return [
          'PROMOTED',
          'PLANNING',
          'APPROVED',
          'IN_EXECUTION',
          'IN_PROGRESS',
          'REVIEW',
        ].includes(s);
      };

      // PreviewableItem requires title:string — coalesce from title/name.
      const withInitiativeTitle = (it: InterviewInitiativeDraft) => ({
        ...it,
        title: it.title || it.name || t('interview.hub.initiative'),
      });

      // Side-preview body for an initiative (canon §7.3: meta → details).
      const renderInitiativePreview = (item: InterviewInitiativeDraft) => {
        const m = statusMeta(item.status);
        const desc = String(item.description || '')
          .replace(/^#\s.+$/m, '')
          .trim();
        const src = item.sourceId ? insights.find((i) => i.id === item.sourceId) : null;
        const dateStr =
          item.updatedAt || item.createdAt
            ? new Date(item.updatedAt || item.createdAt || '').toLocaleDateString(
                t('interview.hub.enUs')
              )
            : '—';
        const promoted = isInitiativePromoted(item.status);
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200/70 bg-slate-50/60 p-3 dark:border-white/[0.06] dark:bg-white/[0.03]">
              <EntityStatusChip status={item.status} label={m.label} />
              {item.priority ? (
                <PriorityChip
                  level={priorityLevel(item.priority)}
                  label={String(item.priority).toLowerCase()}
                />
              ) : null}
              {src ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-c-border bg-c-surface-raised px-2 py-0.5 text-[11px] font-medium text-c-text-secondary">
                  <Lightbulb size={11} />
                  Insight
                </span>
              ) : null}
              <span className="inline-flex items-center rounded-full border border-c-border bg-c-surface-raised px-2 py-0.5 text-[11px] font-medium text-c-text-secondary">
                {dateStr}
              </span>
            </div>
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                {t('interview.hub.details')}
              </div>
              {desc ? (
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-c-text-secondary">
                  {desc}
                </div>
              ) : (
                <div className="text-sm text-slate-400 dark:text-slate-500">
                  {t('interview.hub.noDescription')}
                </div>
              )}
            </div>
            {!promoted ? (
              <div className="rounded-lg border-l-4 border-l-amber-500 border border-amber-300/50 bg-amber-100 px-3 py-2 text-[11px] text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                {t('interview.hub.draftStaysInInterviewUntil')}
              </div>
            ) : null}
          </div>
        );
      };

      // Lineage read-back — decisions/tasks created from interview findings
      // (source_type='interview_insight'). Compact count + list, honest empty
      // state, real data only (driven by the my-work list endpoints).
      const lineageDecisionCount = interviewDecisions.length;
      const lineageTaskCount = interviewTasks.length;
      const renderLineageColumn = (kind: 'decisions' | 'tasks', items: InterviewLineageItem[]) => {
        const isDecisions = kind === 'decisions';
        const Icon = isDecisions ? Target : ClipboardList;
        const heading = isDecisions
          ? t('interview.hub.decisionsFromInterviews')
          : t('interview.hub.tasksFromInterviews');
        const basePath = isDecisions ? '/my-work/decisions' : '/my-work/tasks';
        return (
          <div className="flex-1 rounded-lg border border-slate-200/70 bg-white/60 p-3 dark:border-white/[0.06] dark:bg-navy-900/50">
            <div className="mb-2 flex items-center gap-2">
              <Icon size={14} className="text-c-text-muted" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                {heading}
              </span>
              <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                {items.length}
              </span>
            </div>
            {items.length === 0 ? (
              <p className="text-[11px] text-c-text-muted">
                {isDecisions
                  ? t('interview.hub.noDecisionsHandedOffFrom')
                  : t('interview.hub.noTasksHandedOffFrom')}
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {items.slice(0, 6).map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => navigate(`${basePath}/${encodeURIComponent(item.id)}`)}
                      className="group flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-white/[0.05]"
                    >
                      <span className="truncate">
                        {item.title || item.name || t('interview.hub.untitled')}
                      </span>
                      <ExternalLink
                        size={11}
                        className="ml-auto shrink-0 text-slate-400 opacity-0 transition group-hover:opacity-100"
                      />
                    </button>
                  </li>
                ))}
                {items.length > 6 ? (
                  <li className="px-1.5 pt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {t('interview.hub.plusMoreCount', { count: items.length - 6 })}
                  </li>
                ) : null}
              </ul>
            )}
          </div>
        );
      };

      return (
        <div className="flex h-full flex-col overflow-hidden">
          {renderDegradedBanner()}
          {lineageDecisionCount > 0 || lineageTaskCount > 0 ? (
            <div className="mx-4 mb-3 mt-4 shrink-0 rounded-xl border border-slate-200/70 bg-white/50 p-3 backdrop-blur dark:border-white/[0.06] dark:bg-navy-900/50">
              <div className="mb-2 flex items-center gap-2">
                <Send size={13} className="text-crimson-500" />
                <span className="text-[12px] font-semibold text-c-text-secondary">
                  {t('interview.hub.handedOffFromInterviews')}
                </span>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {t('interview.hub.decisionsAndTasksCreatedFrom')}
                </span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                {renderLineageColumn('decisions', interviewDecisions)}
                {renderLineageColumn('tasks', interviewTasks)}
              </div>
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <TableWithPreviewLayout<InterviewInitiativeDraft & { title: string }>
              selectedId={selectedInterviewInitiativeId}
              selectedItem={(() => {
                const it = rows.find((r) => r.id === selectedInterviewInitiativeId);
                return it ? withInitiativeTitle(it) : null;
              })()}
              onSelect={setSelectedInterviewInitiativeId}
              onOpenFull={(id) => {
                // Double-click / Enter / "Open" → full initiative doc view in the
                // Initiatives module. Drafts open too (they exist in the DB and the
                // module renders them fine); promotion only governs listing, not viewing.
                navigate(`/initiatives?open=${encodeURIComponent(id)}&mode=doc`);
              }}
              renderPreview={(item) => renderInitiativePreview(item)}
              renderPreviewFooter={(item) => {
                // canon §7.3: AI → Relations → Actions.
                const src = item.sourceId ? insights.find((i) => i.id === item.sourceId) : null;
                const relations: Array<{ label: string; tone?: string }> = [];
                if (src)
                  relations.push({
                    label: `${t('interview.hub.insight2')}: ${(src.title || src.id).slice(0, 40)}`,
                    tone: 'text-amber-600 dark:text-amber-300',
                  });
                if (item.priority)
                  relations.push({
                    label: `${t('interview.hub.priority')}: ${String(item.priority).toLowerCase()}`,
                    tone: 'text-c-text-secondary',
                  });
                if (item.updatedAt || item.createdAt)
                  relations.push({
                    label: `${t('interview.hub.updated')}: ${new Date(
                      item.updatedAt || item.createdAt || ''
                    ).toLocaleDateString(t('interview.hub.enUs', 'en-US'))}`,
                    tone: 'text-slate-600 dark:text-slate-300',
                  });

                return (
                  <InterviewInitiativePreviewFooter
                    isPolish={isPolish}
                    status={String(item.status || '')}
                    canReview={canReviewInsights}
                    relations={relations}
                    onSendToReview={() =>
                      void handleUpdateInterviewInitiativeStatus(item.id, 'PENDING_REVIEW')
                    }
                    onApproveMoveForward={() =>
                      void handleUpdateInterviewInitiativeStatus(item.id, 'REVIEW', {
                        openInInitiatives: true,
                      })
                    }
                    onBackToDraft={() =>
                      void handleUpdateInterviewInitiativeStatus(item.id, 'DRAFT')
                    }
                    onOpenInModule={() =>
                      navigate(`/initiatives?open=${encodeURIComponent(item.id)}&mode=doc`)
                    }
                    onCopyId={() => copyToClipboard(item.id)}
                  />
                );
              }}
              itemIds={rows.map((r) => r.id)}
              getItemById={(id) => {
                const it = rows.find((r) => r.id === id);
                return it ? withInitiativeTitle(it) : null;
              }}
            >
              <div className="pl-4 pr-1.5 pt-3 pb-4">
                {initiativesViewMode === 'cards' ? (
                  // §8.1 GridView — anatomia karty: badges → title → desc → stats footer
                  rows.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-16">
                      <Rocket className="h-10 w-10 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm text-c-text-muted">
                        {t('interview.hub.noInitiativesYet')}
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {rows.map((initiative) => {
                        const cardTitle =
                          initiative.title || initiative.name || t('interview.hub.initiative');
                        const status = String(initiative.status || 'DRAFT').toUpperCase();
                        const m = statusMeta(status);
                        const isSelected = selectedInterviewInitiativeId === initiative.id;
                        const desc = String(initiative.description || '')
                          .replace(/^#\s.+$/m, '')
                          .trim();
                        const dateStr = initiative.createdAt
                          ? new Date(initiative.createdAt).toLocaleDateString(
                              t('interview.hub.enUs'),
                              { month: 'short', day: 'numeric' }
                            )
                          : '—';
                        const src = initiative.sourceId
                          ? insights.find((i) => i.id === initiative.sourceId)
                          : null;
                        return (
                          <div
                            key={initiative.id}
                            className={[
                              'group relative flex flex-col gap-2.5 rounded-xl border p-4 cursor-pointer transition duration-150',
                              isSelected
                                ? 'border-slate-300 bg-slate-50 shadow-sm dark:border-white/[0.18] dark:bg-white/[0.06]'
                                : 'border-slate-200/60 dark:border-white/[0.06] bg-c-surface hover:shadow-md hover:-translate-y-px',
                            ].join(' ')}
                            onClick={() =>
                              setSelectedInterviewInitiativeId(isSelected ? null : initiative.id)
                            }
                            onDoubleClick={() => {
                              navigate(
                                `/initiatives?open=${encodeURIComponent(initiative.id)}&mode=doc`
                              );
                            }}
                          >
                            {/* 1 BADGE ROW */}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <EntityStatusChip status={status} label={m.label} />
                              {initiative.priority &&
                                ['critical', 'urgent', 'high'].includes(
                                  String(initiative.priority).toLowerCase()
                                ) && <PriorityChip level={priorityLevel(initiative.priority)} />}
                            </div>
                            {/* 2 TITLE */}
                            <p
                              className="line-clamp-2 text-sm font-semibold text-c-text"
                              title={cardTitle}
                            >
                              {cardTitle}
                            </p>
                            {/* 3 DESCRIPTION */}
                            {desc ? (
                              <p className="line-clamp-2 text-xs text-c-text-muted">{desc}</p>
                            ) : null}
                            {/* 4 STATS FOOTER */}
                            <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-white/[0.05] dark:text-slate-400">
                              <span>
                                {initiative.priority
                                  ? String(initiative.priority).charAt(0).toUpperCase() +
                                    String(initiative.priority).slice(1).toLowerCase()
                                  : t('interview.hub.noPriority')}
                              </span>
                              <span>
                                {src ? t('interview.hub.1Insight') : t('interview.hub.noSource')}
                              </span>
                              <span>{dateStr}</span>
                            </div>
                            {/* KEBAB (same sections as table) */}
                            <div
                              className="absolute right-2 top-2 z-10"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <RowActionsMenu
                                iconVariant="vertical"
                                className="opacity-0 transition-opacity group-hover:opacity-100"
                                sections={[
                                  {
                                    id: 'context',
                                    kind: 'context' as const,
                                    actions: [
                                      ...(status === 'DRAFT'
                                        ? [
                                            {
                                              id: 'send-to-review',
                                              label: t('interview.hub.sendToReview'),
                                              icon: ArrowRight,
                                              onClick: () =>
                                                void handleUpdateInterviewInitiativeStatus(
                                                  initiative.id,
                                                  'PENDING_REVIEW'
                                                ),
                                            },
                                          ]
                                        : []),
                                      ...(status === 'PENDING_REVIEW'
                                        ? [
                                            ...(canReviewInsights
                                              ? [
                                                  {
                                                    id: 'approve-to-initiatives',
                                                    label: t('interview.hub.approveAndMoveForward'),
                                                    icon: Rocket,
                                                    onClick: () =>
                                                      void handleUpdateInterviewInitiativeStatus(
                                                        initiative.id,
                                                        'REVIEW',
                                                        { openInInitiatives: true }
                                                      ),
                                                  },
                                                ]
                                              : []),
                                            {
                                              id: 'back-to-draft',
                                              label: t('interview.hub.backToDraft'),
                                              icon: RotateCcw,
                                              onClick: () =>
                                                void handleUpdateInterviewInitiativeStatus(
                                                  initiative.id,
                                                  'DRAFT'
                                                ),
                                            },
                                          ]
                                        : []),
                                    ],
                                  },
                                  {
                                    id: 'fixed',
                                    kind: 'manage' as const,
                                    actions: [
                                      {
                                        id: 'open-preview',
                                        label: t('interview.hub.openPreview'),
                                        icon: ChevronRight,
                                        onClick: () =>
                                          setSelectedInterviewInitiativeId(initiative.id),
                                      },
                                      {
                                        id: 'edit',
                                        label: t('interview.hub.edit'),
                                        icon: Edit2,
                                        disabled: true,
                                        description: t('interview.hub.comingSoonBackend'),
                                        onClick: () => {},
                                      },
                                      {
                                        id: 'open-module',
                                        label: t('interview.hub.openInInitiatives'),
                                        icon: ExternalLink,
                                        onClick: () =>
                                          navigate(
                                            `/initiatives?open=${encodeURIComponent(initiative.id)}&mode=doc`
                                          ),
                                      },
                                      {
                                        id: 'archive',
                                        label: t('interview.hub.archive'),
                                        icon: Archive,
                                        description: t('interview.hub.comingSoonBackend'),
                                        disabled: true,
                                        onClick: () => {},
                                      },
                                    ],
                                  },
                                  {
                                    id: 'danger',
                                    kind: 'danger' as const,
                                    actions: [
                                      {
                                        id: 'delete',
                                        label: t('interview.hub.delete'),
                                        icon: Trash2,
                                        variant: 'danger' as const,
                                        description: t('interview.hub.comingSoonBackend'),
                                        disabled: true,
                                        onClick: () => {},
                                      },
                                    ],
                                  },
                                ]}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <StandardTable
                    columns={[
                      {
                        id: 'title',
                        label: t('interview.hub.initiative'),
                        sortable: true,
                        sortAccessor: (row: InterviewInitiativeDraft) =>
                          row.title || row.name || '',
                        render: (row: InterviewInitiativeDraft) => (
                          <span
                            className="truncate block text-[13.5px] font-semibold leading-5 tracking-[-0.01em] text-slate-950 dark:text-slate-100"
                            title={row.title || row.name || t('interview.hub.initiative')}
                          >
                            {row.title || row.name || t('interview.hub.initiative')}
                          </span>
                        ),
                      },
                      {
                        id: 'status',
                        label: t('interview.hub.status'),
                        width: '160px',
                        filterable: true,
                        filterOptions: [
                          { value: 'draft', label: t('interview.hub.draft3') },
                          {
                            value: 'pending_review',
                            label: t('interview.hub.pendingReview4'),
                          },
                          {
                            value: 'moved_forward',
                            label: t('interview.hub.movedForward'),
                          },
                        ],
                        render: (row: InterviewInitiativeDraft) => {
                          const status = String(row.status || 'DRAFT').toUpperCase();
                          const meta = statusMeta(row.status);
                          return <EntityStatusChip status={status} label={meta.label} />;
                        },
                      },
                      {
                        id: 'priority',
                        label: t('interview.hub.priority'),
                        width: '130px',
                        filterable: true,
                        filterOptions: [
                          { value: 'critical', label: t('interview.hub.critical') },
                          { value: 'high', label: t('interview.hub.high') },
                          { value: 'medium', label: t('interview.hub.medium') },
                          { value: 'low', label: t('interview.hub.low') },
                        ],
                        render: (row: InterviewInitiativeDraft) =>
                          row.priority ? (
                            <PriorityChip
                              level={priorityLevel(row.priority)}
                              label={String(row.priority).toLowerCase()}
                            />
                          ) : (
                            <span className="text-xs text-c-text-muted">—</span>
                          ),
                      },
                      {
                        id: 'source',
                        label: t('interview.hub.source'),
                        width: '140px',
                        filterable: true,
                        filterOptions: [
                          { value: 'insight', label: 'Insight' },
                          { value: 'none', label: t('interview.hub.none') },
                        ],
                        render: (row: InterviewInitiativeDraft) => {
                          const sourceInsight = row.sourceId
                            ? insights.find((insight) => insight.id === row.sourceId)
                            : null;
                          const sourceStyle = getTypeStyle('source');
                          return sourceInsight ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleViewInsight(sourceInsight);
                              }}
                              className={`inline-flex items-center gap-1 rounded-full border border-current/20 px-2 py-0.5 text-[11px] font-medium leading-none transition-colors ${sourceStyle.bg} ${sourceStyle.text}`}
                            >
                              <Lightbulb size={12} />
                              Insight
                            </button>
                          ) : (
                            <span className="text-xs text-c-text-muted">—</span>
                          );
                        },
                      },
                      {
                        id: 'date',
                        label: t('interview.hub.date'),
                        width: '140px',
                        sortable: true,
                        sortAccessor: (row: InterviewInitiativeDraft) => {
                          const d = row.updatedAt || row.createdAt;
                          return d ? new Date(d).getTime() : 0;
                        },
                        render: (row: InterviewInitiativeDraft) =>
                          row.updatedAt || row.createdAt ? (
                            <span className="text-xs text-c-text-muted">
                              {new Date(row.updatedAt || row.createdAt || '').toLocaleDateString(
                                t('interview.hub.enUs')
                              )}
                            </span>
                          ) : (
                            <span className="text-xs text-c-text-muted">—</span>
                          ),
                      },
                    ]}
                    data={rows as unknown as Array<Record<string, unknown> & { id: string }>}
                    selectedRowId={selectedInterviewInitiativeId}
                    onRowClick={(row) => setSelectedInterviewInitiativeId(String((row as any).id))}
                    onRowDoubleClick={(row) => {
                      navigate(
                        `/initiatives?open=${encodeURIComponent(String((row as any).id))}&mode=doc`
                      );
                    }}
                    rowDescription={(row) => {
                      const initiative = row as unknown as InterviewInitiativeDraft;
                      return (initiative.description || '').replace(/^#\s.+$/m, '').trim() || null;
                    }}
                    defaultSort={{ columnId: 'date', direction: 'desc' }}
                    persistKey="interview.initiatives.list"
                    selection={{
                      selectedIds: selectedInitiativeIds,
                      onChange: setSelectedInitiativeIds,
                    }}
                    empty={{
                      icon: Rocket,
                      title:
                        interviewInitiatives.length === 0
                          ? t('interview.hub.noInitiativesCreatedFromInterview')
                          : t('interview.hub.noInitiativesHere'),
                      description:
                        interviewInitiatives.length === 0
                          ? t('interview.hub.noInitiativesYetPromoteInsights')
                          : undefined,
                      actionLabel:
                        interviewInitiatives.length === 0
                          ? t('interview.hub.goToInsights')
                          : undefined,
                      onAction:
                        interviewInitiatives.length === 0
                          ? () => {
                              setActiveTab('insights');
                              setActiveDocumentId(null);
                            }
                          : undefined,
                    }}
                    rowMenu={(row): StandardRowMenu => {
                      const initiative = row as unknown as InterviewInitiativeDraft;
                      const status = String(initiative.status || 'DRAFT').toUpperCase();
                      return {
                        primary: [
                          ...(status === 'DRAFT'
                            ? [
                                {
                                  id: 'send-to-review',
                                  label: t('interview.hub.sendToReview'),
                                  icon: ArrowRight,
                                  onClick: () =>
                                    void handleUpdateInterviewInitiativeStatus(
                                      initiative.id,
                                      'PENDING_REVIEW'
                                    ),
                                },
                              ]
                            : []),
                          ...(status === 'PENDING_REVIEW' && canReviewInsights
                            ? [
                                {
                                  id: 'approve-to-initiatives',
                                  label: t('interview.hub.approveAndMoveForward'),
                                  icon: Rocket,
                                  onClick: () =>
                                    void handleUpdateInterviewInitiativeStatus(
                                      initiative.id,
                                      'REVIEW',
                                      { openInInitiatives: true }
                                    ),
                                },
                              ]
                            : []),
                          {
                            id: 'open-module',
                            label: t('interview.hub.openInInitiatives'),
                            icon: ExternalLink,
                            onClick: () =>
                              navigate(
                                `/initiatives?open=${encodeURIComponent(initiative.id)}&mode=doc`
                              ),
                          },
                        ],
                        statusTransitions:
                          status === 'PENDING_REVIEW'
                            ? [
                                {
                                  id: 'back-to-draft',
                                  label: t('interview.hub.backToDraft'),
                                  icon: RotateCcw,
                                  onClick: () =>
                                    void handleUpdateInterviewInitiativeStatus(
                                      initiative.id,
                                      'DRAFT'
                                    ),
                                },
                              ]
                            : [],
                        universalHandlers: {
                          preview: () => setSelectedInterviewInitiativeId(initiative.id),
                          editNote: t('interview.hub.comingSoonBackend'),
                          archiveNote: t('interview.hub.comingSoonBackend'),
                        },
                        destructive: {
                          note: t('interview.hub.comingSoonBackend'),
                        },
                      };
                    }}
                  />
                )}{' '}
                {/* end initiativesViewMode === 'table' */}
              </div>
            </TableWithPreviewLayout>
          </div>
        </div>
      );
    }

    if (activeTab === 'templates') {
      const rows = filteredTemplates;
      const selected = selectedTemplateId ? rows.find((t) => t.id === selectedTemplateId) : null;
      const selectedItem = selected
        ? ({ ...selected, title: selected.name } as InterviewTemplate & { title: string })
        : null;

      const buildPrompt = (kind: 'summary' | 'improvements' | 'gaps', templateId: string) => {
        const tpl = templates.find((x) => x.id === templateId) || selected;
        const qs = templateQuestionsById[templateId] || [];
        const header =
          kind === 'summary'
            ? t('interview.hub.summarizeThisInterviewTemplate')
            : kind === 'improvements'
              ? t('interview.hub.proposeImprovementsAndBetterWording')
              : t('interview.hub.detectGapsWhatIsMissing');

        const qLines = qs
          .map((q: any, idx: number) => {
            const text = String(q?.questionText || q?.text || q?.title || q?.question || '').trim();
            return text ? `${idx + 1}. ${text}` : null;
          })
          .filter(Boolean)
          .slice(0, 40)
          .join('\n');

        const usedInAssignments =
          (myAssignments || []).filter((a) => a.templateId === templateId).length +
          (managedAssignments || []).filter((a) => a.templateId === templateId).length;

        return [
          header,
          '',
          `Name: ${tpl?.name || '—'}`,
          `Category: ${tpl?.category || '—'}`,
          `Source: ${getTemplateSourceLabel(tpl?.scope, t)}`,
          `Area tags: ${(tpl?.areaTags || []).join(', ') || '—'}`,
          `Status: ${tpl?.isDefault ? 'Default' : 'Active'}`,
          `Questions count: ${tpl?.questionCount ?? '—'}`,
          `Used in assignments: ${usedInAssignments}`,
          '',
          tpl?.description ? `Description:\n${tpl.description}` : 'Description: —',
          '',
          qLines ? `Questions:\n${qLines}` : 'Questions: —',
        ].join('\n');
      };

      const copyToClipboard = async (text: string) => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success(t('interview.hub.copiedToClipboard'));
        } catch {
          toast.error(t('interview.hub.copyFailed'));
        }
      };

      const onOpenFull = (id: string) => {
        if (canAssign) handleEditTemplate(id);
        else {
          const t = templates.find((x) => x.id === id);
          if (t) handleViewTemplate(t);
        }
      };

      // canon §8: grid/cards MUST be inside the same TableWithPreviewLayout (preview pane stays alive)
      return (
        <div className="h-full flex flex-col">
          <TableWithPreviewLayout<InterviewTemplate & { title: string }>
            selectedId={selectedTemplateId}
            selectedItem={selectedItem}
            onSelect={(id) => setSelectedTemplateId(id)}
            onOpenFull={onOpenFull}
            itemIds={rows.map((t) => t.id)}
            getItemById={(id) => {
              const x = rows.find((i) => i.id === id);
              return x ? ({ ...x, title: x.name || x.id } as any) : null;
            }}
            renderPreview={(item) => {
              const itemQuestions = templateQuestionsById[item.id] || [];
              const isLoadingQuestions = !!templateQuestionsLoading[item.id];

              return (
                <InterviewTemplatePreviewBody
                  template={item}
                  isPolish={isPolish}
                  questions={itemQuestions}
                  questionsLoading={isLoadingQuestions}
                  getTemplateSourceLabel={getTemplateSourceLabel}
                  getTemplateAreaTagLabel={getTemplateAreaTagLabel}
                  onDetailsAction={(action) => {
                    if (action === 'edit') onOpenFull(item.id);
                    else if (action === 'duplicate') handleCloneTemplate(item);
                    else if (action === 'delete') handleDeleteTemplate(item);
                  }}
                  canDelete={canAssign && !item.isDefault}
                />
              );
            }}
            renderPreviewFooter={(item) => {
              const usage =
                (myAssignments || []).filter((a) => a.templateId === item.id).length +
                (managedAssignments || []).filter((a) => a.templateId === item.id).length;

              return (
                <InterviewTemplatePreviewFooter
                  template={item}
                  isPolish={isPolish}
                  canAssign={canAssign}
                  usageCount={usage}
                  onOpenFull={() => onOpenFull(item.id)}
                  onClone={() => handleCloneTemplate(item)}
                  onDelete={
                    canAssign && !item.isDefault ? () => handleDeleteTemplate(item) : undefined
                  }
                  aiHints={
                    isPolish
                      ? ['Podsumuj', 'Usprawnienia', 'Luki']
                      : ['Summarize', 'Improve', 'Find gaps']
                  }
                  onRunAiHint={(hint) => {
                    type TemplatePromptKind = 'summary' | 'improvements' | 'gaps';
                    const hintMap: Record<string, TemplatePromptKind> = {
                      Podsumuj: 'summary',
                      Summarize: 'summary',
                      Usprawnienia: 'improvements',
                      Improve: 'improvements',
                      Luki: 'gaps',
                      'Find gaps': 'gaps',
                    };
                    const promptKind = (hintMap[hint] ?? 'summary') as TemplatePromptKind;
                    copyToClipboard(buildPrompt(promptKind, item.id));
                  }}
                />
              );
            }}
          >
            {templatesViewMode === 'cards' ? (
              <div className="h-full flex flex-col overflow-auto">
                {renderTemplatesCards({
                  onSelectRow: (id) => setSelectedTemplateId(id),
                  onOpenFull: (id) => onOpenFull(id),
                })}
              </div>
            ) : (
              <div className="pl-4 pr-1.5 pt-3 pb-4">
                {renderTemplatesTable({
                  onSelectRow: (id) => setSelectedTemplateId(id),
                  onOpenFull: (id) => onOpenFull(id),
                })}
              </div>
            )}
          </TableWithPreviewLayout>
        </div>
      );
    }

    // Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): Interview
    // Inbox (my_assignments, list mode) → StandardTable + StandardPreview.
    // Moduł deklaruje TYLKO dane + kontrakt kebaba/akcji; chrome pochodzi
    // z fasad Standard* (wzorzec 1:1 z AssessmentHub 'list' — 6fb79511fe).
    if (activeTab === 'my_assignments' && assignmentsViewMode === 'list') {
      const rows = filteredMyAssignments || [];
      const selectedRow = previewAssignmentId
        ? (rows.find((a) => a.id === previewAssignmentId) ?? null)
        : null;

      const inboxColumns: StandardTableColumn[] = [
        {
          id: 'template',
          label: t('interview.hub.type'),
          width: '160px',
          render: (row: InterviewAssignment) => (
            <span className="text-xs font-semibold text-c-text-secondary">
              {row.template?.name || t('interview.hub.interview')}
            </span>
          ),
        },
        {
          id: 'name',
          label: t('interview.hub.name'),
          render: (row: InterviewAssignment) => (
            <span className="text-sm font-semibold text-c-text">{getAssignmentTitle(row)}</span>
          ),
        },
        {
          id: 'status',
          label: t('interview.hub.status'),
          width: '150px',
          filterable: true,
          filterOptions: [
            { value: 'assigned', label: t('interview.hub.assigned2') },
            { value: 'in_progress', label: t('interview.hub.inProgress') },
            { value: 'submitted', label: t('interview.hub.submitted4') },
            { value: 'sent_back', label: t('interview.hub.sentBack') },
            { value: 'approved', label: t('interview.hub.approved2') },
            { value: 'completed', label: t('interview.hub.completed') },
          ],
          render: (row: InterviewAssignment) => (
            <EntityStatusChip status={row.status} label={getAssignmentStatusLabel(row.status)} />
          ),
        },
        {
          id: 'progress',
          label: t('interview.hub.progress'),
          width: '130px',
          align: 'right',
          render: (row: InterviewAssignment) => (
            <ProgressCell value={row.session?.completenessPercent ?? 0} />
          ),
        },
        {
          id: 'dueAt',
          label: t('interview.hub.daysToDue2'),
          width: '160px',
          sortable: true,
          sortAccessor: (row: InterviewAssignment) =>
            row.dueAt ? new Date(row.dueAt).getTime() : 0,
          render: (row: InterviewAssignment) => {
            const dtd = getAssignmentDaysToDue(row.dueAt);
            if (!dtd) return <span className="text-c-text-muted">—</span>;
            return (
              <DueChip
                label={dtd.label}
                risk={dtd.days < 0 ? 'overdue' : dtd.days <= 3 ? 'soon' : 'none'}
              />
            );
          },
        },
        {
          id: 'assignee',
          label: t('interview.hub.assignee4'),
          width: '170px',
          render: (row: InterviewAssignment) => (
            <AssigneeCell
              name={row.assignee?.name || row.assignee?.email || null}
              unassignedLabel={t('interview.hub.unassigned')}
            />
          ),
        },
      ];

      const inboxPreviewActions: StandardPreviewActions | undefined = selectedRow
        ? {
            resolutions:
              selectedRow.status === 'assigned'
                ? [
                    {
                      id: 'start',
                      variant: 'positive',
                      label: t('interview.hub.start'),
                      icon: Sparkles,
                      onClick: () => startInterviewAssignment(selectedRow),
                    },
                  ]
                : selectedRow.status === 'sent_back' &&
                    (selectedRow.sessionId || selectedRow.session?.id)
                  ? [
                      {
                        id: 'fix',
                        variant: 'positive',
                        label: t('interview.hub.fixResubmit'),
                        icon: RotateCcw,
                        onClick: () => void openInterviewAssignmentFull(selectedRow, false),
                      },
                    ]
                  : selectedRow.status === 'in_progress' &&
                      (selectedRow.sessionId || selectedRow.session?.id)
                    ? [
                        {
                          id: 'continue',
                          variant: 'positive',
                          label: t('interview.hub.continue'),
                          icon: ChevronRight,
                          onClick: () => void openInterviewAssignmentFull(selectedRow, false),
                        },
                      ]
                    : undefined,
            informational: [
              {
                id: 'open',
                variant: 'neutral',
                label: t('interview.hub.open'),
                icon: ExternalLink,
                shortcut: 'O',
                onClick: () => void openInterviewAssignmentFull(selectedRow, false),
              },
            ],
            time: [1, 3, 7].map((d) => ({
              id: `delay-${d}`,
              variant: 'warning' as const,
              label:
                d === 1
                  ? t('interview.hub.plusDaysOne', { count: d })
                  : t('interview.hub.plusDaysOther', { count: d }),
              icon: Clock,
              onClick: () => void handleDelayAssignment(selectedRow, d),
            })),
          }
        : undefined;

      // Esc closes preview; single-key shortcuts active while preview open (kanon B.24/B.31).
      // (registered via effect below, mirroring AssessmentHub 'list')

      return (
        <div className="h-full flex flex-col">
          {renderDegradedBanner()}
          <div className="flex-1 min-h-0 flex overflow-hidden">
            <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
              <StandardTable
                columns={inboxColumns}
                data={rows as unknown as Array<Record<string, unknown> & { id: string }>}
                selectedRowId={previewAssignmentId}
                onRowClick={(row) => {
                  setPreviewAssignmentId(String((row as any).id));
                  setPreviewAssignmentOpen(true);
                }}
                onRowDoubleClick={(row) => void openInterviewAssignmentFull(row as any, false)}
                rowDescription={() => null}
                defaultSort={{ columnId: 'dueAt', direction: 'asc' }}
                persistKey="interview.inbox.list"
                selection={{
                  selectedIds: selectedAssignmentIds,
                  onChange: setSelectedAssignmentIds,
                }}
                empty={{
                  icon: Inbox,
                  title: t('interview.hub.noAssignments'),
                  description: t('interview.hub.youHaveNoInterviewAssignments'),
                }}
                rowMenu={(row): StandardRowMenu => {
                  const a = row as unknown as InterviewAssignment;
                  return {
                    primary: [
                      ...(a.status === 'assigned'
                        ? [
                            {
                              id: 'start',
                              label: t('interview.hub.start'),
                              icon: Sparkles,
                              onClick: () => startInterviewAssignment(a),
                            },
                          ]
                        : []),
                      ...(a.status === 'in_progress' && a.sessionId
                        ? [
                            {
                              id: 'continue',
                              label: t('interview.hub.continue'),
                              icon: ChevronRight,
                              onClick: () => void openInterviewAssignmentFull(a, false),
                            },
                          ]
                        : []),
                      ...(a.status === 'sent_back' && a.sessionId
                        ? [
                            {
                              id: 'fix',
                              label: t('interview.hub.fixResubmit'),
                              icon: RotateCcw,
                              onClick: () => void openInterviewAssignmentFull(a, false),
                            },
                          ]
                        : []),
                    ],
                    timeActions: [
                      {
                        id: 'delay',
                        label: t('interview.hub.delay'),
                        icon: Clock,
                        submenu: [1, 3, 7].map((d) => ({
                          id: `delay-${d}`,
                          label:
                            d === 1
                              ? t('interview.hub.plusDaysOne', { count: d })
                              : t('interview.hub.plusDaysOther', { count: d }),
                          icon: Clock,
                          onClick: () => void handleDelayAssignment(a, d),
                        })),
                      },
                    ],
                    universalHandlers: {
                      preview: () => {
                        setPreviewAssignmentId(a.id);
                        setPreviewAssignmentOpen(true);
                      },
                      edit: () => startInterviewAssignment(a),
                      // Brak API archiwizacji dla widoku pracownika (Inbox) — disabled z notą (StandardTable dokłada ją sama).
                    },
                    destructive: {
                      // Brak endpointu delete dla assignmentu — disabled z notą (StandardTable dokłada ją sama).
                    },
                  };
                }}
              />
            </div>

            {selectedRow ? (
              <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
                <StandardPreview
                  title={getAssignmentTitle(selectedRow)}
                  onClose={() => {
                    setPreviewAssignmentId(null);
                    setPreviewAssignmentOpen(false);
                  }}
                  onOpenFull={() => void openInterviewAssignmentFull(selectedRow, false)}
                  meta={{
                    pills: [
                      {
                        label: getAssignmentStatusLabel(selectedRow.status),
                        tone: statusChipTone(selectedRow.status),
                      },
                      {
                        label: `${t('interview.hub.progress')}: ${selectedRow.session?.completenessPercent ?? 0}%`,
                        tone: 'neutral',
                      },
                    ],
                    trailing: (() => {
                      const dtd = getAssignmentDaysToDue(selectedRow.dueAt);
                      return dtd ? (
                        <span className="text-[11px] font-semibold text-c-text-secondary">
                          {dtd.label}
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-c-text-muted">—</span>
                      );
                    })(),
                  }}
                  details={{
                    text:
                      String(
                        previewDetailsOverride ?? selectedRow.template?.description ?? ''
                      ).trim() || t('interview.hub.noDescription'),
                    onCopy: () => {
                      const text = String(
                        previewDetailsOverride ?? selectedRow.template?.description ?? ''
                      ).trim();
                      copyToClipboard(text || getAssignmentTitle(selectedRow));
                    },
                  }}
                  ai={{
                    hints: isPolish
                      ? ['Podsumuj', 'Ryzyka', 'Następne kroki']
                      : ['Summarize', 'Risks', 'Next steps'],
                    disabled: true,
                    disabledTooltip: t('interview.hub.comingSoon'),
                  }}
                  relations={
                    selectedRow.sessionId || selectedRow.session?.id
                      ? [
                          {
                            // FALA 1 (2026-07-27): było `Session: f7847468…`
                            // — obcięty UUID. Czytelna etykieta, ID w tooltipie.
                            label: t('interview.hub.linkedSession', 'Linked session'),
                            title: selectedRow.sessionId || selectedRow.session?.id || undefined,
                            onClick: () => void openInterviewAssignmentFull(selectedRow, false),
                          },
                        ]
                      : []
                  }
                  actions={inboxPreviewActions}
                />
              </aside>
            ) : null}
          </div>
        </div>
      );
    }

    if (activeTab === 'my_assignments') {
      const rows = filteredMyAssignments || [];
      const selected = previewAssignmentId ? rows.find((a) => a.id === previewAssignmentId) : null;
      const selectedItem = selected
        ? ({ ...selected, title: getAssignmentTitle(selected) } as InterviewAssignment & {
            title: string;
          })
        : null;

      return (
        <div className="h-full flex flex-col">
          {renderDegradedBanner()}
          <div className="flex-1 min-h-0 flex flex-col">
            <TableWithPreviewLayout<InterviewAssignment & { title: string }>
              selectedId={previewAssignmentId}
              selectedItem={selectedItem}
              previewOpen={previewAssignmentOpen}
              onSelect={(id) => {
                setPreviewAssignmentId(id);
                setPreviewAssignmentOpen(Boolean(id));
              }}
              onOpenFull={(id) => {
                const a = rows.find((x) => x.id === id);
                if (a) void openInterviewAssignmentFull(a, false);
              }}
              itemIds={rows.map((r) => r.id)}
              getItemById={(id) => {
                const x = rows.find((i) => i.id === id);
                return x ? ({ ...x, title: getAssignmentTitle(x) } as any) : null;
              }}
              renderPreview={(item) => {
                const a = item as InterviewAssignment;
                const progress = a.session?.completenessPercent ?? 0;
                const dtd = getAssignmentDaysToDue(a.dueAt);
                const statusLabel = getAssignmentStatusLabel(a.status);
                const statusColor = getAssignmentStatusColor(a.status);
                const baseDetails = String(a.template?.description || '').trim();
                const detailsText = String(previewDetailsOverride ?? baseDetails).trim();

                return (
                  <InterviewAssignmentPreviewBody
                    assignment={a}
                    isPolish={isPolish}
                    statusLabel={statusLabel}
                    statusColor={statusColor}
                    progress={progress}
                    daysToDue={dtd}
                    detailsText={detailsText || t('interview.hub.noDescription')}
                    detailsMenuOpen={previewDetailsMenuOpen}
                    onToggleDetailsMenu={() => setPreviewDetailsMenuOpen((v) => !v)}
                    onDetailsAction={(action) => {
                      if (action === 'expand') {
                        void (async () => {
                          const text = await runAssignmentAi('expand_details', a);
                          if (text) setPreviewDetailsOverride(text);
                        })();
                      } else if (action === 'summarize') {
                        void (async () => {
                          const text = await runAssignmentAi('summarize_details', a);
                          if (text) setPreviewDetailsOverride(text);
                        })();
                      } else if (action === 'copy') {
                        copyToClipboard(detailsText || getAssignmentTitle(a));
                      }
                    }}
                  />
                );
              }}
              renderPreviewFooter={(item) => {
                const a = item as InterviewAssignment;

                const relations: Array<{ label: string; tone: string; title?: string }> = [];
                if (a.template?.category)
                  relations.push({
                    label: `${t('interview.hub.category')}: ${a.template.category}`,
                    tone: 'text-c-text-secondary',
                  });
                // FALA 1 (2026-07-27): było `Session: 409683b2…` — obcięty
                // UUID. Czytelna etykieta, identyfikator tylko w tooltipie.
                if (a.sessionId || a.session?.id)
                  relations.push({
                    label: t('interview.hub.linkedSession', 'Linked session'),
                    title: a.sessionId || a.session?.id,
                    tone: 'text-blue-600 dark:text-blue-300',
                  });

                return (
                  <InterviewAssignmentPreviewFooter
                    assignment={a}
                    isPolish={isPolish}
                    aiHints={
                      isPolish
                        ? ['Podsumuj', 'Ryzyka', 'Następne kroki']
                        : ['Summarize', 'Risks', 'Next steps']
                    }
                    aiText={previewAiText}
                    aiError={previewAiError}
                    aiMenuOpen={previewAiMenuOpen}
                    onToggleAiMenu={() => setPreviewAiMenuOpen((v) => !v)}
                    onRunAiHint={async (hint) => {
                      const hintMap: Record<string, AssignmentAiIntent> = {
                        Podsumuj: 'summary',
                        Summarize: 'summary',
                        Ryzyka: 'risks',
                        Risks: 'risks',
                        'Następne kroki': 'next_steps',
                        'Next steps': 'next_steps',
                      };
                      const intent = (hintMap[hint] ?? 'summary') as AssignmentAiIntent;
                      setPreviewAiLastIntent(intent);
                      const text = await runAssignmentAi(intent, a);
                      if (!text) setPreviewAiError(t('interview.hub.aiUnavailable'));
                      else {
                        setPreviewAiError(null);
                        setPreviewAiText(text);
                      }
                    }}
                    onRegenerateAi={async () => {
                      const text = await runAssignmentAi(previewAiLastIntent, a);
                      if (!text) setPreviewAiError(t('interview.hub.aiUnavailable'));
                      else {
                        setPreviewAiError(null);
                        setPreviewAiText(text);
                      }
                    }}
                    onCopyAi={
                      previewAiText
                        ? async () => {
                            await copyToClipboard(previewAiText!);
                          }
                        : undefined
                    }
                    onClearAi={() => {
                      setPreviewAiText(null);
                      setPreviewAiError(null);
                    }}
                    relations={relations}
                    onStartAssignment={
                      a.status === 'assigned' ? () => startInterviewAssignment(a) : undefined
                    }
                    onContinueAssignment={
                      a.status === 'in_progress' && (a.sessionId || a.session?.id)
                        ? () => void openInterviewAssignmentFull(a, false)
                        : undefined
                    }
                    onFixAssignment={
                      a.status === 'sent_back' && (a.sessionId || a.session?.id)
                        ? () => void openInterviewAssignmentFull(a, false)
                        : undefined
                    }
                    onApproveAssignment={
                      a.status === 'submitted' ? () => void handleApproveAssignment(a) : undefined
                    }
                    onSendBackAssignment={
                      // Modal, nie strzał na ślepo: odesłanie do poprawy wymaga
                      // POWODU (`handleSendBack` przekazuje go do API), inaczej
                      // wykonawca dostaje zwrot bez informacji, co poprawić.
                      a.status === 'submitted' ? () => handleOpenSendBackModal(a) : undefined
                    }
                    onOpenFull={() => void openInterviewAssignmentFull(a, false)}
                  />
                );
              }}
            >
              {assignmentsViewMode === 'cards' ? (
                <div className="pl-4 pr-1.5 pt-3 pb-4">
                  {rows.length === 0 ? (
                    <div className="py-12 text-center text-sm text-c-text-muted">
                      {t('interview.hub.noAssignments')}
                    </div>
                  ) : (
                    renderAssignmentsGrid(rows, false)
                  )}
                </div>
              ) : (
                <div className="pl-4 pr-1.5 pt-3 pb-4">{renderAssignmentsTable(rows, false)}</div>
              )}
            </TableWithPreviewLayout>
          </div>
        </div>
      );
    }

    if (activeTab === 'managed') {
      const rows = filteredManagedAssignments || [];
      const selected = previewAssignmentId ? rows.find((a) => a.id === previewAssignmentId) : null;
      const selectedItem = selected
        ? ({ ...selected, title: getAssignmentTitle(selected) } as InterviewAssignment & {
            title: string;
          })
        : null;

      return (
        <div className="h-full flex flex-col">
          {renderDegradedBanner()}
          <div className="flex-1 min-h-0 flex flex-col">
            <TableWithPreviewLayout<InterviewAssignment & { title: string }>
              selectedId={previewAssignmentId}
              selectedItem={selectedItem}
              previewOpen={previewAssignmentOpen}
              onSelect={(id) => {
                setPreviewAssignmentId(id);
                setPreviewAssignmentOpen(Boolean(id));
              }}
              onOpenFull={(id) => {
                const a = rows.find((x) => x.id === id);
                if (a) void openInterviewAssignmentFull(a, true);
              }}
              itemIds={rows.map((r) => r.id)}
              getItemById={(id) => {
                const x = rows.find((i) => i.id === id);
                return x ? ({ ...x, title: getAssignmentTitle(x) } as any) : null;
              }}
              renderPreview={(item) => {
                const a = item as InterviewAssignment;
                const progress = a.session?.completenessPercent ?? 0;
                const dtd = getAssignmentDaysToDue(a.dueAt);
                const statusLabel = getAssignmentStatusLabel(a.status);
                const statusColor = getAssignmentStatusColor(a.status);
                const baseDetails = String(a.template?.description || '').trim();
                const detailsText = String(previewDetailsOverride ?? baseDetails).trim();

                return (
                  <InterviewAssignmentPreviewBody
                    assignment={a}
                    isPolish={isPolish}
                    statusLabel={statusLabel}
                    statusColor={statusColor}
                    progress={progress}
                    daysToDue={dtd}
                    detailsText={detailsText || t('interview.hub.noDescription')}
                    detailsMenuOpen={previewDetailsMenuOpen}
                    onToggleDetailsMenu={() => setPreviewDetailsMenuOpen((v) => !v)}
                    onDetailsAction={(action) => {
                      if (action === 'expand') {
                        void (async () => {
                          const text = await runAssignmentAi('expand_details', a);
                          if (text) setPreviewDetailsOverride(text);
                        })();
                      } else if (action === 'summarize') {
                        void (async () => {
                          const text = await runAssignmentAi('summarize_details', a);
                          if (text) setPreviewDetailsOverride(text);
                        })();
                      } else if (action === 'copy') {
                        copyToClipboard(detailsText || getAssignmentTitle(a));
                      }
                    }}
                  />
                );
              }}
              renderPreviewFooter={(item) => {
                const a = item as InterviewAssignment;

                const relations: Array<{ label: string; tone: string; title?: string }> = [];
                if (a.template?.category)
                  relations.push({
                    label: `${t('interview.hub.category')}: ${a.template.category}`,
                    tone: 'text-c-text-secondary',
                  });
                // FALA 1 (2026-07-27): było `Session: 409683b2…` — obcięty
                // UUID. Czytelna etykieta, identyfikator tylko w tooltipie.
                if (a.sessionId || a.session?.id)
                  relations.push({
                    label: t('interview.hub.linkedSession', 'Linked session'),
                    title: a.sessionId || a.session?.id,
                    tone: 'text-blue-600 dark:text-blue-300',
                  });

                return (
                  <InterviewAssignmentPreviewFooter
                    assignment={a}
                    isPolish={isPolish}
                    aiHints={
                      isPolish
                        ? ['Podsumuj', 'Ryzyka', 'Następne kroki']
                        : ['Summarize', 'Risks', 'Next steps']
                    }
                    aiText={previewAiText}
                    aiError={previewAiError}
                    aiMenuOpen={previewAiMenuOpen}
                    onToggleAiMenu={() => setPreviewAiMenuOpen((v) => !v)}
                    onRunAiHint={async (hint) => {
                      const hintMap: Record<string, AssignmentAiIntent> = {
                        Podsumuj: 'summary',
                        Summarize: 'summary',
                        Ryzyka: 'risks',
                        Risks: 'risks',
                        'Następne kroki': 'next_steps',
                        'Next steps': 'next_steps',
                      };
                      const intent = (hintMap[hint] ?? 'summary') as AssignmentAiIntent;
                      setPreviewAiLastIntent(intent);
                      const text = await runAssignmentAi(intent, a);
                      if (!text) setPreviewAiError(t('interview.hub.aiUnavailable'));
                      else {
                        setPreviewAiError(null);
                        setPreviewAiText(text);
                      }
                    }}
                    onRegenerateAi={async () => {
                      const text = await runAssignmentAi(previewAiLastIntent, a);
                      if (!text) setPreviewAiError(t('interview.hub.aiUnavailable'));
                      else {
                        setPreviewAiError(null);
                        setPreviewAiText(text);
                      }
                    }}
                    onCopyAi={
                      previewAiText
                        ? async () => {
                            await copyToClipboard(previewAiText!);
                          }
                        : undefined
                    }
                    onClearAi={() => {
                      setPreviewAiText(null);
                      setPreviewAiError(null);
                    }}
                    relations={relations}
                    onOpenFull={() => void openInterviewAssignmentFull(a, true)}
                    onApproveAssignment={
                      a.status === 'submitted' ? () => handleOpenApproveModal(a) : undefined
                    }
                    onSendBackAssignment={
                      a.status === 'submitted' ? () => handleOpenSendBackModal(a) : undefined
                    }
                  />
                );
              }}
            >
              {assignmentsViewMode === 'cards' ? (
                <div className="pl-4 pr-1.5 pt-3 pb-4">
                  {rows.length === 0 ? (
                    <div className="py-12 text-center text-sm text-c-text-muted">
                      {t('interview.hub.noAssignments')}
                    </div>
                  ) : (
                    renderAssignmentsGrid(rows, true)
                  )}
                </div>
              ) : (
                <div className="pl-4 pr-1.5 pt-3 pb-4">{renderAssignmentsTable(rows, true)}</div>
              )}
            </TableWithPreviewLayout>
          </div>
        </div>
      );
    }

    if (activeTab === 'pending_review') {
      const reviewInsights = pendingReviewInsights;

      if (reviewInsights.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            {renderDegradedBanner()}
            <AlertTriangle size={40} className="text-slate-600 dark:text-navy-600 mb-3" />
            <p className="text-lg font-medium text-c-text">
              {t('interview.hub.noInsightsPendingReview')}
            </p>
            <p className="text-sm text-c-text-muted mt-1">
              {t('interview.hub.allInsightsHaveBeenReviewed')}
            </p>
          </div>
        );
      }

      return (
        <div className="p-4 space-y-2">
          {renderDegradedBanner()}
          {reviewInsights.map((insight) => {
            const findingsCount =
              (insight as any).findings?.length || (insight as any).findingsCount || 0;
            const topicCollections = [
              ...(((insight as any).themes as Array<any>) || []),
              ...(((insight as any).issues as Array<any>) || []),
              ...(((insight as any).opportunities as Array<any>) || []),
            ];
            const crossPerspectiveCount = topicCollections.filter(
              (item) => item?.crossSessionPattern
            ).length;
            const divergenceCount = topicCollections.filter((item) => item?.divergence_note).length;

            return (
              <button
                key={insight.id}
                type="button"
                onClick={() => handleViewInsight(insight)}
                className="w-full text-left p-4 rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-navy-900/70 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Lightbulb size={14} className="text-amber-500 shrink-0" />
                      <span className="text-sm font-medium text-c-text truncate">
                        {insight.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-c-text-muted">
                      {insight.createdAt && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(insight.createdAt).toLocaleDateString(
                            t('interview.hub.enUs', 'en-US')
                          )}
                        </span>
                      )}
                      {findingsCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Target size={12} />
                          {findingsCount} {t('interview.hub.findings')}
                        </span>
                      )}
                      {crossPerspectiveCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {crossPerspectiveCount} {t('interview.hub.crossRole')}
                        </span>
                      )}
                      {divergenceCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-300">
                          <AlertTriangle size={12} />
                          {divergenceCount} {t('interview.hub.divergences')}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {t('interview.hub.inReview2')}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      );
    }

    return null;
  };

  // Triada standard (canon B.24): Esc closes the Inbox (my_assignments, list
  // mode) StandardPreview; [O] shortcut opens the full assignment. Mirrors
  // AssessmentHub 'list' — renderContent() is a plain function, not a
  // component, so this hook must live at top level (rules-of-hooks).
  useEffect(() => {
    if (activeTab !== 'my_assignments' || assignmentsViewMode !== 'list' || !previewAssignmentId)
      return;
    const rows = filteredMyAssignments || [];
    const row = rows.find((a) => a.id === previewAssignmentId);
    if (!row) return;
    const shortcuts = standardPreviewShortcuts({
      informational: [
        {
          id: 'open',
          variant: 'neutral',
          label: 'Open',
          shortcut: 'O',
          onClick: () => void openInterviewAssignmentFull(row, false),
        },
      ],
    });
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        setPreviewAssignmentId(null);
        setPreviewAssignmentOpen(false);
        return;
      }
      const handler = shortcuts[e.key.toUpperCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    activeTab,
    assignmentsViewMode,
    previewAssignmentId,
    filteredMyAssignments,
    openInterviewAssignmentFull,
  ]);

  // Render content based on state
  const renderContent = () => {
    // If a document is selected, show its content
    if (activeDocumentId) {
      return renderDocumentContent();
    }

    // Otherwise show the list
    return renderListContent();
  };

  const handleMainTabChange = useCallback(
    (tab: ModuleTab) => {
      setActiveTab(tab as InterviewTab);
      if (tab === 'managed') {
        setAssignmentStatusFilter('all');
      }
      setActiveDocumentId(null);
    },
    [setActiveDocumentId]
  );

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  // Tab-specific right controls
  const rightControls = useMemo(() => {
    if (activeDocumentId) return null;
    const controls: React.ReactNode[] = [];
    const viewSegmentClass =
      'inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5';
    const viewButtonClass = (active: boolean) =>
      `inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900 ${
        active
          ? 'border border-slate-200/70 bg-white/80 text-slate-900 dark:border-white/[0.06] dark:bg-navy-800 dark:text-slate-100'
          : 'text-slate-600 hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/[0.06]'
      }`;

    if (activeTab === 'templates') {
      controls.push(
        <div key="area-filter" className="relative">
          <button
            type="button"
            onClick={() => setIsTemplateAreaFilterOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 pr-3 pl-3 h-9 rounded-full text-xs font-medium border bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.06] text-c-text-secondary hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98]"
            title={t('interview.hub.questionArea')}
          >
            <span className={templateAreaTagFilter.length > 0 ? 'text-c-accent' : ''}>
              {templateAreaTagFilter.length > 0
                ? `${t('interview.hub.area')}: ${templateAreaTagFilter.length}`
                : t('interview.hub.areaAll')}
            </span>
            <ChevronDown size={14} />
          </button>
          {isTemplateAreaFilterOpen ? (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsTemplateAreaFilterOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-50 w-64 max-h-80 overflow-auto rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-c-surface shadow-lg p-2">
                <button
                  type="button"
                  onClick={() => setTemplateAreaTagFilter([])}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-c-text-muted hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded-lg"
                >
                  {t('interview.hub.clearFilter')}
                </button>
                {INTERVIEW_TEMPLATE_AREA_TAG_OPTIONS.map((tag) => {
                  const checked = templateAreaTagFilter.includes(tag);
                  return (
                    <label
                      key={tag}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer text-sm text-c-text-secondary"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setTemplateAreaTagFilter((prev) =>
                            checked ? prev.filter((item) => item !== tag) : [...prev, tag]
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-c-info focus:ring-c-focus"
                      />
                      <span>{getTemplateAreaTagLabel(tag, t)}</span>
                    </label>
                  );
                })}
              </div>
            </>
          ) : null}
        </div>,
        <div key="source-filter" className="relative">
          <select
            value={templateSourceFilter}
            onChange={(e) => setTemplateSourceFilter(e.target.value as TemplateSourceFilter)}
            className="appearance-none pr-9 pl-3 h-9 rounded-full text-xs font-medium border bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.06] text-c-text-secondary hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
            title={t('interview.hub.templateSource')}
          >
            <option value="all">{t('interview.hub.sourceAll')}</option>
            <option value="application">{t('interview.hub.application')}</option>
            <option value="organization">{t('interview.hub.organization')}</option>
            <option value="user">{t('interview.hub.user')}</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-c-text-muted"
          />
        </div>,
        <div
          key="templates-view"
          className={viewSegmentClass}
          role="radiogroup"
          aria-label={t('interview.hub.templatesViewMode')}
        >
          <button
            type="button"
            onClick={() => setTemplatesViewMode('table')}
            className={viewButtonClass(templatesViewMode === 'table')}
            title={t('interview.hub.table')}
            role="radio"
            aria-checked={templatesViewMode === 'table'}
          >
            <List size={15} />
          </button>
          <button
            type="button"
            onClick={() => setTemplatesViewMode('cards')}
            className={viewButtonClass(templatesViewMode === 'cards')}
            title={t('interview.hub.cards')}
            role="radio"
            aria-checked={templatesViewMode === 'cards'}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      );
    }

    if (activeTab === 'insights') {
      controls.push(
        <div
          key="insights-view"
          className={viewSegmentClass}
          role="radiogroup"
          aria-label={t('interview.hub.viewMode')}
        >
          <button
            onClick={() => setInsightsViewMode('flat')}
            className={viewButtonClass(insightsViewMode === 'flat')}
            title={t('interview.hub.list')}
            role="radio"
            aria-checked={insightsViewMode === 'flat'}
          >
            <LayoutList size={15} />
          </button>
          <button
            onClick={() => setInsightsViewMode('report')}
            className={viewButtonClass(insightsViewMode === 'report')}
            title={t('interview.hub.byReport')}
            role="radio"
            aria-checked={insightsViewMode === 'report'}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      );
    }

    if (activeTab === 'sessions') {
      controls.push(
        <div
          key="sessions-view"
          className={viewSegmentClass}
          role="radiogroup"
          aria-label={t('interview.hub.sessionsViewMode')}
        >
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={viewButtonClass(viewMode === 'table')}
            title={t('interview.hub.list')}
            role="radio"
            aria-checked={viewMode === 'table'}
          >
            <LayoutList size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={viewButtonClass(viewMode === 'grid')}
            title={t('interview.hub.cards')}
            role="radio"
            aria-checked={viewMode === 'grid'}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      );
    }

    if (activeTab === 'my_assignments' || activeTab === 'managed') {
      controls.push(
        <div
          key="assignments-view"
          className={viewSegmentClass}
          role="radiogroup"
          aria-label={t('interview.hub.viewMode')}
        >
          <button
            onClick={() => setAssignmentsViewMode('list')}
            className={viewButtonClass(assignmentsViewMode === 'list')}
            title={t('interview.hub.list')}
            role="radio"
            aria-checked={assignmentsViewMode === 'list'}
          >
            <LayoutList size={16} />
          </button>
          <button
            onClick={() => setAssignmentsViewMode('cards')}
            className={viewButtonClass(assignmentsViewMode === 'cards')}
            title={t('interview.hub.cards')}
            role="radio"
            aria-checked={assignmentsViewMode === 'cards'}
          >
            <LayoutGrid size={16} />
          </button>
        </div>
      );
    }

    if (activeTab === 'initiatives') {
      controls.push(
        <div
          key="initiatives-view"
          className={viewSegmentClass}
          role="radiogroup"
          aria-label={t('interview.hub.initiativesViewMode')}
        >
          <button
            type="button"
            onClick={() => setInitiativesViewMode('table')}
            className={viewButtonClass(initiativesViewMode === 'table')}
            title={t('interview.hub.list')}
            role="radio"
            aria-checked={initiativesViewMode === 'table'}
          >
            <LayoutList size={15} />
          </button>
          <button
            type="button"
            onClick={() => setInitiativesViewMode('cards')}
            className={viewButtonClass(initiativesViewMode === 'cards')}
            title={t('interview.hub.cards')}
            role="radio"
            aria-checked={initiativesViewMode === 'cards'}
          >
            <LayoutGrid size={15} />
          </button>
        </div>
      );
    }

    return controls.length > 0 ? <div className="flex items-center gap-1.5">{controls}</div> : null;
  }, [
    activeDocumentId,
    activeTab,
    isPolish,
    templateAreaTagFilter,
    isTemplateAreaFilterOpen,
    templateSourceFilter,
    templatesViewMode,
    insightsViewMode,
    sessionStatusFilter,
    viewMode,
    assignmentsViewMode,
    initiativesViewMode,
  ]);

  // Tab-specific primary CTA
  const tabPrimaryCta = useMemo(() => {
    if (activeDocumentId) return null;
    if (activeTab === 'sessions') {
      return (
        <button
          onClick={handleNewSession}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
        >
          <span>{t('interview.hub.newSession')}</span>
        </button>
      );
    }
    if (activeTab === 'templates' && canAssign) {
      return (
        <button
          onClick={handleNewTemplate}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
        >
          <span>{t('interview.hub.newTemplate2')}</span>
        </button>
      );
    }
    if (activeTab === 'insights') {
      return (
        <button
          onClick={() => {
            if (!canCreateInsights) return;
            setSelectedSessionsForInsight([]);
            setShowInsightModal(true);
          }}
          disabled={!canCreateInsights}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
        >
          <span>{t('interview.hub.newInsight')}</span>
        </button>
      );
    }
    if (activeTab === 'initiatives') {
      return (
        <button
          type="button"
          data-testid="interview-add-initiatives-cta"
          onClick={() => {
            if (!canCreateInsights) return;
            setShowInitiativeWizard(true);
          }}
          disabled={!canCreateInsights}
          title={
            canCreateInsights
              ? t('interview.hub.runInitiativeWizardWithInterview')
              : t('interview.hub.noPermissionRequestInitiativeCreate')
          }
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
        >
          <span>{t('interview.hub.addInitiatives')}</span>
        </button>
      );
    }
    if ((activeTab === 'my_assignments' || activeTab === 'managed') && canAssign) {
      return (
        <button
          onClick={() => {
            setSelectedTemplateForAssign(null);
            setShowAssignModal(true);
          }}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-navy-900 px-4 text-sm font-medium text-white transition-colors hover:bg-navy-800 dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
        >
          <span>{t('interview.hub.assign')}</span>
        </button>
      );
    }
    return null;
  }, [
    activeDocumentId,
    activeTab,
    isPolish,
    canAssign,
    canCreateInsights,
    handleNewSession,
    handleNewTemplate,
  ]);

  // D-01 (Piotr, OBR-28 2026-07-27): uniwersalny „+ Nowy" launcher USUNIĘTY —
  // w Menu 2 zostaje WYŁĄCZNIE kontekstowe CTA zakładki (`tabPrimaryCta`):
  // Assign (Inbox/Assigned) · New session · New template · New insight ·
  // Add initiatives. Kanon: maks. JEDEN primary CTA, kontekstowy.
  const primaryCta = tabPrimaryCta ? (
    <div className="flex items-center gap-2">{tabPrimaryCta}</div>
  ) : null;

  // Command row content (from renderCommandRow, minus search/dynamic tabs which ModuleHub handles)
  const commandRowContent = useMemo(() => {
    if (activeDocumentId) return null;
    return renderCommandRow();
  }, [activeDocumentId, activeTab, renderCommandRow]);

  const hasBulkSelection = useMemo(
    () =>
      selectedAssignmentIds.size > 0 ||
      selectedSessionIds.size > 0 ||
      selectedTemplateIds.size > 0 ||
      selectedInsightIds.size > 0 ||
      selectedInitiativeIds.size > 0,
    [
      selectedAssignmentIds,
      selectedSessionIds,
      selectedTemplateIds,
      selectedInsightIds,
      selectedInitiativeIds,
    ]
  );

  return (
    <div className="h-full" data-testid="interview-hub">
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab as ModuleTab}
        onTabChange={handleMainTabChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openItems={openDocuments}
        activeItemId={activeDocumentId}
        onSelectItem={setActiveDocumentId}
        onCloseItem={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        filterControls={rightControls}
        primaryCtaContent={primaryCta}
        commandRowContent={commandRowContent}
        forceCommandRow={hasBulkSelection}
        viewModes={['table']}
        showTabCounts={false}
      >
        {/* D-03 — top-level numbered pipeline stepper (flag-gated, default OFF).
            Hidden while a document/detail is open (activeDocumentId) so it doesn't
            compete with the in-document chrome. */}
        {isInterviewPipelineStepperEnabled() && !activeDocumentId && pipelineSteps.length > 0 ? (
          <InterviewPipelineStepper
            steps={pipelineSteps}
            activeTab={activeTab as ModuleTab}
            onStepChange={handleMainTabChange}
          />
        ) : null}
        <div className="h-full min-h-0 overflow-hidden">{renderContent()}</div>
      </StandardModuleBar>

      <InitiativeWizardModal
        isOpen={showInitiativeWizard}
        language={isPolish ? 'pl' : 'en'}
        projectId={currentProjectId || undefined}
        existingInitiatives={interviewInitiatives.map((initiative) => ({
          id: initiative.id,
          name: initiative.name || initiative.title || initiative.id,
          title: initiative.title || initiative.name,
          status: String(initiative.status || 'DRAFT') as any,
        }))}
        initialMode="generate_from_evidence"
        initialBusinessPriorities={['quality', 'automation', 'governance']}
        initialTargetCount={5}
        initialTimeHorizon="90_days"
        initialRiskAppetite="balanced"
        initialManualNotes={initiativeWizardManualNotes}
        initialSourceBasket={initiativeWizardSourceBasket}
        creationSourceType="interview_insight"
        creationSourceId={null}
        onClose={() => {
          setShowInitiativeWizard(false);
          void loadInterviewInitiatives();
        }}
        onCreated={async (created) => {
          if (created.length > 0) {
            setInterviewInitiatives((prev) => {
              const byId = new Map(prev.map((initiative) => [initiative.id, initiative]));
              created.forEach((initiative) => {
                byId.set(initiative.id, {
                  id: initiative.id,
                  name: initiative.name,
                  title: initiative.name,
                  description: initiative.description || initiative.summary || '',
                  status: initiative.status,
                  priority: initiative.priority,
                  sourceType: (initiative as any).sourceType || 'interview_insight',
                  sourceId: (initiative as any).sourceId || initiative.id,
                  createdAt: initiative.createdAt,
                  updatedAt: initiative.updatedAt,
                });
              });
              return Array.from(byId.values());
            });
            setActiveTab('initiatives');
            setSelectedInterviewInitiativeId(created[0].id);
          }
          await loadInterviewInitiatives();
        }}
      />

      {/* Assign Interview Modal */}
      <AssignInterviewModal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedTemplateForAssign(null);
        }}
        onSuccess={async () => {
          // Refresh assignments after successful creation
          try {
            const [myRes, managedRes, overdueRes] = await Promise.all([
              loadMyAssignments(),
              canViewManaged ? loadManagedAssignments() : Promise.resolve([]),
              canViewOverdue ? loadOverdueAssignments() : Promise.resolve([]),
            ]);
            setMyAssignments(myRes);
            setManagedAssignments(Array.isArray(managedRes) ? managedRes : []);
            setOverdueAssignments(Array.isArray(overdueRes) ? overdueRes : []);
            setSelectedTemplateForAssign(null);
          } catch (error) {
            console.error('[InterviewHub] Failed to refresh assignments:', error);
          }
        }}
        preselectedTemplateId={selectedTemplateForAssign?.id}
      />

      {/* Reminder Modal */}
      {showReminderModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-c-border-subtle">
              <h2 className="text-lg font-semibold text-c-text">
                {t('interview.hub.sendReminder2')}
              </h2>
              <button
                onClick={() => {
                  setShowReminderModal(false);
                  setSelectedAssignment(null);
                }}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-c-text-muted hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-c-text-muted mb-4">
                {t('interview.hub.confirmSendReminderTo', {
                  name: selectedAssignment.assignee?.name || t('interview.hub.theUserFallback'),
                })}
              </p>
              <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 mb-4">
                <div className="text-sm text-c-text font-medium">
                  {selectedAssignment.template?.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {selectedAssignment.dueAt
                    ? `${t('interview.hub.due3')} ${formatListDate(selectedAssignment.dueAt)}`
                    : t('interview.hub.noDueDate')}
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowReminderModal(false);
                    setSelectedAssignment(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                >
                  {t('interview.hub.cancel')}
                </button>
                <button
                  onClick={async () => {
                    try {
                      await V8InterviewApi.remindAssignment(selectedAssignment.id).catch(() =>
                        Api.post(`/interview/assignments/${selectedAssignment.id}/remind`, {})
                      );
                      toast.success(t('interview.hub.reminderSent'));
                      setShowReminderModal(false);
                      setSelectedAssignment(null);
                    } catch (error: any) {
                      console.error('[InterviewHub] Failed to send reminder from modal:', error);
                      safeToastError(error, t('interview.hub.failedToSendReminder'), isPolish);
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
                >
                  <Bell size={16} className="inline mr-2" />
                  {t('interview.hub.send')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* #8b — Permanent delete confirmation (type-to-confirm). Only reachable
          from the Trash view; the backend rejects deletes on non-trashed sessions. */}
      {sessionDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-c-border-subtle">
              <h2 className="text-lg font-semibold text-c-text">
                {t('interview.hub.deleteSessionForever')}
              </h2>
              <button
                onClick={() => {
                  setSessionDeleteTarget(null);
                  setSessionDeleteConfirmText('');
                }}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-c-text-muted hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-c-text-muted mb-4">
                {t('interview.hub.thisCannotBeUndoneThe')}
              </p>
              <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 mb-4">
                <div className="text-sm text-c-text font-medium truncate">
                  {sessionDeleteTarget.name || 'Discovery Interview'}
                </div>
              </div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                <>
                  {t('interview.hub.typeDeletePrefix')}{' '}
                  <span className="font-semibold text-c-danger">DELETE</span>
                  {t('interview.hub.typeDeleteSuffix')}
                </>
              </label>
              <input
                type="text"
                value={sessionDeleteConfirmText}
                onChange={(e) => setSessionDeleteConfirmText(e.target.value)}
                autoFocus
                placeholder="DELETE"
                className="w-full px-3 py-2 mb-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-danger/40"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSessionDeleteTarget(null);
                    setSessionDeleteConfirmText('');
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                >
                  {t('interview.hub.cancel')}
                </button>
                <button
                  onClick={handleConfirmDeleteSession}
                  disabled={
                    sessionDeleteConfirmText.trim().toUpperCase() !== 'DELETE' ||
                    sessionLifecycleBusy
                  }
                  className="flex-1 px-4 py-2 rounded-lg bg-c-danger hover:bg-c-danger/90 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Trash2 size={16} className="inline mr-2" />
                  {t('interview.hub.deleteForever')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Back Modal */}
      {showSendBackModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-c-border-subtle">
              <h2 className="text-lg font-semibold text-c-text">
                {t('interview.hub.sendBackForRevision')}
              </h2>
              <button
                onClick={() => {
                  setShowSendBackModal(false);
                  setSelectedAssignment(null);
                }}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-c-text-muted hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const reason = formData.get('reason') as string;
                handleSendBack(reason);
              }}
              className="p-4"
            >
              <p className="text-sm text-c-text-muted mb-4">
                {t('interview.hub.provideAReasonForSending')}
              </p>
              <textarea
                name="reason"
                required
                rows={4}
                placeholder={t('interview.hub.describeWhatNeedsToBe')}
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-c-text placeholder-slate-500 focus:border-c-focus-solid focus:ring-1 focus:ring-c-focus transition resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSendBackModal(false);
                    setSelectedAssignment(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                >
                  {t('interview.hub.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-c-danger hover:bg-c-danger/90 text-white font-medium transition-colors"
                >
                  <RotateCcw size={16} className="inline mr-2" />
                  {t('interview.hub.sendBack4')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* #11b — Manager Approve flow with AI snapshot. Shows AI score, weak/short
          answers, and a 1-click "Send back" prefilled from the AI assessment.
          Degrades gracefully when no AI assessment exists. */}
      {showApproveModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[88vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-c-border-subtle">
              <h2 className="text-lg font-semibold text-c-text flex items-center gap-2">
                <Check size={18} className="text-emerald-500" />
                {t('interview.hub.approveInterview')}
              </h2>
              <button
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedAssignment(null);
                }}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-c-text-muted hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto">
              <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 mb-4">
                <div className="text-sm text-c-text font-medium">
                  {selectedAssignment.template?.name || 'Interview'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {selectedAssignment.assignee?.name ||
                    selectedAssignment.assignee?.email ||
                    t('interview.hub.unknown')}
                </div>
              </div>

              {/* AI snapshot panel */}
              {(() => {
                const ai = selectedAssignment.aiReview;
                if (!ai || (typeof ai.overallScore !== 'number' && !ai.weakAnswerMap?.length)) {
                  return (
                    <div className="rounded-lg border border-c-border-subtle bg-white dark:bg-navy-800/60 p-3 mb-4 text-sm text-c-text-muted flex items-center gap-2">
                      <Sparkles size={14} className="text-slate-400" />
                      {t('interview.hub.aiAssessmentNotAvailableFor')}
                    </div>
                  );
                }
                const pct =
                  typeof ai.overallScore === 'number'
                    ? Math.round(ai.overallScore <= 1 ? ai.overallScore * 100 : ai.overallScore)
                    : null;
                const weak = (ai.weakAnswerMap || []).filter(
                  (w) => w.verdict === 'needs_improvement' || w.verdict === 'insufficient'
                );
                return (
                  <div className="rounded-lg border border-c-info/70 dark:border-c-info/20 bg-c-info/60 dark:bg-c-info/[0.08] p-3 mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-c-info dark:text-c-info flex items-center gap-1.5">
                        <Gauge size={14} />
                        {t('interview.hub.aiAssessment')}
                      </span>
                      {pct !== null ? (
                        <span
                          className={`text-sm font-bold ${
                            pct >= 75
                              ? 'text-emerald-600 dark:text-emerald-300'
                              : pct >= 50
                                ? 'text-amber-600 dark:text-amber-300'
                                : 'text-c-danger'
                          }`}
                        >
                          {pct}/100
                        </span>
                      ) : null}
                    </div>
                    {weak.length > 0 ? (
                      <div className="mt-2.5">
                        <div className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-1">
                          {t('interview.hub.weakShortAnswers')}
                        </div>
                        <ul className="space-y-1 max-h-40 overflow-auto">
                          {weak.slice(0, 8).map((w) => (
                            <li
                              key={w.key}
                              className="text-xs text-c-text-secondary flex items-start gap-1.5"
                            >
                              <AlertTriangle size={11} className="mt-0.5 shrink-0 text-amber-500" />
                              <span className="min-w-0">
                                <span className="font-medium">{w.label}</span>
                                {w.feedback ? (
                                  <span className="text-c-text-muted"> — {w.feedback}</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-300">
                        {t('interview.hub.noWeakAnswersFlaggedBy')}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => {
                    // 1-click Send back, prefilled from the AI assessment.
                    setShowApproveModal(false);
                    handleOpenSendBackModal(selectedAssignment);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-c-danger/40 text-c-danger hover:bg-c-danger/[0.08] font-medium transition-colors"
                >
                  <RotateCcw size={16} className="inline mr-2" />
                  {t('interview.hub.sendBack3')}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const a = selectedAssignment;
                    setShowApproveModal(false);
                    setSelectedAssignment(null);
                    await handleApproveAssignment(a);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
                >
                  <Check size={16} className="inline mr-2" />
                  {t('interview.hub.approve')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* #7b — Change due date modal (wired to manageAssignment, mode 'update'). */}
      {showDueDateModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-c-border-subtle">
              <h2 className="text-lg font-semibold text-c-text flex items-center gap-2">
                <CalendarClock size={18} className="text-c-info" />
                {t('interview.hub.changeDueDate')}
              </h2>
              <button
                onClick={() => {
                  setShowDueDateModal(false);
                  setSelectedAssignment(null);
                }}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-c-text-muted hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 mb-4">
                <div className="text-sm text-c-text font-medium">
                  {selectedAssignment.template?.name || 'Interview'}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {selectedAssignment.assignee?.name ||
                    selectedAssignment.assignee?.email ||
                    t('interview.hub.unknown')}
                </div>
              </div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                {t('interview.hub.newDueDate')}
              </label>
              <input
                type="date"
                value={dueDateDraft}
                onChange={(e) => setDueDateDraft(e.target.value)}
                className="w-full px-3 py-2 mb-4 rounded-lg bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-sm text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowDueDateModal(false);
                    setSelectedAssignment(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
                >
                  {t('interview.hub.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleChangeDueDate}
                  disabled={manageAssignmentBusy}
                  className="flex-1 px-4 py-2 rounded-lg bg-navy-900 hover:bg-navy-800 text-white dark:bg-slate-50 dark:text-navy-950 dark:hover:bg-slate-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {manageAssignmentBusy ? (
                    <Loader2 size={16} className="inline mr-2 animate-spin" />
                  ) : (
                    <CalendarClock size={16} className="inline mr-2" />
                  )}
                  {t('interview.hub.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal (Placeholder) */}
      {showAnalytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-c-border-subtle">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 size={20} className="text-c-info" />
                {t('interview.hub.interviewAnalytics')}
              </h2>
              <button
                onClick={() => setShowAnalytics(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-c-text-muted hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 dark:bg-navy-800 border border-c-border-subtle rounded-xl p-4">
                  <div className="text-2xl font-bold text-white">{sessions.length}</div>
                  <div className="text-sm text-c-text-muted">
                    {t('interview.hub.totalSessions')}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-navy-800 border border-c-border-subtle rounded-xl p-4">
                  <div className="text-2xl font-bold text-emerald-400">
                    {
                      sessions.filter((s) =>
                        ['approved', 'completed'].includes(getSessionWorkflowStatus(s))
                      ).length
                    }
                  </div>
                  <div className="text-sm text-c-text-muted">{t('interview.hub.approved')}</div>
                </div>
                <div className="bg-slate-50 dark:bg-navy-800 border border-c-border-subtle rounded-xl p-4">
                  <div className="text-2xl font-bold text-blue-400">
                    {sessions.filter((s) => getSessionWorkflowStatus(s) === 'in_progress').length}
                  </div>
                  <div className="text-sm text-c-text-muted">{t('interview.hub.inProgress2')}</div>
                </div>
                <div className="bg-slate-50 dark:bg-navy-800 border border-c-border-subtle rounded-xl p-4">
                  <div className="text-2xl font-bold text-amber-400">{insights.length}</div>
                  <div className="text-sm text-c-text-muted">{t('interview.hub.aiInsights2')}</div>
                </div>
              </div>

              {/* Assignment Stats */}
              <div className="bg-navy-800 border border-c-border-subtle rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-c-text mb-4">
                  {t('interview.hub.assignmentStatistics')}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xl font-bold text-blue-400">
                      {managedAssignments.length}
                    </div>
                    <div className="text-xs text-slate-500">{t('interview.hub.managed')}</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-c-danger">
                      {overdueAssignments.length}
                    </div>
                    <div className="text-xs text-slate-500">{t('interview.hub.overdue2')}</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-emerald-400">
                      {managedAssignments.filter((a) => a.status === 'completed').length}
                    </div>
                    <div className="text-xs text-slate-500">{t('interview.hub.completed2')}</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-amber-400">
                      {managedAssignments.filter((a) => a.status === 'submitted').length}
                    </div>
                    <div className="text-xs text-slate-500">{t('interview.hub.pendingReview')}</div>
                  </div>
                </div>
              </div>

              {/* Template Usage */}
              <div className="bg-slate-50 dark:bg-navy-800 border border-c-border-subtle rounded-xl p-4">
                <h3 className="text-sm font-semibold text-c-text mb-4">
                  {t('interview.hub.templateUsage')}
                </h3>
                <div className="space-y-3">
                  {templates.slice(0, 5).map((template) => (
                    <div key={template.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-400" />
                        <span className="text-sm text-slate-600">{template.name}</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {template.questionCount} {t('interview.hub.questions2')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-center text-slate-500 text-sm mt-6">
                {t('interview.hub.visitTheAnalyticsTabFor')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Generate Insight Modal - Advanced Creator */}
      <InsightCreatorModal
        isOpen={showInsightModal}
        onClose={() => {
          setShowInsightModal(false);
          setSelectedSessionsForInsight([]);
        }}
        onSuccess={async () => {
          // Refresh insights after generation
          const insightsRes = await V8InterviewApi.listInsights()
            .then((r) => r.insights)
            .catch(() => Api.get('/interview/insights').catch(() => []));
          setInsights(Array.isArray(insightsRes) ? insightsRes : []);
        }}
      />
    </div>
  );
};

/**
 * Test-only surface for the hub's pure routing helpers. Not part of the public
 * component API — consumed by tests/components/Interview/InterviewHub.test.tsx.
 */
export const __private__ = {
  isInterviewTab,
  resolveInterviewTabFromSearchParams,
};

export default InterviewHub;
