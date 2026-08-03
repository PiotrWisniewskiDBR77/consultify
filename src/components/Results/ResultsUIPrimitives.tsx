/**
 * ResultsUIPrimitives — M15/W6 task 6.9: M15 visual standard.
 *
 * 10 reusable UI primitives for all M15 views.
 * Based on CANON.md + M15-ANALIZA-SWIATOWA (Part V: UI standard).
 * Use these components instead of one-off styles — zero inline-styles.
 *
 * Primitives:
 *  1. ValueCard        — value card (main metric + trend + RAG)
 *  2. RagPill          — RAG badge + confidence %
 *  3. DriverTreeNode   — tree node (styling)
 *  4. WaterfallBar     — waterfall bar (change vs baseline)
 *  5. FunnelStage      — value funnel stage
 *  6. ScorecardGrid    — BSC grid (4 perspectives)
 *  7. BdnStatCard      — BDN stat card
 *  8. TrendSparkline   — trend chart thumbnail (SVG)
 *  9. ExecValueHeader  — executive header (banked/forecast/at-risk on one line)
 * 10. ValueDrawer      — 7-section KPI/benefit detail drawer
 */

import { ArrowDown, ArrowRight, ArrowUp, Minus } from 'lucide-react';
import React from 'react';

// ─── 1. ValueCard ─────────────────────────────────────────────────────────────

export type RagStatus = 'green' | 'amber' | 'red' | 'grey';

interface ValueCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'flat';
  status?: RagStatus;
  confidence?: number;
  className?: string;
}

const RAG_BG: Record<RagStatus, string> = {
  green: 'border-emerald-200 dark:border-emerald-700/50',
  amber: 'border-amber-200 dark:border-amber-700/50',
  red: 'border-red-200 dark:border-red-700/50',
  grey: 'border-c-border-subtle',
};

export const ValueCard: React.FC<ValueCardProps> = ({
  title,
  value,
  subValue,
  trend,
  status = 'grey',
  confidence,
  className = '',
}) => (
  <div
    data-testid="value-card"
    className={`rounded-xl border bg-c-surface p-4 ${RAG_BG[status]} ${className}`}
  >
    <div className="text-xs text-c-text-muted mb-1">{title}</div>
    <div className="flex items-end gap-2">
      <div className="text-2xl font-bold text-c-text">{value}</div>
      {trend && (
        <div
          className={`mb-0.5 ${trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-c-text-muted'}`}
        >
          {trend === 'up' ? (
            <ArrowUp size={16} />
          ) : trend === 'down' ? (
            <ArrowDown size={16} />
          ) : (
            <Minus size={16} />
          )}
        </div>
      )}
    </div>
    {subValue && <div className="text-xs text-c-text-muted mt-0.5">{subValue}</div>}
    {confidence != null && (
      <div className="mt-2">
        <div className="h-1 rounded-full bg-c-surface-raised overflow-hidden">
          <div
            className="h-full rounded-full bg-c-info"
            style={{ width: `${Math.round(confidence * 100)}%` }}
          />
        </div>
        <div className="text-xs text-c-text-muted mt-0.5">
          {Math.round(confidence * 100)}% confidence
        </div>
      </div>
    )}
  </div>
);

// ─── 2. RagPill ───────────────────────────────────────────────────────────────

interface RagPillProps {
  status: RagStatus;
  label?: string;
  confidence?: number;
}

const RAG_PILL: Record<RagStatus, string> = {
  green: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
  amber: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  grey: 'bg-c-surface-raised text-c-text-secondary',
};

const RAG_DOT: Record<RagStatus, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  grey: 'bg-slate-400',
};

const RAG_LABELS: Record<RagStatus, string> = {
  green: 'OK',
  amber: 'At risk',
  red: 'Critical',
  grey: 'No data',
};

export const RagPill: React.FC<RagPillProps> = ({ status, label, confidence }) => (
  <span
    data-testid="rag-pill"
    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${RAG_PILL[status]}`}
  >
    <span className={`h-1.5 w-1.5 rounded-full ${RAG_DOT[status]}`} />
    {label ?? RAG_LABELS[status]}
    {confidence != null && <span className="opacity-70">{Math.round(confidence * 100)}%</span>}
  </span>
);

// ─── 3. DriverTreeNode ────────────────────────────────────────────────────────

type NodeType = 'objective' | 'driver' | 'kpi' | 'initiative';

interface DriverTreeNodeProps {
  label: string;
  type: NodeType;
  value?: string;
  isExpanded?: boolean;
  hasChildren?: boolean;
  onClick?: () => void;
}

const NODE_STYLE: Record<NodeType, string> = {
  objective:
    'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-600 text-indigo-800 dark:text-indigo-200',
  driver:
    'bg-sky-100 dark:bg-sky-900/30 border-sky-300 dark:border-sky-600 text-sky-800 dark:text-sky-200',
  kpi: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-300 dark:border-emerald-600 text-emerald-800 dark:text-emerald-200',
  initiative:
    'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-600 text-amber-800 dark:text-amber-200',
};

export const DriverTreeNode: React.FC<DriverTreeNodeProps> = ({
  label,
  type,
  value,
  isExpanded,
  hasChildren,
  onClick,
}) => (
  <button
    type="button"
    data-testid="driver-tree-node"
    onClick={onClick}
    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${NODE_STYLE[type]}`}
  >
    <span className="font-semibold truncate max-w-[160px]">{label}</span>
    {value && <span className="opacity-60 text-xs">{value}</span>}
    {hasChildren && (
      <span className="ml-auto opacity-60">
        {isExpanded ? <ArrowDown size={12} /> : <ArrowRight size={12} />}
      </span>
    )}
  </button>
);

// ─── 4. WaterfallBar ──────────────────────────────────────────────────────────

interface WaterfallBarProps {
  label: string;
  value: number;
  baseline?: number;
  maxValue?: number;
  color?: 'green' | 'red' | 'blue' | 'grey';
}

const WATERFALL_COLOR = {
  green: 'bg-emerald-500',
  red: 'bg-red-500',
  blue: 'bg-c-info',
  grey: 'bg-slate-400',
};

export const WaterfallBar: React.FC<WaterfallBarProps> = ({
  label,
  value,
  maxValue = 100,
  color = 'blue',
}) => {
  const pct = maxValue > 0 ? Math.min((Math.abs(value) / maxValue) * 100, 100) : 0;
  return (
    <div data-testid="waterfall-bar" className="flex items-center gap-3">
      <div className="w-32 text-xs text-c-text-secondary truncate">{label}</div>
      <div className="flex-1 h-5 rounded bg-c-surface-raised overflow-hidden">
        <div className={`h-full rounded ${WATERFALL_COLOR[color]}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="w-20 text-right text-xs font-medium text-c-text-secondary">
        {value >= 0 ? '+' : ''}
        {value.toLocaleString()}
      </div>
    </div>
  );
};

// ─── 5. FunnelStage ───────────────────────────────────────────────────────────

interface FunnelStageProps {
  label: string;
  count: number;
  value?: number;
  conversionPct?: number;
  isActive?: boolean;
}

export const FunnelStage: React.FC<FunnelStageProps> = ({
  label,
  count,
  value,
  conversionPct,
  isActive = false,
}) => (
  <div
    data-testid="funnel-stage"
    className={`rounded-xl border p-3 text-center ${
      isActive ? 'border-c-info bg-c-accent-soft' : 'border-c-border-subtle bg-c-surface'
    }`}
  >
    <div className="text-xs text-c-text-muted mb-1">{label}</div>
    <div className="text-xl font-bold text-c-text">{count}</div>
    {value != null && (
      <div className="text-xs text-c-text-muted">
        {value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value.toFixed(0)}
      </div>
    )}
    {conversionPct != null && (
      <div className="mt-1 text-xs text-c-info">{conversionPct.toFixed(0)}%</div>
    )}
  </div>
);

// ─── 6. ScorecardGrid ─────────────────────────────────────────────────────────

interface ScorecardCell {
  perspective: string;
  health: number;
  kpiCount: number;
}

interface ScorecardGridProps {
  cells: ScorecardCell[];
}

export const ScorecardGrid: React.FC<ScorecardGridProps> = ({ cells }) => (
  <div data-testid="scorecard-grid" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    {cells.map((cell) => {
      const h = Math.round(cell.health * 100);
      const color =
        h >= 70
          ? 'text-emerald-600 dark:text-emerald-400'
          : h >= 40
            ? 'text-amber-600 dark:text-amber-400'
            : 'text-red-600 dark:text-red-400';
      return (
        <div
          key={cell.perspective}
          className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-3 text-center"
        >
          <div className="text-xs text-c-text-muted uppercase tracking-wide mb-1">
            {cell.perspective}
          </div>
          <div className={`text-xl font-bold ${color}`}>{h}%</div>
          <div className="text-xs text-c-text-muted mt-0.5">{cell.kpiCount} KPI</div>
        </div>
      );
    })}
  </div>
);

// ─── 7. BdnStatCard ───────────────────────────────────────────────────────────

interface BdnStatCardProps {
  label: string;
  value: number;
  icon?: React.ReactNode;
}

export const BdnStatCard: React.FC<BdnStatCardProps> = ({ label, value, icon }) => (
  <div
    data-testid="bdn-stat-card"
    className="rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface p-4 flex items-center gap-3"
  >
    {icon && <div className="text-c-text-muted shrink-0">{icon}</div>}
    <div>
      <div className="text-xs text-c-text-muted">{label}</div>
      <div className="text-2xl font-bold text-c-text">{value}</div>
    </div>
  </div>
);

// ─── 8. TrendSparkline ────────────────────────────────────────────────────────

interface TrendSparklineProps {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
}

export const TrendSparkline: React.FC<TrendSparklineProps> = ({
  points,
  width = 80,
  height = 24,
  color = 'currentColor',
}) => {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const pts = points.map((v, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((v - min) / range) * height;
    return `${x},${y}`;
  });
  return (
    <svg data-testid="trend-sparkline" width={width} height={height} className="overflow-visible">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

// ─── 9. ExecValueHeader ───────────────────────────────────────────────────────

interface ExecValueHeaderProps {
  banked: number;
  forecast: number;
  atRisk: number;
  target?: number;
  label?: string;
}

function fmtM(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
  return v.toFixed(0);
}

export const ExecValueHeader: React.FC<ExecValueHeaderProps> = ({
  banked,
  forecast,
  atRisk,
  target,
  label,
}) => (
  <div
    data-testid="exec-value-header"
    className="flex flex-wrap gap-6 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface px-6 py-4"
  >
    {label && (
      <div className="w-full text-xs font-semibold uppercase tracking-widest text-c-text-muted mb-1">
        {label}
      </div>
    )}
    <div>
      <div className="text-xs text-c-text-muted">BANKED</div>
      <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
        {fmtM(banked)}
      </div>
    </div>
    <div>
      <div className="text-xs text-c-text-muted">IN PROGRESS</div>
      <div className="text-2xl font-bold text-c-info">{fmtM(forecast)}</div>
    </div>
    <div>
      <div className="text-xs text-c-text-muted">AT RISK</div>
      <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{fmtM(atRisk)}</div>
    </div>
    {target != null && (
      <div>
        <div className="text-xs text-c-text-muted">TARGET</div>
        <div className="text-2xl font-bold text-c-text-secondary">{fmtM(target)}</div>
      </div>
    )}
  </div>
);

// ─── 10. ValueDrawer ──────────────────────────────────────────────────────────

interface ValueDrawerSection {
  id: string;
  label: string;
  content: React.ReactNode;
}

interface ValueDrawerProps {
  title: string;
  sections: ValueDrawerSection[];
  activeSection?: string;
  onSectionChange?: (id: string) => void;
  onClose?: () => void;
}

export const ValueDrawer: React.FC<ValueDrawerProps> = ({
  title,
  sections,
  activeSection,
  onSectionChange,
  onClose,
}) => {
  const active = activeSection ?? sections[0]?.id;
  const current = sections.find((s) => s.id === active);

  return (
    <div data-testid="value-drawer" className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3 border-b border-c-border-subtle">
        <h2 className="font-semibold text-c-text">{title}</h2>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="text-c-text-muted hover:text-c-text text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            ✕
          </button>
        )}
      </div>
      <div className="flex border-b border-c-border-subtle overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onSectionChange?.(s.id)}
            className={`px-4 py-2.5 text-sm shrink-0 border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
              s.id === active
                ? 'border-c-info text-c-info font-medium'
                : 'border-transparent text-c-text-muted hover:text-c-text'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-5">{current?.content}</div>
    </div>
  );
};
