/**
 * ReconciliationPanel — M16 → M15 read seam DISPLAY.
 *
 * Finance (M16) writes `v8_kpi_finance_reconciliations` (projected vs realized,
 * status pending/reconciled/disputed/escalated). This panel READS that status
 * plus the projected-vs-realized variance (GET /api/v8/results/reconciliations)
 * and surfaces it inside the Results ROI surface, highlighting mismatches.
 *
 * Matches the ROITrackingView navy-900 dark "Tech Sexy" conventions.
 */

import { AlertTriangle, CheckCircle2, Clock, RefreshCw, Scale } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  shouldFallbackToLegacyResults,
  type V8ReconciliationStatus,
  V8ResultsApi,
  type V8ResultsReconciliationItem,
  type V8ResultsReconciliationOverview,
} from '@/services/api/v8/results';

interface ReconciliationPanelProps {
  /** Optional narrowing: only show reconciliations for this initiative. */
  initiativeId?: string;
  /** When changed, forces a refetch (mirrors ROITrackingView refreshNonce). */
  refreshNonce?: number;
}

const STATUS_META: Record<
  V8ReconciliationStatus,
  {
    bg: string;
    text: string;
    dot: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }
> = {
  reconciled: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-500',
    icon: CheckCircle2,
  },
  pending: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500', icon: Clock },
  disputed: {
    bg: 'bg-danger-500/10',
    text: 'text-danger-400',
    dot: 'bg-danger-500',
    icon: AlertTriangle,
  },
  escalated: {
    bg: 'bg-danger-500/15',
    text: 'text-danger-300',
    dot: 'bg-danger-600',
    icon: AlertTriangle,
  },
};

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null): string {
  if (value == null) return '—';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

const StatusChip: React.FC<{ status: V8ReconciliationStatus; label: string }> = ({
  status,
  label,
}) => {
  const meta = STATUS_META[status] ?? STATUS_META.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.bg} ${meta.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {label}
    </span>
  );
};

export const ReconciliationPanel: React.FC<ReconciliationPanelProps> = ({
  initiativeId,
  refreshNonce,
}) => {
  const { t } = useTranslation();
  const [overview, setOverview] = useState<V8ResultsReconciliationOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setUnavailable(false);
    try {
      const data = await V8ResultsApi.getReconciliationOverview(
        initiativeId ? { initiativeId } : undefined
      );
      setOverview(data);
    } catch (error) {
      if (shouldFallbackToLegacyResults(error)) {
        // No V8 reconciliation surface for this org — render an empty-but-valid state.
        setOverview(null);
        setUnavailable(true);
      } else {
        setOverview(null);
        setUnavailable(true);
      }
    } finally {
      setLoading(false);
    }
  }, [initiativeId]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshNonce]);

  const statusLabel = useCallback(
    (status: V8ReconciliationStatus): string => {
      switch (status) {
        case 'reconciled':
          return t('results.reconciliation.status.reconciled', 'Reconciled');
        case 'disputed':
          return t('results.reconciliation.status.disputed', 'Disputed');
        case 'escalated':
          return t('results.reconciliation.status.escalated', 'Escalated');
        case 'pending':
        default:
          return t('results.reconciliation.status.pending', 'Pending');
      }
    },
    [t]
  );

  const items: V8ResultsReconciliationItem[] = overview?.items ?? [];
  const summary = overview?.summary;

  return (
    <div className="bg-navy-900 border border-navy-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-navy-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <Scale size={16} className="text-slate-400" />
          <h3 className="text-sm font-semibold text-white">
            {t('results.reconciliation.title', 'Finance reconciliation')}
          </h3>
          {summary && summary.total > 0 && (
            <span className="rounded-full bg-navy-700 px-2 py-0.5 text-xs text-slate-300">
              {summary.total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {summary && summary.mismatchCount > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-500/10 px-2.5 py-0.5 text-xs font-medium text-danger-400">
              <AlertTriangle size={12} />
              {t('results.reconciliation.mismatches', '{{count}} mismatch', {
                count: summary.mismatchCount,
              })}
            </span>
          )}
          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center gap-1.5 rounded-lg border border-navy-700 px-2 py-1 text-xs text-slate-400 hover:bg-navy-700 hover:text-slate-200"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">{t('common.loading', 'Loading...')}</span>
        </div>
      ) : unavailable ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          {t(
            'results.reconciliation.unavailable',
            'Finance reconciliation is not available for this workspace yet.'
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500">
          {t(
            'results.reconciliation.empty',
            'No KPI–Finance reconciliations yet. Finance creates these when reconciling realized ROI against projections.'
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-700 text-left text-xs uppercase text-slate-500">
                <th className="px-4 py-2 font-medium">
                  {t('results.reconciliation.col.kpi', 'KPI')}
                </th>
                <th className="px-4 py-2 font-medium">
                  {t('results.reconciliation.col.status', 'Status')}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {t('results.reconciliation.col.projected', 'Projected')}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {t('results.reconciliation.col.realized', 'Realized')}
                </th>
                <th className="px-4 py-2 text-right font-medium">
                  {t('results.reconciliation.col.variance', 'Variance')}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const varianceTone =
                  item.varianceAbsolute == null
                    ? 'text-slate-500'
                    : item.varianceAbsolute > 0
                      ? 'text-emerald-400'
                      : item.varianceAbsolute < 0
                        ? 'text-danger-400'
                        : 'text-slate-400';
                return (
                  <tr
                    key={item.reconciliationId}
                    className={`border-b border-navy-800 last:border-0 ${
                      item.hasMismatch ? 'bg-danger-500/[0.04]' : ''
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {item.hasMismatch && (
                          <AlertTriangle size={13} className="shrink-0 text-danger-400" />
                        )}
                        <span className="text-slate-200">
                          {item.kpiName ||
                            t('results.reconciliation.unnamedKpi', 'KPI {{id}}', {
                              id: item.kpiId.slice(0, 8),
                            })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusChip
                        status={item.reconciliationStatus}
                        label={statusLabel(item.reconciliationStatus)}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                      {formatCurrency(item.projectedValue)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-300">
                      {formatCurrency(item.realizedValue)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums font-medium ${varianceTone}`}
                    >
                      {formatCurrency(item.varianceAbsolute)}
                      {item.variancePercent != null && (
                        <span className="ml-1 text-xs text-slate-500">
                          ({formatPercent(item.variancePercent)})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default ReconciliationPanel;
