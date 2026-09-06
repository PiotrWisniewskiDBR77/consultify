/**
 * ResearchProgress Component (v2.0)
 *
 * Displays real-time progress for deep research mode with:
 * - Query execution status with round indicators (initial / follow-up)
 * - Activity panel showing real-time research actions
 * - Source aggregation with domain favicons and relevance scores
 * - Deepening stage visualization (iterative deepening)
 *
 * FLOW-AI-RESEARCH: Research progress visualization
 */

import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileSearch,
  Globe,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  XCircle,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

// ==========================================
// TYPES
// ==========================================

export interface ResearchQuery {
  id: string;
  query: string;
  purpose: string;
  status: 'pending' | 'searching' | 'done' | 'error';
  /** 'initial' for first round, 'followup' for iterative deepening */
  round?: 'initial' | 'followup';
  results?: SearchResult[];
  error?: string;
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  relevanceScore: number;
  source: string;
}

export interface Source {
  url: string;
  title: string;
  domain: string;
  relevanceScore: number;
}

interface ResearchProgressProps {
  topic: string;
  stage:
    | 'generating_queries'
    | 'queries_ready'
    | 'searching'
    | 'deepening'
    | 'aggregating'
    | 'synthesizing'
    | 'complete';
  queries: ResearchQuery[];
  sources?: Source[];
  /** Current research round (1 or 2) */
  round?: number;
  /** Total research rounds */
  totalRounds?: number;
  /** Detected research type */
  researchType?: string;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

// ==========================================
// COMPONENTS
// ==========================================

/**
 * Individual query status item
 */
const QueryItem: React.FC<{ query: ResearchQuery; index: number }> = ({ query, index }) => {
  const { t } = useTranslation();
  const [showResults, setShowResults] = useState(false);

  const statusIcon = {
    pending: (
      <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
    ),
    searching: <Loader2 size={16} className="animate-spin text-c-text-secondary" />,
    done: <CheckCircle2 size={16} className="text-green-500" />,
    error: <XCircle size={16} className="text-danger-500" />,
  };

  const isFollowUp = query.round === 'followup';

  return (
    <div className="py-2 border-b border-slate-200 dark:border-navy-700 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">{statusIcon[query.status]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Q{index + 1}
            </span>
            {isFollowUp && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-secondary font-medium">
                {t('research.followUp', 'Follow-up')}
              </span>
            )}
            <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
              {query.query}
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">{query.purpose}</p>

          {query.status === 'done' && query.results && query.results.length > 0 && (
            <button
              onClick={() => setShowResults(!showResults)}
              className="flex items-center gap-1 mt-1 text-xs text-c-text-secondary dark:text-c-text-secondary hover:underline"
            >
              {query.results.length} {t('research.sources', 'sources')}
              {showResults ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}

          {showResults && query.results && (
            <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-200 dark:border-navy-600">
              {query.results.slice(0, 5).map((result, i) => (
                <a
                  key={i}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1.5 text-xs hover:bg-slate-50 dark:hover:bg-navy-800 p-1 rounded group"
                >
                  <ExternalLink
                    size={10}
                    className="flex-shrink-0 mt-0.5 text-slate-600 group-hover:text-c-text"
                  />
                  <div className="min-w-0">
                    <p className="text-slate-600 dark:text-slate-300 truncate">{result.title}</p>
                    <p className="text-slate-600 text-[10px]">{result.source}</p>
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-slate-600">
                    {Math.round(result.relevanceScore * 100)}%
                  </span>
                </a>
              ))}
            </div>
          )}

          {query.status === 'error' && query.error && (
            <p className="text-xs text-danger-500 mt-1">{query.error}</p>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Source list item with domain favicon
 */
const SourceItem: React.FC<{ source: Source; index: number }> = ({ source, index }) => (
  <a
    href={source.url}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-navy-800 rounded-lg group"
  >
    <span className="w-5 h-5 flex items-center justify-center text-xs font-medium bg-slate-100 dark:bg-navy-700 rounded text-slate-500">
      {index + 1}
    </span>
    <img
      src={`https://www.google.com/s2/favicons?domain=${source.domain}&sz=16`}
      alt=""
      className="w-4 h-4 flex-shrink-0"
      onError={(e) => {
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
    <div className="flex-1 min-w-0">
      <p className="text-sm text-slate-700 dark:text-slate-200 truncate group-hover:text-c-text">
        {source.title}
      </p>
      <p className="text-xs text-slate-600 dark:text-slate-500">{source.domain}</p>
    </div>
    <div className="flex items-center gap-1">
      <div
        className="w-12 h-1.5 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden"
        title={`${Math.round(source.relevanceScore * 100)}% relevance`}
      >
        <div
          className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full"
          style={{ width: `${source.relevanceScore * 100}%` }}
        />
      </div>
      <ExternalLink size={12} className="text-slate-600 group-hover:text-c-text" />
    </div>
  </a>
);

/**
 * Activity log item for real-time research tracking
 */
const ActivityItem: React.FC<{
  icon: React.ReactNode;
  text: string;
  detail?: string;
  isActive?: boolean;
}> = ({ icon, text, detail, isActive }) => (
  <div className="flex items-start gap-2 py-1.5">
    <div className={`flex-shrink-0 mt-0.5 ${isActive ? 'animate-pulse' : ''}`}>{icon}</div>
    <div className="min-w-0">
      <p className="text-xs text-slate-600 dark:text-slate-300">{text}</p>
      {detail && (
        <p className="text-[10px] text-slate-600 dark:text-slate-500 truncate">{detail}</p>
      )}
    </div>
  </div>
);

/**
 * Main research progress component (v2.0)
 */
export const ResearchProgress: React.FC<ResearchProgressProps> = ({
  topic,
  stage,
  queries,
  sources = [],
  round,
  totalRounds,
  researchType,
  className = '',
  isExpanded: controlledExpanded,
  onToggleExpand,
}) => {
  const { t } = useTranslation();
  const [internalExpanded, setInternalExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'queries' | 'activity' | 'sources'>('activity');

  const isExpanded = controlledExpanded ?? internalExpanded;
  const toggleExpand = onToggleExpand ?? (() => setInternalExpanded(!internalExpanded));

  const completedQueries = queries.filter((q) => q.status === 'done').length;
  const totalQueries = queries.length;
  const progress = totalQueries > 0 ? (completedQueries / totalQueries) * 100 : 0;

  const initialQueries = queries.filter((q) => !q.round || q.round === 'initial');
  const followUpQueries = queries.filter((q) => q.round === 'followup');

  const stageLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    generating_queries: {
      label: t('research.generatingQueries', 'Generating research queries...'),
      icon: <Sparkles size={16} className="animate-pulse" />,
    },
    queries_ready: {
      label: t('research.queriesReady', 'Research queries ready'),
      icon: <FileSearch size={16} />,
    },
    searching: {
      label:
        round && round > 1
          ? t('research.searchingRound', {
              round,
              totalRounds,
              defaultValue: 'Searching (round {{round}}/{{totalRounds}})...',
            })
          : t('research.searching', 'Searching sources...'),
      icon: <Search size={16} className="animate-pulse" />,
    },
    deepening: {
      label: t('research.deepening', 'Deepening research with follow-up queries...'),
      icon: <RefreshCw size={16} className="animate-spin" />,
    },
    aggregating: {
      label: t('research.aggregating', 'Aggregating results...'),
      icon: <BookOpen size={16} className="animate-pulse" />,
    },
    synthesizing: {
      label: t('research.synthesizing', 'Synthesizing findings...'),
      icon: <Sparkles size={16} className="animate-pulse" />,
    },
    complete: {
      label: t('research.complete', 'Research complete'),
      icon: <CheckCircle2 size={16} className="text-green-500" />,
    },
  };

  const currentStage = stageLabels[stage] || stageLabels.searching;

  // Build activity log from queries
  const activityItems: Array<{
    icon: React.ReactNode;
    text: string;
    detail?: string;
    isActive: boolean;
  }> = [];

  // Add searching activities
  for (const q of queries) {
    if (q.status === 'searching') {
      activityItems.push({
        icon: <Search size={12} className="text-c-text-secondary" />,
        text: `Searching: "${q.query}"`,
        isActive: true,
      });
    } else if (q.status === 'done' && q.results) {
      const domains = [...new Set(q.results.map((r) => r.source))];
      activityItems.push({
        icon: <CheckCircle2 size={12} className="text-green-500" />,
        text: `Found ${q.results.length} results`,
        detail: domains.slice(0, 3).join(', ') + (domains.length > 3 ? '...' : ''),
        isActive: false,
      });
    }
  }

  // Add deepening activity
  if (stage === 'deepening') {
    activityItems.push({
      icon: <RefreshCw size={12} className="text-c-text-secondary animate-spin" />,
      text: t('research.generatingFollowUp', 'Analyzing gaps and generating follow-up queries...'),
      isActive: true,
    });
  }

  // Add synthesis activity
  if (stage === 'synthesizing') {
    activityItems.push({
      icon: <Sparkles size={12} className="text-amber-500 animate-pulse" />,
      text: t('research.synthesizingReport', 'Synthesizing comprehensive report...'),
      detail: researchType ? `Type: ${researchType.replace(/_/g, ' ')}` : undefined,
      isActive: true,
    });
  }

  return (
    <div
      className={`bg-gradient-to-br from-slate-50 to-c-surface-raised dark:from-navy-800 dark:to-c-surface-raised rounded-xl border border-slate-200 dark:border-navy-700 ${className}`}
    >
      {/* Header */}
      <button
        onClick={toggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/50 dark:hover:bg-navy-700/50 transition-colors"
      >
        <div className="p-2 bg-c-surface-raised dark:bg-c-surface-raised rounded-lg text-c-text-secondary dark:text-c-text-secondary">
          <Search size={18} />
        </div>

        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('research.deepResearch', 'Deep Research')}
            </h4>
            {researchType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-secondary font-medium capitalize">
                {researchType.replace(/_/g, ' ')}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              {currentStage.icon}
              {currentStage.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{topic}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Source counter */}
          {sources.length > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-full">
              <Globe size={12} className="text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                {sources.length} {t('research.sources', 'sources')}
              </span>
            </div>
          )}

          {/* Round indicator */}
          {round && totalRounds && totalRounds > 1 && (
            <div className="flex items-center gap-1 px-2 py-1 bg-c-surface-raised dark:bg-c-surface-raised rounded-full">
              <Zap size={12} className="text-c-text-secondary dark:text-c-text-secondary" />
              <span className="text-xs font-medium text-c-text-secondary dark:text-c-text-secondary">
                {t('research.round', {
                  round,
                  totalRounds,
                  defaultValue: 'Round {{round}}/{{totalRounds}}',
                })}
              </span>
            </div>
          )}

          <div className="text-right">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {completedQueries}/{totalQueries}
            </span>
            <p className="text-xs text-slate-600">{t('research.queries', 'queries')}</p>
          </div>
          <div className="w-20 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-c-surface-raised to-c-surface-raised rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded content with tabs */}
      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-navy-700">
          {/* Tab bar */}
          <div className="flex border-b border-slate-200 dark:border-navy-700">
            {(['activity', 'queries', 'sources'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-c-text-secondary dark:text-c-text-secondary border-b-2 border-c-border'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {tab === 'activity' && t('research.activity', 'Activity')}
                {tab === 'queries' && `${t('research.queries', 'Queries')} (${totalQueries})`}
                {tab === 'sources' && `${t('research.topSources', 'Sources')} (${sources.length})`}
              </button>
            ))}
          </div>

          {/* Activity tab */}
          {activeTab === 'activity' && (
            <div className="p-4 max-h-64 overflow-y-auto">
              {activityItems.length === 0 ? (
                <p className="text-xs text-slate-600 text-center py-4">
                  {t('research.waitingForActivity', 'Starting research...')}
                </p>
              ) : (
                <div className="space-y-0.5">
                  {activityItems.map((item, i) => (
                    <ActivityItem key={i} {...item} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Queries tab */}
          {activeTab === 'queries' && (
            <div className="p-4">
              {initialQueries.length > 0 && (
                <>
                  <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t('research.initialQueries', 'Initial Queries')} ({initialQueries.length})
                  </h5>
                  <div className="max-h-48 overflow-y-auto">
                    {initialQueries.map((query, index) => (
                      <QueryItem key={query.id} query={query} index={index} />
                    ))}
                  </div>
                </>
              )}

              {followUpQueries.length > 0 && (
                <>
                  <h5 className="text-xs font-medium text-c-text-secondary dark:text-c-text-secondary uppercase tracking-wider mb-2 mt-4 flex items-center gap-1">
                    <RefreshCw size={12} />
                    {t('research.followUpQueries', 'Follow-up Queries (Iterative Deepening)')} (
                    {followUpQueries.length})
                  </h5>
                  <div className="max-h-48 overflow-y-auto">
                    {followUpQueries.map((query, index) => (
                      <QueryItem
                        key={query.id}
                        query={query}
                        index={initialQueries.length + index}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Sources tab */}
          {activeTab === 'sources' && (
            <div className="p-4">
              {sources.length > 0 ? (
                <>
                  <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                    {t('research.topSources', 'Top Sources')} ({sources.length})
                  </h5>
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {sources.slice(0, 20).map((source, index) => (
                      <SourceItem key={source.url} source={source} index={index} />
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-slate-600 text-center py-4">
                  {t('research.noSourcesYet', 'No sources found yet...')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Compact research status badge
 */
export const ResearchStatusBadge: React.FC<{
  isActive: boolean;
  queriesCompleted: number;
  totalQueries: number;
  sourcesCount?: number;
  round?: number;
  onClick?: () => void;
}> = ({ isActive, queriesCompleted, totalQueries, sourcesCount, round, onClick }) => {
  const { t } = useTranslation();

  if (!isActive) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-c-surface-raised dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text-secondary rounded-full text-xs font-medium hover:bg-c-surface-hover dark:hover:bg-c-surface-hover transition-colors"
    >
      <Search size={12} className="animate-pulse" />
      <span>{t('research.researching', 'Researching')}</span>
      <span className="text-c-text-secondary">
        {queriesCompleted}/{totalQueries}
      </span>
      {sourcesCount && sourcesCount > 0 && (
        <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
          <Globe size={10} />
          {sourcesCount}
        </span>
      )}
      {round && round > 1 && <span className="text-c-text-secondary">R{round}</span>}
    </button>
  );
};

export default ResearchProgress;
