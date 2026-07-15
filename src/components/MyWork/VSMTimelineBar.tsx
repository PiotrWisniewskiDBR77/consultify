/**
 * VSMTimelineBar — Bottom bar showing VSM timeline metrics.
 *
 * Calculates Lead Time, Value-Added Time, and Process Cycle Efficiency (PCE)
 * from process-flow nodes and renders a visual bar with green (VA) and red
 * (NVA) segments plus numeric KPIs.
 */
import { Clock, Timer, TrendingUp } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

// ── Types ────────────────────────────────────────────────────────────────────

interface VSMTimelineBarProps {
  nodes: Array<{ id: string; data?: any }>;
  isPl: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseDuration(raw: string | number | undefined): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') return raw;
  const trimmed = raw.trim().toLowerCase();
  const num = parseFloat(trimmed);
  if (isNaN(num)) return 0;
  if (trimmed.endsWith('d')) return num * 480;
  if (trimmed.endsWith('h')) return num * 60;
  if (trimmed.endsWith('s')) return num;
  return num;
}

function formatMinutes(mins: number): string {
  if (mins <= 0) return '0 min';
  if (mins < 60) return `${Math.round(mins)} min`;
  if (mins < 480) return `${(mins / 60).toFixed(1)} h`;
  return `${(mins / 480).toFixed(1)} d`;
}

function estimateWaitTime(inventoryQty: number | undefined): number {
  if (!inventoryQty || inventoryQty <= 0) return 0;
  return inventoryQty * 0.5;
}

// ── Component ────────────────────────────────────────────────────────────────

export const VSMTimelineBar: React.FC<VSMTimelineBarProps> = ({ nodes }) => {
  const { t } = useTranslation();
  const metrics = useMemo(() => {
    let vaTime = 0;
    let waitTime = 0;

    for (const node of nodes) {
      const d = node.data;
      if (!d) continue;

      const shape: string = d.shape || d.type || '';

      if (shape === 'vsm_process' || shape === 'action') {
        vaTime += parseDuration(d.cycleTime);
      }

      if (shape === 'vsm_inventory' || shape === 'vsm_supermarket') {
        waitTime += estimateWaitTime(d.inventory);
      }
    }

    const leadTime = vaTime + waitTime;
    const pce = leadTime > 0 ? (vaTime / leadTime) * 100 : 0;

    return { vaTime, waitTime, leadTime, pce };
  }, [nodes]);

  if (metrics.leadTime <= 0 && nodes.length === 0) return null;

  const vaPercent = metrics.leadTime > 0 ? (metrics.vaTime / metrics.leadTime) * 100 : 0;
  const nvaPercent = 100 - vaPercent;

  return (
    <div className="flex items-center gap-4 px-4 py-2 border-t border-slate-200/60 dark:border-navy-700/60 bg-slate-50/80 dark:bg-navy-900/80 flex-shrink-0">
      {/* KPI chips */}
      <div className="flex items-center gap-1.5">
        <Clock size={13} className="text-slate-600" />
        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
          {/* "Lead Time" — identical in both locales in the original, not translated */}
          Lead Time:
        </span>
        <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100">
          {formatMinutes(metrics.leadTime)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <Timer size={13} className="text-emerald-500" />
        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">
          {t('processFlow.vsmTimelineBar.vaTimeLabel', 'VA Time')}:
        </span>
        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
          {formatMinutes(metrics.vaTime)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <TrendingUp size={13} className="text-primary-500" />
        <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">PCE:</span>
        <span
          className={`text-[11px] font-bold ${
            metrics.pce >= 25
              ? 'text-emerald-700 dark:text-emerald-300'
              : metrics.pce >= 10
                ? 'text-amber-700 dark:text-amber-300'
                : 'text-danger-700 dark:text-danger-300'
          }`}
        >
          {metrics.pce.toFixed(1)}%
        </span>
      </div>

      {/* Visual bar */}
      <div className="flex-1 flex items-center gap-2 ml-2">
        <div className="flex-1 h-3 rounded-full overflow-hidden bg-slate-200 dark:bg-navy-700 flex">
          {vaPercent > 0 && (
            <div
              className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-300"
              style={{ width: `${vaPercent}%` }}
              title={t('processFlow.vsmTimelineBar.valueAdded', 'Value-added: {{value}}%', {
                value: vaPercent.toFixed(1),
              })}
            />
          )}
          {nvaPercent > 0 && (
            <div
              className="h-full bg-danger-400 dark:bg-danger-500 transition-all duration-300"
              style={{ width: `${nvaPercent}%` }}
              title={t('processFlow.vsmTimelineBar.nonValueAdded', 'Non-value-added: {{value}}%', {
                value: nvaPercent.toFixed(1),
              })}
            />
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
            <span className="text-[8px] text-slate-500 dark:text-slate-400">VA</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-danger-400 dark:bg-danger-500" />
            <span className="text-[8px] text-slate-500 dark:text-slate-400">NVA</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VSMTimelineBar;
