/**
 * IdeaMetricNodes — KPI Badge, Score, and Progress node types for canvas.
 *
 * Displays company metrics directly on the whiteboard/mindmap canvas.
 * Supports: KPI badges with status colors, large score numbers, progress bars.
 */
import { Activity, BarChart3, TrendingDown, TrendingUp } from 'lucide-react';
import React from 'react';
import { Handle, type NodeProps, Position } from 'reactflow';

// ── KPI Badge Node ───────────────────────────────────────────────────────────

export const KPIBadgeNode: React.FC<NodeProps> = ({ data, selected }) => {
  const name: string = data?.label || data?.name || 'KPI';
  const value: string | number = data?.value ?? '—';
  const target: string | number = data?.target ?? '';
  const status: string = data?.status || 'neutral';
  const unit: string = data?.unit || '';

  const statusStyles: Record<
    string,
    { bg: string; border: string; icon: React.ReactNode; text: string }
  > = {
    on_track: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      border: 'border-emerald-300 dark:border-emerald-700',
      icon: <TrendingUp size={12} className="text-emerald-500" />,
      text: 'text-emerald-700 dark:text-emerald-300',
    },
    at_risk: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      border: 'border-amber-300 dark:border-amber-700',
      icon: <Activity size={12} className="text-amber-500" />,
      text: 'text-amber-700 dark:text-amber-300',
    },
    off_track: {
      bg: 'bg-danger-50 dark:bg-danger-900/20',
      border: 'border-danger-300 dark:border-danger-700',
      icon: <TrendingDown size={12} className="text-danger-500" />,
      text: 'text-danger-700 dark:text-danger-300',
    },
    neutral: {
      bg: 'bg-slate-50 dark:bg-navy-800',
      border: 'border-slate-200 dark:border-navy-700',
      icon: <BarChart3 size={12} className="text-slate-600" />,
      text: 'text-slate-600 dark:text-slate-400',
    },
  };

  const s = statusStyles[status] || statusStyles.neutral;

  return (
    <div
      className={`relative w-[180px] p-3 rounded-2xl border-2 ${s.border} ${s.bg} shadow-md transition-all ${
        selected ? 'ring-2 ring-slate-500/60 dark:ring-c-border shadow-lg scale-105' : ''
      }`}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />

      <div className="flex items-center gap-1.5 mb-1.5">
        {s.icon}
        <div className={`text-[9px] font-bold uppercase tracking-wider ${s.text} truncate flex-1`}>
          {name}
        </div>
      </div>

      <div className={`text-xl font-black ${s.text} leading-none`}>
        {value}
        {unit && <span className="text-[10px] font-semibold ml-0.5 opacity-60">{unit}</span>}
      </div>

      {target && (
        <div className="mt-1 text-[9px] text-slate-600">
          Target: {target}
          {unit}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
    </div>
  );
};

// ── Score Node ───────────────────────────────────────────────────────────────

export const ScoreNode: React.FC<NodeProps> = ({ data, selected }) => {
  const label: string = data?.label || 'Score';
  const score: number = data?.score ?? 0;
  const maxScore: number = data?.maxScore ?? 100;
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;

  const color =
    percentage >= 75
      ? 'from-emerald-400 to-emerald-600'
      : percentage >= 50
        ? 'from-amber-400 to-amber-600'
        : percentage >= 25
          ? 'from-amber-400 to-amber-600'
          : 'from-danger-400 to-danger-600';

  const textColor =
    percentage >= 75
      ? 'text-emerald-600 dark:text-emerald-400'
      : percentage >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : percentage >= 25
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-danger-600 dark:text-danger-400';

  return (
    <div
      className={`relative w-[140px] h-[140px] rounded-full flex flex-col items-center justify-center shadow-lg transition-all ${
        selected ? 'ring-4 ring-slate-400/50 dark:ring-c-border scale-105' : ''
      } bg-white dark:bg-navy-900 border-4 border-slate-200 dark:border-navy-700`}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />

      {/* Circular progress ring */}
      <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 140 140">
        <circle
          cx="70"
          cy="70"
          r="60"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-slate-100 dark:text-navy-700"
        />
        <circle
          cx="70"
          cy="70"
          r="60"
          fill="none"
          strokeWidth="6"
          strokeDasharray={`${percentage * 3.77} ${377 - percentage * 3.77}`}
          strokeLinecap="round"
          className={`bg-gradient-to-r ${color}`}
          style={{
            stroke:
              percentage >= 75
                ? '#34d399'
                : percentage >= 50
                  ? '#fbbf24'
                  : percentage >= 25
                    ? '#fb923c'
                    : '#f87171',
          }}
        />
      </svg>

      <div className={`text-2xl font-black ${textColor} leading-none z-10`}>{score}</div>
      <div className="text-[8px] text-slate-600 mt-0.5 z-10">/ {maxScore}</div>
      <div
        className={`text-[9px] font-bold ${textColor} mt-1 z-10 text-center px-2 truncate max-w-[110px]`}
      >
        {label}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
    </div>
  );
};

// ── Progress Node ────────────────────────────────────────────────────────────

export const ProgressNode: React.FC<NodeProps> = ({ data, selected }) => {
  const label: string = data?.label || 'Progress';
  const progress: number = Math.min(100, Math.max(0, data?.progress ?? 0));
  const detail: string = data?.detail || '';

  const barColor =
    progress >= 75
      ? 'bg-emerald-400'
      : progress >= 50
        ? 'bg-amber-400'
        : progress >= 25
          ? 'bg-amber-400'
          : 'bg-danger-400';

  const textColor =
    progress >= 75
      ? 'text-emerald-600 dark:text-emerald-400'
      : progress >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-slate-600 dark:text-slate-400';

  return (
    <div
      className={`relative w-[200px] p-3 rounded-xl border-2 transition-all ${
        selected
          ? 'border-slate-500 dark:border-c-border ring-2 ring-slate-400/40 dark:ring-c-border shadow-lg'
          : 'border-slate-200 dark:border-navy-700 shadow-md'
      } bg-white dark:bg-navy-900`}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-slate-400 !-top-1" />

      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate flex-1">
          {label}
        </div>
        <div className={`text-[11px] font-black ${textColor}`}>{progress}%</div>
      </div>

      <div className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-navy-700 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {detail && <div className="mt-1.5 text-[9px] text-slate-600 truncate">{detail}</div>}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !-bottom-1"
      />
    </div>
  );
};
