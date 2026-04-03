/**
 * LaneSummaryStrip
 *
 * Top bar showing lane severity, confidence level, last-refreshed time,
 * and 3-5 MetricCards for quick orientation.
 */

import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  RefreshCcw,
  ShieldCheck,
  TrendingDown,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { LaneConfidence, LaneSeverity, MetricDef } from './types';

// ---------------------------------------------------------------------------
// Severity gradient strip
// ---------------------------------------------------------------------------

const SEVERITY_CFG: Record<LaneSeverity, { bg: string; text: string; icon: React.ElementType; labelEn: string; labelPl: string }> = {
  ok: {
    bg: 'bg-emerald-500/[0.06] dark:bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
    labelEn: 'On Track',
    labelPl: 'Na dobrej drodze',
  },
  warning: {
    bg: 'bg-amber-500/[0.06] dark:bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    icon: AlertTriangle,
    labelEn: 'Attention Needed',
    labelPl: 'Wymaga uwagi',
  },
  critical: {
    bg: 'bg-rose-500/[0.06] dark:bg-rose-500/10',
    text: 'text-rose-600 dark:text-rose-400',
    icon: TrendingDown,
    labelEn: 'Critical',
    labelPl: 'Krytyczne',
  },
};

const CONFIDENCE_CFG: Record<LaneConfidence, { dot: string; labelEn: string; labelPl: string }> = {
  high: { dot: 'bg-emerald-500', labelEn: 'High confidence', labelPl: 'Wysoka pewność' },
  medium: { dot: 'bg-amber-500', labelEn: 'Medium confidence', labelPl: 'Średnia pewność' },
  low: { dot: 'bg-rose-500', labelEn: 'Low confidence', labelPl: 'Niska pewność' },
  degraded: { dot: 'bg-slate-400', labelEn: 'Degraded data', labelPl: 'Niepełne dane' },
};

// ---------------------------------------------------------------------------
// MetricCard (reused from ManagerModuleView pattern)
// ---------------------------------------------------------------------------

const MetricCard: React.FC<{ label: string; value: string | number; variant?: 'default' | 'warn' | 'critical' }> = ({ label, value, variant = 'default' }) => (
  <div className={`rounded-lg px-3 py-2.5 ${
    variant === 'critical' ? 'bg-rose-500/[0.06] dark:bg-rose-500/10' :
    variant === 'warn' ? 'bg-amber-500/[0.06] dark:bg-amber-500/10' :
    'bg-slate-50/50 dark:bg-navy-900/40'
  }`}>
    <div className="text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">{label}</div>
    <div className={`text-lg font-semibold tabular-nums ${
      variant === 'critical' ? 'text-rose-600 dark:text-rose-400' :
      variant === 'warn' ? 'text-amber-600 dark:text-amber-400' :
      'text-slate-900 dark:text-slate-100'
    }`}>{value}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LaneSummaryStripProps {
  severity: LaneSeverity;
  confidence: LaneConfidence;
  lastRefreshed: Date;
  metrics: MetricDef[];
  onRefresh?: () => void;
  className?: string;
}

function timeAgo(d: Date, isPolish: boolean): string {
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return isPolish ? 'przed chwilą' : 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return isPolish ? `${min} min temu` : `${min}m ago`;
  const hrs = Math.floor(min / 60);
  return isPolish ? `${hrs}h temu` : `${hrs}h ago`;
}

export const LaneSummaryStrip: React.FC<LaneSummaryStripProps> = ({
  severity,
  confidence,
  lastRefreshed,
  metrics,
  onRefresh,
  className = '',
}) => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const sev = SEVERITY_CFG[severity];
  const conf = CONFIDENCE_CFG[confidence];
  const SevIcon = sev.icon;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Severity + confidence + refresh */}
      <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${sev.bg}`}>
        <SevIcon size={16} className={sev.text} />
        <span className={`text-sm font-semibold ${sev.text}`}>
          {isPolish ? sev.labelPl : sev.labelEn}
        </span>
        <div className="flex-1" />
        <span className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
          {isPolish ? conf.labelPl : conf.labelEn}
        </span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          · {timeAgo(lastRefreshed, isPolish)}
        </span>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-navy-800/40 transition-colors"
            title={isPolish ? 'Odśwież' : 'Refresh'}
          >
            <RefreshCcw size={13} />
          </button>
        )}
      </div>

      {/* Metric cards */}
      {metrics.length > 0 && (
        <div className={`grid gap-3 grid-cols-2 sm:grid-cols-3 ${
          metrics.length <= 3 ? 'md:grid-cols-3' :
          metrics.length === 4 ? 'md:grid-cols-4' :
          'md:grid-cols-5'
        }`}>
          {metrics.map((m, i) => (
            <MetricCard key={i} label={m.label} value={m.value} variant={m.variant} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LaneSummaryStrip;
