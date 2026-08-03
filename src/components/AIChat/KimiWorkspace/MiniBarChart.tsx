/**
 * MiniBarChart — inline "trend at a glance" bar chart for the Gen. Excel
 * template build result (2026-07-23), rendered ABOVE the read-only grid
 * preview in ExceleParametricTemplates.tsx (same preview built from
 * Api.getWorkbookSchema → buildWorkbookGridSheets, src/utils/workbookGridPreview.ts).
 *
 * Pure SVG, zero charting library. `findBarChartSeries` picks the FIRST row
 * of the FIRST sheet that has ≥2 numeric, non-formula value cells and uses
 * it as the single series (bars proportional to that row's max, column
 * headers as labels below). Because buildWorkbookGridSheets already flattens
 * formula cells to "=<formula>" strings, `typeof cell === 'number'` alone is
 * enough to tell a real value from a formula — no need to re-touch the raw
 * WorkbookSchema. Graceful: a sheet with no qualifying row (all
 * formulas/text, or <2 numeric cells per row) renders nothing.
 */

import React from 'react';

import type { WorkbookGridSheet } from '@/utils/workbookGridPreview';

export interface MiniBarChartSeries {
  labels: string[];
  values: number[];
}

/** Keeps the chart "mały, czysty" even if a qualifying row has many numeric columns. */
const MAX_BARS = 8;

export function findBarChartSeries(
  sheet: WorkbookGridSheet | undefined | null
): MiniBarChartSeries | null {
  if (!sheet || !Array.isArray(sheet.rows) || !Array.isArray(sheet.columns)) return null;
  for (const row of sheet.rows) {
    const labels: string[] = [];
    const values: number[] = [];
    for (const col of sheet.columns) {
      const cell = row[col];
      if (typeof cell === 'number' && Number.isFinite(cell)) {
        labels.push(col);
        values.push(cell);
      }
    }
    if (values.length >= 2) {
      return { labels: labels.slice(0, MAX_BARS), values: values.slice(0, MAX_BARS) };
    }
  }
  return null;
}

interface MiniBarChartProps {
  series: MiniBarChartSeries;
  /** Bar area height in px (labels sit below, outside this height). */
  height?: number;
}

/**
 * Data colour = c-chart-1 (ordered chart-series token) — deliberately NOT the
 * brand token (see tailwind.config.js's DATA-PALETTE DECISION GUIDE: the
 * brand token is Harvard Crimson, CTA/brand-only, and must never colour a
 * data series — Consultify's "primary = crimson" trap, CLAUDE.md UI rule #3).
 */
export const MiniBarChart: React.FC<MiniBarChartProps> = ({ series, height = 80 }) => {
  const { labels, values } = series;
  if (values.length < 2 || values.length !== labels.length) return null;
  const max = Math.max(...values.map((v) => Math.abs(v)));
  if (!(max > 0)) return null;

  return (
    <div className="flex items-end gap-2 px-3 pt-3 pb-2 border-b border-c-border-subtle">
      {values.map((v, i) => {
        const pct = Math.max(4, (Math.abs(v) / max) * 100);
        return (
          <div
            key={`${labels[i]}-${i}`}
            className="flex-1 min-w-0 flex flex-col items-center gap-1"
          >
            <svg
              viewBox="0 0 10 100"
              preserveAspectRatio="none"
              style={{ width: '100%', maxWidth: 28, height }}
            >
              <rect x={0} y={100 - pct} width={10} height={pct} rx={1} className="fill-c-chart-1">
                <title>{`${labels[i]}: ${v.toLocaleString('pl-PL')}`}</title>
              </rect>
            </svg>
            <span
              className="w-full text-center text-[10px] leading-tight text-c-text-secondary truncate"
              title={labels[i]}
            >
              {labels[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default MiniBarChart;
