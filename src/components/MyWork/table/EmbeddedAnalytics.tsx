/**
 * EmbeddedAnalytics — Sparklines, trend indicators, and heatmap overlay for the Idea Table.
 *
 * Features:
 * - Sparkline mini-charts in cells (for number/rating/progress columns)
 * - Trend indicators (↑↓→) based on value history
 * - Heatmap overlay mode: color cells by relative value intensity
 * - Toggle heatmap on/off per column
 */
import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Flame,
  Minus,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { ColumnDef, TableNode } from './tableTypes';

// ── Sparkline Component ────────────────────────────────────────────────────
interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  showDots?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  values,
  width = 60,
  height = 18,
  color = 'var(--c-info)',
  showDots = false,
}) => {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const padding = 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2);
    const y = height - padding - ((v - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;

  return (
    <svg width={width} height={height} className="inline-block flex-shrink-0">
      <defs>
        <linearGradient id={`spark-grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.2} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-grad-${color.replace('#', '')})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showDots && points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={1.5} fill={color} />)}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r={2}
        fill={color}
      />
    </svg>
  );
};

// ── Trend Indicator ────────────────────────────────────────────────────────
interface TrendIndicatorProps {
  current: number;
  previous?: number;
  showLabel?: boolean;
}

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  current,
  previous,
  showLabel = false,
}) => {
  if (previous == null) return null;

  const diff = current - previous;
  const pctChange = previous !== 0 ? Math.round((diff / Math.abs(previous)) * 100) : 0;

  if (Math.abs(diff) < 0.01) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[8px] font-bold text-c-text-secondary">
        <Minus size={8} />
        {showLabel && '0%'}
      </span>
    );
  }

  const isUp = diff > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[8px] font-bold ${isUp ? 'text-emerald-500' : 'text-danger-500'}`}
    >
      {isUp ? <TrendingUp size={8} /> : <TrendingDown size={8} />}
      {showLabel && `${isUp ? '+' : ''}${pctChange}%`}
    </span>
  );
};

// ── Heatmap utilities ──────────────────────────────────────────────────────
function getHeatmapColor(
  value: number,
  min: number,
  max: number,
  palette: 'warm' | 'cool' | 'diverging' = 'warm'
): string {
  const range = max - min || 1;
  const normalized = Math.max(0, Math.min(1, (value - min) / range));

  if (palette === 'warm') {
    const r = Math.round(255);
    const g = Math.round(255 - normalized * 200);
    const b = Math.round(100 - normalized * 100);
    return `rgba(${r}, ${g}, ${b}, ${0.1 + normalized * 0.25})`;
  }
  if (palette === 'cool') {
    const r = Math.round(100 - normalized * 100);
    const g = Math.round(150 + normalized * 50);
    const b = Math.round(255);
    return `rgba(${r}, ${g}, ${b}, ${0.1 + normalized * 0.25})`;
  }
  // diverging: red (low) → white (mid) → green (high)
  const mid = (min + max) / 2;
  if (value < mid) {
    const t = (value - min) / (mid - min || 1);
    return `rgba(239, 68, 68, ${0.3 - t * 0.25})`;
  }
  const t = (value - mid) / (max - mid || 1);
  return `rgba(16, 185, 129, ${0.05 + t * 0.25})`;
}

export function computeHeatmapStyles(
  nodes: TableNode[],
  columns: ColumnDef[],
  enabledColumns: Set<string>,
  palette: 'warm' | 'cool' | 'diverging' = 'warm'
): Map<string, Map<string, React.CSSProperties>> {
  const result = new Map<string, Map<string, React.CSSProperties>>();
  const numericTypes = new Set(['number', 'rating', 'progress', 'currency']);

  for (const col of columns) {
    if (!enabledColumns.has(col.key) || !numericTypes.has(col.type)) continue;

    const values = nodes.map((n) => Number(n.data?.[col.key]) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);

    for (const node of nodes) {
      const val = Number(node.data?.[col.key]) || 0;
      if (!result.has(node.id)) result.set(node.id, new Map());
      result.get(node.id)!.set(col.key, {
        backgroundColor: getHeatmapColor(val, min, max, palette),
      });
    }
  }

  return result;
}

// ── Heatmap Controls Panel ─────────────────────────────────────────────────
interface HeatmapControlsProps {
  open: boolean;
  onClose: () => void;
  columns: ColumnDef[];
  enabledColumns: Set<string>;
  onToggleColumn: (key: string) => void;
  palette: 'warm' | 'cool' | 'diverging';
  onPaletteChange: (p: 'warm' | 'cool' | 'diverging') => void;
}

export const HeatmapControls: React.FC<HeatmapControlsProps> = ({
  open,
  onClose,
  columns,
  enabledColumns,
  onToggleColumn,
  palette,
  onPaletteChange,
}) => {
  const { i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const numericTypes = new Set(['number', 'rating', 'progress', 'currency']);
  const numericCols = columns.filter((c) => numericTypes.has(c.type) && c.visible);

  if (!open) return null;

  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-c-border-subtle bg-c-surface shadow-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Flame size={12} className="text-amber-500" />
        <span className="text-[10px] font-bold text-c-text">
          {isPl ? 'Heatmapa' : 'Heatmap'}
        </span>
        <div className="flex-1" />
        <button onClick={onClose} className="text-c-text-secondary hover:text-c-text-secondary">
          <X size={10} />
        </button>
      </div>

      {/* Palette */}
      <div className="flex items-center gap-1 mb-3">
        {(['warm', 'cool', 'diverging'] as const).map((p) => (
          <button
            key={p}
            onClick={() => onPaletteChange(p)}
            className={`flex-1 px-2 py-1 rounded-lg text-[8px] font-bold transition-colors ${palette === p ? 'bg-c-accent-soft text-c-accent' : 'text-c-text-secondary hover:text-c-text-secondary'}`}
          >
            {p === 'warm' ? '🔥' : p === 'cool' ? '❄️' : '↕️'} {p}
          </button>
        ))}
      </div>

      {/* Column toggles */}
      <div className="space-y-1">
        {numericCols.map((col) => (
          <label
            key={col.key}
            className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-c-surface-raised cursor-pointer"
          >
            <input
              type="checkbox"
              checked={enabledColumns.has(col.key)}
              onChange={() => onToggleColumn(col.key)}
              className="w-3 h-3 rounded border-c-border-subtle text-c-accent focus:ring-c-focus"
            />
            <span className="text-[10px] text-c-text-secondary">{col.header}</span>
          </label>
        ))}
        {numericCols.length === 0 && (
          <p className="text-[9px] text-c-text-secondary text-center py-2">
            {isPl ? 'Brak kolumn numerycznych' : 'No numeric columns'}
          </p>
        )}
      </div>
    </div>
  );
};

// ── Analytics Summary Strip ────────────────────────────────────────────────
interface AnalyticsSummaryStripProps {
  nodes: TableNode[];
  columns: ColumnDef[];
  visible?: boolean;
}

export const AnalyticsSummaryStrip: React.FC<AnalyticsSummaryStripProps> = ({
  nodes,
  columns,
  visible = true,
}) => {
  const numericTypes = new Set(['number', 'rating', 'progress', 'currency']);
  const numericCols = columns.filter((c) => numericTypes.has(c.type) && c.visible);

  if (!visible || numericCols.length === 0 || nodes.length === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-1.5 border-t border-c-border-subtle bg-c-surface-raised overflow-x-auto flex-shrink-0">
      <Activity size={10} className="text-c-text-secondary flex-shrink-0" />
      {numericCols.slice(0, 4).map((col) => {
        const values = nodes.map((n) => Number(n.data?.[col.key]) || 0);
        const avg = values.reduce((a, b) => a + b, 0) / values.length;
        const max = Math.max(...values);
        const sparkValues = values.slice(0, 12);

        return (
          <div key={col.key} className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-[8px] font-bold uppercase tracking-wider text-c-text-secondary">
              {col.header}
            </span>
            <Sparkline values={sparkValues} width={40} height={14} color="var(--c-info)" />
            <span className="text-[9px] font-bold text-c-text-secondary tabular-nums">
              ø{Math.round(avg * 10) / 10}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default Sparkline;
