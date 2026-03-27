/**
 * ROIAnalysisView — V3-H03
 * Dashboard for ROI financial analysis
 * DBR77: navy-900 dark bg, rounded-xl cards, solid chart colors, anomaly highlights
 */

import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  DollarSign,
  Maximize2,
  MoreVertical,
  Plus,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { V8ResultsApi, shouldFallbackToLegacyResults } from '@/services/api/v8/results';
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

const STATUS_STYLES: Record<ROIStatus, { bg: string; text: string; dot: string }> = {
  'on-track': { bg: 'bg-slate-500/10', text: 'text-slate-400', dot: 'bg-slate-400' },
  below: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
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
        className={`h-9 px-2 rounded-lg border border-navy-600 hover:bg-navy-700 transition-colors flex items-center gap-1 ${
          activeValues.length > 0 ? 'text-primary-400 border-primary-500/40' : 'text-slate-500'
        }`}
      >
        <ChevronDown size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 min-w-[180px] bg-navy-800 border border-navy-700 rounded-lg shadow-xl overflow-hidden">
            <div className="max-h-[200px] overflow-y-auto p-2">
              {options.map((o) => (
                <label
                  key={o.value}
                  className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-navy-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(o.value)}
                    onChange={() => toggle(o.value)}
                    className="rounded border-navy-600 bg-navy-800 text-primary-500 focus:ring-primary-500"
                  />
                  {o.color && <span className={`w-2 h-2 rounded-full ${o.color}`} />}
                  <span className="text-sm text-slate-300">{o.label}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between p-2 border-t border-navy-700">
              <button
                onClick={() => {
                  setSelected([]);
                  onApply([]);
                  setOpen(false);
                }}
                className="text-xs text-slate-500 hover:text-white transition-colors"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  onApply(selected);
                  setOpen(false);
                }}
                className="h-9 px-3 text-xs font-medium rounded-full bg-primary-500 text-white hover:bg-primary-400 transition-colors"
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

export const ROIAnalysisView: React.FC = () => {
  const { t } = useTranslation();
  const [items, setItems] = useState<ROIInitiativeItem[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);
  const [sortCol, setSortCol] = useState<string | null>('variance');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [menuRowId, setMenuRowId] = useState<string | null>(null);
  const [drawerInitiativeId, setDrawerInitiativeId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let payload: { items: PortfolioSummary['items']; summary: PortfolioSummary['summary'] | null } = {
        items: [],
        summary: null,
      };
      try {
        payload = await V8ResultsApi.getRoiPortfolioSummary();
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        const res = await Api.get('/benefits/roi/portfolio/summary');
        const data = (res as any)?.data || res;
        payload = typeof data?.items !== 'undefined' ? data : { items: [], summary: null };
      }
      setItems(payload.items || []);
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
    { value: 'on-track', label: t('results.roi.statusOnTrack', 'On track'), color: 'bg-slate-400' },
    { value: 'below', label: t('results.roi.statusBelow', 'Below plan'), color: 'bg-red-500' },
    { value: 'above', label: t('results.roi.statusAbove', 'Above plan'), color: 'bg-emerald-500' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-slate-400">
          <BarChart3 size={20} className="animate-pulse" />
          <span className="text-sm">{t('common.loading', 'Loading...')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Portfolio summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-navy-900 to-navy-800 border border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">
              {t('results.roiAnalysis.totalPlanned', 'Total Planned Value')}
            </span>
          </div>
          <p className="text-lg font-semibold text-white">{formatCurrency(totalPlanned)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-navy-900 to-navy-800 border border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-slate-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">
              {t('results.roiAnalysis.totalRealized', 'Total Realized Value')}
            </span>
          </div>
          <p className="text-lg font-semibold text-white">{formatCurrency(totalRealized)}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-navy-900 to-navy-800 border border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            {totalVariance >= 0 ? (
              <TrendingUp size={16} className="text-emerald-400" />
            ) : (
              <TrendingDown size={16} className="text-red-400" />
            )}
            <span className="text-xs font-medium text-slate-500 uppercase">
              {t('results.roiAnalysis.portfolioVariance', 'Portfolio Variance')}
            </span>
          </div>
          <p
            className={`text-lg font-semibold ${
              totalVariance > 0
                ? 'text-emerald-400'
                : totalVariance < 0
                  ? 'text-red-400'
                  : 'text-slate-400'
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
            <p className="text-sm text-slate-300 mt-1">{anomalyMessage}</p>
          </div>
        </div>
      )}

      {/* Waterfall/bar chart - initiative contributions sorted by variance */}
      {filteredItems.length > 0 && (
        <div className="rounded-xl bg-navy-900 border border-navy-700 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">
            {t('results.roiAnalysis.contributionsChart', 'Initiative Contributions to ROI')}
          </h3>
          <div className="flex items-end gap-1 h-32">
            {[...filteredItems]
              .sort((a, b) => a.variance - b.variance)
              .slice(0, 10)
              .map((item, idx) => {
                const maxAbs = Math.max(...filteredItems.map((i) => Math.abs(i.variance)), 1);
                const h = (Math.abs(item.variance) / maxAbs) * 100;
                const isNeg = item.variance < 0;
                return (
                  <div
                    key={item.initiativeId}
                    className="flex-1 flex flex-col items-center group"
                    title={`${item.initiativeName}: ${formatCurrency(item.variance)}`}
                  >
                    <div
                      className={`w-full min-h-[4px] rounded-t transition-all ${
                        isNeg ? 'bg-red-500' : 'bg-emerald-500'
                      }`}
                      style={{ height: `${Math.max(h, 4)}%` }}
                    />
                    <span className="text-[10px] text-slate-500 truncate max-w-full mt-1 opacity-0 group-hover:opacity-100">
                      {item.initiativeName?.slice(0, 8)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Initiative list table */}
      <div className="bg-navy-900 border border-navy-700 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-navy-900/50 border-b border-navy-700/50">
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[20%]">
                  <button
                    onClick={() => handleSort('initiativeName')}
                    className="hover:text-white transition-colors flex items-center gap-1"
                  >
                    {t('results.roi.columns.initiative', 'Initiative')}
                    {sortCol === 'initiativeName' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[12%]">
                  <button
                    onClick={() => handleSort('projectedBenefit')}
                    className="hover:text-white transition-colors"
                  >
                    {t('results.roiAnalysis.plannedRoi', 'Planned ROI')}
                    {sortCol === 'projectedBenefit' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[12%]">
                  <button
                    onClick={() => handleSort('realizedBenefit')}
                    className="hover:text-white transition-colors"
                  >
                    {t('results.roiAnalysis.realizedRoi', 'Realized ROI')}
                    {sortCol === 'realizedBenefit' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[10%]">
                  <button
                    onClick={() => handleSort('variance')}
                    className="hover:text-white transition-colors"
                  >
                    {t('results.roi.columns.variance', 'Variance')}
                    {sortCol === 'variance' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                  </button>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[12%]">
                  <div className="flex items-center gap-1">
                    <span>{t('results.roi.columns.status', 'Status')}</span>
                    <ColumnFilterDropdown
                      options={statusFilterOptions}
                      activeValues={getFilterValues('roiStatus')}
                      onApply={(v) => applyColumnFilter('roiStatus', v, statusFilterOptions)}
                    />
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider w-[10%]">
                  {t('results.roi.columns.owner', 'Owner')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider w-16">
                  {t('common.actions', 'Actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy-700/50">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <BarChart3 size={24} className="text-slate-400" />
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
                        ? 'text-red-400'
                        : 'text-slate-400';

                  return (
                    <tr
                      key={item.initiativeId}
                      onClick={() => setDrawerInitiativeId(item.initiativeId)}
                      className="group hover:bg-navy-800/50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-white">
                          {item.initiativeName || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {formatCurrency(item.projectedBenefit)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-300">
                        {formatCurrency(item.realizedBenefit)}
                      </td>
                      <td className={`px-4 py-3 text-sm font-medium ${varColor}`}>
                        {formatPercent(varPct)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={roiStatus} />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">{item.ownerName || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuRowId(
                                menuRowId === item.initiativeId ? null : item.initiativeId
                              );
                            }}
                            className="p-1.5 rounded hover:bg-navy-700 text-slate-500 hover:text-white transition-colors h-9"
                          >
                            <MoreVertical size={14} />
                          </button>
                          {menuRowId === item.initiativeId && (
                            <>
                              <div
                                className="fixed inset-0 z-40"
                                onClick={() => setMenuRowId(null)}
                              />
                              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-navy-800 border border-navy-700 rounded-lg shadow-xl overflow-hidden">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowAction('open', item);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-navy-700"
                                >
                                  <Maximize2 size={14} />
                                  {t('results.roi.actions.openDetail', 'Open detail')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowAction('record', item);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-navy-700"
                                >
                                  <Plus size={14} />
                                  {t('results.roi.actions.recordActual', 'Record actual')}
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRowAction('history', item);
                                  }}
                                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-300 hover:bg-navy-700"
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
          onClose={() => setDrawerInitiativeId(null)}
          onSaved={fetchData}
        />
      )}
    </div>
  );
};

export default ROIAnalysisView;
