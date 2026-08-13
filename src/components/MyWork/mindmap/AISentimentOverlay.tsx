/**
 * AISentimentOverlay — Analyzes sentiment of nodes using company data context
 * and applies color coding (positive/neutral/negative).
 */
import { Loader2, SmilePlus, Sparkles, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { Api } from '@/services/api';

export interface SentimentResult {
  nodeId: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  score: number; // -1 to 1
  reason?: string;
}

interface AISentimentOverlayProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  nodes: Array<{ id: string; data: any }>;
  locked: boolean;
  onApplySentiment: (results: SentimentResult[]) => void;
}

const SENTIMENT_CONFIG = {
  positive: { bg: 'bg-c-surface-raised', text: 'text-c-success', emoji: '😊' },
  neutral: { bg: 'bg-c-surface-raised', text: 'text-c-text-secondary', emoji: '😐' },
  negative: { bg: 'bg-c-surface-raised', text: 'text-c-danger', emoji: '😟' },
};

export const AISentimentOverlay: React.FC<AISentimentOverlayProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  nodes,
  locked,
  onApplySentiment,
}) => {
  const { t, i18n } = useTranslation();

  const [results, setResults] = useState<SentimentResult[]>([]);
  const [loading, setLoading] = useState(false);

  const analyzeSentiment = useCallback(async () => {
    setLoading(true);
    try {
      const ideaNodes = nodes.filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'));
      const labels = ideaNodes.map((n) => `"${n.data?.label || n.id}"`).join(', ');

      const res = await Api.getMyIdeaAISuggestions(ideaId, {
        seedText: `Analyze sentiment of these ideas for "${ideaTitle}" based on company context (assessment findings, interview insights, KPI trends). Ideas: ${labels}. For each, determine if the sentiment from company data is positive, neutral, or negative.`,
        mapNodes: nodes.map((n) => ({
          id: n.id,
          type: 'idea',
          data: { label: n.data?.label, branchKey: n.data?.branchKey },
        })),
        activeTool: 'mindmap',
        language: i18n.language,
      });

      if (res?.suggestions && Array.isArray(res.suggestions)) {
        const sentiments: SentimentResult[] = res.suggestions
          .slice(0, ideaNodes.length)
          .map((s: any, idx: number) => {
            const node = ideaNodes[idx];
            const confidence = s.confidence ?? 0.5;
            const sentiment: SentimentResult['sentiment'] =
              confidence > 0.6 ? 'positive' : confidence > 0.35 ? 'neutral' : 'negative';
            return {
              nodeId: node?.id || `unknown-${idx}`,
              sentiment,
              score: confidence > 0.5 ? confidence : -(1 - confidence),
              reason: s.detail || s.text || '',
            };
          });
        setResults(sentiments);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to analyze sentiment');
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, ideaTitle, nodes]);

  const handleApply = useCallback(() => {
    onApplySentiment(results);
    toast.success(t('ideas.mindmap.sentimentApplied', 'Sentiment applied'), { duration: 1200 });
    onClose();
  }, [onApplySentiment, onClose, results]);

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  const counts = { positive: 0, neutral: 0, negative: 0 };
  for (const r of results) counts[r.sentiment]++;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="a-i-sentiment-overlay-modal-heading"
        tabIndex={-1}
        className="w-full max-w-lg rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div className="flex items-center gap-2">
            <SmilePlus size={16} className="text-c-success" />
            <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="a-i-sentiment-overlay-modal-heading">
              {t('ideas.mindmap.aiSentimentAnalysis', 'AI: Sentiment Analysis')}
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
          {results.length === 0 && !loading && (
            <div className="text-center py-8">
              <SmilePlus
                size={36}
                className="text-c-text-secondary dark:text-c-text-muted mx-auto mb-3"
              />
              <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mb-4">
                {t(
                  'ideas.mindmap.aiWillAssessIdeaSentimentBased',
                  'AI will assess idea sentiment based on company data.'
                )}
              </p>
              <button
                onClick={analyzeSentiment}
                disabled={loading || locked}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised text-[11px] font-bold text-c-success dark:text-c-success transition-all disabled:opacity-40"
              >
                <Sparkles size={14} />
                {t('ideas.mindmap.analyzeSentiment', 'Analyze sentiment')}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-c-success" />
              <span className="text-[11px] text-c-text-secondary">
                {t('ideas.mindmap.analyzing', 'Analyzing...')}
              </span>
            </div>
          )}

          {results.length > 0 && (
            <>
              {/* Summary bar */}
              <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-c-surface-raised dark:bg-c-surface">
                {Object.entries(counts).map(([key, count]) => {
                  const cfg = SENTIMENT_CONFIG[key as keyof typeof SENTIMENT_CONFIG];
                  return (
                    <div key={key} className="flex items-center gap-1.5">
                      <span className="text-sm">{cfg.emoji}</span>
                      <span className={`text-[11px] font-bold ${cfg.text}`}>{count}</span>
                    </div>
                  );
                })}
                <div className="flex-1 h-2 rounded-full bg-c-surface-raised dark:bg-c-surface overflow-hidden flex">
                  {counts.positive > 0 && (
                    <div
                      className="h-full bg-c-success"
                      style={{ width: `${(counts.positive / results.length) * 100}%` }}
                    />
                  )}
                  {counts.neutral > 0 && (
                    <div
                      className="h-full bg-c-surface-raised"
                      style={{ width: `${(counts.neutral / results.length) * 100}%` }}
                    />
                  )}
                  {counts.negative > 0 && (
                    <div
                      className="h-full bg-c-danger"
                      style={{ width: `${(counts.negative / results.length) * 100}%` }}
                    />
                  )}
                </div>
              </div>

              {/* Results list */}
              <div className="space-y-1.5">
                {results.map((r) => {
                  const cfg = SENTIMENT_CONFIG[r.sentiment];
                  const node = nodes.find((n) => n.id === r.nodeId);
                  return (
                    <div
                      key={r.nodeId}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl ${cfg.bg} border border-c-border-subtle dark:border-c-border-subtle`}
                    >
                      <span className="text-sm shrink-0">{cfg.emoji}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-medium text-c-text-secondary dark:text-c-text truncate">
                          {node?.data?.label || r.nodeId}
                        </div>
                        {r.reason && (
                          <div className="text-[9px] text-c-text-secondary dark:text-c-text-muted mt-0.5 truncate">
                            {r.reason}
                          </div>
                        )}
                      </div>
                      <div className={`text-[10px] font-bold ${cfg.text}`}>{r.sentiment}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {results.length > 0 && (
          <div className="px-5 py-3 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle dark:border-c-border-subtle text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface transition-colors"
            >
              {t('ideas.mindmap.close', 'Close')}
            </button>
            <button
              onClick={handleApply}
              disabled={locked}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-c-surface-raised text-c-success dark:text-c-success border border-c-success transition-all disabled:opacity-40"
            >
              <SmilePlus size={12} />
              {t('ideas.mindmap.applyColors', 'Apply colors')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AISentimentOverlay;
