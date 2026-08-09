/**
 * ROITrackingView — V3-H02
 * ROI plan vs realized tracking for initiatives
 * DBR77 "Tech Sexy": navy-900 dark bg, monochromatic, h-9 controls, pill buttons
 */

import {
  BarChart3,
  ChevronDown,
  DollarSign,
  Edit3,
  Maximize2,
  MoreVertical,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LoadingState as SharedLoadingState } from '@/components/shared/states';
import { Api } from '@/services/api';
import {
  shouldFallbackToLegacyResults,
  V8ResultsApi,
  type V8ResultsRoiPortfolioSummary,
} from '@/services/api/v8/results';

import { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { ReconciliationPanel } from './ReconciliationPanel';
import { ROIDetailDrawer } from './ROIDetailDrawer';

// CB-04/RB-003: 'not-evaluable' is distinct from 'on-track' — an initiative
// with no realized benefit yet, or a zero projected baseline, has not been
// measured at all. Silently reporting that as "on track" (the pre-fix
// behavior) is a false positive: it tells the user a plan is succeeding
// when it has never actually been evaluated.
export type ROIStatus = 'on-track' | 'below' | 'above' | 'not-evaluable';

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
}

interface ROITrackingViewProps {
  /** When changed, forces data refetch (used by topbar "Add" flow). */
  refreshNonce?: number;
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
  'on-track': {
    bg: 'bg-c-surface-raised/10',
    text: 'text-c-text-secondary',
    dot: 'bg-c-border-strong',
  },
  below: { bg: 'bg-danger-500/10', text: 'text-danger-400', dot: 'bg-danger-500' },
  above: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  'not-evaluable': {
    bg: 'bg-c-surface-raised/10',
    text: 'text-c-text-muted',
    dot: 'bg-c-text-muted',
  },
};

export function deriveROIStatus(item: ROIInitiativeItem): ROIStatus {
  if (!item.hasRealized || item.projectedBenefit === 0) return 'not-evaluable';
  const pct =
    item.projectedBenefit !== 0
      ? ((item.realizedBenefit - item.projectedBenefit) / Math.abs(item.projectedBenefit)) * 100
      : 0;
  if (pct > 10) return 'above';
  if (pct < -10) return 'below';
  return 'on-track';
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
        className={`h-9 px-2 rounded-lg border border-c-border-strong dark:border-c-border-strong hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors flex items-center gap-1 ${
          activeValues.length > 0 ? 'text-c-info border-c-focus' : 'text-c-text-muted'
        }`}
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-lg shadow-xl overflow-hidden">
            <div className="max-h-[200px] overflow-y-auto p-2">
              {options.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-c-surface-raised cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    className="rounded border-c-border-strong bg-c-surface-raised text-c-focus-solid focus:ring-c-focus"
                  />
                  {o.color && <span className={`w-2 h-2 rounded-full ${o.color}`} />}
                  <span className="text-sm text-c-text-secondary">{o.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between p-2 border-t border-c-border">
              <button
                onClick={() => {
                  setSelected([]);
                  onApply([]);
                  setOpen(false);
                }}
                className="text-xs text-c-text-muted hover:text-c-text transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  onApply(selected);
                  setOpen(false);
                }}
                className="h-9 px-3 text-xs font-medium rounded-full bg-c-text text-c-bg hover:opacity-90 transition-colors"
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
      {status === 'above'
        ? 'Above plan'
        : status === 'below'
          ? 'Below plan'
          : status === 'not-evaluable'
            ? 'Not evaluable yet'
            : 'On track'}
    </span>
  );
};

export const ROITrackingView: React.FC<ROITrackingViewProps> = ({ refreshNonce }) => {
  const { t } = useTranslation();
  const [items, setItems] = useState<ROIInitiativeItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [drawerInitiativeId, setDrawerInitiativeId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
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
      setItems((payload.items || []).map((i: any) => ({ ...i, roiStatus: deriveROIStatus(i) })));
      setSummary(payload.summary || null);
    } catch {
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshNonce]);

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
          const v = col === 'status' ? i.roiStatus : (i as any)[col];
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
          va = a.roiStatus;
          vb = b.roiStatus;
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

  const totalPlanned =
    summary?.totalProjected ?? filteredItems.reduce((s, i) => s + i.projectedBenefit, 0);
  const totalRealized =
    summary?.totalRealized ?? filteredItems.reduce((s, i) => s + i.realizedBenefit, 0);
  const totalVariance = summary?.totalVariance ?? filteredItems.reduce((s, i) => s + i.variance, 0);
  const variancePct = totalPlanned !== 0 ? (totalVariance / Math.abs(totalPlanned)) * 100 : 0;

  const statusFilterOptions: FilterOption[] = [
    {
      value: 'on-track',
      label: t('results.roi.statusOnTrack', 'On track'),
      color: 'bg-c-border-strong',
    },
    { value: 'below', label: t('results.roi.statusBelow', 'Below plan'), color: 'bg-danger-500' },
    { value: 'above', label: t('results.roi.statusAbove', 'Above plan'), color: 'bg-emerald-500' },
    {
      value: 'not-evaluable',
      label: t('results.roi.statusNotEvaluable', 'Not evaluable yet'),
      color: 'bg-c-text-muted',
    },
  ];

  if (loading) {
    return (
      <div className="p-4">
        <SharedLoadingState template="list" rows={6} />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-c-surface to-c-surface-raised border border-c-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-c-text-secondary" />
            <span className="text-xs font-medium text-c-text-muted uppercase">
              {t('results.roi.totalPlanned', 'Total Planned ROI')}
            </span>
          </div>
          <p className="text-lg font-semibold text-white">{formatCurrency(totalPlanned)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-c-surface to-c-surface-raised border border-c-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-c-text-secondary" />
            <span className="text-xs font-medium text-c-text-muted uppercase">
              {t('results.roi.totalRealized', 'Total Realized ROI')}
            </span>
          </div>
          <p className="text-lg font-semibold text-white">{formatCurrency(totalRealized)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-c-surface to-c-surface-raised border border-c-border p-4">
          <div className="flex items-center gap-2 mb-1">
            {totalVariance >= 0 ? (
              <TrendingUp size={16} className="text-emerald-400" />
            ) : (
              <TrendingDown size={16} className="text-danger-400" />
            )}
            <span className="text-xs font-medium text-c-text-muted uppercase">
              {t('results.roi.overallVariance', 'Overall Variance')}
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

      {/* Initiative ROI Table */}
      {/* §27-exempt: financial-calculation — bespoke sort/filter state drives both table and KPI summary cards above; inline MoreVertical action menus are context-specific */}
      <div className="bg-c-surface border border-slate-200/60 dark:border-white/[0.03] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-c-surface/50 border-b border-c-border/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[20%]">
                  <button
                    onClick={() => handleSort('initiativeName')}
                    className="hover:text-white transition-colors flex items-center gap-1"
                  >
                    {t('results.roi.columns.initiative', 'Initiative')}
                    {sortCol === 'initiativeName' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[12%]">
                  <button
                    onClick={() => handleSort('projectedBenefit')}
                    className="hover:text-white transition-colors"
                  >
                    {t('results.roi.columns.plannedRoi', 'Planned ROI')}
                    {sortCol === 'projectedBenefit' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[12%]">
                  <button
                    onClick={() => handleSort('realizedBenefit')}
                    className="hover:text-white transition-colors"
                  >
                    {t('results.roi.columns.realizedRoi', 'Realized ROI')}
                    {sortCol === 'realizedBenefit' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[10%]">
                  <button
                    onClick={() => handleSort('variance')}
                    className="hover:text-white transition-colors"
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
                  {t('results.roi.columns.period', 'Period')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-c-text-muted uppercase tracking-wider w-[10%]">
                  {t('results.roi.columns.owner', 'Owner')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-c-text-muted uppercase tracking-wider w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-c-border-subtle/50">
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
                      className="group hover:bg-c-surface-raised/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-white">
                          {item.initiativeName || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-c-text-secondary">
                        {formatCurrency(item.projectedBenefit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-c-text-secondary">
                        {formatCurrency(item.realizedBenefit)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${varColor}`}>
                        {formatPercent(varPct)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={roiStatus} />
                      </td>
                      <td className="px-4 py-3 text-sm text-c-text-muted">
                        {t('results.roi.periodYtd', 'YTD')}
                      </td>
                      <td className="px-4 py-3 text-sm text-c-text-muted">
                        {item.ownerName || '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuRowId(
                                menuRowId === item.initiativeId ? null : item.initiativeId
                              );
                            }}
                            className="p-1.5 rounded hover:bg-c-surface-raised text-c-text-muted hover:text-white transition-colors h-9"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {menuRowId === item.initiativeId && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuRowId(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-c-surface-raised border border-c-border rounded-lg shadow-xl overflow-hidden">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowAction('open', item);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised"
                                >
                                  <Maximize2 size={14} />
                                  {t('results.roi.actions.openDetail', 'Open detail')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowAction('record', item);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised"
                                >
                                  <Plus size={14} />
                                  {t('results.roi.actions.recordActual', 'Record actual')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowAction('history', item);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised"
                                >
                                  <Edit3 size={14} />
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

      {/* M16 → M15: Finance reconciliation status + projected-vs-realized variance */}
      <ReconciliationPanel refreshNonce={refreshNonce} />

      {drawerInitiativeId && (
        <ROIDetailDrawer
          initiativeId={drawerInitiativeId}
          initiativeName={
            items.find((i) => i.initiativeId === drawerInitiativeId)?.initiativeName || ''
          }
          onClose={() => setDrawerInitiativeId(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
};

export default ROITrackingView;
