/**
 * AICompetitiveLandscape — AI generates a competitive landscape map
 * based on the idea topic, showing competitors, positioning, and differentiators.
 */
import { Globe, Loader2, Plus, Sparkles, Trophy, X } from 'lucide-react';
import React, { useCallback, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useDialogA11y } from '@/components/ui/primitives/useDialogA11y';

import { Api } from '@/services/api';

interface Competitor {
  id: string;
  name: string;
  positioning: string;
  strengths: string[];
  weaknesses: string[];
  differentiator: string;
}

interface AICompetitiveLandscapeProps {
  open: boolean;
  onClose: () => void;
  ideaId: string;
  ideaTitle: string;
  nodes: Array<{ id: string; data: any }>;
  locked: boolean;
  onAddToMap: (items: Array<{ text: string; type: string }>) => void;
}

export const AICompetitiveLandscape: React.FC<AICompetitiveLandscapeProps> = ({
  open,
  onClose,
  ideaId,
  ideaTitle,
  nodes,
  locked,
  onAddToMap,
}) => {
  const { t, i18n } = useTranslation();

  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const analyze = useCallback(async () => {
    setLoading(true);
    try {
      const ideaLabels = nodes
        .filter((n) => n.id !== 'root' && !n.id.startsWith('branch-'))
        .map((n) => n.data?.label)
        .filter(Boolean)
        .join(', ');

      const res = await Api.getMyIdeaAISuggestions(ideaId, {
        seedText: `Analyze the competitive landscape for "${ideaTitle}". Context ideas: ${ideaLabels}. Identify 4-6 key competitors/alternatives. For each, provide name, market positioning, key strengths, weaknesses, and our differentiator against them.`,
        mapNodes: nodes.map((n) => ({
          id: n.id,
          type: 'idea',
          data: { label: n.data?.label, branchKey: n.data?.branchKey },
        })),
        activeTool: 'mindmap',
        language: i18n.language,
      });

      if (res?.suggestions && Array.isArray(res.suggestions)) {
        const parsed: Competitor[] = res.suggestions.slice(0, 6).map((s: any, idx: number) => ({
          id: `comp-${idx}`,
          name: s.text || `Competitor ${idx + 1}`,
          positioning: s.detail || '',
          strengths: s.strengths || [s.category || 'Market presence'],
          weaknesses: s.weaknesses || [],
          differentiator: s.differentiator || s.detail || '',
        }));
        setCompetitors(parsed);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to analyze competitive landscape');
    } finally {
      setLoading(false);
    }
  }, [i18n.language, ideaId, ideaTitle, nodes]);

  const handleAdd = useCallback(
    (comp: Competitor) => {
      onAddToMap([
        { text: `${comp.name}: ${comp.positioning}`, type: 'topics' },
        ...comp.strengths.map((s) => ({ text: `${comp.name} — ${s}`, type: 'findings' })),
      ]);
      setAdded((prev) => new Set([...prev, comp.id]));
      toast.success(t('ideas.mindmap.addedMap', 'Added to map'), { duration: 800 });
    },
    [onAddToMap]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  useDialogA11y({ open, onClose, containerRef });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-c-bg">
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="a-i-competitive-landscape-modal-heading"
        tabIndex={-1}
        className="w-full max-w-2xl rounded-2xl bg-c-surface-raised dark:bg-c-surface backdrop-blur-xl shadow-2xl overflow-hidden outline-none"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-c-border-subtle dark:border-c-border-subtle">
          <div>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-c-info" />
              <h3 className="text-sm font-bold text-c-text dark:text-c-text" id="a-i-competitive-landscape-modal-heading">
                {t('ideas.mindmap.aiCompetitiveLandscape', 'AI: Competitive Landscape')}
              </h3>
            </div>
            <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mt-1">
              {t(
                'ideas.mindmap.aiIdentifiesCompetitorsMarketPositioning',
                'AI identifies competitors and market positioning.'
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
          {competitors.length === 0 && !loading && (
            <div className="text-center py-8">
              <Trophy
                size={36}
                className="text-c-text-secondary dark:text-c-text-muted mx-auto mb-3"
              />
              <p className="text-[11px] text-c-text-secondary dark:text-c-text-muted mb-4">
                {t(
                  'ideas.mindmap.aiWillAnalyzeCompetitiveLandscapeYour',
                  'AI will analyze the competitive landscape for your idea.'
                )}
              </p>
              <button
                onClick={analyze}
                disabled={loading || locked}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-c-surface-raised text-[11px] font-bold text-c-info dark:text-c-info transition-all disabled:opacity-40"
              >
                <Sparkles size={14} />
                {t('ideas.mindmap.analyzeCompetition', 'Analyze competition')}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-c-info" />
              <span className="text-[11px] text-c-text-secondary">
                {t('ideas.mindmap.analyzingMarket', 'Analyzing market...')}
              </span>
            </div>
          )}

          {competitors.length > 0 && (
            <div className="space-y-3">
              {competitors.map((comp) => {
                const isAdded = added.has(comp.id);
                return (
                  <div
                    key={comp.id}
                    className={`p-3 rounded-xl border transition-all ${isAdded ? 'border-c-success bg-c-surface-raised' : 'border-c-border-subtle dark:border-c-border-subtle bg-c-surface-raised dark:bg-c-surface'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Globe size={12} className="text-c-info" />
                        <span className="text-[12px] font-bold text-c-text-secondary dark:text-c-text">
                          {comp.name}
                        </span>
                      </div>
                      {isAdded ? (
                        <span className="text-[9px] text-c-success font-bold">ADDED</span>
                      ) : (
                        <button
                          onClick={() => handleAdd(comp)}
                          disabled={locked}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold text-c-info dark:text-c-info hover:bg-c-surface-raised transition-colors disabled:opacity-40"
                        >
                          <Plus size={9} />
                          {t('ideas.mindmap.add', 'Add')}
                        </button>
                      )}
                    </div>
                    {comp.positioning && (
                      <div className="text-[10px] text-c-text-secondary dark:text-c-text-muted mb-2">
                        {comp.positioning}
                      </div>
                    )}
                    <div className="flex gap-3">
                      {comp.strengths.length > 0 && (
                        <div className="flex-1">
                          <div className="text-[8px] font-bold text-c-success uppercase tracking-wider mb-1">
                            {t('ideas.mindmap.strengths', 'Strengths')}
                          </div>
                          {comp.strengths.map((s, i) => (
                            <div
                              key={i}
                              className="text-[9px] text-c-text-secondary dark:text-c-text-muted"
                            >
                              + {s}
                            </div>
                          ))}
                        </div>
                      )}
                      {comp.weaknesses.length > 0 && (
                        <div className="flex-1">
                          <div className="text-[8px] font-bold text-c-danger uppercase tracking-wider mb-1">
                            {t('ideas.mindmap.weaknesses', 'Weaknesses')}
                          </div>
                          {comp.weaknesses.map((w, i) => (
                            <div
                              key={i}
                              className="text-[9px] text-c-text-secondary dark:text-c-text-muted"
                            >
                              - {w}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {comp.differentiator && (
                      <div className="mt-2 pt-2 border-t border-c-border-subtle dark:border-c-border-subtle">
                        <span className="text-[8px] font-bold text-c-text-secondary dark:text-c-text-muted uppercase tracking-wider">
                          {t('ideas.mindmap.ourEdge', 'Our edge')}:{' '}
                        </span>
                        <span className="text-[9px] text-c-text-secondary dark:text-c-text-muted">
                          {comp.differentiator}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center gap-2 pt-2 border-t border-c-border-subtle dark:border-c-border-subtle">
                <button
                  onClick={analyze}
                  disabled={loading}
                  className="text-[10px] text-c-text-secondary hover:text-c-text-secondary transition-colors"
                >
                  {t('ideas.mindmap.reAnalyze', 'Re-analyze')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AICompetitiveLandscape;
