/**
 * ComparisonMatrixRenderer - Enterprise scenario comparison visualization
 *
 * Renders a weighted decision matrix for comparing options side-by-side.
 * Designed for BCG/McKinsey-level decision support:
 * - Options as columns, criteria as rows
 * - Color-coded scoring (red/amber/green)
 * - Weighted total scores
 * - Visual "recommended" badge
 * - Export to CSV
 *
 * Expected JSON format:
 * {
 *   "title": "Strategy Comparison",
 *   "options": [
 *     { "id": "A", "name": "Option A", "description": "..." },
 *     { "id": "B", "name": "Option B", "description": "..." }
 *   ],
 *   "criteria": [
 *     { "name": "Cost", "weight": 0.3 },
 *     { "name": "Time to market", "weight": 0.25 },
 *     { "name": "Risk", "weight": 0.25 },
 *     { "name": "Strategic fit", "weight": 0.2 }
 *   ],
 *   "scores": {
 *     "A": { "Cost": { "value": 7, "label": "$2M", "note": "High initial CAPEX" } },
 *     "B": { "Cost": { "value": 9, "label": "$800K", "note": "Lower initial cost" } }
 *   },
 *   "recommendation": "B"
 * }
 */

import { ArrowRight, Award, Check, Copy, Download, Star } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ==========================================
// TYPES
// ==========================================

interface MatrixOption {
  id: string;
  name: string;
  description?: string;
}

interface MatrixCriterion {
  name: string;
  weight: number;
}

interface MatrixScore {
  value: number; // 1-10
  label?: string;
  note?: string;
}

interface ComparisonMatrixData {
  title?: string;
  options: MatrixOption[];
  criteria: MatrixCriterion[];
  scores: Record<string, Record<string, MatrixScore>>;
  recommendation?: string;
}

interface ComparisonMatrixRendererProps {
  content: string;
  className?: string;
}

// ==========================================
// HELPERS
// ==========================================

function parseMatrixContent(content: string): ComparisonMatrixData | null {
  try {
    const data = JSON.parse(content);
    if (data.options && data.criteria && data.scores) {
      return data as ComparisonMatrixData;
    }
    return null;
  } catch {
    return null;
  }
}

function getScoreColor(value: number): string {
  if (value >= 8) return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300';
  if (value >= 5) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300';
  return 'bg-danger-100 dark:bg-danger-900/30 text-danger-700 dark:text-danger-300';
}

function getScoreBarColor(value: number): string {
  if (value >= 8) return 'bg-green-500';
  if (value >= 5) return 'bg-amber-500';
  return 'bg-danger-500';
}

function calculateWeightedTotal(
  optionId: string,
  criteria: MatrixCriterion[],
  scores: Record<string, Record<string, MatrixScore>>
): number {
  const optionScores = scores[optionId] || {};
  let total = 0;
  let totalWeight = 0;

  for (const criterion of criteria) {
    const score = optionScores[criterion.name];
    if (score) {
      total += score.value * criterion.weight;
      totalWeight += criterion.weight;
    }
  }

  return totalWeight > 0 ? Math.round((total / totalWeight) * 10) / 10 : 0;
}

// ==========================================
// COMPONENT
// ==========================================

export const ComparisonMatrixRenderer: React.FC<ComparisonMatrixRendererProps> = ({
  content,
  className = '',
}) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const data = useMemo(() => parseMatrixContent(content), [content]);

  const weightedTotals = useMemo(() => {
    if (!data) return {};
    const totals: Record<string, number> = {};
    for (const option of data.options) {
      totals[option.id] = calculateWeightedTotal(option.id, data.criteria, data.scores);
    }
    return totals;
  }, [data]);

  const bestOptionId = useMemo(() => {
    if (!data) return null;
    // Use recommendation if provided, otherwise highest score
    if (data.recommendation) return data.recommendation;
    let best = '';
    let bestScore = -1;
    for (const [id, score] of Object.entries(weightedTotals)) {
      if (score > bestScore) {
        bestScore = score;
        best = id;
      }
    }
    return best;
  }, [data, weightedTotals]);

  const handleCopy = useCallback(async () => {
    if (!data) return;
    try {
      const headers = ['Criterion', 'Weight', ...data.options.map((o) => o.name)];
      const rows = data.criteria.map((c) => [
        c.name,
        `${(c.weight * 100).toFixed(0)}%`,
        ...data.options.map((o) => {
          const s = data.scores[o.id]?.[c.name];
          return s ? `${s.value}/10${s.label ? ` (${s.label})` : ''}` : '—';
        }),
      ]);
      const totalRow = [
        'WEIGHTED TOTAL',
        '',
        ...data.options.map((o) => `${weightedTotals[o.id]}/10`),
      ];
      const tsv = [headers, ...rows, totalRow].map((r) => r.join('\t')).join('\n');
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }, [data, weightedTotals]);

  const handleExportCSV = useCallback(() => {
    if (!data) return;
    const headers = ['Criterion', 'Weight', ...data.options.map((o) => o.name)];
    const rows = data.criteria.map((c) => [
      c.name,
      `${(c.weight * 100).toFixed(0)}%`,
      ...data.options.map((o) => {
        const s = data.scores[o.id]?.[c.name];
        return s ? `${s.value}` : '';
      }),
    ]);
    const totalRow = ['WEIGHTED TOTAL', '', ...data.options.map((o) => `${weightedTotals[o.id]}`)];
    const csv = [headers, ...rows, totalRow]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `comparison-matrix-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [data, weightedTotals]);

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center text-slate-500 dark:text-slate-400">
        <p>{t('matrix.parseError', 'Unable to parse comparison matrix data')}</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-navy-900 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800/50">
        <div className="flex items-center gap-2">
          <Award size={16} className="text-c-text-secondary" />
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {data.title || t('matrix.title', 'Scenario Comparison')}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded"
          >
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
            {copied ? t('common.copied', 'Copied!') : t('common.copy', 'Copy')}
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-navy-700 rounded"
          >
            <Download size={12} />
            CSV
          </button>
        </div>
      </div>

      {/* Option descriptions */}
      <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.options.map((option) => (
          <div
            key={option.id}
            className={`px-3 py-2 rounded-lg border text-xs ${
              option.id === bestOptionId
                ? 'bg-c-surface-raised dark:bg-c-surface-raised border-c-border dark:border-c-border'
                : 'bg-white dark:bg-navy-950 border-slate-200 dark:border-navy-700'
            }`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              {option.id === bestOptionId && (
                <Star size={12} className="text-c-text-secondary fill-c-text-secondary" />
              )}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {option.name}
              </span>
              {option.id === bestOptionId && (
                <span className="ml-auto text-[10px] font-medium text-c-text-secondary dark:text-c-text-secondary bg-c-surface-raised dark:bg-c-surface-raised px-1.5 py-0.5 rounded">
                  {t('matrix.recommended', 'RECOMMENDED')}
                </span>
              )}
            </div>
            {option.description && (
              <p className="text-slate-500 dark:text-slate-400 line-clamp-2">
                {option.description}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Matrix Table */}
      <div className="flex-1 overflow-auto">
        <table
          /* §27-exempt: macierz/komorki kalkulacyjne, osobny spec matrix-editor */ className="min-w-full divide-y divide-slate-200 dark:divide-navy-700"
        >
          <thead className="bg-slate-50 dark:bg-navy-800 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider w-1/4">
                {t('matrix.criterion', 'Criterion')}
              </th>
              <th className="px-3 py-3 text-center text-[11px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider w-16">
                {t('matrix.weight', 'Weight')}
              </th>
              {data.options.map((option) => (
                <th
                  key={option.id}
                  className={`px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider ${
                    option.id === bestOptionId
                      ? 'text-c-text-secondary dark:text-c-text-secondary bg-c-surface-raised dark:bg-c-surface-raised'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {option.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-navy-700">
            {data.criteria.map((criterion) => (
              <tr key={criterion.name} className="hover:bg-slate-50/50 dark:hover:bg-navy-800/30">
                <td className="px-4 py-3">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    {criterion.name}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                    {(criterion.weight * 100).toFixed(0)}%
                  </span>
                </td>
                {data.options.map((option) => {
                  const score = data.scores[option.id]?.[criterion.name];
                  if (!score) {
                    return (
                      <td key={option.id} className="px-4 py-3 text-center text-xs text-slate-600">
                        —
                      </td>
                    );
                  }
                  return (
                    <td
                      key={option.id}
                      className={`px-4 py-3 ${
                        option.id === bestOptionId ? 'bg-c-surface-raised dark:bg-c-surface-raised' : ''
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${getScoreColor(score.value)}`}
                          >
                            {score.value}
                          </span>
                          {score.label && (
                            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                              {score.label}
                            </span>
                          )}
                        </div>
                        {/* Score bar */}
                        <div className="w-full max-w-[80px] h-1 bg-slate-200 dark:bg-navy-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getScoreBarColor(score.value)}`}
                            style={{ width: `${score.value * 10}%` }}
                          />
                        </div>
                        {score.note && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 text-center line-clamp-1">
                            {score.note}
                          </span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Weighted total row */}
            <tr className="bg-slate-100 dark:bg-navy-800 font-semibold">
              <td className="px-4 py-3">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase">
                  {t('matrix.weightedTotal', 'Weighted Total')}
                </span>
              </td>
              <td className="px-3 py-3" />
              {data.options.map((option) => {
                const total = weightedTotals[option.id] || 0;
                const isBest = option.id === bestOptionId;
                return (
                  <td
                    key={option.id}
                    className={`px-4 py-3 text-center ${isBest ? 'bg-c-surface-raised dark:bg-c-surface-raised' : ''}`}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className={`text-lg font-bold tabular-nums ${
                          isBest
                            ? 'text-c-text-secondary dark:text-c-text-secondary'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {total.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">/ 10</span>
                    </div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Recommendation footer */}
      {bestOptionId && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-navy-700 bg-c-surface-raised dark:bg-c-surface-raised">
          <div className="flex items-center gap-2 text-xs">
            <ArrowRight size={14} className="text-c-text-secondary" />
            <span className="font-medium text-c-text-secondary dark:text-c-text-secondary">
              {t('matrix.recommendationLabel', 'Recommendation')}:
            </span>
            <span className="text-slate-700 dark:text-slate-200 font-semibold">
              {data.options.find((o) => o.id === bestOptionId)?.name || bestOptionId}
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              ({weightedTotals[bestOptionId]?.toFixed(1)}/10)
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ComparisonMatrixRenderer;
