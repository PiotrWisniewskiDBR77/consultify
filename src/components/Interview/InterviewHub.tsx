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
  ArrowRight,
  BarChart3,
  Bell,
  Brain,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Columns3,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FilePlus,
  FileText,
  Grid3X3,
  Inbox,
  LayoutGrid,
  LayoutList,
  Lightbulb,
  List,
  Loader2,
  MessageSquare,
  Minus,
  MoreVertical,
  Rocket,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useInterviewPermissions } from '@/hooks/useInterviewPermissions';
import { Api, shouldAllowDemoData } from '@/services/api';
import { V8InterviewApi } from '@/services/api/v8/interview';
import { useAppStore } from '@/store/useAppStore';

import { getSafeInterviewErrorMessage } from './interviewErrorCopy';

// Helper function to safely display error messages
const safeToastError = (error: any, defaultMessage: string, _isPolish: boolean) => {
  toast.error(getSafeInterviewErrorMessage(error, defaultMessage));
};

import { type GridItem, GridView } from '@/components/shared/ModuleHub/GridView';
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
import { Modal } from '@/components/ui/primitives/Modal';
import {
  type ColumnDef,
  ColumnResizer,
  type ColumnWidths,
  type TableFilters,
} from '@/components/ui/ResizableTable';
import { FilterDropdown } from '@/components/ui/ResizableTable/FilterDropdown';

import {
  type FilterChip,
  ModuleHub,
  type ModuleTab,
  type OpenDocument as SharedOpenDocument,
  type ViewMode,
} from '../shared/ModuleHub';
import { useModuleOpenDocuments } from '../shared/ModuleHub/useModuleOpenDocuments';
import { RowActionsMenu } from '../shared/RowActionsMenu';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { AssignInterviewModal } from './AssignInterviewModal';
import { InsightCreatorModal } from './InsightCreatorModal';
import { InsightViewer } from './InsightViewer';
import {
  InterviewAssignmentPreviewBody,
  InterviewAssignmentPreviewFooter,
} from './InterviewAssignmentPreview';
import { createInterviewDemoDataset, isInterviewDemoId } from './interviewDemoData';
import {
  InterviewInsightPreviewBody,
  InterviewInsightPreviewFooter,
} from './InterviewInsightPreview';
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

const INTERVIEW_INBOX_TABLE_VIEW_STORAGE_KEY = 'consultify-interview-inbox-table-view';
const INTERVIEW_INBOX_ROW_DESCRIPTION_STORAGE_KEY =
  'consultify-interview-inbox-show-row-description';
const INTERVIEW_MANAGED_ASSIGNMENTS_TABLE_VIEW_STORAGE_KEY =
  'consultify-interview-managed-assignments-table-view';
const INTERVIEW_MANAGED_ASSIGNMENTS_ROW_DESCRIPTION_STORAGE_KEY =
  'consultify-interview-managed-assignments-show-row-description';
const INTERVIEW_SESSIONS_TABLE_VIEW_STORAGE_KEY = 'consultify-interview-sessions-table-view';
const INTERVIEW_SESSIONS_ROW_DESCRIPTION_STORAGE_KEY =
  'consultify-interview-sessions-show-row-description';
const INTERVIEW_INSIGHTS_TABLE_VIEW_STORAGE_KEY = 'consultify-interview-insights-table-view';
const INTERVIEW_INSIGHTS_ROW_DESCRIPTION_STORAGE_KEY =
  'consultify-interview-insights-show-row-description';
const INTERVIEW_TEMPLATES_TABLE_VIEW_STORAGE_KEY = 'consultify-interview-templates-table-view';
const INTERVIEW_INITIATIVES_TABLE_VIEW_STORAGE_KEY = 'consultify-interview-initiatives-table-view';
const INTERVIEW_INITIATIVES_ROW_DESCRIPTION_STORAGE_KEY =
  'consultify-interview-initiatives-show-row-description';
const INTERVIEW_CREATE_SESSION_TOAST_ID = 'interview-create-session';

const INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_HIDDEN_COLUMNS: string[] = [];
const INTERVIEW_TEMPLATES_TABLE_DEFAULT_HIDDEN_COLUMNS: string[] = [];
const INTERVIEW_INITIATIVES_TABLE_DEFAULT_HIDDEN_COLUMNS: string[] = [];
const INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_WIDTHS: ColumnWidths = {
  select: 44,
  template: 420,
  assignee: 190,
  status: 140,
  progress: 170,
  due: 170,
  actions: 56,
};
const INTERVIEW_ASSIGNMENTS_TABLE_RESIZE_BOUNDS: Record<
  string,
  { minWidth: number; maxWidth: number }
> = {
  select: { minWidth: 44, maxWidth: 44 },
  template: { minWidth: 280, maxWidth: 680 },
  assignee: { minWidth: 150, maxWidth: 280 },
  status: { minWidth: 120, maxWidth: 220 },
  progress: { minWidth: 140, maxWidth: 260 },
  due: { minWidth: 140, maxWidth: 260 },
  actions: { minWidth: 52, maxWidth: 72 },
};
const INTERVIEW_SESSIONS_TABLE_DEFAULT_WIDTHS: ColumnWidths = {
  select: 44,
  name: 430,
  status: 150,
  progress: 170,
  date: 210,
  actions: 56,
};
const INTERVIEW_SESSIONS_TABLE_RESIZE_BOUNDS: Record<
  string,
  { minWidth: number; maxWidth: number }
> = {
  select: { minWidth: 44, maxWidth: 44 },
  name: { minWidth: 300, maxWidth: 680 },
  status: { minWidth: 120, maxWidth: 220 },
  progress: { minWidth: 140, maxWidth: 260 },
  date: { minWidth: 170, maxWidth: 320 },
  actions: { minWidth: 52, maxWidth: 72 },
};
const INTERVIEW_INSIGHTS_TABLE_DEFAULT_WIDTHS: ColumnWidths = {
  select: 44,
  title: 430,
  type: 150,
  status: 140,
  source: 130,
  date: 140,
  actions: 56,
};
const INTERVIEW_INSIGHTS_TABLE_RESIZE_BOUNDS: Record<
  string,
  { minWidth: number; maxWidth: number }
> = {
  select: { minWidth: 44, maxWidth: 44 },
  title: { minWidth: 300, maxWidth: 680 },
  type: { minWidth: 120, maxWidth: 240 },
  status: { minWidth: 120, maxWidth: 220 },
  source: { minWidth: 110, maxWidth: 220 },
  date: { minWidth: 120, maxWidth: 220 },
  actions: { minWidth: 52, maxWidth: 72 },
};
const INTERVIEW_INITIATIVES_TABLE_DEFAULT_WIDTHS: ColumnWidths = {
  select: 44,
  title: 430,
  status: 150,
  priority: 130,
  source: 140,
  date: 140,
  actions: 56,
};
const INTERVIEW_INITIATIVES_TABLE_RESIZE_BOUNDS: Record<
  string,
  { minWidth: number; maxWidth: number }
> = {
  select: { minWidth: 44, maxWidth: 44 },
  title: { minWidth: 300, maxWidth: 700 },
  status: { minWidth: 120, maxWidth: 240 },
  priority: { minWidth: 110, maxWidth: 200 },
  source: { minWidth: 120, maxWidth: 240 },
  date: { minWidth: 120, maxWidth: 220 },
  actions: { minWidth: 52, maxWidth: 72 },
};

function loadInterviewAssignmentsHiddenColumns(storageKey: string, showAssignee: boolean) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [...INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_HIDDEN_COLUMNS];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];

    // Always-visible columns
    const sanitized = new Set(list);
    sanitized.delete('template');
    sanitized.delete('actions');

    // Columns not present in view
    if (!showAssignee) sanitized.delete('assignee');

    return Array.from(sanitized);
  } catch {
    return [...INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_HIDDEN_COLUMNS];
  }
}

function loadHiddenColumns(storageKey: string, defaults: string[], alwaysVisible: string[] = []) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [...defaults];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    const sanitized = new Set(list);
    alwaysVisible.forEach((id) => sanitized.delete(id));
    return Array.from(sanitized);
  } catch {
    return [...defaults];
  }
}

function saveHiddenColumns(storageKey: string, hiddenColumns: string[]) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify(Array.from(new Set(hiddenColumns.filter((x) => typeof x === 'string'))))
    );
  } catch {
    /* ignore */
  }
}

function loadBooleanSetting(storageKey: string, defaultValue: boolean) {
  try {
    const raw = localStorage.getItem(storageKey);
    return raw === null ? defaultValue : raw === 'true';
  } catch {
    return defaultValue;
  }
}

function saveBooleanSetting(storageKey: string, value: boolean) {
  try {
    localStorage.setItem(storageKey, String(value));
  } catch {
    /* ignore */
  }
}

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

function buildInterviewInitiativesFromInsights(
  sourceInsights: InterviewInsight[]
): InterviewInitiativeDraft[] {
  const statusCycle = ['DRAFT', 'PENDING_REVIEW', 'PROMOTED'] as const;
  const priorityCycle = ['high', 'medium', 'low'] as const;

  return sourceInsights.slice(0, 6).map((insight, index) => {
    const insightText = String(insight.description || insight.content || '').trim();
    const description =
      insightText ||
      `Derived initiative candidate from interview insight "${insight.title}". Validate scope, owner, and next decision before promotion.`;
    const sourceType = String(
      insight.promptType || insight.insightType || insight.type || 'insight'
    );
    const titleBase = insight.title
      .replace(/^Executive Summary\s*[-:]\s*/i, '')
      .replace(/^Risk assessment\s*[-:]\s*/i, '')
      .trim();

    return {
      id: `derived-interview-initiative-${insight.id}`,
      title: titleBase || insight.title,
      name: titleBase || insight.title,
      description,
      status: statusCycle[index % statusCycle.length],
      priority: priorityCycle[index % priorityCycle.length],
      impact: index % 2 === 0 ? 'high' : 'medium',
      effort: index % 3 === 0 ? 'medium' : 'low',
      category: sourceType,
      sourceType: 'interview_insight',
      sourceId: insight.id,
      createdAt: insight.createdAt,
      updatedAt: insight.updatedAt || insight.createdAt,
    };
  });
}

type InterviewTab =
  | 'my_assignments'
  | 'sessions'
  | 'templates'
  | 'insights'
  | 'initiatives'
  | 'managed'
  | 'pending_review';
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

// Dynamic document tabs are Menu 3 chips with an optional left accent.
const TAB_INACTIVE = MENU_3_CHIP_INACTIVE;
const TAB_ACTIVE = MENU_3_CHIP_ACTIVE;

// Type colors
const TYPE_COLORS: Record<string, string> = {
  interview_session: 'border-l-purple-500',
  interview_insight: 'border-l-amber-500',
  interview_template: 'border-l-blue-500',
};

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-400',
  DRAFT: 'bg-slate-400',
  drafting: 'bg-slate-400',
  in_review: 'bg-amber-400',
  PENDING_REVIEW: 'bg-amber-400',
  review: 'bg-amber-400',
  REVIEW: 'bg-amber-400',
  approved: 'bg-emerald-400',
  APPROVED: 'bg-emerald-400',
  accepted: 'bg-emerald-400',
  rejected: 'bg-red-400',
  completed: 'bg-emerald-400',
  DONE: 'bg-emerald-400',
  active: 'bg-purple-400',
  EXECUTING: 'bg-purple-400',
  archived: 'bg-slate-500',
  ARCHIVED: 'bg-slate-500',
  assigned: 'bg-blue-400',
  in_progress: 'bg-purple-400',
  submitted: 'bg-amber-400',
  sent_back: 'bg-red-400',
};

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
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>('all');
  const [sessionsHiddenColumns, setSessionsHiddenColumns] = useState<string[]>(() =>
    loadHiddenColumns(INTERVIEW_SESSIONS_TABLE_VIEW_STORAGE_KEY, [], ['name', 'actions'])
  );
  const [sessionsColumnWidths, setSessionsColumnWidths] = useState<ColumnWidths>({
    ...INTERVIEW_SESSIONS_TABLE_DEFAULT_WIDTHS,
  });
  const [showSessionRowDescription, setShowSessionRowDescription] = useState(() =>
    loadBooleanSetting(INTERVIEW_SESSIONS_ROW_DESCRIPTION_STORAGE_KEY, true)
  );
  const [isSessionsViewSettingsOpen, setIsSessionsViewSettingsOpen] = useState(false);
  const sessionsViewSettingsRef = useRef<HTMLDivElement | null>(null);
  const [templateSourceFilter, setTemplateSourceFilter] = useState<TemplateSourceFilter>('all');
  const [templateAreaTagFilter, setTemplateAreaTagFilter] = useState<string[]>([]);
  const [isTemplateAreaFilterOpen, setIsTemplateAreaFilterOpen] = useState(false);
  const [templateStatusFilter, setTemplateStatusFilter] = useState<'all' | 'default' | 'active'>(
    'all'
  );
  const [templatesHiddenColumns, setTemplatesHiddenColumns] = useState<string[]>(() =>
    loadHiddenColumns(INTERVIEW_TEMPLATES_TABLE_VIEW_STORAGE_KEY, [], ['name', 'actions'])
  );
  const [templatesColumnWidths, setTemplatesColumnWidths] = useState<ColumnWidths>({
    name: 420,
    category: 180,
    questions: 100,
    status: 140,
    actions: 90,
  });
  const [templatePreviewDetailsMenuOpen, setTemplatePreviewDetailsMenuOpen] = useState(false);
  const [templatePreviewAiMenuOpen, setTemplatePreviewAiMenuOpen] = useState(false);
  const [isTemplatesViewSettingsOpen, setIsTemplatesViewSettingsOpen] = useState(false);
  const [templatesViewMode, setTemplatesViewMode] = useState<'cards' | 'table'>('cards');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [selectedTemplateForAssign, setSelectedTemplateForAssign] =
    useState<InterviewTemplate | null>(null);
  const [insightTypeFilter, setInsightTypeFilter] = useState<string>('all');
  const [insightStatusFilter, setInsightStatusFilter] = useState<string>('all');
  const [insightsViewMode, setInsightsViewMode] = useState<InsightsViewMode>('flat');
  const [insightsHiddenColumns, setInsightsHiddenColumns] = useState<string[]>(() =>
    loadHiddenColumns(INTERVIEW_INSIGHTS_TABLE_VIEW_STORAGE_KEY, [], ['title', 'actions'])
  );
  const [showInsightRowDescription, setShowInsightRowDescription] = useState(() =>
    loadBooleanSetting(INTERVIEW_INSIGHTS_ROW_DESCRIPTION_STORAGE_KEY, true)
  );
  const [isInsightsViewSettingsOpen, setIsInsightsViewSettingsOpen] = useState(false);
  const insightsViewSettingsRef = useRef<HTMLDivElement | null>(null);
  const [initiativeStatusFilter, setInitiativeStatusFilter] = useState<
    'all' | 'draft' | 'pending_review' | 'promoted'
  >('all');
  const [initiativesHiddenColumns, setInitiativesHiddenColumns] = useState<string[]>(() =>
    loadHiddenColumns(INTERVIEW_INITIATIVES_TABLE_VIEW_STORAGE_KEY, [], ['title', 'actions'])
  );
  const [showInitiativeRowDescription, setShowInitiativeRowDescription] = useState(() =>
    loadBooleanSetting(INTERVIEW_INITIATIVES_ROW_DESCRIPTION_STORAGE_KEY, true)
  );
  const [initiativesColumnWidths, setInitiativesColumnWidths] = useState<ColumnWidths>({
    ...INTERVIEW_INITIATIVES_TABLE_DEFAULT_WIDTHS,
  });
  const [isInitiativesViewSettingsOpen, setIsInitiativesViewSettingsOpen] = useState(false);
  const initiativesViewSettingsRef = useRef<HTMLDivElement | null>(null);
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string>('all');
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [insightPreviewDetailsExpanded, setInsightPreviewDetailsExpanded] = useState(false);
  const [insightPreviewAiActiveId, setInsightPreviewAiActiveId] = useState<string | null>(null);
  const [insightTableFilters, setInsightTableFilters] = useState<TableFilters>({});
  const [insightColumnWidths, setInsightColumnWidths] = useState<ColumnWidths>({
    ...INTERVIEW_INSIGHTS_TABLE_DEFAULT_WIDTHS,
  });
  const [openInsightFilterId, setOpenInsightFilterId] = useState<string | null>(null);

  // Reset preview expansion state when changing selection (KANON v3: stabilny panel)
  useEffect(() => {
    setInsightPreviewDetailsExpanded(false);
    setInsightPreviewAiActiveId(null);
  }, [selectedInsightId]);

  useEffect(() => {
    setInsightPreviewDetailsExpanded(false);
  }, [selectedInsightId]);

  useEffect(() => {
    if (!isInitiativesViewSettingsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (initiativesViewSettingsRef.current?.contains(event.target as Node)) return;
      setIsInitiativesViewSettingsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsInitiativesViewSettingsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInitiativesViewSettingsOpen]);

  useEffect(() => {
    if (!isSessionsViewSettingsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (sessionsViewSettingsRef.current?.contains(event.target as Node)) return;
      setIsSessionsViewSettingsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsSessionsViewSettingsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSessionsViewSettingsOpen]);

  useEffect(() => {
    if (!isInsightsViewSettingsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (insightsViewSettingsRef.current?.contains(event.target as Node)) return;
      setIsInsightsViewSettingsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsInsightsViewSettingsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isInsightsViewSettingsOpen]);

  useEffect(() => {
    // Assigned should open on the full manager list.
    // Narrow slices like "To approve" and "Overdue" are entered explicitly from Command Row chips.
    if (activeTab !== 'managed') return;
    if (assignmentStatusFilter === 'submitted' || assignmentStatusFilter === 'overdue') return;
    if (assignmentStatusFilter !== 'all') {
      setAssignmentStatusFilter('all');
    }
  }, [activeTab, assignmentStatusFilter]);

  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [insights, setInsights] = useState<InterviewInsight[]>([]);
  const [interviewInitiatives, setInterviewInitiatives] = useState<InterviewInitiativeDraft[]>([]);
  const [selectedInterviewInitiativeId, setSelectedInterviewInitiativeId] = useState<string | null>(
    null
  );
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingDemoData, setIsUsingDemoData] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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
  const [selectedAssignment, setSelectedAssignment] = useState<InterviewAssignment | null>(null);
  const [selectedAssignmentIds, setSelectedAssignmentIds] = useState<Set<string>>(new Set());
  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [selectedInsightIds, setSelectedInsightIds] = useState<Set<string>>(new Set());
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

  const loadManagedSessions = useCallback(async (): Promise<InterviewSession[]> => {
    const sessionsRes = await V8InterviewApi.getManagedSessions()
      .then((res) => res.sessions)
      .catch(() => Api.get('/interview/sessions/managed'))
      .catch(() => []);
    return Array.isArray(sessionsRes)
      ? (sessionsRes as InterviewSession[]).map(normalizeInterviewSessionRecord)
      : [];
  }, []);

  const loadMyAssignments = useCallback(async (): Promise<InterviewAssignment[]> => {
    const assignmentsRes = await V8InterviewApi.getMyAssignments()
      .then((res) => res.assignments)
      .catch(() => Api.get('/interview/assignments/my'))
      .catch(() => []);
    return Array.isArray(assignmentsRes)
      ? (assignmentsRes as InterviewAssignment[]).map(normalizeInterviewAssignmentRecord)
      : [];
  }, []);

  const loadManagedAssignments = useCallback(async (): Promise<InterviewAssignment[]> => {
    const assignmentsRes = await V8InterviewApi.getManagedAssignments()
      .then((res) => res.assignments)
      .catch(() => Api.get('/interview/assignments/managed'))
      .catch(() => []);
    return Array.isArray(assignmentsRes)
      ? (assignmentsRes as InterviewAssignment[]).map(normalizeInterviewAssignmentRecord)
      : [];
  }, []);

  const loadOverdueAssignments = useCallback(async (): Promise<InterviewAssignment[]> => {
    const assignmentsRes = await V8InterviewApi.getOverdueAssignments()
      .then((res) => res.assignments)
      .catch(() => Api.get('/interview/assignments/overdue'))
      .catch(() => []);
    return Array.isArray(assignmentsRes)
      ? (assignmentsRes as InterviewAssignment[]).map(normalizeInterviewAssignmentRecord)
      : [];
  }, []);

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
    }
  }, [activeTab, activeDocumentId]);

  // L2.3: Dynamic breadcrumbs for Interview module
  useEffect(() => {
    const base = isPolish ? 'Wywiad' : 'Interview';
    const doc = activeDocumentId ? openDocuments.find((d) => d.id === activeDocumentId) : null;

    if (doc) {
      const typeLabel =
        doc.type === 'interview_session'
          ? isPolish
            ? 'Sesja'
            : 'Session'
          : doc.type === 'interview_insight'
            ? isPolish
              ? 'Wniosek'
              : 'Insight'
            : isPolish
              ? 'Szablon'
              : 'Template';
      const docName = doc.name || typeLabel;
      setInterviewBreadcrumbs([base, `${typeLabel}: ${docName}`]);
    } else {
      const TAB_LABELS: Record<string, string> = {
        my_assignments: 'Inbox',
        sessions: isPolish ? 'Sesje' : 'Sessions',
        templates: isPolish ? 'Szablony' : 'Templates',
        insights: isPolish ? 'Wnioski' : 'Insights',
        initiatives: isPolish ? 'Inicjatywy' : 'Initiatives',
        managed: isPolish ? 'Przydzielone' : 'Assigned',
        pending_review: isPolish ? 'Do przeglądu' : 'Pending Review',
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
      try {
        const [sessionsRes, insightsRes, initiativesRes, templatesRes] = await Promise.all([
          // Sessions tab is the main manager cockpit for assignment-backed interview work.
          loadManagedSessions(),
          V8InterviewApi.listInsights()
            .then((r) => r.insights)
            .catch(() => Api.get('/interview/insights').catch(() => [])),
          Api.get('/initiatives?source=interview_insight').catch(() => []),
          Api.get('/interview/templates').catch(() => []),
        ]);

        const apiSessions = Array.isArray(sessionsRes) ? sessionsRes : [];
        const apiInsights = Array.isArray(insightsRes) ? insightsRes : [];
        const apiInitiatives = Array.isArray(initiativesRes) ? initiativesRes : [];
        const effectiveInitiatives =
          apiInitiatives.length > 0
            ? apiInitiatives
            : buildInterviewInitiativesFromInsights(apiInsights);
        const apiTemplates = (Array.isArray(templatesRes) ? templatesRes : []).map(
          normalizeTemplateRecord
        );
        setIsUsingDemoData(false);
        setLoadError(null);
        setSessions(apiSessions);
        setInsights(apiInsights);
        setInterviewInitiatives(effectiveInitiatives);
        setTemplates(apiTemplates);
      } catch (error) {
        console.error('[InterviewHub] Failed to load data:', error);
        setIsUsingDemoData(false);
        setLoadError('Failed to load real interview data from the active data source.');
        setSessions([]);
        setInsights([]);
        setInterviewInitiatives([]);
        setTemplates([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [loadManagedSessions, normalizeTemplateRecord]);

  // Load insights function (for refresh)
  const loadInsights = useCallback(async () => {
    try {
      const insightsRes = await V8InterviewApi.listInsights()
        .then((r) => r.insights)
        .catch(() => Api.get('/interview/insights').catch(() => []));
      const apiInsights = Array.isArray(insightsRes) ? insightsRes : [];
      setInsights(apiInsights);
    } catch (error) {
      console.error('[InterviewHub] Failed to load insights:', error);
      setInsights([]);
    }
  }, []);

  const loadInterviewInitiatives = useCallback(async () => {
    try {
      const initiativesRes = await Api.get('/initiatives?source=interview_insight').catch(() => []);
      const apiInitiatives = Array.isArray(initiativesRes) ? initiativesRes : [];
      setInterviewInitiatives(
        apiInitiatives.length > 0 ? apiInitiatives : buildInterviewInitiativesFromInsights(insights)
      );
    } catch (error) {
      console.error('[InterviewHub] Failed to load interview initiatives:', error);
      setInterviewInitiatives(buildInterviewInitiativesFromInsights(insights));
    }
  }, [insights]);

  useEffect(() => {
    if (interviewInitiatives.length > 0 || insights.length === 0) return;
    setInterviewInitiatives(buildInterviewInitiativesFromInsights(insights));
  }, [insights, interviewInitiatives.length]);

  // Load assignments data
  useEffect(() => {
    const loadAssignments = async () => {
      if (permissionsLoading) return;

      setAssignmentsLoading(true);
      try {
        // Always load my assignments
        const apiMyAssignments = await loadMyAssignments();
        setMyAssignments(apiMyAssignments);

        // Load managed/overdue only if user has permission
        if (permissionsCanViewManaged || isUsingDemoData) {
          const [apiManagedAssignments, apiOverdueAssignments] = await Promise.all([
            loadManagedAssignments(),
            loadOverdueAssignments(),
          ]);
          setManagedAssignments(apiManagedAssignments);
          setOverdueAssignments(apiOverdueAssignments);
        }
      } catch (error) {
        console.error('[InterviewHub] Failed to load assignments:', error);
        setMyAssignments([]);
        setManagedAssignments([]);
        setOverdueAssignments([]);
      } finally {
        setAssignmentsLoading(false);
      }
    };

    loadAssignments();
  }, [
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
          new Date(s.startedAt || 0).toLocaleDateString().includes(query)
      );
    }

    return result;
  }, [getSessionWorkflowStatus, searchQuery, sessionStatusFilter, sessions]);

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

  // Insights filtered by table header filters
  const insightsForTable = useMemo(() => {
    let result = filteredInsights;
    const typeFilter = insightTableFilters.type as string[] | undefined;
    if (typeFilter?.length) {
      result = result.filter((i) => {
        const t = ((i as any).promptType || (i as any).insightType || 'summary') as string;
        return typeFilter.includes(t);
      });
    }
    const statusFilter = insightTableFilters.status as string[] | undefined;
    if (statusFilter?.length) {
      result = result.filter((i) =>
        statusFilter.includes(
          (i.reviewStatus === 'in_review' || i.reviewStatus === 'published'
            ? i.reviewStatus
            : i.status) || 'completed'
        )
      );
    }
    return result;
  }, [filteredInsights, insightTableFilters]);

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
        if (initiativeStatusFilter === 'pending_review') return status === 'PENDING_REVIEW';
        return ['REVIEW', 'PROMOTED', 'PLANNING', 'APPROVED'].includes(status);
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
    return result;
  }, [interviewInitiatives, initiativeStatusFilter, searchQuery]);

  const interviewInitiativeStats = useMemo(
    () => ({
      total: interviewInitiatives.length,
      draft: interviewInitiatives.filter(
        (item) => String(item.status || 'DRAFT').toUpperCase() === 'DRAFT'
      ).length,
      pendingReview: interviewInitiatives.filter(
        (item) => String(item.status || '').toUpperCase() === 'PENDING_REVIEW'
      ).length,
      promoted: interviewInitiatives.filter((item) =>
        ['REVIEW', 'PROMOTED', 'PLANNING', 'APPROVED'].includes(
          String(item.status || '').toUpperCase()
        )
      ).length,
    }),
    [interviewInitiatives]
  );

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // Filter by status-like chips (All / Default / Active)
    if (templateStatusFilter !== 'all') {
      result =
        templateStatusFilter === 'default'
          ? result.filter((t) => t.isDefault)
          : result.filter((t) => !t.isDefault);
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

  // Manager (PM/ADMIN): wszystkie zakładki
  const tabs = useMemo(() => {
    const baseTabs: Array<{
      id: ModuleTab;
      label: string;
      icon: React.ReactNode;
      count?: number;
    }> = [
      {
        id: 'my_assignments' as ModuleTab,
        label: isPolish ? 'Inbox' : 'Inbox',
        icon: <Inbox size={16} />,
        count: myAssignments.filter((a) => a.status !== 'approved' && a.status !== 'completed')
          .length,
      },
    ];

    if (canViewManaged) {
      baseTabs.push({
        id: 'sessions' as ModuleTab,
        label: isPolish ? 'Sesje' : 'Sessions',
        icon: <MessageSquare size={16} />,
        count: sessions.length,
      });

      baseTabs.push({
        id: 'managed' as ModuleTab,
        label: isPolish ? 'Przydzielone' : 'Assigned',
        icon: <ClipboardList size={16} />,
        count: managedAssignments.length,
      });
    }

    if (canViewTemplates) {
      baseTabs.push({
        id: 'templates' as ModuleTab,
        label: isPolish ? 'Szablony' : 'Templates',
        icon: <FileText size={16} />,
        count: templates.length,
      });
    }

    if (canViewInsights) {
      baseTabs.push({
        id: 'insights' as ModuleTab,
        label: isPolish ? 'Wnioski' : 'Insights',
        icon: <Lightbulb size={16} />,
        count: insights.length,
      });

      baseTabs.push({
        id: 'initiatives' as ModuleTab,
        label: isPolish ? 'Inicjatywy' : 'Initiatives',
        icon: <Rocket size={16} />,
        count: interviewInitiativeStats.total,
      });
    }

    if (canReviewInsights) {
      baseTabs.push({
        id: 'pending_review' as ModuleTab,
        label: isPolish ? 'Do przeglądu' : 'Pending Review',
        icon: <AlertTriangle size={16} />,
        count: pendingReviewInsights.length,
      });
    }

    return baseTabs;
  }, [
    isPolish,
    sessions.length,
    insights.length,
    interviewInitiativeStats.total,
    templates.length,
    myAssignments,
    managedAssignments,
    canViewInsights,
    canViewManaged,
    canViewTemplates,
    canReviewInsights,
    pendingReviewInsights.length,
  ]);

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
        toast.error(
          isPolish
            ? 'Wybierz projekt przed utworzeniem sesji'
            : 'Select a project before creating a session'
        );
        return;
      }
      toast.loading(isPolish ? 'Tworzenie sesji wywiadu...' : 'Creating interview session...', {
        id: toastId,
      });
      const newSession = await Api.post('/interview/sessions', {
        projectId,
        name: `Interview ${new Date().toLocaleDateString()}`,
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

      toast.success(
        isPolish ? 'Nowa sesja wywiadu rozpoczęta!' : 'New interview session started!',
        {
          id: toastId,
        }
      );
    } catch (error) {
      console.error('[InterviewHub] Failed to create session:', error);
      toast.error(
        getSafeInterviewErrorMessage(
          error,
          isPolish
            ? 'Nie udało się utworzyć sesji. Spróbuj ponownie za chwilę.'
            : 'Failed to create session. Please try again shortly.'
        ),
        { id: toastId, duration: 6000 }
      );
    }
  }, [ensureProjectId, isPolish]);

  const handleSessionComplete = useCallback(
    async (sessionId: string) => {
      toast.success(isPolish ? 'Wywiad zakończony!' : 'Interview completed!');
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
      name: isPolish ? 'Nowy template' : 'New template',
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
        name: template?.name || (isPolish ? 'Template' : 'Template'),
        status: (template?.status || 'draft').toUpperCase() as any,
      });
    },
    [handleOpenDocument, isPolish, templates]
  );

  const handleCloneTemplate = useCallback(
    async (template: InterviewTemplate) => {
      try {
        toast.loading(isPolish ? 'Klonowanie szablonu...' : 'Cloning template...');
        const cloned = await Api.post(`/interview/templates/${template.id}/clone`, {
          name: `${template.name} (${isPolish ? 'kopia' : 'copy'})`,
        });
        toast.dismiss();
        toast.success(isPolish ? 'Szablon sklonowany!' : 'Template cloned!');

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
          name: (cloned as any).name || `${template.name} (${isPolish ? 'kopia' : 'copy'})`,
          status: ((cloned as any).status || 'draft').toUpperCase() as any,
        });
      } catch (error) {
        toast.dismiss();
        toast.error(isPolish ? 'Nie udało się sklonować szablonu' : 'Failed to clone template');
        console.error('[InterviewHub] Failed to clone template:', error);
      }
    },
    [handleOpenDocument, isPolish]
  );

  const handleDeleteTemplate = useCallback(
    async (template: InterviewTemplate) => {
      if (
        !confirm(
          isPolish
            ? `Czy na pewno chcesz usunąć szablon "${template.name}"?`
            : `Are you sure you want to delete template "${template.name}"?`
        )
      ) {
        return;
      }

      try {
        await Api.delete(`/interview/templates/${template.id}`);
        toast.success(isPolish ? 'Szablon usunięty!' : 'Template deleted!');

        // Refresh templates
        const templatesRes = await Api.get('/interview/templates').catch(() => []);
        setTemplates(
          (Array.isArray(templatesRes) ? templatesRes : []).map(normalizeTemplateRecord)
        );
      } catch (error) {
        toast.error(isPolish ? 'Nie udało się usunąć szablonu' : 'Failed to delete template');
        console.error('[InterviewHub] Failed to delete template:', error);
      }
    },
    [isPolish]
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
        toast.success(isPolish ? 'Wywiad zwrócony do poprawy!' : 'Interview sent back!');
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
        safeToastError(
          error,
          isPolish ? 'Nie udało się zwrócić wywiadu' : 'Failed to send back',
          isPolish
        );
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
        toast.success(isPolish ? 'Wywiad zatwierdzony!' : 'Interview approved!');

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
        safeToastError(
          error,
          isPolish ? 'Nie udało się zatwierdzić wywiadu' : 'Failed to approve interview',
          isPolish
        );
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

  const getManagedAssignmentForSession = useCallback(
    (session: InterviewSession) =>
      managedAssignments.find(
        (assignment) =>
          assignment.id === session.assignmentId || assignment.sessionId === session.id
      ) || null,
    [managedAssignments]
  );

  // Export intentionally not available in this view (KANON v3).

  const copyToClipboard = useCallback(
    async (text: string) => {
      const value = String(text || '');
      if (!value.trim()) {
        toast.error(isPolish ? 'Brak treści do skopiowania' : 'Nothing to copy');
        return;
      }
      try {
        await navigator.clipboard.writeText(value);
        toast.success(isPolish ? 'Skopiowano' : 'Copied');
      } catch {
        toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
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
        safeToastError(
          error,
          isPolish ? 'Nie udało się otworzyć sesji' : 'Failed to open session',
          isPolish
        );
      }
    },
    [isPolish, handleViewSession]
  );

  type InsightPromptType =
    | 'summary'
    | 'trends'
    | 'problems'
    | 'recommendations'
    | 'comparison'
    | 'gaps'
    | 'risk_assessment'
    | 'opportunity_scan'
    | 'maturity'
    | 'stakeholder_map';

  // Generate insight from session
  const handleGenerateInsight = useCallback(
    async (session: InterviewSession, promptType: InsightPromptType = 'summary') => {
      try {
        toast.loading(isPolish ? 'Generowanie wniosków AI...' : 'Generating AI insights...');
        await V8InterviewApi.createInsight({ sessionId: session.id, promptType }).catch(() =>
          Api.post('/interview/insights', { sessionId: session.id, promptType })
        );
        toast.dismiss();
        toast.success(isPolish ? 'Wnioski wygenerowane!' : 'Insights generated!');

        // Refresh insights
        const insightsRes = await V8InterviewApi.listInsights()
          .then((r) => r.insights)
          .catch(() => Api.get('/interview/insights').catch(() => []));
        setInsights(Array.isArray(insightsRes) ? insightsRes : []);

        // Switch to insights tab
        setActiveTab('insights');
      } catch (error) {
        toast.dismiss();
        toast.error(
          isPolish ? 'Nie udało się wygenerować wniosków' : 'Failed to generate insights'
        );
        console.error('[InterviewHub] Failed to generate insight:', error);
      }
    },
    [isPolish]
  );

  const handleUpdateInterviewInitiativeStatus = useCallback(
    async (initiativeId: string, status: 'DRAFT' | 'PENDING_REVIEW') => {
      try {
        await Api.put(`/initiatives/${initiativeId}`, { status });
        await loadInterviewInitiatives();
        toast.success(
          status === 'PENDING_REVIEW'
            ? isPolish
              ? 'Inicjatywa wysłana do przeglądu'
              : 'Initiative sent to review'
            : isPolish
              ? 'Inicjatywa wróciła do szkicu'
              : 'Initiative returned to draft'
        );
      } catch (error) {
        console.error('[InterviewHub] Failed to update interview initiative:', error);
        toast.error(isPolish ? 'Nie udało się zmienić statusu' : 'Failed to update status');
      }
    },
    [isPolish, loadInterviewInitiatives]
  );

  // Render Dynamic Tabs
  const renderDynamicTabs = () => {
    if (openDocuments.length === 0) return null;

    const isListActive = activeDocumentId === null;

    return (
      <div className={MENU_3_ROW_CLASS}>
        <div className="flex min-h-8 items-center gap-2 overflow-x-auto whitespace-nowrap no-scrollbar">
          {/* List button */}
          <button onClick={handleShowList} className={isListActive ? TAB_ACTIVE : TAB_INACTIVE}>
            <List size={14} />
            <span>List</span>
          </button>

          {/* Separator */}
          <div className="w-px h-6 bg-slate-200/70 dark:bg-white/[0.06]" />

          {/* Document Tabs */}
          {openDocuments.map((doc) => {
            const isActive = doc.id === activeDocumentId;
            const leftBorderColor = TYPE_COLORS[doc.type];
            const statusColor = STATUS_COLORS[doc.status];

            return (
              <div
                key={doc.id}
                className={`group ${isActive ? TAB_ACTIVE : TAB_INACTIVE} ${leftBorderColor} border-l-2`}
                onClick={() => setActiveDocumentId(doc.id)}
              >
                {/* Type Icon */}
                {doc.type === 'interview_session' && <MessageSquare size={14} />}
                {doc.type === 'interview_insight' && <Lightbulb size={14} />}
                {doc.type === 'interview_template' && <FileText size={14} />}

                {/* Name (truncated) */}
                <span className="max-w-[120px] truncate">{doc.name}</span>

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
      </div>
    );
  };

  const renderCommandRow = () => {
    // Search and dynamic tabs are now handled by ModuleHub
    if (activeDocumentId) return null;

    // Interview Inbox counters/status chips — Command Row (single line)
    // MUST: Inbox (moja) / Do zatwierdzenia / Zaległe with counters; click sets filter.
    if (activeTab === 'my_assignments' || activeTab === 'managed') {
      const myInboxCount = (myAssignments || []).filter(
        (a) => a.status !== 'approved' && a.status !== 'completed'
      ).length;
      const selectedCount = selectedAssignmentIds.size;

      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;
      const bulkGhostPill =
        'inline-flex h-8 items-center rounded-full px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/[0.06]';

      const buttons: Array<{
        id: 'all' | 'my' | 'to-approve' | 'overdue';
        label: string;
        count: number;
        disabled?: boolean;
        onClick: () => void;
      }> = [
        {
          id: 'all',
          label: 'ALL',
          count: myInboxCount,
          onClick: () => {
            setActiveTab('my_assignments');
            setAssignmentStatusFilter('all');
            setActiveDocumentId(null);
          },
        },
        {
          id: 'my',
          label: isPolish ? 'Inbox (moja)' : 'My inbox',
          count: myInboxCount,
          onClick: () => {
            setActiveTab('my_assignments');
            setAssignmentStatusFilter('all');
            setActiveDocumentId(null);
          },
        },
        {
          id: 'to-approve' as const,
          label: isPolish ? 'Do zatwierdzenia' : 'To approve',
          count: canViewManaged ? (managedAssignmentStatusCounts.submitted ?? 0) : 0,
          disabled: !canViewManaged,
          onClick: () => {
            if (!canViewManaged) return;
            setActiveTab('managed');
            setAssignmentStatusFilter('submitted');
            setActiveDocumentId(null);
          },
        },
        {
          id: 'overdue' as const,
          label: isPolish ? 'Zaległe' : 'Overdue',
          count: canViewManaged ? overdueAssignments.length : 0,
          disabled: !canViewManaged,
          onClick: () => {
            if (!canViewManaged) return;
            setActiveTab('managed');
            setAssignmentStatusFilter('overdue');
            setActiveDocumentId(null);
          },
        },
      ];

      const activeId: 'my' | 'to-approve' | 'overdue' | null =
        activeTab === 'my_assignments' && assignmentStatusFilter === 'all'
          ? null
          : assignmentStatusFilter === 'overdue'
            ? 'overdue'
            : assignmentStatusFilter === 'submitted'
              ? 'to-approve'
              : null;

      if (selectedCount > 0) {
        return (
          <div className={MENU_3_ROW_CLASS}>
            <div className={MENU_3_INNER_CLASS}>
              <div className={MENU_3_RIGHT_CLASS}>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCount} {isPolish ? 'zaznaczonych' : 'selected'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedAssignmentIds(new Set())}
                  className={bulkGhostPill}
                >
                  {isPolish ? 'Odznacz' : 'Clear'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    toast(
                      isPolish
                        ? 'Przypomnienie zbiorcze w przygotowaniu'
                        : 'Bulk reminder coming soon'
                    )
                  }
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <Bell size={14} />
                  {isPolish ? 'Przypomnij' : 'Remind'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toast(
                      isPolish
                        ? 'Zbiorcza zmiana terminu w przygotowaniu'
                        : 'Bulk due date coming soon'
                    )
                  }
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <Calendar size={14} />
                  {isPolish ? 'Termin' : 'Due date'}
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
              {buttons.map((b) => (
                <button
                  key={b.id}
                  onClick={b.onClick}
                  disabled={!!b.disabled}
                  className={`${chipBase} ${
                    (b.id === 'all' ? activeId === null : activeId === b.id)
                      ? chipActive
                      : chipInactive
                  } ${b.disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {b.id === 'all' ? <span className={MENU_3_ALL_DOT_CLASS} /> : null}
                  <span>{b.label}</span>
                  <span
                    className={`${badgeBase} ${
                      (b.id === 'all' ? activeId === null : activeId === b.id)
                        ? badgeActive
                        : badgeInactive
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
        'inline-flex h-8 items-center rounded-full px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/[0.06]';

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
          label: isPolish ? 'Wszystkie' : 'All',
          count: allCount,
          onClick: () => setSessionStatusFilter('all'),
        },
        {
          id: 'in_progress',
          label: isPolish ? 'W trakcie' : 'In progress',
          count: inProgressCount,
          icon: Clock,
          onClick: () =>
            setSessionStatusFilter((prev) => (prev === 'in_progress' ? 'all' : 'in_progress')),
        },
        {
          id: 'submitted',
          label: isPolish ? 'Wysłane' : 'Submitted',
          count: submittedCount,
          icon: Send,
          onClick: () =>
            setSessionStatusFilter((prev) => (prev === 'submitted' ? 'all' : 'submitted')),
        },
        {
          id: 'approved',
          label: isPolish ? 'Zatwierdzone' : 'Approved',
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
              <div className={MENU_3_RIGHT_CLASS}>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCount} {isPolish ? 'zaznaczonych' : 'selected'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedSessionIds(new Set())}
                  className={bulkGhostPill}
                >
                  {isPolish ? 'Odznacz' : 'Clear'}
                </button>
              </div>
              <div className="flex items-center gap-2">
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
                  {isPolish ? 'Wnioski AI' : 'AI insights'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toast(
                      isPolish
                        ? 'Eksport zaznaczonych sesji w przygotowaniu'
                        : 'Selected sessions export coming soon'
                    )
                  }
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <Download size={14} />
                  {isPolish ? 'Eksport' : 'Export'}
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
            <div className="shrink-0" />
          </div>
        </div>
      );
    }

    // Templates counters/status chips — Command Row (single line)
    if (activeTab === 'templates') {
      const chipBase = MENU_3_CHIP_BASE;
      const chipInactive = MENU_3_CHIP_INACTIVE;
      const chipActive = MENU_3_CHIP_ACTIVE;
      const badgeBase = MENU_3_BADGE_BASE;
      const badgeInactive = MENU_3_BADGE_INACTIVE;
      const badgeActive = MENU_3_BADGE_ACTIVE;

      const buttons: Array<{
        id: 'all' | 'default' | 'active';
        label: string;
        count: number;
        onClick: () => void;
      }> = [
        {
          id: 'all',
          label: isPolish ? 'Wszystkie' : 'All',
          count: templates.length,
          onClick: () => setTemplateStatusFilter('all'),
        },
        {
          id: 'default',
          label: isPolish ? 'Domyślne' : 'Default',
          count: templates.filter((t) => t.isDefault).length,
          onClick: () => setTemplateStatusFilter('default'),
        },
        {
          id: 'active',
          label: isPolish ? 'Aktywne' : 'Active',
          count: templates.filter((t) => !t.isDefault).length,
          onClick: () => setTemplateStatusFilter('active'),
        },
      ];

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
      const bulkGhostPill =
        'inline-flex h-8 items-center rounded-full px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/[0.06]';

      const buttons: Array<{
        id: 'all' | 'completed' | 'failed' | 'published';
        label: string;
        count: number;
        icon?: React.ElementType;
        onClick: () => void;
      }> = [
        {
          id: 'all',
          label: isPolish ? 'Wszystkie' : 'All',
          count: insightStats.total,
          onClick: () => setInsightStatusFilter('all'),
        },
        {
          id: 'completed',
          label: isPolish ? 'Gotowe' : 'Ready',
          count: insightStats.completed,
          icon: Check,
          onClick: () =>
            setInsightStatusFilter((prev) => (prev === 'completed' ? 'all' : 'completed')),
        },
        {
          id: 'failed',
          label: isPolish ? 'Błędy' : 'Failed',
          count: insightStats.failed,
          icon: AlertTriangle,
          onClick: () => setInsightStatusFilter((prev) => (prev === 'failed' ? 'all' : 'failed')),
        },
        {
          id: 'published',
          label: isPolish ? 'Opublikowane' : 'Published',
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
              <div className={MENU_3_RIGHT_CLASS}>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCount} {isPolish ? 'zaznaczonych' : 'selected'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInsightIds(new Set())}
                  className={bulkGhostPill}
                >
                  {isPolish ? 'Odznacz' : 'Clear'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    toast(
                      isPolish
                        ? 'Zbiorczy eksport wniosków w przygotowaniu'
                        : 'Bulk insight export coming soon'
                    )
                  }
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <Download size={14} />
                  {isPolish ? 'Eksport' : 'Export'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    toast(
                      isPolish
                        ? 'Zbiorcze przekazanie do narzędzi w przygotowaniu'
                        : 'Bulk Tools export coming soon'
                    )
                  }
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <Send size={14} />
                  Tools
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
      const bulkGhostPill =
        'inline-flex h-8 items-center rounded-full px-2.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-white/60 dark:text-slate-300 dark:hover:bg-white/[0.06]';

      const buttons: Array<{
        id: 'all' | 'draft' | 'pending_review' | 'promoted';
        label: string;
        count: number;
        icon?: React.ElementType;
      }> = [
        {
          id: 'all',
          label: isPolish ? 'Wszystkie' : 'All',
          count: interviewInitiativeStats.total,
        },
        {
          id: 'draft',
          label: isPolish ? 'Szkice' : 'Drafts',
          count: interviewInitiativeStats.draft,
          icon: Edit3,
        },
        {
          id: 'pending_review',
          label: isPolish ? 'Do przeglądu' : 'Pending review',
          count: interviewInitiativeStats.pendingReview,
          icon: AlertTriangle,
        },
        {
          id: 'promoted',
          label: isPolish ? 'Przekazane dalej' : 'Moved forward',
          count: interviewInitiativeStats.promoted,
          icon: Rocket,
        },
      ];

      if (selectedCount > 0) {
        return (
          <div className={MENU_3_ROW_CLASS}>
            <div className={MENU_3_INNER_CLASS}>
              <div className={MENU_3_RIGHT_CLASS}>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {selectedCount} {isPolish ? 'zaznaczonych' : 'selected'}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedInitiativeIds(new Set())}
                  className={bulkGhostPill}
                >
                  {isPolish ? 'Odznacz' : 'Clear'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    toast(
                      isPolish
                        ? 'Zbiorcze przekazanie inicjatyw w przygotowaniu'
                        : 'Bulk initiative promotion coming soon'
                    )
                  }
                  className={MENU_3_ACTION_NEUTRAL}
                >
                  <Rocket size={14} />
                  {isPolish ? 'Przekaż dalej' : 'Move forward'}
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
          'bg-blue-100 border border-blue-200 dark:bg-purple-500/20 dark:border-purple-500/30',
        textColor: 'text-blue-700 dark:text-purple-300',
        dotColor: 'bg-blue-500 dark:bg-purple-400',
      },
      submitted: {
        label: { en: 'Submitted', pl: 'Wysłany' },
        bgColor:
          'bg-amber-100 border border-amber-200 dark:bg-amber-500/20 dark:border-amber-500/30',
        textColor: 'text-amber-800 dark:text-amber-300',
        dotColor: 'bg-amber-500 dark:bg-amber-400',
      },
      sent_back: {
        label: { en: 'Sent Back', pl: 'Do poprawy' },
        bgColor: 'bg-red-100 border border-red-200 dark:bg-rose-500/20 dark:border-rose-500/30',
        textColor: 'text-red-800 dark:text-rose-300',
        dotColor: 'bg-red-500 dark:bg-rose-400',
      },
      approved: {
        label: { en: 'Approved', pl: 'Zatwierdzony' },
        bgColor:
          'bg-emerald-100 border border-emerald-200 dark:bg-emerald-500/20 dark:border-emerald-500/30',
        textColor: 'text-emerald-800 dark:text-emerald-300',
        dotColor: 'bg-emerald-500 dark:bg-emerald-400',
      },
      in_review: {
        label: { en: 'In Review', pl: 'Do przeglądu' },
        bgColor:
          'bg-amber-100 border border-amber-200 dark:bg-amber-500/20 dark:border-amber-500/30',
        textColor: 'text-amber-800 dark:text-amber-300',
        dotColor: 'bg-amber-500 dark:bg-amber-400',
      },
      completed: {
        label: { en: 'Completed', pl: 'Zakończony' },
        bgColor:
          'bg-emerald-100 border border-emerald-200 dark:bg-emerald-500/20 dark:border-emerald-500/30',
        textColor: 'text-emerald-800 dark:text-emerald-300',
        dotColor: 'bg-emerald-500 dark:bg-emerald-400',
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

  // Render table view for sessions
  const renderSessionsTable = (
    rows: InterviewSession[] = filteredSessions,
    opts?: {
      onRowClick?: (id: string) => void;
      onRowDoubleClick?: (id: string) => void;
      selectedId?: string | null;
    }
  ) => {
    const hiddenSet = new Set(sessionsHiddenColumns);
    const visibleSessionIds = rows.map((session) => session.id);
    const selectedVisibleCount = visibleSessionIds.filter((id) =>
      selectedSessionIds.has(id)
    ).length;
    const allVisibleSelected =
      visibleSessionIds.length > 0 && selectedVisibleCount === visibleSessionIds.length;
    const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
    const visibleColumns = [
      'select',
      'name',
      ...(!hiddenSet.has('status') ? ['status'] : []),
      ...(!hiddenSet.has('progress') ? ['progress'] : []),
      ...(!hiddenSet.has('date') ? ['date'] : []),
      'actions',
    ];
    const tableMinWidth = visibleColumns.reduce(
      (sum, columnId) => sum + (sessionsColumnWidths[columnId] ?? 120),
      0
    );
    const toggleSessionSelection = (sessionId: string) => {
      setSelectedSessionIds((prev) => {
        const next = new Set(prev);
        if (next.has(sessionId)) next.delete(sessionId);
        else next.add(sessionId);
        return next;
      });
    };
    const toggleAllVisibleSessions = () => {
      setSelectedSessionIds((prev) => {
        const next = new Set(prev);
        if (allVisibleSelected) {
          visibleSessionIds.forEach((id) => next.delete(id));
        } else {
          visibleSessionIds.forEach((id) => next.add(id));
        }
        return next;
      });
    };
    const handleSessionColumnResize = (columnId: string, newWidth: number) => {
      setSessionsColumnWidths((prev) => {
        const currentIndex = visibleColumns.indexOf(columnId);
        const nextColumnId = visibleColumns[currentIndex + 1];
        if (currentIndex < 0 || !nextColumnId) return prev;

        const current = prev[columnId] ?? INTERVIEW_SESSIONS_TABLE_DEFAULT_WIDTHS[columnId];
        const next = prev[nextColumnId] ?? INTERVIEW_SESSIONS_TABLE_DEFAULT_WIDTHS[nextColumnId];
        const currentBounds = INTERVIEW_SESSIONS_TABLE_RESIZE_BOUNDS[columnId];
        const nextBounds = INTERVIEW_SESSIONS_TABLE_RESIZE_BOUNDS[nextColumnId];
        const requestedDelta = newWidth - current;
        const minDelta = Math.max(currentBounds.minWidth - current, next - nextBounds.maxWidth);
        const maxDelta = Math.min(currentBounds.maxWidth - current, next - nextBounds.minWidth);
        const delta = Math.max(minDelta, Math.min(maxDelta, requestedDelta));
        if (delta === 0) return prev;

        return {
          ...prev,
          [columnId]: current + delta,
          [nextColumnId]: next - delta,
        };
      });
    };
    const renderSessionResizer = (columnId: string) => {
      if (visibleColumns[visibleColumns.indexOf(columnId) + 1] == null) return null;
      const bounds = INTERVIEW_SESSIONS_TABLE_RESIZE_BOUNDS[columnId];
      return (
        <ColumnResizer
          columnId={columnId}
          currentWidth={
            sessionsColumnWidths[columnId] ?? INTERVIEW_SESSIONS_TABLE_DEFAULT_WIDTHS[columnId]
          }
          minWidth={bounds.minWidth}
          maxWidth={bounds.maxWidth}
          onResize={handleSessionColumnResize}
        />
      );
    };

    return (
      <div className="bg-white/70 dark:bg-navy-900/70 border border-slate-200/70 dark:border-white/[0.06] rounded-xl backdrop-blur overflow-hidden">
        <table className="w-full table-fixed" style={{ minWidth: tableMinWidth }}>
          <thead>
            <tr className="border-b border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-navy-900/40">
              <th className="px-3 py-2 text-left" style={{ width: sessionsColumnWidths.select }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAllVisibleSessions();
                  }}
                  className={[
                    'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-all duration-150',
                    'border-slate-300 bg-white/80 text-white hover:border-primary-400 hover:bg-white dark:border-white/[0.14] dark:bg-white/[0.035]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35',
                    allVisibleSelected || someVisibleSelected
                      ? 'border-primary-500 bg-primary-500 opacity-100 dark:border-primary-400 dark:bg-primary-500'
                      : 'opacity-70',
                  ].join(' ')}
                  aria-label={isPolish ? 'Zaznacz widoczne sesje' : 'Select visible sessions'}
                  aria-pressed={allVisibleSelected}
                >
                  {allVisibleSelected ? <Check size={10} strokeWidth={3} /> : null}
                  {someVisibleSelected ? <Minus size={10} strokeWidth={3} /> : null}
                </button>
              </th>
              <th
                className="relative px-3 py-2 text-left text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: sessionsColumnWidths.name }}
              >
                {isPolish ? 'Nazwa' : 'Name'}
                {renderSessionResizer('name')}
              </th>
              {!hiddenSet.has('status') && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                  style={{ width: sessionsColumnWidths.status }}
                >
                  {isPolish ? 'Status' : 'Status'}
                  {renderSessionResizer('status')}
                </th>
              )}
              {!hiddenSet.has('progress') && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                  style={{ width: sessionsColumnWidths.progress }}
                >
                  {isPolish ? 'Postęp' : 'Progress'}
                  {renderSessionResizer('progress')}
                </th>
              )}
              {!hiddenSet.has('date') && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                  style={{ width: sessionsColumnWidths.date }}
                >
                  {isPolish ? 'Data' : 'Date'}
                  {renderSessionResizer('date')}
                </th>
              )}
              <th
                className="relative px-3 py-2 text-right text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: sessionsColumnWidths.actions }}
              >
                <div ref={sessionsViewSettingsRef} className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsSessionsViewSettingsOpen((open) => !open);
                    }}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98]"
                    aria-label={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
                    aria-expanded={isSessionsViewSettingsOpen}
                    title={isPolish ? 'Ustawienia widoku' : 'View settings'}
                  >
                    <Settings2 size={14} />
                  </button>
                  {isSessionsViewSettingsOpen ? (
                    <div
                      className="absolute right-3 top-[calc(100%+8px)] z-50 w-72 rounded-2xl border border-slate-200/80 bg-white p-2 text-left normal-case tracking-normal shadow-xl shadow-slate-900/12 dark:border-white/[0.08] dark:bg-navy-900 dark:shadow-black/35"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Widoczne kolumny' : 'Visible columns'}
                      </div>
                      {(
                        [
                          { id: 'status', label: isPolish ? 'Status' : 'Status' },
                          { id: 'progress', label: isPolish ? 'Postęp' : 'Progress' },
                          { id: 'date', label: isPolish ? 'Data' : 'Date' },
                        ] as const
                      ).map((col) => {
                        const checked = !hiddenSet.has(col.id);
                        return (
                          <label
                            key={col.id}
                            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.04]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSessionsHiddenColumns((prev) => {
                                  const set = new Set(prev);
                                  if (set.has(col.id)) set.delete(col.id);
                                  else set.add(col.id);
                                  const next = Array.from(set);
                                  saveHiddenColumns(
                                    INTERVIEW_SESSIONS_TABLE_VIEW_STORAGE_KEY,
                                    next
                                  );
                                  return next;
                                });
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-white/[0.18] dark:bg-white/[0.04]"
                            />
                            <span>{col.label}</span>
                          </label>
                        );
                      })}
                      <div className="my-2 border-t border-slate-200/70 dark:border-white/[0.08]" />
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.04]">
                        <input
                          type="checkbox"
                          checked={showSessionRowDescription}
                          onChange={(event) => {
                            setShowSessionRowDescription(event.target.checked);
                            saveBooleanSetting(
                              INTERVIEW_SESSIONS_ROW_DESCRIPTION_STORAGE_KEY,
                              event.target.checked
                            );
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-white/[0.18] dark:bg-white/[0.04]"
                        />
                        <span>
                          {isPolish ? 'Pokaż opis / uzasadnienie' : 'Show row description'}
                        </span>
                      </label>
                    </div>
                  ) : null}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((session) => {
              const progress = getSessionProgress(session);
              const workflowStatus = getSessionWorkflowStatus(session);
              const statusConfig = getSessionStatusConfig(workflowStatus);
              const isApproved = ['approved', 'completed'].includes(workflowStatus);
              const isSubmitted = workflowStatus === 'submitted';
              const canRemind = ['in_progress', 'sent_back'].includes(workflowStatus);
              const isSelected = opts?.selectedId === session.id;
              const isSessionSelected = selectedSessionIds.has(session.id);
              const linkedAssignment = getManagedAssignmentForSession(session);
              const primaryMeta = session.assigneeName || session.respondentName || '—';
              const secondaryMeta = session.templateName || session.templateCategory || '—';

              return (
                <tr
                  key={session.id}
                  onClick={(event) => {
                    const target = event.target as HTMLElement;
                    if (target.tagName === 'BUTTON' || target.closest('button')) return;
                    if (opts?.onRowClick) {
                      opts.onRowClick(session.id);
                    } else {
                      handleViewSession(session);
                    }
                  }}
                  onDoubleClick={() =>
                    opts?.onRowDoubleClick
                      ? opts.onRowDoubleClick(session.id)
                      : handleViewSession(session)
                  }
                  className={[
                    'group cursor-pointer transition-colors border-b border-slate-200/50 dark:border-navy-700/50 last:border-0',
                    isSelected || isSessionSelected
                      ? 'bg-primary-50 dark:bg-primary-500/[0.14] shadow-[inset_4px_0_0_theme(colors.primary.500)] ring-1 ring-primary-500/25 ring-inset'
                      : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.03]',
                  ].join(' ')}
                >
                  <td className="px-3 py-3" style={{ width: sessionsColumnWidths.select }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleSessionSelection(session.id);
                      }}
                      className={[
                        'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-all duration-150',
                        'border-slate-300 bg-white/80 text-white hover:border-primary-400 group-hover:opacity-100 group-hover:bg-white/90',
                        'dark:border-white/[0.14] dark:bg-white/[0.035] dark:group-hover:bg-white/[0.08]',
                        'focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35',
                        'group-focus-within:opacity-100 group-focus-within:border-primary-400',
                        isSessionSelected
                          ? 'border-primary-500 bg-primary-500 opacity-100 dark:border-primary-400 dark:bg-primary-500'
                          : 'opacity-0',
                      ].join(' ')}
                      aria-label={isPolish ? 'Zaznacz sesję' : 'Select session'}
                      aria-pressed={isSessionSelected}
                    >
                      {isSessionSelected ? <Check size={10} strokeWidth={3} /> : null}
                    </button>
                  </td>
                  <td className="px-3 py-3" style={{ width: sessionsColumnWidths.name }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${statusConfig.bgColor}`}
                      >
                        <Brain size={15} className={statusConfig.textColor} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm text-slate-900 dark:text-white font-medium block truncate">
                          {session.name || 'Discovery Interview'}
                        </span>
                        {showSessionRowDescription ? (
                          <span className="mt-0.5 block truncate text-[11px] font-normal leading-4 text-slate-950/65 dark:text-slate-100/55">
                            {isPolish ? 'Assignee' : 'Assignee'}: {primaryMeta}
                            {' · '}
                            {isPolish ? 'Template' : 'Template'}: {secondaryMeta}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  {!hiddenSet.has('status') && (
                    <td
                      className="px-3 py-3 text-center align-middle"
                      style={{ width: sessionsColumnWidths.status }}
                    >
                      <div
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${statusConfig.bgColor}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                        <span
                          className={`text-xs font-medium ${statusConfig.textColor} whitespace-nowrap`}
                        >
                          {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                        </span>
                      </div>
                    </td>
                  )}

                  {!hiddenSet.has('progress') && (
                    <td
                      className="px-3 py-3 text-center align-middle"
                      style={{ width: sessionsColumnWidths.progress }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex-1 max-w-[100px] h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progress === 100 ? 'bg-emerald-500' : 'bg-purple-500'
                            }`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-600 dark:text-slate-400">
                          {progress}%
                        </span>
                      </div>
                    </td>
                  )}

                  {!hiddenSet.has('date') && (
                    <td
                      className="px-3 py-3 text-center align-middle"
                      style={{ width: sessionsColumnWidths.date }}
                    >
                      <div className="flex items-center justify-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                        <Calendar size={12} />
                        {session.dueAt
                          ? `${isPolish ? 'Due' : 'Due'} ${new Date(session.dueAt).toLocaleDateString()}`
                          : new Date(session.startedAt).toLocaleDateString()}
                      </div>
                      {session.submittedAt && (
                        <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          {isPolish ? 'Submitted' : 'Submitted'}{' '}
                          {new Date(session.submittedAt).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                  )}

                  <td
                    className="px-3 py-3 text-right"
                    style={{ width: sessionsColumnWidths.actions }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end">
                      <RowActionsMenu
                        iconVariant="vertical"
                        className="opacity-40 transition-opacity group-hover:opacity-100"
                        actions={[
                          {
                            id: 'open',
                            label: isPolish ? 'Otwórz' : 'Open',
                            icon: ChevronRight,
                            onClick: () => handleViewSession(session),
                          },
                          ...(isSubmitted && linkedAssignment
                            ? [
                                {
                                  id: 'approve',
                                  label: isPolish ? 'Zatwierdź' : 'Approve',
                                  icon: Check,
                                  onClick: () => handleApproveAssignment(linkedAssignment),
                                },
                                {
                                  id: 'send-back',
                                  label: isPolish ? 'Odeślij' : 'Send back',
                                  icon: ArrowRight,
                                  onClick: () => handleOpenSendBackModal(linkedAssignment),
                                },
                              ]
                            : []),
                          ...(canRemind && linkedAssignment
                            ? [
                                {
                                  id: 'remind',
                                  label: isPolish ? 'Przypomnij' : 'Remind',
                                  icon: Clock,
                                  onClick: () => handleOpenReminderModal(linkedAssignment),
                                },
                              ]
                            : []),
                          ...(isApproved
                            ? [
                                {
                                  id: 'generate-insight',
                                  label: isPolish ? 'Generuj wnioski AI' : 'Generate AI insights',
                                  icon: Lightbulb,
                                  onClick: () => handleGenerateInsight(session, 'summary'),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <MessageSquare className="w-12 h-12 text-slate-600 mb-3" />
                    <p className="text-slate-600 dark:text-slate-400 text-sm">
                      {isPolish ? 'Brak sesji managera' : 'No manager sessions yet'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 max-w-md">
                      {isPolish
                        ? 'Tutaj pojawiają się wszystkie uruchomione sesje z workflow managera: w trakcie, wysłane, do poprawy i zatwierdzone.'
                        : 'This view shows manager workflow sessions across in progress, submitted, sent back, and approved states.'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Render grid view for sessions
  const renderSessionsGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredSessions.map((session) => {
        const progress = getSessionProgress(session);
        const workflowStatus = getSessionWorkflowStatus(session);
        const linkedAssignment = getManagedAssignmentForSession(session);
        const isApproved = ['approved', 'completed'].includes(workflowStatus);
        const isSubmitted = workflowStatus === 'submitted';
        const canRemind = ['in_progress', 'sent_back'].includes(workflowStatus);

        const statusConfig = getSessionStatusConfig(workflowStatus);
        const typeColor =
          workflowStatus === 'approved' || workflowStatus === 'completed'
            ? 'from-emerald-50 via-white to-white border-emerald-200 dark:from-emerald-500/20 dark:to-emerald-600/10 dark:border-emerald-500/30'
            : workflowStatus === 'in_progress'
              ? 'from-blue-50 via-white to-white border-blue-200 dark:from-purple-500/20 dark:to-purple-600/10 dark:border-purple-500/30'
              : workflowStatus === 'submitted'
                ? 'from-amber-50 via-white to-white border-amber-200 dark:from-amber-500/15 dark:to-amber-600/10 dark:border-amber-500/30'
                : workflowStatus === 'sent_back'
                  ? 'from-red-50 via-white to-white border-red-200 dark:from-rose-500/15 dark:to-rose-600/10 dark:border-rose-500/30'
                  : 'from-slate-50 via-white to-white border-slate-200 dark:from-slate-500/20 dark:to-slate-600/10 dark:border-slate-500/30';

        return (
          <div
            key={session.id}
            onClick={() => handleViewSession(session)}
            className={`group relative bg-gradient-to-br ${typeColor} border rounded-xl overflow-hidden cursor-pointer hover:shadow-lg hover:shadow-primary-500/10 hover:border-primary-500/30 transition-all duration-200`}
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
                          ? 'text-blue-600 dark:text-purple-400'
                          : workflowStatus === 'submitted'
                            ? 'text-amber-600 dark:text-amber-400'
                            : workflowStatus === 'sent_back'
                              ? 'text-red-600 dark:text-rose-400'
                              : 'text-slate-500 dark:text-slate-400'
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
              </div>
            </div>

            {/* Title */}
            <div className="px-4 pb-3">
              <h4 className="text-sm font-medium text-slate-900 dark:text-white line-clamp-2 min-h-[40px]">
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
                    className={`h-full rounded-full transition-all ${
                      progress === 100 ? 'bg-emerald-500' : 'bg-purple-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-600 dark:text-slate-400">{progress}%</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 flex items-center justify-between">
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${statusConfig.bgColor}`}
              >
                <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
                <span className={`text-xs font-medium ${statusConfig.textColor}`}>
                  {workflowStatus === 'approved' || workflowStatus === 'completed'
                    ? isPolish
                      ? 'Zatwierdzony'
                      : 'Approved'
                    : workflowStatus === 'in_progress'
                      ? isPolish
                        ? 'W trakcie'
                        : 'In Progress'
                      : workflowStatus === 'submitted'
                        ? isPolish
                          ? 'Wysłany'
                          : 'Submitted'
                        : workflowStatus === 'sent_back'
                          ? isPolish
                            ? 'Do poprawy'
                            : 'Sent back'
                          : workflowStatus}
                </span>
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {session.dueAt
                  ? `${isPolish ? 'Due' : 'Due'} ${new Date(session.dueAt).toLocaleDateString()}`
                  : new Date(session.startedAt).toLocaleDateString()}
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
                    {isPolish ? 'Zatwierdź' : 'Approve'}
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
                    {isPolish ? 'Odeślij' : 'Send back'}
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
                  {isPolish ? 'Przypomnij' : 'Remind'}
                </button>
              )}
              {isApproved && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateInsight(session, 'summary');
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-800 hover:bg-primary-100 dark:border-primary-500/30 dark:bg-primary-500/15 dark:text-primary-300 dark:hover:bg-primary-500/25 transition-colors"
                >
                  <Lightbulb size={12} />
                  {isPolish ? 'AI insight' : 'AI insight'}
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
    const configs: Record<
      string,
      { label: { en: string; pl: string }; bgColor: string; textColor: string }
    > = {
      summary: {
        label: { en: 'Executive Summary', pl: 'Executive Summary' },
        bgColor: 'bg-amber-500/20',
        textColor: 'text-amber-400',
      },
      trends: {
        label: { en: 'Trend Analysis', pl: 'Analiza trendów' },
        bgColor: 'bg-blue-500/20',
        textColor: 'text-blue-400',
      },
      problems: {
        label: { en: 'Problem Discovery', pl: 'Problemy' },
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
      },
      recommendations: {
        label: { en: 'Recommendations', pl: 'Rekomendacje' },
        bgColor: 'bg-emerald-500/20',
        textColor: 'text-emerald-400',
      },
      comparison: {
        label: { en: 'Comparison', pl: 'Porównanie' },
        bgColor: 'bg-purple-500/20',
        textColor: 'text-purple-400',
      },
      gaps: {
        label: { en: 'Gap Analysis', pl: 'Luki' },
        bgColor: 'bg-orange-500/20',
        textColor: 'text-orange-400',
      },
      risk_assessment: {
        label: { en: 'Risk Assessment', pl: 'Ryzyka' },
        bgColor: 'bg-red-500/20',
        textColor: 'text-red-400',
      },
      opportunity_scan: {
        label: { en: 'Opportunity Scan', pl: 'Szanse' },
        bgColor: 'bg-emerald-500/20',
        textColor: 'text-emerald-400',
      },
      maturity: {
        label: { en: 'Maturity', pl: 'Dojrzałość' },
        bgColor: 'bg-indigo-500/20',
        textColor: 'text-indigo-400',
      },
      stakeholder_map: {
        label: { en: 'Stakeholder Map', pl: 'Interesariusze' },
        bgColor: 'bg-slate-500/20',
        textColor: 'text-slate-400',
      },
      general: {
        label: { en: 'General', pl: 'Ogólny' },
        bgColor: 'bg-slate-500/20',
        textColor: 'text-slate-400',
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
      toast.success(isPolish ? 'Wyeksportowano do narzędzi' : 'Exported to tools');
      // Refresh insights
      const insightsRes = await V8InterviewApi.listInsights()
        .then((r) => r.insights)
        .catch(() => Api.get('/interview/insights').catch(() => []));
      setInsights(Array.isArray(insightsRes) ? insightsRes : []);
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się wyeksportować' : 'Failed to export');
      console.error('[InterviewHub] Failed to export insight:', error);
    }
  };

  const handleExportInsightToAssessment = async (insightId: string) => {
    try {
      await V8InterviewApi.exportInsight(insightId, { target: 'assessment' }).catch(() =>
        Api.post(`/interview/insights/${insightId}/export`, { target: 'assessment' })
      );
      toast.success(isPolish ? 'Wyeksportowano do Assessment' : 'Exported to Assessment');
      const insightsRes = await V8InterviewApi.listInsights()
        .then((r) => r.insights)
        .catch(() => Api.get('/interview/insights').catch(() => []));
      setInsights(Array.isArray(insightsRes) ? insightsRes : []);
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się wyeksportować' : 'Failed to export');
      console.error('[InterviewHub] Failed to export insight to assessment:', error);
    }
  };

  // Handle delete insight
  const handleDeleteInsight = async (insightId: string) => {
    if (
      !confirm(
        isPolish
          ? 'Czy na pewno chcesz usunąć ten wniosek?'
          : 'Are you sure you want to delete this insight?'
      )
    ) {
      return;
    }
    try {
      await V8InterviewApi.deleteInsight(insightId).catch(() =>
        Api.delete(`/interview/insights/${insightId}`)
      );
      toast.success(isPolish ? 'Wniosek usunięty' : 'Insight deleted');
      setInsights((prev) => prev.filter((i) => i.id !== insightId));
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się usunąć' : 'Failed to delete');
      console.error('[InterviewHub] Failed to delete insight:', error);
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
    const hiddenSet = new Set(insightsHiddenColumns);
    const visibleInsightIds = rows.map((insight) => insight.id);
    const selectedVisibleCount = visibleInsightIds.filter((id) =>
      selectedInsightIds.has(id)
    ).length;
    const allVisibleSelected =
      visibleInsightIds.length > 0 && selectedVisibleCount === visibleInsightIds.length;
    const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
    const visibleColumns = [
      'select',
      'title',
      ...(!hiddenSet.has('type') ? ['type'] : []),
      ...(!hiddenSet.has('status') ? ['status'] : []),
      ...(!hiddenSet.has('source') ? ['source'] : []),
      ...(!hiddenSet.has('date') ? ['date'] : []),
      'actions',
    ];
    const tableMinWidth = visibleColumns.reduce(
      (sum, columnId) => sum + (insightColumnWidths[columnId] ?? 120),
      0
    );
    const toggleInsightSelection = (insightId: string) => {
      setSelectedInsightIds((prev) => {
        const next = new Set(prev);
        if (next.has(insightId)) next.delete(insightId);
        else next.add(insightId);
        return next;
      });
    };
    const toggleAllVisibleInsights = () => {
      setSelectedInsightIds((prev) => {
        const next = new Set(prev);
        if (allVisibleSelected) {
          visibleInsightIds.forEach((id) => next.delete(id));
        } else {
          visibleInsightIds.forEach((id) => next.add(id));
        }
        return next;
      });
    };
    const handleInsightColumnResize = (columnId: string, newWidth: number) => {
      setInsightColumnWidths((prev) => {
        const currentIndex = visibleColumns.indexOf(columnId);
        const nextColumnId = visibleColumns[currentIndex + 1];
        if (currentIndex < 0 || !nextColumnId) return prev;

        const current = prev[columnId] ?? INTERVIEW_INSIGHTS_TABLE_DEFAULT_WIDTHS[columnId];
        const next = prev[nextColumnId] ?? INTERVIEW_INSIGHTS_TABLE_DEFAULT_WIDTHS[nextColumnId];
        const currentBounds = INTERVIEW_INSIGHTS_TABLE_RESIZE_BOUNDS[columnId];
        const nextBounds = INTERVIEW_INSIGHTS_TABLE_RESIZE_BOUNDS[nextColumnId];
        const requestedDelta = newWidth - current;
        const minDelta = Math.max(currentBounds.minWidth - current, next - nextBounds.maxWidth);
        const maxDelta = Math.min(currentBounds.maxWidth - current, next - nextBounds.minWidth);
        const delta = Math.max(minDelta, Math.min(maxDelta, requestedDelta));
        if (delta === 0) return prev;

        return {
          ...prev,
          [columnId]: current + delta,
          [nextColumnId]: next - delta,
        };
      });
    };
    const renderInsightResizer = (columnId: string) => {
      if (visibleColumns[visibleColumns.indexOf(columnId) + 1] == null) return null;
      const bounds = INTERVIEW_INSIGHTS_TABLE_RESIZE_BOUNDS[columnId];
      return (
        <ColumnResizer
          columnId={columnId}
          currentWidth={
            insightColumnWidths[columnId] ?? INTERVIEW_INSIGHTS_TABLE_DEFAULT_WIDTHS[columnId]
          }
          minWidth={bounds.minWidth}
          maxWidth={bounds.maxWidth}
          onResize={handleInsightColumnResize}
        />
      );
    };
    const typeCol: ColumnDef = {
      id: 'type',
      label: isPolish ? 'Typ' : 'Type',
      width: insightColumnWidths.type ?? INTERVIEW_INSIGHTS_TABLE_DEFAULT_WIDTHS.type,
      minWidth: INTERVIEW_INSIGHTS_TABLE_RESIZE_BOUNDS.type.minWidth,
      maxWidth: INTERVIEW_INSIGHTS_TABLE_RESIZE_BOUNDS.type.maxWidth,
      resizable: true,
      filterable: true,
      filterType: 'multiselect',
      filterOptions: INSIGHT_TYPE_FILTER_OPTIONS,
    };
    const statusCol: ColumnDef = {
      id: 'status',
      label: isPolish ? 'Status' : 'Status',
      width: insightColumnWidths.status ?? INTERVIEW_INSIGHTS_TABLE_DEFAULT_WIDTHS.status,
      minWidth: INTERVIEW_INSIGHTS_TABLE_RESIZE_BOUNDS.status.minWidth,
      maxWidth: INTERVIEW_INSIGHTS_TABLE_RESIZE_BOUNDS.status.maxWidth,
      resizable: true,
      filterable: true,
      filterType: 'multiselect',
      filterOptions: INSIGHT_STATUS_FILTER_OPTIONS,
    };

    return (
      <div className="bg-white/70 dark:bg-navy-900/70 border border-slate-200/70 dark:border-white/[0.06] rounded-xl backdrop-blur overflow-hidden">
        <table className="w-full table-fixed" style={{ minWidth: tableMinWidth }}>
          <thead>
            <tr className="border-b border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-navy-900/40">
              <th className="px-3 py-2 text-left" style={{ width: insightColumnWidths.select }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAllVisibleInsights();
                  }}
                  className={[
                    'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-all duration-150',
                    'border-slate-300 bg-white/80 text-white hover:border-primary-400 hover:bg-white dark:border-white/[0.14] dark:bg-white/[0.035]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35',
                    allVisibleSelected || someVisibleSelected
                      ? 'border-primary-500 bg-primary-500 opacity-100 dark:border-primary-400 dark:bg-primary-500'
                      : 'opacity-70',
                  ].join(' ')}
                  aria-label={isPolish ? 'Zaznacz widoczne wnioski' : 'Select visible insights'}
                  aria-pressed={allVisibleSelected}
                >
                  {allVisibleSelected ? <Check size={10} strokeWidth={3} /> : null}
                  {someVisibleSelected ? <Minus size={10} strokeWidth={3} /> : null}
                </button>
              </th>
              <th
                className="relative px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: insightColumnWidths.title }}
              >
                {isPolish ? 'Tytuł' : 'Title'}
                {renderInsightResizer('title')}
              </th>
              {!hiddenSet.has('type') && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  style={{ width: typeCol.width, minWidth: typeCol.minWidth }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className={
                        (insightTableFilters.type as string[] | undefined)?.length
                          ? 'text-primary-500'
                          : ''
                      }
                    >
                      {typeCol.label}
                    </span>
                    <FilterDropdown
                      column={typeCol}
                      value={insightTableFilters.type as string[] | undefined}
                      onChange={(v) =>
                        setInsightTableFilters((f) => ({ ...f, type: v as string[] }))
                      }
                      isOpen={openInsightFilterId === 'type'}
                      onToggle={() =>
                        setOpenInsightFilterId((id) => (id === 'type' ? null : 'type'))
                      }
                      onClose={() => setOpenInsightFilterId(null)}
                    />
                  </div>
                  {renderInsightResizer('type')}
                </th>
              )}
              {!hiddenSet.has('status') && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  style={{ width: statusCol.width, minWidth: statusCol.minWidth }}
                >
                  <div className="flex items-center justify-center gap-1">
                    <span
                      className={
                        (insightTableFilters.status as string[] | undefined)?.length
                          ? 'text-primary-500'
                          : ''
                      }
                    >
                      {statusCol.label}
                    </span>
                    <FilterDropdown
                      column={statusCol}
                      value={insightTableFilters.status as string[] | undefined}
                      onChange={(v) =>
                        setInsightTableFilters((f) => ({ ...f, status: v as string[] }))
                      }
                      isOpen={openInsightFilterId === 'status'}
                      onToggle={() =>
                        setOpenInsightFilterId((id) => (id === 'status' ? null : 'status'))
                      }
                      onClose={() => setOpenInsightFilterId(null)}
                    />
                  </div>
                  {renderInsightResizer('status')}
                </th>
              )}
              {!hiddenSet.has('source') && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  style={{ width: insightColumnWidths.source }}
                >
                  {isPolish ? 'Źródło' : 'Source'}
                  {renderInsightResizer('source')}
                </th>
              )}
              {!hiddenSet.has('date') && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  style={{ width: insightColumnWidths.date }}
                >
                  {isPolish ? 'Data' : 'Date'}
                  {renderInsightResizer('date')}
                </th>
              )}
              <th
                className="relative px-3 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: insightColumnWidths.actions }}
              >
                <div ref={insightsViewSettingsRef} className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setIsInsightsViewSettingsOpen((open) => !open);
                    }}
                    className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                    aria-label={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
                    aria-expanded={isInsightsViewSettingsOpen}
                    title={isPolish ? 'Ustawienia widoku' : 'View settings'}
                  >
                    <Settings2 size={14} />
                  </button>
                  {isInsightsViewSettingsOpen ? (
                    <div
                      className="absolute right-3 top-[calc(100%+8px)] z-50 w-72 rounded-2xl border border-slate-200/80 bg-white p-2 text-left normal-case tracking-normal shadow-xl shadow-slate-900/12 dark:border-white/[0.08] dark:bg-navy-900 dark:shadow-black/35"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Widoczne kolumny' : 'Visible columns'}
                      </div>
                      {(
                        [
                          { id: 'type', label: isPolish ? 'Typ' : 'Type' },
                          { id: 'status', label: isPolish ? 'Status' : 'Status' },
                          { id: 'source', label: isPolish ? 'Źródło' : 'Source' },
                          { id: 'date', label: isPolish ? 'Data' : 'Date' },
                        ] as const
                      ).map((column) => {
                        const checked = !hiddenSet.has(column.id);
                        return (
                          <label
                            key={column.id}
                            className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.04]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setInsightsHiddenColumns((prev) => {
                                  const set = new Set(prev);
                                  if (set.has(column.id)) set.delete(column.id);
                                  else set.add(column.id);
                                  const next = Array.from(set);
                                  saveHiddenColumns(
                                    INTERVIEW_INSIGHTS_TABLE_VIEW_STORAGE_KEY,
                                    next
                                  );
                                  return next;
                                });
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-white/[0.18] dark:bg-white/[0.04]"
                            />
                            <span>{column.label}</span>
                          </label>
                        );
                      })}
                      <div className="my-2 border-t border-slate-200/70 dark:border-white/[0.08]" />
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.04]">
                        <input
                          type="checkbox"
                          checked={showInsightRowDescription}
                          onChange={(event) => {
                            setShowInsightRowDescription(event.target.checked);
                            saveBooleanSetting(
                              INTERVIEW_INSIGHTS_ROW_DESCRIPTION_STORAGE_KEY,
                              event.target.checked
                            );
                          }}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-white/[0.18] dark:bg-white/[0.04]"
                        />
                        <span>
                          {isPolish ? 'Pokaż opis / uzasadnienie' : 'Show row description'}
                        </span>
                      </label>
                    </div>
                  ) : null}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((insight) => {
              const promptType =
                (insight as any).promptType || (insight as any).insightType || 'summary';
              const topicCollections = [
                ...(((insight as any).themes as Array<any>) || []),
                ...(((insight as any).issues as Array<any>) || []),
                ...(((insight as any).opportunities as Array<any>) || []),
              ];
              const crossPerspectiveCount = topicCollections.filter(
                (item) => item?.crossSessionPattern
              ).length;
              const divergenceCount = topicCollections.filter(
                (item) => item?.divergence_note
              ).length;
              const typeConfig = getInsightTypeConfig(promptType);
              const status = ((insight.reviewStatus === 'in_review' ||
              insight.reviewStatus === 'published'
                ? insight.reviewStatus
                : insight.status) || 'completed') as
                | 'draft'
                | 'generating'
                | 'completed'
                | 'in_review'
                | 'published'
                | 'failed';
              const statusConfig: Record<
                typeof status,
                { label: { en: string; pl: string }; bg: string; text: string }
              > = {
                draft: {
                  label: { en: 'Draft', pl: 'Szkic' },
                  bg: 'bg-slate-500/20',
                  text: 'text-slate-400',
                },
                generating: {
                  label: { en: 'Generating', pl: 'Generowanie' },
                  bg: 'bg-amber-500/20',
                  text: 'text-amber-400',
                },
                completed: {
                  label: { en: 'Completed', pl: 'Gotowe' },
                  bg: 'bg-emerald-500/20',
                  text: 'text-emerald-400',
                },
                in_review: {
                  label: { en: 'In Review', pl: 'W recenzji' },
                  bg: 'bg-blue-500/20',
                  text: 'text-blue-400',
                },
                published: {
                  label: { en: 'Published', pl: 'Opublikowane' },
                  bg: 'bg-violet-500/20',
                  text: 'text-violet-400',
                },
                failed: {
                  label: { en: 'Failed', pl: 'Błąd' },
                  bg: 'bg-red-500/20',
                  text: 'text-red-400',
                },
              };
              const sc = statusConfig[status] || statusConfig.completed;

              const isSelected = opts?.selectedId === insight.id;
              const isInsightSelected = selectedInsightIds.has(insight.id);
              const rowDescription = String(
                insight.description || insight.content || insight.sourceQuote || ''
              ).trim();
              const handleClick = opts?.onRowClick
                ? () => opts.onRowClick!(insight.id)
                : () => handleViewInsight(insight);
              const handleDoubleClick = opts?.onRowDoubleClick
                ? () => opts.onRowDoubleClick!(insight.id)
                : undefined;

              return (
                <tr
                  key={insight.id}
                  onClick={handleClick}
                  onDoubleClick={handleDoubleClick}
                  className={`group cursor-pointer transition-colors border-b border-slate-200/50 dark:border-navy-700/50 last:border-0 ${
                    isSelected || isInsightSelected
                      ? 'bg-primary-50 dark:bg-primary-500/[0.14] shadow-[inset_4px_0_0_theme(colors.primary.500)] ring-1 ring-primary-500/25 ring-inset'
                      : 'hover:bg-slate-50 dark:hover:bg-navy-800/50'
                  }`}
                >
                  <td className="px-3 py-3" style={{ width: insightColumnWidths.select }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleInsightSelection(insight.id);
                      }}
                      className={[
                        'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-all duration-150',
                        'border-slate-300 bg-white/80 text-white hover:border-primary-400 group-hover:opacity-100 group-hover:bg-white/90',
                        'dark:border-white/[0.14] dark:bg-white/[0.035] dark:group-hover:bg-white/[0.08]',
                        'focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35',
                        'group-focus-within:opacity-100 group-focus-within:border-primary-400',
                        isInsightSelected
                          ? 'border-primary-500 bg-primary-500 opacity-100 dark:border-primary-400 dark:bg-primary-500'
                          : 'opacity-0',
                      ].join(' ')}
                      aria-label={isPolish ? 'Zaznacz wniosek' : 'Select insight'}
                      aria-pressed={isInsightSelected}
                    >
                      {isInsightSelected ? <Check size={10} strokeWidth={3} /> : null}
                    </button>
                  </td>
                  <td className="px-3 py-3" style={{ width: insightColumnWidths.title }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${typeConfig.bgColor}`}
                      >
                        <Lightbulb size={15} className={typeConfig.textColor} />
                      </div>
                      <div className="min-w-0">
                        <span
                          className="text-sm text-slate-900 dark:text-white font-medium block truncate"
                          title={insight.title}
                        >
                          {insight.title}
                        </span>
                        {showInsightRowDescription && rowDescription ? (
                          <span
                            className="mt-0.5 block truncate text-[11px] font-normal leading-4 text-slate-950/65 dark:text-slate-100/55"
                            title={rowDescription}
                          >
                            {rowDescription}
                          </span>
                        ) : null}
                        {(crossPerspectiveCount > 0 || divergenceCount > 0) && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {crossPerspectiveCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-300">
                                <Users size={10} />
                                {crossPerspectiveCount} {isPolish ? 'cross-role' : 'cross-role'}
                              </span>
                            )}
                            {divergenceCount > 0 && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-700 dark:text-amber-300">
                                <AlertTriangle size={10} />
                                {divergenceCount} {isPolish ? 'rozjazdów' : 'divergences'}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  {!hiddenSet.has('type') && (
                    <td
                      className="px-3 py-3 text-center align-middle"
                      style={{ width: insightColumnWidths.type }}
                    >
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${typeConfig.bgColor} ${typeConfig.textColor}`}
                      >
                        {isPolish ? typeConfig.label.pl : typeConfig.label.en}
                      </span>
                    </td>
                  )}
                  {!hiddenSet.has('status') && (
                    <td
                      className="px-3 py-3 text-center align-middle"
                      style={{ width: insightColumnWidths.status }}
                    >
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                      >
                        {isPolish ? sc.label.pl : sc.label.en}
                      </span>
                    </td>
                  )}
                  {!hiddenSet.has('source') && (
                    <td
                      className="px-3 py-3 text-center align-middle"
                      style={{ width: insightColumnWidths.source }}
                    >
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {insight.sourceSessionCount
                          ? `${insight.sourceSessionCount} ${isPolish ? 'sesji' : 'sessions'}`
                          : insight.sessionId
                            ? `1 ${isPolish ? 'sesji' : 'session'}`
                            : '-'}
                      </span>
                    </td>
                  )}
                  {!hiddenSet.has('date') && (
                    <td
                      className="px-3 py-3 text-center align-middle text-xs text-slate-500 dark:text-slate-400"
                      style={{ width: insightColumnWidths.date }}
                    >
                      {insight.createdAt ? new Date(insight.createdAt).toLocaleDateString() : '-'}
                    </td>
                  )}
                  <td
                    className="px-3 py-3 text-right"
                    style={{ width: insightColumnWidths.actions }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end">
                      <RowActionsMenu
                        iconVariant="vertical"
                        className="opacity-40 transition-opacity group-hover:opacity-100"
                        actions={[
                          {
                            id: 'open',
                            label: isPolish ? 'Otwórz' : 'Open',
                            icon: ChevronRight,
                            onClick: () => handleViewInsight(insight),
                          },
                          {
                            id: 'export-tools',
                            label: insight.exportedToTools
                              ? isPolish
                                ? 'Wyeksportowano do Tools'
                                : 'Exported to Tools'
                              : isPolish
                                ? 'Eksportuj do Tools'
                                : 'Export to Tools',
                            icon: Send,
                            onClick: () =>
                              !insight.exportedToTools && handleExportInsightToTools(insight.id),
                            disabled: !!insight.exportedToTools,
                          },
                          {
                            id: 'export-assessment',
                            label: insight.exportedToAssessment
                              ? isPolish
                                ? 'Wyeksportowano do Assessment'
                                : 'Exported to Assessment'
                              : isPolish
                                ? 'Eksportuj do Assessment'
                                : 'Export to Assessment',
                            icon: FileText,
                            onClick: () =>
                              !insight.exportedToAssessment &&
                              handleExportInsightToAssessment(insight.id),
                            disabled: !!insight.exportedToAssessment,
                          },
                          {
                            id: 'download',
                            label: isPolish ? 'Pobierz' : 'Download',
                            icon: Download,
                            onClick: () => {
                              const promptType =
                                (insight as any).promptType ||
                                (insight as any).insightType ||
                                'summary';
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
                          {
                            id: 'delete',
                            label: isPolish ? 'Usuń' : 'Delete',
                            icon: Trash2,
                            onClick: () => handleDeleteInsight(insight.id),
                            variant: 'danger',
                            divider: true,
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={visibleColumns.length} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <Lightbulb className="w-12 h-12 text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                      {isPolish ? 'Brak wniosków' : 'No insights yet'}
                    </p>
                    <p className="text-xs text-slate-500 mb-4 max-w-md">
                      {isPolish
                        ? 'Wnioski są generowane automatycznie przez AI na podstawie zakończonych wywiadów. Kliknij "Nowy Insight" aby wygenerować wnioski z wybranych sesji.'
                        : 'Insights are generated automatically by AI based on completed interviews. Click "New Insight" to generate insights from selected sessions.'}
                    </p>
                    <button
                      onClick={() => {
                        if (!canCreateInsights) return;
                        setSelectedSessionsForInsight([]);
                        setShowInsightModal(true);
                      }}
                      disabled={!canCreateInsights}
                      className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-400/30 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
                    >
                      <Sparkles size={16} />
                      {isPolish ? 'Generuj wnioski AI' : 'Generate AI Insights'}
                    </button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Render templates table (Resizable + Preview-ready)
  const renderTemplatesTable = (opts?: {
    onSelectRow?: (id: string) => void;
    onOpenFull?: (id: string) => void;
  }) => {
    const hiddenSet = new Set(templatesHiddenColumns);
    const colSpan =
      1 +
      (!hiddenSet.has('category') ? 1 : 0) +
      (!hiddenSet.has('questions') ? 1 : 0) +
      (!hiddenSet.has('status') ? 1 : 0) +
      1;

    const handleResize = (columnId: string, newWidth: number) => {
      setTemplatesColumnWidths((prev: ColumnWidths) => ({ ...prev, [columnId]: newWidth }));
    };

    return (
      <div className="bg-white/70 dark:bg-navy-900/70 border border-slate-200/70 dark:border-white/[0.06] rounded-xl backdrop-blur overflow-hidden">
        <table className="w-full table-fixed" style={{ minWidth: 820 }}>
          <thead>
            <tr className="border-b border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-navy-900/40 sticky top-0 z-10">
              <th
                className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header w-full"
                style={{ width: templatesColumnWidths.name }}
              >
                <div className="flex items-center gap-1">
                  <span>{isPolish ? 'Nazwa' : 'Name'}</span>
                </div>
                <ColumnResizer
                  columnId="name"
                  currentWidth={templatesColumnWidths.name}
                  minWidth={260}
                  maxWidth={900}
                  onResize={handleResize}
                />
              </th>

              {!hiddenSet.has('category') && (
                <th
                  className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                  style={{ width: templatesColumnWidths.category }}
                >
                  <div className="flex items-center gap-1">
                    <span>{isPolish ? 'Kategoria' : 'Category'}</span>
                  </div>
                  <ColumnResizer
                    columnId="category"
                    currentWidth={templatesColumnWidths.category}
                    minWidth={120}
                    maxWidth={360}
                    onResize={handleResize}
                  />
                </th>
              )}

              {!hiddenSet.has('questions') && (
                <th
                  className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                  style={{ width: templatesColumnWidths.questions }}
                >
                  <div className="flex items-center gap-1">
                    <span>{isPolish ? 'Pytania' : 'Questions'}</span>
                  </div>
                  <ColumnResizer
                    columnId="questions"
                    currentWidth={templatesColumnWidths.questions}
                    minWidth={70}
                    maxWidth={140}
                    onResize={handleResize}
                  />
                </th>
              )}

              {!hiddenSet.has('status') && (
                <th
                  className="px-4 py-3 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider relative group/header"
                  style={{ width: templatesColumnWidths.status }}
                >
                  <div className="flex items-center gap-1">
                    <span>{isPolish ? 'Status' : 'Status'}</span>
                  </div>
                  <ColumnResizer
                    columnId="status"
                    currentWidth={templatesColumnWidths.status}
                    minWidth={110}
                    maxWidth={220}
                    onResize={handleResize}
                  />
                </th>
              )}

              <th
                className="px-4 py-3 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: templatesColumnWidths.actions }}
              >
                <button
                  onClick={() => setIsTemplatesViewSettingsOpen(true)}
                  className="inline-flex items-center justify-center h-8 w-8 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98]"
                  aria-label={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
                  title={isPolish ? 'Ustawienia widoku' : 'View settings'}
                >
                  <Settings2 size={14} />
                </button>
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredTemplates.map((template) => {
              const isSelected = selectedTemplateId === template.id;
              const select = () => {
                setSelectedTemplateId(template.id);
                opts?.onSelectRow?.(template.id);
              };
              const openFull = () => opts?.onOpenFull?.(template.id);

              return (
                <tr
                  key={template.id}
                  onClick={select}
                  onDoubleClick={openFull}
                  className={`group cursor-pointer transition-colors border-b border-slate-200/50 dark:border-navy-700/50 last:border-0 ${
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-navy-800/50'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    const target = e.target as HTMLElement;
                    if (
                      target.tagName === 'INPUT' ||
                      target.tagName === 'TEXTAREA' ||
                      target.isContentEditable
                    )
                      return;
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      openFull();
                    }
                    if (e.key === ' ') {
                      e.preventDefault();
                      select();
                    }
                    if (e.key === 'Escape') {
                      e.preventDefault();
                      setSelectedTemplateId(null);
                    }
                  }}
                >
                  {/* Name (title only) */}
                  <td className="px-4 py-3" style={{ width: templatesColumnWidths.name }}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/20">
                          <FileText size={16} className="text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <span
                            className="text-sm text-slate-900 dark:text-white font-medium block truncate"
                            title={template.name}
                          >
                            {template.name}
                          </span>
                          <div className="hidden group-hover:flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {template.description ? (
                              <span className="truncate" title={template.description}>
                                {template.description}
                              </span>
                            ) : null}
                            {template.scope ? (
                              <span className="px-1.5 py-0.5 rounded-full border border-slate-200/70 dark:border-white/[0.08]">
                                {getTemplateSourceLabel(template.scope, isPolish)}
                              </span>
                            ) : null}
                            {(template.areaTags || []).slice(0, 2).map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 rounded-full border border-slate-200/70 dark:border-white/[0.08]"
                              >
                                {getTemplateAreaTagLabel(tag, isPolish)}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>

                  {!hiddenSet.has('category') && (
                    <td className="px-4 py-3" style={{ width: templatesColumnWidths.category }}>
                      <span className="px-2 py-1 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-xs rounded-full">
                        {template.category}
                      </span>
                    </td>
                  )}

                  {!hiddenSet.has('questions') && (
                    <td
                      className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400"
                      style={{ width: templatesColumnWidths.questions }}
                    >
                      {template.questionCount}
                    </td>
                  )}

                  {!hiddenSet.has('status') && (
                    <td className="px-4 py-3" style={{ width: templatesColumnWidths.status }}>
                      {template.isDefault ? (
                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                          {isPolish ? 'Domyślny' : 'Default'}
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                          {isPolish ? 'Aktywny' : 'Active'}
                        </span>
                      )}
                    </td>
                  )}

                  {/* Actions */}
                  <td
                    className="px-4 py-3 text-right"
                    style={{ width: templatesColumnWidths.actions }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end">
                      <RowActionsMenu
                        iconVariant="vertical"
                        actions={[
                          {
                            id: 'open',
                            label: isPolish ? 'Otwórz' : 'Open',
                            icon: ChevronRight,
                            onClick: () => handleViewTemplate(template),
                          },
                          ...(canAssign
                            ? [
                                {
                                  id: 'assign',
                                  label: isPolish ? 'Przydziel' : 'Assign',
                                  icon: UserPlus,
                                  onClick: () => {
                                    setSelectedTemplateForAssign(template);
                                    setShowAssignModal(true);
                                  },
                                },
                              ]
                            : []),
                          {
                            id: 'use',
                            label: isPolish ? 'Użyj szablonu' : 'Use template',
                            icon: Sparkles,
                            onClick: async () => {
                              const projectId = await ensureProjectId();
                              if (!projectId) {
                                toast.error(
                                  isPolish
                                    ? 'Wybierz projekt przed utworzeniem sesji'
                                    : 'Select a project before creating a session'
                                );
                                return;
                              }
                              Api.post(`/interview/templates/${template.id}/use`, {
                                projectId,
                                name: `${template.name} ${new Date().toLocaleDateString()}`,
                              })
                                .then((created) => {
                                  const newSession = created as InterviewSession;
                                  setSessions((prev) => [newSession, ...prev]);
                                  handleOpenDocument({
                                    id: newSession.id,
                                    type: 'interview_session',
                                    subType: 'interview',
                                    name: newSession.name || 'Interview Session',
                                    status: (
                                      (newSession as any)?.status || 'in_progress'
                                    ).toUpperCase() as any,
                                  });
                                  toast.success(isPolish ? 'Sesja utworzona' : 'Session created');
                                })
                                .catch(() => {
                                  toast.error(
                                    isPolish
                                      ? 'Nie udało się utworzyć sesji'
                                      : 'Failed to create session'
                                  );
                                });
                            },
                          },
                          {
                            id: 'clone',
                            label: isPolish ? 'Klonuj szablon' : 'Clone template',
                            icon: Copy,
                            onClick: () => handleCloneTemplate(template),
                          },
                          ...(canAssign
                            ? [
                                {
                                  id: 'edit',
                                  label: isPolish ? 'Edytuj szablon' : 'Edit template',
                                  icon: Edit3,
                                  onClick: () => handleEditTemplate(template.id),
                                },
                              ]
                            : []),
                          ...(canAssign && !template.isDefault
                            ? [
                                {
                                  id: 'delete',
                                  label: isPolish ? 'Usuń szablon' : 'Delete template',
                                  icon: Trash2,
                                  onClick: () => handleDeleteTemplate(template),
                                  variant: 'danger' as const,
                                  divider: true,
                                },
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}

            {filteredTemplates.length === 0 && (
              <tr>
                <td colSpan={colSpan} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <FileText className="w-12 h-12 text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                      {isPolish ? 'Brak szablonów' : 'No templates yet'}
                    </p>
                    {canAssign && (
                      <button
                        onClick={handleNewTemplate}
                        className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-400/30 hover:from-amber-400 hover:to-amber-500 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
                      >
                        <FilePlus size={16} />
                        {isPolish ? 'Nowy szablon' : 'New template'}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const renderTemplatesCards = (opts?: {
    onSelectRow?: (id: string) => void;
    onOpenFull?: (id: string) => void;
  }) => {
    if (filteredTemplates.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={40} className="text-slate-300 dark:text-navy-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isPolish ? 'Brak szablonów' : 'No templates found'}
          </p>
          {canAssign && (
            <button
              onClick={handleNewTemplate}
              className="mt-4 inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-400/30 hover:from-amber-400 hover:to-amber-500 transition-colors active:scale-[0.98]"
            >
              <FilePlus size={16} />
              {isPolish ? 'Nowy szablon' : 'New template'}
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
            ? isPolish
              ? 'Systemowy'
              : 'System'
            : isOrg
              ? isPolish
                ? 'Organizacja'
                : 'Organization'
              : isPolish
                ? 'Prywatny'
                : 'Private';
          const scopeColor = isSystem
            ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400'
            : isOrg
              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
              : 'bg-slate-500/10 text-slate-600 dark:text-slate-400';
          const statusLabel =
            template.status === 'approved'
              ? isPolish
                ? 'Opublikowany'
                : 'Published'
              : isPolish
                ? 'Wersja robocza'
                : 'Draft';
          const statusColor =
            template.status === 'approved'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
          const areaTags = normalizeInterviewTemplateAreaTags(template.areaTags);

          return (
            <button
              key={template.id}
              type="button"
              onClick={() => {
                setSelectedTemplateId(template.id);
                opts?.onSelectRow?.(template.id);
              }}
              onDoubleClick={() => {
                opts?.onOpenFull?.(template.id);
              }}
              className={`group relative flex flex-col text-left rounded-2xl border transition-all hover:shadow-lg ${
                selectedTemplateId === template.id
                  ? 'border-primary-500/40 bg-primary-500/5 dark:bg-primary-500/10 shadow-md'
                  : 'border-slate-200/60 dark:border-navy-700/60 bg-white dark:bg-navy-900 hover:border-slate-300 dark:hover:border-navy-600'
              }`}
            >
              <div className="p-4 flex-1 space-y-3">
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
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary-500/10 text-primary-600 dark:text-primary-400">
                      Default
                    </span>
                  )}
                </div>

                <h3 className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug">
                  {template.name}
                </h3>

                {template.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {template.description}
                  </p>
                )}

                {areaTags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {areaTags.slice(0, 4).map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400"
                      >
                        {getTemplateAreaTagLabel(tag, isPolish)}
                      </span>
                    ))}
                    {areaTags.length > 4 && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        +{areaTags.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="px-4 py-3 border-t border-slate-100 dark:border-navy-800 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                <span>
                  {template.questionCount} {isPolish ? 'pytań' : 'questions'}
                </span>
                {template.estimatedTimeMinutes && <span>{template.estimatedTimeMinutes} min</span>}
                <span>{template.category}</span>
              </div>
            </button>
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

  // Sorting state for assignments
  const [assignmentSortField, setAssignmentSortField] = useState<
    'dueAt' | 'status' | 'progress' | null
  >('dueAt');
  const [assignmentSortAsc, setAssignmentSortAsc] = useState(true);

  // Table View Settings — Assignments (Inbox + Managed)
  const [inboxHiddenColumns, setInboxHiddenColumns] = useState<string[]>(() =>
    loadInterviewAssignmentsHiddenColumns(INTERVIEW_INBOX_TABLE_VIEW_STORAGE_KEY, true)
  );
  const [inboxAssignmentColumnWidths, setInboxAssignmentColumnWidths] = useState<ColumnWidths>({
    ...INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_WIDTHS,
  });
  const [showInboxAssignmentRowDescription, setShowInboxAssignmentRowDescription] = useState(() =>
    loadBooleanSetting(INTERVIEW_INBOX_ROW_DESCRIPTION_STORAGE_KEY, true)
  );
  const [managedHiddenColumns, setManagedHiddenColumns] = useState<string[]>(() =>
    loadInterviewAssignmentsHiddenColumns(
      INTERVIEW_MANAGED_ASSIGNMENTS_TABLE_VIEW_STORAGE_KEY,
      true
    )
  );
  const [managedAssignmentColumnWidths, setManagedAssignmentColumnWidths] = useState<ColumnWidths>({
    ...INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_WIDTHS,
  });
  const [showManagedAssignmentRowDescription, setShowManagedAssignmentRowDescription] = useState(
    () => loadBooleanSetting(INTERVIEW_MANAGED_ASSIGNMENTS_ROW_DESCRIPTION_STORAGE_KEY, true)
  );
  const [isAssignmentsViewSettingsOpen, setIsAssignmentsViewSettingsOpen] = useState(false);
  const [assignmentsViewSettingsShowAssignee, setAssignmentsViewSettingsShowAssignee] =
    useState(false);
  const assignmentsViewSettingsRef = useRef<HTMLDivElement | null>(null);

  const assignmentsViewStorageKey = assignmentsViewSettingsShowAssignee
    ? INTERVIEW_MANAGED_ASSIGNMENTS_TABLE_VIEW_STORAGE_KEY
    : INTERVIEW_INBOX_TABLE_VIEW_STORAGE_KEY;
  const assignmentsViewHiddenColumns = assignmentsViewSettingsShowAssignee
    ? managedHiddenColumns
    : inboxHiddenColumns;
  const assignmentsViewHiddenSet = useMemo(
    () => new Set(assignmentsViewHiddenColumns),
    [assignmentsViewHiddenColumns]
  );
  const updateAssignmentsViewHiddenColumns = useCallback(
    (updater: (prev: string[]) => string[]) => {
      if (assignmentsViewSettingsShowAssignee) {
        setManagedHiddenColumns(updater);
      } else {
        setInboxHiddenColumns(updater);
      }
    },
    [assignmentsViewSettingsShowAssignee]
  );
  const assignmentsViewShowRowDescription = assignmentsViewSettingsShowAssignee
    ? showManagedAssignmentRowDescription
    : showInboxAssignmentRowDescription;
  const updateAssignmentsViewShowRowDescription = useCallback(
    (next: boolean) => {
      if (assignmentsViewSettingsShowAssignee) {
        setShowManagedAssignmentRowDescription(next);
        saveBooleanSetting(INTERVIEW_MANAGED_ASSIGNMENTS_ROW_DESCRIPTION_STORAGE_KEY, next);
      } else {
        setShowInboxAssignmentRowDescription(next);
        saveBooleanSetting(INTERVIEW_INBOX_ROW_DESCRIPTION_STORAGE_KEY, next);
      }
    },
    [assignmentsViewSettingsShowAssignee]
  );

  useEffect(() => {
    if (!isAssignmentsViewSettingsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (assignmentsViewSettingsRef.current?.contains(event.target as Node)) return;
      setIsAssignmentsViewSettingsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsAssignmentsViewSettingsOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isAssignmentsViewSettingsOpen]);

  const toggleAssignmentSort = (field: 'dueAt' | 'status' | 'progress') => {
    if (assignmentSortField === field) {
      setAssignmentSortAsc(!assignmentSortAsc);
    } else {
      setAssignmentSortField(field);
      setAssignmentSortAsc(true);
    }
  };

  const getAssignmentTitle = useCallback(
    (a: InterviewAssignment) => a.template?.name || (isPolish ? 'Wywiad' : 'Interview'),
    [isPolish]
  );
  const getAssignmentDescription = useCallback(
    (a: InterviewAssignment) => {
      const description = String(a.template?.description || '').trim();
      if (description) return description;
      const category = String(a.template?.category || '').trim();
      if (category) return isPolish ? `Kategoria: ${category}` : `Category: ${category}`;
      const assignee = String(a.assignee?.name || a.assignee?.email || '').trim();
      if (assignee) return isPolish ? `Przydzielony do: ${assignee}` : `Assigned to: ${assignee}`;
      return '';
    },
    [isPolish]
  );

  const getAssignmentStatusColor = useCallback((status: string) => {
    switch (status) {
      case 'assigned':
        return 'border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-300';
      case 'drafting':
        return 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300';
      case 'in_progress':
        return 'border border-primary-200 bg-primary-50 text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/20 dark:text-primary-300';
      case 'review':
      case 'submitted':
        return 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-300';
      case 'sent_back':
      case 'rejected':
        return 'border border-red-200 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/20 dark:text-red-300';
      case 'accepted':
      case 'approved':
      case 'completed':
        return 'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-300';
      default:
        return 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300';
    }
  }, []);

  const getAssignmentStatusLabel = useCallback(
    (status: string) => {
      const labels: Record<string, { pl: string; en: string }> = {
        assigned: { pl: 'Przydzielony', en: 'Assigned' },
        drafting: { pl: 'Szkic', en: 'Draft' },
        in_progress: { pl: 'W trakcie', en: 'In progress' },
        review: { pl: 'Do przeglądu', en: 'In review' },
        submitted: { pl: 'Wysłany', en: 'Submitted' },
        sent_back: { pl: 'Do poprawy', en: 'Sent back' },
        approved: { pl: 'Zatwierdzony', en: 'Approved' },
        completed: { pl: 'Zakończony', en: 'Completed' },
        rejected: { pl: 'Odrzucony', en: 'Rejected' },
        accepted: { pl: 'Zaakceptowany', en: 'Accepted' },
      };
      const hit = labels[status] || { pl: status, en: status };
      return isPolish ? hit.pl : hit.en;
    },
    [isPolish]
  );

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
          label: isPolish
            ? `${absDays} ${absDays === 1 ? 'dzień' : 'dni'} po terminie`
            : `${absDays}d overdue`,
          colorClass: 'text-red-400 bg-red-500/10',
        };
      }
      if (days === 0) {
        return {
          days,
          label: isPolish ? 'Dziś!' : 'Today!',
          colorClass: 'text-red-400 bg-red-500/10',
        };
      }
      if (days <= 3) {
        return {
          days,
          label: isPolish ? `${days} ${days === 1 ? 'dzień' : 'dni'} do terminu` : `${days}d left`,
          colorClass: 'text-amber-400 bg-amber-500/10',
        };
      }
      return {
        days,
        label: isPolish ? `${days} ${days === 1 ? 'dzień' : 'dni'} do terminu` : `${days}d left`,
        colorClass: 'text-emerald-400 bg-emerald-500/10',
      };
    },
    [isPolish]
  );

  const startInterviewAssignment = useCallback(
    async (assignment: InterviewAssignment) => {
      try {
        const projectId = await ensureProjectId();
        if (!projectId) {
          toast.error(
            isPolish
              ? 'Wybierz projekt przed rozpoczęciem wywiadu'
              : 'Select a project before starting'
          );
          return;
        }
        toast.loading(isPolish ? 'Rozpoczynanie wywiadu...' : 'Starting interview...');
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
          toast.success(isPolish ? 'Wywiad rozpoczęty!' : 'Interview started!');
          handleOpenDocument({
            id: session.id,
            type: 'interview_session',
            subType: 'interview',
            name: session.name || 'Interview Session',
            status: (session.status || 'in_progress').toUpperCase() as any,
          });
        } else {
          console.warn('[InterviewHub] No session in result:', result);
          toast.error(
            isPolish ? 'Brak sesji w odpowiedzi serwera' : 'No session in server response'
          );
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
        safeToastError(
          error,
          isPolish ? 'Nie udało się rozpocząć wywiadu' : 'Failed to start interview',
          isPolish
        );
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
          toast(
            isPolish
              ? 'Wywiad nie został jeszcze rozpoczęty przez przypisanego użytkownika'
              : 'Interview has not been started by the assignee yet',
            { duration: 4000, icon: 'ℹ️' }
          );
          return;
        }

        console.warn('[InterviewHub] No action taken for assignment:', assignment);
      } catch (error: any) {
        console.error('[InterviewHub] Failed to open assignment:', error);
        safeToastError(
          error,
          isPolish ? 'Nie udało się otworzyć assignmentu' : 'Failed to open assignment',
          isPolish
        );
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
        const due = a.dueAt ? new Date(a.dueAt).toLocaleDateString() : '—';
        const status = getAssignmentStatusLabel(a.status);
        const progress = a.session?.completenessPercent ?? 0;
        const assignee = a.assignee?.name || a.assignee?.email || '—';
        const category = a.template?.category || '—';

        const intentLine = (() => {
          switch (intent) {
            case 'summary':
              return isPolish
                ? 'Podsumuj czego dotyczy i co jest wymagane.'
                : 'Summarize what this is and what is required.';
            case 'risks':
              return isPolish
                ? 'Wypisz ryzyka i typowe blokery (max 5).'
                : 'List risks and typical blockers (max 5).';
            case 'next_steps':
              return isPolish
                ? 'Zaproponuj następne kroki (max 5), konkretnie.'
                : 'Propose next steps (max 5), concrete.';
            case 'expand_details':
              return isPolish
                ? 'Rozwiń szczegóły do krótkiego planu wykonania.'
                : 'Expand details into a short execution plan.';
            case 'summarize_details':
              return isPolish
                ? 'Podsumuj szczegóły w 5 punktach.'
                : 'Summarize details in 5 bullets.';
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
          systemInstruction: isPolish
            ? 'Jesteś praktycznym PMO asystentem. Odpowiadasz krótko, konkretnie i bez ogólników.'
            : 'You are a practical PMO assistant. Respond briefly, concretely, and avoid generic filler.',
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

  // Render assignments table (reusable for my/managed/overdue)
  const renderAssignmentsTable = (
    assignments: InterviewAssignment[],
    showAssignee: boolean = false
  ) => {
    const hiddenColumns = showAssignee ? managedHiddenColumns : inboxHiddenColumns;
    const hiddenSet = new Set(hiddenColumns);
    const hasAssigneeColumn = !hiddenSet.has('assignee');
    const columnWidths = showAssignee ? managedAssignmentColumnWidths : inboxAssignmentColumnWidths;
    const setColumnWidths = showAssignee
      ? setManagedAssignmentColumnWidths
      : setInboxAssignmentColumnWidths;
    const showRowDescription = showAssignee
      ? showManagedAssignmentRowDescription
      : showInboxAssignmentRowDescription;
    const visibleAssignmentIds = assignments.map((assignment) => assignment.id);
    const selectedVisibleCount = visibleAssignmentIds.filter((id) =>
      selectedAssignmentIds.has(id)
    ).length;
    const allVisibleSelected =
      visibleAssignmentIds.length > 0 && selectedVisibleCount === visibleAssignmentIds.length;
    const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
    const toggleAssignmentSelection = (assignmentId: string) => {
      setSelectedAssignmentIds((prev) => {
        const next = new Set(prev);
        if (next.has(assignmentId)) next.delete(assignmentId);
        else next.add(assignmentId);
        return next;
      });
    };
    const toggleAllVisibleAssignments = () => {
      setSelectedAssignmentIds((prev) => {
        const next = new Set(prev);
        if (allVisibleSelected) {
          visibleAssignmentIds.forEach((id) => next.delete(id));
        } else {
          visibleAssignmentIds.forEach((id) => next.add(id));
        }
        return next;
      });
    };
    const visibleColumns = [
      'select',
      'template',
      ...(hasAssigneeColumn ? ['assignee'] : []),
      ...(!hiddenSet.has('status') ? ['status'] : []),
      ...(!hiddenSet.has('progress') ? ['progress'] : []),
      ...(!hiddenSet.has('due') ? ['due'] : []),
      'actions',
    ];
    const tableMinWidth = visibleColumns.reduce(
      (sum, columnId) => sum + (columnWidths[columnId] ?? 120),
      0
    );
    const handleAssignmentColumnResize = (columnId: string, newWidth: number) => {
      setColumnWidths((prev) => {
        const currentIndex = visibleColumns.indexOf(columnId);
        const nextColumnId = visibleColumns[currentIndex + 1];
        if (currentIndex < 0 || !nextColumnId) return prev;

        const current = prev[columnId] ?? INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_WIDTHS[columnId];
        const next = prev[nextColumnId] ?? INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_WIDTHS[nextColumnId];
        const currentBounds = INTERVIEW_ASSIGNMENTS_TABLE_RESIZE_BOUNDS[columnId];
        const nextBounds = INTERVIEW_ASSIGNMENTS_TABLE_RESIZE_BOUNDS[nextColumnId];
        const requestedDelta = newWidth - current;
        const minDelta = Math.max(currentBounds.minWidth - current, next - nextBounds.maxWidth);
        const maxDelta = Math.min(currentBounds.maxWidth - current, next - nextBounds.minWidth);
        const delta = Math.max(minDelta, Math.min(maxDelta, requestedDelta));
        if (delta === 0) return prev;

        return {
          ...prev,
          [columnId]: current + delta,
          [nextColumnId]: next - delta,
        };
      });
    };
    const renderAssignmentResizer = (columnId: string) => {
      if (visibleColumns[visibleColumns.indexOf(columnId) + 1] == null) return null;
      const bounds = INTERVIEW_ASSIGNMENTS_TABLE_RESIZE_BOUNDS[columnId];
      return (
        <ColumnResizer
          columnId={columnId}
          currentWidth={
            columnWidths[columnId] ?? INTERVIEW_ASSIGNMENTS_TABLE_DEFAULT_WIDTHS[columnId]
          }
          minWidth={bounds.minWidth}
          maxWidth={bounds.maxWidth}
          onResize={handleAssignmentColumnResize}
        />
      );
    };

    const getStatusColor = (status: string) => getAssignmentStatusColor(status);

    const getStatusLabel = (status: string) => {
      const labels: Record<string, { pl: string; en: string }> = {
        assigned: { pl: 'Przydzielony', en: 'Assigned' },
        drafting: { pl: 'Szkic', en: 'Drafting' },
        in_progress: { pl: 'W trakcie', en: 'In Progress' },
        review: { pl: 'Do przeglądu', en: 'In Review' },
        submitted: { pl: 'Wysłany', en: 'Submitted' },
        sent_back: { pl: 'Do poprawy', en: 'Sent Back' },
        rejected: { pl: 'Odrzucony', en: 'Rejected' },
        accepted: { pl: 'Zaakceptowany', en: 'Accepted' },
        approved: { pl: 'Zatwierdzony', en: 'Approved' },
        completed: { pl: 'Zakończony', en: 'Completed' },
      };
      return labels[status]?.[isPolish ? 'pl' : 'en'] || status;
    };

    const getPriorityColor = (priority: string) => {
      switch (priority) {
        case 'urgent':
          return 'text-red-400';
        case 'high':
          return 'text-orange-400';
        case 'medium':
          return 'text-amber-400';
        case 'low':
          return 'text-slate-400';
        default:
          return 'text-slate-400';
      }
    };

    const isOverdue = (dueAt?: string) => {
      if (!dueAt) return false;
      return new Date(dueAt) < new Date();
    };

    /** E1.1 – "days to due" helper with color coding */
    const getDaysToDue = (
      dueAt?: string
    ): { days: number; label: string; colorClass: string } | null => {
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
          label: isPolish
            ? `${absDays} ${absDays === 1 ? 'dzień' : 'dni'} po terminie`
            : `${absDays}d overdue`,
          colorClass: 'text-red-400 bg-red-500/10',
        };
      }
      if (days === 0) {
        return {
          days,
          label: isPolish ? 'Dziś!' : 'Today!',
          colorClass: 'text-red-400 bg-red-500/10',
        };
      }
      if (days <= 3) {
        return {
          days,
          label: isPolish ? `${days} ${days === 1 ? 'dzień' : 'dni'} do terminu` : `${days}d left`,
          colorClass: 'text-amber-400 bg-amber-500/10',
        };
      }
      return {
        days,
        label: isPolish ? `${days} ${days === 1 ? 'dzień' : 'dni'} do terminu` : `${days}d left`,
        colorClass: 'text-emerald-400 bg-emerald-500/10',
      };
    };

    const handleStartAssignment = async (assignment: InterviewAssignment) => {
      try {
        const projectId = await ensureProjectId();
        if (!projectId) {
          toast.error(
            isPolish
              ? 'Wybierz projekt przed rozpoczęciem wywiadu'
              : 'Select a project before starting'
          );
          return;
        }
        toast.loading(isPolish ? 'Rozpoczynanie wywiadu...' : 'Starting interview...');
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
          toast.success(isPolish ? 'Wywiad rozpoczęty!' : 'Interview started!');
          handleOpenDocument({
            id: session.id,
            type: 'interview_session',
            subType: 'interview',
            name: session.name || 'Interview Session',
            status: (session.status || 'in_progress').toUpperCase() as any,
          });
        } else {
          console.warn('[InterviewHub] No session in result:', result);
          toast.error(
            isPolish ? 'Brak sesji w odpowiedzi serwera' : 'No session in server response'
          );
        }

        // Refresh all assignments
        const [myRes, managedRes] = await Promise.all([
          loadMyAssignments(),
          canViewManaged ? loadManagedAssignments() : Promise.resolve([]),
        ]);
        setMyAssignments(myRes);
        if (canViewManaged) {
          setManagedAssignments(Array.isArray(managedRes) ? managedRes : []);
        }
      } catch (error: any) {
        toast.dismiss();
        console.error('[InterviewHub] Failed to start assignment:', error);
        safeToastError(
          error,
          isPolish ? 'Nie udało się rozpocząć wywiadu' : 'Failed to start interview',
          isPolish
        );
      }
    };

    const handleSendReminder = async (assignment: InterviewAssignment) => {
      try {
        await V8InterviewApi.remindAssignment(assignment.id).catch(() =>
          Api.post(`/interview/assignments/${assignment.id}/remind`, {})
        );
        toast.success(isPolish ? 'Przypomnienie wysłane!' : 'Reminder sent!');
      } catch (error: any) {
        console.error('[InterviewHub] Failed to send reminder:', error);
        safeToastError(
          error,
          isPolish ? 'Nie udało się wysłać przypomnienia' : 'Failed to send reminder',
          isPolish
        );
      }
    };

    // Sort assignments based on current sort field
    const sortedAssignments = [...assignments].sort((a, b) => {
      if (!assignmentSortField) return 0;
      const dir = assignmentSortAsc ? 1 : -1;
      if (assignmentSortField === 'dueAt') {
        const aDate = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
        const bDate = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
        return (aDate - bDate) * dir;
      }
      if (assignmentSortField === 'progress') {
        const aP = a.session?.completenessPercent || 0;
        const bP = b.session?.completenessPercent || 0;
        return (aP - bP) * dir;
      }
      if (assignmentSortField === 'status') {
        const statusOrder: Record<string, number> = {
          sent_back: 0,
          assigned: 1,
          in_progress: 2,
          submitted: 3,
          approved: 4,
          completed: 5,
        };
        return ((statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99)) * dir;
      }
      return 0;
    });

    const handleOpenAssignmentRow = async (assignment: InterviewAssignment) => {
      try {
        // If assignment has a session, open it (read-only will be handled by workspace based on assignment status)
        const sid = assignment.sessionId || assignment.session?.id;
        if (sid) {
          const session = await V8InterviewApi.getSession(sid)
            .then((res) => res.session)
            .catch(() => Api.get(`/interview/sessions/${sid}`));
          handleOpenDocument({
            id: (session as InterviewSession).id,
            type: 'interview_session',
            subType: 'interview',
            name: (session as InterviewSession).name || 'Interview Session',
            status: ((session as any)?.status || 'in_progress').toUpperCase() as any,
          });
          return;
        }

        // If user is assignee and the assignment hasn't started, start it.
        if (!showAssignee && assignment.status === 'assigned') {
          await handleStartAssignment(assignment);
          return;
        }

        // If manager view and assignment hasn't started yet, show info message
        if (showAssignee && !assignment.sessionId) {
          const message = isPolish
            ? 'Wywiad nie został jeszcze rozpoczęty przez przypisanego użytkownika'
            : 'Interview has not been started by the assignee yet';
          toast(message, {
            icon: 'ℹ️',
            duration: 4000,
          });
          return;
        }

        // Fallback - should not reach here, but log if it does
        console.warn('[InterviewHub] No action taken for assignment:', assignment);
      } catch (error: any) {
        console.error('[InterviewHub] Failed to open assignment row:', error);
        safeToastError(
          error,
          isPolish ? 'Nie udało się otworzyć assignmentu' : 'Failed to open assignment',
          isPolish
        );
      }
    };

    return (
      <div className="bg-white/70 dark:bg-navy-900/70 border border-slate-200/70 dark:border-white/[0.08] rounded-xl backdrop-blur overflow-hidden">
        <table className="w-full table-fixed" style={{ minWidth: tableMinWidth }}>
          <thead>
            <tr className="border-b border-slate-200/70 dark:border-white/[0.08] bg-slate-50/70 dark:bg-navy-900/40">
              <th className="px-3 py-2 text-left" style={{ width: columnWidths.select }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAllVisibleAssignments();
                  }}
                  className={[
                    'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-all duration-150',
                    'border-slate-300 bg-white/80 text-white hover:border-primary-400 hover:bg-white dark:border-white/[0.14] dark:bg-white/[0.035]',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35',
                    allVisibleSelected || someVisibleSelected
                      ? 'border-primary-500 bg-primary-500 opacity-100 dark:border-primary-400 dark:bg-primary-500'
                      : 'opacity-70',
                  ].join(' ')}
                  aria-label={isPolish ? 'Zaznacz widoczne wiersze' : 'Select visible rows'}
                  aria-pressed={allVisibleSelected}
                >
                  {allVisibleSelected ? <Check size={10} strokeWidth={3} /> : null}
                  {someVisibleSelected ? <Minus size={10} strokeWidth={3} /> : null}
                </button>
              </th>
              <th
                className="relative px-3 py-2 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: columnWidths.template }}
              >
                {isPolish ? 'Szablon' : 'Template'}
                {renderAssignmentResizer('template')}
              </th>
              {hasAssigneeColumn && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                  style={{ width: columnWidths.assignee }}
                >
                  {isPolish ? 'Przydzielony do' : 'Assignee'}
                  {renderAssignmentResizer('assignee')}
                </th>
              )}
              {!hiddenSet.has('status') && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  style={{ width: columnWidths.status }}
                  onClick={() => toggleAssignmentSort('status')}
                >
                  {isPolish ? 'Status' : 'Status'}
                  {assignmentSortField === 'status' && (
                    <ChevronDown
                      size={12}
                      className={`inline-block ml-0.5 transition-transform ${assignmentSortAsc ? '' : 'rotate-180'}`}
                    />
                  )}
                  {renderAssignmentResizer('status')}
                </th>
              )}
              {!hiddenSet.has('progress') && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  style={{ width: columnWidths.progress }}
                  onClick={() => toggleAssignmentSort('progress')}
                >
                  {isPolish ? 'Postęp' : 'Progress'}
                  {assignmentSortField === 'progress' && (
                    <ChevronDown
                      size={12}
                      className={`inline-block ml-0.5 transition-transform ${assignmentSortAsc ? '' : 'rotate-180'}`}
                    />
                  )}
                  {renderAssignmentResizer('progress')}
                </th>
              )}
              {!hiddenSet.has('due') && (
                <th
                  className="relative px-3 py-2 text-center text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                  style={{ width: columnWidths.due }}
                  onClick={() => toggleAssignmentSort('dueAt')}
                >
                  {isPolish ? 'Do terminu' : 'Days to Due'}
                  {assignmentSortField === 'dueAt' && (
                    <ChevronDown
                      size={12}
                      className={`inline-block ml-0.5 transition-transform ${assignmentSortAsc ? '' : 'rotate-180'}`}
                    />
                  )}
                  {renderAssignmentResizer('due')}
                </th>
              )}
              <th
                className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: columnWidths.actions }}
              >
                <button
                  onClick={() => {
                    setAssignmentsViewSettingsShowAssignee(showAssignee);
                    setIsAssignmentsViewSettingsOpen(true);
                  }}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98]"
                  aria-label={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
                  title={isPolish ? 'Ustawienia widoku' : 'View settings'}
                >
                  <Settings2 size={14} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAssignments.map((assignment) => {
              const progress = assignment.session?.completenessPercent || 0;
              const overdue = isOverdue(assignment.dueAt) && assignment.status !== 'completed';
              const rowDescription = getAssignmentDescription(assignment);
              const isAssignmentSelected = selectedAssignmentIds.has(assignment.id);

              return (
                <tr
                  key={assignment.id}
                  onClick={(e) => {
                    // Single click → selection + preview (KANON v3)
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'BUTTON' || target.closest('button')) return;
                    setPreviewAssignmentId(assignment.id);
                    setPreviewAssignmentOpen(true);
                  }}
                  onDoubleClick={() => {
                    // Double click → open full
                    void openInterviewAssignmentFull(assignment, showAssignee);
                  }}
                  className={[
                    'group transition-colors border-b border-slate-200/50 dark:border-navy-700/50 last:border-0 cursor-pointer',
                    'hover:bg-slate-50/70 dark:hover:bg-white/[0.04]',
                    'active:bg-slate-100 dark:active:bg-navy-700/50',
                    previewAssignmentId === assignment.id || isAssignmentSelected
                      ? 'bg-primary-50 dark:bg-primary-500/[0.14] shadow-[inset_4px_0_0_theme(colors.primary.500)] ring-1 ring-primary-500/25 ring-inset'
                      : '',
                  ].join(' ')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      void openInterviewAssignmentFull(assignment, showAssignee);
                      return;
                    }
                    if (e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setPreviewAssignmentId(assignment.id);
                      setPreviewAssignmentOpen(true);
                    }
                  }}
                >
                  <td className="px-3 py-3" style={{ width: columnWidths.select }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleAssignmentSelection(assignment.id);
                      }}
                      className={[
                        'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-all duration-150',
                        'border-slate-300 bg-white/80 text-white hover:border-primary-400 group-hover:opacity-100 group-hover:bg-white/90',
                        'dark:border-white/[0.14] dark:bg-white/[0.035] dark:group-hover:bg-white/[0.08]',
                        'focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35',
                        'group-focus-within:opacity-100 group-focus-within:border-primary-400',
                        isAssignmentSelected
                          ? 'border-primary-500 bg-primary-500 opacity-100 dark:border-primary-400 dark:bg-primary-500'
                          : 'opacity-0',
                      ].join(' ')}
                      aria-label={isPolish ? 'Zaznacz wiersz' : 'Select row'}
                      aria-pressed={isAssignmentSelected}
                    >
                      {isAssignmentSelected ? <Check size={10} strokeWidth={3} /> : null}
                    </button>
                  </td>
                  <td className="px-4 py-3" style={{ width: columnWidths.template }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/15 dark:bg-blue-500/20">
                        <ClipboardList size={16} className="text-blue-400" />
                      </div>
                      <div className="min-w-0 flex flex-col">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="text-sm text-slate-900 dark:text-white font-medium truncate min-w-0"
                            title={assignment.template?.name || 'Interview'}
                          >
                            {assignment.template?.name || 'Interview'}
                          </span>
                          {assignment.template?.category ? (
                            <span
                              className="shrink-0 max-w-[160px] truncate inline-flex items-center h-6 px-2 rounded-full text-[11px] font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-600 dark:text-slate-300"
                              title={assignment.template.category}
                            >
                              {assignment.template.category}
                            </span>
                          ) : null}
                        </div>
                        {showRowDescription && rowDescription ? (
                          <span
                            className="mt-0.5 max-w-[620px] truncate text-[11px] font-normal leading-4 text-slate-950/65 dark:text-slate-100/55"
                            title={rowDescription}
                          >
                            {rowDescription}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  {hasAssigneeColumn && (
                    <td
                      className="px-4 py-3 text-center align-middle"
                      style={{ width: columnWidths.assignee }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-xs text-slate-700 dark:text-slate-300">
                          {assignment.assignee?.name?.charAt(0) || '?'}
                        </div>
                        <span
                          className="text-sm text-slate-700 dark:text-slate-200 truncate max-w-[220px]"
                          title={
                            assignment.assignee?.name || assignment.assignee?.email || 'Unknown'
                          }
                        >
                          {assignment.assignee?.name || assignment.assignee?.email || 'Unknown'}
                        </span>
                      </div>
                    </td>
                  )}
                  {!hiddenSet.has('status') && (
                    <td
                      className="px-4 py-3 text-center align-middle"
                      style={{ width: columnWidths.status }}
                    >
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getAssignmentStatusColor(assignment.status)}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {getAssignmentStatusLabel(assignment.status)}
                      </span>
                    </td>
                  )}
                  {!hiddenSet.has('progress') && (
                    <td
                      className="px-4 py-3 text-center align-middle"
                      style={{ width: columnWidths.progress }}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex-1 max-w-[100px] h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {progress}%
                        </span>
                      </div>
                    </td>
                  )}
                  {!hiddenSet.has('due') && (
                    <td
                      className="px-4 py-3 text-center align-middle"
                      style={{ width: columnWidths.due }}
                    >
                      {(() => {
                        const dtd = getAssignmentDaysToDue(assignment.dueAt);
                        if (!dtd) return <span className="text-xs text-slate-500">—</span>;

                        return (
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${dtd.colorClass}`}
                              title={
                                assignment.dueAt
                                  ? new Date(assignment.dueAt).toLocaleDateString()
                                  : ''
                              }
                            >
                              {dtd.days < 0 && <AlertTriangle size={11} />}
                              {dtd.days === 0 && <AlertTriangle size={11} />}
                              {dtd.days > 0 && dtd.days <= 3 && <Clock size={11} />}
                              {dtd.days > 3 && <Calendar size={11} />}
                              {dtd.label}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                  )}
                  <td
                    className="px-3 py-3 text-right"
                    style={{ width: columnWidths.actions }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-end">
                      <RowActionsMenu
                        iconVariant="vertical"
                        className="opacity-40 transition-opacity group-hover:opacity-100"
                        actions={[
                          {
                            id: 'open',
                            label: isPolish ? 'Otwórz' : 'Open',
                            icon: ChevronRight,
                            onClick: () =>
                              void openInterviewAssignmentFull(assignment, showAssignee),
                          },
                          ...(!showAssignee && assignment.status === 'assigned'
                            ? [
                                {
                                  id: 'start',
                                  label: isPolish ? 'Rozpocznij' : 'Start',
                                  icon: Sparkles,
                                  onClick: () => startInterviewAssignment(assignment),
                                },
                              ]
                            : []),
                          ...(!showAssignee &&
                          assignment.status === 'in_progress' &&
                          assignment.sessionId
                            ? [
                                {
                                  id: 'continue',
                                  label: isPolish ? 'Kontynuuj' : 'Continue',
                                  icon: ChevronRight,
                                  onClick: async () => {
                                    const session = await Api.get(
                                      `/interview/sessions/${assignment.sessionId}`
                                    );
                                    handleOpenDocument({
                                      id: (session as InterviewSession).id,
                                      type: 'interview_session',
                                      subType: 'interview',
                                      name:
                                        (session as InterviewSession).name || 'Interview Session',
                                      status: (
                                        (session as any)?.status || 'in_progress'
                                      ).toUpperCase() as any,
                                    });
                                  },
                                },
                              ]
                            : []),
                          ...(!showAssignee &&
                          assignment.status === 'sent_back' &&
                          assignment.sessionId
                            ? [
                                {
                                  id: 'fix',
                                  label: isPolish ? 'Popraw' : 'Fix & Resubmit',
                                  icon: RotateCcw,
                                  onClick: async () => {
                                    const session = await Api.get(
                                      `/interview/sessions/${assignment.sessionId}`
                                    );
                                    handleOpenDocument({
                                      id: (session as InterviewSession).id,
                                      type: 'interview_session',
                                      subType: 'interview',
                                      name:
                                        (session as InterviewSession).name || 'Interview Session',
                                      status: (
                                        (session as any)?.status || 'in_progress'
                                      ).toUpperCase() as any,
                                    });
                                  },
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
                                  label: isPolish ? 'Wyślij przypomnienie' : 'Send reminder',
                                  icon: Bell,
                                  onClick: () => handleOpenReminderModal(assignment),
                                },
                                ...(assignment.status === 'submitted'
                                  ? [
                                      {
                                        id: 'approve',
                                        label: isPolish ? 'Zatwierdź' : 'Approve',
                                        icon: Check,
                                        onClick: () => handleApproveAssignment(assignment),
                                      },
                                      {
                                        id: 'sendback',
                                        label: isPolish ? 'Zwróć do poprawy' : 'Send back',
                                        icon: RotateCcw,
                                        onClick: () => handleOpenSendBackModal(assignment),
                                        variant: 'danger' as const,
                                      },
                                    ]
                                  : []),
                              ]
                            : []),
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td
                  colSpan={
                    2 + // template + actions
                    (hasAssigneeColumn ? 1 : 0) +
                    (!hiddenSet.has('status') ? 1 : 0) +
                    (!hiddenSet.has('progress') ? 1 : 0) +
                    (!hiddenSet.has('due') ? 1 : 0)
                  }
                  className="px-4 py-12 text-center"
                >
                  <div className="flex flex-col items-center">
                    <Inbox className="w-12 h-12 text-slate-600 mb-3" />
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      {isPolish ? 'Brak przydziałów' : 'No assignments'}
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  };

  // Render list content based on active tab
  const renderListContent = () => {
    if (isLoading || assignmentsLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
        </div>
      );
    }

    if (loadError) {
      return (
        <div className="flex items-center justify-center h-full p-6">
          <div className="w-full max-w-3xl rounded-2xl border border-amber-200/70 dark:border-amber-400/20 bg-amber-50/80 dark:bg-amber-500/10 p-6">
            <div className="text-lg font-semibold text-slate-900 dark:text-white">
              {isPolish
                ? 'Realne zrodlo Interview wymaga uwagi'
                : 'Real interview source needs attention'}
            </div>
            <div className="mt-2 text-sm text-slate-700 dark:text-slate-200">{loadError}</div>
            <div className="mt-4 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {isPolish
                ? 'Nie wstrzyknieto danych demo. Sprawdz aktywna baze, scope organizacji i data-context.'
                : 'No synthetic demo fallback was injected. Verify active DB, organization scope, and data-context.'}
            </div>
          </div>
        </div>
      );
    }

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
          {viewMode === 'table' ? (
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
                const relations = [
                  {
                    label: `${isPolish ? 'Assignee' : 'Assignee'}: ${s.assigneeName || s.respondentName || '—'}`,
                    tone: 'text-slate-600 dark:text-slate-300',
                  },
                  {
                    label: `${isPolish ? 'Template' : 'Template'}: ${s.templateName || s.templateCategory || '—'}`,
                    tone: 'text-slate-600 dark:text-slate-300',
                  },
                  {
                    label: `${isPolish ? 'Projekt' : 'Project'}: ${s.projectId || '—'}`,
                    tone: 'text-slate-600 dark:text-slate-300',
                  },
                  {
                    label: `${isPolish ? 'Organizacja' : 'Org'}: ${s.organizationId || '—'}`,
                    tone: 'text-slate-600 dark:text-slate-300',
                  },
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
            </TableWithPreviewLayout>
          ) : (
            <div className="pl-4 pr-1.5 pt-3 pb-4">{renderSessionsGrid()}</div>
          )}
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
          const enLabel = count === 1 ? 'session' : 'sessions';
          return `${count} ${isPolish ? 'sesji' : enLabel}`;
        }
        return isPolish ? 'Ogólne' : 'General';
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
        const t = (en: string, pl: string) => (isPolish ? pl : en);
        switch ((type || 'summary').toLowerCase()) {
          case 'summary':
            return t('Summary', 'Podsumowanie');
          case 'trends':
            return t('Trends', 'Trendy');
          case 'problems':
            return t('Problems', 'Problemy');
          case 'opportunities':
            return t('Opportunities', 'Szanse');
          case 'recommendations':
            return t('Recommendations', 'Rekomendacje');
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
              ? `${item.sourceSessionCount} ${isPolish ? 'sesji' : 'sessions'}`
              : item.sessionId
                ? `${isPolish ? 'Sesja' : 'Session'} ${item.sessionId.slice(0, 8)}…`
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
                bg: 'bg-red-500/20',
                text: 'text-red-700 dark:text-red-300',
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
                    ? isPolish
                      ? `Utworzono ${createdRelative}`
                      : `Created ${createdRelative}`
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
                  }
                }}
                showActionPanel
              />
            );
          }}
          renderPreviewFooter={(item) => {
            return (
              <InterviewInsightPreviewFooter
                insight={item}
                isPolish={isPolish}
                onOpenFull={() => handleViewInsight(item)}
                onExportToTools={
                  !item.exportedToTools ? () => handleExportInsightToTools(item.id) : undefined
                }
                onCopyLink={() => copyToClipboard(item.title || '')}
              />
            );
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
                      <FileText size={14} className="text-slate-400" />
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
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

      return <div className="h-full overflow-hidden">{insightsTableWithPreview}</div>;
    }

    if (activeTab === 'initiatives') {
      const rows = filteredInterviewInitiatives;

      const statusMeta = (statusValue?: string) => {
        const status = String(statusValue || 'DRAFT').toUpperCase();
        if (status === 'PENDING_REVIEW') {
          return {
            label: isPolish ? 'Do przeglądu' : 'Pending review',
            cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
          };
        }
        if (['REVIEW', 'PROMOTED', 'PLANNING', 'APPROVED'].includes(status)) {
          return {
            label: isPolish ? 'Przekazane dalej' : 'Moved forward',
            cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
          };
        }
        return {
          label: isPolish ? 'Szkic' : 'Draft',
          cls: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
        };
      };

      const hiddenSet = new Set(initiativesHiddenColumns);
      const visibleInitiativeIds = rows.map((initiative) => initiative.id);
      const selectedVisibleCount = visibleInitiativeIds.filter((id) =>
        selectedInitiativeIds.has(id)
      ).length;
      const allVisibleSelected =
        visibleInitiativeIds.length > 0 && selectedVisibleCount === visibleInitiativeIds.length;
      const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;
      const visibleColumns = [
        'select',
        'title',
        ...(!hiddenSet.has('status') ? ['status'] : []),
        ...(!hiddenSet.has('priority') ? ['priority'] : []),
        ...(!hiddenSet.has('source') ? ['source'] : []),
        ...(!hiddenSet.has('date') ? ['date'] : []),
        'actions',
      ];
      const tableMinWidth = visibleColumns.reduce(
        (sum, columnId) => sum + (initiativesColumnWidths[columnId] ?? 120),
        0
      );
      const toggleInitiativeSelection = (initiativeId: string) => {
        setSelectedInitiativeIds((prev) => {
          const next = new Set(prev);
          if (next.has(initiativeId)) next.delete(initiativeId);
          else next.add(initiativeId);
          return next;
        });
      };
      const toggleAllVisibleInitiatives = () => {
        setSelectedInitiativeIds((prev) => {
          const next = new Set(prev);
          if (allVisibleSelected) {
            visibleInitiativeIds.forEach((id) => next.delete(id));
          } else {
            visibleInitiativeIds.forEach((id) => next.add(id));
          }
          return next;
        });
      };
      const handleInitiativeColumnResize = (columnId: string, newWidth: number) => {
        setInitiativesColumnWidths((prev) => {
          const currentIndex = visibleColumns.indexOf(columnId);
          const nextColumnId = visibleColumns[currentIndex + 1];
          if (currentIndex < 0 || !nextColumnId) return prev;

          const current = prev[columnId] ?? INTERVIEW_INITIATIVES_TABLE_DEFAULT_WIDTHS[columnId];
          const next =
            prev[nextColumnId] ?? INTERVIEW_INITIATIVES_TABLE_DEFAULT_WIDTHS[nextColumnId];
          const currentBounds = INTERVIEW_INITIATIVES_TABLE_RESIZE_BOUNDS[columnId];
          const nextBounds = INTERVIEW_INITIATIVES_TABLE_RESIZE_BOUNDS[nextColumnId];
          const requestedDelta = newWidth - current;
          const minDelta = Math.max(currentBounds.minWidth - current, next - nextBounds.maxWidth);
          const maxDelta = Math.min(currentBounds.maxWidth - current, next - nextBounds.minWidth);
          const delta = Math.max(minDelta, Math.min(maxDelta, requestedDelta));
          if (delta === 0) return prev;

          return {
            ...prev,
            [columnId]: current + delta,
            [nextColumnId]: next - delta,
          };
        });
      };
      const renderInitiativeResizer = (columnId: string) => {
        if (visibleColumns[visibleColumns.indexOf(columnId) + 1] == null) return null;
        const bounds = INTERVIEW_INITIATIVES_TABLE_RESIZE_BOUNDS[columnId];
        return (
          <ColumnResizer
            columnId={columnId}
            currentWidth={
              initiativesColumnWidths[columnId] ??
              INTERVIEW_INITIATIVES_TABLE_DEFAULT_WIDTHS[columnId]
            }
            minWidth={bounds.minWidth}
            maxWidth={bounds.maxWidth}
            onResize={handleInitiativeColumnResize}
          />
        );
      };

      return (
        <div className="h-full overflow-auto p-4">
          <div className="overflow-hidden rounded-xl border border-slate-200/70 bg-white/70 backdrop-blur dark:border-white/[0.06] dark:bg-navy-900/70">
            <table className="w-full table-fixed" style={{ minWidth: tableMinWidth }}>
              <thead>
                <tr className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/60 dark:border-white/[0.06] dark:bg-navy-900/60">
                  <th
                    className="px-3 py-2 text-left"
                    style={{ width: initiativesColumnWidths.select }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAllVisibleInitiatives();
                      }}
                      className={[
                        'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-all duration-150',
                        'border-slate-300 bg-white/80 text-white hover:border-primary-400 hover:bg-white dark:border-white/[0.14] dark:bg-white/[0.035]',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35',
                        allVisibleSelected || someVisibleSelected
                          ? 'border-primary-500 bg-primary-500 opacity-100 dark:border-primary-400 dark:bg-primary-500'
                          : 'opacity-70',
                      ].join(' ')}
                      aria-label={
                        isPolish ? 'Zaznacz widoczne inicjatywy' : 'Select visible initiatives'
                      }
                      aria-pressed={allVisibleSelected}
                    >
                      {allVisibleSelected ? <Check size={10} strokeWidth={3} /> : null}
                      {someVisibleSelected ? <Minus size={10} strokeWidth={3} /> : null}
                    </button>
                  </th>
                  <th
                    className="relative px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    style={{ width: initiativesColumnWidths.title }}
                  >
                    {isPolish ? 'Inicjatywa' : 'Initiative'}
                    {renderInitiativeResizer('title')}
                  </th>
                  {!hiddenSet.has('status') ? (
                    <th
                      className="relative px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      style={{ width: initiativesColumnWidths.status }}
                    >
                      {isPolish ? 'Status' : 'Status'}
                      {renderInitiativeResizer('status')}
                    </th>
                  ) : null}
                  {!hiddenSet.has('priority') ? (
                    <th
                      className="relative px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      style={{ width: initiativesColumnWidths.priority }}
                    >
                      {isPolish ? 'Priorytet' : 'Priority'}
                      {renderInitiativeResizer('priority')}
                    </th>
                  ) : null}
                  {!hiddenSet.has('source') ? (
                    <th
                      className="relative px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      style={{ width: initiativesColumnWidths.source }}
                    >
                      {isPolish ? 'Źródło' : 'Source'}
                      {renderInitiativeResizer('source')}
                    </th>
                  ) : null}
                  {!hiddenSet.has('date') ? (
                    <th
                      className="relative px-3 py-2 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                      style={{ width: initiativesColumnWidths.date }}
                    >
                      {isPolish ? 'Data' : 'Date'}
                      {renderInitiativeResizer('date')}
                    </th>
                  ) : null}
                  <th
                    className="relative px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    style={{ width: initiativesColumnWidths.actions }}
                  >
                    <div ref={initiativesViewSettingsRef} className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setIsInitiativesViewSettingsOpen((open) => !open);
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100/70 dark:text-slate-400 dark:hover:bg-white/[0.06]"
                        aria-label={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
                        aria-expanded={isInitiativesViewSettingsOpen}
                        title={isPolish ? 'Ustawienia widoku' : 'View settings'}
                      >
                        <Settings2 size={14} />
                      </button>
                      {isInitiativesViewSettingsOpen ? (
                        <div
                          className="absolute right-3 top-[calc(100%+8px)] z-50 w-72 rounded-2xl border border-slate-200/80 bg-white p-2 text-left normal-case tracking-normal shadow-xl shadow-slate-900/12 dark:border-white/[0.08] dark:bg-navy-900 dark:shadow-black/35"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div className="px-2 pb-2 pt-1">
                            <div className="text-[12px] font-semibold text-slate-900 dark:text-slate-100">
                              {isPolish ? 'Ustawienia widoku' : 'View settings'}
                            </div>
                            <div className="mt-0.5 text-[11px] font-medium leading-4 text-slate-500 dark:text-slate-400">
                              {isPolish ? 'Wybierz widoczne kolumny.' : 'Choose visible columns.'}
                            </div>
                          </div>
                          <div className="space-y-0.5">
                            {[
                              { id: 'title', label: isPolish ? 'Inicjatywa' : 'Initiative' },
                              { id: 'status', label: isPolish ? 'Status' : 'Status' },
                              { id: 'priority', label: isPolish ? 'Priorytet' : 'Priority' },
                              { id: 'source', label: isPolish ? 'Źródło' : 'Source' },
                              { id: 'date', label: isPolish ? 'Data' : 'Date' },
                              { id: 'actions', label: isPolish ? 'Akcje' : 'Actions' },
                            ].map((column) => {
                              const alwaysVisible =
                                column.id === 'title' || column.id === 'actions';
                              const checked = alwaysVisible ? true : !hiddenSet.has(column.id);
                              return (
                                <label
                                  key={column.id}
                                  className={`flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.055] ${
                                    alwaysVisible ? 'opacity-55' : 'cursor-pointer'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={alwaysVisible}
                                    onChange={() => {
                                      if (alwaysVisible) return;
                                      setInitiativesHiddenColumns((prev) => {
                                        const set = new Set(prev);
                                        if (set.has(column.id)) set.delete(column.id);
                                        else set.add(column.id);
                                        const next = Array.from(set);
                                        saveHiddenColumns(
                                          INTERVIEW_INITIATIVES_TABLE_VIEW_STORAGE_KEY,
                                          next
                                        );
                                        return next;
                                      });
                                    }}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-navy-700"
                                  />
                                  <span className="flex-1 text-[12px] font-medium text-slate-800 dark:text-slate-200">
                                    {column.label}
                                  </span>
                                  {alwaysVisible ? (
                                    <span className="text-[10px] font-medium text-slate-400">
                                      {isPolish ? 'Wymagane' : 'Required'}
                                    </span>
                                  ) : null}
                                </label>
                              );
                            })}
                          </div>
                          <div className="mt-2 border-t border-slate-200/70 pt-2 dark:border-white/[0.08]">
                            <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-100/70 dark:hover:bg-white/[0.055]">
                              <input
                                type="checkbox"
                                checked={showInitiativeRowDescription}
                                onChange={(event) => {
                                  setShowInitiativeRowDescription(event.target.checked);
                                  saveBooleanSetting(
                                    INTERVIEW_INITIATIVES_ROW_DESCRIPTION_STORAGE_KEY,
                                    event.target.checked
                                  );
                                }}
                                className="h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-navy-700"
                              />
                              <span className="flex-1 text-[12px] font-medium text-slate-800 dark:text-slate-200">
                                {isPolish ? 'Pokaż opis / uzasadnienie' : 'Show row description'}
                              </span>
                            </label>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((initiative) => {
                  const title =
                    initiative.title || initiative.name || (isPolish ? 'Inicjatywa' : 'Initiative');
                  const meta = statusMeta(initiative.status);
                  const sourceInsight = initiative.sourceId
                    ? insights.find((insight) => insight.id === initiative.sourceId)
                    : null;
                  const isSelected = selectedInterviewInitiativeId === initiative.id;
                  const isInitiativeSelected = selectedInitiativeIds.has(initiative.id);
                  const status = String(initiative.status || 'DRAFT').toUpperCase();
                  const cleanedDescription = (initiative.description || '')
                    .replace(/^#\s.+$/m, '')
                    .trim();

                  return (
                    <tr
                      key={initiative.id}
                      className={`group cursor-pointer border-b border-slate-200/70 transition-colors last:border-0 dark:border-white/[0.06] ${
                        isSelected || isInitiativeSelected
                          ? 'bg-primary-100/85 shadow-[inset_0_0_0_1px_rgba(124,58,237,0.18),inset_4px_0_0_rgba(124,58,237,0.75)] dark:bg-primary-500/[0.13] dark:shadow-[inset_0_0_0_1px_rgba(196,181,253,0.20),inset_4px_0_0_rgba(196,181,253,0.70)]'
                          : 'hover:bg-slate-50/70 dark:hover:bg-white/[0.03]'
                      }`}
                      onClick={() => setSelectedInterviewInitiativeId(initiative.id)}
                    >
                      <td className="px-3 py-3" style={{ width: initiativesColumnWidths.select }}>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleInitiativeSelection(initiative.id);
                          }}
                          className={[
                            'inline-flex h-3.5 w-3.5 items-center justify-center rounded-[4px] border transition-all duration-150',
                            'border-slate-300 bg-white/80 text-white hover:border-primary-400 group-hover:opacity-100 group-hover:bg-white/90',
                            'dark:border-white/[0.14] dark:bg-white/[0.035] dark:group-hover:bg-white/[0.08]',
                            'focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/35',
                            'group-focus-within:opacity-100 group-focus-within:border-primary-400',
                            isInitiativeSelected
                              ? 'border-primary-500 bg-primary-500 opacity-100 dark:border-primary-400 dark:bg-primary-500'
                              : 'opacity-0',
                          ].join(' ')}
                          aria-label={isPolish ? 'Zaznacz inicjatywę' : 'Select initiative'}
                          aria-pressed={isInitiativeSelected}
                        >
                          {isInitiativeSelected ? <Check size={10} strokeWidth={3} /> : null}
                        </button>
                      </td>
                      <td
                        className="px-3 py-3 align-middle"
                        style={{ width: initiativesColumnWidths.title }}
                      >
                        <div className="truncate pr-4 text-[13.5px] font-semibold leading-5 tracking-[-0.01em] text-slate-950 dark:text-slate-100">
                          {title}
                        </div>
                        {showInitiativeRowDescription && cleanedDescription ? (
                          <div className="mt-0.5 max-w-[760px] truncate pr-6 text-[11px] font-normal leading-4 text-slate-950/65 dark:text-slate-100/55">
                            {cleanedDescription}
                          </div>
                        ) : null}
                      </td>
                      {!hiddenSet.has('status') ? (
                        <td
                          className="px-3 py-3 text-center align-middle"
                          style={{ width: initiativesColumnWidths.status }}
                        >
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium leading-none ${meta.cls}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                      ) : null}
                      {!hiddenSet.has('priority') ? (
                        <td
                          className="px-3 py-3 text-center align-middle"
                          style={{ width: initiativesColumnWidths.priority }}
                        >
                          {initiative.priority ? (
                            <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-[11px] font-medium text-purple-700 dark:text-purple-300">
                              {initiative.priority}
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}
                      {!hiddenSet.has('source') ? (
                        <td
                          className="px-3 py-3 text-center align-middle"
                          style={{ width: initiativesColumnWidths.source }}
                        >
                          {sourceInsight ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                handleViewInsight(sourceInsight);
                              }}
                              className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
                            >
                              <Lightbulb size={12} />
                              {isPolish ? 'Insight' : 'Insight'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </td>
                      ) : null}
                      {!hiddenSet.has('date') ? (
                        <td
                          className="px-3 py-3 text-center align-middle text-[11px] font-medium text-slate-500 dark:text-slate-500"
                          style={{ width: initiativesColumnWidths.date }}
                        >
                          {initiative.updatedAt || initiative.createdAt
                            ? new Date(
                                initiative.updatedAt || initiative.createdAt || ''
                              ).toLocaleDateString(isPolish ? 'pl-PL' : 'en-US')
                            : '—'}
                        </td>
                      ) : null}
                      <td
                        className="px-3 py-3 text-right align-middle"
                        style={{ width: initiativesColumnWidths.actions }}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <RowActionsMenu
                          iconVariant="vertical"
                          className="opacity-40 transition-opacity group-hover:opacity-100"
                          actions={[
                            {
                              id: 'open',
                              label: isPolish ? 'Otwórz kartę' : 'Open record',
                              icon: ExternalLink,
                              onClick: () =>
                                navigate(
                                  `/initiatives?open=${encodeURIComponent(initiative.id)}&mode=doc`
                                ),
                            },
                            ...(status === 'DRAFT'
                              ? [
                                  {
                                    id: 'send-to-review',
                                    label: isPolish ? 'Wyślij do przeglądu' : 'Send to review',
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
                                  {
                                    id: 'back-to-draft',
                                    label: isPolish ? 'Wróć do szkicu' : 'Back to draft',
                                    icon: RotateCcw,
                                    onClick: () =>
                                      void handleUpdateInterviewInitiativeStatus(
                                        initiative.id,
                                        'DRAFT'
                                      ),
                                  },
                                ]
                              : []),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={visibleColumns.length} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center">
                        <Rocket className="mb-3 h-10 w-10 text-slate-500" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {isPolish ? 'Brak inicjatyw dla tego filtra' : 'No initiatives here'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
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
            ? isPolish
              ? 'Podsumuj ten szablon wywiadu.'
              : 'Summarize this interview template.'
            : kind === 'improvements'
              ? isPolish
                ? 'Zaproponuj usprawnienia i lepsze brzmienie pytań.'
                : 'Propose improvements and better wording for questions.'
              : isPolish
                ? 'Wykryj luki: czego brakuje, by odpowiedzi były kompletne.'
                : 'Detect gaps: what is missing for complete answers.';

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
          `Source: ${getTemplateSourceLabel(tpl?.scope, isPolish)}`,
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
          toast.success(isPolish ? 'Skopiowano do schowka' : 'Copied to clipboard');
        } catch {
          toast.error(isPolish ? 'Nie udało się skopiować' : 'Copy failed');
        }
      };

      const onOpenFull = (id: string) => {
        if (canAssign) handleEditTemplate(id);
        else {
          const t = templates.find((x) => x.id === id);
          if (t) handleViewTemplate(t);
        }
      };

      if (templatesViewMode === 'cards') {
        return (
          <div className="h-full flex flex-col overflow-auto">
            {renderTemplatesCards({
              onSelectRow: (id) => setSelectedTemplateId(id),
              onOpenFull: (id) => onOpenFull(id),
            })}
          </div>
        );
      }

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
            <div className="pl-4 pr-1.5 pt-3 pb-4">
              {renderTemplatesTable({
                onSelectRow: (id) => setSelectedTemplateId(id),
                onOpenFull: (id) => onOpenFull(id),
              })}
            </div>
          </TableWithPreviewLayout>
        </div>
      );
    }

    if (activeTab === 'my_assignments') {
      const rows = myAssignments || [];
      const selected = previewAssignmentId ? rows.find((a) => a.id === previewAssignmentId) : null;
      const selectedItem = selected
        ? ({ ...selected, title: getAssignmentTitle(selected) } as InterviewAssignment & {
            title: string;
          })
        : null;

      const gridItems: GridItem[] = rows.map((a) => {
        const category = String(a.template?.category || 'interview');
        const statusMapped =
          a.status === 'assigned'
            ? 'PLANNING'
            : a.status === 'in_progress'
              ? 'EXECUTING'
              : a.status === 'submitted'
                ? 'REVIEW'
                : a.status === 'sent_back'
                  ? 'REJECTED'
                  : a.status === 'approved' || a.status === 'completed'
                    ? 'DONE'
                    : 'DRAFT';
        const title = getAssignmentTitle(a);
        const assignee = a.assignee?.name || a.assignee?.email || '';
        const due = a.dueAt ? new Date(a.dueAt).toLocaleDateString() : '';
        const briefParts = [
          assignee ? `${isPolish ? 'Przydzielony do' : 'Assignee'}: ${assignee}` : '',
          due ? `${isPolish ? 'Termin' : 'Due'}: ${due}` : '',
        ].filter(Boolean);

        return {
          id: a.id,
          name: title,
          type: category,
          typeColor: category,
          status: statusMapped,
          progress: a.session?.completenessPercent ?? 0,
          updatedAt: a.updatedAt || a.createdAt || new Date().toISOString(),
          brief: briefParts.join(' • '),
          _raw: a,
        };
      });

      return (
        <div className="h-full flex flex-col">
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
                    detailsText={detailsText || (isPolish ? 'Brak opisu.' : 'No description.')}
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

                const relations: Array<{ label: string; tone: string }> = [];
                if (a.template?.category)
                  relations.push({
                    label: `${isPolish ? 'Kategoria' : 'Category'}: ${a.template.category}`,
                    tone: 'text-slate-700 dark:text-slate-200',
                  });
                if (a.sessionId || a.session?.id)
                  relations.push({
                    label: `${isPolish ? 'Sesja' : 'Session'}: ${(a.sessionId || a.session?.id || '').slice(0, 8)}…`,
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
                      if (!text) setPreviewAiError(isPolish ? 'AI niedostępne' : 'AI unavailable');
                      else {
                        setPreviewAiError(null);
                        setPreviewAiText(text);
                      }
                    }}
                    onRegenerateAi={async () => {
                      const text = await runAssignmentAi(previewAiLastIntent, a);
                      if (!text) setPreviewAiError(isPolish ? 'AI niedostępne' : 'AI unavailable');
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
                    onOpenFull={() => void openInterviewAssignmentFull(a, false)}
                  />
                );
              }}
            >
              {assignmentsViewMode === 'cards' ? (
                <div className="pl-4 pr-1.5 pt-3 pb-4">
                  <GridView
                    items={gridItems}
                    onItemClick={(item) => {
                      setPreviewAssignmentId(String(item.id));
                      setPreviewAssignmentOpen(true);
                    }}
                    onItemAction={(action, item) => {
                      if (action === 'open') {
                        const a = (item as any)?._raw as InterviewAssignment | undefined;
                        if (a) void openInterviewAssignmentFull(a, false);
                      }
                    }}
                    emptyMessage={isPolish ? 'Brak przydziałów' : 'No assignments'}
                  />
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

      const gridItems: GridItem[] = rows.map((a) => {
        const category = String(a.template?.category || 'interview');
        const statusMapped =
          a.status === 'assigned'
            ? 'PLANNING'
            : a.status === 'in_progress'
              ? 'EXECUTING'
              : a.status === 'submitted'
                ? 'REVIEW'
                : a.status === 'sent_back'
                  ? 'REJECTED'
                  : a.status === 'approved' || a.status === 'completed'
                    ? 'DONE'
                    : 'DRAFT';
        const title = getAssignmentTitle(a);
        const assignee = a.assignee?.name || a.assignee?.email || '';
        const due = a.dueAt ? new Date(a.dueAt).toLocaleDateString() : '';
        const briefParts = [
          assignee ? `${isPolish ? 'Przydzielony do' : 'Assignee'}: ${assignee}` : '',
          due ? `${isPolish ? 'Termin' : 'Due'}: ${due}` : '',
        ].filter(Boolean);

        return {
          id: a.id,
          name: title,
          type: category,
          typeColor: category,
          status: statusMapped,
          progress: a.session?.completenessPercent ?? 0,
          updatedAt: a.updatedAt || a.createdAt || new Date().toISOString(),
          brief: briefParts.join(' • '),
          _raw: a,
        };
      });

      return (
        <div className="h-full flex flex-col">
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
                    detailsText={detailsText || (isPolish ? 'Brak opisu.' : 'No description.')}
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

                const relations: Array<{ label: string; tone: string }> = [];
                if (a.template?.category)
                  relations.push({
                    label: `${isPolish ? 'Kategoria' : 'Category'}: ${a.template.category}`,
                    tone: 'text-slate-700 dark:text-slate-200',
                  });
                if (a.sessionId || a.session?.id)
                  relations.push({
                    label: `${isPolish ? 'Sesja' : 'Session'}: ${(a.sessionId || a.session?.id || '').slice(0, 8)}…`,
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
                      if (!text) setPreviewAiError(isPolish ? 'AI niedostępne' : 'AI unavailable');
                      else {
                        setPreviewAiError(null);
                        setPreviewAiText(text);
                      }
                    }}
                    onRegenerateAi={async () => {
                      const text = await runAssignmentAi(previewAiLastIntent, a);
                      if (!text) setPreviewAiError(isPolish ? 'AI niedostępne' : 'AI unavailable');
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
                  />
                );
              }}
            >
              {assignmentsViewMode === 'cards' ? (
                <div className="pl-4 pr-1.5 pt-3 pb-4">
                  <GridView
                    items={gridItems}
                    onItemClick={(item) => {
                      setPreviewAssignmentId(String(item.id));
                      setPreviewAssignmentOpen(true);
                    }}
                    onItemAction={(action, item) => {
                      if (action === 'open') {
                        const a = (item as any)?._raw as InterviewAssignment | undefined;
                        if (a) void openInterviewAssignmentFull(a, true);
                      }
                    }}
                    emptyMessage={isPolish ? 'Brak przydziałów' : 'No assignments'}
                  />
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
            <AlertTriangle size={40} className="text-slate-300 dark:text-navy-600 mb-3" />
            <p className="text-lg font-medium text-slate-900 dark:text-white">
              {isPolish ? 'Brak wniosków do przeglądu' : 'No insights pending review'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {isPolish
                ? 'Wszystkie wnioski zostały przejrzane.'
                : 'All insights have been reviewed.'}
            </p>
          </div>
        );
      }

      return (
        <div className="p-4 space-y-2">
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
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                        {insight.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {insight.createdAt && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(insight.createdAt).toLocaleDateString(
                            isPolish ? 'pl-PL' : 'en-US'
                          )}
                        </span>
                      )}
                      {findingsCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Target size={12} />
                          {findingsCount} {isPolish ? 'wyników' : 'findings'}
                        </span>
                      )}
                      {crossPerspectiveCount > 0 && (
                        <span className="flex items-center gap-1">
                          <Users size={12} />
                          {crossPerspectiveCount} {isPolish ? 'cross-role' : 'cross-role'}
                        </span>
                      )}
                      {divergenceCount > 0 && (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-300">
                          <AlertTriangle size={12} />
                          {divergenceCount} {isPolish ? 'rozjazdów' : 'divergences'}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-200/70 dark:border-amber-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {isPolish ? 'Do przeglądu' : 'In Review'}
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

    if (activeTab === 'templates') {
      controls.push(
        <div key="area-filter" className="relative">
          <button
            type="button"
            onClick={() => setIsTemplateAreaFilterOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 pr-3 pl-3 h-9 rounded-full text-xs font-medium border bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98]"
            title={isPolish ? 'Filtr obszarów' : 'Area filter'}
          >
            <span className={templateAreaTagFilter.length > 0 ? 'text-primary-500' : ''}>
              {templateAreaTagFilter.length > 0
                ? `${isPolish ? 'Obszary' : 'Areas'} (${templateAreaTagFilter.length})`
                : isPolish
                  ? 'Wszystkie obszary'
                  : 'All areas'}
            </span>
            <ChevronDown size={14} />
          </button>
          {isTemplateAreaFilterOpen ? (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsTemplateAreaFilterOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 z-50 w-64 max-h-80 overflow-auto rounded-xl border border-slate-200/70 dark:border-white/[0.08] bg-white dark:bg-navy-900 shadow-lg p-2">
                <button
                  type="button"
                  onClick={() => setTemplateAreaTagFilter([])}
                  className="w-full text-left px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.04] rounded-lg"
                >
                  {isPolish ? 'Wyczyść filtr' : 'Clear filter'}
                </button>
                {INTERVIEW_TEMPLATE_AREA_TAG_OPTIONS.map((tag) => {
                  const checked = templateAreaTagFilter.includes(tag);
                  return (
                    <label
                      key={tag}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer text-sm text-slate-700 dark:text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setTemplateAreaTagFilter((prev) =>
                            checked ? prev.filter((item) => item !== tag) : [...prev, tag]
                          )
                        }
                        className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span>{getTemplateAreaTagLabel(tag, isPolish)}</span>
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
            className="appearance-none pr-9 pl-3 h-9 rounded-full text-xs font-medium border bg-white/70 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
            title={isPolish ? 'Filtr źródła' : 'Source filter'}
          >
            <option value="all">{isPolish ? 'Wszystkie źródła' : 'All sources'}</option>
            <option value="application">{isPolish ? 'Aplikacja' : 'Application'}</option>
            <option value="organization">{isPolish ? 'Organizacja' : 'Organization'}</option>
            <option value="user">{isPolish ? 'Użytkownik' : 'User'}</option>
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
          />
        </div>,
        <div
          key="templates-view"
          className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
          role="radiogroup"
          aria-label={isPolish ? 'Tryb widoku szablonów' : 'Templates view mode'}
        >
          <button
            type="button"
            onClick={() => setTemplatesViewMode('cards')}
            className={`inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-150 ${templatesViewMode === 'cards' ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'}`}
            title={isPolish ? 'Karty' : 'Cards'}
            role="radio"
            aria-checked={templatesViewMode === 'cards'}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            type="button"
            onClick={() => setTemplatesViewMode('table')}
            className={`inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-150 ${templatesViewMode === 'table' ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'}`}
            title={isPolish ? 'Tabela' : 'Table'}
            role="radio"
            aria-checked={templatesViewMode === 'table'}
          >
            <List size={15} />
          </button>
        </div>
      );
    }

    if (activeTab === 'insights') {
      controls.push(
        <div
          key="insights-view"
          className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
          role="radiogroup"
          aria-label={isPolish ? 'Tryb widoku' : 'View mode'}
        >
          <button
            onClick={() => setInsightsViewMode('flat')}
            className={`inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-150 ${insightsViewMode === 'flat' ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'}`}
            title={isPolish ? 'Lista' : 'List'}
            role="radio"
            aria-checked={insightsViewMode === 'flat'}
          >
            <LayoutList size={15} />
          </button>
          <button
            onClick={() => setInsightsViewMode('report')}
            className={`inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-150 ${insightsViewMode === 'report' ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'}`}
            title={isPolish ? 'Wg raportu' : 'By report'}
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
          className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
          role="radiogroup"
          aria-label={isPolish ? 'Tryb widoku sesji' : 'Sessions view mode'}
        >
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-150 ${
              viewMode === 'table'
                ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'
            }`}
            title={isPolish ? 'Lista' : 'List'}
            role="radio"
            aria-checked={viewMode === 'table'}
          >
            <LayoutList size={15} />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`inline-flex items-center justify-center h-8 w-8 rounded-full transition-colors duration-150 ${
              viewMode === 'grid'
                ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]'
                : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'
            }`}
            title={isPolish ? 'Karty' : 'Cards'}
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
          className="inline-flex items-center rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-slate-100/70 dark:bg-navy-900/60 p-0.5"
          role="radiogroup"
          aria-label={isPolish ? 'Tryb widoku' : 'View mode'}
        >
          <button
            onClick={() => setAssignmentsViewMode('list')}
            className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 ${assignmentsViewMode === 'list' ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'}`}
            title={isPolish ? 'Lista' : 'List'}
            role="radio"
            aria-checked={assignmentsViewMode === 'list'}
          >
            <LayoutList size={16} />
          </button>
          <button
            onClick={() => setAssignmentsViewMode('cards')}
            className={`inline-flex items-center justify-center h-9 w-9 rounded-full transition-colors duration-150 ${assignmentsViewMode === 'cards' ? 'bg-white/80 dark:bg-navy-800 text-primary-700 dark:text-primary-300 shadow-sm border border-slate-200/70 dark:border-white/[0.06]' : 'text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-white/[0.06]'}`}
            title={isPolish ? 'Karty' : 'Cards'}
            role="radio"
            aria-checked={assignmentsViewMode === 'cards'}
          >
            <LayoutGrid size={16} />
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
  ]);

  // Tab-specific primary CTA
  const primaryCta = useMemo(() => {
    if (activeDocumentId) return null;
    if (activeTab === 'sessions') {
      return (
        <button
          onClick={handleNewSession}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-purple-500/40 bg-purple-600 px-4 text-sm font-medium text-white transition-colors hover:bg-purple-500 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
        >
          <span>{isPolish ? 'Nowa sesja' : 'New session'}</span>
        </button>
      );
    }
    if (activeTab === 'templates' && canAssign) {
      return (
        <button
          onClick={handleNewTemplate}
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-400/30 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-colors"
        >
          <span>{isPolish ? 'Nowy szablon' : 'New template'}</span>
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
          className="inline-flex h-9 items-center gap-2 rounded-full border border-amber-500/40 bg-amber-600 px-4 text-sm font-medium text-white transition-colors hover:bg-amber-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
        >
          <span>{isPolish ? 'Nowy insight' : 'New insight'}</span>
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
          className="inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400/30 hover:from-blue-400 hover:to-blue-500 shadow-lg shadow-blue-500/20 transition-colors"
        >
          <span>{isPolish ? 'Przydziel' : 'Assign'}</span>
        </button>
      );
    }
    return null;
  }, [activeDocumentId, activeTab, isPolish, canAssign, handleNewSession, handleNewTemplate]);

  // Command row content (from renderCommandRow, minus search/dynamic tabs which ModuleHub handles)
  const commandRowContent = useMemo(() => {
    if (activeDocumentId) return null;
    return renderCommandRow();
  }, [activeDocumentId, activeTab, renderCommandRow]);

  return (
    <div className="h-full" data-testid="interview-hub">
      <ModuleHub
        persistViewModeKey="interview"
        tabs={tabs}
        activeTab={activeTab as ModuleTab}
        onTabChange={handleMainTabChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setSearchQuery}
        openDocuments={openDocuments}
        activeDocumentId={activeDocumentId}
        onSelectDocument={setActiveDocumentId}
        onCloseDocument={handleCloseDocument}
        onShowList={handleShowList}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearFilters={handleClearFilters}
        rightControls={rightControls}
        primaryCta={primaryCta}
        toolControl={null}
        commandRowContent={commandRowContent}
        availableViewModes={['table']}
        showTabCounts={false}
      >
        <div className="h-full min-h-0 overflow-hidden">{renderContent()}</div>
      </ModuleHub>

      {/* Table View Settings (standard) — Templates */}
      <Modal
        open={isTemplatesViewSettingsOpen}
        onClose={() => setIsTemplatesViewSettingsOpen(false)}
        title={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
        description={
          isPolish
            ? 'Wybierz, które kolumny są widoczne w tabeli.'
            : 'Choose which columns are visible in the table.'
        }
        size="sm"
        footer={
          <>
            <button
              onClick={() => {
                setTemplatesHiddenColumns([...INTERVIEW_TEMPLATES_TABLE_DEFAULT_HIDDEN_COLUMNS]);
                saveHiddenColumns(
                  INTERVIEW_TEMPLATES_TABLE_VIEW_STORAGE_KEY,
                  INTERVIEW_TEMPLATES_TABLE_DEFAULT_HIDDEN_COLUMNS
                );
              }}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            >
              {isPolish ? 'Reset' : 'Reset'}
            </button>
            <button
              onClick={() => setIsTemplatesViewSettingsOpen(false)}
              className="inline-flex items-center justify-center h-9 px-4 rounded-full text-sm font-medium border border-primary-500/40 dark:border-primary-500/30 bg-primary-600 text-white hover:bg-primary-700 transition-colors active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-1 ring-offset-white dark:ring-offset-navy-900"
            >
              {isPolish ? 'Gotowe' : 'Done'}
            </button>
          </>
        }
      >
        {(() => {
          const hiddenSet = new Set(templatesHiddenColumns);
          const cols: Array<{
            id: 'name' | 'category' | 'questions' | 'status' | 'actions';
            label: string;
          }> = [
            { id: 'name', label: isPolish ? 'Nazwa' : 'Name' },
            { id: 'category', label: isPolish ? 'Kategoria' : 'Category' },
            { id: 'questions', label: isPolish ? 'Pytania' : 'Questions' },
            { id: 'status', label: isPolish ? 'Status' : 'Status' },
            { id: 'actions', label: isPolish ? 'Akcje' : 'Actions' },
          ];

          return (
            <div className="space-y-2">
              {cols.map((col) => {
                const alwaysVisible = col.id === 'name' || col.id === 'actions';
                const checked = alwaysVisible ? true : !hiddenSet.has(col.id);
                return (
                  <label
                    key={col.id}
                    className={`flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-800 ${
                      alwaysVisible ? 'opacity-60' : 'cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={alwaysVisible}
                      onChange={() => {
                        if (alwaysVisible) return;
                        setTemplatesHiddenColumns((prev) => {
                          const set = new Set(prev);
                          if (set.has(col.id)) set.delete(col.id);
                          else set.add(col.id);
                          const next = Array.from(set);
                          saveHiddenColumns(INTERVIEW_TEMPLATES_TABLE_VIEW_STORAGE_KEY, next);
                          return next;
                        });
                      }}
                      className="w-4 h-4 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-800 dark:text-slate-200 flex-1">
                      {col.label}
                    </span>
                    {alwaysVisible ? (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {isPolish ? 'Wymagane' : 'Required'}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          );
        })()}
      </Modal>

      {isAssignmentsViewSettingsOpen ? (
        <div
          ref={assignmentsViewSettingsRef}
          className="fixed right-6 top-28 z-50 w-72 rounded-xl border border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-navy-950/95 p-2 shadow-xl shadow-slate-900/10 dark:shadow-black/30 backdrop-blur"
          role="menu"
          aria-label={isPolish ? 'Ustawienia widoku tabeli' : 'Table view settings'}
        >
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {isPolish ? 'Kolumny' : 'Columns'}
          </div>
          <div className="space-y-1">
            {(
              [
                { id: 'template', label: isPolish ? 'Szablon' : 'Template', alwaysVisible: true },
                { id: 'assignee', label: isPolish ? 'Przydzielony do' : 'Assignee' },
                { id: 'status', label: isPolish ? 'Status' : 'Status' },
                { id: 'progress', label: isPolish ? 'Postęp' : 'Progress' },
                { id: 'due', label: isPolish ? 'Do terminu' : 'Days to Due' },
                { id: 'actions', label: isPolish ? 'Akcje' : 'Actions', alwaysVisible: true },
              ] as Array<{ id: string; label: string; alwaysVisible?: boolean }>
            ).map((col) => {
              const alwaysVisible = !!col.alwaysVisible;
              const checked = alwaysVisible ? true : !assignmentsViewHiddenSet.has(col.id);
              return (
                <label
                  key={col.id}
                  className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100/70 dark:hover:bg-white/[0.06] ${
                    alwaysVisible ? 'opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={alwaysVisible}
                    onChange={() => {
                      if (alwaysVisible) return;
                      updateAssignmentsViewHiddenColumns((prev) => {
                        const set = new Set(prev);
                        if (set.has(col.id)) set.delete(col.id);
                        else set.add(col.id);

                        set.delete('template');
                        set.delete('actions');

                        const next = Array.from(set);
                        try {
                          localStorage.setItem(assignmentsViewStorageKey, JSON.stringify(next));
                        } catch {
                          /* ignore */
                        }
                        return next;
                      });
                    }}
                    className="h-3.5 w-3.5 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="flex-1 text-slate-700 dark:text-slate-200">{col.label}</span>
                  {alwaysVisible ? (
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">
                      {isPolish ? 'Wymagane' : 'Required'}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
          <div className="my-2 h-px bg-slate-200/70 dark:bg-white/[0.08]" />
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-slate-100/70 dark:hover:bg-white/[0.06]">
            <input
              type="checkbox"
              checked={assignmentsViewShowRowDescription}
              onChange={(event) => updateAssignmentsViewShowRowDescription(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 dark:border-navy-700 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-slate-700 dark:text-slate-200">
              {isPolish ? 'Pokaż opis / uzasadnienie' : 'Show row description'}
            </span>
          </label>
        </div>
      ) : null}

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
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Wyślij przypomnienie' : 'Send Reminder'}
              </h2>
              <button
                onClick={() => {
                  setShowReminderModal(false);
                  setSelectedAssignment(null);
                }}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {isPolish
                  ? `Czy na pewno chcesz wysłać przypomnienie do ${selectedAssignment.assignee?.name || 'użytkownika'}?`
                  : `Are you sure you want to send a reminder to ${selectedAssignment.assignee?.name || 'the user'}?`}
              </p>
              <div className="bg-slate-50 dark:bg-navy-800 rounded-lg p-3 mb-4">
                <div className="text-sm text-slate-900 dark:text-white font-medium">
                  {selectedAssignment.template?.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {selectedAssignment.dueAt
                    ? `${isPolish ? 'Termin:' : 'Due:'} ${new Date(selectedAssignment.dueAt).toLocaleDateString()}`
                    : isPolish
                      ? 'Brak terminu'
                      : 'No due date'}
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
                  {isPolish ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  onClick={async () => {
                    try {
                      await V8InterviewApi.remindAssignment(selectedAssignment.id).catch(() =>
                        Api.post(`/interview/assignments/${selectedAssignment.id}/remind`, {})
                      );
                      toast.success(isPolish ? 'Przypomnienie wysłane!' : 'Reminder sent!');
                      setShowReminderModal(false);
                      setSelectedAssignment(null);
                    } catch (error: any) {
                      console.error('[InterviewHub] Failed to send reminder from modal:', error);
                      safeToastError(
                        error,
                        isPolish ? 'Nie udało się wysłać przypomnienia' : 'Failed to send reminder',
                        isPolish
                      );
                    }
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium transition-colors"
                >
                  <Bell size={16} className="inline mr-2" />
                  {isPolish ? 'Wyślij' : 'Send'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Back Modal */}
      {showSendBackModal && selectedAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Zwróć do poprawy' : 'Send Back for Revision'}
              </h2>
              <button
                onClick={() => {
                  setShowSendBackModal(false);
                  setSelectedAssignment(null);
                }}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
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
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {isPolish
                  ? 'Podaj powód zwrotu wywiadu do poprawy:'
                  : 'Provide a reason for sending the interview back:'}
              </p>
              <textarea
                name="reason"
                required
                rows={4}
                placeholder={
                  isPolish ? 'Opisz co wymaga poprawy...' : 'Describe what needs to be improved...'
                }
                className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all resize-none"
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
                  {isPolish ? 'Anuluj' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium transition-colors"
                >
                  <RotateCcw size={16} className="inline mr-2" />
                  {isPolish ? 'Zwróć' : 'Send Back'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Analytics Modal (Placeholder) */}
      {showAnalytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 size={20} className="text-primary-400" />
                {isPolish ? 'Analityka wywiadów' : 'Interview Analytics'}
              </h2>
              <button
                onClick={() => setShowAnalytics(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                  <div className="text-2xl font-bold text-white">{sessions.length}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Wszystkie sesje' : 'Total Sessions'}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                  <div className="text-2xl font-bold text-emerald-400">
                    {
                      sessions.filter((s) =>
                        ['approved', 'completed'].includes(getSessionWorkflowStatus(s))
                      ).length
                    }
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Zatwierdzone' : 'Approved'}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                  <div className="text-2xl font-bold text-purple-400">
                    {sessions.filter((s) => getSessionWorkflowStatus(s) === 'in_progress').length}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'W trakcie' : 'In Progress'}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                  <div className="text-2xl font-bold text-amber-400">{insights.length}</div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Wnioski AI' : 'AI Insights'}
                  </div>
                </div>
              </div>

              {/* Assignment Stats */}
              <div className="bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                  {isPolish ? 'Statystyki przydziałów' : 'Assignment Statistics'}
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xl font-bold text-blue-400">
                      {managedAssignments.length}
                    </div>
                    <div className="text-xs text-slate-500">
                      {isPolish ? 'Zarządzane' : 'Managed'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-red-400">
                      {overdueAssignments.length}
                    </div>
                    <div className="text-xs text-slate-500">
                      {isPolish ? 'Przeterminowane' : 'Overdue'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-emerald-400">
                      {managedAssignments.filter((a) => a.status === 'completed').length}
                    </div>
                    <div className="text-xs text-slate-500">
                      {isPolish ? 'Ukończone' : 'Completed'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-amber-400">
                      {managedAssignments.filter((a) => a.status === 'submitted').length}
                    </div>
                    <div className="text-xs text-slate-500">
                      {isPolish ? 'Do przeglądu' : 'Pending Review'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Template Usage */}
              <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">
                  {isPolish ? 'Użycie szablonów' : 'Template Usage'}
                </h3>
                <div className="space-y-3">
                  {templates.slice(0, 5).map((template) => (
                    <div key={template.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-blue-400" />
                        <span className="text-sm text-slate-300">{template.name}</span>
                      </div>
                      <span className="text-xs text-slate-500">
                        {template.questionCount} {isPolish ? 'pytań' : 'questions'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-center text-slate-500 text-sm mt-6">
                {isPolish
                  ? 'Przejdź do zakładki Analytics, aby zobaczyć szczegóły'
                  : 'Visit the Analytics tab for detailed insights'}
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

export default InterviewHub;
