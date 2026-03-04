/**
 * IdeaScoringModel — Configurable weighted scoring system for ideas.
 *
 * Users define weights for numeric/rating columns, the model auto-calculates
 * a composite score and ranks all ideas. Supports AI-assisted weight calibration.
 */
import {
  BarChart3,
  Crown,
  Loader2,
  RotateCcw,
  Save,
  Sliders,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';
import { ROW_ACCENT_COLORS } from './tableTypes';

interface WeightConfig {
  colKey: string;
  weight: number;
  invert: boolean;
}

interface ScoredNode {
  node: TableNode;
  score: number;
  rank: number;
  breakdown: { colKey: string; rawValue: number; normalizedValue: number; weightedValue: number }[];
}

interface IdeaScoringModelProps {
  open: boolean;
  onClose: () => void;
  nodes: TableNode[];
  columns: ColumnDef[];
  ideaId: string;
  onApplyScores: (scores: { nodeId: string; score: number; rank: number }[]) => void;
}

const SCORABLE_TYPES = new Set(['number', 'rating', 'progress', 'currency']);

export const IdeaScoringModel: React.FC<IdeaScoringModelProps> = ({
  open,
  onClose,
  nodes,
  columns,
  ideaId,
  onApplyScores,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');

  const scorableColumns = useMemo(
    () => columns.filter((c) => SCORABLE_TYPES.has(c.type) && c.visible),
    [columns]
  );

  const [weights, setWeights] = useState<WeightConfig[]>(() =>
    scorableColumns.map((c) => ({
      colKey: c.key,
      weight: c.key === 'impact' ? 40 : c.key === 'effort' ? 30 : 20,
      invert: c.key === 'effort',
    }))
  );
  const [aiLoading, setAiLoading] = useState(false);

  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);

  const scoredNodes: ScoredNode[] = useMemo(() => {
    if (scorableColumns.length === 0 || nodes.length === 0) return [];

    const colStats = new Map<string, { min: number; max: number }>();
    for (const col of scorableColumns) {
      const vals = nodes.map((n) => Number(n.data?.[col.key]) || 0);
      colStats.set(col.key, { min: Math.min(...vals), max: Math.max(...vals) });
    }

    const scored = nodes.map((node) => {
      const breakdown: ScoredNode['breakdown'] = [];
      let totalScore = 0;

      for (const w of weights) {
        const raw = Number(node.data?.[w.colKey]) || 0;
        const stats = colStats.get(w.colKey);
        if (!stats) continue;
        const range = stats.max - stats.min || 1;
        let normalized = (raw - stats.min) / range;
        if (w.invert) normalized = 1 - normalized;
        const weighted = normalized * (w.weight / Math.max(totalWeight, 1));
        totalScore += weighted;
        breakdown.push({ colKey: w.colKey, rawValue: raw, normalizedValue: normalized, weightedValue: weighted });
      }

      return { node, score: Math.round(totalScore * 100), rank: 0, breakdown };
    });

    scored.sort((a, b) => b.score - a.score);
    scored.forEach((s, i) => { s.rank = i + 1; });
    return scored;
  }, [nodes, scorableColumns, totalWeight, weights]);

  const handleWeightChange = useCallback((colKey: string, value: number) => {
    setWeights((prev) => prev.map((w) => w.colKey === colKey ? { ...w, weight: value } : w));
  }, []);

  const handleToggleInvert = useCallback((colKey: string) => {
    setWeights((prev) => prev.map((w) => w.colKey === colKey ? { ...w, invert: !w.invert } : w));
  }, []);

  const handleReset = useCallback(() => {
    setWeights(scorableColumns.map((c) => ({
      colKey: c.key,
      weight: Math.round(100 / scorableColumns.length),
      invert: false,
    })));
  }, [scorableColumns]);

  const handleAICalibrate = useCallback(async () => {
    setAiLoading(true);
    try {
      const { Api } = await import('@/services/api');
      const result = await Api.getIdeaAISuggestions(ideaId, {
        context: {
          title: 'Scoring Calibration',
          seedText: `Columns: ${scorableColumns.map((c) => c.header).join(', ')}. Current weights: ${weights.map((w) => `${w.colKey}=${w.weight}%`).join(', ')}`,
          currentNodes: nodes.slice(0, 10).map((n) => ({ id: n.id, type: n.type, label: n.data?.label })),
          currentEdges: [],
          activeTool: 'table',
        },
        mode: 'on_demand',
        prompt: `Suggest optimal weights for scoring these ideas. Consider that higher impact and lower effort should score better. Return JSON: { "weights": [{ "colKey": "...", "weight": 0-100, "invert": true/false }] }`,
        language: i18n.language,
      });
      const text = (result?.suggestions || []).map((s: any) => s.text || s.detail || '').join('');
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (Array.isArray(parsed.weights)) {
          setWeights(parsed.weights.filter((w: any) => w.colKey && typeof w.weight === 'number'));
        }
      }
    } catch {
      // silent
    } finally {
      setAiLoading(false);
    }
  }, [i18n.language, ideaId, nodes, scorableColumns, weights]);

  const handleApply = useCallback(() => {
    onApplyScores(scoredNodes.map((s) => ({ nodeId: s.node.id, score: s.score, rank: s.rank })));
    onClose();
  }, [onApplyScores, onClose, scoredNodes]);

  const getColHeader = (key: string) => columns.find((c) => c.key === key)?.header || key;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-[560px] max-w-[90vw] max-h-[85vh] rounded-2xl border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 shadow-2xl overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-200/60 dark:border-navy-700/60">
          <Trophy size={16} className="text-amber-500" />
          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
            {isPl ? 'Model scoringowy pomysłów' : 'Idea Scoring Model'}
          </span>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
            <X size={14} className="text-slate-400" />
          </button>
        </div>

        {/* Weight configuration */}
        <div className="px-5 py-4 border-b border-slate-200/30 dark:border-white/[0.04]">
          <div className="flex items-center gap-2 mb-3">
            <Sliders size={12} className="text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPl ? 'Wagi kryteriów' : 'Criteria Weights'}
            </span>
            <div className="flex-1" />
            <button onClick={handleReset} className="p-1 rounded text-slate-400 hover:text-slate-600 transition-colors" title="Reset">
              <RotateCcw size={11} />
            </button>
            <button
              onClick={handleAICalibrate}
              disabled={aiLoading}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              {isPl ? 'AI kalibracja' : 'AI calibrate'}
            </button>
          </div>

          {scorableColumns.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">{isPl ? 'Brak kolumn numerycznych do scoringu' : 'No numeric columns for scoring'}</p>
          ) : (
            <div className="space-y-2.5">
              {weights.map((w) => (
                <div key={w.colKey} className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 w-24 truncate">{getColHeader(w.colKey)}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={w.weight}
                    onChange={(e) => handleWeightChange(w.colKey, Number(e.target.value))}
                    className="flex-1 accent-violet-500 h-1.5"
                  />
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 w-8 text-right">{w.weight}%</span>
                  <button
                    onClick={() => handleToggleInvert(w.colKey)}
                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded transition-colors ${w.invert ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-100 dark:bg-navy-800 text-slate-400'}`}
                    title={isPl ? 'Odwróć (niższe = lepsze)' : 'Invert (lower = better)'}
                  >
                    {w.invert ? '↓' : '↑'}
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                  <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${Math.min(totalWeight, 100)}%` }} />
                </div>
                <span className={`text-[10px] font-bold ${totalWeight === 100 ? 'text-emerald-500' : 'text-amber-500'}`}>{totalWeight}%</span>
              </div>
            </div>
          )}
        </div>

        {/* Rankings */}
        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={12} className="text-slate-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {isPl ? 'Ranking' : 'Rankings'} ({scoredNodes.length})
            </span>
          </div>

          {scoredNodes.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">{isPl ? 'Brak danych do scoringu' : 'No data to score'}</p>
          ) : (
            <div className="space-y-1.5">
              {scoredNodes.map((scored) => {
                const color = scored.node.data?.color || ROW_ACCENT_COLORS[scored.rank % ROW_ACCENT_COLORS.length];
                return (
                  <div key={scored.node.id} className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50/80 dark:bg-navy-900/50 hover:bg-slate-100 dark:hover:bg-navy-800/50 transition-colors">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${scored.rank <= 3 ? 'bg-amber-500/10 text-amber-600' : 'bg-slate-200/60 dark:bg-navy-700 text-slate-500'}`}>
                      {scored.rank <= 3 ? <Crown size={12} className="text-amber-500" /> : `#${scored.rank}`}
                    </div>
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                    <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 flex-1 truncate">{scored.node.data?.label || scored.node.id}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-16 h-1.5 rounded-full bg-slate-200 dark:bg-navy-700 overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${scored.score}%`, backgroundColor: color }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 w-8 text-right">{scored.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200/60 dark:border-navy-700/60 flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors">
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleApply}
            disabled={scoredNodes.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 transition-colors disabled:opacity-50"
          >
            <Save size={12} />
            {isPl ? 'Zastosuj ranking' : 'Apply ranking'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdeaScoringModel;
