/**
 * InterviewHub
 * Unified Interview module with ModuleHub pattern (Golden Standard)
 *
 * Tabs: Sessions, Insights, Templates
 * Features:
 * - Dynamic tabs for open documents
 * - Table/Grid views for listing items
 * - Full document view when selected
 *
 * @see docs/wdrozenia/UI_UX_GOLDEN_STANDARD.md
 */

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Brain,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Clock,
  Copy,
  Download,
  Edit3,
  FilePlus,
  FileText,
  Grid3X3,
  Inbox,
  Lightbulb,
  List,
  Loader2,
  MessageSquare,
  MoreVertical,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Target,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useInterviewPermissions } from '@/hooks/useInterviewPermissions';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

// Helper function to safely display error messages
const safeToastError = (error: any, defaultMessage: string, isPolish: boolean) => {
  let errorMessage: string;
  if (typeof error === 'string') {
    errorMessage = error;
  } else if (error?.response?.data?.error) {
    const errData = error.response.data.error;
    errorMessage = typeof errData === 'string' ? errData : JSON.stringify(errData);
  } else if (error?.message) {
    errorMessage =
      typeof error.message === 'string' ? error.message : JSON.stringify(error.message);
  } else if (error?.error) {
    errorMessage = typeof error.error === 'string' ? error.error : JSON.stringify(error.error);
  } else {
    errorMessage = defaultMessage;
  }
  toast.error(errorMessage);
};

import {
  type ColumnDef,
  ColumnResizer,
  type ColumnWidths,
  type TableFilters,
} from '@/components/ui/ResizableTable';
import { FilterDropdown } from '@/components/ui/ResizableTable/FilterDropdown';

import { type CardViewStyle, CardViewSwitcher } from '../shared/CardViewSwitcher';
import { RowActionsMenu } from '../shared/RowActionsMenu';
import { TableWithPreviewLayout } from '../shared/TableWithPreviewLayout';
import { AssignInterviewModal } from './AssignInterviewModal';
import { InsightCreatorModal } from './InsightCreatorModal';
import { InsightViewer } from './InsightViewer';
import { InterviewWorkspace } from './InterviewWorkspace';
import { TemplateBuilder } from './TemplateBuilder';

// Types
interface InterviewSession {
  id: string;
  organizationId: string;
  projectId?: string;
  name: string;
  ownerId: string;
  status: string; // 'active' | 'completed' | 'archived' - using string to avoid type conflicts
  totalQuestions: number;
  answeredQuestions: number;
  startedAt: string;
  completedAt?: string;
  lastActivityAt?: string;
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

interface InterviewTemplate {
  id: string;
  name: string;
  description: string;
  questionCount: number;
  category: string;
  isDefault: boolean;
  createdAt: string;
}

type ModuleTab = 'my-assignments' | 'sessions' | 'templates' | 'insights' | 'managed';
type ViewMode = 'table' | 'grid';
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

interface OpenDocument {
  id: string;
  type: 'session' | 'insight' | 'template';
  name: string;
  status: ItemStatus;
  data?: InterviewSession | InterviewInsight | InterviewTemplate;
}

// Shared button styles (Golden Standard)
const BUTTON_BASE = `
  flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium
  border transition-all duration-200
`;

const BUTTON_INACTIVE = `
  ${BUTTON_BASE}
  bg-slate-100 dark:bg-navy-800 border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-300
  hover:bg-slate-200 dark:hover:bg-navy-700 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-white
`;

const BUTTON_ACTIVE = `
  ${BUTTON_BASE}
  bg-primary-500/15 border-primary-500 text-primary-600 dark:text-primary-400
  shadow-sm shadow-primary-500/10
`;

// Tab styles for dynamic tabs
const TAB_BASE = `
  flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium
  border border-l-2 transition-all duration-200 cursor-pointer
`;

const TAB_INACTIVE = `
  ${TAB_BASE}
  bg-slate-100 dark:bg-navy-800 border-slate-300 dark:border-navy-600 text-slate-600 dark:text-slate-400
  hover:bg-slate-200 dark:hover:bg-navy-700 hover:border-slate-400 dark:hover:border-slate-500 hover:text-slate-900 dark:hover:text-white
`;

const TAB_ACTIVE = `
  ${TAB_BASE}
  bg-primary-500/15 border-primary-500 text-primary-600 dark:text-primary-400
  shadow-sm shadow-primary-500/10
`;

// Type colors
const TYPE_COLORS = {
  session: 'border-l-purple-500',
  insight: 'border-l-amber-500',
  template: 'border-l-blue-500',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  draft: 'bg-slate-400',
  drafting: 'bg-slate-400',
  in_review: 'bg-amber-400',
  review: 'bg-amber-400',
  approved: 'bg-emerald-400',
  accepted: 'bg-emerald-400',
  rejected: 'bg-red-400',
  completed: 'bg-emerald-400',
  active: 'bg-purple-400',
  archived: 'bg-slate-500',
  // Assignment statuses
  assigned: 'bg-blue-400',
  in_progress: 'bg-purple-400',
  submitted: 'bg-amber-400',
  sent_back: 'bg-red-400',
};

export const InterviewHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentProjectId, setCurrentProjectId, currentOrganization } = useAppStore();

  // Permissions hook
  const {
    canAssign,
    canViewManaged,
    canViewOverdue,
    isLoading: permissionsLoading,
  } = useInterviewPermissions();

  // Get session ID from URL if provided
  const sessionIdFromUrl = searchParams.get('sessionId');
  const assignmentIdFromUrl = searchParams.get('assignmentId');
  const insightIdFromUrl = searchParams.get('insightId');

  // State - domyślnie Inbox (moje przydziały)
  const [activeTab, setActiveTab] = useState<ModuleTab>('my-assignments');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sessionStatusFilter, setSessionStatusFilter] = useState<string>('all');
  const [templateCategoryFilter, setTemplateCategoryFilter] = useState<string>('all');
  const [selectedTemplateForAssign, setSelectedTemplateForAssign] =
    useState<InterviewTemplate | null>(null);
  const [insightTypeFilter, setInsightTypeFilter] = useState<string>('all');
  const [insightStatusFilter, setInsightStatusFilter] = useState<string>('all');
  const [insightViewStyle, setInsightViewStyle] = useState<CardViewStyle>('d');
  const [insightGroupBy, setInsightGroupBy] = useState<'report' | 'person'>('report');
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string>('all');
  const [selectedInsightId, setSelectedInsightId] = useState<string | null>(null);
  const [insightTableFilters, setInsightTableFilters] = useState<TableFilters>({});
  const [insightColumnWidths, setInsightColumnWidths] = useState<ColumnWidths>({
    title: 200,
    type: 120,
    status: 100,
    source: 100,
    date: 110,
    actions: 80,
  });
  const [openInsightFilterId, setOpenInsightFilterId] = useState<string | null>(null);

  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [insights, setInsights] = useState<InterviewInsight[]>([]);
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Assignments state
  const [myAssignments, setMyAssignments] = useState<InterviewAssignment[]>([]);
  const [managedAssignments, setManagedAssignments] = useState<InterviewAssignment[]>([]);
  const [overdueAssignments, setOverdueAssignments] = useState<InterviewAssignment[]>([]);
  const [assignmentsLoading, setAssignmentsLoading] = useState(false);

  // Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showSendBackModal, setShowSendBackModal] = useState(false);
  const [showInsightModal, setShowInsightModal] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<InterviewAssignment | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [selectedSessionsForInsight, setSelectedSessionsForInsight] = useState<string[]>([]);

  // Template questions cache (for read-only preview)
  const [templateQuestionsById, setTemplateQuestionsById] = useState<Record<string, any[]>>({});
  const [templateQuestionsLoading, setTemplateQuestionsLoading] = useState<Record<string, boolean>>(
    {}
  );

  // V3-A02: Dynamic documents state with sessionStorage persistence
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>(() => {
    try {
      const raw = window.sessionStorage.getItem('moduleHub.openDocuments.interview');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed?.openDocuments) ? parsed.openDocuments : [];
    } catch { return []; }
  });
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(() => {
    try {
      const raw = window.sessionStorage.getItem('moduleHub.openDocuments.interview');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return typeof parsed?.activeDocumentId === 'string' ? parsed.activeDocumentId : null;
    } catch { return null; }
  });
  useEffect(() => {
    try {
      window.sessionStorage.setItem('moduleHub.openDocuments.interview', JSON.stringify({ openDocuments, activeDocumentId }));
    } catch { /* ignore */ }
  }, [openDocuments, activeDocumentId]);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [sessionsRes, insightsRes, templatesRes] = await Promise.all([
          // Sessions tab is "accepted sources" in the manager workflow.
          // Non-managers won't see the tab, so empty here is fine.
          Api.get('/interview/sessions/accepted').catch(() => []),
          Api.get('/interview/insights').catch(() => []),
          Api.get('/interview/templates').catch(() => []),
        ]);

        setSessions(Array.isArray(sessionsRes) ? sessionsRes : []);
        setInsights(Array.isArray(insightsRes) ? insightsRes : []);
        setTemplates(Array.isArray(templatesRes) ? templatesRes : []);
      } catch (error) {
        console.error('[InterviewHub] Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Load insights function (for refresh)
  const loadInsights = useCallback(async () => {
    try {
      const insightsRes = await Api.get('/interview/insights').catch(() => []);
      setInsights(Array.isArray(insightsRes) ? insightsRes : []);
    } catch (error) {
      console.error('[InterviewHub] Failed to load insights:', error);
    }
  }, []);

  // Load assignments data
  useEffect(() => {
    const loadAssignments = async () => {
      if (permissionsLoading) return;

      setAssignmentsLoading(true);
      try {
        // Always load my assignments
        const myRes = await Api.get('/interview/assignments/my').catch(() => []);
        setMyAssignments(Array.isArray(myRes) ? myRes : []);

        // Load managed/overdue only if user has permission
        if (canViewManaged) {
          const [managedRes, overdueRes] = await Promise.all([
            Api.get('/interview/assignments/managed').catch(() => []),
            Api.get('/interview/assignments/overdue').catch(() => []),
          ]);
          setManagedAssignments(Array.isArray(managedRes) ? managedRes : []);
          setOverdueAssignments(Array.isArray(overdueRes) ? overdueRes : []);
        }
      } catch (error) {
        console.error('[InterviewHub] Failed to load assignments:', error);
      } finally {
        setAssignmentsLoading(false);
      }
    };

    loadAssignments();
  }, [permissionsLoading, canViewManaged]);

  // Open session from URL
  useEffect(() => {
    if (sessionIdFromUrl && sessions.length > 0) {
      const session = sessions.find((s) => s.id === sessionIdFromUrl);
      if (session) {
        handleOpenDocument({
          id: session.id,
          type: 'session',
          name: session.name || 'Interview Session',
          status: session.status as ItemStatus,
          data: session,
        });
      }
    }
  }, [sessionIdFromUrl, sessions]);

  // Open insight from URL
  useEffect(() => {
    if (!insightIdFromUrl) return;
    const insight = insights.find((i) => i.id === insightIdFromUrl);
    if (!insight) return;
    handleOpenDocument({
      id: insight.id,
      type: 'insight',
      name: insight.title || 'Insight',
      status: (insight.status as ItemStatus) || 'approved',
      data: insight,
    });
    const next = new URLSearchParams(searchParams);
    next.delete('insightId');
    setSearchParams(next, { replace: true });
  }, [insightIdFromUrl, insights, searchParams, setSearchParams]);

  // Load template questions when a template doc is opened
  useEffect(() => {
    const doc = openDocuments.find((d) => d.id === activeDocumentId);
    if (!doc || doc.type !== 'template') return;

    const templateId = doc.id;
    if (templateQuestionsById[templateId] || templateQuestionsLoading[templateId]) return;

    setTemplateQuestionsLoading((prev) => ({ ...prev, [templateId]: true }));
    Api.get(`/interview/templates/${templateId}/questions`)
      .then((rows) => {
        setTemplateQuestionsById((prev) => ({
          ...prev,
          [templateId]: Array.isArray(rows) ? rows : [],
        }));
      })
      .catch((err) => {
        console.error('[InterviewHub] Failed to load template questions:', err);
      })
      .finally(() => {
        setTemplateQuestionsLoading((prev) => ({ ...prev, [templateId]: false }));
      });
  }, [activeDocumentId, openDocuments, templateQuestionsById, templateQuestionsLoading]);

  // Filter sessions
  const filteredSessions = useMemo(() => {
    let result = sessions;

    // Filter by status
    if (sessionStatusFilter !== 'all') {
      result = result.filter((s) => s.status === sessionStatusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          new Date(s.startedAt).toLocaleDateString().includes(query)
      );
    }

    return result;
  }, [sessions, searchQuery, sessionStatusFilter]);

  // Session status counts for filter badges
  const sessionStatusCounts = useMemo(() => {
    return {
      all: sessions.length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      archived: sessions.filter((s) => s.status === 'archived').length,
    };
  }, [sessions]);

  const sessionStatusOptions = useMemo(() => {
    const opts = [
      {
        id: 'all',
        label: isPolish ? 'Wszystkie' : 'All',
        count: sessionStatusCounts.all,
      },
      {
        id: 'completed',
        label: isPolish ? 'Zakończone' : 'Completed',
        count: sessionStatusCounts.completed,
      },
      {
        id: 'archived',
        label: isPolish ? 'Archiwum' : 'Archived',
        count: sessionStatusCounts.archived,
      },
    ];

    return opts.map((o) => ({
      ...o,
      display: `${o.label} (${o.count})`,
    }));
  }, [isPolish, sessionStatusCounts]);

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
          i.title.toLowerCase().includes(query) || (i.content || '').toLowerCase().includes(query)
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
    { value: 'generating', label: 'Generating' },
    { value: 'completed', label: 'Completed' },
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
      result = result.filter((i) => statusFilter.includes((i.status || 'completed') as string));
    }
    return result;
  }, [filteredInsights, insightTableFilters]);

  // Insight statistics
  const insightStats = useMemo(() => {
    return {
      total: insights.length,
      generating: insights.filter((i) => i.status === 'generating').length,
      completed: insights.filter((i) => i.status === 'completed').length,
      failed: insights.filter((i) => i.status === 'failed').length,
      exportedToTools: insights.filter((i) => i.exportedToTools).length,
      exportedToAssessment: insights.filter((i) => i.exportedToAssessment).length,
    };
  }, [insights]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    let result = templates;

    // Filter by category
    if (templateCategoryFilter !== 'all') {
      result = result.filter((t) => t.category === templateCategoryFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)
      );
    }

    return result;
  }, [templates, searchQuery, templateCategoryFilter]);

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

  const managedAssignmentStatusOptions = useMemo(() => {
    const opts = [
      {
        id: 'all',
        label: isPolish ? 'Wszystkie' : 'All',
        count: managedAssignmentStatusCounts.all,
      },
      ...(overdueAssignments.length > 0
        ? [
            {
              id: 'overdue' as const,
              label: isPolish ? 'Zaległe' : 'Overdue',
              count: overdueAssignments.length,
            },
          ]
        : []),
      {
        id: 'submitted',
        label: isPolish ? 'Do zatwierdzenia' : 'To approve',
        count: managedAssignmentStatusCounts.submitted,
      },
      {
        id: 'assigned',
        label: isPolish ? 'Przydzielone' : 'Assigned',
        count: managedAssignmentStatusCounts.assigned,
      },
      {
        id: 'in_progress',
        label: isPolish ? 'W trakcie' : 'In progress',
        count: managedAssignmentStatusCounts.in_progress,
      },
      {
        id: 'sent_back',
        label: isPolish ? 'Do poprawy' : 'Sent back',
        count: managedAssignmentStatusCounts.sent_back,
      },
      {
        id: 'approved',
        label: isPolish ? 'Zatwierdzone' : 'Approved',
        count: managedAssignmentStatusCounts.approved,
      },
      {
        id: 'completed',
        label: isPolish ? 'Zakończone' : 'Completed',
        count: managedAssignmentStatusCounts.completed,
      },
    ];

    return opts.map((o) => ({ ...o, display: `${o.label} (${o.count})` }));
  }, [isPolish, managedAssignmentStatusCounts]);

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

  // Get unique template categories
  const templateCategories = useMemo(() => {
    const categories = new Set(templates.map((t) => t.category));
    return Array.from(categories).sort();
  }, [templates]);

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
  // Manager (PM/ADMIN): wszystkie zakładki
  const tabs = useMemo(() => {
    const baseTabs: Array<{
      id: ModuleTab;
      label: string;
      icon: React.ReactNode;
      count?: number;
      hasWarning?: boolean;
    }> = [
      // 1. Inbox - przydzielone do mnie (widoczne dla wszystkich)
      {
        id: 'my-assignments' as ModuleTab,
        label: isPolish ? 'Inbox' : 'Inbox',
        icon: <Inbox size={16} />,
        count: myAssignments.filter((a) => a.status !== 'approved' && a.status !== 'completed')
          .length,
      },
    ];

    // Dodatkowe zakładki tylko dla PM/Admin
    if (canViewManaged) {
      // 2. Sessions - sesje wywiadów (PM/Admin)
      baseTabs.push({
        id: 'sessions' as ModuleTab,
        label: isPolish ? 'Sesje' : 'Sessions',
        icon: <MessageSquare size={16} />,
        count: sessions.length,
      });

      // 3. Assigned - wywiady które przydzieliłem (PM/Admin)
      const assignedCount = managedAssignments.length;
      const overdueCount = overdueAssignments.length;
      baseTabs.push({
        id: 'managed' as ModuleTab,
        label: isPolish ? 'Przydzielone' : 'Assigned',
        icon: <ClipboardList size={16} />,
        count: assignedCount,
        hasWarning: overdueCount > 0,
      });

      // 4. Templates - biblioteka szablonów (PM/Admin)
      baseTabs.push({
        id: 'templates' as ModuleTab,
        label: isPolish ? 'Szablony' : 'Templates',
        icon: <FileText size={16} />,
        count: templates.length,
      });

      // 5. Insights - wnioski AI (PM/Admin) - rightmost
      baseTabs.push({
        id: 'insights' as ModuleTab,
        label: isPolish ? 'Wnioski' : 'Insights',
        icon: <Lightbulb size={16} />,
        count: insights.length,
      });
    }

    return baseTabs;
  }, [
    isPolish,
    sessions.length,
    insights.length,
    templates.length,
    myAssignments,
    managedAssignments,
    overdueAssignments,
    canViewManaged,
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
      const newSession = await Api.post('/interview/sessions', {
        projectId,
        name: `Interview ${new Date().toLocaleDateString()}`,
      });

      setSessions((prev) => [newSession as InterviewSession, ...prev]);

      // Open the new session (inline to avoid TDZ issues)
      const doc: OpenDocument = {
        id: (newSession as InterviewSession).id,
        type: 'session',
        name: (newSession as InterviewSession).name || 'Interview Session',
        status: (newSession as any)?.status || 'in_progress',
        data: newSession as InterviewSession,
      };
      setOpenDocuments((prev) => {
        if (prev.find((d) => d.id === doc.id)) return prev;
        return [...prev, doc];
      });
      setActiveDocumentId(doc.id);

      toast.success(isPolish ? 'Nowa sesja wywiadu rozpoczęta!' : 'New interview session started!');
    } catch (error) {
      console.error('[InterviewHub] Failed to create session:', error);
      toast.error(isPolish ? 'Nie udało się utworzyć sesji' : 'Failed to create session');
    }
  }, [ensureProjectId, isPolish]);

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
      handleOpenDocument({
        id: session.id,
        type: 'session',
        name: session.name || 'Interview Session',
        status: session.status as ItemStatus,
        data: session,
      });
    },
    [handleOpenDocument]
  );

  const handleViewInsight = useCallback(
    (insight: InterviewInsight) => {
      // Open as dynamic tab with full view (like sessions and templates)
      handleOpenDocument({
        id: insight.id,
        type: 'insight',
        name: insight.title,
        status: (insight.status as ItemStatus) || 'approved',
        data: insight,
      });
    },
    [handleOpenDocument]
  );

  const handleViewTemplate = useCallback(
    (template: InterviewTemplate) => {
      handleOpenDocument({
        id: template.id,
        type: 'template',
        name: template.name,
        status: 'approved',
        data: template,
      });
    },
    [handleOpenDocument]
  );

  const handleSessionComplete = useCallback(
    (sessionId: string) => {
      toast.success(isPolish ? 'Wywiad zakończony!' : 'Interview completed!');
      // Refresh sessions list
      Api.get('/interview/sessions/accepted').then((res) => {
        setSessions(Array.isArray(res) ? res : []);
      });
    },
    [isPolish]
  );

  const handleSessionChange = useCallback((session: InterviewSession) => {
    // Update open document
    setOpenDocuments((prev) =>
      prev.map((doc) =>
        doc.id === session.id
          ? { ...doc, name: session.name || 'Interview Session', data: session }
          : doc
      )
    );
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
  };

  // Template actions
  const handleNewTemplate = useCallback(() => {
    setEditingTemplateId(null);
    setShowTemplateBuilder(true);
  }, []);

  const handleEditTemplate = useCallback((templateId: string) => {
    setEditingTemplateId(templateId);
    setShowTemplateBuilder(true);
  }, []);

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
        setTemplates(Array.isArray(templatesRes) ? templatesRes : []);

        // Open the cloned template for editing
        setEditingTemplateId((cloned as any).id);
        setShowTemplateBuilder(true);
      } catch (error) {
        toast.dismiss();
        toast.error(isPolish ? 'Nie udało się sklonować szablonu' : 'Failed to clone template');
        console.error('[InterviewHub] Failed to clone template:', error);
      }
    },
    [isPolish]
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
        setTemplates(Array.isArray(templatesRes) ? templatesRes : []);
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
        await Api.post(`/interview/assignments/${selectedAssignment.id}/send-back`, { reason });
        toast.success(isPolish ? 'Wywiad zwrócony do poprawy!' : 'Interview sent back!');
        setShowSendBackModal(false);
        setSelectedAssignment(null);

        // Refresh all assignments (both my and managed)
        const [myRes, managedRes, overdueRes] = await Promise.all([
          Api.get('/interview/assignments/my').catch(() => []),
          Api.get('/interview/assignments/managed').catch(() => []),
          Api.get('/interview/assignments/overdue').catch(() => []),
        ]);
        setMyAssignments(Array.isArray(myRes) ? myRes : []);
        setManagedAssignments(Array.isArray(managedRes) ? managedRes : []);
        setOverdueAssignments(Array.isArray(overdueRes) ? overdueRes : []);
      } catch (error: any) {
        console.error('[InterviewHub] Failed to send back:', error);
        safeToastError(
          error,
          isPolish ? 'Nie udało się zwrócić wywiadu' : 'Failed to send back',
          isPolish
        );
      }
    },
    [selectedAssignment, isPolish]
  );

  const handleApproveAssignment = useCallback(
    async (assignment: InterviewAssignment) => {
      try {
        await Api.post(`/interview/assignments/${assignment.id}/approve`, {});
        toast.success(isPolish ? 'Wywiad zatwierdzony!' : 'Interview approved!');

        // Refresh assignments + accepted sessions (post-approval)
        const [myRes, managedRes, overdueRes, sessionsRes] = await Promise.all([
          Api.get('/interview/assignments/my').catch(() => []),
          Api.get('/interview/assignments/managed').catch(() => []),
          Api.get('/interview/assignments/overdue').catch(() => []),
          Api.get('/interview/sessions/accepted').catch(() => []),
        ]);
        setMyAssignments(Array.isArray(myRes) ? myRes : []);
        setManagedAssignments(Array.isArray(managedRes) ? managedRes : []);
        setOverdueAssignments(Array.isArray(overdueRes) ? overdueRes : []);
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
    [isPolish]
  );

  // Export action — generates and downloads file
  const handleExport = useCallback(
    (format: 'pdf' | 'excel') => {
      try {
        // Build export content from sessions
        const lines: string[] = [];
        lines.push('# Interview Sessions Export');
        lines.push(`Generated: ${new Date().toLocaleDateString()}`);
        lines.push('');
        sessions.forEach(
          (s: { name?: string; status?: string; createdAt?: string; questions?: unknown[] }) => {
            lines.push(`## ${s.name || 'Untitled Session'}`);
            lines.push(`Status: ${s.status || '—'}`);
            lines.push(
              `Created: ${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '—'}`
            );
            lines.push(`Questions: ${Array.isArray(s.questions) ? s.questions.length : 0}`);
            lines.push('');
          }
        );

        const content = lines.join('\n');
        const mimeType = format === 'pdf' ? 'text/plain' : 'text/csv';
        const ext = format === 'pdf' ? 'txt' : 'csv';
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `interview-sessions-export.${ext}`;
        a.click();
        URL.revokeObjectURL(url);

        toast.success(
          isPolish
            ? `Eksport do ${format.toUpperCase()} zakończony`
            : `Export to ${format.toUpperCase()} completed`
        );
      } catch {
        toast.error(isPolish ? 'Błąd eksportu' : 'Export failed');
      }
      setShowExportModal(false);
    },
    [isPolish, sessions]
  );

  // Generate insight from session
  const handleGenerateInsight = useCallback(
    async (session: InterviewSession) => {
      try {
        toast.loading(isPolish ? 'Generowanie wniosków AI...' : 'Generating AI insights...');
        await Api.post('/interview/insights', { sessionId: session.id });
        toast.dismiss();
        toast.success(isPolish ? 'Wnioski wygenerowane!' : 'Insights generated!');

        // Refresh insights
        const insightsRes = await Api.get('/interview/insights').catch(() => []);
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

  // Render Dynamic Tabs
  const renderDynamicTabs = () => {
    if (openDocuments.length === 0) return null;

    const isListActive = activeDocumentId === null;

    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-100/50 dark:bg-navy-900/50 border-b border-slate-200 dark:border-navy-700">
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
          <span>List</span>
        </button>

        {/* Separator */}
        <div className="w-px h-6 bg-slate-300 dark:bg-navy-600" />

        {/* Document Tabs */}
        {openDocuments.map((doc) => {
          const isActive = doc.id === activeDocumentId;
          const leftBorderColor = TYPE_COLORS[doc.type];
          const statusColor = STATUS_COLORS[doc.status];

          return (
            <div
              key={doc.id}
              className={`group ${isActive ? TAB_ACTIVE : TAB_INACTIVE} ${leftBorderColor}`}
              onClick={() => setActiveDocumentId(doc.id)}
            >
              {/* Type Icon */}
              {doc.type === 'session' && <MessageSquare size={14} />}
              {doc.type === 'insight' && <Lightbulb size={14} />}
              {doc.type === 'template' && <FileText size={14} />}

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
    );
  };

  // Session status configuration
  const getSessionStatusConfig = (status: string) => {
    const configs: Record<
      string,
      { label: { en: string; pl: string }; bgColor: string; textColor: string; dotColor: string }
    > = {
      in_progress: {
        label: { en: 'In Progress', pl: 'W trakcie' },
        bgColor: 'bg-purple-500/20',
        textColor: 'text-purple-300',
        dotColor: 'bg-purple-400',
      },
      submitted: {
        label: { en: 'Submitted', pl: 'Wysłany' },
        bgColor: 'bg-amber-500/20',
        textColor: 'text-amber-300',
        dotColor: 'bg-amber-400',
      },
      in_review: {
        label: { en: 'In Review', pl: 'Do przeglądu' },
        bgColor: 'bg-amber-500/20',
        textColor: 'text-amber-300',
        dotColor: 'bg-amber-400',
      },
      completed: {
        label: { en: 'Completed', pl: 'Zakończony' },
        bgColor: 'bg-emerald-500/20',
        textColor: 'text-emerald-300',
        dotColor: 'bg-emerald-400',
      },
      paused: {
        label: { en: 'Paused', pl: 'Wstrzymany' },
        bgColor: 'bg-slate-500/20',
        textColor: 'text-slate-600 dark:text-slate-300',
        dotColor: 'bg-slate-400',
      },
      archived: {
        label: { en: 'Archived', pl: 'Zarchiwizowany' },
        bgColor: 'bg-slate-500/20',
        textColor: 'text-slate-600 dark:text-slate-300',
        dotColor: 'bg-slate-400',
      },
    };
    return configs[status] || configs.in_progress;
  };

  // Render table view for sessions
  const renderSessionsTable = () => (
    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-slate-200 dark:border-navy-700">
            <th className="w-[40%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Nazwa' : 'Name'}
            </th>
            <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Status' : 'Status'}
            </th>
            <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Postęp' : 'Progress'}
            </th>
            <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Data' : 'Date'}
            </th>
            <th className="w-[15%] px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Akcje' : 'Actions'}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredSessions.map((session) => {
            const progress =
              session.totalQuestions > 0
                ? Math.round((session.answeredQuestions / session.totalQuestions) * 100)
                : 0;
            const statusConfig = getSessionStatusConfig(session.status);
            const isCompleted = session.status === 'completed';

            return (
              <tr
                key={session.id}
                onClick={() => handleViewSession(session)}
                className="group hover:bg-slate-50 dark:hover:bg-navy-800/50 cursor-pointer transition-colors border-b border-slate-200/50 dark:border-navy-700/50 last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${statusConfig.bgColor}`}
                    >
                      <Brain size={16} className={statusConfig.textColor} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-sm text-slate-900 dark:text-white font-medium block truncate">
                        {session.name || 'Discovery Interview'}
                      </span>
                      {session.ownerId && (
                        <span className="text-xs text-slate-500 truncate block">
                          ID: {session.id.slice(0, 8)}...
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
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
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-[100px] h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress === 100 ? 'bg-emerald-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                    <Calendar size={12} />
                    {new Date(session.startedAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end">
                    <RowActionsMenu
                      iconVariant="vertical"
                      actions={[
                        {
                          id: 'open',
                          label: isPolish ? 'Otwórz' : 'Open',
                          icon: ChevronRight,
                          onClick: () => handleViewSession(session),
                        },
                        ...(isCompleted
                          ? [
                              {
                                id: 'generate-insight',
                                label: isPolish ? 'Generuj wnioski AI' : 'Generate AI insights',
                                icon: Lightbulb,
                                onClick: () => handleGenerateInsight(session),
                              },
                            ]
                          : []),
                        {
                          id: 'export',
                          label: isPolish ? 'Eksportuj' : 'Export',
                          icon: Download,
                          onClick: () => setShowExportModal(true),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredSessions.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center">
                  <MessageSquare className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {isPolish ? 'Brak zaakceptowanych sesji' : 'No accepted sessions yet'}
                  </p>
                  <p className="text-xs text-slate-500 mt-2 max-w-md">
                    {isPolish
                      ? 'Sesje pojawiają się tutaj dopiero po zatwierdzeniu wywiadu w zakładce „Przydzielone”.'
                      : 'Sessions appear here only after an interview is approved in the “Assigned” tab.'}
                  </p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  // Render grid view for sessions
  const renderSessionsGrid = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredSessions.map((session) => {
        const progress =
          session.totalQuestions > 0
            ? Math.round((session.answeredQuestions / session.totalQuestions) * 100)
            : 0;

        const typeColor =
          session.status === 'completed'
            ? 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30'
            : session.status === 'in_progress'
              ? 'from-purple-500/20 to-purple-600/10 border-purple-500/30'
              : session.status === 'submitted'
                ? 'from-amber-500/15 to-amber-600/10 border-amber-500/30'
                : 'from-slate-500/20 to-slate-600/10 border-slate-500/30';

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
                      session.status === 'completed'
                        ? 'text-emerald-400'
                        : session.status === 'in_progress'
                          ? 'text-purple-400'
                          : session.status === 'submitted'
                            ? 'text-amber-400'
                            : 'text-slate-400'
                    }
                  />
                  <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">
                    {session.status === 'completed'
                      ? 'DONE'
                      : session.status === 'in_progress'
                        ? 'LIVE'
                        : session.status === 'submitted'
                          ? 'SUB'
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
                <span className="text-xs text-slate-500 dark:text-slate-400">{progress}%</span>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 pb-4 flex items-center justify-between">
              <div
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${
                  session.status === 'completed'
                    ? 'bg-emerald-500/20'
                    : session.status === 'in_progress'
                      ? 'bg-purple-500/20'
                      : session.status === 'submitted'
                        ? 'bg-amber-500/20'
                        : 'bg-slate-500/20'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    session.status === 'completed'
                      ? 'bg-emerald-400'
                      : session.status === 'in_progress'
                        ? 'bg-purple-400'
                        : session.status === 'submitted'
                          ? 'bg-amber-400'
                          : 'bg-slate-400'
                  }`}
                />
                <span
                  className={`text-xs font-medium ${
                    session.status === 'completed'
                      ? 'text-emerald-300'
                      : session.status === 'in_progress'
                        ? 'text-purple-300'
                        : session.status === 'submitted'
                          ? 'text-amber-300'
                          : 'text-slate-300'
                  }`}
                >
                  {session.status === 'completed'
                    ? isPolish
                      ? 'Zakończony'
                      : 'Completed'
                    : session.status === 'in_progress'
                      ? isPolish
                        ? 'W trakcie'
                        : 'In Progress'
                      : session.status === 'submitted'
                        ? isPolish
                          ? 'Wysłany'
                          : 'Submitted'
                        : session.status}
                </span>
              </div>
              <span className="text-xs text-slate-500">
                {new Date(session.startedAt).toLocaleDateString()}
              </span>
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
      await Api.post(`/interview/insights/${insightId}/export`, { target: 'tools' });
      toast.success(isPolish ? 'Wyeksportowano do narzędzi' : 'Exported to tools');
      // Refresh insights
      const insightsRes = await Api.get('/interview/insights').catch(() => []);
      setInsights(Array.isArray(insightsRes) ? insightsRes : []);
    } catch (error) {
      toast.error(isPolish ? 'Nie udało się wyeksportować' : 'Failed to export');
      console.error('[InterviewHub] Failed to export insight:', error);
    }
  };

  const handleExportInsightToAssessment = async (insightId: string) => {
    try {
      await Api.post(`/interview/insights/${insightId}/export`, { target: 'assessment' });
      toast.success(isPolish ? 'Wyeksportowano do Assessment' : 'Exported to Assessment');
      const insightsRes = await Api.get('/interview/insights').catch(() => []);
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
      await Api.delete(`/interview/insights/${insightId}`);
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
    const typeCol: ColumnDef = {
      id: 'type',
      label: isPolish ? 'Typ' : 'Type',
      width: insightColumnWidths.type ?? 120,
      minWidth: 80,
      maxWidth: 180,
      resizable: true,
      filterable: true,
      filterType: 'multiselect',
      filterOptions: INSIGHT_TYPE_FILTER_OPTIONS,
    };
    const statusCol: ColumnDef = {
      id: 'status',
      label: isPolish ? 'Status' : 'Status',
      width: insightColumnWidths.status ?? 100,
      minWidth: 80,
      maxWidth: 150,
      resizable: true,
      filterable: true,
      filterType: 'multiselect',
      filterOptions: INSIGHT_STATUS_FILTER_OPTIONS,
    };

    return (
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <table className="w-full" style={{ minWidth: 800 }}>
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-900/50">
              <th
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: insightColumnWidths.title ?? 200, minWidth: 150 }}
              >
                {isPolish ? 'Tytuł' : 'Title'}
              </th>
              <th
                className="relative px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: typeCol.width, minWidth: typeCol.minWidth }}
              >
                <div className="flex items-center gap-1">
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
                    onChange={(v) => setInsightTableFilters((f) => ({ ...f, type: v as string[] }))}
                    isOpen={openInsightFilterId === 'type'}
                    onToggle={() => setOpenInsightFilterId((id) => (id === 'type' ? null : 'type'))}
                    onClose={() => setOpenInsightFilterId(null)}
                  />
                </div>
                {typeCol.resizable && (
                  <ColumnResizer
                    columnId="type"
                    currentWidth={insightColumnWidths.type ?? 120}
                    minWidth={typeCol.minWidth}
                    maxWidth={typeCol.maxWidth}
                    onResize={(id, w) => setInsightColumnWidths((c) => ({ ...c, [id]: w }))}
                  />
                )}
              </th>
              <th
                className="relative px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: statusCol.width, minWidth: statusCol.minWidth }}
              >
                <div className="flex items-center gap-1">
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
                {statusCol.resizable && (
                  <ColumnResizer
                    columnId="status"
                    currentWidth={insightColumnWidths.status ?? 100}
                    minWidth={statusCol.minWidth}
                    maxWidth={statusCol.maxWidth}
                    onResize={(id, w) => setInsightColumnWidths((c) => ({ ...c, [id]: w }))}
                  />
                )}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: insightColumnWidths.source ?? 100, minWidth: 80 }}
              >
                {isPolish ? 'Źródło' : 'Source'}
              </th>
              <th
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: insightColumnWidths.date ?? 110, minWidth: 90 }}
              >
                {isPolish ? 'Data' : 'Date'}
              </th>
              <th
                className="px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider"
                style={{ width: insightColumnWidths.actions ?? 80, minWidth: 60 }}
              >
                {isPolish ? 'Akcje' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((insight) => {
              const promptType =
                (insight as any).promptType || (insight as any).insightType || 'summary';
              const typeConfig = getInsightTypeConfig(promptType);
              const status = (insight.status || 'completed') as
                | 'generating'
                | 'completed'
                | 'failed';
              const statusConfig: Record<
                typeof status,
                { label: { en: string; pl: string }; bg: string; text: string }
              > = {
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
                failed: {
                  label: { en: 'Failed', pl: 'Błąd' },
                  bg: 'bg-red-500/20',
                  text: 'text-red-400',
                },
              };
              const sc = statusConfig[status] || statusConfig.completed;

              const isSelected = opts?.selectedId === insight.id;
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
                    isSelected
                      ? 'bg-primary-50 dark:bg-primary-500/10'
                      : 'hover:bg-slate-50 dark:hover:bg-navy-800/50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${typeConfig.bgColor}`}
                      >
                        <Lightbulb size={16} className={typeConfig.textColor} />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm text-slate-900 dark:text-white font-medium block truncate">
                          {insight.title}
                        </span>
                        {insight.createdBy && (
                          <span className="text-xs text-slate-500 truncate block">
                            {isPolish ? 'Autor:' : 'Author:'} {insight.createdBy}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${typeConfig.bgColor} ${typeConfig.textColor}`}
                    >
                      {isPolish ? typeConfig.label.pl : typeConfig.label.en}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                    >
                      {isPolish ? sc.label.pl : sc.label.en}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {insight.sourceSessionCount
                        ? `${insight.sourceSessionCount} ${isPolish ? 'sesji' : 'sessions'}`
                        : '-'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 dark:text-slate-400">
                    {insight.createdAt ? new Date(insight.createdAt).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      <RowActionsMenu
                        iconVariant="vertical"
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
                <td colSpan={6} className="px-4 py-12 text-center">
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
                        setSelectedSessionsForInsight([]);
                        setShowInsightModal(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
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

  // Render templates table
  const renderTemplatesTable = () => (
    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
      <table className="w-full table-fixed">
        <thead>
          <tr className="border-b border-slate-200 dark:border-navy-700">
            <th className="w-[35%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Nazwa' : 'Name'}
            </th>
            <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Kategoria' : 'Category'}
            </th>
            <th className="w-[10%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Pytania' : 'Questions'}
            </th>
            <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Status' : 'Status'}
            </th>
            <th className="w-[25%] px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Akcje' : 'Actions'}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredTemplates.map((template) => (
            <tr
              key={template.id}
              onClick={() => handleViewTemplate(template)}
              className="group hover:bg-slate-50 dark:hover:bg-navy-800/50 cursor-pointer transition-colors border-b border-slate-200/50 dark:border-navy-700/50 last:border-0"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/20">
                    <FileText size={16} className="text-blue-400" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-sm text-slate-900 dark:text-white font-medium block truncate">
                      {template.name}
                    </span>
                    <span className="text-xs text-slate-500 truncate block">
                      {template.description}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-xs rounded-full">
                  {template.category}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                {template.questionCount}
              </td>
              <td className="px-4 py-3">
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
              <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
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
                                type: 'session',
                                name: newSession.name || 'Interview Session',
                                status: (newSession as any)?.status || 'in_progress',
                                data: newSession,
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
          ))}
          {filteredTemplates.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center">
                  <FileText className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                    {isPolish ? 'Brak szablonów' : 'No templates yet'}
                  </p>
                  {canAssign && (
                    <button
                      onClick={handleNewTemplate}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <FilePlus size={16} />
                      {isPolish ? 'Utwórz szablon' : 'Create Template'}
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

  // Render document content (full view)
  const renderDocumentContent = () => {
    const doc = openDocuments.find((d) => d.id === activeDocumentId);
    if (!doc) return null;

    if (doc.type === 'session') {
      const session = doc.data as InterviewSession;
      return (
        <InterviewWorkspace
          sessionId={session.id}
          projectId={currentProjectId || undefined}
          onComplete={handleSessionComplete}
          onSessionChange={handleSessionChange}
        />
      );
    }

    if (doc.type === 'insight') {
      const insight = doc.data as InterviewInsight;
      return (
        <InsightViewer
          insightId={insight.id}
          onClose={() => handleCloseDocument(insight.id)}
          onRegenerate={async () => {
            const insightsRes = await Api.get('/interview/insights').catch(() => []);
            setInsights(Array.isArray(insightsRes) ? insightsRes : []);
          }}
          onSaved={(data) => {
            // Update local insight data
            setInsights((prev) => prev.map((i) => (i.id === data.id ? { ...i, ...data } : i)));
          }}
        />
      );
    }

    if (doc.type === 'template') {
      const template = doc.data as InterviewTemplate;
      const templateQuestions = templateQuestionsById[template.id] || [];
      const isTemplateQuestionsLoading = !!templateQuestionsLoading[template.id];
      const categoryOrder = ['strategy', 'operations', 'digital', 'people', 'finance'] as const;
      const categoryLabels = isPolish
        ? {
            strategy: 'Strategia',
            operations: 'Operacje',
            digital: 'Digital',
            people: 'Ludzie',
            finance: 'Finanse',
          }
        : {
            strategy: 'Strategy',
            operations: 'Operations',
            digital: 'Digital',
            people: 'People',
            finance: 'Finance',
          };

      return (
        <div className="p-6 max-w-4xl mx-auto">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FileText size={24} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                  {template.name}
                </h1>
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-3">
                  {template.description}
                </p>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-slate-200 dark:bg-navy-700 text-slate-700 dark:text-slate-300 text-xs rounded-full">
                    {template.questionCount} {isPolish ? 'pytań' : 'questions'}
                  </span>
                  <span className="text-xs text-slate-500">{template.category}</span>
                  {template.isDefault && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                      {isPolish ? 'Domyślny' : 'Default'}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="border-t border-slate-200 dark:border-navy-700 pt-6 space-y-4">
              {/* Questions Preview (read-only) */}
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                  {isPolish ? 'Podgląd pytań' : 'Questions preview'}
                </h2>
                {isTemplateQuestionsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {isPolish ? 'Ładowanie pytań...' : 'Loading questions...'}
                  </div>
                ) : templateQuestions.length > 0 ? (
                  <div className="space-y-4">
                    {categoryOrder.map((cat) => {
                      const items = templateQuestions.filter((q: any) => q.category === cat);
                      if (items.length === 0) return null;
                      return (
                        <div
                          key={cat}
                          className="bg-slate-100/40 dark:bg-navy-950/40 border border-slate-200 dark:border-navy-700 rounded-lg p-4"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-semibold text-slate-200">
                              {(categoryLabels as any)[cat]}
                            </span>
                            <span className="text-xs text-slate-500">{items.length}</span>
                          </div>
                          <ul className="space-y-2">
                            {items.map((q: any) => (
                              <li key={q.id} className="text-sm text-slate-300">
                                {q.questionText}
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    {isPolish ? 'Brak pytań w szablonie' : 'No questions in template'}
                  </p>
                )}
              </div>

              <button
                onClick={async () => {
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
                    toast.loading(
                      isPolish
                        ? 'Tworzenie sesji z szablonu...'
                        : 'Creating session from template...'
                    );
                    const created = await Api.post(`/interview/templates/${template.id}/use`, {
                      projectId,
                      name: `${template.name} ${new Date().toLocaleDateString()}`,
                    });

                    const newSession = created as InterviewSession;
                    setSessions((prev) => [newSession, ...prev]);

                    handleOpenDocument({
                      id: newSession.id,
                      type: 'session',
                      name: newSession.name || 'Interview Session',
                      status: (newSession as any)?.status || 'in_progress',
                      data: newSession,
                    });

                    toast.dismiss();
                    toast.success(isPolish ? 'Sesja utworzona' : 'Session created');
                  } catch (error) {
                    console.error('[InterviewHub] Failed to create session from template:', error);
                    toast.dismiss();
                    toast.error(
                      isPolish ? 'Nie udało się utworzyć sesji' : 'Failed to create session'
                    );
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                {isPolish ? 'Użyj szablonu' : 'Use Template'}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  // Sorting state for assignments
  const [assignmentSortField, setAssignmentSortField] = useState<
    'dueAt' | 'status' | 'progress' | null
  >('dueAt');
  const [assignmentSortAsc, setAssignmentSortAsc] = useState(true);

  const toggleAssignmentSort = (field: 'dueAt' | 'status' | 'progress') => {
    if (assignmentSortField === field) {
      setAssignmentSortAsc(!assignmentSortAsc);
    } else {
      setAssignmentSortField(field);
      setAssignmentSortAsc(true);
    }
  };

  // Render assignments table (reusable for my/managed/overdue)
  const renderAssignmentsTable = (
    assignments: InterviewAssignment[],
    showAssignee: boolean = false
  ) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'assigned':
          return 'bg-blue-500/20 text-blue-400';
        case 'drafting':
          return 'bg-slate-500/20 text-slate-400';
        case 'in_progress':
          return 'bg-purple-500/20 text-purple-400';
        case 'review':
          return 'bg-amber-500/20 text-amber-400';
        case 'submitted':
          return 'bg-amber-500/20 text-amber-400';
        case 'sent_back':
          return 'bg-red-500/20 text-red-400';
        case 'rejected':
          return 'bg-red-500/20 text-red-400';
        case 'accepted':
          return 'bg-emerald-500/20 text-emerald-400';
        case 'approved':
          return 'bg-emerald-500/20 text-emerald-400';
        case 'completed':
          return 'bg-emerald-500/20 text-emerald-400';
        default:
          return 'bg-slate-500/20 text-slate-400';
      }
    };

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
        const result = (await Api.post(`/interview/assignments/${assignment.id}/start`, {
          projectId,
        })) as any;
        toast.dismiss();

        // Open the session - backend returns { assignmentId, session }
        const session = result?.session;
        if (session?.id) {
          toast.success(isPolish ? 'Wywiad rozpoczęty!' : 'Interview started!');
          handleOpenDocument({
            id: session.id,
            type: 'session',
            name: session.name || 'Interview Session',
            status: (session.status || 'in_progress') as any,
            data: session as InterviewSession,
          });
        } else {
          console.warn('[InterviewHub] No session in result:', result);
          toast.error(
            isPolish ? 'Brak sesji w odpowiedzi serwera' : 'No session in server response'
          );
        }

        // Refresh all assignments
        const [myRes, managedRes] = await Promise.all([
          Api.get('/interview/assignments/my').catch(() => []),
          canViewManaged
            ? Api.get('/interview/assignments/managed').catch(() => [])
            : Promise.resolve([]),
        ]);
        setMyAssignments(Array.isArray(myRes) ? myRes : []);
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
        await Api.post(`/interview/assignments/${assignment.id}/remind`, {});
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
          const session = await Api.get(`/interview/sessions/${sid}`);
          handleOpenDocument({
            id: (session as InterviewSession).id,
            type: 'session',
            name: (session as InterviewSession).name || 'Interview Session',
            status: ((session as any)?.status || 'in_progress') as any,
            data: session as InterviewSession,
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
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
        <table className="w-full table-fixed">
          <thead>
            <tr className="border-b border-slate-200 dark:border-navy-700">
              <th
                className={`${showAssignee ? 'w-[25%]' : 'w-[30%]'} px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider`}
              >
                {isPolish ? 'Szablon' : 'Template'}
              </th>
              {showAssignee && (
                <th className="w-[15%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {isPolish ? 'Przydzielony do' : 'Assignee'}
                </th>
              )}
              <th
                className="w-[13%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-300 transition-colors"
                onClick={() => toggleAssignmentSort('status')}
              >
                {isPolish ? 'Status' : 'Status'}
                {assignmentSortField === 'status' && (
                  <ChevronDown
                    size={12}
                    className={`inline-block ml-0.5 transition-transform ${assignmentSortAsc ? '' : 'rotate-180'}`}
                  />
                )}
              </th>
              <th
                className="w-[15%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-300 transition-colors"
                onClick={() => toggleAssignmentSort('progress')}
              >
                {isPolish ? 'Postęp' : 'Progress'}
                {assignmentSortField === 'progress' && (
                  <ChevronDown
                    size={12}
                    className={`inline-block ml-0.5 transition-transform ${assignmentSortAsc ? '' : 'rotate-180'}`}
                  />
                )}
              </th>
              <th
                className="w-[13%] px-4 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider cursor-pointer select-none hover:text-slate-300 transition-colors"
                onClick={() => toggleAssignmentSort('dueAt')}
              >
                {isPolish ? 'Do terminu' : 'Days to Due'}
                {assignmentSortField === 'dueAt' && (
                  <ChevronDown
                    size={12}
                    className={`inline-block ml-0.5 transition-transform ${assignmentSortAsc ? '' : 'rotate-180'}`}
                  />
                )}
              </th>
              <th className="w-[19%] px-4 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isPolish ? 'Akcje' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAssignments.map((assignment) => {
              const progress = assignment.session?.completenessPercent || 0;
              const overdue = isOverdue(assignment.dueAt) && assignment.status !== 'completed';

              return (
                <tr
                  key={assignment.id}
                  onClick={(e) => {
                    // Only handle click if not clicking on a button or interactive element
                    const target = e.target as HTMLElement;
                    if (target.tagName === 'BUTTON' || target.closest('button')) {
                      return; // Let button handle its own click
                    }
                    handleOpenAssignmentRow(assignment);
                  }}
                  className="group hover:bg-slate-50 dark:hover:bg-navy-800/50 active:bg-slate-100 dark:active:bg-navy-700/50 transition-colors border-b border-slate-200/50 dark:border-navy-700/50 last:border-0 cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenAssignmentRow(assignment);
                    }
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-blue-500/20`}
                      >
                        <ClipboardList size={16} className="text-blue-400" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-sm text-slate-900 dark:text-white font-medium block truncate">
                          {assignment.template?.name || 'Interview'}
                        </span>
                        {assignment.template?.category && (
                          <span className="text-xs text-slate-500 truncate block">
                            {assignment.template.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {showAssignee && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-navy-700 flex items-center justify-center text-xs text-slate-700 dark:text-slate-300">
                          {assignment.assignee?.name?.charAt(0) || '?'}
                        </div>
                        <span className="text-sm text-slate-300">
                          {assignment.assignee?.name || assignment.assignee?.email || 'Unknown'}
                        </span>
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(assignment.status)}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {getStatusLabel(assignment.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
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
                  <td className="px-4 py-3">
                    {(() => {
                      const dtd = getDaysToDue(assignment.dueAt);
                      if (!dtd) return <span className="text-xs text-slate-500">—</span>;

                      return (
                        <div className="flex items-center gap-1.5">
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
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end">
                      <RowActionsMenu
                        iconVariant="vertical"
                        actions={[
                          ...(!showAssignee && assignment.status === 'assigned'
                            ? [
                                {
                                  id: 'start',
                                  label: isPolish ? 'Rozpocznij' : 'Start',
                                  icon: Sparkles,
                                  onClick: () => handleStartAssignment(assignment),
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
                                      type: 'session',
                                      name:
                                        (session as InterviewSession).name || 'Interview Session',
                                      status: ((session as any)?.status || 'in_progress') as any,
                                      data: session as InterviewSession,
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
                                      type: 'session',
                                      name:
                                        (session as InterviewSession).name || 'Interview Session',
                                      status: ((session as any)?.status || 'in_progress') as any,
                                      data: session as InterviewSession,
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
                          {
                            id: 'open',
                            label: isPolish ? 'Otwórz' : 'Open',
                            icon: ChevronRight,
                            onClick: () => handleOpenAssignmentRow(assignment),
                            divider:
                              (showAssignee && canAssign && assignment.status === 'submitted') ||
                              (!showAssignee &&
                                (assignment.status === 'assigned' ||
                                  assignment.status === 'in_progress' ||
                                  assignment.status === 'sent_back')),
                          },
                        ]}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={showAssignee ? 6 : 5} className="px-4 py-12 text-center">
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

    if (activeTab === 'sessions') {
      return (
        <div className="p-4">
          {viewMode === 'table' ? renderSessionsTable() : renderSessionsGrid()}
        </div>
      );
    }

    if (activeTab === 'insights') {
      // Group insights by report or person (use insightsForTable to respect header filters)
      const groupedInsights =
        insightGroupBy === 'person'
          ? (() => {
              const byPerson: Record<string, typeof insightsForTable> = {};
              insightsForTable.forEach((insight) => {
                const person = insight.createdBy || (isPolish ? 'Nieznany' : 'Unknown');
                if (!byPerson[person]) byPerson[person] = [];
                byPerson[person].push(insight);
              });
              return byPerson;
            })()
          : (() => {
              const byReport: Record<string, typeof insightsForTable> = {};
              insightsForTable.forEach((insight) => {
                const source = insight.sessionId
                  ? `Session ${insight.sessionId.slice(0, 8)}`
                  : insight.sourceSessionCount
                    ? `${insight.sourceSessionCount} ${isPolish ? 'sesji' : 'sessions'}`
                    : isPolish
                      ? 'Ogólne'
                      : 'General';
                if (!byReport[source]) byReport[source] = [];
                byReport[source].push(insight);
              });
              return byReport;
            })();

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
          kicker={isPolish ? 'Wnioski' : 'Insight'}
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
            return (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                  <span className="text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Typ' : 'Type'}
                  </span>
                  <span className="text-slate-900 dark:text-white">
                    {getInsightTypeLabel(type)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Źródło' : 'Source'}
                  </span>
                  <span className="text-slate-900 dark:text-white">{sourceLabel}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Data' : 'Date'}
                  </span>
                  <span className="text-slate-900 dark:text-white">{dateStr}</span>
                  {item.confidence && (
                    <>
                      <span className="text-slate-500 dark:text-slate-400">
                        {isPolish ? 'Pewność' : 'Confidence'}
                      </span>
                      <span className="text-slate-900 dark:text-white">{item.confidence}</span>
                    </>
                  )}
                </div>
                {item.content && (
                  <p className="text-slate-600 dark:text-slate-400 line-clamp-4 pt-2 border-t border-slate-200 dark:border-navy-700">
                    {item.content.slice(0, 200)}
                    {item.content.length > 200 ? '…' : ''}
                  </p>
                )}
              </div>
            );
          }}
          renderPreviewFooter={(item) => (
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleViewInsight(item)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-primary-500/15 text-primary-600 dark:text-primary-400 hover:bg-primary-500/25 transition-colors"
              >
                <ChevronRight size={14} />
                {isPolish ? 'Otwórz pełny' : 'Open full'}
              </button>
              <button
                onClick={() =>
                  toast.success(isPolish ? 'Oznaczono jako przejrzany' : 'Marked as reviewed')
                }
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-navy-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors"
              >
                <Check size={14} />
                {isPolish ? 'Oznacz jako przejrzany' : 'Mark reviewed'}
              </button>
            </div>
          )}
          itemIds={insightsForTable.map((i) => i.id)}
        >
          <div className="p-4">
            {renderInsightsTable(insightsForTable, {
              onRowClick: setSelectedInsightId,
              onRowDoubleClick: (id) => {
                const insight = filteredInsights.find((i) => i.id === id);
                if (insight) handleViewInsight(insight);
              },
              selectedId: selectedInsightId,
            })}
          </div>
        </TableWithPreviewLayout>
      );

      return (
        <div className="p-4 space-y-4 h-full flex flex-col">
          {/* Render based on view style */}
          {insightViewStyle === 'd' ? (
            // Standard table view with preview pane (single group) or grouped
            Object.keys(groupedInsights).length > 1 ? (
              <div className="space-y-4 flex-1 overflow-auto">
                {Object.entries(groupedInsights).map(([groupName, groupInsights]) => (
                  <div key={groupName}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      {insightGroupBy === 'person' ? (
                        <Users size={14} className="text-slate-500 dark:text-slate-400" />
                      ) : (
                        <FileText size={14} className="text-slate-400" />
                      )}
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {groupName}
                      </span>
                      <span className="text-xs text-slate-500">({groupInsights.length})</span>
                    </div>
                    {renderInsightsTable(groupInsights)}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">{insightsTableWithPreview}</div>
            )
          ) : insightViewStyle === 'n' ? (
            // Notion-like: card layout with more whitespace
            <div className="space-y-3">
              {Object.entries(groupedInsights).map(([groupName, groupInsights]) => (
                <div key={groupName}>
                  {Object.keys(groupedInsights).length > 1 && (
                    <div className="flex items-center gap-2 mb-2 px-1">
                      {insightGroupBy === 'person' ? (
                        <Users size={14} className="text-slate-500 dark:text-slate-400" />
                      ) : (
                        <FileText size={14} className="text-slate-400" />
                      )}
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {groupName}
                      </span>
                      <span className="text-xs text-slate-500">({groupInsights.length})</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    {groupInsights.map((insight) => {
                      const promptType =
                        (insight as any).promptType || (insight as any).insightType || 'summary';
                      const typeConfig = getInsightTypeConfig(promptType);
                      return (
                        <div
                          key={insight.id}
                          onClick={() => handleViewInsight(insight)}
                          className="group bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4 hover:bg-slate-50 dark:hover:bg-navy-800/50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div
                              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${typeConfig.bgColor}`}
                            >
                              <Lightbulb size={18} className={typeConfig.textColor} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {insight.title}
                              </h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ${typeConfig.bgColor} ${typeConfig.textColor}`}
                                >
                                  {isPolish ? typeConfig.label.pl : typeConfig.label.en}
                                </span>
                                {insight.createdBy && (
                                  <span className="text-xs text-slate-500">
                                    {insight.createdBy}
                                  </span>
                                )}
                                {insight.createdAt && (
                                  <span className="text-xs text-slate-500">
                                    {new Date(insight.createdAt).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                              {insight.content && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">
                                  {insight.content.slice(0, 200)}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {insightsForTable.length === 0 && (
                <div className="flex flex-col items-center py-12 text-center">
                  <Lightbulb className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {isPolish ? 'Brak wniosków' : 'No insights yet'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            // ClickUp/Dense: compact rows with max info
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
              {Object.entries(groupedInsights).map(([groupName, groupInsights]) => (
                <div key={groupName}>
                  {Object.keys(groupedInsights).length > 1 && (
                    <div className="flex items-center gap-2 px-4 py-2 bg-slate-100/50 dark:bg-navy-800/50 border-b border-slate-200 dark:border-navy-700">
                      {insightGroupBy === 'person' ? (
                        <Users size={12} className="text-slate-500 dark:text-slate-400" />
                      ) : (
                        <FileText size={12} className="text-slate-500 dark:text-slate-400" />
                      )}
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                        {groupName}
                      </span>
                      <span className="text-xs text-slate-500">({groupInsights.length})</span>
                    </div>
                  )}
                  {groupInsights.map((insight) => {
                    const promptType =
                      (insight as any).promptType || (insight as any).insightType || 'summary';
                    const typeConfig = getInsightTypeConfig(promptType);
                    const status = (insight.status || 'completed') as
                      | 'generating'
                      | 'completed'
                      | 'failed';
                    return (
                      <div
                        key={insight.id}
                        onClick={() => handleViewInsight(insight)}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-slate-50 dark:hover:bg-navy-800/50 cursor-pointer transition-colors border-b border-slate-200/50 dark:border-navy-700/50 last:border-0"
                      >
                        <Lightbulb size={14} className={typeConfig.textColor} />
                        <span className="text-sm text-slate-900 dark:text-white font-medium truncate flex-1 min-w-0">
                          {insight.title}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${typeConfig.bgColor} ${typeConfig.textColor} whitespace-nowrap`}
                        >
                          {isPolish ? typeConfig.label.pl : typeConfig.label.en}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium whitespace-nowrap ${
                            status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : status === 'generating'
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {status === 'completed'
                            ? isPolish
                              ? 'Gotowe'
                              : 'Done'
                            : status === 'generating'
                              ? 'AI...'
                              : isPolish
                                ? 'Błąd'
                                : 'Err'}
                        </span>
                        <span className="text-[10px] text-slate-500 whitespace-nowrap">
                          {insight.createdAt
                            ? new Date(insight.createdAt).toLocaleDateString()
                            : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
              {insightsForTable.length === 0 && (
                <div className="flex flex-col items-center py-12 text-center">
                  <Lightbulb className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    {isPolish ? 'Brak wniosków' : 'No insights yet'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      );
    }

    if (activeTab === 'templates') {
      return <div className="p-4">{renderTemplatesTable()}</div>;
    }

    if (activeTab === 'my-assignments') {
      return <div className="p-4">{renderAssignmentsTable(myAssignments, false)}</div>;
    }

    if (activeTab === 'managed') {
      return (
        <div className="p-4">
          {/* Command Row: context counters (per module-hub-standard) */}
          {overdueAssignments.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() =>
                  setAssignmentStatusFilter((prev) => (prev === 'overdue' ? 'all' : 'overdue'))
                }
                className={`
                  inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium
                  transition-colors
                  ${assignmentStatusFilter === 'overdue' ? 'bg-red-500/20 text-red-400' : 'bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700'}
                `}
              >
                <AlertTriangle size={12} />
                {overdueAssignments.length} {isPolish ? 'zaległych' : 'overdue'}
              </button>
            </div>
          )}
          {renderAssignmentsTable(filteredManagedAssignments, true)}
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

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-navy-950 text-slate-900 dark:text-white">
      {/* Navigation Bar (Golden Standard) */}
      <div className="bg-white dark:bg-navy-900 border-b border-slate-200 dark:border-navy-700">
        {/* Main Navigation Row */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Search + Tabs + Status Filters */}
          <div className="flex items-center gap-3">
            {/* Search Toggle — h-9 per App Table Standard */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`h-9 w-9 inline-flex items-center justify-center rounded-lg border transition-all duration-200 ${
                showSearch
                  ? 'bg-primary-500/15 border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'bg-slate-100 dark:bg-navy-800 border-slate-300 dark:border-navy-600 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-slate-500'
              }`}
              title="Search"
            >
              <Search size={18} />
            </button>

            {/* Main Tabs */}
            <div className="flex items-center gap-2">
              {tabs.map((tab: any) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      setActiveDocumentId(null); // Go back to list when changing tabs
                    }}
                    className={isActive ? BUTTON_ACTIVE : BUTTON_INACTIVE}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.count !== undefined && tab.count > 0 && (
                      <span
                        className={`px-1.5 py-0.5 text-xs rounded-full ${
                          tab.hasWarning
                            ? 'bg-red-500/30 text-red-300'
                            : isActive
                              ? 'bg-primary-500/30 text-primary-300'
                              : 'bg-slate-200 dark:bg-navy-700 text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                    {tab.hasWarning && overdueAssignments.length > 0 && (
                      <AlertTriangle size={14} className="text-red-400" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: AI context → +New → view-modes → filters (App Table Standard) */}
          <div className="flex items-center gap-2">
            {/* 1. AI context (icon-only, first) */}
            <button
              className="h-9 w-9 flex items-center justify-center rounded-lg text-primary-500 hover:bg-primary-500/10 transition-colors"
              title={isPolish ? 'Kontekst AI' : 'AI Context'}
            >
              <Sparkles size={18} />
            </button>

            {/* 2. Primary CTA (+New / + Assignment) */}
            {canAssign && (
              <button
                onClick={() => {
                  setSelectedTemplateForAssign(null);
                  setShowAssignModal(true);
                }}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400/30 hover:from-blue-400 hover:to-blue-500 shadow-lg shadow-blue-500/25 transition-all duration-200"
                title={isPolish ? 'Wyślij prośbę (assignment)' : 'Send assignment request'}
              >
                <Plus size={16} />
                <span>{isPolish ? '+ Przydziel' : '+ Assignment'}</span>
              </button>
            )}

            {/* 3. View modes — Sessions: table/grid; Insights: CardViewSwitcher (below) */}
            {activeTab === 'sessions' && !activeDocumentId && (
              <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-950/70 p-1 h-9">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'table'
                      ? 'bg-white/70 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
                  }`}
                  title="Table"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-white/70 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100'
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100/70 dark:hover:bg-white/[0.05]'
                  }`}
                  title="Grid"
                >
                  <Grid3X3 size={16} />
                </button>
              </div>
            )}

            {/* 4. Filters (tab-specific) */}
            {/* Sessions tab: filter */}
            {activeTab === 'sessions' && !activeDocumentId && (
              <>
                <div className="relative">
                  <select
                    value={sessionStatusFilter}
                    onChange={(e) => setSessionStatusFilter(e.target.value)}
                    className="appearance-none pr-9 pl-3 h-9 rounded-lg text-sm font-medium border bg-slate-100 dark:bg-navy-800 border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all duration-200"
                    title={isPolish ? 'Filtr statusu' : 'Status filter'}
                  >
                    {sessionStatusOptions.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.display}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                  />
                </div>
              </>
            )}

            {/* Assigned tab (PM/Admin): status filter */}
            {activeTab === 'managed' && !activeDocumentId && (
              <div className="relative">
                <select
                  value={assignmentStatusFilter}
                  onChange={(e) => setAssignmentStatusFilter(e.target.value)}
                  className="appearance-none pr-9 pl-3 h-9 rounded-lg text-sm font-medium border bg-slate-100 dark:bg-navy-800 border-slate-300 dark:border-navy-600 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-navy-700 hover:border-slate-400 dark:hover:border-slate-500 transition-all duration-200"
                  title={isPolish ? 'Filtr statusu assignmentów' : 'Assignment status filter'}
                >
                  {managedAssignmentStatusOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.display}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
                />
              </div>
            )}

            {/* Templates tab: + Nowy szablon (PM/Admin) */}
            {activeTab === 'templates' && !activeDocumentId && canAssign && (
              <>
                <button
                  onClick={handleNewTemplate}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-400/30 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/25 transition-all duration-200"
                >
                  <Plus size={16} />
                  <span>{isPolish ? 'Nowy szablon' : 'New Template'}</span>
                </button>
              </>
            )}

            {/* Assigned tab (PM/Admin): Analityka — h-9 */}
            {activeTab === 'managed' && !activeDocumentId && canAssign && (
              <button
                onClick={() => setShowAnalytics(true)}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
                title={isPolish ? 'Analityka' : 'Analytics'}
              >
                <BarChart3 size={16} />
              </button>
            )}

            {/* Insights tab: view modes (group by) + CardViewSwitcher + + New Insight — all h-9 */}
            {activeTab === 'insights' && !activeDocumentId && (
              <>
                <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 p-0.5 h-9">
                  <button
                    onClick={() => setInsightGroupBy('report')}
                    className={`flex items-center gap-1.5 px-2.5 h-full rounded-md text-xs font-medium transition-all ${
                      insightGroupBy === 'report'
                        ? 'bg-slate-100 dark:bg-navy-800 text-primary-400 shadow-sm border border-slate-300 dark:border-navy-600'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                    title={isPolish ? 'Grupuj: wg raportu' : 'Group: by report'}
                  >
                    <FileText size={14} />
                    {isPolish ? 'Wg raportu' : 'By Report'}
                  </button>
                  <button
                    onClick={() => setInsightGroupBy('person')}
                    className={`flex items-center gap-1.5 px-2.5 h-full rounded-md text-xs font-medium transition-all ${
                      insightGroupBy === 'person'
                        ? 'bg-slate-100 dark:bg-navy-800 text-primary-400 shadow-sm border border-slate-300 dark:border-navy-600'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                    title={isPolish ? 'Grupuj: wg osoby' : 'Group: by person'}
                  >
                    <Users size={14} />
                    {isPolish ? 'Wg osoby' : 'By Person'}
                  </button>
                </div>
                <CardViewSwitcher
                  moduleId="interview-insights"
                  value={insightViewStyle}
                  onChange={setInsightViewStyle}
                  compact
                />
                <button
                  onClick={() => {
                    setSelectedSessionsForInsight([]);
                    setShowInsightModal(true);
                  }}
                  className="flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-400/30 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/25 transition-all duration-200"
                >
                  <Plus size={16} />
                  <span>{isPolish ? 'Nowy Insight' : 'New Insight'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search Bar (expandable) */}
        {showSearch && (
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
                  activeTab === 'sessions'
                    ? isPolish
                      ? 'Szukaj sesji...'
                      : 'Search sessions...'
                    : activeTab === 'insights'
                      ? isPolish
                        ? 'Szukaj wniosków...'
                        : 'Search insights...'
                      : isPolish
                        ? 'Szukaj szablonów...'
                        : 'Search templates...'
                }
                autoFocus
                className="w-full pl-10 pr-10 py-2 rounded-lg bg-white dark:bg-navy-800 border border-slate-300 dark:border-navy-600 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
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

      {/* Dynamic Tabs (open documents) */}
      {renderDynamicTabs()}

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">{renderContent()}</div>

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
              Api.get('/interview/assignments/my').catch(() => []),
              canViewManaged
                ? Api.get('/interview/assignments/managed').catch(() => [])
                : Promise.resolve([]),
              canViewOverdue
                ? Api.get('/interview/assignments/overdue').catch(() => [])
                : Promise.resolve([]),
            ]);
            setMyAssignments(Array.isArray(myRes) ? myRes : []);
            setManagedAssignments(Array.isArray(managedRes) ? managedRes : []);
            setOverdueAssignments(Array.isArray(overdueRes) ? overdueRes : []);
            setSelectedTemplateForAssign(null);
          } catch (error) {
            console.error('[InterviewHub] Failed to refresh assignments:', error);
          }
        }}
        preselectedTemplateId={selectedTemplateForAssign?.id}
      />

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-navy-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {isPolish ? 'Eksportuj dane' : 'Export Data'}
              </h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                {isPolish ? 'Wybierz format eksportu:' : 'Choose export format:'}
              </p>
              <button
                onClick={() => handleExport('pdf')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 hover:border-red-500/50 hover:bg-red-500/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <FileText size={20} className="text-red-400" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium text-slate-900 dark:text-white block">
                    PDF
                  </span>
                  <span className="text-xs text-slate-500">
                    {isPolish ? 'Raport profesjonalny' : 'Professional report'}
                  </span>
                </div>
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-300 dark:border-navy-600 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <FileText size={20} className="text-emerald-400" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium text-slate-900 dark:text-white block">
                    Excel
                  </span>
                  <span className="text-xs text-slate-500">
                    {isPolish ? 'Dane do analizy' : 'Data for analysis'}
                  </span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

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
                      await Api.post(`/interview/assignments/${selectedAssignment.id}/remind`, {});
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
                    {sessions.filter((s) => s.status === 'completed').length}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {isPolish ? 'Zakończone' : 'Completed'}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                  <div className="text-2xl font-bold text-purple-400">
                    {sessions.filter((s) => s.status === 'active').length}
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

      {/* Template Builder */}
      <TemplateBuilder
        isOpen={showTemplateBuilder}
        onClose={() => {
          setShowTemplateBuilder(false);
          setEditingTemplateId(null);
        }}
        templateId={editingTemplateId}
        onSuccess={async () => {
          // Refresh templates after save
          const templatesRes = await Api.get('/interview/templates').catch(() => []);
          setTemplates(Array.isArray(templatesRes) ? templatesRes : []);
        }}
      />

      {/* Generate Insight Modal - Advanced Creator */}
      <InsightCreatorModal
        isOpen={showInsightModal}
        onClose={() => {
          setShowInsightModal(false);
          setSelectedSessionsForInsight([]);
        }}
        onSuccess={async () => {
          // Refresh insights after generation
          const insightsRes = await Api.get('/interview/insights').catch(() => []);
          setInsights(Array.isArray(insightsRes) ? insightsRes : []);
        }}
      />
    </div>
  );
};

export default InterviewHub;
