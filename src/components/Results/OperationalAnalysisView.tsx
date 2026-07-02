/**
 * OperationalAnalysisView — V3-H03
 * Dashboard for operational KPI analysis
 * DBR77: navy-900 dark bg, rounded-xl cards, pill filters, emerald/red/amber status
 */

import { ArrowDown, ArrowRight, ArrowUp, BarChart3, Target, TrendingUp } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { shouldFallbackToLegacyResults, V8ResultsApi } from '@/services/api/v8/results';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

import {
  deriveNeedsEntry,
  deriveStatus,
  deriveTrend,
  type KPIStatus,
  type KPITrend,
  mapResultsKpis,
  type ResultsKPI,
} from './kpiDomain';
import { KPITimeSeriesDrawer } from './KPITimeSeriesDrawer';

const STATUS_STYLES: Record<KPIStatus, { bg: string; text: string; dot: string }> = {
  'on-target': { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  below: { bg: 'bg-rose-500/10', text: 'text-rose-400', dot: 'bg-rose-500' },
  'no-data': { bg: 'bg-slate-500/10', text: 'text-slate-600', dot: 'bg-slate-400' },
};

const TREND_ICON: Record<KPITrend, { Icon: typeof ArrowUp; color: string }> = {
  up: { Icon: ArrowUp, color: 'text-emerald-400' },
  down: { Icon: ArrowDown, color: 'text-rose-400' },
  stable: { Icon: ArrowRight, color: 'text-slate-600' },
};

type SortOption = 'worst' | 'best' | 'recent';

interface OperationalAnalysisViewProps {
  kpis?: ResultsKPI[];
  loading?: boolean;
  onResultsTruthChange?: () => void | Promise<void>;
}

export const OperationalAnalysisView: React.FC<OperationalAnalysisViewProps> = ({
  kpis: controlledKpis,
  loading: controlledLoading,
  onResultsTruthChange,
}) => {
  const { t } = useTranslation();
  const [kpis, setKpis] = useState<ResultsKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [drawerKpiId, setDrawerKpiId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('worst');
  const [filterProject, setFilterProject] = useState<string | null>(null);
  const [filterOwner, setFilterOwner] = useState<string | null>(null);
  const isControlled = controlledKpis !== undefined;
  const effectiveKpis = isControlled ? controlledKpis || [] : kpis;
  const effectiveLoading = isControlled ? Boolean(controlledLoading) : loading;

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    try {
      let kpisList: any[] = [];
      let mappingsList: any[] = [];
      try {
        const catalog = await V8ResultsApi.getKpiCatalog();
        kpisList = Array.isArray(catalog?.kpis) ? catalog.kpis : [];
        mappingsList = Array.isArray(catalog?.mappings) ? catalog.mappings : [];
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        const [kpisRes, mappingsRes] = await Promise.allSettled([
          Api.get('/benefits/kpis'),
          Api.get('/benefits/kpi-mappings'),
        ]);
        const kpisPayload: any = kpisRes.status === 'fulfilled' ? (kpisRes.value as any) : null;
        kpisList = (kpisPayload?.data || []) as any[];

        const mappingsPayload: any =
          mappingsRes.status === 'fulfilled' ? (mappingsRes.value as any) : null;
        mappingsList = (mappingsPayload?.data || []) as any[];
      }

      const byKpi = new Map<string, Array<{ id: string; name: string }>>();
      for (const m of mappingsList || []) {
        const kpiId = String((m as any).kpiId || (m as any).kpi_id || '').trim();
        const initiativeId = String(
          (m as any).initiativeId || (m as any).initiative_id || ''
        ).trim();
        const initiativeName = String(
          (m as any).initiativeName || (m as any).initiative_name || ''
        ).trim();
        if (!kpiId || !initiativeId) continue;
        const arr = byKpi.get(kpiId) || [];
        if (!arr.some((x) => x.id === initiativeId)) {
          arr.push({ id: initiativeId, name: initiativeName || initiativeId });
        }
        byKpi.set(kpiId, arr);
      }

      setKpis(mapResultsKpis(kpisList, mappingsList));
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isControlled) {
      setLoading(false);
      return;
    }
    fetchKPIs();
    trackFunnelEvent('results_analysis_opened', { type: 'operational' });
  }, [fetchKPIs, isControlled]);

  const projects = useMemo(
    () => [...new Set(effectiveKpis.filter((k) => k.initiativeName).map((k) => k.initiativeName!))],
    [effectiveKpis]
  );
  const owners = useMemo(
    () => [...new Set(effectiveKpis.filter((k) => k.ownerName).map((k) => k.ownerName!))],
    [effectiveKpis]
  );

  const filteredKpis = useMemo(() => {
    let items = [...effectiveKpis];
    if (filterProject) items = items.filter((k) => k.initiativeName === filterProject);
    if (filterOwner) items = items.filter((k) => k.ownerName === filterOwner);

    if (sortBy === 'worst') {
      items.sort((a, b) => {
        const score = (k: ResultsKPI) =>
          k.status === 'below' ? 2 : k.status === 'on-target' ? 1 : 0;
        return score(b) - score(a);
      });
    } else if (sortBy === 'best') {
      items.sort((a, b) => {
        const score = (k: ResultsKPI) =>
          k.status === 'on-target' ? 2 : k.status === 'below' ? 0 : 1;
        return score(b) - score(a);
      });
    } else {
      items.sort((a, b) => {
        const da = a.latestMeasurementDate || a.createdAt || '';
        const db = b.latestMeasurementDate || b.createdAt || '';
        return new Date(db).getTime() - new Date(da).getTime();
      });
    }
    return items;
  }, [effectiveKpis, sortBy, filterProject, filterOwner]);

  const summary = useMemo(() => {
    const total = filteredKpis.length;
    const onTarget = filteredKpis.filter((k) => k.status === 'on-target').length;
    const below = filteredKpis.filter((k) => k.status === 'below').length;
    const needsEntry = filteredKpis.filter((k) => Boolean((k as any).needsEntry)).length;
    return {
      total,
      onTargetPct: total > 0 ? Math.round((onTarget / total) * 100) : 0,
      belowCount: below,
      needsEntry,
    };
  }, [filteredKpis]);

  const clearFilters = useCallback(() => {
    setFilterProject(null);
    setFilterOwner(null);
  }, []);

  if (effectiveLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex items-center gap-3 text-slate-600">
          <BarChart3 size={20} className="animate-pulse" />
          <span className="text-sm">{t('common.loading', 'Loading...')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-xl bg-gradient-to-br from-navy-900 to-navy-800 border border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <Target size={16} className="text-slate-600" />
            <span className="text-xs font-medium text-slate-500 uppercase">
              {t('results.operational.totalTracked', 'Total KPIs Tracked')}
            </span>
          </div>
          <p className="text-lg font-semibold text-white">{summary.total}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-navy-900 to-navy-800 border border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={16} className="text-emerald-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">
              {t('results.operational.onTargetPct', 'On Target %')}
            </span>
          </div>
          <p className="text-lg font-semibold text-emerald-400">{summary.onTargetPct}%</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-navy-900 to-navy-800 border border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDown size={16} className="text-rose-400" />
            <span className="text-xs font-medium text-slate-500 uppercase">
              {t('results.operational.belowTarget', 'Below Target')}
            </span>
          </div>
          <p className="text-lg font-semibold text-rose-400">{summary.belowCount}</p>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-navy-900 to-navy-800 border border-navy-700 p-4">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={16} className="text-slate-600" />
            <span className="text-xs font-medium text-slate-500 uppercase">
              {t('results.operational.needsEntry', 'Needs entry')}
            </span>
          </div>
          <p className="text-lg font-semibold text-amber-300">{summary.needsEntry}</p>
        </div>
      </div>

      {/* Segmentation filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500 uppercase mr-1">
          {t('results.operational.filters', 'Filters')}:
        </span>
        {projects.map((p) => (
          <button
            key={p}
            onClick={() => setFilterProject(filterProject === p ? null : p)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterProject === p
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40'
                : 'bg-navy-800 text-slate-600 border border-navy-600 hover:border-navy-500'
            }`}
          >
            {p}
          </button>
        ))}
        {owners.map((o) => (
          <button
            key={o}
            onClick={() => setFilterOwner(filterOwner === o ? null : o)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterOwner === o
                ? 'bg-primary-500/20 text-primary-400 border border-primary-500/40'
                : 'bg-navy-800 text-slate-600 border border-navy-600 hover:border-navy-500'
            }`}
          >
            {o}
          </button>
        ))}
        {(filterProject || filterOwner) && (
          <button
            onClick={clearFilters}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 hover:text-white"
          >
            {t('common.clear', 'Clear')}
          </button>
        )}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-500">
          {t('results.operational.sortBy', 'Sort by')}:
        </span>
        {(['worst', 'best', 'recent'] as const).map((opt) => (
          <button
            key={opt}
            onClick={() => setSortBy(opt)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              sortBy === opt
                ? 'bg-primary-500/20 text-primary-400'
                : 'text-slate-600 hover:text-white'
            }`}
          >
            {t(
              `results.operational.sort.${opt}`,
              opt === 'worst'
                ? 'Worst performing'
                : opt === 'best'
                  ? 'Best performing'
                  : 'Most recent'
            )}
          </button>
        ))}
      </div>

      {/* Trend chart section (sparklines per KPI) */}
      {filteredKpis.length > 0 && (
        <div className="rounded-xl bg-navy-900 border border-navy-700 p-4">
          <h3 className="text-sm font-medium text-slate-600 mb-3">
            {t('results.operational.trends', 'KPI Trends')}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredKpis.slice(0, 6).map((kpi) => (
              <div key={kpi.id} className="p-3 rounded-lg bg-navy-800/50 border border-navy-700/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-slate-600 truncate">{kpi.name}</span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] ${STATUS_STYLES[kpi.status].bg} ${STATUS_STYLES[kpi.status].text}`}
                  >
                    {kpi.status === 'on-target'
                      ? t('results.operational.onTarget', 'On target')
                      : kpi.status === 'below'
                        ? t('results.operational.below', 'Below')
                        : t('results.operational.noData', 'No data')}
                  </span>
                </div>
                <div className="h-8 flex items-end gap-0.5">
                  {(() => {
                    const series = [kpi.prevValue, kpi.latestValue].filter(
                      (v): v is number => typeof v === 'number' && Number.isFinite(v)
                    );
                    const max = series.length ? Math.max(...series.map((v) => Math.abs(v))) : 0;
                    const base = max > 0 ? max : 1;
                    const bars = series.length > 0 ? series : [0];
                    return bars.map((v, idx) => (
                      <div
                        key={idx}
                        className="flex-1 rounded-sm min-h-[4px]"
                        style={{
                          // Categorical mini-series bar — c-tag palette (§15.1: crimson nigdy jako dana).
                          backgroundColor: 'color-mix(in srgb, var(--c-tag-1) 40%, transparent)',
                          height: `${Math.max(15, Math.round((Math.abs(v) / base) * 100))}%`,
                        }}
                      />
                    ));
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredKpis.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-500">
            <Target size={32} className="text-slate-600 mb-2" />
            <span>{t('results.emptyState', 'No KPIs found')}</span>
          </div>
        ) : (
          filteredKpis.map((kpi) => {
            const s = STATUS_STYLES[kpi.status];
            const { Icon: TIcon, color: tColor } = TREND_ICON[kpi.trend];
            return (
              <div
                key={kpi.id}
                onClick={() => setDrawerKpiId(kpi.id)}
                className="group rounded-xl bg-navy-900 border border-navy-700 p-4 cursor-pointer hover:shadow-lg hover:shadow-primary-500/5 hover:border-primary-500/30 hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex flex-wrap items-center gap-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                      {kpi.status === 'on-target'
                        ? t('results.operational.onTarget', 'On target')
                        : kpi.status === 'below'
                          ? t('results.operational.below', 'Below')
                          : t('results.operational.noData', 'No data')}
                    </span>
                    {kpi.needsEntry ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300">
                        {t('results.needsEntry.badge', 'Needs entry')}
                      </span>
                    ) : null}
                  </div>
                  <TIcon size={14} className={tColor} />
                </div>
                <h3 className="text-sm font-medium text-white line-clamp-2 mb-2">{kpi.name}</h3>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-semibold text-white">
                    {kpi.latestValue != null ? kpi.latestValue.toLocaleString() : '—'}
                  </span>
                  <span className="text-xs text-slate-500">
                    vs {kpi.targetValue != null ? kpi.targetValue.toLocaleString() : '—'}{' '}
                    {kpi.unit || ''}
                  </span>
                </div>
                <div className="h-6 flex items-end gap-0.5 mb-3">
                  {(() => {
                    const series = [kpi.prevValue, kpi.latestValue].filter(
                      (v): v is number => typeof v === 'number' && Number.isFinite(v)
                    );
                    const max = series.length ? Math.max(...series.map((v) => Math.abs(v))) : 0;
                    const base = max > 0 ? max : 1;
                    const bars = series.length > 0 ? series : [0];
                    return bars.map((v, idx) => (
                      <div
                        key={idx}
                        className="flex-1 rounded-sm bg-slate-600 min-h-[2px]"
                        style={{
                          height: `${Math.max(12, Math.round((Math.abs(v) / base) * 100))}%`,
                        }}
                      />
                    ));
                  })()}
                </div>
                {kpi.initiativeName && (
                  <a
                    href="#"
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs text-primary-400 hover:underline truncate block"
                  >
                    {kpi.initiativeName}
                  </a>
                )}
              </div>
            );
          })
        )}
      </div>

      {drawerKpiId && (
        <KPITimeSeriesDrawer
          kpiId={drawerKpiId}
          onClose={() => setDrawerKpiId(null)}
          onValueRecorded={() => {
            if (onResultsTruthChange) {
              void onResultsTruthChange();
              return;
            }
            void fetchKPIs();
          }}
        />
      )}
    </div>
  );
};

export default OperationalAnalysisView;
