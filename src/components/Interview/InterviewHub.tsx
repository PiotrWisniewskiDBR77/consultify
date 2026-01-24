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
  Brain,
  Calendar,
  ChevronRight,
  FileText,
  Grid3X3,
  Lightbulb,
  List,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { Api } from '@/services/api';
import { useAppStore } from '@/store/useAppStore';

import { InterviewWorkspace } from './InterviewWorkspace';

// Types
interface InterviewSession {
  id: string;
  organizationId: string;
  projectId?: string;
  name: string;
  ownerId: string;
  status: 'active' | 'completed' | 'archived';
  totalQuestions: number;
  answeredQuestions: number;
  startedAt: string;
  completedAt?: string;
  lastActivityAt?: string;
}

interface InterviewInsight {
  id: string;
  sessionId: string;
  title: string;
  content: string;
  type: 'pain_point' | 'opportunity' | 'recommendation';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
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

type ModuleTab = 'sessions' | 'insights' | 'templates';
type ViewMode = 'table' | 'grid';
type ItemStatus = 'draft' | 'in_review' | 'approved' | 'completed' | 'active' | 'archived';

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
};

// Status filter config
interface StatusFilter {
  id: string;
  label: string;
  color: string;
  count?: number;
}

export const InterviewHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const [searchParams] = useSearchParams();
  const { currentProjectId, currentOrganization } = useAppStore();

  // Get session ID from URL if provided
  const sessionIdFromUrl = searchParams.get('sessionId');

  // State
  const [activeTab, setActiveTab] = useState<ModuleTab>('sessions');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [activeStatusFilter, setActiveStatusFilter] = useState<string | null>(null);

  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [insights, setInsights] = useState<InterviewInsight[]>([]);
  const [templates, setTemplates] = useState<InterviewTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Template questions cache (for read-only preview)
  const [templateQuestionsById, setTemplateQuestionsById] = useState<Record<string, any[]>>({});
  const [templateQuestionsLoading, setTemplateQuestionsLoading] = useState<Record<string, boolean>>({});

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

  // Open session from URL
  useEffect(() => {
    if (sessionIdFromUrl && sessions.length > 0) {
      const session = sessions.find(s => s.id === sessionIdFromUrl);
      if (session) {
        handleOpenDocument({
          id: session.id,
          type: 'session',
          name: session.name || 'Interview Session',
          status: session.status,
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

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          new Date(s.startedAt).toLocaleDateString().includes(query)
      );
    }

    if (activeStatusFilter && activeStatusFilter !== 'all') {
      result = result.filter((s) => s.status === activeStatusFilter);
    }

    return result;
  }, [sessions, searchQuery, activeStatusFilter]);

  // Filter insights
  const filteredInsights = useMemo(() => {
    if (!searchQuery) return insights;
    const query = searchQuery.toLowerCase();
    return insights.filter(
      (i) => i.title.toLowerCase().includes(query) || i.content.toLowerCase().includes(query)
    );
  }, [insights, searchQuery]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    if (!searchQuery) return templates;
    const query = searchQuery.toLowerCase();
    return templates.filter(
      (t) => t.name.toLowerCase().includes(query) || t.description.toLowerCase().includes(query)
    );
  }, [templates, searchQuery]);

  // Status counts
  const statusCounts = useMemo(() => {
    return {
      all: sessions.length,
      active: sessions.filter((s) => s.status === 'active').length,
      completed: sessions.filter((s) => s.status === 'completed').length,
      archived: sessions.filter((s) => s.status === 'archived').length,
    };
  }, [sessions]);

  // Status filters
  const statusFilters: StatusFilter[] = useMemo(
    () => [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', color: 'bg-slate-400', count: statusCounts.all },
      { id: 'active', label: isPolish ? 'Aktywne' : 'Active', color: 'bg-purple-400', count: statusCounts.active },
      { id: 'completed', label: isPolish ? 'Zakończone' : 'Completed', color: 'bg-emerald-400', count: statusCounts.completed },
    ],
    [isPolish, statusCounts]
  );

  // Tab configuration
  const tabs = useMemo(
    () => [
      {
        id: 'sessions' as ModuleTab,
        label: isPolish ? 'Sesje' : 'Sessions',
        icon: <MessageSquare size={16} />,
        count: sessions.length,
      },
      {
        id: 'insights' as ModuleTab,
        label: isPolish ? 'Wnioski' : 'Insights',
        icon: <Lightbulb size={16} />,
        count: insights.length,
      },
      {
        id: 'templates' as ModuleTab,
        label: isPolish ? 'Szablony' : 'Templates',
        icon: <FileText size={16} />,
        count: templates.length,
      },
    ],
    [isPolish, sessions.length, insights.length, templates.length]
  );

  // Handlers
  const handleNewSession = useCallback(async () => {
    try {
      const newSession = await Api.post('/interview/sessions', {
        projectId: currentProjectId,
        name: `Interview ${new Date().toLocaleDateString()}`,
      });

      setSessions((prev) => [newSession as InterviewSession, ...prev]);
      
      // Open the new session
      handleOpenDocument({
        id: (newSession as InterviewSession).id,
        type: 'session',
        name: (newSession as InterviewSession).name || 'Interview Session',
        status: 'active',
        data: newSession as InterviewSession,
      });
      
      toast.success(isPolish ? 'Nowa sesja wywiadu rozpoczęta!' : 'New interview session started!');
    } catch (error) {
      console.error('[InterviewHub] Failed to create session:', error);
      toast.error(isPolish ? 'Nie udało się utworzyć sesji' : 'Failed to create session');
    }
  }, [currentProjectId, isPolish]);

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

  const handleViewSession = useCallback((session: InterviewSession) => {
    handleOpenDocument({
      id: session.id,
      type: 'session',
      name: session.name || 'Interview Session',
      status: session.status,
      data: session,
    });
  }, [handleOpenDocument]);

  const handleViewInsight = useCallback((insight: InterviewInsight) => {
    handleOpenDocument({
      id: insight.id,
      type: 'insight',
      name: insight.title,
      status: 'completed',
      data: insight,
    });
  }, [handleOpenDocument]);

  const handleViewTemplate = useCallback((template: InterviewTemplate) => {
    handleOpenDocument({
      id: template.id,
      type: 'template',
      name: template.name,
      status: 'approved',
      data: template,
    });
  }, [handleOpenDocument]);

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

  // Render Dynamic Tabs
  const renderDynamicTabs = () => {
    if (openDocuments.length === 0) return null;

    const isListActive = activeDocumentId === null;

    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-navy-900/50 border-b border-navy-700">
        {/* List button */}
        <button
          onClick={handleShowList}
          className={isListActive ? TAB_ACTIVE.replace('border-l-2', '') : TAB_INACTIVE.replace('border-l-2', '')}
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

            return (
              <tr
                key={session.id}
                onClick={() => handleViewSession(session)}
                className="group hover:bg-navy-800/50 cursor-pointer transition-colors border-b border-navy-700/50 last:border-0"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        session.status === 'completed'
                          ? 'bg-emerald-500/20'
                          : session.status === 'active'
                            ? 'bg-purple-500/20'
                            : 'bg-slate-500/20'
                      }`}
                    >
                      <Brain
                        size={16}
                        className={
                          session.status === 'completed'
                            ? 'text-emerald-400'
                            : session.status === 'active'
                              ? 'text-purple-400'
                              : 'text-slate-400'
                        }
                      />
                    </div>
                    <span className="text-sm text-white font-medium">{session.name || 'Discovery Interview'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${
                      session.status === 'completed'
                        ? 'bg-emerald-500/20'
                        : session.status === 'active'
                          ? 'bg-purple-500/20'
                          : 'bg-slate-500/20'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        session.status === 'completed'
                          ? 'bg-emerald-400'
                          : session.status === 'active'
                            ? 'bg-purple-400'
                            : 'bg-slate-400'
                      }`}
                    />
                    <span
                      className={`text-xs font-medium ${
                        session.status === 'completed'
                          ? 'text-emerald-300'
                          : session.status === 'active'
                            ? 'text-purple-300'
                            : 'text-slate-300'
                      }`}
                    >
                      {session.status === 'completed'
                        ? isPolish
                          ? 'Zakończony'
                          : 'Completed'
                        : session.status === 'active'
                          ? isPolish
                            ? 'W trakcie'
                            : 'In Progress'
                          : session.status}
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
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
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
            : session.status === 'active'
              ? 'from-purple-500/20 to-purple-600/10 border-purple-500/30'
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
                        : session.status === 'active'
                          ? 'text-purple-400'
                          : 'text-slate-400'
                    }
                  />
                  <span className="font-mono text-xs font-bold text-slate-300">
                    {session.status === 'completed' ? 'DONE' : session.status === 'active' ? 'LIVE' : 'ARCH'}
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
                    : session.status === 'active'
                      ? 'bg-purple-500/20'
                      : 'bg-slate-500/20'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    session.status === 'completed'
                      ? 'bg-emerald-400'
                      : session.status === 'active'
                        ? 'bg-purple-400'
                        : 'bg-slate-400'
                  }`}
                />
                <span
                  className={`text-xs font-medium ${
                    session.status === 'completed'
                      ? 'text-emerald-300'
                      : session.status === 'active'
                        ? 'text-purple-300'
                        : 'text-slate-300'
                  }`}
                >
                  {session.status === 'completed'
                    ? isPolish
                      ? 'Zakończony'
                      : 'Completed'
                    : session.status === 'active'
                      ? isPolish
                        ? 'W trakcie'
                        : 'Active'
                      : session.status}
                </span>
              </div>
              <span className="text-xs text-slate-500">{new Date(session.startedAt).toLocaleDateString()}</span>
            </div>
          </div>
        );
      })}
    </div>
  );

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
              {isPolish ? 'Priorytet' : 'Priority'}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
              {isPolish ? 'Data' : 'Date'}
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredInsights.map((insight) => (
            <tr
              key={insight.id}
              onClick={() => handleViewInsight(insight)}
              className="group hover:bg-navy-800/50 cursor-pointer transition-colors border-b border-navy-700/50 last:border-0"
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Lightbulb size={16} className="text-amber-400" />
                  <span className="text-sm text-white font-medium">{insight.title}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-slate-400 capitalize">{insight.type.replace('_', ' ')}</span>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-medium ${
                  insight.priority === 'high' ? 'text-red-400' :
                  insight.priority === 'medium' ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {insight.priority}
                </span>
              </td>
              <td className="px-4 py-3 text-xs text-slate-400">
                {new Date(insight.createdAt).toLocaleDateString()}
              </td>
            </tr>
          ))}
          {filteredInsights.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center">
                  <Lightbulb className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-slate-400 text-sm">
                    {isPolish ? 'Brak wniosków' : 'No insights yet'}
                  </p>
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
              {isPolish ? 'Domyślny' : 'Default'}
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
                  <FileText size={16} className="text-blue-400" />
                  <div>
                    <span className="text-sm text-white font-medium block">{template.name}</span>
                    <span className="text-xs text-slate-500">{template.description}</span>
                  </div>
                </div>
              </td>
              <td className="px-4 py-3 text-xs text-slate-400">{template.category}</td>
              <td className="px-4 py-3 text-xs text-slate-400">{template.questionCount}</td>
              <td className="px-4 py-3">
                {template.isDefault && (
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                    {isPolish ? 'Domyślny' : 'Default'}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {filteredTemplates.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-12 text-center">
                <div className="flex flex-col items-center">
                  <FileText className="w-12 h-12 text-slate-600 mb-3" />
                  <p className="text-slate-400 text-sm">
                    {isPolish ? 'Brak szablonów' : 'No templates yet'}
                  </p>
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
        <div className="p-6 max-w-4xl mx-auto">
          <div className="bg-navy-900 border border-navy-700 rounded-xl p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                <Lightbulb size={24} className="text-amber-400" />
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-semibold text-white mb-2">{insight.title}</h1>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    insight.priority === 'high' ? 'bg-red-500/20 text-red-400' :
                    insight.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-500/20 text-slate-400'
                  }`}>
                    {insight.priority} priority
                  </span>
                  <span className="text-xs text-slate-500 capitalize">{insight.type.replace('_', ' ')}</span>
                </div>
              </div>
            </div>
            <div className="prose prose-invert max-w-none">
              <p className="text-slate-300">{insight.content}</p>
            </div>
          </div>
        </div>
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
                        <div key={cat} className="bg-navy-950/40 border border-navy-700 rounded-lg p-4">
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
                      isPolish ? 'Tworzenie sesji z szablonu...' : 'Creating session from template...'
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
                    toast.error(isPolish ? 'Nie udało się utworzyć sesji' : 'Failed to create session');
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

  // Render list content based on active tab
  const renderListContent = () => {
    if (isLoading) {
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
      return <div className="p-4">{renderInsightsTable()}</div>;
    }

    if (activeTab === 'templates') {
      return <div className="p-4">{renderTemplatesTable()}</div>;
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
              {tabs.map((tab) => {
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
                    {tab.count !== undefined && (
                      <span
                        className={`px-1.5 py-0.5 text-xs rounded-full ${
                          isActive ? 'bg-primary-500/30 text-primary-300' : 'bg-navy-700 text-slate-400'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Status Filters (only for sessions tab when showing list) */}
            {activeTab === 'sessions' && !activeDocumentId && (
              <>
                <div className="w-px h-6 bg-navy-600" />
                <div className="flex items-center gap-1.5">
                  {statusFilters.map((filter) => {
                    const isActive =
                      activeStatusFilter === filter.id || (filter.id === 'all' && !activeStatusFilter);
                    return (
                      <button
                        key={filter.id}
                        onClick={() => setActiveStatusFilter(filter.id === 'all' ? null : filter.id)}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 ${
                          isActive
                            ? 'bg-primary-500/15 border-primary-500 text-primary-400'
                            : 'bg-navy-800/50 border-navy-600 text-slate-400 hover:text-white hover:border-slate-500'
                        }`}
                      >
                        <span className={`w-2 h-2 rounded-full ${filter.color}`} />
                        <span>{filter.label}</span>
                        {filter.count !== undefined && <span className="text-slate-500">{filter.count}</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Right: View Toggle + New Session Button */}
          <div className="flex items-center gap-3">
            {/* View Mode Toggle (only for sessions tab when showing list) */}
            {activeTab === 'sessions' && !activeDocumentId && (
              <div className="flex items-center bg-navy-950 border border-navy-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'table'
                      ? 'bg-navy-700 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-navy-800/50'
                  }`}
                  title="Table"
                >
                  <List size={16} />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-1.5 rounded transition-colors ${
                    viewMode === 'grid'
                      ? 'bg-navy-700 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-navy-800/50'
                  }`}
                  title="Grid"
                >
                  <Grid3X3 size={16} />
                </button>
              </div>
            )}

            {/* New Session Button */}
            <button
              onClick={handleNewSession}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-primary-500 to-primary-600 text-white border border-primary-400/30 hover:from-primary-400 hover:to-primary-500 shadow-lg shadow-primary-500/25 transition-all duration-200"
            >
              <Plus size={16} />
              <span>{isPolish ? 'Nowa sesja' : 'New Session'}</span>
            </button>
          </div>
        </div>

        {/* Search Bar (expandable) */}
        {showSearch && (
          <div className="px-4 pb-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder={
                  activeTab === 'sessions'
                    ? isPolish ? 'Szukaj sesji...' : 'Search sessions...'
                    : activeTab === 'insights'
                      ? isPolish ? 'Szukaj wniosków...' : 'Search insights...'
                      : isPolish ? 'Szukaj szablonów...' : 'Search templates...'
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
    </div>
  );
};

export default InterviewHub;
