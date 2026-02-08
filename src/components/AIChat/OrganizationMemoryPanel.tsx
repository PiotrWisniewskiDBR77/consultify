/**
 * OrganizationMemoryPanel
 *
 * Compact, enterprise-grade panel shown in the AI chat sidebar (or inline)
 * that displays past decisions and org-level best-practice patterns.
 * Enables consultants to reference previous analyses without re-asking.
 *
 * Features:
 * - Past Decision cards with outcome status badges
 * - Organization patterns (best practices, lessons learned)
 * - Search across decision history
 * - "Use in conversation" to inject context into current chat
 */

import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  Lightbulb,
  Search,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { OrgPattern, PastDecision } from '../../hooks/useOrgMemory';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function outcomeColor(status: PastDecision['outcomeStatus']): string {
  switch (status) {
    case 'positive':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'negative':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'mixed':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'neutral':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    default:
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300';
  }
}

function outcomeLabel(status: PastDecision['outcomeStatus'], isPl: boolean): string {
  const labels: Record<string, { en: string; pl: string }> = {
    positive: { en: 'Positive', pl: 'Pozytywny' },
    negative: { en: 'Negative', pl: 'Negatywny' },
    mixed: { en: 'Mixed', pl: 'Mieszany' },
    neutral: { en: 'Neutral', pl: 'Neutralny' },
    pending: { en: 'Pending', pl: 'Oczekuje' },
  };
  const entry = labels[status] || labels.pending;
  return isPl ? entry.pl : entry.en;
}

function patternIcon(type: string) {
  switch (type) {
    case 'SUCCESS_PATTERN':
      return <TrendingUp size={12} className="text-green-500" />;
    case 'BEST_PRACTICE':
      return <Lightbulb size={12} className="text-amber-500" />;
    case 'LESSON_LEARNED':
      return <BookOpen size={12} className="text-blue-500" />;
    default:
      return <Lightbulb size={12} className="text-slate-400" />;
  }
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const DecisionCard: React.FC<{
  decision: PastDecision;
  isPl: boolean;
  onUseInConversation?: (summary: string) => void;
  onOpenConversation?: (conversationId: string) => void;
}> = ({ decision, isPl, onUseInConversation, onOpenConversation }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-slate-200 dark:border-navy-700 rounded-lg p-2.5 bg-white dark:bg-navy-900 hover:border-primary-300 dark:hover:border-primary-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex-1 text-left text-xs font-medium text-slate-800 dark:text-slate-200 leading-tight line-clamp-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
        >
          {decision.decisionSummary || (isPl ? 'Analiza bez tytułu' : 'Untitled analysis')}
        </button>
        <span
          className={`flex-shrink-0 px-1.5 py-0.5 rounded text-[9px] font-semibold ${outcomeColor(decision.outcomeStatus)}`}
        >
          {outcomeLabel(decision.outcomeStatus, isPl)}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
          <Clock size={9} />
          {formatDate(decision.createdAt)}
        </span>
        {decision.tags.length > 0 && (
          <div className="flex gap-1 overflow-hidden">
            {decision.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="px-1 py-0.5 text-[9px] bg-slate-100 dark:bg-navy-800 text-slate-500 dark:text-slate-400 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {expanded && (
        <div className="mt-2 pt-2 border-t border-slate-100 dark:border-navy-700 space-y-1.5 animate-in fade-in duration-200">
          {decision.problemFraming && (
            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
              <span className="font-semibold">{isPl ? 'Problem:' : 'Problem:'}</span>{' '}
              {decision.problemFraming.slice(0, 200)}
              {decision.problemFraming.length > 200 ? '…' : ''}
            </p>
          )}
          {decision.recommendationText && (
            <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
              <span className="font-semibold">{isPl ? 'Rekomendacja:' : 'Recommendation:'}</span>{' '}
              {decision.recommendationText.slice(0, 200)}
              {decision.recommendationText.length > 200 ? '…' : ''}
            </p>
          )}
          <div className="flex gap-1.5 mt-1.5">
            {onUseInConversation && (
              <button
                onClick={() =>
                  onUseInConversation(
                    `[${isPl ? 'Kontekst z historii decyzji' : 'Context from decision history'}] ${decision.decisionSummary}`
                  )
                }
                className="px-2 py-1 text-[10px] font-medium rounded bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors"
              >
                {isPl ? 'Użyj w rozmowie' : 'Use in conversation'}
              </button>
            )}
            {decision.conversationId && onOpenConversation && (
              <button
                onClick={() => onOpenConversation(decision.conversationId!)}
                className="px-2 py-1 text-[10px] font-medium rounded bg-slate-100 dark:bg-navy-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-navy-700 transition-colors flex items-center gap-0.5"
              >
                <ExternalLink size={8} />
                {isPl ? 'Otwórz rozmowę' : 'View conversation'}
              </button>
            )}
          </div>
        </div>
      )}

      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 text-[9px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          {isPl ? 'Pokaż szczegóły ▾' : 'Show details ▾'}
        </button>
      )}
    </div>
  );
};

const PatternCard: React.FC<{
  pattern: OrgPattern;
  isPl: boolean;
}> = ({ pattern, isPl }) => (
  <div className="flex items-start gap-2 p-2 rounded-lg bg-slate-50 dark:bg-navy-800/50 border border-slate-100 dark:border-navy-700">
    <div className="mt-0.5">{patternIcon(pattern.type)}</div>
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-medium text-slate-700 dark:text-slate-200 leading-tight truncate">
        {pattern.title}
      </p>
      <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
        {pattern.content}
      </p>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[9px] text-slate-400">
          {isPl ? `Użyto ${pattern.usageCount}×` : `Used ${pattern.usageCount}×`}
        </span>
        <span className="text-[9px] text-slate-400">{formatDate(pattern.createdAt)}</span>
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export interface OrganizationMemoryPanelProps {
  decisions: PastDecision[];
  patterns: OrgPattern[];
  loading: boolean;
  onSearch: (query: string) => void;
  onUseInConversation?: (text: string) => void;
  onOpenConversation?: (conversationId: string) => void;
  className?: string;
}

export const OrganizationMemoryPanel: React.FC<OrganizationMemoryPanelProps> = ({
  decisions,
  patterns,
  loading,
  onSearch,
  onUseInConversation,
  onOpenConversation,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const [isExpanded, setIsExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'decisions' | 'patterns'>('decisions');

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearchQuery(val);
      // Debounce: search after user stops typing
      const timer = setTimeout(() => onSearch(val), 400);
      return () => clearTimeout(timer);
    },
    [onSearch]
  );

  const totalCount = decisions.length + patterns.length;

  if (totalCount === 0 && !loading) return null;

  return (
    <div
      className={`border border-slate-200 dark:border-navy-700 rounded-xl bg-white dark:bg-navy-900 overflow-hidden ${className}`}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-navy-800/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={14} className="text-primary-500" />
          <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {isPl ? 'Pamięć organizacji' : 'Organization Memory'}
          </span>
          {totalCount > 0 && (
            <span className="px-1.5 py-0.5 text-[9px] font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded-full">
              {totalCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp size={14} className="text-slate-400" />
        ) : (
          <ChevronDown size={14} className="text-slate-400" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-slate-200 dark:border-navy-700">
          {/* Tabs */}
          <div className="px-3 pt-2 flex gap-1">
            <button
              onClick={() => setActiveTab('decisions')}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-t-lg transition-colors ${
                activeTab === 'decisions'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-b-0 border-primary-200 dark:border-primary-800'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {isPl ? 'Decyzje' : 'Decisions'} {decisions.length > 0 && `(${decisions.length})`}
            </button>
            <button
              onClick={() => setActiveTab('patterns')}
              className={`px-2.5 py-1 text-[10px] font-semibold rounded-t-lg transition-colors ${
                activeTab === 'patterns'
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 border border-b-0 border-primary-200 dark:border-primary-800'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {isPl ? 'Wzorce' : 'Patterns'} {patterns.length > 0 && `(${patterns.length})`}
            </button>
          </div>

          {/* Search (decisions tab only) */}
          {activeTab === 'decisions' && (
            <div className="px-3 py-2">
              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={handleSearch}
                  placeholder={isPl ? 'Szukaj w historii decyzji…' : 'Search decision history…'}
                  className="w-full pl-7 pr-3 py-1.5 text-[11px] bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-300 dark:focus:ring-primary-700"
                />
              </div>
            </div>
          )}

          {/* Content */}
          <div className="px-3 pb-3 max-h-80 overflow-y-auto space-y-2">
            {loading && (
              <div className="py-4 flex items-center justify-center">
                <div className="w-4 h-4 border-2 border-primary-300 border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {activeTab === 'decisions' &&
              !loading &&
              decisions.map((d) => (
                <DecisionCard
                  key={d.id}
                  decision={d}
                  isPl={isPl}
                  onUseInConversation={onUseInConversation}
                  onOpenConversation={onOpenConversation}
                />
              ))}

            {activeTab === 'decisions' && !loading && decisions.length === 0 && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-3">
                {searchQuery
                  ? isPl
                    ? 'Brak wyników dla tego zapytania'
                    : 'No results for this query'
                  : isPl
                    ? 'Jeszcze nie zapisano żadnych decyzji. Użyj „Zapisz jako decyzję" po analizie Deep Thinking.'
                    : 'No decisions saved yet. Use "Save as Decision" after a Deep Thinking analysis.'}
              </p>
            )}

            {activeTab === 'patterns' &&
              !loading &&
              patterns.map((p) => <PatternCard key={p.id} pattern={p} isPl={isPl} />)}

            {activeTab === 'patterns' && !loading && patterns.length === 0 && (
              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center py-3">
                {isPl
                  ? 'System uczy się wzorców z Twoich projektów. Pojawią się tutaj automatycznie.'
                  : 'System learns patterns from your projects. They will appear here automatically.'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
