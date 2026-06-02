/**
 * MatrixHeatmap
 *
 * Rich visual renderer for assessment matrix data.
 * Replaces the basic table with a color-coded heatmap showing:
 * - Score per axis with color gradient
 * - Gap visualization (current vs target)
 * - Interactive hover details
 * - Sparkline mini-bars
 */

import React, { useMemo } from 'react';

// ==========================================
// TYPES
// ==========================================

interface MatrixAxis {
  axisId?: string;
  axisName: string;
  score: number;
  maxScore?: number;
  targetScore?: number;
  gap?: number;
  areas?: { name: string; score: number; maxScore?: number }[];
}

interface MatrixData {
  type: 'assessment_matrix';
  axes: MatrixAxis[];
  scaleMax: number;
  overallScore?: number;
  overallMax?: number;
}

interface MatrixHeatmapProps {
  data: MatrixData;
  primaryColor?: string;
  accentColor?: string;
  compact?: boolean;
}

// ==========================================
// HELPERS
// ==========================================

function getScoreColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.8) return 'bg-emerald-500';
  if (pct >= 0.6) return 'bg-blue-500';
  if (pct >= 0.4) return 'bg-amber-500';
  if (pct >= 0.2) return 'bg-amber-500';
  return 'bg-rose-500';
}

function getScoreTextColor(score: number, max: number): string {
  const pct = score / max;
  if (pct >= 0.8) return 'text-emerald-600 dark:text-emerald-400';
  if (pct >= 0.6) return 'text-blue-600 dark:text-blue-400';
  if (pct >= 0.4) return 'text-amber-600 dark:text-amber-400';
  if (pct >= 0.2) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function getGapSeverity(gap: number): { label: string; color: string } {
  if (gap <= 0.5)
    return { label: 'Minimal', color: 'text-green-600 bg-green-50 dark:bg-green-900/30' };
  if (gap <= 1.5)
    return { label: 'Moderate', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' };
  if (gap <= 2.5)
    return { label: 'Significant', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' };
  return { label: 'Critical', color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30' };
}

// ==========================================
// COMPONENT
// ==========================================

export const MatrixHeatmap: React.FC<MatrixHeatmapProps> = ({
  data,
  primaryColor = '#3b82f6',
  compact = false,
}) => {
  const sortedAxes = useMemo(() => [...data.axes].sort((a, b) => b.score - a.score), [data.axes]);

  const overallPct =
    data.overallScore && data.overallMax
      ? Math.round((data.overallScore / data.overallMax) * 100)
      : Math.round(
          (sortedAxes.reduce((s, a) => s + a.score, 0) / (sortedAxes.length * data.scaleMax)) * 100
        );

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-slate-50 to-blue-50 dark:from-slate-800/50 dark:to-blue-900/20 rounded-xl">
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-slate-200 dark:text-slate-700"
            />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke={primaryColor}
              strokeWidth="3"
              strokeDasharray={`${overallPct} ${100 - overallPct}`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-slate-800 dark:text-white">{overallPct}%</span>
          </div>
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-800 dark:text-white">
            Overall Maturity Score
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {sortedAxes.length} axes evaluated • Scale 1-{data.scaleMax}
          </div>
        </div>
      </div>

      {/* Axis Rows */}
      <div className="space-y-2">
        {sortedAxes.map((axis, i) => {
          const pct = Math.round((axis.score / data.scaleMax) * 100);
          const gap = axis.gap ?? (axis.targetScore ? axis.targetScore - axis.score : 0);
          const gapInfo = getGapSeverity(gap);

          return (
            <div
              key={axis.axisId || i}
              className="group p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50 hover:border-blue-200 dark:hover:border-blue-800 transition-all"
            >
              <div className="flex items-center gap-3">
                {/* Rank */}
                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                  {i + 1}
                </div>

                {/* Name & Bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                      {axis.axisName}
                    </span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-sm font-bold ${getScoreTextColor(axis.score, data.scaleMax)}`}
                      >
                        {axis.score.toFixed(1)}
                      </span>
                      <span className="text-xs text-slate-400">/ {data.scaleMax}</span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="relative h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    {/* Target marker */}
                    {axis.targetScore && (
                      <div
                        className="absolute top-0 h-full w-0.5 bg-slate-400 dark:bg-slate-500 z-10"
                        style={{ left: `${(axis.targetScore / data.scaleMax) * 100}%` }}
                      />
                    )}
                    {/* Score bar */}
                    <div
                      className={`h-full rounded-full ${getScoreColor(axis.score, data.scaleMax)} transition-all duration-700`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Gap Badge */}
                  {gap > 0 && !compact && (
                    <div className="flex items-center justify-between mt-1.5">
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${gapInfo.color}`}
                      >
                        Gap: {gap.toFixed(1)} ({gapInfo.label})
                      </span>
                      {axis.targetScore && (
                        <span className="text-[10px] text-slate-400">
                          Target: {axis.targetScore.toFixed(1)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sub-areas (expandable on hover) */}
              {axis.areas && axis.areas.length > 0 && !compact && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/50 hidden group-hover:block">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                    {axis.areas.map((area, ai) => {
                      const areaPct = Math.round(
                        (area.score / (area.maxScore || data.scaleMax)) * 100
                      );
                      return (
                        <div key={ai} className="flex items-center gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="text-[10px] text-slate-500 truncate block">
                              {area.name}
                            </span>
                          </div>
                          <div className="w-16 h-1 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex-shrink-0">
                            <div
                              className={`h-full rounded-full ${getScoreColor(area.score, area.maxScore || data.scaleMax)}`}
                              style={{ width: `${areaPct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400 w-6 text-right">
                            {area.score.toFixed(1)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MatrixHeatmap;
