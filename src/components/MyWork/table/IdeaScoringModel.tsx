/**
 * IdeaScoringModel — Configurable weighted scoring system for ideas.
 *
 * Users define weights for numeric/rating columns, the model auto-calculates
 * a composite score and ranks all ideas. Supports AI-assisted weight calibration.
 *
 * ── CANON MODEL (Program D / epic E08, §6.3, 2026-08-10) ───────────────────
 * A "9 canon dimensions" toggle switches this modal from the original
 * free-form (pick-any-numeric-column) weighting to `ideaScoringGovernance`'s
 * fixed nine dimensions (strategic fit, customer/business value, financial
 * impact, urgency, confidence/evidence, delivery effort, implementation
 * risk, dependency complexity, compliance/security) — real weight
 * versioning (`reviseWeights`/`currentWeightVersion`, visible as "v{n}") and
 * `computeCompositeScore`'s per-idea-meaningful 0-10 scale (not portfolio
 * min-max), instead of the original ad hoc normalization. Applying writes
 * an append-only `data.scoreHistory` (via `appendComputedEvent`) alongside
 * `data.score`/`data.rank`, so "why is this score what it is" has a real
 * answer — see `ideaScoringGovernance.ts` header for what this closes.
 *
 * HONEST LIMITATION: the weight-version history lives in this component's
 * state only (like the original free-form weights already did) — it is
 * NOT persisted to a backend across reopens of this dialog. Row-level
 * results (`score`/`rank`/`scoreHistory`) DO persist, through the same
 * `nodesUndo`-backed realtime sync every other tool in `IdeaTableTool` uses.
 * A future idea-level persistence layer for the weight model itself is out
 * of this task's scope.
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

import {
  appendComputedEvent,
  computeCompositeScore,
  type CompositeScoreResult,
  createInitialWeightVersion,
  currentWeightVersion,
  defaultWeightSet,
  reviseWeights,
  SCORING_DIMENSIONS,
  type ScoreHistory,
  type ScoringWeightHistory,
} from './ideaScoringGovernance';
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
  /** Present only in canon mode — dimensions with a weight but no input for
   *  this idea, per `computeCompositeScore`'s honest-gap contract. */
  missingDimensions?: string[];
  /** Present only in canon mode — the raw engine result, carried through so
   *  `handleApply` can append a real, unmodified `ScoreHistoryEvent`. */
  compositeResult?: CompositeScoreResult;
}

interface IdeaScoringModelProps {
  open: boolean;
  onClose: () => void;
  nodes: TableNode[];
  columns: ColumnDef[];
  ideaId: string;
  onApplyScores: (
    scores: {
      nodeId: string;
      score: number;
      rank: number;
      /** Only set in canon mode — caller appends to the row's persisted
       *  `data.scoreHistory`. */
      canonHistoryEvent?: ScoreHistory[number];
      canonModelVersion?: number;
    }[]
  ) => void;
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

  // ── Canon model (9 dimensions, ideaScoringGovernance) ───────────────────
  const [canonMode, setCanonMode] = useState(false);
  const [weightHistory, setWeightHistory] = useState<ScoringWeightHistory>(() =>
    createInitialWeightVersion()
  );
  const activeWeightVersion = currentWeightVersion(weightHistory)!;

  const canonWeights = useMemo<WeightConfig[]>(
    () =>
      SCORING_DIMENSIONS.map((d) => ({
        colKey: d.key,
        weight: activeWeightVersion.weights[d.key] ?? d.defaultWeight,
        invert: d.lowerIsBetter,
      })),
    [activeWeightVersion]
  );

  const handleToggleCanonMode = useCallback(() => {
    setCanonMode((v) => !v);
  }, []);

  const totalWeight = (canonMode ? canonWeights : weights).reduce((s, w) => s + w.weight, 0);

  const scoredNodes: ScoredNode[] = useMemo(() => {
    if (nodes.length === 0) return [];

    if (canonMode) {
      const scored = nodes.map((node) => {
        const inputs: Record<string, number> = {};
        for (const d of SCORING_DIMENSIONS) {
          const raw = Number(node.data?.[d.key]);
          if (Number.isFinite(raw)) inputs[d.key] = raw;
        }
        const result = computeCompositeScore(inputs, activeWeightVersion);
        return {
          node,
          score: result.score,
          rank: 0,
          missingDimensions: result.missingDimensions,
          compositeResult: result,
          breakdown: result.breakdown.map((b) => ({
            colKey: b.dimension,
            rawValue: b.rawValue ?? 0,
            normalizedValue: b.normalizedValue ?? 0,
            weightedValue: b.contribution / 100,
          })),
        };
      });
      scored.sort((a, b) => b.score - a.score);
      scored.forEach((s, i) => {
        s.rank = i + 1;
      });
      return scored;
    }

    if (scorableColumns.length === 0) return [];

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
  }, [activeWeightVersion, canonMode, nodes, scorableColumns, totalWeight, weights]);

  const handleWeightChange = useCallback(
    (colKey: string, value: number) => {
      if (canonMode) {
        setWeightHistory((prev) =>
          reviseWeights(prev, { ...currentWeightVersion(prev)!.weights, [colKey]: value })
        );
        return;
      }
      setWeights((prev) => prev.map((w) => (w.colKey === colKey ? { ...w, weight: value } : w)));
    },
    [canonMode]
  );

  const handleToggleInvert = useCallback((colKey: string) => {
    // Canon dimensions have a fixed, model-defined lowerIsBetter — inversion
    // is not user-editable there (that is exactly what makes the composite
    // meaningful across ideas without per-user reinterpretation).
    setWeights((prev) => prev.map((w) => (w.colKey === colKey ? { ...w, invert: !w.invert } : w)));
  }, []);

  const handleReset = useCallback(() => {
    if (canonMode) {
      setWeightHistory((prev) => reviseWeights(prev, defaultWeightSet(), { note: 'Reset to defaults' }));
      return;
    }
    setWeights(
      scorableColumns.map((c) => ({
        colKey: c.key,
        weight: Math.round(100 / scorableColumns.length),
        invert: false,
      }))
    );
  }, [canonMode, scorableColumns]);

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
    onApplyScores(
      scoredNodes.map((s) => ({
        nodeId: s.node.id,
        score: s.score,
        rank: s.rank,
        canonHistoryEvent: s.compositeResult
          ? appendComputedEvent([], s.compositeResult)[0]
          : undefined,
        canonModelVersion: s.compositeResult?.modelVersion,
      }))
    );
    onClose();
  }, [onApplyScores, onClose, scoredNodes]);

  const canonDimensionLabel = (key: string): string | undefined => {
    const dim = SCORING_DIMENSIONS.find((d) => d.key === key);
    if (!dim) return undefined;
    return isPl ? dim.labelPl : dim.labelEn;
  };

  const getColHeader = (key: string) =>
    canonDimensionLabel(key) || columns.find((c) => c.key === key)?.header || key;

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
            {t('myWorkTable.ideaScoringModel.title')}
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
              {t('myWorkTable.ideaScoringModel.criteriaWeights')}
            </span>
            {canonMode && (
              <span
                className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-c-info/10 text-c-info"
                title={
                  isPl
                    ? 'Numer wersji wag — rośnie przy każdej zmianie (reviseWeights, append-only).'
                    : 'Weight version number — bumps on every change (reviseWeights, append-only).'
                }
              >
                v{activeWeightVersion.version}
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={handleToggleCanonMode}
              className={`px-2 py-1 rounded-lg text-[9px] font-bold transition-colors ${canonMode ? 'bg-c-text text-c-surface' : 'bg-c-surface-raised text-c-text-secondary'}`}
              title={
                isPl
                  ? 'Model kanoniczny: 9 stałych wymiarów (§6.3), wersjonowane wagi, skala 0-10 per idea.'
                  : 'Canon model: 9 fixed dimensions (§6.3), versioned weights, per-idea 0-10 scale.'
              }
            >
              {isPl ? '9 wymiarów' : '9 dimensions'}
            </button>
            <button
              onClick={handleReset}
              className="p-1 rounded text-c-text-secondary hover:text-c-text-secondary transition-colors"
              title={t('ideas.table.ideaScoring.reset', 'Reset')}
            >
              <RotateCcw size={11} />
            </button>
            <button
              onClick={handleAICalibrate}
              disabled={aiLoading || canonMode}
              title={
                canonMode
                  ? isPl
                    ? 'Niedostępne w modelu kanonicznym — wagi tych dziewięciu wymiarów są stałą częścią modelu.'
                    : 'Not available in canon mode — the nine dimension weights are a fixed part of the model.'
                  : undefined
              }
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-bold bg-c-text text-c-surface hover:bg-c-text/90 transition-colors disabled:opacity-50"
            >
              {aiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              {t('myWorkTable.ideaScoringModel.aiCalibrate')}
            </button>
          </div>

          {!canonMode && scorableColumns.length === 0 ? (
            <p className="text-xs text-c-text-secondary text-center py-3">
              {t('myWorkTable.ideaScoringModel.noNumericColumns')}
            </p>
          ) : (
            <div className="space-y-2.5">
              {(canonMode ? canonWeights : weights).map((w) => (
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
                  {canonMode ? (
                    <span
                      className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-c-surface-raised text-c-text-muted"
                      title={
                        isPl
                          ? 'Kierunek ustalony przez model (nie do edycji w tym wymiarze).'
                          : 'Direction fixed by the model (not editable for this dimension).'
                      }
                    >
                      {w.invert ? '↓' : '↑'}
                    </span>
                  ) : (
                    <button
                      onClick={() => handleToggleInvert(w.colKey)}
                      className={`text-[8px] font-bold px-1.5 py-0.5 rounded transition-colors ${w.invert ? 'bg-amber-500/10 text-amber-600' : 'bg-c-surface-raised text-c-text-secondary'}`}
                      title={t('myWorkTable.ideaScoringModel.invertHint')}
                    >
                      {w.invert ? '↓' : '↑'}
                    </button>
                  )}
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
              {canonMode && (
                <p className="text-[10px] text-c-text-muted italic">
                  {isPl
                    ? 'Brakujące wymiary są pomijane i wagi są przeliczane tylko na podane — patrz „Potrzebne dane" przy każdej idei.'
                    : 'Missing dimensions are excluded and weights are renormalized across the ones provided — see "Needs input" per idea.'}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Rankings */}
        <div className="flex-1 overflow-auto px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={12} className="text-c-text-muted" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-c-text-muted">
              {t('myWorkTable.ideaScoringModel.rankings')} ({scoredNodes.length})
            </span>
          </div>

          {scoredNodes.length === 0 ? (
            <p className="text-xs text-c-text-secondary text-center py-4">
              {t('myWorkTable.ideaScoringModel.noDataToScore')}
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
                    {canonMode && (scored.missingDimensions?.length ?? 0) > 0 && (
                      <span
                        className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-c-warning/10 text-c-warning shrink-0"
                        title={
                          isPl
                            ? `Brak danych dla: ${scored.missingDimensions!.map((k) => canonDimensionLabel(k) || k).join(', ')}`
                            : `Missing input for: ${scored.missingDimensions!.map((k) => canonDimensionLabel(k) || k).join(', ')}`
                        }
                      >
                        {isPl ? 'Potrzebne dane' : 'Needs input'}
                      </span>
                    )}
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
            {t('myWorkTable.ideaScoringModel.cancel')}
          </button>
          <div className="flex-1" />
          <button
            onClick={handleApply}
            disabled={scoredNodes.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-c-text text-c-surface hover:bg-c-text/90 transition-colors disabled:opacity-50"
          >
            <Save size={12} />
            {t('myWorkTable.ideaScoringModel.applyRanking')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default IdeaScoringModel;
