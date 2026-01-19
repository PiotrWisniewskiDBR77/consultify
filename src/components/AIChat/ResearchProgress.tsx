/**
 * ResearchProgress Component
 * 
 * Displays real-time progress for deep research mode.
 * Shows query execution status, source aggregation, and relevance scores.
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
  Loader2,
  Search,
  Sparkles,
  XCircle,
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
  stage: 'generating_queries' | 'queries_ready' | 'searching' | 'aggregating' | 'synthesizing' | 'complete';
  queries: ResearchQuery[];
  sources?: Source[];
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
    pending: <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />,
    searching: <Loader2 size={16} className="animate-spin text-primary-500" />,
    done: <CheckCircle2 size={16} className="text-green-500" />,
    error: <XCircle size={16} className="text-red-500" />,
  };

  return (
    <div className="py-2 border-b border-slate-100 dark:border-navy-700 last:border-b-0">
      <div className="flex items-start gap-2">
        <div className="flex-shrink-0 mt-0.5">{statusIcon[query.status]}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Q{index + 1}
            </span>
            <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
              {query.query}
            </span>
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {query.purpose}
          </p>
          
          {query.status === 'done' && query.results && query.results.length > 0 && (
            <button
              onClick={() => setShowResults(!showResults)}
              className="flex items-center gap-1 mt-1 text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              {query.results.length} {t('research.sources', 'sources')}
              {showResults ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
          
          {showResults && query.results && (
            <div className="mt-2 space-y-1 pl-2 border-l-2 border-slate-200 dark:border-navy-600">
              {query.results.slice(0, 3).map((result, i) => (
                <a
                  key={i}
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-1.5 text-xs hover:bg-slate-50 dark:hover:bg-navy-800 p-1 rounded group"
                >
                  <ExternalLink size={10} className="flex-shrink-0 mt-0.5 text-slate-400 group-hover:text-primary-500" />
                  <div className="min-w-0">
                    <p className="text-slate-600 dark:text-slate-300 truncate">{result.title}</p>
                    <p className="text-slate-400 text-[10px]">{result.source}</p>
                  </div>
                  <span className="flex-shrink-0 text-[10px] text-slate-400">
                    {Math.round(result.relevanceScore * 100)}%
                  </span>
                </a>
              ))}
            </div>
          )}

          {query.status === 'error' && query.error && (
            <p className="text-xs text-red-500 mt-1">{query.error}</p>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * Source list item
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
    <div className="flex-1 min-w-0">
      <p className="text-sm text-slate-700 dark:text-slate-200 truncate group-hover:text-primary-600">
        {source.title}
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500">{source.domain}</p>
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
      <ExternalLink size={12} className="text-slate-400 group-hover:text-primary-500" />
    </div>
  </a>
);

/**
 * Main research progress component
 */
export const ResearchProgress: React.FC<ResearchProgressProps> = ({
  topic,
  stage,
  queries,
  sources = [],
  className = '',
  isExpanded: controlledExpanded,
  onToggleExpand,
}) => {
  const { t } = useTranslation();
  const [internalExpanded, setInternalExpanded] = useState(true);

  const isExpanded = controlledExpanded ?? internalExpanded;
  const toggleExpand = onToggleExpand ?? (() => setInternalExpanded(!internalExpanded));

  const completedQueries = queries.filter((q) => q.status === 'done').length;
  const totalQueries = queries.length;
  const progress = totalQueries > 0 ? (completedQueries / totalQueries) * 100 : 0;

  const stageLabels: Record<string, { label: string; icon: React.ReactNode }> = {
    generating_queries: { 
      label: t('research.generatingQueries', 'Generating research queries...'),
      icon: <Sparkles size={16} className="animate-pulse" />
    },
    queries_ready: { 
      label: t('research.queriesReady', 'Research queries ready'),
      icon: <FileSearch size={16} />
    },
    searching: { 
      label: t('research.searching', 'Searching sources...'),
      icon: <Search size={16} className="animate-pulse" />
    },
    aggregating: { 
      label: t('research.aggregating', 'Aggregating results...'),
      icon: <BookOpen size={16} className="animate-pulse" />
    },
    synthesizing: { 
      label: t('research.synthesizing', 'Synthesizing findings...'),
      icon: <Sparkles size={16} className="animate-pulse" />
    },
    complete: { 
      label: t('research.complete', 'Research complete'),
      icon: <CheckCircle2 size={16} className="text-green-500" />
    },
  };

  const currentStage = stageLabels[stage] || stageLabels.searching;

  return (
    <div className={`bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-navy-800 dark:to-indigo-900/20 rounded-xl border border-slate-200 dark:border-navy-700 ${className}`}>
      <button
        onClick={toggleExpand}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/50 dark:hover:bg-navy-700/50 transition-colors"
      >
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Search size={18} />
        </div>
        
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('research.deepResearch', 'Deep Research')}
            </h4>
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              {currentStage.icon}
              {currentStage.label}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {topic}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {completedQueries}/{totalQueries}
            </span>
            <p className="text-xs text-slate-400">{t('research.queries', 'queries')}</p>
          </div>
          <div className="w-20 h-2 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-navy-700">
          <div className="p-4">
            <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              {t('research.searchQueries', 'Search Queries')}
            </h5>
            <div className="max-h-48 overflow-y-auto">
              {queries.map((query, index) => (
                <QueryItem key={query.id} query={query} index={index} />
              ))}
            </div>
          </div>

          {sources.length > 0 && (
            <div className="p-4 border-t border-slate-200 dark:border-navy-700">
              <h5 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                {t('research.topSources', 'Top Sources')} ({sources.length})
              </h5>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {sources.slice(0, 10).map((source, index) => (
                  <SourceItem key={source.url} source={source} index={index} />
                ))}
              </div>
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
  onClick?: () => void;
}> = ({ isActive, queriesCompleted, totalQueries, onClick }) => {
  const { t } = useTranslation();

  if (!isActive) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-full text-xs font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/70 transition-colors"
    >
      <Search size={12} className="animate-pulse" />
      <span>{t('research.researching', 'Researching')}</span>
      <span className="text-indigo-500">{queriesCompleted}/{totalQueries}</span>
    </button>
  );
};

export default ResearchProgress;
