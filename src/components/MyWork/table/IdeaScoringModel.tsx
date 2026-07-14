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
  const { t, i18n } = useTranslation();
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
        breakdown.push({
          colKey: w.colKey,
          rawValue: raw,
          normalizedValue: normalized,
          weightedValue: weighted,
        });
      }

      return { node, score: Math.round(totalScore * 100), rank: 0, breakdown };
    });

    scored.sort((a, b) => b.score - a.score);
    scored.forEach((s, i) => {
      s.rank = i + 1;
    });
    return scored;
  }, [nodes, scorableColumns, totalWeight, weights]);

  const handleWeightChange = useCallback((colKey: string, value: number) => {
    setWeights((prev) => prev.map((w) => (w.colKey === colKey ? { ...w, weight: value } : w)));
  }, []);

  const handleToggleInvert = useCallback((colKey: string) => {
    setWeights((prev) => prev.map((w) => (w.colKey === colKey ? { ...w, invert: !w.invert } : w)));
  }, []);

  const handleReset = useCallback(() => {
    setWeights(
      scorableColumns.map((c) => ({
        colKey: c.key,
        weight: Math.round(100 / scorableColumns.length),
        invert: false,
      }))
    );
  }, [scorableColumns]);

  const handleAICalibrate = useCallback(async () => {
    setAiLoading(true);
    try {
      const { Api } = await import('@/services/api');
      const result = await Api.getIdeaAISuggestions(ideaId, {
        context: {
          title: 'Scoring Calibration',
          seedText: `Columns: ${scorableColumns.map((c) => c.header).join(', ')}. Current weights: ${weights.map((w) => `${w.colKey}=${w.weight}%`).join(', ')}`,
          currentNodes: nodes
            .slice(0, 10)
            .map((n) => ({ id: n.id, type: n.type, label: n.data?.label })),
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
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-[560px] max-w-[90vw] max-h-[85vh] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-c-border-subtle">
          <Trophy size={16} className="text-amber-500" />
          <span className="text-sm font-bold text-c-text">
            {isPl ? 'Model scoringowy pomysłów' : 'Idea Scoring Model'}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        {/* Weight configuration */}
        <div className="px-5 py-4 border-b border-c-border-subtle">
          <div className="flex items-center gap-2 mb-3">
            <Sliders size={12} className="text-c-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
              {isPl ? 'Wagi kryteriów' : 'Criteria Weights'}
            </span>
            <div className="flex-1" />
            <button
              onClick={handleReset}
              className="p-1 rounded text-c-text-secondary hover:text-c-text-secondary transition-colors"
              title={t('table.ideaScoring.reset', 'Reset')}
            >
              <RotateCcw size={11} />
            </button>
            <button
              onClick={handleAICalibrate}
              disabled={aiLoading}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold text-c-accent bg-c-accent-soft hover:bg-c-accent-soft transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              {isPl ? 'AI kalibracja' : 'AI calibrate'}
            </button>
          </div>

          {scorableColumns.length === 0 ? (
            <p className="text-xs text-c-text-secondary text-center py-3">
              {isPl ? 'Brak kolumn numerycznych do scoringu' : 'No numeric columns for scoring'}
            </p>
          ) : (
            <div className="space-y-2.5">
              {weights.map((w) => (
                <div key={w.colKey} className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-c-text w-24 truncate">
                    {getColHeader(w.colKey)}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={w.weight}
                    onChange={(e) => handleWeightChange(w.colKey, Number(e.target.value))}
                    className="flex-1 accent-c-info h-1.5"
                  />
                  <span className="text-[10px] font-bold text-c-text-secondary w-8 text-right">
                    {w.weight}%
                  </span>
                  <button
                    onClick={() => handleToggleInvert(w.colKey)}
                    className={`text-[8px] font-bold px-1.5 py-0.5 rounded transition-colors ${w.invert ? 'bg-amber-500/10 text-amber-600' : 'bg-c-surface-raised text-c-text-secondary'}`}
                    title={isPl ? 'Odwróć (niższe = lepsze)' : 'Invert (lower = better)'}
                  >
                    {w.invert ? '↓' : '↑'}
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                <div className="flex-1 h-1.5 rounded-full bg-c-border-subtle overflow-hidden">
                  <div
                    className="h-full rounded-full bg-c-surface transition-all"
                    style={{ width: `${Math.min(totalWeight, 100)}%` }}
                  />
                </div>
                <span
                  className={`text-[10px] font-bold ${totalWeight === 100 ? 'text-emerald-500' : 'text-amber-500'}`}
                >
                  {totalWeight}%
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Rankings */}
        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={12} className="text-c-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
              {isPl ? 'Ranking' : 'Rankings'} ({scoredNodes.length})
            </span>
          </div>

          {scoredNodes.length === 0 ? (
            <p className="text-xs text-c-text-secondary text-center py-4">
              {isPl ? 'Brak danych do scoringu' : 'No data to score'}
            </p>
          ) : (
            <div className="space-y-1.5">
              {scoredNodes.map((scored) => {
                const color =
                  scored.node.data?.color ||
                  ROW_ACCENT_COLORS[scored.rank % ROW_ACCENT_COLORS.length];
                return (
                  <div
                    key={scored.node.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-c-surface-raised hover:bg-c-surface-raised transition-colors"
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black flex-shrink-0 ${scored.rank <= 3 ? 'bg-amber-500/10 text-amber-600' : 'bg-c-border-subtle text-c-text-muted'}`}
                    >
                      {scored.rank <= 3 ? (
                        <Crown size={12} className="text-amber-500" />
                      ) : (
                        `#${scored.rank}`
                      )}
                    </div>
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <span className="text-[11px] font-medium text-c-text flex-1 truncate">
                      {scored.node.data?.label || scored.node.id}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <div className="w-16 h-1.5 rounded-full bg-c-border-subtle overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${scored.score}%`, backgroundColor: color }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-c-text-secondary w-8 text-right">
                        {scored.score}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-c-border-subtle flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-xs font-medium text-c-text-muted hover:bg-c-surface-raised transition-colors"
          >
            {isPl ? 'Anuluj' : 'Cancel'}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleApply}
            disabled={scoredNodes.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-c-accent-soft text-c-accent hover:bg-c-accent-soft transition-colors disabled:opacity-50"
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
