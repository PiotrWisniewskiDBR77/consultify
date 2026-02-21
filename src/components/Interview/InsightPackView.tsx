/**
 * InsightPackView (T016)
 *
 * N-mode insight pack viewer for structured inference results.
 * Left nav with category filters, canvas with expandable insight cards,
 * properties strip with status & actions.
 */

import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  Filter,
  Flag,
  HelpCircle,
  Lightbulb,
  Loader2,
  RefreshCw,
  Shield,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { trackFunnelEvent } from '../../services/funnelAnalytics';

const API_BASE = '/api/interview';

interface Evidence {
  sessionId: string;
  questionId: string;
  excerpt: string;
}

interface StructuredInsight {
  category: string;
  statement: string;
  whyItMatters: string;
  recommendation?: string;
  confidenceScore: number;
  evidence: Evidence[];
  assumptions: string[];
  unknowns: string[];
  counterpoints: string[];
}

interface InsightRow {
  id: string;
  title: string;
  category: string;
  status: string;
  structuredContent: StructuredInsight | null;
  evidenceLinks: Evidence[];
  unknowns: string[];
  counterpoints: string[];
  assumptions: string[];
  confidenceScore: number;
  insightCategory: string;
  inferenceRunId: string;
  createdAt: string;
}

interface InferenceRun {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  insightsCount: number;
  generationTimeMs: number;
  errorMessage?: string;
  createdAt: string;
  completedAt?: string;
}

interface InsightPackViewProps {
  organizationId: string;
  projectId?: string;
  sessionIds: string[];
  locked?: boolean;
}

const CATEGORIES = ['risk', 'opportunity', 'constraint', 'priority', 'trend', 'gap'] as const;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  risk: <AlertTriangle className="w-4 h-4" />,
  opportunity: <Lightbulb className="w-4 h-4" />,
  constraint: <Shield className="w-4 h-4" />,
  priority: <Target className="w-4 h-4" />,
  trend: <TrendingUp className="w-4 h-4" />,
  gap: <HelpCircle className="w-4 h-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  risk: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  opportunity: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  constraint: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  priority: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  trend: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  gap: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

const ConfidenceStars: React.FC<{ score: number }> = ({ score }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        className={`w-3.5 h-3.5 ${
          s <= score
            ? 'fill-amber-400 text-amber-400'
            : 'text-gray-300 dark:text-gray-600'
        }`}
      />
    ))}
  </div>
);

export const InsightPackView: React.FC<InsightPackViewProps> = ({
  organizationId,
  projectId,
  sessionIds,
  locked = false,
}) => {
  const { t } = useTranslation();
  const [insights, setInsights] = useState<InsightRow[]>([]);
  const [runs, setRuns] = useState<InferenceRun[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [runningInference, setRunningInference] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(true);

  const fetchInsights = useCallback(async () => {
    try {
      setLoadingInsights(true);
      const res = await fetch(`${API_BASE}/insights`);
      if (!res.ok) return;
      const data = await res.json();
      const rows = (data.insights || data || []).map((r: any) => ({
        id: r.id,
        title: r.title,
        category: r.insight_category || r.category || 'gap',
        status: r.status || 'completed',
        structuredContent:
          typeof r.structured_content === 'string'
            ? JSON.parse(r.structured_content)
            : r.structured_content || r.structuredContent || null,
        evidenceLinks:
          typeof r.evidence_links === 'string'
            ? JSON.parse(r.evidence_links)
            : r.evidence_links || r.evidenceLinks || [],
        unknowns:
          typeof r.unknowns === 'string' ? JSON.parse(r.unknowns) : r.unknowns || [],
        counterpoints:
          typeof r.counterpoints === 'string'
            ? JSON.parse(r.counterpoints)
            : r.counterpoints || [],
        assumptions:
          typeof r.assumptions === 'string'
            ? JSON.parse(r.assumptions)
            : r.assumptions || [],
        confidenceScore: r.confidence_score || r.confidenceScore || 3,
        insightCategory: r.insight_category || r.insightCategory || r.category || 'gap',
        inferenceRunId: r.inference_run_id || r.inferenceRunId || '',
        createdAt: r.created_at || r.createdAt || '',
      }));
      setInsights(rows);
    } catch {
      /* ignore */
    } finally {
      setLoadingInsights(false);
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const url = projectId
        ? `${API_BASE}/inference/runs?projectId=${projectId}`
        : `${API_BASE}/inference/runs`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setRuns(data.runs || []);
    } catch {
      /* ignore */
    }
  }, [projectId]);

  useEffect(() => {
    fetchInsights();
    fetchRuns();
  }, [fetchInsights, fetchRuns]);

  const runInference = useCallback(async () => {
    if (sessionIds.length === 0) {
      toast.error('No sessions selected');
      return;
    }

    setRunningInference(true);
    trackFunnelEvent('inference_run_started', { sessionCount: sessionIds.length });

    try {
      const res = await fetch(`${API_BASE}/inference/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, sessionIds }),
      });

      if (!res.ok) throw new Error('Failed to start inference');
      const data = await res.json();
      toast.success(t('interview.inference.running'));

      const pollRun = async (runId: string, attempts = 0) => {
        if (attempts > 30) return;
        await new Promise((r) => setTimeout(r, 2000));
        const statusRes = await fetch(`${API_BASE}/inference/runs/${runId}`);
        if (!statusRes.ok) return;
        const runData = await statusRes.json();

        if (runData.status === 'completed') {
          trackFunnelEvent('inference_run_completed', {
            runId,
            insightsCount: runData.insightsCount,
          });
          toast.success(t('interview.inference.completed'));
          fetchInsights();
          fetchRuns();
          setRunningInference(false);
        } else if (runData.status === 'failed') {
          trackFunnelEvent('inference_run_failed', { runId });
          toast.error(t('interview.inference.failed'));
          setRunningInference(false);
        } else {
          pollRun(runId, attempts + 1);
        }
      };

      pollRun(data.runId);
    } catch {
      toast.error(t('interview.inference.failed'));
      setRunningInference(false);
    }
  }, [sessionIds, projectId, t, fetchInsights, fetchRuns]);

  const filteredInsights = useMemo(
    () =>
      selectedCategory
        ? insights.filter((i) => i.insightCategory === selectedCategory)
        : insights,
    [insights, selectedCategory]
  );

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of CATEGORIES) counts[cat] = 0;
    for (const i of insights) {
      const cat = i.insightCategory || 'gap';
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [insights]);

  const latestRun = runs[0] || null;

  return (
    <div className="flex h-full">
      {/* Left nav: category filters */}
      <div className="w-56 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3 px-2">
          <Filter className="w-3 h-3 inline mr-1" />
          {t('interview.inference.categories.risk').split(' ')[0] ? 'Categories' : 'Categories'}
        </h3>

        <button
          onClick={() => setSelectedCategory(null)}
          className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 transition-colors ${
            !selectedCategory
              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          All ({insights.length})
        </button>

        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat === selectedCategory ? null : cat)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm mb-1 flex items-center gap-2 transition-colors ${
              selectedCategory === cat
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 font-medium'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            {CATEGORY_ICONS[cat]}
            <span className="flex-1">{t(`interview.inference.categories.${cat}`)}</span>
            <span className="text-xs opacity-60">{categoryCounts[cat]}</span>
          </button>
        ))}

        {/* Run status */}
        {latestRun && (
          <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="px-2 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-1.5 mb-1">
                {latestRun.status === 'running' && (
                  <Loader2 className="w-3 h-3 animate-spin text-purple-500" />
                )}
                {latestRun.status === 'completed' && (
                  <Check className="w-3 h-3 text-green-500" />
                )}
                {latestRun.status === 'failed' && (
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                )}
                <span className="capitalize">{latestRun.status}</span>
              </div>
              {latestRun.insightsCount > 0 && (
                <p>{latestRun.insightsCount} insights</p>
              )}
              {latestRun.generationTimeMs > 0 && (
                <p>{(latestRun.generationTimeMs / 1000).toFixed(1)}s</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Canvas: insights list */}
      <div className="flex-1 overflow-y-auto">
        {/* Header with Run Inference button */}
        <div className="sticky top-0 z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 px-6 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            {t('interview.inference.title')}
          </h2>
          {!locked && (
            <button
              onClick={runInference}
              disabled={runningInference || sessionIds.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {runningInference ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {t('interview.inference.runInference')}
            </button>
          )}
        </div>

        <div className="p-6 space-y-3">
          {loadingInsights && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
            </div>
          )}

          {!loadingInsights && filteredInsights.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
              <BarChart3 className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">{t('interview.inference.noInsights')}</p>
            </div>
          )}

          {filteredInsights.map((insight) => {
            const expanded = expandedId === insight.id;
            const sc = insight.structuredContent;

            return (
              <div
                key={insight.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
              >
                {/* Collapsed row */}
                <button
                  onClick={() => setExpandedId(expanded ? null : insight.id)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                >
                  {expanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  )}

                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${
                      CATEGORY_COLORS[insight.insightCategory] || CATEGORY_COLORS.gap
                    }`}
                  >
                    {CATEGORY_ICONS[insight.insightCategory]}
                    {t(`interview.inference.categories.${insight.insightCategory}`)}
                  </span>

                  <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                    {insight.title}
                  </span>

                  <ConfidenceStars score={insight.confidenceScore} />

                  <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                    {(insight.evidenceLinks || []).length} evidence
                  </span>
                </button>

                {/* Expanded detail */}
                {expanded && sc && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-5 py-4 space-y-4">
                    {/* Why it matters */}
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1">
                        {t('interview.inference.whyItMatters')}
                      </h4>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {sc.whyItMatters}
                      </p>
                    </div>

                    {/* Recommendation */}
                    {sc.recommendation && (
                      <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-100 dark:border-blue-900/50">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                          <Lightbulb className="w-3 h-3" />
                          {t('interview.inference.recommendation')}
                        </h4>
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          {sc.recommendation}
                        </p>
                      </div>
                    )}

                    {/* Evidence */}
                    {sc.evidence && sc.evidence.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                          {t('interview.inference.evidence')} ({sc.evidence.length})
                        </h4>
                        <div className="space-y-1.5">
                          {sc.evidence.map((e, i) => (
                            <div
                              key={i}
                              className="text-xs text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2 border border-gray-100 dark:border-gray-700"
                            >
                              <span className="italic">"{e.excerpt}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Unknowns, Counterpoints, Assumptions in a grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {sc.unknowns && sc.unknowns.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
                            {t('interview.inference.unknowns')}
                          </h4>
                          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            {sc.unknowns.map((u, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-amber-400 mt-0.5">•</span>
                                {u}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sc.counterpoints && sc.counterpoints.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400 mb-1">
                            {t('interview.inference.counterpoints')}
                          </h4>
                          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            {sc.counterpoints.map((c, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-red-400 mt-0.5">•</span>
                                {c}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sc.assumptions && sc.assumptions.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                            {t('interview.inference.assumptions')}
                          </h4>
                          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
                            {sc.assumptions.map((a, i) => (
                              <li key={i} className="flex items-start gap-1">
                                <span className="text-blue-400 mt-0.5">•</span>
                                {a}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Properties strip / actions */}
                    {!locked && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                        <span
                          className={`text-xs px-2 py-1 rounded-md font-medium ${
                            insight.status === 'approved'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : insight.status === 'reviewed'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                          }`}
                        >
                          {t(`interview.inference.${insight.status === 'approved' ? 'approved' : insight.status === 'reviewed' ? 'reviewed' : 'draft'}`)}
                        </span>
                        <div className="flex-1" />
                        <button
                          onClick={() => {
                            trackFunnelEvent('insight_approved', { insightId: insight.id });
                            toast.success('Approved');
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/40 transition-colors"
                        >
                          {t('interview.inference.approve')}
                        </button>
                        <button
                          onClick={() => {
                            trackFunnelEvent('insight_regenerated', { insightId: insight.id });
                            toast('Regeneration requested');
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/40 transition-colors"
                        >
                          <RefreshCw className="w-3 h-3 inline mr-1" />
                          {t('interview.inference.regenerate')}
                        </button>
                        <button
                          onClick={() => {
                            trackFunnelEvent('insight_exported', { insightId: insight.id });
                            toast.success('Exported');
                          }}
                          className="text-xs px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 transition-colors"
                        >
                          <Download className="w-3 h-3 inline mr-1" />
                          {t('interview.inference.export')}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default InsightPackView;
