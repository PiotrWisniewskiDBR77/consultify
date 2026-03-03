import { Calendar, Target, TrendingUp, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api, API_URL, getHeaders } from '@/services/api';
import { InitiativeKPI, KPIMeasurement } from '@/types/core';

interface KPITimeSeriesDrawerProps {
  kpiId: string;
  onClose: () => void;
  onValueRecorded?: () => void;
}

type QuickStat = { label: string; value: string; color?: string };

type DeviationAction = {
  id: string;
  title: string;
  ownerUserId?: string | null;
  dueDate?: string | null;
  status: 'OPEN' | 'DONE' | 'CANCELLED';
};

type DeviationCase = {
  id: string;
  kpiId: string;
  severity: 'AMBER' | 'RED';
  status: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  deviationSummary?: string | null;
  rcaText?: string | null;
  actions?: DeviationAction[];
};

export const KPITimeSeriesDrawer: React.FC<KPITimeSeriesDrawerProps> = ({
  kpiId,
  onClose,
  onValueRecorded,
}) => {
  const { t } = useTranslation();
  const [kpi, setKpi] = useState<InitiativeKPI | null>(null);
  const [measurements, setMeasurements] = useState<KPIMeasurement[]>([]);
  const [loading, setLoading] = useState(true);

  const [openCase, setOpenCase] = useState<DeviationCase | null>(null);
  const [rcaDraft, setRcaDraft] = useState('');
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionDue, setNewActionDue] = useState('');
  const [caseBusy, setCaseBusy] = useState(false);

  const [newValue, setNewValue] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, tsRes, casesRes] = await Promise.all([
        fetch(`${API_URL}/benefits/kpis`, { headers: getHeaders() }),
        fetch(`${API_URL}/benefits/kpis/${kpiId}/time-series`, { headers: getHeaders() }),
        fetch(`${API_URL}/benefits/kpis/${kpiId}/deviation-cases?openOnly=1`, { headers: getHeaders() }),
      ]);

      if (kpiRes.ok) {
        const json = await kpiRes.json();
        const all = json?.data || json || [];
        const found = (all || []).find((k: any) => k.id === kpiId);
        if (found) setKpi(found);
      }
      if (tsRes.ok) {
        const json = await tsRes.json();
        const ts = json?.data || json || [];
        setMeasurements(
          (ts || []).sort(
            (a: KPIMeasurement, b: KPIMeasurement) =>
              new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
          )
        );
      }

      if (casesRes.ok) {
        const json = await casesRes.json();
        const list = json?.data || [];
        const first = Array.isArray(list) && list.length > 0 ? (list[0] as DeviationCase) : null;
        setOpenCase(first);
        setRcaDraft(first?.rcaText || '');
      } else {
        setOpenCase(null);
        setRcaDraft('');
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [kpiId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRecord = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newValue) return;
      setSubmitting(true);
      try {
        await Api.post(`/benefits/kpis/${kpiId}/time-series`, {
          value: Number(newValue),
          periodStart: String(newDate).slice(0, 10),
          notes: newNotes.trim() || undefined,
        });
        setNewValue('');
        setNewNotes('');
        fetchData();
        onValueRecorded?.();
      } catch {
        // silent
      } finally {
        setSubmitting(false);
      }
    },
    [kpiId, newValue, newDate, newNotes, fetchData, onValueRecorded]
  );

  const quickStats: QuickStat[] = useMemo(() => {
    if (!kpi) return [];
    const gap =
      kpi.targetValue != null && kpi.latestValue != null ? kpi.targetValue - kpi.latestValue : null;
    return [
      {
        label: t('results.drawer.baseline', 'Baseline'),
        value:
          (kpi as any).baselineValue != null
            ? `${(kpi as any).baselineValue}${kpi.unit ? ' ' + kpi.unit : ''}`
            : '—',
      },
      {
        label: t('results.columns.target', 'Target'),
        value:
          kpi.targetValue != null ? `${kpi.targetValue}${kpi.unit ? ' ' + kpi.unit : ''}` : '—',
      },
      {
        label: t('results.columns.current', 'Current'),
        value:
          kpi.latestValue != null ? `${kpi.latestValue}${kpi.unit ? ' ' + kpi.unit : ''}` : '—',
        color: kpi.isOnTarget ? 'text-emerald-400' : 'text-red-400',
      },
      {
        label: t('results.drawer.gap', 'Gap'),
        value: gap != null ? `${gap > 0 ? '+' : ''}${gap}${kpi.unit ? ' ' + kpi.unit : ''}` : '—',
        color: gap != null ? (gap <= 0 ? 'text-emerald-400' : 'text-red-400') : undefined,
      },
    ];
  }, [kpi, t]);

  const maxVal = useMemo(() => {
    if (measurements.length === 0) return 100;
    return Math.max(...measurements.map((m) => m.value), kpi?.targetValue || 0) * 1.2 || 100;
  }, [measurements, kpi]);

  const chartBars = useMemo(() => {
    return [...measurements].reverse().slice(-12);
  }, [measurements]);

  const inputCls =
    'w-full h-9 px-3 text-sm rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-500 transition-colors';

  const caseBadgeCls =
    openCase?.severity === 'RED'
      ? 'bg-red-500/10 text-red-400 border-red-500/30'
      : openCase?.severity === 'AMBER'
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
        : 'bg-slate-500/10 text-slate-400 border-slate-500/30';

  const handleAcknowledge = useCallback(async () => {
    if (!openCase?.id) return;
    setCaseBusy(true);
    try {
      await Api.post(`/benefits/deviation-cases/${openCase.id}/acknowledge`, {});
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, fetchData]);

  const handleSaveRca = useCallback(async () => {
    if (!openCase?.id) return;
    setCaseBusy(true);
    try {
      await Api.put(`/benefits/deviation-cases/${openCase.id}/rca`, { rcaText: rcaDraft });
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, rcaDraft, fetchData]);

  const handleAddAction = useCallback(async () => {
    if (!openCase?.id || !newActionTitle.trim()) return;
    setCaseBusy(true);
    try {
      await Api.post(`/benefits/deviation-cases/${openCase.id}/actions`, {
        title: newActionTitle.trim(),
        dueDate: newActionDue ? String(newActionDue).slice(0, 10) : undefined,
      });
      setNewActionTitle('');
      setNewActionDue('');
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, newActionTitle, newActionDue, fetchData]);

  const handleResolve = useCallback(async () => {
    if (!openCase?.id) return;
    setCaseBusy(true);
    try {
      await Api.post(`/benefits/deviation-cases/${openCase.id}/resolve`, {});
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, fetchData]);

  const handleClose = useCallback(async () => {
    if (!openCase?.id) return;
    setCaseBusy(true);
    try {
      await Api.post(`/benefits/deviation-cases/${openCase.id}/close`, {});
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, fetchData]);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-navy-950/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-navy-900 border-l border-slate-200 dark:border-navy-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-navy-700 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-primary-500/10">
              <TrendingUp size={18} className="text-primary-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {kpi?.name || t('common.loading', 'Loading...')}
              </h2>
              {kpi && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                      kpi.isOnTarget
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : kpi.latestValue != null
                          ? 'bg-red-500/10 text-red-400'
                          : 'bg-slate-500/10 text-slate-400'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        kpi.isOnTarget
                          ? 'bg-emerald-500'
                          : kpi.latestValue != null
                            ? 'bg-red-500'
                            : 'bg-slate-400'
                      }`}
                    />
                    {kpi.isOnTarget ? 'On Target' : kpi.latestValue != null ? 'Below' : 'No Data'}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-700 text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <Target size={20} className="animate-pulse mr-2" />
              {t('common.loading', 'Loading...')}
            </div>
          ) : (
            <div className="p-5 space-y-6">
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-2">
                {quickStats.map((s) => (
                  <div
                    key={s.label}
                    className="p-2.5 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
                  >
                    <p className="text-[10px] uppercase text-slate-500 mb-1">{s.label}</p>
                    <p
                      className={`text-sm font-semibold ${s.color || 'text-slate-900 dark:text-white'}`}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              {/* Deviation case (R1) */}
              {openCase ? (
                <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('results.deviation.title', 'Deviation case')}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${caseBadgeCls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${openCase.severity === 'RED' ? 'bg-red-500' : 'bg-amber-500'}`} />
                      {openCase.severity} · {openCase.status}
                    </span>
                  </div>

                  {openCase.deviationSummary ? (
                    <div className="text-sm text-slate-700 dark:text-slate-200">{openCase.deviationSummary}</div>
                  ) : null}

                  <div className="flex items-center gap-2 flex-wrap">
                    {openCase.status === 'OPEN' ? (
                      <button
                        type="button"
                        disabled={caseBusy}
                        onClick={() => void handleAcknowledge()}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-60"
                      >
                        {t('results.deviation.ack', 'Acknowledge')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={caseBusy}
                      onClick={() => void handleResolve()}
                      className="h-8 px-3 rounded-full text-xs font-medium border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 transition-colors disabled:opacity-60"
                    >
                      {t('results.deviation.resolve', 'Resolve')}
                    </button>
                    <button
                      type="button"
                      disabled={caseBusy}
                      onClick={() => void handleClose()}
                      className="h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-500 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-60"
                    >
                      {t('results.deviation.close', 'Close')}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('results.deviation.rca', 'Root cause analysis')}
                    </div>
                    <textarea
                      className={`w-full min-h-[90px] px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white/70 dark:bg-navy-900/40 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30`}
                      value={rcaDraft}
                      onChange={(e) => setRcaDraft(e.target.value)}
                      placeholder={t('results.deviation.rcaPlaceholder', 'Explain the root cause...')}
                    />
                    <button
                      type="button"
                      disabled={caseBusy}
                      onClick={() => void handleSaveRca()}
                      className="h-8 px-3 rounded-full text-xs font-medium border border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-300 hover:bg-primary-500/15 transition-colors disabled:opacity-60"
                    >
                      {t('common.save', 'Save')}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('results.deviation.actions', 'Action plan')}
                    </div>
                    {(openCase.actions || []).length > 0 ? (
                      <div className="space-y-1">
                        {(openCase.actions || []).map((a) => (
                          <div key={a.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="text-slate-700 dark:text-slate-200 truncate">{a.title}</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                              {a.status}
                              {a.dueDate ? ` · ${a.dueDate}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-500 dark:text-slate-400">
                        {t('results.deviation.noActions', 'No actions yet')}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        className={inputCls}
                        value={newActionTitle}
                        onChange={(e) => setNewActionTitle(e.target.value)}
                        placeholder={t('results.deviation.actionPlaceholder', 'New action')}
                      />
                      <input
                        className={inputCls}
                        type="date"
                        value={newActionDue}
                        onChange={(e) => setNewActionDue(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={caseBusy || !newActionTitle.trim()}
                      onClick={() => void handleAddAction()}
                      className="h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-60"
                    >
                      {t('results.deviation.addAction', 'Add action')}
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Simple bar chart */}
              <div>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-3">
                  {t('results.drawer.chartTitle', 'Value Over Time')}
                </h3>
                {chartBars.length > 0 ? (
                  <div className="relative h-32 flex items-end gap-1">
                    {kpi?.targetValue != null && (
                      <div
                        className="absolute left-0 right-0 border-t border-dashed border-primary-500/40"
                        style={{ bottom: `${(kpi.targetValue / maxVal) * 100}%` }}
                      >
                        <span className="absolute -top-3 right-0 text-[10px] text-primary-400">
                          {t('results.columns.target', 'Target')}
                        </span>
                      </div>
                    )}
                    {chartBars.map((m) => {
                      const pct = (m.value / maxVal) * 100;
                      const isAboveTarget = kpi?.targetValue != null && m.value >= kpi.targetValue;
                      return (
                        <div
                          key={m.id}
                          className="flex-1 min-w-[12px] group/bar relative"
                          title={`${new Date(m.measuredAt).toLocaleDateString()}: ${m.value}`}
                        >
                          <div
                            className={`w-full rounded-t transition-all ${
                              isAboveTarget ? 'bg-emerald-500/60' : 'bg-red-500/40'
                            } group-hover/bar:opacity-80`}
                            style={{ height: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-sm text-slate-500 bg-slate-50 dark:bg-navy-800 rounded-lg border border-slate-200 dark:border-navy-700">
                    {t('results.drawer.noMeasurements', 'No measurements yet')}
                  </div>
                )}
              </div>

              {/* Record new value */}
              <div>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-3">
                  {t('results.drawer.recordTitle', 'Record New Value')}
                </h3>
                <form onSubmit={handleRecord} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <input
                        className={inputCls}
                        type="number"
                        step="any"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        placeholder={t('results.drawer.valuePlaceholder', 'Value')}
                        required
                      />
                    </div>
                    <div>
                      <input
                        className={inputCls}
                        type="date"
                        value={newDate}
                        onChange={(e) => setNewDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <input
                    className={inputCls}
                    value={newNotes}
                    onChange={(e) => setNewNotes(e.target.value)}
                    placeholder={t('results.drawer.notesPlaceholder', 'Notes (optional)')}
                  />
                  <button
                    type="submit"
                    disabled={!newValue || submitting}
                    className="w-full h-9 text-sm font-medium rounded-full bg-primary-500 text-white hover:bg-primary-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {submitting
                      ? t('common.saving', 'Saving...')
                      : t('results.drawer.record', 'Record')}
                  </button>
                </form>
              </div>

              {/* History table */}
              <div>
                <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase mb-3">
                  {t('results.drawer.history', 'History')}
                  {measurements.length > 0 && (
                    <span className="ml-1 text-slate-600">({measurements.length})</span>
                  )}
                </h3>
                {measurements.length > 0 ? (
                  <div className="border border-slate-200 dark:border-navy-700 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 dark:bg-navy-800">
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            {t('results.drawer.historyDate', 'Date')}
                          </th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-slate-500 uppercase">
                            {t('results.drawer.historyValue', 'Value')}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            {t('results.drawer.historyNotes', 'Notes')}
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase">
                            {t('results.drawer.historyBy', 'By')}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-navy-700/50">
                        {measurements.map((m) => (
                          <tr key={m.id} className="hover:bg-white/5 transition-colors">
                            <td className="px-3 py-2 text-slate-400">
                              <div className="flex items-center gap-1.5">
                                <Calendar size={12} className="text-slate-500" />
                                {new Date(m.measuredAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-right font-medium text-slate-300">
                              {m.value.toLocaleString()}
                              {kpi?.unit && (
                                <span className="ml-0.5 text-xs text-slate-500">{kpi.unit}</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-slate-500 truncate max-w-[120px]">
                              {m.notes || '—'}
                            </td>
                            <td className="px-3 py-2 text-slate-500 text-xs">
                              {m.createdBy
                                ? `${m.createdBy.firstName} ${m.createdBy.lastName}`
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 text-center py-6">
                    {t('results.drawer.noMeasurements', 'No measurements yet')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default KPITimeSeriesDrawer;
