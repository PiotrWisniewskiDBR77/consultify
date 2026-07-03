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

import { FilterableTable, type TableColumn, type TableRow } from '../shared/ModuleHub';
import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';

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

/**
 * A KPI unit is monetary when its value is comparable to a currency amount.
 * Percentage / ratio / count units render as plain numbers with their unit
 * suffix rather than being (mis)formatted as EUR (H2.5 OEE fix).
 */
const NON_MONETARY_UNIT_RE =
  /^\s*(%|percent|percentage|pct|pp|ppt|pts?|points?|ratio|score|index|nps|csat|days?|day|hrs?|hours?|months?|weeks?|szt\.?|pcs?|count|qty|units?|x)\s*$/i;

function isMonetaryUnit(unit: string | null | undefined): boolean {
  const u = (unit ?? '').trim();
  if (!u) return true;
  return !NON_MONETARY_UNIT_RE.test(u);
}

/**
 * Formats a reconciliation value respecting the KPI unit. Monetary units render
 * as EUR; a bare '%' renders as `85%`; any other unit renders as `<number> <unit>`.
 */
function formatValueForUnit(value: number | null, unit: string | null): string {
  if (value == null) return '—';
  if (isMonetaryUnit(unit)) return formatCurrency(value);
  const u = (unit ?? '').trim();
  const num = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
  }).format(value);
  if (u === '%' || /^(percent|percentage|pct)$/i.test(u)) return `${num}%`;
  return u ? `${num} ${u}` : num;
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

  const [reconciliationFilters, setReconciliationFilters] = useState<FilterChip[]>([]);

  const items: V8ResultsReconciliationItem[] = overview?.items ?? [];
  const summary = overview?.summary;

  const reconciliationColumns: TableColumn[] = [
    {
      id: 'kpiName',
      label: t('results.reconciliation.col.kpi', 'KPI'),
      width: '35%',
      render: (row: TableRow) => (
        <div className="flex items-center gap-2">
          {row.hasMismatch && (
            <AlertTriangle size={13} className="shrink-0 text-danger-400" />
          )}
          <span className="text-slate-700 dark:text-c-text-secondary">{row.kpiName}</span>
        </div>
      ),
    },
    {
      id: 'reconciliationStatus',
      label: t('results.reconciliation.col.status', 'Status'),
      width: '18%',
      filterable: true,
      filterOptions: [
        { value: 'reconciled', label: t('results.reconciliation.status.reconciled', 'Reconciled'), color: 'bg-emerald-500' },
        { value: 'pending', label: t('results.reconciliation.status.pending', 'Pending'), color: 'bg-amber-500' },
        { value: 'disputed', label: t('results.reconciliation.status.disputed', 'Disputed'), color: 'bg-danger-500' },
        { value: 'escalated', label: t('results.reconciliation.status.escalated', 'Escalated'), color: 'bg-danger-600' },
      ],
      render: (row: TableRow) => (
        <StatusChip
          status={row.reconciliationStatus as V8ReconciliationStatus}
          label={statusLabel(row.reconciliationStatus as V8ReconciliationStatus)}
        />
      ),
    },
    {
      id: 'projectedValue',
      label: t('results.reconciliation.col.projected', 'Projected'),
      width: '15%',
      align: 'right',
      render: (row: TableRow) => (
        <span className="tabular-nums text-slate-700 dark:text-c-text-secondary">
          {formatValueForUnit(row.projectedValue as number | null, row.unit as string | null)}
        </span>
      ),
    },
    {
      id: 'realizedValue',
      label: t('results.reconciliation.col.realized', 'Realized'),
      width: '15%',
      align: 'right',
      render: (row: TableRow) => (
        <span className="tabular-nums text-slate-700 dark:text-c-text-secondary">
          {formatValueForUnit(row.realizedValue as number | null, row.unit as string | null)}
        </span>
      ),
    },
    {
      id: 'varianceAbsolute',
      label: t('results.reconciliation.col.variance', 'Variance'),
      width: '17%',
      align: 'right',
      render: (row: TableRow) => {
        const varianceTone =
          row.varianceAbsolute == null
            ? 'text-slate-500'
            : row.varianceAbsolute > 0
              ? 'text-emerald-400'
              : row.varianceAbsolute < 0
                ? 'text-danger-400'
                : 'text-slate-400';
        return (
          <span className={`tabular-nums font-medium ${varianceTone}`}>
            {formatCurrency(row.varianceAbsolute)}
            {row.variancePercent != null && (
              <span className="ml-1 text-xs text-slate-500">
                ({formatPercent(row.variancePercent)})
              </span>
            )}
          </span>
        );
      },
    },
  ];

  const reconciliationRows: TableRow[] = items.map((item) => ({
    id: item.reconciliationId,
    kpiName: item.kpiName || t('results.reconciliation.unnamedKpi', 'KPI {{id}}', { id: item.kpiId.slice(0, 8) }),
    unit: item.unit ?? null,
    hasMismatch: item.hasMismatch,
    reconciliationStatus: item.reconciliationStatus,
    projectedValue: item.projectedValue,
    realizedValue: item.realizedValue,
    varianceAbsolute: item.varianceAbsolute,
    variancePercent: item.variancePercent,
  }));

  return (
    <div className="bg-white dark:bg-c-surface border border-slate-200/70 dark:border-c-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 dark:border-c-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Scale size={16} className="text-slate-500 dark:text-c-text-muted" />
          <h3 className="text-sm font-semibold text-slate-900 dark:text-c-text">
            {t('results.reconciliation.title', 'Finance reconciliation')}
          </h3>
          {summary && summary.total > 0 && (
            <span className="rounded-full bg-slate-100 dark:bg-c-surface-raised px-2 py-0.5 text-xs text-slate-600 dark:text-c-text-secondary">
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
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/70 dark:border-c-border px-2 py-1 text-xs text-slate-500 dark:text-c-text-muted hover:bg-slate-100 dark:hover:bg-c-surface-raised hover:text-slate-700 dark:hover:text-c-text-secondary"
            title={t('common.refresh', 'Refresh')}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-10 text-slate-500 dark:text-c-text-muted">
          <RefreshCw size={16} className="animate-spin" />
          <span className="text-sm">{t('common.loading', 'Loading...')}</span>
        </div>
      ) : unavailable ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-c-text-muted">
          {t(
            'results.reconciliation.unavailable',
            'Finance reconciliation is not available for this workspace yet.'
          )}
        </div>
      ) : items.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-c-text-muted">
          {t(
            'results.reconciliation.empty',
            'No KPI–Finance reconciliations yet. Finance creates these when reconciling realized ROI against projections.'
          )}
        </div>
      ) : (
        <FilterableTable
          columns={reconciliationColumns}
          data={reconciliationRows}
          activeFilters={reconciliationFilters}
          onFilterChange={setReconciliationFilters}
          hideRowActions
          canvasClassName=""
          density="compact"
          enableColumnSettings={false}
          emptyMessage={t('results.reconciliation.empty', 'No KPI–Finance reconciliations yet.')}
        />
      )}
    </div>
  );
};

export default ReconciliationPanel;
