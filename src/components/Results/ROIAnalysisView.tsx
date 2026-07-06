/**
 * ROIAnalysisView — V3-H03
 * Dashboard for ROI financial analysis
 * DBR77: navy-900 dark bg, rounded-xl cards, solid chart colors, anomaly highlights
 */

import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  Lock,
  Maximize2,
  MoreVertical,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ErrorState, LoadingState } from '@/components/ui/primitives';
import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyResults,
  V8ResultsApi,
  type V8ResultsRoiPortfolioSummary,
} from '@/services/api/v8/results';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { ROIDetailDrawer } from './ROIDetailDrawer';

export type ROIStatus = 'on-track' | 'below' | 'above';

export interface ROIInitiativeItem {
  initiativeId: string;
  initiativeName: string;
  status: string;
  priority: string;
  projectedBenefit: number;
  realizedBenefit: number;
  variance: number;
  confidence?: string;
  hasRealized: boolean;
  ownerName?: string;
  category?: string;
}

interface PortfolioSummary {
  items: ROIInitiativeItem[];
  summary: {
    totalProjected: number;
    totalRealized: number;
    totalCapex: number;
    totalVariance: number;
    initiativeCount: number;
    coveragePercent: number;
  };
}

interface FilterOption {
  value: string;
  label: string;
  color?: string;
}

function normalizePortfolioSummary(
  payload:
    | V8ResultsRoiPortfolioSummary
    | { items: PortfolioSummary['items']; summary: PortfolioSummary['summary'] | null }
): { items: PortfolioSummary['items']; summary: PortfolioSummary['summary'] | null } {
  return {
    items: (payload.items || []).map((item) => ({
      ...item,
      confidence: item.confidence ?? undefined,
    })),
    summary: payload.summary || null,
  };
}

const STATUS_STYLES: Record<ROIStatus, { bg: string; text: string; dot: string }> = {
  'on-track': { bg: 'bg-c-surface-raised/10', text: 'text-c-text-secondary', dot: 'bg-c-border-strong' },
  below: { bg: 'bg-danger-500/10', text: 'text-danger-400', dot: 'bg-danger-500' },
  above: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
};

function deriveROIStatus(item: ROIInitiativeItem): ROIStatus {
  if (!item.hasRealized || item.projectedBenefit === 0) return 'on-track';
  const pct =
    item.projectedBenefit !== 0
      ? ((item.realizedBenefit - item.projectedBenefit) / Math.abs(item.projectedBenefit)) * 100
      : 0;
  if (pct > 10) return 'above';
  if (pct < -10) return 'below';
  return 'on-track';
}

/**
 * ROI assumption lock state derived from the initiative lifecycle status.
 * Once an initiative reaches a terminal lifecycle status its ROI assumptions are
 * frozen as benefits-realization evidence — they must not be edited in place.
 * `approved` reflects a formal sign-off; `locked` reflects a terminal/closed
 * lifecycle. This mirrors the backend definition/target lock in resultsROIService.
 */
export type ROILockState = 'open' | 'locked' | 'approved';

const ROI_APPROVED_STATUSES = new Set(['APPROVED', 'SIGNED_OFF', 'TRACKING', 'REALIZED']);
const ROI_LOCKED_STATUSES = new Set([
  'COMPLETED',
  'DONE',
  'CLOSED',
  'ARCHIVED',
  'CANCELLED',
  'FINALIZED',
  'LOCKED',
]);

export function deriveROILockState(status: string | null | undefined): ROILockState {
  const normalized = String(status || '')
    .trim()
    .toUpperCase();
  if (ROI_LOCKED_STATUSES.has(normalized)) return 'locked';
  if (ROI_APPROVED_STATUSES.has(normalized)) return 'approved';
  return 'open';
}

function isRoiEditable(lockState: ROILockState): boolean {
  return lockState === 'open';
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

const ColumnFilterDropdown: React.FC<{
  options: FilterOption[];
  activeValues: string[];
  onApply: (values: string[]) => void;
}> = ({ options, activeValues, onApply }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>(activeValues);

  const toggle = (v: string) =>
    setSelected((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`h-8 px-2 rounded-lg border transition-colors flex items-center gap-1 ${
          activeValues.length > 0
            ? 'text-c-info dark:text-c-info border-c-focus'
            : 'text-c-text-muted border-c-border/60 dark:border-c-border-strong hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
        }`}
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-white dark:bg-c-surface-raised border border-c-border/70 dark:border-c-border rounded-lg shadow-xl overflow-hidden">
            <div className="max-h-[200px] overflow-y-auto p-2">
              {options.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    className="rounded border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface-raised text-c-focus-solid focus:ring-c-focus"
                  />
                  {o.color && <span className={`w-2 h-2 rounded-full ${o.color}`} />}
                  <span className="text-sm text-c-text-secondary dark:text-c-text-secondary">{o.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between p-2 border-t border-c-border/60 dark:border-c-border">
              <button
                onClick={() => {
                  setSelected([]);
                  onApply([]);
                  setOpen(false);
                }}
                className="text-xs text-c-text-muted hover:text-c-text dark:hover:text-c-text transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  onApply(selected);
                  setOpen(false);
                }}
                className="h-8 px-3 text-xs font-medium rounded-full bg-c-text text-c-bg hover:opacity-90 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

const StatusBadge: React.FC<{ status: ROIStatus }> = ({ status }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES['on-track'];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status === 'above' ? 'Above plan' : status === 'below' ? 'Below plan' : 'On track'}
    </span>
  );
};

const LockBadge: React.FC<{ lockState: ROILockState }> = ({ lockState }) => {
  const { t } = useTranslation();
  if (lockState === 'open') return null;
  if (lockState === 'approved') {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400"
        title={t(
          'results.roiAnalysis.approvedHint',
          'Assumptions approved — editing is restricted'
        )}
      >
        <CheckCircle2 size={12} />
        {t('results.roiAnalysis.approved', 'Approved')}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-c-surface-raised/15 text-c-text-secondary"
      title={t(
        'results.roiAnalysis.lockedHint',
        'Assumptions are finalized and locked for editing'
      )}
    >
      <Lock size={12} />
      {t('results.roiAnalysis.locked', 'Locked')}
    </span>
  );
};

export const ROIAnalysisView: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<ROIInitiativeItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [sortCol, setSortCol] = useState<string | null>('variance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [drawerInitiativeId, setDrawerInitiativeId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      let payload: {
        items: PortfolioSummary['items'];
        summary: PortfolioSummary['summary'] | null;
      } = {
        items: [],
        summary: null,
      };
      try {
        payload = normalizePortfolioSummary(await V8ResultsApi.getRoiPortfolioSummary());
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        const res = await Api.get('/benefits/roi/portfolio/summary');
        const data = (res as any)?.data || res;
        payload =
          typeof data?.items !== 'undefined'
            ? normalizePortfolioSummary(data)
            : { items: [], summary: null };
      }
      setItems(payload.items || []);
      setSummary(payload.summary || null);
    } catch {
      setItems([]);
      setSummary(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    trackFunnelEvent('results_analysis_opened', { type: 'roi' });
  }, [fetchData]);

  const filteredItems = useMemo(() => {
    let list = [...items].map((i) => ({ ...i, roiStatus: deriveROIStatus(i) }));

    if (activeFilters.length > 0) {
      const byColumn: Record<string, string[]> = {};
      activeFilters.forEach((f) => {
        if (!byColumn[f.column]) byColumn[f.column] = [];
        byColumn[f.column].push(f.value);
      });
      Object.entries(byColumn).forEach(([col, vals]) => {
        list = list.filter((i) => {
          const v = col === 'status' ? (i as any).roiStatus : (i as any)[col];
          return vals.includes(String(v));
        });
      });
    }

    if (sortCol) {
      list.sort((a, b) => {
        let va: any, vb: any;
        if (sortCol === 'initiativeName') {
          va = a.initiativeName || '';
          vb = b.initiativeName || '';
        } else if (sortCol === 'projectedBenefit') {
          va = a.projectedBenefit;
          vb = b.projectedBenefit;
        } else if (sortCol === 'realizedBenefit') {
          va = a.realizedBenefit;
          vb = b.realizedBenefit;
        } else if (sortCol === 'variance') {
          va = a.variance;
          vb = b.variance;
        } else if (sortCol === 'roiStatus') {
          va = (a as any).roiStatus;
          vb = (b as any).roiStatus;
        } else {
          va = (a as any)[sortCol];
          vb = (b as any)[sortCol];
        }
        if (va < vb) return sortDir === 'asc' ? -1 : 1;
        if (va > vb) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return list;
  }, [items, activeFilters, sortCol, sortDir]);

  const totalPlanned =
    summary?.totalProjected ?? filteredItems.reduce((s, i) => s + i.projectedBenefit, 0);
  const totalRealized =
    summary?.totalRealized ?? filteredItems.reduce((s, i) => s + i.realizedBenefit, 0);
  const totalVariance = summary?.totalVariance ?? filteredItems.reduce((s, i) => s + i.variance, 0);
  const variancePct = totalPlanned !== 0 ? (totalVariance / Math.abs(totalPlanned)) * 100 : 0;

  const lockedCount = filteredItems.filter((i) => deriveROILockState(i.status) === 'locked').length;
  const approvedCount = filteredItems.filter(
    (i) => deriveROILockState(i.status) === 'approved'
  ).length;

  const belowPlanCount = filteredItems.filter((i) => deriveROIStatus(i) === 'below').length;
  const anomalyMessage =
    belowPlanCount >= 3
      ? t('results.roiAnalysis.anomalyBelow', '{{count}} initiatives significantly below plan', {
          count: belowPlanCount,
        })
      : null;

  const getFilterValues = useCallback(
    (col: string) => activeFilters.filter((f) => f.column === col).map((f) => f.value),
    [activeFilters]
  );

  const applyColumnFilter = useCallback(
    (colId: string, values: string[], filterOptions?: FilterOption[]) => {
      const other = activeFilters.filter((f) => f.column !== colId);
      const added = values.map((v) => ({
        id: `${colId}-${v}`,
        column: colId,
        value: v,
        label: filterOptions?.find((o) => o.value === v)?.label || v,
        color: filterOptions?.find((o) => o.value === v)?.color,
      }));
      setActiveFilters([...other, ...added]);
    },
    [activeFilters]
  );

  const handleSort = useCallback((colId: string) => {
    setSortCol((c) => {
      if (c === colId) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return colId;
      }
      setSortDir('asc');
      return colId;
    });
  }, []);

  const handleRowAction = useCallback((action: string, item: ROIInitiativeItem) => {
    switch (action) {
      case 'open':
      case 'preview':
        setDrawerInitiativeId(item.initiativeId);
        break;
      case 'record':
        setDrawerInitiativeId(item.initiativeId);
        break;
      case 'history':
        setDrawerInitiativeId(item.initiativeId);
        break;
      default:
        break;
    }
    setMenuRowId(null);
  }, []);

  const statusFilterOptions: FilterOption[] = [
    { value: 'on-track', label: t('results.roi.statusOnTrack', 'On track'), color: 'bg-c-border-strong' },
    { value: 'below', label: t('results.roi.statusBelow', 'Below plan'), color: 'bg-danger-500' },
    { value: 'above', label: t('results.roi.statusAbove', 'Above plan'), color: 'bg-emerald-500' },
  ];

  if (loading) {
    return (
      <div className="p-4">
        <LoadingState variant="skeleton" rows={6} label={t('common.loading', 'Loading...')} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4">
        <ErrorState
          title={t('results.roiAnalysis.errorTitle', 'Could not load ROI analysis')}
          message={t(
            'results.roiAnalysis.errorMessage',
            'The ROI portfolio could not be loaded. Please try again.'
          )}
          retry={fetchData}
        />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Lock / approval governance banner */}
      {(lockedCount > 0 || approvedCount > 0) && (
        <div className="rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border/70 dark:border-c-border p-3 flex flex-wrap items-center gap-3">
          <Lock size={16} className="text-c-text-secondary shrink-0" />
          <span className="text-sm text-c-text-secondary dark:text-c-text-secondary">
            {t(
              'results.roiAnalysis.lockBanner',
              '{{locked}} locked · {{approved}} approved — finalized assumptions are read-only',
              { locked: lockedCount, approved: approvedCount }
            )}
          </span>
        </div>
      )}
      {/* Portfolio summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-white dark:bg-c-surface border border-slate-200/60 dark:border-white/[0.03]/70 dark:border-c-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-c-text-secondary" />
            <span className="text-xs font-medium text-c-text-muted uppercase">
              {t('results.roiAnalysis.totalPlanned', 'Total Planned Value')}
            </span>
          </div>
          <p className="text-lg font-semibold text-c-text dark:text-white">
            {formatCurrency(totalPlanned)}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-c-surface border border-slate-200/60 dark:border-white/[0.03]/70 dark:border-c-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-c-text-secondary" />
            <span className="text-xs font-medium text-c-text-muted uppercase">
              {t('results.roiAnalysis.totalRealized', 'Total Realized Value')}
            </span>
          </div>
          <p className="text-lg font-semibold text-c-text dark:text-white">
            {formatCurrency(totalRealized)}
          </p>
        </div>
        <div className="rounded-xl bg-white dark:bg-c-surface border border-slate-200/60 dark:border-white/[0.03]/70 dark:border-c-border p-4">
          <div className="flex items-center gap-2 mb-1">
            {totalVariance >= 0 ? (
              <TrendingUp size={16} className="text-emerald-400" />
            ) : (
              <TrendingDown size={16} className="text-danger-400" />
            )}
            <span className="text-xs font-medium text-c-text-muted uppercase">
              {t('results.roiAnalysis.portfolioVariance', 'Portfolio Variance')}
            </span>
          </div>
          <p
            className={`text-lg font-semibold ${
              totalVariance > 0
                ? 'text-emerald-400'
                : totalVariance < 0
                  ? 'text-danger-400'
                  : 'text-c-text-secondary'
            }`}
          >
            {formatCurrency(totalVariance)} ({formatPercent(variancePct)})
          </p>
        </div>
      </div>

      {/* Anomaly highlights */}
      {anomalyMessage && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-amber-400">
              {t('results.roiAnalysis.anomalyTitle', 'AI-suggested insights')}
            </h4>
            <p className="text-sm text-c-text-secondary mt-1">{anomalyMessage}</p>
          </div>
        </div>
      )}

      {/* Waterfall/bar chart - initiative contributions sorted by variance */}
      {filteredItems.length > 0 && (
        <div className="rounded-xl bg-white dark:bg-c-surface border border-slate-200/70 dark:border-c-border p-4">
          <h3 className="text-sm font-medium text-slate-600 dark:text-c-text-secondary mb-3">

            {t('results.roiAnalysis.contributionsChart', 'Initiative Contributions to ROI')}
          </h3>
          {(() => {
            const chartItems = [...filteredItems]
              .sort((a, b) => a.variance - b.variance)
              .slice(0, 10);
            // Diverging bars around a zero baseline: positive variance grows up,
            // negative grows down. Height is proportional to |variance| against the
            // largest magnitude, so equal-sign values no longer collapse into flat
            // full-height bars (H2.6). Series colors use c-tag tokens.
            const maxAbs = Math.max(...chartItems.map((i) => Math.abs(i.variance)), 1);
            return (
              <div className="relative h-32 flex items-stretch gap-1">
                {/* zero baseline */}
                <div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-slate-200 dark:bg-c-border" />
                {chartItems.map((item) => {
                  const isNeg = item.variance < 0;
                  // Half-height track above and below the baseline.
                  const h = (Math.abs(item.variance) / maxAbs) * 50;
                  return (
                    <div
                      key={item.initiativeId}
                      className="relative flex-1 flex flex-col group"
                      title={`${item.initiativeName}: ${formatCurrency(item.variance)}`}
                    >
                      {/* upper half — positive bars anchored to baseline */}
                      <div className="flex-1 flex items-end">
                        {!isNeg && (
                          <div
                            className="w-full min-h-[3px] rounded-t transition-all"
                            style={{
                              height: `${Math.max(h, 3)}%`,
                              backgroundColor: 'var(--c-tag-12)',
                            }}
                          />
                        )}
                      </div>
                      {/* lower half — negative bars hang from baseline */}
                      <div className="flex-1 flex items-start">
                        {isNeg && (
                          <div
                            className="w-full min-h-[3px] rounded-b transition-all"
                            style={{
                              height: `${Math.max(h, 3)}%`,
                              backgroundColor: 'var(--c-tag-4)',
                            }}
                          />
                        )}
                      </div>
                      <span className="absolute -bottom-1 inset-x-0 text-center text-[10px] text-slate-500 dark:text-c-text-muted truncate opacity-0 group-hover:opacity-100">
                        {item.initiativeName?.slice(0, 8)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Initiative list table */}
      {/* §27-exempt: financial-calculation — sort state drives bar chart order; lock-conditional disabled row actions and custom ColumnFilterDropdown in Status header cannot be expressed through FilterableTable column API without destructive rewrite */}
      <div className="bg-white dark:bg-c-surface border border-slate-200/60 dark:border-white/[0.03]/70 dark:border-c-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-c-surface-raised/80 dark:bg-c-surface/50 border-b border-c-border/60 dark:border-c-border/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[20%]">
                  <button
                    onClick={() => handleSort('initiativeName')}
                    className="hover:text-c-text dark:hover:text-white transition-colors flex items-center gap-1"
                  >
                    {t('results.roi.columns.initiative', 'Initiative')}
                    {sortCol === 'initiativeName' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[12%]">
                  <button
                    onClick={() => handleSort('projectedBenefit')}
                    className="hover:text-c-text dark:hover:text-white transition-colors"
                  >
                    {t('results.roiAnalysis.plannedRoi', 'Planned ROI')}
                    {sortCol === 'projectedBenefit' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[12%]">
                  <button
                    onClick={() => handleSort('realizedBenefit')}
                    className="hover:text-c-text dark:hover:text-white transition-colors"
                  >
                    {t('results.roiAnalysis.realizedRoi', 'Realized ROI')}
                    {sortCol === 'realizedBenefit' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[10%]">
                  <button
                    onClick={() => handleSort('variance')}
                    className="hover:text-c-text dark:hover:text-white transition-colors"
                  >
                    {t('results.roi.columns.variance', 'Variance')}
                    {sortCol === 'variance' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[12%]">
                  <div className="flex items-center gap-1">
                    <span>{t('results.roi.columns.status', 'Status')}</span>
                    <ColumnFilterDropdown
                      options={statusFilterOptions}
                      activeValues={getFilterValues('roiStatus')}
                      onApply={(v) => applyColumnFilter('roiStatus', v, statusFilterOptions)}
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[10%]">
                  {t('results.roiAnalysis.columns.lock', 'Lock')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[10%]">
                  {t('results.roi.columns.owner', 'Owner')}
                </th>
                <th
                  className="px-4 py-3 text-right text-xs font-medium text-c-text-muted uppercase tracking-wider w-16"
                  aria-label="Row actions"
                >
                  <span className="sr-only">{t('common.actions', 'Actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-c-border-subtle/60 dark:divide-c-border-subtle/50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-c-text-muted">
                    <div className="flex flex-col items-center gap-2">
                      <BarChart3 size={24} className="text-c-text-secondary" />
                      <span>{t('results.roi.emptyState', 'No initiatives with ROI data')}</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const roiStatus = deriveROIStatus(item);
                  const lockState = deriveROILockState(item.status);
                  const editable = isRoiEditable(lockState);
                  const varPct =
                    item.projectedBenefit !== 0
                      ? ((item.realizedBenefit - item.projectedBenefit) /
                          Math.abs(item.projectedBenefit)) *
                        100
                      : 0;
                  const varColor =
                    varPct > 0
                      ? 'text-emerald-400'
                      : varPct < 0
                        ? 'text-danger-400'
                        : 'text-c-text-secondary';

                  return (
                    <tr
                      key={item.initiativeId}
                      onClick={() => setDrawerInitiativeId(item.initiativeId)}
                      className="group hover:bg-c-surface-raised/80 dark:hover:bg-c-surface-raised/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-c-text dark:text-white">
                          {item.initiativeName || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-c-text-secondary dark:text-c-text-secondary">
                        {formatCurrency(item.projectedBenefit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-c-text-secondary dark:text-c-text-secondary">
                        {formatCurrency(item.realizedBenefit)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${varColor}`}>
                        {formatPercent(varPct)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={roiStatus} />
                      </td>
                      <td className="px-4 py-3">
                        {lockState === 'open' ? (
                          <span className="text-xs text-c-text-secondary">—</span>
                        ) : (
                          <LockBadge lockState={lockState} />
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-c-text-muted">{item.ownerName || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuRowId(
                                menuRowId === item.initiativeId ? null : item.initiativeId
                              );
                            }}
                            className="h-8 w-8 flex items-center justify-center rounded hover:bg-c-surface-raised dark:hover:bg-c-surface-raised text-c-text-muted hover:text-c-text dark:hover:text-white transition-colors"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {menuRowId === item.initiativeId && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuRowId(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-white dark:bg-c-surface-raised border border-c-border/70 dark:border-c-border rounded-lg shadow-xl overflow-hidden">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowAction('open', item);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-c-text-secondary dark:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
                                >
                                  <Maximize2 size={14} />
                                  {t('results.roi.actions.openDetail', 'Open detail')}
                                </button>
                                <button
                                  disabled={!editable}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!editable) return;
                                    handleRowAction('record', item);
                                  }}
                                  title={
                                    editable
                                      ? undefined
                                      : t(
                                          'results.roiAnalysis.lockedActionHint',
                                          'Assumptions are finalized — editing is blocked'
                                        )
                                  }
                                  className={`flex items-center gap-2 w-full px-3 py-2 text-sm ${
                                    editable
                                      ? 'text-c-text-secondary dark:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised'
                                      : 'text-c-text-secondary dark:text-c-text-muted cursor-not-allowed'
                                  }`}
                                >
                                  {editable ? <Plus size={14} /> : <Lock size={14} />}
                                  {t('results.roi.actions.recordActual', 'Record actual')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowAction('history', item);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-c-text-secondary dark:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
                                >
                                  {t('results.roi.actions.viewHistory', 'View history')}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {drawerInitiativeId && (
        <ROIDetailDrawer
          initiativeId={drawerInitiativeId}
          initiativeName={
            items.find((i) => i.initiativeId === drawerInitiativeId)?.initiativeName || ''
          }
          lockState={deriveROILockState(
            items.find((i) => i.initiativeId === drawerInitiativeId)?.status
          )}
          onClose={() => setDrawerInitiativeId(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
};

export default ROIAnalysisView;
