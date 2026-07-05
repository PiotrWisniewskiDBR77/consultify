/**
 * ProjectIntelligenceView
 *
 * Module: Project Intelligence Hub
 * AI-powered knowledge capture and organization for projects.
 *
 * Features:
 * - AI Interview mode for structured knowledge gathering
 * - Auto-detection of project insights from conversations
 * - PMO-aligned knowledge categories (Objectives, Stakeholders, Risks, etc.)
 * - Knowledge base with confirmed insights
 * - Session history tracking
 */

import {
  AlertTriangle,
  Award,
  Brain,
  CheckCircle,
  ChevronRight,
  Database,
  Download,
  Eye,
  FolderOpen,
  History,
  Info,
  Lightbulb,
  Link,
  Loader2,
  Lock,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Target,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { LoadingState } from '@/components/ui/primitives';
import { useDemoSession } from '@/hooks/useDemoSession';
import { sendMessageToAI } from '@/services/ai/gemini';
import { INSIGHT_DETECTION_PROMPT, INTERVIEW_SYSTEM_PROMPT } from '@/services/ai/intelligence';
import { Api } from '@/services/api';

import {
  CATEGORY_CONFIG,
  CategoryIcon,
  getCategoryLabel,
  type InsightCategory,
} from '../components/Intelligence/CategoryIcon';
import { InsightDetectionCard } from '../components/Intelligence/InsightDetectionCard';
import { InterviewProgress } from '../components/Intelligence/InterviewProgress';
import { SplitLayout } from '../components/layout/SplitLayout';
import { useAppStore } from '../store/useAppStore';
import { Project } from '../types';

// Types
interface ProjectInsight {
  id: string;
  project_id: string;
  session_id?: string;
  category: InsightCategory;
  title: string;
  content: Record<string, unknown>;
  source?: { type: string; text: string };
  confidence: 'high' | 'medium' | 'low';
  status: 'draft' | 'confirmed' | 'archived';
  related_insights?: string[];
  pmo_domain?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

interface InterviewSession {
  id: string;
  project_id: string;
  user_id: string;
  topic: string;
  status: 'active' | 'completed' | 'paused';
  progress: {
    completed: InsightCategory[];
    current: InsightCategory | null;
    remaining: InsightCategory[];
  };
  started_at: string;
  completed_at?: string;
  duration_minutes?: number;
}

type TabType = 'interview' | 'knowledge' | 'sessions';

const CATEGORY_ORDER: InsightCategory[] = [
  'objective',
  'stakeholder',
  'risk',
  'assumption',
  'constraint',
  'decision',
  'dependency',
  'success_criteria',
];

const normalizeInsightCategory = (raw: string | undefined): InsightCategory | null => {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, '_');
  if (CATEGORY_ORDER.includes(normalized as InsightCategory)) {
    return normalized as InsightCategory;
  }
  if (normalized === 'successcriteria' || normalized === 'success-criteria') {
    return 'success_criteria';
  }
  return null;
};

const parseDetectionJson = (raw: string): unknown[] => {
  const cleaned = raw
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const ProjectIntelligenceView: React.FC = () => {
  const { currentProjectId, isChatCollapsed, toggleChatCollapse, activeChatMessages } =
    useAppStore();
  const { isDemo } = useDemoSession();
  const [activeTab, setActiveTab] = useState<TabType>('interview');
  const [insights, setInsights] = useState<ProjectInsight[]>([]);
  const [sessions, setSessions] = useState<InterviewSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<InsightCategory | 'all'>('all');
  const [selectedInsight, setSelectedInsight] = useState<ProjectInsight | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isSessionInitializing, setIsSessionInitializing] = useState(false);

  const lastProcessedMessageIdRef = useRef<string | null>(null);
  const extractionInProgressRef = useRef(false);

  // Get current project name
  const currentProject = projects?.find((p) => p.id === currentProjectId);

  // Load projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await Api.getProjects();
        setProjects(Array.isArray(data) ? data : (data as any).projects || []);
      } catch (e) {
        console.error('Failed to load projects:', e);
      }
    };
    fetchProjects();
  }, []);

  // Expand chat panel on mount if collapsed
  useEffect(() => {
    if (isChatCollapsed) {
      toggleChatCollapse();
    }
  }, []);

  // Fetch data when project changes
  const fetchData = useCallback(async () => {
    if (!currentProjectId) return;

    setIsLoading(true);
    try {
      const [insightsRes, sessionsRes] = await Promise.all([
        Api.get(`/intelligence/projects/${currentProjectId}/insights`),
        Api.get(`/intelligence/projects/${currentProjectId}/sessions`),
      ]);
      const resolvedInsights = insightsRes || [];
      const resolvedSessions = sessionsRes || [];
      setInsights(resolvedInsights);
      setSessions(resolvedSessions);

      const activeSession =
        resolvedSessions.find((session: InterviewSession) => session.status === 'active') ||
        resolvedSessions[0] ||
        null;
      setActiveSessionId(activeSession?.id || null);
    } catch (error) {
      console.error('[ProjectIntelligence] Error fetching data:', error);
      // Don't show error toast if no data yet
    } finally {
      setIsLoading(false);
    }
  }, [currentProjectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const createInterviewSession = useCallback(async () => {
    if (!currentProjectId || isSessionInitializing) return;
    setIsSessionInitializing(true);
    try {
      const response = await Api.post(`/intelligence/projects/${currentProjectId}/sessions`, {
        topic: currentProject?.name || 'Project Interview',
      });
      if (response?.id) {
        const newSession = response as InterviewSession;
        setSessions((prev) => [newSession, ...prev]);
        setActiveSessionId(newSession.id);
      }
    } catch (error) {
      console.error('[ProjectIntelligence] Failed to create session:', error);
    } finally {
      setIsSessionInitializing(false);
    }
  }, [currentProjectId, currentProject?.name, isSessionInitializing]);

  useEffect(() => {
    if (!currentProjectId) return;
    if (activeSessionId) return;
    if (sessions.length > 0) {
      const fallback = sessions.find((session) => session.status === 'active') || sessions[0];
      setActiveSessionId(fallback?.id || null);
      return;
    }
    createInterviewSession();
  }, [currentProjectId, sessions, activeSessionId, createInterviewSession]);

  const extractInsightsFromConversation = useCallback(
    async (conversation: string, sourceText: string) => {
      if (!currentProjectId || !activeSessionId) return;

      const response = await sendMessageToAI([], conversation, INSIGHT_DETECTION_PROMPT);
      const detections = parseDetectionJson(response);
      if (!detections.length) return;

      const existingKeys = new Set(
        insights.map((insight) => `${insight.category}:${insight.title}`.toLowerCase())
      );
      let createdCount = 0;

      for (const detection of detections.slice(0, 6)) {
        const category = normalizeInsightCategory((detection as any)?.category);
        if (!category) continue;

        const title = String((detection as any)?.title || '').trim();
        if (!title) continue;

        const key = `${category}:${title}`.toLowerCase();
        if (existingKeys.has(key)) continue;

        const content = (detection as any)?.content;
        const normalizedContent =
          content && typeof content === 'object'
            ? content
            : { description: String(content || (detection as any)?.description || '') };
        const confidenceRaw = String((detection as any)?.confidence || 'medium').toLowerCase();
        const confidence =
          confidenceRaw === 'high' || confidenceRaw === 'low' ? confidenceRaw : 'medium';
        const detectedSource =
          (detection as any)?.sourceQuote || (detection as any)?.source || sourceText;

        await Api.post('/intelligence/insights', {
          projectId: currentProjectId,
          sessionId: activeSessionId,
          category,
          title,
          content: normalizedContent,
          confidence,
          source: { type: 'chat', text: detectedSource },
          status: 'draft',
        });

        existingKeys.add(key);
        createdCount += 1;
      }

      if (createdCount > 0) {
        fetchData();
      }
    },
    [activeSessionId, currentProjectId, fetchData, insights]
  );

  useEffect(() => {
    if (!currentProjectId || !activeSessionId) return;
    if (extractionInProgressRef.current) return;

    const lastAiMessage = [...activeChatMessages]
      .reverse()
      .find((message) => message.role === 'ai' && message.content?.trim());
    if (!lastAiMessage) return;

    if (lastAiMessage.id === lastProcessedMessageIdRef.current) return;

    extractionInProgressRef.current = true;
    const conversation = activeChatMessages
      .slice(-12)
      .map((message) => `${message.role === 'user' ? 'USER' : 'AI'}: ${message.content}`)
      .join('\n');

    extractInsightsFromConversation(conversation, lastAiMessage.content)
      .catch((error) => {
        console.error('[ProjectIntelligence] Insight extraction failed:', error);
      })
      .finally(() => {
        extractionInProgressRef.current = false;
        lastProcessedMessageIdRef.current = lastAiMessage.id;
      });
  }, [activeChatMessages, activeSessionId, currentProjectId, extractInsightsFromConversation]);

  // Seed demo data
  const handleSeedDemoData = async () => {
    if (!currentProjectId) {
      toast.error('Please select a project first');
      return;
    }

    setIsSeeding(true);
    try {
      await Api.post(`/intelligence/projects/${currentProjectId}/seed`, {});
      toast.success('Demo data created successfully');
      fetchData();
    } catch (error) {
      console.error('[ProjectIntelligence] Seed error:', error);
      toast.error('Failed to seed demo data');
    } finally {
      setIsSeeding(false);
    }
  };

  // Confirm an insight
  const handleConfirmInsight = async (insight: ProjectInsight) => {
    try {
      await Api.patch(`/intelligence/insights/${insight.id}`, { status: 'confirmed' });
      setInsights((prev) =>
        prev.map((i) => (i.id === insight.id ? { ...i, status: 'confirmed' } : i))
      );
      toast.success('Insight confirmed');
    } catch (error) {
      toast.error('Failed to confirm insight');
    }
  };

  // Delete an insight
  const handleDeleteInsight = async (insightId: string) => {
    try {
      await Api.delete(`/intelligence/insights/${insightId}`);
      setInsights((prev) => prev.filter((i) => i.id !== insightId));
      toast.success('Insight deleted');
    } catch (error) {
      toast.error('Failed to delete insight');
    }
  };

  // Filter insights by category
  const filteredInsights =
    selectedCategory === 'all' ? insights : insights.filter((i) => i.category === selectedCategory);

  // Group insights by category for stats
  const insightStats = CATEGORY_ORDER.reduce(
    (acc, cat) => {
      acc[cat] = insights.filter((i) => i.category === cat).length;
      return acc;
    },
    {} as Record<InsightCategory, number>
  );

  // No project selected state
  if (!currentProjectId) {
    return (
      <SplitLayout
        title={
          <div className="flex items-center gap-2">
            <Brain className="text-primary-600 dark:text-primary-400" size={20} />
            <span className="text-primary-600 dark:text-primary-400">Project Intelligence</span>
          </div>
        }
        subtitle="AI-powered knowledge capture"
        chatSystemPrompt={INTERVIEW_SYSTEM_PROMPT}
      >
        <div className="h-full flex flex-col items-center justify-center bg-c-surface-raised p-8">
          <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6">
            <FolderOpen className="w-10 h-10 text-primary-500" />
          </div>
          <h2 className="text-xl font-bold text-navy-900 dark:text-white mb-2">Select a Project</h2>
          <p className="text-c-text-muted text-center max-w-md mb-6">
            Choose a project from the sidebar to start capturing project intelligence. The AI will
            help you organize knowledge about objectives, stakeholders, risks, and more.
          </p>
          <div className="flex items-center gap-2 text-sm text-c-text-secondary">
            <Info size={14} />
            <span>Use the project selector in the header</span>
          </div>
        </div>
      </SplitLayout>
    );
  }

  return (
    <SplitLayout
      title={
        <div className="flex items-center gap-2">
          <Brain className="text-primary-600 dark:text-primary-400" size={20} />
          <span className="text-primary-600 dark:text-primary-400">Project Intelligence</span>
        </div>
      }
      subtitle={currentProject?.name || 'AI-powered knowledge capture'}
      chatSystemPrompt={INTERVIEW_SYSTEM_PROMPT}
    >
      <div className="h-full flex flex-col bg-c-surface-raised">
        {/* Header */}
        <div className="shrink-0 px-6 py-4 bg-c-surface border-b border-c-border-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-navy-900 dark:text-white flex items-center gap-3">
                <Brain className="text-primary-500" size={28} />
                Project Intelligence Hub
              </h1>
              <p className="text-sm text-c-text-muted mt-1">
                AI-powered knowledge capture for {currentProject?.name || 'your project'}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isDemo && insights.length === 0 && (
                <button
                  onClick={handleSeedDemoData}
                  disabled={isSeeding}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-lg hover:bg-primary-200 dark:hover:bg-primary-900/50 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {isSeeding ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Sparkles size={16} />
                  )}
                  Load Demo Data
                </button>
              )}
              <button
                onClick={fetchData}
                className="p-2 text-c-text-secondary hover:text-c-text-secondary dark:hover:text-slate-200 hover:bg-c-surface-raised dark:hover:bg-c-surface/10 rounded-lg transition-colors"
              >
                <RefreshCw size={18} />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-c-surface-raised/40 dark:bg-navy-950 rounded-lg p-1 w-fit">
            <button
              onClick={() => setActiveTab('interview')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'interview'
                  ? 'bg-c-surface text-navy-900 dark:text-white shadow-sm'
                  : 'text-c-text-secondary hover:text-c-text dark:hover:text-white'
              }`}
            >
              <MessageSquare size={16} />
              Interview
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'knowledge'
                  ? 'bg-c-surface text-navy-900 dark:text-white shadow-sm'
                  : 'text-c-text-secondary hover:text-c-text dark:hover:text-white'
              }`}
            >
              <Database size={16} />
              Knowledge Base
              {insights.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 rounded-full">
                  {insights.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'sessions'
                  ? 'bg-c-surface text-navy-900 dark:text-white shadow-sm'
                  : 'text-c-text-secondary hover:text-c-text dark:hover:text-white'
              }`}
            >
              <History size={16} />
              Sessions
              {sessions.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-slate-200 text-c-text-secondary dark:bg-slate-700 dark:text-c-text-muted rounded-full">
                  {sessions.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {isLoading ? (
            <LoadingState variant="spinner" className="h-64" />
          ) : activeTab === 'interview' ? (
            <InterviewTabContent projectId={currentProjectId} onInsightCreated={fetchData} />
          ) : activeTab === 'knowledge' ? (
            <KnowledgeTabContent
              insights={filteredInsights}
              stats={insightStats}
              selectedCategory={selectedCategory}
              onCategorySelect={setSelectedCategory}
              onConfirmInsight={handleConfirmInsight}
              onDeleteInsight={handleDeleteInsight}
              selectedInsight={selectedInsight}
              onSelectInsight={setSelectedInsight}
            />
          ) : (
            <SessionsTabContent
              sessions={sessions}
              onSessionSelect={(session) => console.log('Session selected:', session)}
            />
          )}
        </div>
      </div>
    </SplitLayout>
  );
};

// Interview Tab Content
interface InterviewTabContentProps {
  projectId: string;
  onInsightCreated: () => void;
}

const InterviewTabContent: React.FC<InterviewTabContentProps> = ({
  projectId,
  onInsightCreated,
}) => {
  return (
    <div className="space-y-6">
      {/* Instructions Card */}
      <div className="bg-gradient-to-br from-primary-50 to-crimson-50 dark:from-primary-900/20 dark:to-crimson-900/20 rounded-xl p-6 border border-primary-200/50 dark:border-primary-800/30">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/50 rounded-xl shrink-0">
            <MessageSquare className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h3 className="font-semibold text-navy-900 dark:text-white text-lg mb-2">
              Start an AI Interview
            </h3>
            <p className="text-c-text-secondary text-sm mb-4">
              Use the chat panel on the left to have a conversation with the AI. As you discuss your
              project, the AI will automatically detect and extract key insights like objectives,
              risks, stakeholders, and decisions.
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_ORDER.slice(0, 4).map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const IconComponent = config.icon;
                return (
                  <span
                    key={cat}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}
                  >
                    <IconComponent size={12} />
                    {config.label}
                  </span>
                );
              })}
              <span className="text-xs text-c-text-secondary py-1">
                +4 more categories
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Category Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {CATEGORY_ORDER.map((category) => {
          const config = CATEGORY_CONFIG[category];
          const IconComponent = config.icon;
          return (
            <div
              key={category}
              className="bg-c-surface rounded-xl border border-c-border-subtle p-4 hover:shadow-md transition-shadow"
            >
              <div
                className={`w-10 h-10 rounded-lg ${config.bgColor} flex items-center justify-center mb-3`}
              >
                <IconComponent size={20} className={config.color} />
              </div>
              <h4 className="font-medium text-navy-900 dark:text-white text-sm">{config.label}</h4>
              <p className="text-xs text-c-text-muted mt-1 line-clamp-2">
                {getCategoryDescription(category)}
              </p>
            </div>
          );
        })}
      </div>

      {/* PMO Alignment Note */}
      <div className="bg-c-surface-raised/50 rounded-xl p-4 flex items-start gap-3">
        <Info size={18} className="text-c-text-secondary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-c-text-secondary">
            All captured insights are aligned with <strong>ISO 21500</strong>,{' '}
            <strong>PMBOK 7</strong>, and <strong>PRINCE2</strong> standards for full PMO compliance
            and auditability.
          </p>
        </div>
      </div>
    </div>
  );
};

// Knowledge Tab Content
interface KnowledgeTabContentProps {
  insights: ProjectInsight[];
  stats: Record<InsightCategory, number>;
  selectedCategory: InsightCategory | 'all';
  onCategorySelect: (cat: InsightCategory | 'all') => void;
  onConfirmInsight: (insight: ProjectInsight) => void;
  onDeleteInsight: (id: string) => void;
  selectedInsight: ProjectInsight | null;
  onSelectInsight: (insight: ProjectInsight | null) => void;
}

const KnowledgeTabContent: React.FC<KnowledgeTabContentProps> = ({
  insights,
  stats,
  selectedCategory,
  onCategorySelect,
  onConfirmInsight,
  onDeleteInsight,
  selectedInsight,
  onSelectInsight,
}) => {
  if (insights.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 rounded-full bg-c-surface-raised/40 dark:bg-navy-800 flex items-center justify-center mb-4">
          <Database className="w-8 h-8 text-c-text-secondary" />
        </div>
        <p className="text-lg font-medium text-c-text-secondary mb-1">
          No insights captured yet
        </p>
        <p className="text-sm text-c-text-muted max-w-md">
          Start a conversation with the AI to capture project knowledge. Insights will appear here
          as they are detected.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Category Filter Sidebar */}
      <div className="lg:col-span-1">
        <div className="bg-c-surface rounded-xl border border-c-border-subtle p-4">
          <h3 className="font-semibold text-navy-900 dark:text-white mb-4">Categories</h3>

          <button
            onClick={() => onCategorySelect('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg mb-2 transition-colors ${
              selectedCategory === 'all'
                ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                : 'hover:bg-c-bg dark:hover:bg-c-surface/5 text-c-text-secondary'
            }`}
          >
            <span className="text-sm font-medium">All Insights</span>
            <span className="text-xs bg-c-surface-raised/40 dark:bg-slate-800 px-2 py-0.5 rounded-full">
              {insights.length}
            </span>
          </button>

          <div className="space-y-1">
            {CATEGORY_ORDER.map((cat) => {
              const config = CATEGORY_CONFIG[cat];
              const IconComponent = config.icon;
              const count = stats[cat];

              return (
                <button
                  key={cat}
                  onClick={() => onCategorySelect(cat)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === cat
                      ? `${config.bgColor} ${config.color}`
                      : 'hover:bg-c-bg dark:hover:bg-c-surface/5 text-c-text-secondary'
                  }`}
                >
                  <IconComponent size={16} />
                  <span className="text-sm font-medium flex-1 text-left">{config.label}</span>
                  {count > 0 && (
                    <span className="text-xs bg-c-surface/50 dark:bg-black/20 px-2 py-0.5 rounded-full">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Insights List */}
      <div className="lg:col-span-2 space-y-4">
        {insights.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            isSelected={selectedInsight?.id === insight.id}
            onSelect={() => onSelectInsight(insight)}
            onConfirm={() => onConfirmInsight(insight)}
            onDelete={() => onDeleteInsight(insight.id)}
          />
        ))}
      </div>
    </div>
  );
};

// Insight Card Component
interface InsightCardProps {
  insight: ProjectInsight;
  isSelected: boolean;
  onSelect: () => void;
  onConfirm: () => void;
  onDelete: () => void;
}

const InsightCard: React.FC<InsightCardProps> = ({
  insight,
  isSelected,
  onSelect,
  onConfirm,
  onDelete,
}) => {
  const config = CATEGORY_CONFIG[insight.category];

  return (
    <div
      className={`bg-c-surface rounded-xl border ${
        isSelected
          ? 'border-primary-300 dark:border-primary-700 ring-1 ring-primary-200 dark:ring-primary-800'
          : 'border-c-border-subtle'
      } p-4 hover:shadow-md transition-all cursor-pointer`}
      onClick={onSelect}
    >
      <div className="flex items-start gap-4">
        <CategoryIcon category={insight.category} size={18} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-c-text-muted uppercase tracking-wide">
              {getCategoryLabel(insight.category)}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                insight.status === 'confirmed'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
              }`}
            >
              {String(insight.status)}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full ${
                insight.confidence === 'high'
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : insight.confidence === 'medium'
                    ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'bg-c-bg text-c-text-muted dark:bg-slate-800 dark:text-c-text-muted'
              }`}
            >
              {String(insight.confidence)} confidence
            </span>
          </div>

          <h4 className="font-semibold text-navy-900 dark:text-white mb-2">{insight.title}</h4>

          {(insight.content as any).description && (
            <p className="text-sm text-c-text-secondary line-clamp-2">
              {String((insight.content as any).description || '')}
            </p>
          )}

          {insight.pmo_domain && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-c-text-secondary">
              <Target size={12} />
              <span>PMO: {insight.pmo_domain.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {insight.status === 'draft' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onConfirm();
              }}
              className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors"
              title="Confirm insight"
            >
              <CheckCircle size={18} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1.5 text-c-text-secondary hover:text-danger-500 hover:bg-danger-50 dark:hover:bg-danger-900/20 rounded-lg transition-colors"
            title="Delete insight"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

// Sessions Tab Content
interface SessionsTabContentProps {
  sessions: InterviewSession[];
  onSessionSelect: (session: InterviewSession) => void;
}

const SessionsTabContent: React.FC<SessionsTabContentProps> = ({ sessions, onSessionSelect }) => {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <div className="w-16 h-16 rounded-full bg-c-surface-raised/40 dark:bg-navy-800 flex items-center justify-center mb-4">
          <History className="w-8 h-8 text-c-text-secondary" />
        </div>
        <p className="text-lg font-medium text-c-text-secondary mb-1">
          No interview sessions yet
        </p>
        <p className="text-sm text-c-text-muted max-w-md">
          Your AI interview sessions will appear here. Start a conversation to create your first
          session.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((session) => (
        <div
          key={session.id}
          onClick={() => onSessionSelect(session)}
          className="bg-c-surface rounded-xl border border-c-border-subtle p-4 hover:shadow-md transition-all cursor-pointer"
        >
          <div className="flex items-start justify-between">
            <div>
              <h4 className="font-semibold text-navy-900 dark:text-white">{session.topic}</h4>
              <p className="text-sm text-c-text-muted mt-1">
                Started {new Date(session.started_at).toLocaleDateString()}
              </p>
            </div>
            <span
              className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                session.status === 'completed'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : session.status === 'active'
                    ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400'
                    : 'bg-c-surface-raised text-c-text-secondary dark:bg-slate-800 dark:text-c-text-muted'
              }`}
            >
              {session.status}
            </span>
          </div>

          {/* Progress */}
          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-2 bg-c-surface-raised/40 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-emerald-500 rounded-full"
                style={{
                  width: `${(session.progress.completed.length / 8) * 100}%`,
                }}
              />
            </div>
            <span className="text-xs text-c-text-muted">
              {session.progress.completed.length}/8 topics
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

// Helper function for category descriptions
function getCategoryDescription(category: InsightCategory): string {
  const descriptions: Record<InsightCategory, string> = {
    objective: 'Project goals, targets, and measurable outcomes',
    stakeholder: 'Key people, their roles, influence, and interests',
    risk: 'Potential threats, uncertainties, and mitigation strategies',
    assumption: 'Things taken for granted that need validation',
    constraint: 'Fixed boundaries, limitations, and requirements',
    decision: 'Key choices made and their rationale',
    dependency: 'Internal and external dependencies',
    success_criteria: 'How success will be measured and validated',
  };
  return descriptions[category];
}

export default ProjectIntelligenceView;
