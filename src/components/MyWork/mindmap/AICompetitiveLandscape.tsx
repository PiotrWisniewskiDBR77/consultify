/**
 * AICompetitiveLandscape — AI generates a competitive landscape map
 * based on the idea topic, showing competitors, positioning, and differentiators.
 */
import { Globe, Loader2, Plus, Sparkles, Trophy, X } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

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
      toast.success(isPl ? 'Dodano do mapy' : 'Added to map', { duration: 800 });
    },
    [isPl, onAddToMap]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-2xl rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div>
            <div className="flex items-center gap-2">
              <Globe size={16} className="text-blue-500" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {isPl ? 'AI: Krajobraz konkurencyjny' : 'AI: Competitive Landscape'}
              </h3>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {isPl
                ? 'AI identyfikuje konkurentów i pozycjonowanie rynkowe.'
                : 'AI identifies competitors and market positioning.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {competitors.length === 0 && !loading && (
            <div className="text-center py-8">
              <Trophy size={36} className="text-slate-600 dark:text-slate-400 mx-auto mb-3" />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
                {isPl
                  ? 'AI przeanalizuje krajobraz konkurencyjny dla Twojego pomysłu.'
                  : 'AI will analyze the competitive landscape for your idea.'}
              </p>
              <button
                onClick={analyze}
                disabled={loading || locked}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-500/15 to-indigo-500/10 text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:from-blue-500/25 hover:to-indigo-500/15 transition-all disabled:opacity-40"
              >
                <Sparkles size={14} />
                {isPl ? 'Analizuj konkurencję' : 'Analyze competition'}
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-blue-500" />
              <span className="text-[11px] text-slate-500">
                {isPl ? 'Analizuję rynek...' : 'Analyzing market...'}
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
                    className={`p-3 rounded-xl border transition-all ${isAdded ? 'border-emerald-400/30 bg-emerald-500/5' : 'border-slate-200/30 dark:border-navy-700/30 bg-slate-50/30 dark:bg-navy-950/10'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Globe size={12} className="text-blue-500" />
                        <span className="text-[12px] font-bold text-slate-700 dark:text-slate-200">
                          {comp.name}
                        </span>
                      </div>
                      {isAdded ? (
                        <span className="text-[9px] text-emerald-500 font-bold">ADDED</span>
                      ) : (
                        <button
                          onClick={() => handleAdd(comp)}
                          disabled={locked}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[9px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-40"
                        >
                          <Plus size={9} />
                          {isPl ? 'Dodaj' : 'Add'}
                        </button>
                      )}
                    </div>
                    {comp.positioning && (
                      <div className="text-[10px] text-slate-600 dark:text-slate-300 mb-2">
                        {comp.positioning}
                      </div>
                    )}
                    <div className="flex gap-3">
                      {comp.strengths.length > 0 && (
                        <div className="flex-1">
                          <div className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider mb-1">
                            {isPl ? 'Mocne' : 'Strengths'}
                          </div>
                          {comp.strengths.map((s, i) => (
                            <div key={i} className="text-[9px] text-slate-500 dark:text-slate-400">
                              + {s}
                            </div>
                          ))}
                        </div>
                      )}
                      {comp.weaknesses.length > 0 && (
                        <div className="flex-1">
                          <div className="text-[8px] font-bold text-danger-600 uppercase tracking-wider mb-1">
                            {isPl ? 'Slabe' : 'Weaknesses'}
                          </div>
                          {comp.weaknesses.map((w, i) => (
                            <div key={i} className="text-[9px] text-slate-500 dark:text-slate-400">
                              - {w}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {comp.differentiator && (
                      <div className="mt-2 pt-2 border-t border-slate-200/20 dark:border-navy-700/20">
                        <span className="text-[8px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                          {isPl ? 'Nasz wyróżnik' : 'Our edge'}:{' '}
                        </span>
                        <span className="text-[9px] text-slate-600 dark:text-slate-400">
                          {comp.differentiator}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}

              <div className="flex items-center gap-2 pt-2 border-t border-slate-200/30 dark:border-navy-700/30">
                <button
                  onClick={analyze}
                  disabled={loading}
                  className="text-[10px] text-slate-500 hover:text-slate-700 transition-colors"
                >
                  {isPl ? 'Ponowna analiza' : 'Re-analyze'}
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
