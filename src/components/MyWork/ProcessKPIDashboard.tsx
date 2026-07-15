/**
 * ProcessKPIDashboard — Floating mini-dashboard for process flow metrics.
 *
 * Shows: total steps, decisions, lanes count, estimated duration & cost,
 * handoff count (edges crossing lanes), and bottleneck score.
 * Positioned as a floating overlay on the canvas.
 */
import {
  Activity,
  ArrowRightLeft,
  Clock,
  DollarSign,
  GitBranch,
  Layers,
  Target,
  X,
} from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ────────────────────────────────────────────────────────────────────

interface ProcessKPIDashboardProps {
  nodes: Array<{ id: string; data?: any }>;
  edges: Array<{ id: string; source: string; target: string; data?: any }>;
  lanes: Array<{ id: string; label: string; color: string }>;
  isPl: boolean;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseDuration(raw: string | number | undefined): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') return raw;
  const trimmed = raw.trim().toLowerCase();
  const num = parseFloat(trimmed);
  if (isNaN(num)) return 0;
  if (trimmed.endsWith('d')) return num * 8;
  if (trimmed.endsWith('m') || trimmed.endsWith('min')) return num / 60;
  return num;
}

function formatHours(h: number): string {
  if (h <= 0) return '0h';
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 8).toFixed(1)}d`;
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: string;
  subtitle?: string;
}

const KPICard: React.FC<KPICardProps> = ({ icon, label, value, color, subtitle }) => (
  <div className="flex items-start gap-2 py-1.5">
    <div className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider truncate">
        {label}
      </div>
      <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-tight">
        {value}
      </div>
      {subtitle && (
        <div className="text-[8px] text-slate-600 dark:text-slate-500 truncate">{subtitle}</div>
      )}
    </div>
  </div>
);

// ── Component ────────────────────────────────────────────────────────────────

export const ProcessKPIDashboard: React.FC<ProcessKPIDashboardProps> = ({
  nodes,
  edges,
  lanes,
  onClose,
}) => {
  const { t } = useTranslation();
  const kpis = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const steps = nodes.filter((n) => {
      const s = n.data?.shape;
      return s === 'action' || s === 'vsm_process';
    }).length;

    const decisions = nodes.filter((n) => n.data?.shape === 'decision').length;

    let totalDuration = 0;
    let totalCost = 0;

    for (const n of nodes) {
      totalDuration += parseDuration(n.data?.duration || n.data?.cycleTime);
      totalCost += Number(n.data?.cost) || 0;
    }

    let handoffs = 0;
    for (const e of edges) {
      const src = nodeMap.get(e.source);
      const tgt = nodeMap.get(e.target);
      if (
        src &&
        tgt &&
        src.data?.laneId &&
        tgt.data?.laneId &&
        src.data.laneId !== tgt.data.laneId
      ) {
        handoffs++;
      }
    }

    const incomingCount = new Map<string, number>();
    for (const e of edges) {
      incomingCount.set(e.target, (incomingCount.get(e.target) || 0) + 1);
    }
    let bottleneckId: string | null = null;
    let bottleneckScore = 0;
    for (const [nodeId, count] of incomingCount) {
      if (count > bottleneckScore) {
        bottleneckScore = count;
        bottleneckId = nodeId;
      }
    }
    const bottleneckLabel = bottleneckId
      ? nodeMap.get(bottleneckId)?.data?.label || bottleneckId
      : null;

    return {
      steps,
      decisions,
      lanesCount: lanes.length,
      totalDuration,
      totalCost,
      handoffs,
      bottleneckLabel,
      bottleneckScore,
    };
  }, [nodes, edges, lanes]);

  return (
    <div className="absolute top-3 right-3 z-30 w-[220px] bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm border border-slate-200/60 dark:border-navy-700/60 rounded-2xl shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5">
        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
          {t('processFlow.kpiDashboard.title', 'Process KPIs')}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('processFlow.kpiDashboard.close', 'Close')}
          className="p-0.5 rounded-md hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
        >
          <X size={12} className="text-slate-600" />
        </button>
      </div>

      <div className="px-3 pb-3 space-y-0.5">
        <KPICard
          icon={<Activity size={14} className="text-blue-600 dark:text-blue-400" />}
          label={t('processFlow.kpiDashboard.stepsDecisions', 'Steps / Decisions')}
          value={`${kpis.steps} / ${kpis.decisions}`}
          color="bg-blue-100 dark:bg-blue-900/40"
          subtitle={t('processFlow.kpiDashboard.totalNodes', '{{value}} total nodes', {
            value: nodes.length,
          })}
        />

        <KPICard
          icon={<Layers size={14} className="text-primary-600 dark:text-primary-400" />}
          label={t('processFlow.kpiDashboard.lanes', 'Lanes')}
          value={kpis.lanesCount}
          color="bg-primary-100 dark:bg-primary-900/40"
        />

        <KPICard
          icon={<Clock size={14} className="text-amber-600 dark:text-amber-400" />}
          label={t('processFlow.kpiDashboard.estDuration', 'Est. Duration')}
          value={formatHours(kpis.totalDuration)}
          color="bg-amber-100 dark:bg-amber-900/40"
        />

        {kpis.totalCost > 0 && (
          <KPICard
            icon={<DollarSign size={14} className="text-emerald-600 dark:text-emerald-400" />}
            label={t('processFlow.kpiDashboard.estCost', 'Est. Cost')}
            value={`$${kpis.totalCost.toLocaleString()}`}
            color="bg-emerald-100 dark:bg-emerald-900/40"
          />
        )}

        <KPICard
          icon={<ArrowRightLeft size={14} className="text-amber-600 dark:text-amber-400" />}
          label={t('processFlow.kpiDashboard.handoffs', 'Handoffs')}
          value={kpis.handoffs}
          color="bg-amber-100 dark:bg-amber-900/40"
          subtitle={
            kpis.handoffs > 3
              ? t('processFlow.kpiDashboard.highHandoffCount', '⚠ High handoff count')
              : undefined
          }
        />

        {kpis.bottleneckLabel && (
          <KPICard
            icon={<Target size={14} className="text-danger-600 dark:text-danger-400" />}
            label={t('processFlow.kpiDashboard.bottleneck', 'Bottleneck')}
            value={kpis.bottleneckLabel}
            color="bg-danger-100 dark:bg-danger-900/40"
            subtitle={t('processFlow.kpiDashboard.incomingCount', '{{value}} incoming', {
              value: kpis.bottleneckScore,
            })}
          />
        )}
      </div>
    </div>
  );
};

export default ProcessKPIDashboard;
