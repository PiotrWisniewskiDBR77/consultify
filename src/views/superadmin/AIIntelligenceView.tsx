/**
 * AI Intelligence View
 *
 * SuperAdmin interface for the Harvard-level Co-Thinker AI system.
 * Includes prompt management, block builder, test bench, and AI assistant.
 */

import {
  AlertTriangle,
  BarChart3,
  Beaker,
  Blocks,
  BookOpen,
  Brain,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Globe,
  GraduationCap,
  Languages,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Target,
  TestTube,
  TrendingUp,
  Wand2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';

import { DegradedState, ReadOnlyState } from '../../components/Admin/AdminState';
import { PromptAssistantPanel } from '../../components/Admin/PromptAssistantPanel';
import { PromptBlockBuilder } from '../../components/Admin/PromptBlockBuilder';
import { PromptTestBench } from '../../components/Admin/PromptTestBench';
import { InfoButton } from '../../components/shared/InfoButton';
import { Api } from '../../services/api';
import { normalizeApiErrorMessage } from '../../utils/apiError';

type AIIntelligenceTab = 'overview' | 'prompts' | 'blocks' | 'testing' | 'assistant' | 'learning';

interface SystemStats {
  totalPrompts: number;
  activeBlocks: number;
  feedbackItems: number;
  avgRating: number;
  languagesCovered: number;
}

export const AIIntelligenceView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AIIntelligenceTab>('overview');
  const [loading, setLoading] = useState(true);
  const [statsLoadError, setStatsLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<SystemStats>({
    totalPrompts: 0,
    activeBlocks: 0,
    feedbackItems: 0,
    avgRating: 0,
    languagesCovered: 6,
  });

  const loadStats = async () => {
    setLoading(true);
    setStatsLoadError(null);
    try {
      const data = await Api.getPromptAssistantStats();
      if (data) setStats(data);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load AI stats');
      setStatsLoadError(message);
      setStats({
        totalPrompts: 0,
        activeBlocks: 0,
        feedbackItems: 0,
        avgRating: 0,
        languagesCovered: 0,
      });
      toast.error(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadStats();
  }, []);

  const tabs = [
    { id: 'overview' as AIIntelligenceTab, label: 'Overview', icon: Brain },
    { id: 'prompts' as AIIntelligenceTab, label: 'Prompt Templates', icon: FileText },
    { id: 'blocks' as AIIntelligenceTab, label: 'Block Builder', icon: Blocks },
    { id: 'testing' as AIIntelligenceTab, label: 'Test Bench', icon: Beaker },
    { id: 'assistant' as AIIntelligenceTab, label: 'Prompt Assistant', icon: MessageSquare },
    { id: 'learning' as AIIntelligenceTab, label: 'Learning System', icon: GraduationCap },
  ];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-navy-950 text-slate-900 dark:text-white overflow-hidden relative">
      <InfoButton cardId="superadmin-ai-intelligence" position="top-right" />

      {/* Header */}
      <div className="shrink-0 px-8 py-6 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-crimson-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Brain className="text-c-text" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">AI Intelligence</h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Harvard-level Co-Thinker System Configuration
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-xs font-medium flex items-center gap-1">
              <GraduationCap size={12} />
              Harvard Level
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-8 py-3 border-b border-slate-200 dark:border-white/5 flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white shadow-lg shadow-primary-500/20'
                : 'text-slate-700 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-navy-800/20'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="p-8 overflow-y-auto h-full">
            {/* Stats Grid */}
            {statsLoadError ? (
              <div className="mb-8">
                <DegradedState
                  title="AI intelligence stats unavailable"
                  description={statsLoadError}
                />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
                <StatCard
                  icon={FileText}
                  label="Prompt Templates"
                  value={loading ? '...' : stats.totalPrompts.toString()}
                  color="text-blue-400"
                />
                <StatCard
                  icon={Blocks}
                  label="Active Blocks"
                  value={loading ? '...' : stats.activeBlocks.toString()}
                  color="text-primary-400"
                />
                <StatCard
                  icon={Languages}
                  label="Languages"
                  value={loading ? '...' : stats.languagesCovered.toString()}
                  color="text-emerald-400"
                />
                <StatCard
                  icon={MessageSquare}
                  label="Feedback Items"
                  value={loading ? '...' : stats.feedbackItems.toString()}
                  color="text-amber-400"
                />
                <StatCard
                  icon={Sparkles}
                  label="Avg Rating"
                  value={loading ? '...' : stats.avgRating.toFixed(1)}
                  color="text-pink-400"
                />
              </div>
            )}

            {/* Core Capabilities */}
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
                Core Capabilities
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <CapabilityCard
                  icon={Brain}
                  title="Strategic Consultant Persona"
                  description="Harvard MBA/PhD level reasoning with 20+ years experience"
                  status="active"
                />
                <CapabilityCard
                  icon={Globe}
                  title="Language-Independent Prompts"
                  description="Semantic instructions that work across all languages"
                  status="active"
                />
                <CapabilityCard
                  icon={BookOpen}
                  title="Deep Knowledge Integration"
                  description="RAG with organization context, knowledge base, and web research"
                  status="active"
                />
                <CapabilityCard
                  icon={Wand2}
                  title="Action Execution"
                  description="AI can navigate, fill forms, and execute operations"
                  status="active"
                />
                <CapabilityCard
                  icon={Lightbulb}
                  title="Socratic Questioning"
                  description="Intelligent probing questions to drive clarity"
                  status="active"
                />
                <CapabilityCard
                  icon={GraduationCap}
                  title="Continuous Learning"
                  description="Pattern extraction and personalization from interactions"
                  status="active"
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <QuickAction
                  icon={FileText}
                  label="Create Template"
                  onClick={() => setActiveTab('prompts')}
                />
                <QuickAction
                  icon={Blocks}
                  label="Build Prompt Block"
                  onClick={() => setActiveTab('blocks')}
                />
                <QuickAction
                  icon={Beaker}
                  label="Test in Multi-Language"
                  onClick={() => setActiveTab('testing')}
                />
                <QuickAction
                  icon={MessageSquare}
                  label="Chat with Assistant"
                  onClick={() => setActiveTab('assistant')}
                />
              </div>
            </div>
          </div>
        )}

        {/* Prompts Tab */}
        {activeTab === 'prompts' && (
          <div className="p-8 overflow-y-auto h-full">
            <PromptTemplateManager />
          </div>
        )}

        {/* Blocks Tab */}
        {activeTab === 'blocks' && (
          <div className="h-full overflow-hidden">
            <PromptBlockBuilder selectedBlocks={[]} onBlocksChange={() => {}} />
          </div>
        )}

        {/* Testing Tab */}
        {activeTab === 'testing' && (
          <div className="h-full overflow-hidden">
            <PromptTestBench />
          </div>
        )}

        {/* Assistant Tab */}
        {activeTab === 'assistant' && (
          <div className="h-full overflow-hidden">
            <PromptAssistantPanel />
          </div>
        )}

        {/* Learning Tab */}
        {activeTab === 'learning' && (
          <div className="p-8 overflow-y-auto h-full">
            <LearningSystemDashboard />
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper Components
// ─────────────────────────────────────────────────────────────────────────────

const StatCard: React.FC<{ icon: any; label: string; value: string; color: string }> = ({
  icon: Icon,
  label,
  value,
  color,
}) => (
  <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4">
    <div className="flex items-center gap-3 mb-2">
      <Icon size={18} className={color} />
      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
        {label}
      </span>
    </div>
    <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
  </div>
);

const CapabilityCard: React.FC<{
  icon: any;
  title: string;
  description: string;
  status: 'active' | 'beta' | 'coming';
}> = ({ icon: Icon, title, description, status }) => (
  <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 hover:border-primary-500/30 transition-colors">
    <div className="flex items-start gap-4">
      <div className="p-2 rounded-lg bg-primary-500/20 shrink-0">
        <Icon size={20} className="text-primary-400" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="text-slate-900 dark:text-white font-medium">{title}</h4>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] ${
              status === 'active'
                ? 'bg-emerald-500/20 text-emerald-400'
                : status === 'beta'
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
            }`}
          >
            {status === 'active' ? 'Active' : status === 'beta' ? 'Beta' : 'Coming'}
          </span>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
      </div>
    </div>
  </div>
);

const QuickAction: React.FC<{ icon: any; label: string; onClick: () => void }> = ({
  icon: Icon,
  label,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 p-4 bg-white dark:bg-navy-950/50 border border-slate-200 dark:border-white/5 rounded-lg hover:bg-slate-50 dark:hover:bg-navy-950 hover:border-primary-500/30 transition-all group"
  >
    <Icon size={18} className="text-primary-400 group-hover:text-primary-300" />
    <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white">
      {label}
    </span>
    <ChevronRight
      size={14}
      className="ml-auto text-slate-600 dark:text-slate-400 group-hover:text-slate-400"
    />
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// Prompt Template Manager Sub-component
// ─────────────────────────────────────────────────────────────────────────────

const PromptTemplateManager: React.FC = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadTemplates = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await Api.getPromptAssistantTemplates();
      setTemplates((data as any)?.templates || []);
    } catch (err: unknown) {
      const message = normalizeApiErrorMessage(err, 'Failed to load templates');
      setLoadError(message);
      setTemplates([]);
      toast.error(message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const filteredTemplates = templates.filter(
    (t) =>
      t.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayTemplates = filteredTemplates;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Prompt Templates</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Language-independent templates for AI capabilities
          </p>
        </div>
        <div className="flex gap-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search templates..."
              disabled={!!loadError}
              className="w-64 bg-white dark:bg-navy-950 border border-slate-200 dark:border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>
          <button
            disabled
            title="Template creation is managed through the canonical Prompts Library workflow."
            className="flex items-center gap-2 px-4 py-2 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            <FileText size={16} />
            New Template
          </button>
        </div>
      </div>

      <ReadOnlyState
        title="Prompt template mutations use Prompts Library"
        description="This builder view is read-only for templates until create/edit/test actions are wired to the canonical prompt registry workflow."
      />

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-slate-500 dark:text-slate-400">
            Loading templates...
          </div>
        ) : loadError ? (
          <div className="col-span-2">
            <DegradedState title="Prompt templates unavailable" description={loadError} />
          </div>
        ) : displayTemplates.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-slate-500 dark:text-slate-400">
            No templates found
          </div>
        ) : (
          displayTemplates.map((template, idx) => (
            <div
              key={template.code || idx}
              className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 hover:border-primary-500/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="text-slate-900 dark:text-white font-medium">{template.name}</h4>
                  <code className="text-xs text-primary-400">{template.code}</code>
                </div>
                <span className="px-2 py-1 bg-slate-100 dark:bg-navy-950 text-slate-700 dark:text-slate-300 rounded text-xs capitalize">
                  {template.category}
                </span>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                {template.description}
              </p>
              <div className="flex gap-2">
                <button
                  disabled
                  title="Edit this prompt in Prompts Library."
                  className="flex-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-navy-950 dark:hover:bg-navy-800 text-slate-800 dark:text-slate-300 rounded text-xs disabled:opacity-50"
                >
                  Edit
                </button>
                <button
                  disabled
                  title="Template testing is unavailable here until it is wired to the canonical prompt registry."
                  className="flex-1 px-3 py-1.5 bg-primary-600/20 hover:bg-primary-600/30 text-primary-300 rounded text-xs disabled:opacity-50"
                >
                  Test
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Learning System Dashboard Sub-component (Enhanced with Analytics)
// ─────────────────────────────────────────────────────────────────────────────

interface LearningMetrics {
  totalInteractions: number;
  successRate: number;
  avgQualityScore: number;
  avgResponseTime: number;
  patternsLearned: number;
  activeModels: number;
}

interface QualityTrend {
  date: string;
  score: number;
}

const LearningSystemDashboard: React.FC = () => {
  const [patterns, setPatterns] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [metrics, setMetrics] = useState<LearningMetrics>({
    totalInteractions: 0,
    successRate: 0,
    avgQualityScore: 0,
    avgResponseTime: 0,
    patternsLearned: 0,
    activeModels: 0,
  });
  const [qualityTrends, setQualityTrends] = useState<QualityTrend[]>([]);

  // Removed generateMockTrends - using real API data only

  const loadLearningData = async () => {
    setLoading(true);
    try {
      const [patternsData, interactionsData, metricsData] = await Promise.all([
        Api.getAiLearningPatterns(),
        Api.getAiLearningInteractions({ limit: 10, range: timeRange }),
        Api.getAiLearningMetrics(timeRange),
      ]);

      const nextPatterns = (patternsData as any)?.patterns || [];
      setPatterns(nextPatterns);
      setInteractions((interactionsData as any)?.interactions || []);
      setMetrics((metricsData as any)?.metrics || metrics);
      setQualityTrends((metricsData as any)?.qualityTrends || []);
    } catch (err) {
      console.error('Failed to load learning data:', err);
      // Set empty state on error instead of mock data
      setQualityTrends([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLearningData();
  }, [timeRange]);

  const handleExport = () => {
    const data = {
      exportDate: new Date().toISOString(),
      timeRange,
      metrics,
      patterns,
      interactions,
      qualityTrends,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Learning analytics exported');
  };

  const maxScore = Math.max(...qualityTrends.map((t) => t.score), 1);

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Learning Analytics</h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            AI learning patterns, quality metrics, and performance trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Time Range Selector */}
          <div className="flex bg-slate-100 dark:bg-navy-800 rounded-lg p-1">
            {(['7d', '30d', '90d'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-primary-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-navy-700/50'
                }`}
              >
                {range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : '90 Days'}
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            <Download size={14} />
            Export
          </button>
          <button
            onClick={loadLearningData}
            className="flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-navy-800 dark:hover:bg-navy-700 text-slate-800 dark:text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <MetricCard
          icon={BarChart3}
          label="Total Interactions"
          value={metrics.totalInteractions.toLocaleString()}
          color="text-blue-400"
        />
        <MetricCard
          icon={Target}
          label="Success Rate"
          value={`${metrics.successRate.toFixed(1)}%`}
          color="text-emerald-400"
        />
        <MetricCard
          icon={TrendingUp}
          label="Avg Quality"
          value={`${(metrics.avgQualityScore * 100).toFixed(0)}%`}
          color="text-primary-400"
        />
        <MetricCard
          icon={Clock}
          label="Avg Response"
          value={`${metrics.avgResponseTime.toFixed(1)}s`}
          color="text-amber-400"
        />
        <MetricCard
          icon={Lightbulb}
          label="Patterns"
          value={metrics.patternsLearned.toString()}
          color="text-pink-400"
        />
        <MetricCard
          icon={Brain}
          label="Active Models"
          value={metrics.activeModels.toString()}
          color="text-blue-400"
        />
      </div>

      {/* Quality Score Trend Chart */}
      <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <TrendingUp size={18} className="text-primary-400" />
          Quality Score Trend
        </h3>
        {loading ? (
          <div className="h-40 flex items-center justify-center text-slate-500 dark:text-slate-400">
            Loading chart...
          </div>
        ) : (
          <div className="h-40 flex items-end gap-1">
            {qualityTrends.slice(-30).map((trend, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1 group">
                <div
                  className="w-full bg-gradient-to-t from-primary-600 to-primary-400 rounded-t transition-all group-hover:from-primary-500 group-hover:to-primary-300"
                  style={{ height: `${(trend.score / maxScore) * 100}%`, minHeight: '4px' }}
                  title={`${trend.date}: ${(trend.score * 100).toFixed(1)}%`}
                />
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-between mt-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{qualityTrends[0]?.date || ''}</span>
          <span>{qualityTrends[qualityTrends.length - 1]?.date || ''}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Learned Patterns */}
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Lightbulb size={18} className="text-amber-400" />
            Learned Patterns
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400 font-normal">
              {patterns.length} patterns
            </span>
          </h3>
          {loading ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              Loading patterns...
            </p>
          ) : patterns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-600 dark:text-slate-500">No patterns learned yet</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Patterns are extracted from user interactions over time
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {patterns.map((pattern, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-navy-950/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900 dark:text-white truncate">
                      {pattern.type}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {pattern.description}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm text-emerald-400">
                      {(pattern.confidence * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">confidence</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Interactions */}
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-400" />
            Recent Interactions
            <span className="ml-auto text-xs text-slate-500 dark:text-slate-400 font-normal">
              {interactions.length} recent
            </span>
          </h3>
          {loading ? (
            <p className="text-slate-500 dark:text-slate-400 text-center py-8">
              Loading interactions...
            </p>
          ) : interactions.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-500 text-center py-8">
              No interactions recorded
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {interactions.map((interaction, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-navy-950/50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-slate-900 dark:text-white truncate">
                      {interaction.input?.substring(0, 50)}...
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(interaction.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {interaction.success ? (
                      <Check size={14} className="text-emerald-400" />
                    ) : (
                      <AlertTriangle size={14} className="text-amber-400" />
                    )}
                    <span
                      className={`text-xs ${interaction.success ? 'text-emerald-400' : 'text-amber-400'}`}
                    >
                      {interaction.success ? 'Success' : 'Flagged'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Metric Card Component for Learning Analytics
const MetricCard: React.FC<{ icon: any; label: string; value: string; color: string }> = ({
  icon: Icon,
  label,
  value,
  color,
}) => (
  <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-2">
      <Icon size={16} className={color} />
      <span className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
        {label}
      </span>
    </div>
    <div className="text-xl font-bold text-slate-900 dark:text-white">{value}</div>
  </div>
);

export default AIIntelligenceView;
