/**
 * InterviewHub
 * Interview module with ModuleHub pattern - Golden Standard compliant
 * 
 * Tabs: Sessions (completed), Assignments (management), Templates, Insights (AI)
 * Context-sensitive action buttons per tab
 */

import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Clock,
  ClipboardList,
  FileText,
  Lightbulb,
  MessageSquare,
  Plus,
  Sparkles,
  Target,
  User,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import {
  FilterableTable,
  FilterChip,
  GridItem,
  GridView,
  ModuleHub,
  ModuleTab,
  OpenDocument,
  TableColumn,
  ViewMode,
} from '../shared/ModuleHub';
import { InterviewWorkspace } from '../Interview/InterviewWorkspace';
import { InsightDetailView } from './InsightDetailView';

// Types
type AssignmentStatus = 'assigned' | 'in_progress' | 'submitted' | 'sent_back' | 'completed';
type InterviewTab = 'list' | 'assignments' | 'initiatives' | 'reports';

interface InterviewAssignment {
  id: string;
  status: AssignmentStatus;
  dueAt?: string | null;
  priority?: string;
  isTeamAssignment?: boolean;
  assignee?: { id: string; name: string; email: string };
  assigneeName?: string;
  template: {
    id: string;
    name: string;
    category?: string;
  };
  session?: {
    id: string;
    status: string;
    completenessPercent: number;
  } | null;
  createdAt?: string;
  updatedAt?: string;
}

interface CompletedSession {
  id: string;
  name: string;
  templateId: string;
  templateName?: string;
  respondentId?: string;
  respondentName?: string;
  status: string;
  completedAt?: string;
  answeredQuestions?: number;
  totalQuestions?: number;
}

// Status metadata
const ASSIGNMENT_STATUS_META: Record<AssignmentStatus, { label: string; color: string; dotColor: string }> = {
  assigned: { label: 'Assigned', color: 'bg-slate-500/20 text-slate-300', dotColor: 'bg-slate-400' },
  in_progress: { label: 'In Progress', color: 'bg-cyan-500/20 text-cyan-300', dotColor: 'bg-cyan-400' },
  submitted: { label: 'Submitted', color: 'bg-amber-500/20 text-amber-300', dotColor: 'bg-amber-400' },
  sent_back: { label: 'Returned', color: 'bg-red-500/20 text-red-300', dotColor: 'bg-red-400' },
  completed: { label: 'Completed', color: 'bg-emerald-500/20 text-emerald-300', dotColor: 'bg-emerald-400' },
};

const PRIORITY_META: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-slate-500/20 text-slate-300' },
  medium: { label: 'Medium', color: 'bg-blue-500/20 text-blue-300' },
  high: { label: 'High', color: 'bg-amber-500/20 text-amber-300' },
  urgent: { label: 'Urgent', color: 'bg-red-500/20 text-red-300' },
};

interface InterviewHubProps {
  initialTab?: InterviewTab;
}

export const InterviewHub: React.FC<InterviewHubProps> = ({ initialTab = 'list' }) => {
  const { t } = useTranslation('discovery');
  const { currentProjectId, currentUser } = useAppStore();

  // Tab and view state
  const [activeTab, setActiveTab] = useState<ModuleTab>(initialTab);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [openDocuments, setOpenDocuments] = useState<OpenDocument[]>([]);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);

  // Data state
  const [completedSessions, setCompletedSessions] = useState<CompletedSession[]>([]);
  const [assignments, setAssignments] = useState<InterviewAssignment[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state
  const [showAddAssignmentModal, setShowAddAssignmentModal] = useState(false);
  const [showAddInsightModal, setShowAddInsightModal] = useState(false);

  // Template editing state (existing functionality)
  const [templateQuestionsById, setTemplateQuestionsById] = useState<Record<string, any[]>>({});
  const [templateQuestionsLoading, setTemplateQuestionsLoading] = useState<Record<string, boolean>>({});
  const [templateEditMode, setTemplateEditMode] = useState<Record<string, boolean>>({});
  const [templateEditDraft, setTemplateEditDraft] = useState<Record<string, any>>({});
  const [templateQuestionDrafts, setTemplateQuestionDrafts] = useState<Record<string, Record<string, any>>>({});

  // ==========================================
  // DATA LOADING
  // ==========================================

  // Load completed sessions (Sessions tab)
  const loadCompletedSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await Api.get('/interview/sessions/completed');
      setCompletedSessions(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('[InterviewHub] Failed to load completed sessions:', err);
      // Fallback: try loading all sessions and filter
      try {
        const allRes = await Api.get('/interview/sessions');
        const all = Array.isArray(allRes) ? allRes : [];
        setCompletedSessions(all.filter((s: any) => s.status === 'completed'));
      } catch {
        setCompletedSessions([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load assignments (Assignments tab)
  const loadAssignments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await Api.get('/interview/assignments/managed');
      setAssignments(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('[InterviewHub] Failed to load assignments:', err);
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load templates (Templates tab)
  const loadTemplates = useCallback(async () => {
    try {
      const res = await Api.get('/interview/templates');
      const list = Array.isArray(res) ? res : [];
      const mapped = list.map((tpl: any) => ({
        id: tpl.id,
        name: tpl.name,
        description: tpl.description || '',
        category: String(tpl.category || '').toLowerCase(),
        status: tpl.status || 'approved',
        progress: 100,
        sessions: tpl.sessionsUsed ?? tpl.sessions ?? 0,
        updatedAt: tpl.updatedAt ? new Date(tpl.updatedAt) : new Date(),
        questionCount: tpl.questionCount ?? 0,
      }));
      setTemplates(mapped);
    } catch (err) {
      console.error('[InterviewHub] Failed to load templates:', err);
    }
  }, []);

  // Load insights (Insights tab)
  const loadInsights = useCallback(async () => {
    try {
      const res = await Api.get('/interview/insights');
      setInsights(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('[InterviewHub] Failed to load insights:', err);
      setInsights([]);
    }
  }, []);

  // Load data based on active tab
  useEffect(() => {
    switch (activeTab) {
      case 'list':
        void loadCompletedSessions();
        break;
      case 'assignments':
        void loadAssignments();
        break;
      case 'initiatives':
        void loadTemplates();
        break;
      case 'reports':
        void loadInsights();
        break;
    }
  }, [activeTab, loadCompletedSessions, loadAssignments, loadTemplates, loadInsights]);

  // ==========================================
  // TAB CONFIGURATION
  // ==========================================

  const tabs = useMemo(() => [
    {
      id: 'list' as ModuleTab,
      label: t('interview.tabs.sessions', 'Sessions'),
      icon: <MessageSquare size={16} />,
      count: completedSessions.length,
    },
    {
      id: 'assignments' as ModuleTab,
      label: t('interview.tabs.assignments', 'Assignments'),
      icon: <ClipboardList size={16} />,
      count: assignments.length,
    },
    {
      id: 'initiatives' as ModuleTab,
      label: t('interview.tabs.templates', 'Templates'),
      icon: <BookOpen size={16} />,
      count: templates.length,
    },
    {
      id: 'reports' as ModuleTab,
      label: t('interview.tabs.insights', 'Insights'),
      icon: <Lightbulb size={16} />,
      count: insights.length,
    },
  ], [t, completedSessions.length, assignments.length, templates.length, insights.length]);

  // ==========================================
  // CONTEXT-SENSITIVE ACTION BUTTON
  // ==========================================

  const getActionButton = useCallback(() => {
    switch (activeTab) {
      case 'list':
        // Sessions tab - no action button
        return { handler: undefined, label: undefined };
      case 'assignments':
        return {
          handler: () => setShowAddAssignmentModal(true),
          label: t('interview.addAssignment', 'Add Assignment'),
        };
      case 'initiatives':
        return {
          handler: () => {
            // Open template generator or create new template
            toast.success('Template generator opening...');
          },
          label: t('interview.addTemplate', 'Add Template'),
        };
      case 'reports':
        return {
          handler: () => setShowAddInsightModal(true),
          label: t('interview.addInsight', 'Add Insight'),
        };
      default:
        return { handler: undefined, label: undefined };
    }
  }, [activeTab, t]);

  const actionButton = getActionButton();

  // ==========================================
  // TABLE COLUMNS
  // ==========================================

  // Sessions columns (completed interviews)
  const sessionsColumns: TableColumn[] = useMemo(() => [
    {
      id: 'name',
      label: t('interview.columns.interview', 'Interview'),
      render: (row: any) => (
        <div>
          <span className="text-sm text-white font-medium">{row.name || row.templateName}</span>
          <div className="flex items-center gap-2 mt-0.5">
            <FileText size={12} className="text-slate-500" />
            <span className="text-xs text-slate-400">{row.category?.toUpperCase?.() || ''}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'respondent',
      label: t('interview.columns.respondent', 'Respondent'),
      width: '180px',
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-navy-700 flex items-center justify-center">
            <User size={14} className="text-slate-400" />
          </div>
          <span className="text-sm text-slate-300">{row.respondentName || 'Unknown'}</span>
        </div>
      ),
    },
    {
      id: 'completedAt',
      label: t('interview.columns.completed', 'Completed'),
      width: '140px',
      sortable: true,
      render: (row: any) => (
        <span className="text-sm text-slate-400">
          {row.completedAt ? new Date(row.completedAt).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      id: 'status',
      label: t('interview.columns.status', 'Status'),
      width: '120px',
      render: () => (
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-medium">Completed</span>
        </div>
      ),
    },
  ], [t]);

  // Assignments columns
  const assignmentsColumns: TableColumn[] = useMemo(() => [
    {
      id: 'template',
      label: t('interview.columns.template', 'Template'),
      render: (row: any) => (
        <div>
          <span className="text-sm text-white font-medium">{row.template?.name || row.templateName}</span>
          {row.isTeamAssignment && (
            <span className="ml-2 text-xs text-blue-400">
              <Users size={12} className="inline" /> Team
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'assignee',
      label: t('interview.columns.assignee', 'Assignee'),
      width: '180px',
      render: (row: any) => (
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-navy-700 flex items-center justify-center">
            <User size={14} className="text-slate-400" />
          </div>
          <span className="text-sm text-slate-300">
            {row.assignee?.name || row.assigneeName || 'Unknown'}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      label: t('interview.columns.status', 'Status'),
      width: '140px',
      filterable: true,
      filterOptions: Object.entries(ASSIGNMENT_STATUS_META).map(([key, meta]) => ({
        value: key,
        label: meta.label,
        color: meta.dotColor,
      })),
      render: (row: any) => {
        const meta = ASSIGNMENT_STATUS_META[row.status as AssignmentStatus] || ASSIGNMENT_STATUS_META.assigned;
        return (
          <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${meta.color}`}>
            <span className={`w-2 h-2 rounded-full ${meta.dotColor}`} />
            <span className="text-xs font-medium">{meta.label}</span>
          </div>
        );
      },
    },
    {
      id: 'progress',
      label: t('interview.columns.progress', 'Progress'),
      width: '120px',
      render: (row: any) => {
        const progress = row.session?.completenessPercent ?? row.progress ?? 0;
        return (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 w-8">{progress}%</span>
            <div className="flex-1 h-1.5 bg-navy-700 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
            </div>
          </div>
        );
      },
    },
    {
      id: 'dueAt',
      label: t('interview.columns.due', 'Due'),
      width: '120px',
      render: (row: any) => {
        if (!row.dueAt) return <span className="text-xs text-slate-500">-</span>;
        const isOverdue = new Date(row.dueAt) < new Date() && !['completed', 'submitted'].includes(row.status);
        return (
          <span className={`text-xs ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>
            {isOverdue && <AlertTriangle size={10} className="inline mr-1" />}
            {new Date(row.dueAt).toLocaleDateString()}
          </span>
        );
      },
    },
    {
      id: 'priority',
      label: t('interview.columns.priority', 'Priority'),
      width: '100px',
      render: (row: any) => {
        const priority = row.priority || 'medium';
        const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
        return (
          <span className={`text-xs px-2 py-0.5 rounded-full ${meta.color}`}>
            {meta.label}
          </span>
        );
      },
    },
  ], [t]);

  // Templates columns
  const templatesColumns: TableColumn[] = useMemo(() => [
    {
      id: 'category',
      label: t('interview.columns.type', 'Type'),
      width: '120px',
      render: (row: any) => (
        <span className="font-mono text-xs font-bold text-slate-300 uppercase">
          {row.category}
        </span>
      ),
    },
    {
      id: 'name',
      label: t('interview.columns.template', 'Template'),
      render: (row: any) => (
        <div>
          <span className="text-sm text-white font-medium">{row.name}</span>
          <div className="text-xs text-slate-500 mt-0.5">{row.description}</div>
        </div>
      ),
    },
    {
      id: 'questionCount',
      label: t('interview.columns.questions', 'Questions'),
      width: '100px',
      render: (row: any) => (
        <span className="text-sm text-slate-300">{row.questionCount || 0}</span>
      ),
    },
    {
      id: 'sessions',
      label: t('interview.columns.used', 'Used'),
      width: '100px',
      render: (row: any) => (
        <span className="text-sm text-slate-300">{row.sessions || 0} times</span>
      ),
    },
    {
      id: 'status',
      label: t('interview.columns.status', 'Status'),
      width: '120px',
      render: (row: any) => {
        const isApproved = row.status === 'approved';
        return (
          <span className={`text-xs px-2 py-1 rounded-full ${
            isApproved ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-500/20 text-slate-300'
          }`}>
            {isApproved ? 'Approved' : 'Draft'}
          </span>
        );
      },
    },
  ], [t]);

  // Insights columns
  const insightsColumns: TableColumn[] = useMemo(() => [
    {
      id: 'promptType',
      label: t('interview.columns.type', 'Type'),
      width: '140px',
      render: (row: any) => {
        const typeConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
          summary: { label: 'Summary', color: 'text-blue-400', icon: <FileText size={14} /> },
          trends: { label: 'Trends', color: 'text-amber-400', icon: <Target size={14} /> },
          problems: { label: 'Problems', color: 'text-rose-400', icon: <AlertTriangle size={14} /> },
          recommendations: { label: 'Recommendations', color: 'text-emerald-400', icon: <Sparkles size={14} /> },
        };
        const config = typeConfig[row.promptType] || typeConfig.summary;
        return (
          <div className={`flex items-center gap-2 ${config.color}`}>
            {config.icon}
            <span className="text-xs font-medium">{config.label}</span>
          </div>
        );
      },
    },
    {
      id: 'title',
      label: t('interview.columns.title', 'Title'),
      render: (row: any) => (
        <div>
          <span className="text-sm text-white font-medium">{row.title}</span>
          <div className="text-xs text-slate-500 mt-0.5">
            {row.sourceSessionCount || 0} sessions analyzed
          </div>
        </div>
      ),
    },
    {
      id: 'createdAt',
      label: t('interview.columns.generated', 'Generated'),
      width: '140px',
      sortable: true,
      render: (row: any) => (
        <span className="text-sm text-slate-400">
          {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : '-'}
        </span>
      ),
    },
    {
      id: 'status',
      label: t('interview.columns.status', 'Status'),
      width: '120px',
      render: (row: any) => {
        const statusConfig: Record<string, { label: string; color: string }> = {
          generating: { label: 'Generating...', color: 'bg-amber-500/20 text-amber-300' },
          completed: { label: 'Ready', color: 'bg-emerald-500/20 text-emerald-300' },
          failed: { label: 'Failed', color: 'bg-red-500/20 text-red-300' },
        };
        const config = statusConfig[row.status] || statusConfig.completed;
        return (
          <span className={`text-xs px-2 py-1 rounded-full ${config.color}`}>
            {config.label}
          </span>
        );
      },
    },
  ], [t]);

  // Get current columns based on tab
  const currentColumns = useMemo(() => {
    switch (activeTab) {
      case 'list': return sessionsColumns;
      case 'assignments': return assignmentsColumns;
      case 'initiatives': return templatesColumns;
      case 'reports': return insightsColumns;
      default: return sessionsColumns;
    }
  }, [activeTab, sessionsColumns, assignmentsColumns, templatesColumns, insightsColumns]);

  // Get current data based on tab
  const currentData = useMemo(() => {
    switch (activeTab) {
      case 'list': return completedSessions;
      case 'assignments': return assignments;
      case 'initiatives': return templates;
      case 'reports': return insights;
      default: return [];
    }
  }, [activeTab, completedSessions, assignments, templates, insights]);

  // Grid items
  const gridItems: GridItem[] = useMemo(() => {
    return currentData.map((item: any) => ({
      ...item,
      type: item.category || item.promptType || 'default',
      typeColor: 'blue',
    }));
  }, [currentData]);

  // ==========================================
  // HANDLERS
  // ==========================================

  const handleOpenDocument = useCallback((row: any) => {
    // Handle opening based on tab type
    if (activeTab === 'list') {
      // Open completed session for viewing
      const doc: OpenDocument = {
        id: row.id,
        type: 'assessment',
        subType: 'INTERVIEW_SESSION',
        name: row.name || row.templateName || 'Interview Session',
        status: 'completed' as any,
      };
      setOpenDocuments((prev) => {
        if (prev.find((d) => d.id === doc.id)) return prev;
        return [...prev, doc];
      });
      setActiveDocumentId(row.id);
      return;
    }

    if (activeTab === 'initiatives') {
      // Open template detail
      const doc: OpenDocument = {
        id: row.id,
        type: 'assessment',
        subType: 'TEMPLATE',
        name: row.name,
        status: row.status as any,
      };
      setOpenDocuments((prev) => {
        if (prev.find((d) => d.id === doc.id)) return prev;
        return [...prev, doc];
      });
      setActiveDocumentId(row.id);
      return;
    }

    if (activeTab === 'reports') {
      // Open insight detail
      const doc: OpenDocument = {
        id: row.id,
        type: 'assessment',
        subType: 'INSIGHT',
        name: row.title,
        status: row.status as any,
      };
      setOpenDocuments((prev) => {
        if (prev.find((d) => d.id === doc.id)) return prev;
        return [...prev, doc];
      });
      setActiveDocumentId(row.id);
    }
  }, [activeTab]);

  const handleCloseDocument = useCallback((id: string) => {
    setOpenDocuments((prev) => prev.filter((d) => d.id !== id));
    if (activeDocumentId === id) {
      setActiveDocumentId(null);
    }
  }, [activeDocumentId]);

  const handleShowList = useCallback(() => {
    setActiveDocumentId(null);
  }, []);

  const handleRemoveFilter = useCallback((id: string) => {
    setActiveFilters((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handleClearFilters = useCallback(() => {
    setActiveFilters([]);
  }, []);

  const handleRowAction = useCallback((action: string, row: any) => {
    if (action === 'view' || action === 'edit') {
      handleOpenDocument(row);
    }
    if (action === 'remind' && activeTab === 'assignments') {
      Api.post(`/interview/assignments/${row.id}/remind`, {})
        .then(() => toast.success('Reminder sent'))
        .catch(() => toast.error('Failed to send reminder'));
    }
  }, [activeTab, handleOpenDocument]);

  // Template editing helpers
  const enterTemplateEditMode = useCallback((templateId: string) => {
    setTemplateEditMode((prev) => ({ ...prev, [templateId]: true }));
    const template = templates.find((x: any) => x.id === templateId);
    if (template) {
      setTemplateEditDraft((prev) => ({
        ...prev,
        [templateId]: {
          name: template.name,
          description: template.description,
          category: String(template.category || '').toUpperCase(),
          status: template.status || 'approved',
        },
      }));
    }
  }, [templates]);

  const exitTemplateEditMode = useCallback((templateId: string) => {
    setTemplateEditMode((prev) => ({ ...prev, [templateId]: false }));
  }, []);

  // ==========================================
  // RENDER CONTENT
  // ==========================================

  const renderContent = () => {
    // Document view
    if (activeDocumentId) {
      const doc = openDocuments.find((d) => d.id === activeDocumentId);
      
      if (doc?.subType === 'INTERVIEW_SESSION') {
        return (
          <div className="h-full">
            <InterviewWorkspace sessionId={doc.id} projectId={currentProjectId || undefined} />
          </div>
        );
      }

      if (doc?.subType === 'TEMPLATE') {
        // Template detail view (keeping existing complex template editing logic)
        const template = templates.find((x: any) => x.id === doc.id);
        const questions = templateQuestionsById[doc.id] || [];
        const isLoading = !!templateQuestionsLoading[doc.id];
        const isEditing = !!templateEditMode[doc.id];
        const tplDraft = templateEditDraft[doc.id] || {};

        // Load questions if not loaded
        if (!questions.length && !isLoading && !templateQuestionsById[doc.id]) {
          setTemplateQuestionsLoading((prev) => ({ ...prev, [doc.id]: true }));
          Api.get(`/interview/templates/${doc.id}/questions`)
            .then((res) => {
              setTemplateQuestionsById((prev) => ({ ...prev, [doc.id]: Array.isArray(res) ? res : [] }));
            })
            .catch(() => {})
            .finally(() => {
              setTemplateQuestionsLoading((prev) => ({ ...prev, [doc.id]: false }));
            });
        }

        return (
          <div className="p-6 max-w-4xl mx-auto">
            <div className="bg-navy-900 border border-navy-700 rounded-xl p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <FileText size={24} className="text-blue-400" />
                </div>
                <div className="flex-1">
                  <h1 className="text-xl font-semibold text-white mb-2">{template?.name || doc.name}</h1>
                  <p className="text-slate-400 text-sm mb-3">{template?.description || ''}</p>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-navy-700 text-slate-300 text-xs rounded-full">
                      {questions.length || template?.questionCount || 0} questions
                    </span>
                    <span className="text-xs text-slate-500">{String(template?.category || '').toUpperCase()}</span>
                    <button
                      onClick={() => isEditing ? exitTemplateEditMode(doc.id) : enterTemplateEditMode(doc.id)}
                      className="ml-auto px-3 py-1.5 bg-navy-800 hover:bg-navy-700 border border-navy-600 text-white rounded-lg text-xs font-medium"
                    >
                      {isEditing ? 'Stop editing' : 'Edit template'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="border-t border-navy-700 pt-6">
                <h2 className="text-sm font-semibold text-white mb-3">Questions</h2>
                {isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-400">
                    <Clock size={14} className="opacity-80" />
                    Loading questions...
                  </div>
                ) : questions.length > 0 ? (
                  <ul className="space-y-2">
                    {questions.map((q: any, i: number) => (
                      <li key={q.id} className="flex items-start gap-3 p-3 bg-navy-950/40 rounded-lg">
                        <span className="text-xs text-slate-500 w-6">{i + 1}.</span>
                        <span className="text-sm text-slate-300 flex-1">{q.questionText}</span>
                        <span className="text-xs text-slate-500">{q.category}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">No questions in template</p>
                )}
              </div>
            </div>
          </div>
        );
      }

      if (doc?.subType === 'INSIGHT') {
        const insight = insights.find((x: any) => x.id === doc.id);
        return (
          <InsightDetailView
            insightId={doc.id}
            insight={insight}
            onRefresh={loadInsights}
          />
        );
      }

      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <p>Document view not available</p>
        </div>
      );
    }

    // Grid view
    if (viewMode === 'grid') {
      return (
        <GridView
          items={gridItems}
          onItemClick={handleOpenDocument}
          onItemAction={handleRowAction}
        />
      );
    }

    // Table view
    return (
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-sm text-slate-400 px-4">
            <Clock size={14} className="animate-spin" />
            Loading...
          </div>
        )}
        <FilterableTable
          columns={currentColumns}
          data={currentData}
          onRowClick={handleOpenDocument}
          onRowAction={handleRowAction}
          activeFilters={activeFilters}
          onFilterChange={setActiveFilters}
          emptyMessage={
            activeTab === 'list'
              ? t('interview.empty.sessions', 'No completed interviews yet.')
              : activeTab === 'assignments'
                ? t('interview.empty.assignments', 'No assignments found. Create one to get started.')
                : activeTab === 'initiatives'
                  ? t('interview.empty.templates', 'No templates available.')
                  : t('interview.empty.insights', 'No insights generated yet.')
          }
        />
      </div>
    );
  };

  // ==========================================
  // MAIN RENDER
  // ==========================================

  return (
    <>
      <ModuleHub
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
        onNewItem={actionButton.handler}
        newItemLabel={actionButton.label}
      >
        {renderContent()}
      </ModuleHub>

      {/* Add Assignment Modal */}
      {showAddAssignmentModal && (
        <AddAssignmentModal
          isOpen={showAddAssignmentModal}
          onClose={() => setShowAddAssignmentModal(false)}
          onCreated={() => {
            setShowAddAssignmentModal(false);
            void loadAssignments();
          }}
          templates={templates}
        />
      )}

      {/* Add Insight Modal */}
      {showAddInsightModal && (
        <AddInsightModal
          isOpen={showAddInsightModal}
          onClose={() => setShowAddInsightModal(false)}
          onCreated={() => {
            setShowAddInsightModal(false);
            void loadInsights();
          }}
          completedSessions={completedSessions}
        />
      )}
    </>
  );
};

// ==========================================
// ADD ASSIGNMENT MODAL (inline for now)
// ==========================================

interface AddAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  templates: any[];
}

const AddAssignmentModal: React.FC<AddAssignmentModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  templates,
}) => {
  const { t } = useTranslation('discovery');
  const { currentUser } = useAppStore();
  
  const [users, setUsers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    templateId: '',
    assigneeIds: [] as string[],
    dueAt: '',
    priority: 'medium',
    escalateTo: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  // Load users
  useEffect(() => {
    if (isOpen) {
      Api.get('/users')
        .then((res) => setUsers(Array.isArray(res) ? res : []))
        .catch(() => setUsers([]));
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.templateId || formData.assigneeIds.length === 0 || !formData.dueAt) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await Api.post('/interview/assignments', {
        templateId: formData.templateId,
        assigneeUserIds: formData.assigneeIds,
        dueAt: formData.dueAt,
        priority: formData.priority,
        escalateTo: formData.escalateTo || currentUser?.id,
        notes: formData.notes,
      });
      toast.success('Assignment created successfully');
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create assignment');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-navy-900 border border-navy-700 rounded-xl shadow-2xl">
          <div className="px-6 py-4 border-b border-navy-700">
            <h2 className="text-white font-semibold text-lg">
              {t('interview.addAssignment', 'Add Assignment')}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Assign an interview template to team members
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Template */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Template *
              </label>
              <select
                value={formData.templateId}
                onChange={(e) => setFormData({ ...formData, templateId: e.target.value })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm"
                required
              >
                <option value="">Select template...</option>
                {templates.filter(t => t.status === 'approved').map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                ))}
              </select>
            </div>

            {/* Assignees */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Assignee(s) *
              </label>
              <select
                multiple
                value={formData.assigneeIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, o => o.value);
                  setFormData({ ...formData, assigneeIds: selected });
                }}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm min-h-[100px]"
                required
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            {/* Due Date */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Due Date *
              </label>
              <input
                type="date"
                value={formData.dueAt}
                onChange={(e) => setFormData({ ...formData, dueAt: e.target.value })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm"
                required
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>

            {/* Escalate To */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Escalate To (if overdue)
              </label>
              <select
                value={formData.escalateTo}
                onChange={(e) => setFormData({ ...formData, escalateTo: e.target.value })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm"
              >
                <option value="">Me (default)</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Notes / Instructions
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm"
                placeholder="Optional instructions for the assignee..."
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-navy-800 hover:bg-navy-700 border border-navy-600 text-white rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Creating...' : 'Create Assignment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

// ==========================================
// ADD INSIGHT MODAL (inline for now)
// ==========================================

interface AddInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
  completedSessions: CompletedSession[];
}

const AddInsightModal: React.FC<AddInsightModalProps> = ({
  isOpen,
  onClose,
  onCreated,
  completedSessions,
}) => {
  const { t } = useTranslation('discovery');
  
  const [formData, setFormData] = useState({
    title: '',
    sessionIds: [] as string[],
    promptType: 'summary' as 'summary' | 'trends' | 'problems' | 'recommendations',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || formData.sessionIds.length === 0) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      await Api.post('/interview/insights', {
        title: formData.title,
        sessionIds: formData.sessionIds,
        promptType: formData.promptType,
      });
      toast.success('Insight generation started');
      onCreated();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create insight');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-navy-900 border border-navy-700 rounded-xl shadow-2xl">
          <div className="px-6 py-4 border-b border-navy-700">
            <h2 className="text-white font-semibold text-lg">
              {t('interview.addInsight', 'Generate Insight')}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              AI will analyze selected sessions and generate insights
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm"
                placeholder="e.g., Q4 Digital Transformation Summary"
                required
              />
            </div>

            {/* Sessions to analyze */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Sessions to Analyze *
              </label>
              <select
                multiple
                value={formData.sessionIds}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, o => o.value);
                  setFormData({ ...formData, sessionIds: selected });
                }}
                className="w-full px-3 py-2 bg-navy-800 border border-navy-600 rounded-lg text-white text-sm min-h-[150px]"
                required
              >
                {completedSessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name || session.templateName} - {session.respondentName || 'Unknown'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
            </div>

            {/* Prompt Type */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Analysis Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: 'summary', label: 'Summary', desc: 'General overview' },
                  { value: 'trends', label: 'Trends', desc: 'Patterns & trends' },
                  { value: 'problems', label: 'Problems', desc: 'Issues & pain points' },
                  { value: 'recommendations', label: 'Recommendations', desc: 'Action items' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, promptType: opt.value as any })}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      formData.promptType === opt.value
                        ? 'border-primary-500 bg-primary-500/10'
                        : 'border-navy-600 bg-navy-800 hover:bg-navy-700'
                    }`}
                  >
                    <div className="text-sm font-medium text-white">{opt.label}</div>
                    <div className="text-xs text-slate-400">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-navy-800 hover:bg-navy-700 border border-navy-600 text-white rounded-lg text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {submitting ? 'Generating...' : 'Generate Insight'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default InterviewHub;
