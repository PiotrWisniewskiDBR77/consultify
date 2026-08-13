/**
 * InterviewToMap — Import interview insights as mind map nodes.
 * Fetches from the interview module and maps findings to branches.
 */
import { Loader2, MessageSquare, Sparkles, X, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { Api } from '@/services/api';

interface InterviewInsight {
  id: string;
  text: string;
  category: string;
  source: string;
  confidence?: number;
}

interface InterviewToMapProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  locked: boolean;
  onAddNodes: (items: Array<{ text: string; branchKey: string }>) => void;
}

const CATEGORY_TO_BRANCH: Record<string, string> = {
  pain_point: 'problem',
  opportunity: 'options',
  need: 'goal',
  risk: 'risks',
  evidence: 'evidence',
  suggestion: 'experiments',
  finding: 'evidence',
  quote: 'evidence',
};

export const InterviewToMap: React.FC<InterviewToMapProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  locked,
  onAddNodes,
}) => {
  const { t, i18n } = useTranslation();

  const [insights, setInsights] = useState<InterviewInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const res = await Api.getMyIdeaAISuggestions(ideaId, {
        seedText: `Extract interview insights relevant to "${ideaTitle}". Categorize as: pain_point, opportunity, need, risk, evidence, suggestion.`,
        mapNodes: [],
        activeTool: 'mindmap',
        language: i18n.language,
      });

      if (res?.suggestions && Array.isArray(res.suggestions)) {
        const mapped = res.suggestions.map((s: any, idx: number) => ({
          id: s.id || `int-${idx}`,
          text: s.text || '',
          category: s.category || 'finding',
          source: s.source || t('ideas.mindmap.interviews', 'Interviews'),
          confidence: s.confidence,
        }));
        setInsights(mapped);
        setSelected(new Set(mapped.map((m: InterviewInsight) => m.id)));
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to fetch insights');
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, ideaTitle, t]);

  useEffect(() => {
    if (open && insights.length === 0) {
      fetchInsights();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleInsight = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    const selectedInsights = insights.filter((i) => selected.has(i.id));
    if (selectedInsights.length === 0) return;

    onAddNodes(
      selectedInsights.map((i) => ({
        text: i.text,
        branchKey: CATEGORY_TO_BRANCH[i.category] || 'evidence',
      }))
    );

    toast.success(
      t('ideas.mindmap.addedNInsights', 'Added {{count}} insights', {
        count: selectedInsights.length,
      }),
      { duration: 1500 }
    );
    onClose();
  }, [insights, onAddNodes, onClose, selected, t]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="interview-to-map-modal-heading"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-c-text-secondary" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="interview-to-map-modal-heading">
              {t('ideas.mindmap.interviewsMap', 'Interviews → Map')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-c-text-secondary hover:text-c-text-secondary dark:hover:text-c-text hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-c-text-secondary" />
              <span className="text-[11px] text-c-text-secondary">
                {t('ideas.mindmap.findingInsights', 'Finding insights...')}
              </span>
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare
                size={32}
                className="text-c-text-secondary dark:text-c-text-muted mx-auto mb-3"
              />
              <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted">
                {t('ideas.mindmap.noInsightsImport', 'No insights to import')}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {insights.map((insight) => {
                const branchKey = CATEGORY_TO_BRANCH[insight.category] || 'evidence';
                return (
                  <label
                    key={insight.id}
                    className="flex items-start gap-2.5 p-3 rounded-xl hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(insight.id)}
                      onChange={() => toggleInsight(insight.id)}
                      className="mt-0.5 rounded border-c-border-subtle text-c-text-secondary focus:ring-c-border"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-c-text-secondary dark:text-c-text">
                        {insight.text}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-c-surface dark:bg-c-surface-raised text-c-text-secondary dark:text-c-text">
                          {insight.category.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[9px] text-c-text-secondary">→ {branchKey}</span>
                        {insight.confidence != null && (
                          <span className="text-[8px] text-c-text-secondary">
                            {Math.round(insight.confidence * 100)}%
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
          >
            {t('ideas.mindmap.cancel', 'Cancel')}
          </button>
          <button
            onClick={handleApply}
            disabled={selected.size === 0 || locked}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-c-surface dark:bg-c-surface-raised text-c-text dark:text-c-text-secondary hover:bg-c-surface dark:hover:bg-c-surface-raised transition-all disabled:opacity-40"
          >
            <Zap size={12} />
            {t('ideas.mindmap.importNInsights', 'Import {{count}} insights', {
              count: selected.size,
            })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewToMap;
