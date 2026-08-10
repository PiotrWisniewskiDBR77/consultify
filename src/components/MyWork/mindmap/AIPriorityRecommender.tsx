/**
 * AIPriorityRecommender — AI suggests prioritization based on impact/effort
 * analysis with company KPI context.
 */
import { ArrowUpDown, CheckCircle2, Loader2, Sparkles, Target, X, Zap } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { Api } from '@/services/api';

interface PriorityRecommendation {
  nodeId: string;
  label: string;
  branchKey: string;
  currentPriority: number;
  suggestedPriority: number;
  impact: 'high' | 'medium' | 'low';
  effort: 'high' | 'medium' | 'low';
  rationale: string;
  rank: number;
}

interface AIPriorityRecommenderProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  nodes: Array<{ id: string; data: any }>;
  locked: boolean;
  onApplyPriorities: (updates: Array<{ nodeId: string; priority: number }>) => void;
}

const IMPACT_COLORS = {
  high: 'text-c-success bg-c-surface-raised',
  medium: 'text-c-warning bg-c-surface-raised',
  low: 'text-c-text-secondary bg-c-surface-raised',
};
const EFFORT_COLORS = {
  high: 'text-c-danger bg-c-surface-raised',
  medium: 'text-c-warning bg-c-surface-raised',
  low: 'text-c-success bg-c-surface-raised',
};

export const AIPriorityRecommender: React.FC<AIPriorityRecommenderProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  nodes,
  locked,
  onApplyPriorities,
}) => {
  const { t, i18n } = useTranslation();

  const [recommendations, setRecommendations] = useState<PriorityRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'rank' | 'impact' | 'effort'>('rank');

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const ideaNodes = nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'));
      const nodeDescriptions = ideaNodes.map(
        (n, idx) =>
          `${idx}. [${n.data?.branchKey}] "${n.data?.label}" (current priority: ${n.data?.priority ?? 50})`
      );

      const res = await Api.getMyIdeaAISuggestions(ideaId, {
        seedText: `Prioritize these ideas for "${ideaTitle}" using impact/effort analysis. Consider business value, feasibility, and dependencies.\n\nIdeas:\n${nodeDescriptions.join('\n')}\n\nReturn suggestions with priority scores (0-100), impact (high/medium/low), effort (high/medium/low).`,
        mapNodes: nodes.map((n) => ({
          id: n.id,
          type: 'idea',
          data: { label: n.data?.label, branchKey: n.data?.branchKey },
        })),
        activeTool: 'mindmap',
        language: i18n.language,
      });

      if (res?.suggestions && Array.isArray(res.suggestions)) {
        const recs: PriorityRecommendation[] = res.suggestions
          .slice(0, ideaNodes.length)
          .map((s: any, idx: number) => {
            const node = ideaNodes[idx] || ideaNodes[0];
            const confidence = s.confidence ?? 0.5;
            return {
              nodeId: node?.id || `unknown-${idx}`,
              label: node?.data?.label || s.text || 'Unknown',
              branchKey: node?.data?.branchKey || '?',
              currentPriority: node?.data?.priority ?? 50,
              suggestedPriority: Math.round(confidence * 100),
              impact: confidence > 0.7 ? 'high' : confidence > 0.4 ? 'medium' : 'low',
              effort: confidence > 0.6 ? 'low' : confidence > 0.3 ? 'medium' : 'high',
              rationale: s.detail || s.text || '',
              rank: idx + 1,
            };
          });
        setRecommendations(recs);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to analyze priorities');
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, ideaTitle, nodes]);

  const sorted = React.useMemo(() => {
    const copy = [...recommendations];
    if (sortBy === 'impact')
      copy.sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 };
        return order[a.impact] - order[b.impact];
      });
    if (sortBy === 'effort')
      copy.sort((a, b) => {
        const order = { low: 0, medium: 1, high: 2 };
        return order[a.effort] - order[b.effort];
      });
    return copy;
  }, [recommendations, sortBy]);

  const handleApplyAll = useCallback(() => {
    onApplyPriorities(
      recommendations.map((r) => ({ nodeId: r.nodeId, priority: r.suggestedPriority }))
    );
    toast.success(t('ideas.mindmap.prioritiesUpdated', 'Priorities updated'), { duration: 1200 });
    onClose();
  }, [onApplyPriorities, onClose, recommendations]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="a-i-priority-recommender-modal-heading"
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div>
            <div className="flex items-center gap-2">
              <Target size={16} className="text-c-warning" />
              <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="a-i-priority-recommender-modal-heading">
                {t('ideas.mindmap.aiPriorityRecommender', 'AI: Priority Recommender')}
              </h3>
            </div>
            <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mt-1">
              {t(
                'ideas.mindmap.impactEffortAnalysisCompanyKpiContext',
                'Impact/effort analysis with company KPI context.'
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {recommendations.length === 0 && !loading && (
            <div className="text-center py-8">
              <ArrowUpDown
                size={36}
                className="text-c-text-secondary dark:text-c-text-muted mx-auto mb-3"
              />
              <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mb-4">
                {t(
                  'ideas.mindmap.aiWillAnalyzePrioritiesYourIdeas',
                  'AI will analyze the priorities of your ideas.'
                )}
              </p>
              <button
                onClick={analyze}
                disabled={loading || locked}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised text-[11px] font-bold text-c-warning dark:text-c-warning transition-all disabled:opacity-40"
              >
                <Sparkles size={14} />
                {t('ideas.mindmap.analyzePriorities', 'Analyze priorities')}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-c-warning" />
              <span className="text-[11px] text-c-text-secondary">
                {t('ideas.mindmap.analyzing', 'Analyzing...')}
              </span>
            </div>
          )}

          {recommendations.length > 0 && (
            <>
              {/* Sort controls */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary">
                  {t('ideas.mindmap.sort', 'Sort:')}
                </span>
                {(['rank', 'impact', 'effort'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSortBy(s)}
                    className={`px-2 py-0.5 rounded-lg text-[9px] font-bold transition-colors ${sortBy === s ? 'bg-c-surface-raised text-c-warning dark:text-c-warning' : 'text-c-text-secondary hover:text-c-text-secondary'}`}
                  >
                    {s === 'rank'
                      ? t('ideas.mindmap.rank', 'Rank')
                      : s === 'impact'
                        ? 'Impact'
                        : 'Effort'}
                  </button>
                ))}
              </div>

              {/* Table */}
              <div className="space-y-1.5">
                {sorted.map((rec) => (
                  <div
                    key={rec.nodeId}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border-subtle"
                  >
                    <div className="w-6 h-6 rounded-full bg-c-surface-raised text-c-warning dark:text-c-warning flex items-center justify-center text-[10px] font-bold shrink-0">
                      {rec.rank}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-c-text-secondary dark:text-c-text truncate">
                        {rec.label}
                      </div>
                      <div className="text-[9px] text-c-text-secondary">{rec.branchKey}</div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${IMPACT_COLORS[rec.impact]}`}
                      >
                        {t('ideas.mindmap.impact', 'Impact')}: {rec.impact}
                      </span>
                      <span
                        className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${EFFORT_COLORS[rec.effort]}`}
                      >
                        {t('ideas.mindmap.effort', 'Effort')}: {rec.effort}
                      </span>
                    </div>
                    <div className="w-10 text-right">
                      <div className="text-[11px] font-bold text-c-warning dark:text-c-warning">
                        {rec.suggestedPriority}
                      </div>
                      <div className="text-[8px] text-c-text-secondary line-through">
                        {rec.currentPriority}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {recommendations.length > 0 && (
          <div className="px-5 py-3 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
            >
              {t('ideas.mindmap.cancel', 'Cancel')}
            </button>
            <button
              onClick={handleApplyAll}
              disabled={locked}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-c-surface-raised text-c-warning dark:text-c-warning border border-c-warning transition-all disabled:opacity-40"
            >
              <CheckCircle2 size={12} />
              {t('ideas.mindmap.applyPriorities', 'Apply priorities')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIPriorityRecommender;
