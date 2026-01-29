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
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  Target,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { useInterviewPermissions } from '@/hooks/useInterviewPermissions';
import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

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
  | 'in_review'
  | 'approved'
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
  bg-navy-800 border-navy-600 text-slate-300
  hover:bg-navy-700 hover:border-slate-500 hover:text-white
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
  bg-navy-800 border-navy-600 text-slate-400
  hover:bg-navy-700 hover:border-slate-500 hover:text-white
`;

const TAB_ACTIVE = `
  ${TAB_BASE}
  bg-primary-500/15 border-primary-500 text-primary-400
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
  in_review: 'bg-amber-400',
  approved: 'bg-emerald-400',
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
  const [searchParams] = useSearchParams();
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
  const [assignmentStatusFilter, setAssignmentStatusFilter] = useState<string>('all');

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

  // Dynamic documents state
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [sessionsRes, insightsRes, templatesRes] = await Promise.all([
          Api.get('/interview/sessions'),
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
      in_progress: sessions.filter((s) => s.status === 'in_progress').length,
      submitted: sessions.filter((s) => s.status === 'submitted' || s.status === 'in_review')
        .length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      archived: sessions.filter((s) => s.status === 'archived').length,
      paused: sessions.filter((s) => s.status === 'paused').length,
    };
  }, [sessions]);

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

      // 3. Templates - biblioteka szablonów (PM/Admin)
      baseTabs.push({
        id: 'templates' as ModuleTab,
        label: isPolish ? 'Szablony' : 'Templates',
        icon: <FileText size={16} />,
        count: templates.length,
      });

      // 4. Insights - wnioski AI (PM/Admin)
      baseTabs.push({
        id: 'insights' as ModuleTab,
        label: isPolish ? 'Wnioski' : 'Insights',
        icon: <Lightbulb size={16} />,
        count: insights.length,
      });

      // 5. Assigned - wywiady które przydzieliłem (PM/Admin)
      const assignedCount = managedAssignments.length;
      const overdueCount = overdueAssignments.length;
      baseTabs.push({
        id: 'managed' as ModuleTab,
        label: isPolish ? 'Przydzielone' : 'Assigned',
        icon: <ClipboardList size={16} />,
        count: assignedCount,
        hasWarning: overdueCount > 0,
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

      // Open the new session
      handleOpenDocument({
        id: (newSession as InterviewSession).id,
        type: 'session',
        name: (newSession as InterviewSession).name || 'Interview Session',
        status: (newSession as any)?.status || 'in_progress',
        data: newSession as InterviewSession,
      });

      toast.success(isPolish ? 'Nowa sesja wywiadu rozpoczęta!' : 'New interview session started!');
    } catch (error) {
      console.error('[InterviewHub] Failed to create session:', error);
      toast.error(isPolish ? 'Nie udało się utworzyć sesji' : 'Failed to create session');
    }
  }, [ensureProjectId, handleOpenDocument, isPolish]);

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
      Api.get('/interview/sessions').then((res) => {
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
      } catch (error) {
        toast.error(isPolish ? 'Nie udało się zwrócić wywiadu' : 'Failed to send back');
        console.error('[InterviewHub] Failed to send back:', error);
      }
    },
    [selectedAssignment, isPolish]
  );

  const handleApproveAssignment = useCallback(
    async (assignment: InterviewAssignment) => {
      try {
        await Api.post(`/interview/assignments/${assignment.id}/approve`, {});
        toast.success(isPolish ? 'Wywiad zatwierdzony!' : 'Interview approved!');

        // Refresh all assignments (both my and managed)
        const [myRes, managedRes, overdueRes] = await Promise.all([
          Api.get('/interview/assignments/my').catch(() => []),
          Api.get('/interview/assignments/managed').catch(() => []),
          Api.get('/interview/assignments/overdue').catch(() => []),
        ]);
        setMyAssignments(Array.isArray(myRes) ? myRes : []);
        setManagedAssignments(Array.isArray(managedRes) ? managedRes : []);
        setOverdueAssignments(Array.isArray(overdueRes) ? overdueRes : []);
      } catch (error) {
        toast.error(isPolish ? 'Nie udało się zatwierdzić wywiadu' : 'Failed to approve interview');
        console.error('[InterviewHub] Failed to approve assignment:', error);
      }
    },
    [isPolish]
  );

  // Export action
  const handleExport = useCallback(
    (format: 'pdf' | 'excel') => {
      // TODO: Implement export functionality
      toast.success(
        isPolish
          ? `Eksport do ${format.toUpperCase()} rozpoczęty`
          : `Export to ${format.toUpperCase()} started`
      );
      setShowExportModal(false);
    },
    [isPolish]
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
      <div className="flex items-center gap-2 px-4 py-2 bg-navy-900/50 border-b border-navy-700">
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
        <div className="w-px h-6 bg-navy-600" />

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
                className="p-0.5 rounded opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white hover:bg-navy-600 transition-all"
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
        textColor: 'text-slate-300',
        dotColor: 'bg-slate-400',
      },
      archived: {
        label: { en: 'Archived', pl: 'Zarchiwizowany' },
        bgColor: 'bg-slate-500/20',
        textColor: 'text-slate-300',
        dotColor: 'bg-slate-400',
      },
    };
    return configs[status] || configs.in_progress;
  };

  // Render table view for sessions
  const renderSessionsTable = () => (
    <div className="bg-navy-900 border border-navy-700 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-navy-700">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Nazwa' : 'Name'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Status' : 'Status'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Postęp' : 'Progress'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Data' : 'Date'}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
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
                className="group hover:bg-navy-800/50 cursor-pointer transition-colors border-b border-navy-700/50 last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${statusConfig.bgColor}`}
                    >
                      <Brain size={16} className={statusConfig.textColor} />
                    </div>
                    <div>
                      <span className="text-sm text-white font-medium block">
                        {session.name || 'Discovery Interview'}
                      </span>
                      {session.ownerId && (
                        <span className="text-xs text-slate-500">
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
                    <span className={`text-xs font-medium ${statusConfig.textColor}`}>
                      {isPolish ? statusConfig.label.pl : statusConfig.label.en}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 max-w-[100px] h-1.5 bg-navy-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          progress === 100 ? 'bg-emerald-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-400">{progress}%</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Calendar size={12} />
                    {new Date(session.startedAt).toLocaleDateString()}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Generate Insights - only for completed sessions */}
                    {isCompleted && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateInsight(session);
                        }}
                        className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-amber-400 transition-colors"
                        title={isPolish ? 'Generuj wnioski AI' : 'Generate AI insights'}
                      >
                        <Lightbulb size={14} />
                      </button>
                    )}
                    {/* Export */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowExportModal(true);
                      }}
                      className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-blue-400 transition-colors"
                      title={isPolish ? 'Eksportuj' : 'Export'}
                    >
                      <Download size={14} />
                    </button>
                    {/* Open */}
                    <button className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-white">
                      <ChevronRight size={14} />
                    </button>
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
                  <p className="text-slate-400 text-sm">
                    {isPolish ? 'Brak sesji wywiadów' : 'No interview sessions yet'}
                  </p>
                  <button
                    onClick={handleNewSession}
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <Sparkles size={16} />
                    {isPolish ? 'Rozpocznij wywiad' : 'Start Interview'}
                  </button>
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
      {/* New Session Card */}
      <button
        onClick={handleNewSession}
        className="flex flex-col items-center justify-center gap-2 min-h-[180px] rounded-xl border-2 border-dashed border-navy-600 text-slate-500 hover:text-primary-400 hover:border-primary-500/50 transition-all"
      >
        <Plus size={24} />
        <span className="text-sm font-medium">{isPolish ? 'Nowa sesja' : 'New Session'}</span>
      </button>

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
                  <span className="font-mono text-xs font-bold text-slate-300">
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
              <h4 className="text-sm font-medium text-white line-clamp-2 min-h-[40px]">
                {session.name || 'Discovery Interview'}
              </h4>
            </div>

            {/* Progress */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      progress === 100 ? 'bg-emerald-500' : 'bg-purple-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-slate-400">{progress}%</span>
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

  // Render insights table
  const renderInsightsTable = () => (
    <div className="bg-navy-900 border border-navy-700 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-navy-700">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Tytuł' : 'Title'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Typ' : 'Type'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Status' : 'Status'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Źródło' : 'Source'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Data' : 'Date'}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Akcje' : 'Actions'}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredInsights.map((insight) => {
            const promptType =
              (insight as any).promptType || (insight as any).insightType || 'summary';
            const typeConfig = getInsightTypeConfig(promptType);
            const status = (insight.status || 'completed') as 'generating' | 'completed' | 'failed';
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

            return (
              <tr
                key={insight.id}
                onClick={() => handleViewInsight(insight)}
                className="group hover:bg-navy-800/50 cursor-pointer transition-colors border-b border-navy-700/50 last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${typeConfig.bgColor}`}
                    >
                      <Lightbulb size={16} className={typeConfig.textColor} />
                    </div>
                    <div>
                      <span className="text-sm text-white font-medium block">{insight.title}</span>
                      {insight.createdBy && (
                        <span className="text-xs text-slate-500">
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
                  <span className="text-xs text-slate-400">
                    {insight.sourceSessionCount
                      ? `${insight.sourceSessionCount} ${isPolish ? 'sesji' : 'sessions'}`
                      : '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {insight.createdAt ? new Date(insight.createdAt).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Export to Tools */}
                    {!insight.exportedToTools ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportInsightToTools(insight.id);
                        }}
                        className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-emerald-400 transition-colors"
                        title={isPolish ? 'Eksportuj do Tools' : 'Export to Tools'}
                      >
                        <Send size={14} />
                      </button>
                    ) : (
                      <span
                        className="p-1.5 text-emerald-400"
                        title={isPolish ? 'Wyeksportowano do Tools' : 'Exported to Tools'}
                      >
                        <Check size={14} />
                      </span>
                    )}

                    {/* Export to Assessment */}
                    {!insight.exportedToAssessment ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleExportInsightToAssessment(insight.id);
                        }}
                        className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-blue-400 transition-colors"
                        title={isPolish ? 'Eksportuj do Assessment' : 'Export to Assessment'}
                      >
                        <FileText size={14} />
                      </button>
                    ) : (
                      <span
                        className="p-1.5 text-blue-400"
                        title={isPolish ? 'Wyeksportowano do Assessment' : 'Exported to Assessment'}
                      >
                        <Check size={14} />
                      </span>
                    )}

                    {/* More actions on hover */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {/* Download */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          // Download insight as markdown
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
                        }}
                        className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-blue-400 transition-colors"
                        title={isPolish ? 'Pobierz' : 'Download'}
                      >
                        <Download size={14} />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteInsight(insight.id);
                        }}
                        className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-red-400 transition-colors"
                        title={isPolish ? 'Usuń' : 'Delete'}
                      >
                        <Trash2 size={14} />
                      </button>

                      {/* Open */}
                      <button className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-white">
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredInsights.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center">
                  <Lightbulb className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-slate-400 text-sm mb-4">
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

  // Render templates table
  const renderTemplatesTable = () => (
    <div className="bg-navy-900 border border-navy-700 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-navy-700">
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Nazwa' : 'Name'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Kategoria' : 'Category'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Pytania' : 'Questions'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Status' : 'Status'}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Akcje' : 'Actions'}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredTemplates.map((template) => (
            <tr
              key={template.id}
              onClick={() => handleViewTemplate(template)}
              className="group hover:bg-navy-800/50 cursor-pointer transition-colors border-b border-navy-700/50 last:border-0"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/20">
                    <FileText size={16} className="text-blue-400" />
                  </div>
                  <div>
                    <span className="text-sm text-white font-medium block">{template.name}</span>
                    <span className="text-xs text-slate-500 line-clamp-1">
                      {template.description}
                    </span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="px-2 py-1 bg-navy-700 text-slate-300 text-xs rounded-full">
                  {template.category}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-slate-400">{template.questionCount}</td>
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
              <td className="px-4 py-3 text-right">
                <div className="flex items-center justify-end gap-1">
                  {/* Assign Template - primary action for PM/Admin */}
                  {canAssign && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTemplateForAssign(template);
                        setShowAssignModal(true);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs font-medium transition-colors"
                      title={isPolish ? 'Przydziel szablon' : 'Assign template'}
                    >
                      <UserPlus size={12} />
                      {isPolish ? 'Przydziel' : 'Assign'}
                    </button>
                  )}

                  {/* More actions - visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {/* Use Template */}
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        const projectId = await ensureProjectId();
                        if (!projectId) {
                          toast.error(
                            isPolish
                              ? 'Wybierz projekt przed utworzeniem sesji'
                              : 'Select a project before creating a session'
                          );
                          return;
                        }
                        // Use template logic - same as in template view
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
                              isPolish ? 'Nie udało się utworzyć sesji' : 'Failed to create session'
                            );
                          });
                      }}
                      className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-emerald-400 transition-colors"
                      title={isPolish ? 'Użyj szablonu' : 'Use template'}
                    >
                      <Sparkles size={14} />
                    </button>

                    {/* Clone Template */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloneTemplate(template);
                      }}
                      className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-blue-400 transition-colors"
                      title={isPolish ? 'Klonuj szablon' : 'Clone template'}
                    >
                      <Copy size={14} />
                    </button>

                    {/* Edit Template - only for PM/Admin */}
                    {canAssign && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTemplate(template.id);
                        }}
                        className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-amber-400 transition-colors"
                        title={isPolish ? 'Edytuj szablon' : 'Edit template'}
                      >
                        <Edit3 size={14} />
                      </button>
                    )}

                    {/* Delete Template - only for PM/Admin and non-default */}
                    {canAssign && !template.isDefault && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteTemplate(template);
                        }}
                        className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-red-400 transition-colors"
                        title={isPolish ? 'Usuń szablon' : 'Delete template'}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
          {filteredTemplates.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center">
                  <FileText className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-slate-400 text-sm mb-4">
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
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <FileText size={24} className="text-blue-400" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-white mb-2">{template.name}</h1>
                <p className="text-slate-400 text-sm mb-3">{template.description}</p>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-navy-700 text-slate-300 text-xs rounded-full">
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
            <div className="border-t border-navy-700 pt-6 space-y-4">
              {/* Questions Preview (read-only) */}
              <div>
                <h2 className="text-sm font-semibold text-white mb-3">
                  {isPolish ? 'Podgląd pytań' : 'Questions preview'}
                </h2>
                {isTemplateQuestionsLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
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
                          className="bg-navy-950/40 border border-navy-700 rounded-lg p-4"
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
                    toast.loading(
                      isPolish
                        ? 'Tworzenie sesji z szablonu...'
                        : 'Creating session from template...'
                    );
                    const created = await Api.post(`/interview/templates/${template.id}/use`, {
                      projectId: currentProjectId,
                      name: `${template.name} ${new Date().toLocaleDateString()}`,
                    });

                    const newSession = created as InterviewSession;
                    setSessions((prev) => [newSession, ...prev]);

                    handleOpenDocument({
                      id: newSession.id,
                      type: 'session',
                      name: newSession.name || 'Interview Session',
                      status: 'active',
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

  // Render assignments table (reusable for my/managed/overdue)
  const renderAssignmentsTable = (
    assignments: InterviewAssignment[],
    showAssignee: boolean = false
  ) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'assigned':
          return 'bg-blue-500/20 text-blue-400';
        case 'in_progress':
          return 'bg-purple-500/20 text-purple-400';
        case 'submitted':
          return 'bg-amber-500/20 text-amber-400';
        case 'sent_back':
          return 'bg-red-500/20 text-red-400';
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
        in_progress: { pl: 'W trakcie', en: 'In Progress' },
        submitted: { pl: 'Wysłany', en: 'Submitted' },
        sent_back: { pl: 'Do poprawy', en: 'Sent Back' },
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

    const handleStartAssignment = async (assignment: InterviewAssignment) => {
      try {
        toast.loading(isPolish ? 'Rozpoczynanie wywiadu...' : 'Starting interview...');
        const result = await Api.post(`/interview/assignments/${assignment.id}/start`, {});
        toast.dismiss();
        toast.success(isPolish ? 'Wywiad rozpoczęty!' : 'Interview started!');

        // Open the session
        if ((result as any).sessionId) {
          const session = await Api.get(`/interview/sessions/${(result as any).sessionId}`);
          handleOpenDocument({
            id: (session as InterviewSession).id,
            type: 'session',
            name: (session as InterviewSession).name || 'Interview Session',
            status: 'active',
            data: session as InterviewSession,
          });
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
      } catch (error) {
        toast.dismiss();
        toast.error(isPolish ? 'Nie udało się rozpocząć' : 'Failed to start');
        console.error('[InterviewHub] Failed to start assignment:', error);
      }
    };

    const handleSendReminder = async (assignment: InterviewAssignment) => {
      try {
        await Api.post(`/interview/assignments/${assignment.id}/remind`, {});
        toast.success(isPolish ? 'Przypomnienie wysłane!' : 'Reminder sent!');
      } catch (error) {
        toast.error(isPolish ? 'Nie udało się wysłać przypomnienia' : 'Failed to send reminder');
        console.error('[InterviewHub] Failed to send reminder:', error);
      }
    };

    return (
      <div className="bg-navy-900 border border-navy-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-navy-700">
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                {isPolish ? 'Szablon' : 'Template'}
              </th>
              {showAssignee && (
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {isPolish ? 'Przydzielony do' : 'Assignee'}
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                {isPolish ? 'Status' : 'Status'}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                {isPolish ? 'Postęp' : 'Progress'}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                {isPolish ? 'Termin' : 'Due Date'}
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                {isPolish ? 'Akcje' : 'Actions'}
              </th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => {
              const progress = assignment.session?.completenessPercent || 0;
              const overdue = isOverdue(assignment.dueAt) && assignment.status !== 'completed';

              return (
                <tr
                  key={assignment.id}
                  className="group hover:bg-navy-800/50 transition-colors border-b border-navy-700/50 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500/20`}
                      >
                        <ClipboardList size={16} className="text-blue-400" />
                      </div>
                      <div>
                        <span className="text-sm text-white font-medium block">
                          {assignment.template?.name || 'Interview'}
                        </span>
                        {assignment.template?.category && (
                          <span className="text-xs text-slate-500">
                            {assignment.template.category}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {showAssignee && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-navy-700 flex items-center justify-center text-xs text-slate-300">
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
                      <div className="flex-1 max-w-[100px] h-1.5 bg-navy-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${progress === 100 ? 'bg-emerald-500' : 'bg-purple-500'}`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400">{progress}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {assignment.dueAt ? (
                      <div
                        className={`flex items-center gap-1 text-xs ${overdue ? 'text-red-400' : 'text-slate-400'}`}
                      >
                        <Calendar size={12} />
                        {new Date(assignment.dueAt).toLocaleDateString()}
                        {overdue && <AlertTriangle size={12} className="ml-1" />}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Actions based on status and permissions */}

                      {/* User actions (not manager view) */}
                      {!showAssignee && (
                        <>
                          {/* Start - for assigned status */}
                          {assignment.status === 'assigned' && (
                            <button
                              onClick={() => handleStartAssignment(assignment)}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-xs font-medium transition-colors"
                            >
                              <Sparkles size={12} />
                              {isPolish ? 'Rozpocznij' : 'Start'}
                            </button>
                          )}

                          {/* Continue - for in_progress status */}
                          {assignment.status === 'in_progress' && assignment.sessionId && (
                            <button
                              onClick={async () => {
                                const session = await Api.get(
                                  `/interview/sessions/${assignment.sessionId}`
                                );
                                handleOpenDocument({
                                  id: (session as InterviewSession).id,
                                  type: 'session',
                                  name: (session as InterviewSession).name || 'Interview Session',
                                  status: 'active',
                                  data: session as InterviewSession,
                                });
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 text-xs font-medium transition-colors"
                            >
                              <ChevronRight size={12} />
                              {isPolish ? 'Kontynuuj' : 'Continue'}
                            </button>
                          )}

                          {/* Resume - for sent_back status (user needs to fix and resubmit) */}
                          {assignment.status === 'sent_back' && assignment.sessionId && (
                            <button
                              onClick={async () => {
                                const session = await Api.get(
                                  `/interview/sessions/${assignment.sessionId}`
                                );
                                handleOpenDocument({
                                  id: (session as InterviewSession).id,
                                  type: 'session',
                                  name: (session as InterviewSession).name || 'Interview Session',
                                  status: 'active',
                                  data: session as InterviewSession,
                                });
                              }}
                              className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors"
                            >
                              <RotateCcw size={12} />
                              {isPolish ? 'Popraw' : 'Fix & Resubmit'}
                            </button>
                          )}

                          {/* Submitted - waiting for review */}
                          {assignment.status === 'submitted' && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/20 text-amber-400 text-xs font-medium">
                              <Clock size={12} />
                              {isPolish ? 'Oczekuje na przegląd' : 'Awaiting Review'}
                            </span>
                          )}

                          {/* Completed/Approved - show checkmark */}
                          {(assignment.status === 'completed' ||
                            assignment.status === 'approved') && (
                            <span className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                              <Check size={12} />
                              {isPolish ? 'Zakończone' : 'Completed'}
                            </span>
                          )}
                        </>
                      )}

                      {/* Manager actions */}
                      {showAssignee &&
                        canAssign &&
                        assignment.status !== 'completed' &&
                        assignment.status !== 'approved' && (
                          <>
                            {/* Send Reminder - for all non-completed statuses */}
                            <button
                              onClick={() => handleOpenReminderModal(assignment)}
                              className="p-1.5 rounded hover:bg-navy-700 text-slate-400 hover:text-amber-400 transition-colors"
                              title={isPolish ? 'Wyślij przypomnienie' : 'Send reminder'}
                            >
                              <Bell size={14} />
                            </button>

                            {/* Review actions - only for submitted assignments */}
                            {assignment.status === 'submitted' && (
                              <>
                                <button
                                  onClick={() => handleApproveAssignment(assignment)}
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-colors"
                                  title={isPolish ? 'Zatwierdź' : 'Approve'}
                                >
                                  <Check size={12} />
                                  {isPolish ? 'Zatwierdź' : 'Approve'}
                                </button>
                                <button
                                  onClick={() => handleOpenSendBackModal(assignment)}
                                  className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 text-xs font-medium transition-colors"
                                  title={isPolish ? 'Zwróć do poprawy' : 'Send back'}
                                >
                                  <RotateCcw size={12} />
                                  {isPolish ? 'Odeślij' : 'Send Back'}
                                </button>
                              </>
                            )}
                          </>
                        )}
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
                    <p className="text-slate-400 text-sm">
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
      const statusFilters = [
        {
          id: 'all',
          label: isPolish ? 'Wszystkie' : 'All',
          count: sessionStatusCounts.all,
          activeClass: 'bg-primary-500/15 border-primary-500 text-primary-400',
        },
        {
          id: 'in_progress',
          label: isPolish ? 'W trakcie' : 'In Progress',
          count: sessionStatusCounts.in_progress,
          activeClass: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
        },
        {
          id: 'submitted',
          label: isPolish ? 'Do przeglądu' : 'To Review',
          count: sessionStatusCounts.submitted,
          activeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
        },
        {
          id: 'completed',
          label: isPolish ? 'Zakończone' : 'Completed',
          count: sessionStatusCounts.completed,
          activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
        },
        {
          id: 'archived',
          label: isPolish ? 'Archiwum' : 'Archived',
          count: sessionStatusCounts.archived,
          activeClass: 'bg-slate-500/20 border-slate-500/50 text-slate-300',
        },
      ];

      return (
        <div className="p-4 space-y-4">
          {/* Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {statusFilters.map((filter) => {
              const isActive = sessionStatusFilter === filter.id;

              return (
                <button
                  key={filter.id}
                  onClick={() => setSessionStatusFilter(filter.id)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    isActive
                      ? filter.activeClass
                      : 'bg-navy-800 border-navy-600 text-slate-400 hover:bg-navy-700 hover:text-white'
                  }`}
                >
                  <span>{filter.label}</span>
                  {filter.count > 0 && (
                    <span
                      className={`px-1.5 py-0.5 text-xs rounded-full ${
                        isActive ? 'bg-white/20' : 'bg-navy-700'
                      }`}
                    >
                      {filter.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sessions Table/Grid */}
          {viewMode === 'table' ? renderSessionsTable() : renderSessionsGrid()}
        </div>
      );
    }

    if (activeTab === 'insights') {
      const exportedAnyCount = insights.filter(
        (i) => i.exportedToTools || i.exportedToAssessment
      ).length;
      const statusFilters = [
        {
          id: 'all',
          label: isPolish ? 'Wszystkie' : 'All',
          count: insightStats.total,
          activeClass: 'bg-primary-500/15 border-primary-500 text-primary-400',
        },
        {
          id: 'generating',
          label: isPolish ? 'Generuje' : 'Generating',
          count: insightStats.generating,
          activeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
        },
        {
          id: 'completed',
          label: isPolish ? 'Gotowe' : 'Completed',
          count: insightStats.completed,
          activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
        },
        {
          id: 'failed',
          label: isPolish ? 'Błędy' : 'Failed',
          count: insightStats.failed,
          activeClass: 'bg-red-500/20 border-red-500/50 text-red-400',
        },
      ];

      return (
        <div className="p-4 space-y-4">
          {/* Insight Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Lightbulb size={16} className="text-amber-400" />
                <span className="text-xs text-slate-400">{isPolish ? 'Wnioski' : 'Insights'}</span>
              </div>
              <div className="text-2xl font-bold text-white">{insightStats.total}</div>
            </div>
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Loader2 size={16} className="text-amber-400" />
                <span className="text-xs text-slate-400">
                  {isPolish ? 'W trakcie' : 'Generating'}
                </span>
              </div>
              <div className="text-2xl font-bold text-white">{insightStats.generating}</div>
            </div>
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Check size={16} className="text-emerald-400" />
                <span className="text-xs text-slate-400">{isPolish ? 'Gotowe' : 'Completed'}</span>
              </div>
              <div className="text-2xl font-bold text-white">{insightStats.completed}</div>
            </div>
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Send size={16} className="text-blue-400" />
                <span className="text-xs text-slate-400">
                  {isPolish ? 'Wyeksportowane' : 'Exported'}
                </span>
              </div>
              <div className="text-2xl font-bold text-white">{exportedAnyCount}</div>
            </div>
          </div>

          {/* Filters Row */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Status Filters */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 mr-1">
                {isPolish ? 'Status:' : 'Status:'}
              </span>
              {statusFilters.map((filter) => (
                <button
                  key={filter.id}
                  onClick={() => setInsightStatusFilter(filter.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    insightStatusFilter === filter.id
                      ? filter.activeClass
                      : 'bg-navy-800 border-navy-600 text-slate-400 hover:bg-navy-700 hover:text-white'
                  }`}
                >
                  <span>{filter.label}</span>
                  {filter.count > 0 && (
                    <span
                      className={`px-1 py-0.5 text-xs rounded ${
                        insightStatusFilter === filter.id ? 'bg-white/20' : 'bg-navy-700'
                      }`}
                    >
                      {filter.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Type Filters */}
            {insightTypes.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 mr-1">{isPolish ? 'Typ:' : 'Type:'}</span>
                <button
                  onClick={() => setInsightTypeFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    insightTypeFilter === 'all'
                      ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                      : 'bg-navy-800 border-navy-600 text-slate-400 hover:bg-navy-700 hover:text-white'
                  }`}
                >
                  {isPolish ? 'Wszystkie' : 'All'}
                </button>
                {insightTypes.map((type) => {
                  const typeConfig = getInsightTypeConfig(type);
                  const count = insights.filter(
                    (i: any) => (i.promptType || i.insightType || 'summary') === type
                  ).length;
                  return (
                    <button
                      key={type}
                      onClick={() => setInsightTypeFilter(type)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        insightTypeFilter === type
                          ? `${typeConfig.bgColor} border-current ${typeConfig.textColor}`
                          : 'bg-navy-800 border-navy-600 text-slate-400 hover:bg-navy-700 hover:text-white'
                      }`}
                    >
                      <span>{isPolish ? typeConfig.label.pl : typeConfig.label.en}</span>
                      <span
                        className={`px-1 py-0.5 text-xs rounded ${insightTypeFilter === type ? 'bg-white/20' : 'bg-navy-700'}`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Insights Table */}
          {renderInsightsTable()}
        </div>
      );
    }

    if (activeTab === 'templates') {
      return (
        <div className="p-4 space-y-4">
          {/* Template Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText size={16} className="text-blue-400" />
                <span className="text-xs text-slate-400">
                  {isPolish ? 'Szablony' : 'Templates'}
                </span>
              </div>
              <div className="text-2xl font-bold text-white">{templateStats.total}</div>
            </div>
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={16} className="text-purple-400" />
                <span className="text-xs text-slate-400">
                  {isPolish ? 'Pytania łącznie' : 'Total Questions'}
                </span>
              </div>
              <div className="text-2xl font-bold text-white">{templateStats.totalQuestions}</div>
            </div>
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Check size={16} className="text-blue-400" />
                <span className="text-xs text-slate-400">{isPolish ? 'Domyślne' : 'Default'}</span>
              </div>
              <div className="text-2xl font-bold text-white">{templateStats.default}</div>
            </div>
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-emerald-400" />
                <span className="text-xs text-slate-400">{isPolish ? 'Aktywne' : 'Active'}</span>
              </div>
              <div className="text-2xl font-bold text-white">{templateStats.active}</div>
            </div>
          </div>

          {/* Category Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTemplateCategoryFilter('all')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                templateCategoryFilter === 'all'
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-navy-800 border-navy-600 text-slate-400 hover:bg-navy-700 hover:text-white'
              }`}
            >
              <span>{isPolish ? 'Wszystkie' : 'All'}</span>
              <span
                className={`px-1.5 py-0.5 text-xs rounded-full ${
                  templateCategoryFilter === 'all' ? 'bg-white/20' : 'bg-navy-700'
                }`}
              >
                {templates.length}
              </span>
            </button>
            {templateCategories.map((category) => {
              const count = templates.filter((t) => t.category === category).length;
              const isActive = templateCategoryFilter === category;
              return (
                <button
                  key={category}
                  onClick={() => setTemplateCategoryFilter(category)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                    isActive
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400'
                      : 'bg-navy-800 border-navy-600 text-slate-400 hover:bg-navy-700 hover:text-white'
                  }`}
                >
                  <span>{category}</span>
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded-full ${
                      isActive ? 'bg-white/20' : 'bg-navy-700'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Templates Table */}
          {renderTemplatesTable()}
        </div>
      );
    }

    if (activeTab === 'my-assignments') {
      // Statystyki dla pracownika
      const pendingCount = myAssignments.filter(
        (a) => a.status === 'assigned' || a.status === 'sent_back'
      ).length;
      const inProgressCount = myAssignments.filter((a) => a.status === 'in_progress').length;
      const submittedCount = myAssignments.filter((a) => a.status === 'submitted').length;
      const completedCount = myAssignments.filter(
        (a) => a.status === 'approved' || a.status === 'completed'
      ).length;
      const overdueCount = myAssignments.filter((a) => {
        if (!a.dueAt) return false;
        return (
          new Date(a.dueAt) < new Date() && a.status !== 'approved' && a.status !== 'completed'
        );
      }).length;

      return (
        <div className="p-4 space-y-6">
          {/* Statystyki moich przydziałów (także dla managera, jeśli jest assignee) */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <Inbox size={16} className="text-blue-400" />
                </div>
                <span className="text-xs text-slate-400">
                  {isPolish ? 'Do zrobienia' : 'To Do'}
                </span>
              </div>
              <div className="text-2xl font-bold text-white">{pendingCount}</div>
            </div>
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <MessageSquare size={16} className="text-purple-400" />
                </div>
                <span className="text-xs text-slate-400">
                  {isPolish ? 'W trakcie' : 'In Progress'}
                </span>
              </div>
              <div className="text-2xl font-bold text-white">{inProgressCount}</div>
            </div>
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Send size={16} className="text-amber-400" />
                </div>
                <span className="text-xs text-slate-400">{isPolish ? 'Wysłane' : 'Submitted'}</span>
              </div>
              <div className="text-2xl font-bold text-white">{submittedCount}</div>
            </div>
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Check size={16} className="text-emerald-400" />
                </div>
                <span className="text-xs text-slate-400">
                  {isPolish ? 'Ukończone' : 'Completed'}
                </span>
              </div>
              <div className="text-2xl font-bold text-white">{completedCount}</div>
            </div>
            {overdueCount > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <AlertTriangle size={16} className="text-red-400" />
                  </div>
                  <span className="text-xs text-red-400">{isPolish ? 'Zaległe' : 'Overdue'}</span>
                </div>
                <div className="text-2xl font-bold text-red-400">{overdueCount}</div>
              </div>
            )}
          </div>

          {/* Tabela przydziałów */}
          {renderAssignmentsTable(myAssignments, false)}
        </div>
      );
    }

    if (activeTab === 'managed') {
      // Calculate status counts for managed assignments
      const managedStatusCounts = {
        all: managedAssignments.length,
        assigned: managedAssignments.filter((a) => a.status === 'assigned').length,
        in_progress: managedAssignments.filter((a) => a.status === 'in_progress').length,
        submitted: managedAssignments.filter((a) => a.status === 'submitted').length,
        sent_back: managedAssignments.filter((a) => a.status === 'sent_back').length,
        approved: managedAssignments.filter(
          (a) => a.status === 'approved' || a.status === 'completed'
        ).length,
      };

      // Filter assignments by status
      const filteredManagedAssignments =
        assignmentStatusFilter === 'all'
          ? managedAssignments
          : managedAssignments.filter((a) => {
              if (assignmentStatusFilter === 'approved') {
                return a.status === 'approved' || a.status === 'completed';
              }
              return a.status === assignmentStatusFilter;
            });

      const statusFilters = [
        {
          id: 'all',
          label: isPolish ? 'Wszystkie' : 'All',
          count: managedStatusCounts.all,
          activeClass: 'bg-primary-500/15 border-primary-500 text-primary-400',
        },
        {
          id: 'assigned',
          label: isPolish ? 'Przydzielone' : 'Assigned',
          count: managedStatusCounts.assigned,
          activeClass: 'bg-blue-500/20 border-blue-500/50 text-blue-400',
        },
        {
          id: 'in_progress',
          label: isPolish ? 'W trakcie' : 'In Progress',
          count: managedStatusCounts.in_progress,
          activeClass: 'bg-purple-500/20 border-purple-500/50 text-purple-400',
        },
        {
          id: 'submitted',
          label: isPolish ? 'Do przeglądu' : 'To Review',
          count: managedStatusCounts.submitted,
          activeClass: 'bg-amber-500/20 border-amber-500/50 text-amber-400',
        },
        {
          id: 'sent_back',
          label: isPolish ? 'Odesłane' : 'Sent Back',
          count: managedStatusCounts.sent_back,
          activeClass: 'bg-red-500/20 border-red-500/50 text-red-400',
        },
        {
          id: 'approved',
          label: isPolish ? 'Zatwierdzone' : 'Approved',
          count: managedStatusCounts.approved,
          activeClass: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400',
        },
      ];

      return (
        <div className="p-4 space-y-4">
          {/* Status Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {statusFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => setAssignmentStatusFilter(filter.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                  assignmentStatusFilter === filter.id
                    ? filter.activeClass
                    : 'bg-navy-800 border-navy-600 text-slate-400 hover:bg-navy-700 hover:text-white'
                }`}
              >
                <span>{filter.label}</span>
                {filter.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 text-xs rounded-full ${
                      assignmentStatusFilter === filter.id ? 'bg-white/20' : 'bg-navy-700'
                    }`}
                  >
                    {filter.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Overdue Warning */}
          {overdueAssignments.length > 0 && assignmentStatusFilter === 'all' && (
            <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              <AlertTriangle size={20} className="text-red-400" />
              <div>
                <span className="text-sm font-medium text-red-400">
                  {overdueAssignments.length}{' '}
                  {isPolish ? 'zaległych przydziałów' : 'overdue assignments'}
                </span>
                <p className="text-xs text-red-400/70">
                  {isPolish
                    ? 'Wyślij przypomnienia lub sprawdź status'
                    : 'Send reminders or check status'}
                </p>
              </div>
            </div>
          )}

          {/* Assignments Table */}
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
    <div className="flex flex-col h-full bg-navy-950">
      {/* Navigation Bar (Golden Standard) */}
      <div className="bg-navy-900 border-b border-navy-700">
        {/* Main Navigation Row */}
        <div className="flex items-center justify-between px-4 py-3">
          {/* Left: Search + Tabs + Status Filters */}
          <div className="flex items-center gap-3">
            {/* Search Toggle */}
            <button
              onClick={() => setShowSearch(!showSearch)}
              className={`p-2 rounded-lg border transition-all duration-200 ${
                showSearch
                  ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                  : 'bg-navy-800 border-navy-600 text-slate-400 hover:text-white hover:border-slate-500'
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
                              : 'bg-navy-700 text-slate-400'
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

          {/* Right: MINIMAL Action Buttons - kontekstowe per tab */}
          <div className="flex items-center gap-2">
            {/* Sessions tab: tylko + Nowa sesja */}
            {activeTab === 'sessions' && !activeDocumentId && (
              <button
                onClick={handleNewSession}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white border border-primary-400/30 hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/25 transition-all duration-200"
              >
                <Plus size={16} />
                <span>{isPolish ? 'Nowa sesja' : 'New Session'}</span>
              </button>
            )}

            {/* Templates tab: + Nowy szablon (PM/Admin) + Przydziel (PM/Admin) */}
            {activeTab === 'templates' && !activeDocumentId && canAssign && (
              <>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-500/15 border border-blue-500/50 text-blue-400 hover:bg-blue-500/25 hover:border-blue-400 transition-all duration-200"
                >
                  <UserPlus size={16} />
                  <span>{isPolish ? 'Przydziel' : 'Assign'}</span>
                </button>
                <button
                  onClick={handleNewTemplate}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-400/30 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/25 transition-all duration-200"
                >
                  <Plus size={16} />
                  <span>{isPolish ? 'Nowy szablon' : 'New Template'}</span>
                </button>
              </>
            )}

            {/* Assigned tab (PM/Admin): + Przydziel + Analityka */}
            {activeTab === 'managed' && !activeDocumentId && canAssign && (
              <>
                <button
                  onClick={() => setShowAnalytics(true)}
                  className={BUTTON_INACTIVE}
                  title={isPolish ? 'Analityka' : 'Analytics'}
                >
                  <BarChart3 size={16} />
                </button>
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-500 to-blue-600 text-white border border-blue-400/30 hover:from-blue-400 hover:to-blue-500 shadow-lg shadow-blue-500/25 transition-all duration-200"
                >
                  <Plus size={16} />
                  <span>{isPolish ? 'Przydziel' : 'Assign'}</span>
                </button>
              </>
            )}

            {/* Insights tab: + Generuj wnioski (zawsze widoczny) */}
            {activeTab === 'insights' && !activeDocumentId && (
              <button
                onClick={() => {
                  setSelectedSessionsForInsight([]);
                  setShowInsightModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-amber-500 to-amber-600 text-white border border-amber-400/30 hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/25 transition-all duration-200"
              >
                <Plus size={16} />
                <span>{isPolish ? 'Nowy Insight' : 'New Insight'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Search Bar (expandable) */}
        {showSearch && (
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
                className="w-full pl-10 pr-10 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={handleCloseSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
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
          <div className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-navy-700">
              <h2 className="text-lg font-semibold text-white">
                {isPolish ? 'Eksportuj dane' : 'Export Data'}
              </h2>
              <button
                onClick={() => setShowExportModal(false)}
                className="p-1 rounded hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-slate-400 mb-4">
                {isPolish ? 'Wybierz format eksportu:' : 'Choose export format:'}
              </p>
              <button
                onClick={() => handleExport('pdf')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-navy-800 border border-navy-600 hover:border-red-500/50 hover:bg-red-500/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <FileText size={20} className="text-red-400" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium text-white block">PDF</span>
                  <span className="text-xs text-slate-500">
                    {isPolish ? 'Raport profesjonalny' : 'Professional report'}
                  </span>
                </div>
              </button>
              <button
                onClick={() => handleExport('excel')}
                className="w-full flex items-center gap-3 p-3 rounded-lg bg-navy-800 border border-navy-600 hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <FileText size={20} className="text-emerald-400" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-medium text-white block">Excel</span>
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
          <div className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-navy-700">
              <h2 className="text-lg font-semibold text-white">
                {isPolish ? 'Wyślij przypomnienie' : 'Send Reminder'}
              </h2>
              <button
                onClick={() => {
                  setShowReminderModal(false);
                  setSelectedAssignment(null);
                }}
                className="p-1 rounded hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-sm text-slate-400 mb-4">
                {isPolish
                  ? `Czy na pewno chcesz wysłać przypomnienie do ${selectedAssignment.assignee?.name || 'użytkownika'}?`
                  : `Are you sure you want to send a reminder to ${selectedAssignment.assignee?.name || 'the user'}?`}
              </p>
              <div className="bg-navy-800 rounded-lg p-3 mb-4">
                <div className="text-sm text-white font-medium">
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
                  className="flex-1 px-4 py-2 rounded-lg bg-navy-800 border border-navy-600 text-slate-300 hover:bg-navy-700 transition-colors"
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
                    } catch (error) {
                      toast.error(
                        isPolish ? 'Nie udało się wysłać przypomnienia' : 'Failed to send reminder'
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
          <div className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b border-navy-700">
              <h2 className="text-lg font-semibold text-white">
                {isPolish ? 'Zwróć do poprawy' : 'Send Back for Revision'}
              </h2>
              <button
                onClick={() => {
                  setShowSendBackModal(false);
                  setSelectedAssignment(null);
                }}
                className="p-1 rounded hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
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
              <p className="text-sm text-slate-400 mb-4">
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
                className="w-full px-3 py-2 rounded-lg bg-navy-800 border border-navy-600 text-white placeholder-slate-500 focus:border-primary-500 focus:ring-1 focus:ring-primary-500/50 transition-all resize-none"
              />
              <div className="flex gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowSendBackModal(false);
                    setSelectedAssignment(null);
                  }}
                  className="flex-1 px-4 py-2 rounded-lg bg-navy-800 border border-navy-600 text-slate-300 hover:bg-navy-700 transition-colors"
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
          <div className="bg-navy-900 border border-navy-700 rounded-xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-navy-700">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 size={20} className="text-primary-400" />
                {isPolish ? 'Analityka wywiadów' : 'Interview Analytics'}
              </h2>
              <button
                onClick={() => setShowAnalytics(false)}
                className="p-1 rounded hover:bg-navy-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
                  <div className="text-2xl font-bold text-white">{sessions.length}</div>
                  <div className="text-sm text-slate-400">
                    {isPolish ? 'Wszystkie sesje' : 'Total Sessions'}
                  </div>
                </div>
                <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
                  <div className="text-2xl font-bold text-emerald-400">
                    {sessions.filter((s) => s.status === 'completed').length}
                  </div>
                  <div className="text-sm text-slate-400">
                    {isPolish ? 'Zakończone' : 'Completed'}
                  </div>
                </div>
                <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
                  <div className="text-2xl font-bold text-purple-400">
                    {sessions.filter((s) => s.status === 'active').length}
                  </div>
                  <div className="text-sm text-slate-400">
                    {isPolish ? 'W trakcie' : 'In Progress'}
                  </div>
                </div>
                <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
                  <div className="text-2xl font-bold text-amber-400">{insights.length}</div>
                  <div className="text-sm text-slate-400">
                    {isPolish ? 'Wnioski AI' : 'AI Insights'}
                  </div>
                </div>
              </div>

              {/* Assignment Stats */}
              <div className="bg-navy-800 border border-navy-700 rounded-xl p-4 mb-6">
                <h3 className="text-sm font-semibold text-white mb-4">
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
              <div className="bg-navy-800 border border-navy-700 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-white mb-4">
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
                  ? 'Pełny dashboard analityczny w przygotowaniu...'
                  : 'Full analytics dashboard coming soon...'}
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
