/**
 * InterviewToMap — Import interview insights as mind map nodes.
 * Fetches from the interview module and maps findings to branches.
 */
import { Loader2, MessageSquare, Sparkles, X, Zap } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

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
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

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
          source: s.source || (isPl ? 'Wywiady' : 'Interviews'),
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
  }, [i18n.language, ideaId, ideaTitle, isPl]);

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
      isPl
        ? `Dodano ${selectedInsights.length} insightów`
        : `Added ${selectedInsights.length} insights`,
      { duration: 1500 }
    );
    onClose();
  }, [insights, isPl, onAddNodes, onClose, selected]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-lg rounded-2xl bg-white/95 dark:bg-navy-900/95 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between px-5 py-4 border-b border-slate-200/60 dark:border-navy-700/60">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">
              {isPl ? 'Wywiady → Mapa' : 'Interviews → Map'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-600 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <Loader2 size={16} className="animate-spin text-slate-500" />
              <span className="text-[11px] text-slate-500">
                {isPl ? 'Szukam insightów...' : 'Finding insights...'}
              </span>
            </div>
          ) : insights.length === 0 ? (
            <div className="text-center py-8">
              <MessageSquare
                size={32}
                className="text-slate-600 dark:text-slate-400 mx-auto mb-3"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isPl ? 'Brak insightów do zaimportowania' : 'No insights to import'}
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {insights.map((insight) => {
                const branchKey = CATEGORY_TO_BRANCH[insight.category] || 'evidence';
                return (
                  <label
                    key={insight.id}
                    className="flex items-start gap-2.5 p-3 rounded-xl hover:bg-slate-100/60 dark:hover:bg-white/[0.03] transition-colors cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(insight.id)}
                      onChange={() => toggleInsight(insight.id)}
                      className="mt-0.5 rounded border-slate-300 text-slate-600 focus:ring-slate-400"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                        {insight.text}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900/[0.06] dark:bg-white/[0.10] text-slate-700 dark:text-slate-200">
                          {insight.category.replace(/_/g, ' ')}
                        </span>
                        <span className="text-[9px] text-slate-600">→ {branchKey}</span>
                        {insight.confidence != null && (
                          <span className="text-[8px] text-slate-600">
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

        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-300/60 dark:border-navy-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <button
            onClick={handleApply}
            disabled={selected.size === 0 || locked}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 dark:bg-white text-white dark:text-navy-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all disabled:opacity-40"
          >
            <Zap size={12} />
            {isPl ? `Importuj ${selected.size} insightów` : `Import ${selected.size} insights`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InterviewToMap;
