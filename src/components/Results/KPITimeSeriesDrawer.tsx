import { Calendar, Link2, Pencil, Target, Trash2, TrendingUp, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';
import { V8ResultsApi, shouldFallbackToLegacyResults } from '@/services/api/v8/results';
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
  evidenceText?: string | null;
  evidenceRef?: string | null;
  resolutionNotes?: string | null;
  actions?: DeviationAction[];
};

type InitiativeOption = { id: string; name: string };

type KpiMappingRow = {
  id: string;
  initiative_id: string;
  initiative_name?: string | null;
  kpi_id: string;
  kpi_name?: string | null;
  impact_direction?: string | null;
};

const measurementDate = (measurement: KPIMeasurement): string =>
  String(measurement.periodStart || measurement.measuredAt || '');

const measurementLabel = (measurement: KPIMeasurement): string =>
  measurement.periodKey || measurementDate(measurement);

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
  const [closeEvidenceText, setCloseEvidenceText] = useState('');
  const [closeEvidenceRef, setCloseEvidenceRef] = useState('');
  const [closeResolutionNotes, setCloseResolutionNotes] = useState('');

  const [newValue, setNewValue] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [settingsName, setSettingsName] = useState('');
  const [settingsDescription, setSettingsDescription] = useState('');
  const [settingsUnit, setSettingsUnit] = useState('');
  const [settingsBaseline, setSettingsBaseline] = useState('');
  const [settingsTarget, setSettingsTarget] = useState('');
  const [settingsFrequency, setSettingsFrequency] = useState<
    'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY'
  >('MONTHLY');
  const [settingsDirection, setSettingsDirection] = useState<'increase' | 'decrease'>('increase');
  const [settingsThresholdMode, setSettingsThresholdMode] = useState<
    'ABSOLUTE' | 'PERCENT_FROM_TARGET'
  >('PERCENT_FROM_TARGET');
  const [settingsAmberThreshold, setSettingsAmberThreshold] = useState('');
  const [settingsRedThreshold, setSettingsRedThreshold] = useState('');

  const [initiatives, setInitiatives] = useState<InitiativeOption[]>([]);
  const [initiativeSearch, setInitiativeSearch] = useState('');
  const [mappings, setMappings] = useState<KpiMappingRow[]>([]);
  const [mappingBusy, setMappingBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res: any = await Api.get('/initiatives');
        const data = (res?.data ?? res) as any;
        setInitiatives((data || []).map((i: any) => ({ id: i.id, name: i.name || i.title })));
      } catch {
        // silent
      }
    })();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [catalogRes, drawerRes] = await Promise.allSettled([
        V8ResultsApi.getKpiCatalog({ kpiId }),
        V8ResultsApi.getKpiDrawerDetail(kpiId),
      ]);

      let catalogKpis: any[] = [];
      let catalogMappings: any[] = [];
      let drawerMeasurements: any[] = [];
      let drawerOpenCase: any = null;
      if (catalogRes.status === 'fulfilled') {
        catalogKpis = Array.isArray(catalogRes.value?.kpis) ? catalogRes.value.kpis : [];
        catalogMappings = Array.isArray(catalogRes.value?.mappings) ? catalogRes.value.mappings : [];
      } else if (!shouldFallbackToLegacyResults(catalogRes.reason)) {
        throw catalogRes.reason;
      }

      if (drawerRes.status === 'fulfilled') {
        drawerMeasurements = Array.isArray(drawerRes.value?.measurements) ? drawerRes.value.measurements : [];
        drawerOpenCase = drawerRes.value?.openCase ?? null;
      } else if (!shouldFallbackToLegacyResults(drawerRes.reason)) {
        throw drawerRes.reason;
      }

      if (
        (catalogRes.status !== 'fulfilled' && shouldFallbackToLegacyResults(catalogRes.reason)) ||
        (drawerRes.status !== 'fulfilled' && shouldFallbackToLegacyResults(drawerRes.reason))
      ) {
        const [kpisRes, mappingsRes, tsRes, casesRes] = await Promise.allSettled([
          Api.get('/benefits/kpis'),
          Api.get(`/benefits/kpi-mappings?kpiId=${encodeURIComponent(kpiId)}`),
          Api.get(`/benefits/kpis/${kpiId}/time-series`),
          Api.get(`/benefits/kpis/${kpiId}/deviation-cases?openOnly=1`),
        ]);
        if (catalogRes.status !== 'fulfilled' && kpisRes.status === 'fulfilled') {
          const payload: any = kpisRes.value as any;
          catalogKpis = payload?.data ?? payload ?? [];
        }
        if (catalogRes.status !== 'fulfilled' && mappingsRes.status === 'fulfilled') {
          const payload: any = mappingsRes.value as any;
          catalogMappings = payload?.data ?? payload ?? [];
        }
        if (drawerRes.status !== 'fulfilled' && tsRes.status === 'fulfilled') {
          const payload: any = tsRes.value as any;
          drawerMeasurements = payload?.data ?? payload ?? [];
        }
        if (drawerRes.status !== 'fulfilled' && casesRes.status === 'fulfilled') {
          const payload: any = casesRes.value as any;
          const list = payload?.data ?? payload ?? [];
          drawerOpenCase = Array.isArray(list) && list.length > 0 ? list[0] : null;
        }
      }

      const found = (catalogKpis || []).find((k: any) => String(k?.id) === String(kpiId));
      if (found) setKpi(found);
      else setKpi(null);

      setMeasurements(
        (drawerMeasurements || []).sort(
          (a: KPIMeasurement, b: KPIMeasurement) =>
            new Date(measurementDate(b)).getTime() - new Date(measurementDate(a)).getTime()
        )
      );

      if (drawerOpenCase) {
        const first = drawerOpenCase as DeviationCase;
        setOpenCase(first);
        setRcaDraft(first?.rcaText || '');
        setCloseEvidenceText(first?.evidenceText || '');
        setCloseEvidenceRef(first?.evidenceRef || '');
        setCloseResolutionNotes(first?.resolutionNotes || '');
      } else {
        setOpenCase(null);
        setRcaDraft('');
        setCloseEvidenceText('');
        setCloseEvidenceRef('');
        setCloseResolutionNotes('');
      }

      setMappings((catalogMappings || []) as KpiMappingRow[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [kpiId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!kpi) return;
    if (editMode) return;
    setSettingsName(String((kpi as any)?.name || ''));
    setSettingsDescription(String((kpi as any)?.description || ''));
    setSettingsUnit(String((kpi as any)?.unit || ''));
    setSettingsBaseline(
      (kpi as any)?.baselineValue != null && (kpi as any)?.baselineValue !== ''
        ? String((kpi as any).baselineValue)
        : ''
    );
    setSettingsTarget(
      (kpi as any)?.targetValue != null && (kpi as any)?.targetValue !== ''
        ? String((kpi as any).targetValue)
        : ''
    );
    setSettingsFrequency(((kpi as any)?.measurementFrequency || 'MONTHLY') as any);
    setSettingsDirection((kpi as any)?.direction === 'LOWER_IS_BETTER' ? 'decrease' : 'increase');
    setSettingsThresholdMode(((kpi as any)?.thresholdMode || 'PERCENT_FROM_TARGET') as any);
    setSettingsAmberThreshold(
      (kpi as any)?.thresholdMode === 'ABSOLUTE'
        ? (kpi as any)?.amberThresholdAbs != null
          ? String((kpi as any).amberThresholdAbs)
          : ''
        : (kpi as any)?.amberThresholdPct != null
          ? String((kpi as any).amberThresholdPct)
          : ''
    );
    setSettingsRedThreshold(
      (kpi as any)?.thresholdMode === 'ABSOLUTE'
        ? (kpi as any)?.redThresholdAbs != null
          ? String((kpi as any).redThresholdAbs)
          : ''
        : (kpi as any)?.redThresholdPct != null
          ? String((kpi as any).redThresholdPct)
          : ''
    );
  }, [kpi, editMode]);

  const handleRecord = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newValue) return;
      setSubmitting(true);
      try {
        const payload = {
          value: Number(newValue),
          periodStart: String(newDate).slice(0, 10),
          notes: newNotes.trim() || undefined,
        };
        try {
          await V8ResultsApi.createKpiTimeSeriesValue(kpiId, payload);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          await Api.post(`/benefits/kpis/${kpiId}/time-series`, payload);
        }
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

  const handleSaveSettings = useCallback(async () => {
    if (!settingsName.trim()) return;
    setSavingSettings(true);
    try {
      const kpiDirection =
        settingsDirection === 'decrease' ? 'LOWER_IS_BETTER' : 'HIGHER_IS_BETTER';
      const payload = {
        name: settingsName.trim(),
        description: settingsDescription.trim() || undefined,
        unit: settingsUnit.trim() || undefined,
        baselineValue: settingsBaseline !== '' ? Number(settingsBaseline) : null,
        targetValue: settingsTarget !== '' ? Number(settingsTarget) : null,
        measurementFrequency: settingsFrequency,
        direction: kpiDirection,
        thresholdMode: settingsThresholdMode,
        amberThresholdPct:
          settingsThresholdMode === 'PERCENT_FROM_TARGET' && settingsAmberThreshold !== ''
            ? Number(settingsAmberThreshold)
            : null,
        redThresholdPct:
          settingsThresholdMode === 'PERCENT_FROM_TARGET' && settingsRedThreshold !== ''
            ? Number(settingsRedThreshold)
            : null,
        amberThresholdAbs:
          settingsThresholdMode === 'ABSOLUTE' && settingsAmberThreshold !== ''
            ? Number(settingsAmberThreshold)
            : null,
        redThresholdAbs:
          settingsThresholdMode === 'ABSOLUTE' && settingsRedThreshold !== ''
            ? Number(settingsRedThreshold)
            : null,
      };
      try {
        await V8ResultsApi.updateKpi(kpiId, payload);
      } catch (error) {
        if (!shouldFallbackToLegacyResults(error)) {
          throw error;
        }
        await Api.put(`/benefits/kpis/${kpiId}`, payload);
      }
      setEditMode(false);
      fetchData();
      onValueRecorded?.();
    } catch {
      // silent
    } finally {
      setSavingSettings(false);
    }
  }, [
    fetchData,
    kpiId,
    onValueRecorded,
    settingsBaseline,
    settingsAmberThreshold,
    settingsDescription,
    settingsDirection,
    settingsFrequency,
    settingsName,
    settingsRedThreshold,
    settingsTarget,
    settingsThresholdMode,
    settingsUnit,
  ]);

  const handleDeleteKpi = useCallback(async () => {
    if (!kpiId) return;
    const ok = window.confirm(
      t(
        'results.drawer.deleteConfirm',
        'Delete this KPI? This will remove its measurements, mappings, and deviation cases.'
      )
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await Api.delete(`/benefits/kpis/${kpiId}`);
      onValueRecorded?.();
      onClose();
    } catch {
      // silent
    } finally {
      setDeleting(false);
    }
  }, [kpiId, onClose, onValueRecorded, t]);

  const handleLinkInitiative = useCallback(
    async (initiativeId: string) => {
      if (!initiativeId) return;
      setMappingBusy(true);
      try {
        const payload = {
          initiativeId,
          kpiId,
          impactWeight: 1.0,
          impactDirection: settingsDirection === 'decrease' ? 'decrease' : 'increase',
          confidence: 'medium',
        };
        try {
          await V8ResultsApi.createKpiMapping(payload);
        } catch (error) {
          if (!shouldFallbackToLegacyResults(error)) {
            throw error;
          }
          await Api.post('/benefits/kpi-mappings', payload);
        }
        setInitiativeSearch('');
        fetchData();
        onValueRecorded?.();
      } catch {
        // silent
      } finally {
        setMappingBusy(false);
      }
    },
    [fetchData, kpiId, onValueRecorded, settingsDirection]
  );

  const handleUnlinkMapping = useCallback(
    async (mappingId: string) => {
      if (!mappingId) return;
      setMappingBusy(true);
      try {
        await Api.delete(`/benefits/kpi-mappings/${mappingId}`);
        fetchData();
        onValueRecorded?.();
      } catch {
        // silent
      } finally {
        setMappingBusy(false);
      }
    },
    [fetchData, onValueRecorded]
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

  const handleUpdateActionStatus = useCallback(
    async (action: DeviationAction, status: DeviationAction['status']) => {
      if (!openCase?.id) return;
      setCaseBusy(true);
      try {
        await Api.put(`/benefits/deviation-cases/${openCase.id}/actions/${action.id}`, { status });
        fetchData();
      } finally {
        setCaseBusy(false);
      }
    },
    [openCase?.id, fetchData]
  );

  const handleClose = useCallback(async () => {
    if (!openCase?.id) return;
    if (!closeEvidenceText.trim() && !closeEvidenceRef.trim()) return;
    setCaseBusy(true);
    try {
      await Api.post(`/benefits/deviation-cases/${openCase.id}/close`, {
        evidenceText: closeEvidenceText.trim() || undefined,
        evidenceRef: closeEvidenceRef.trim() || undefined,
        resolutionNotes: closeResolutionNotes.trim() || undefined,
      });
      fetchData();
    } finally {
      setCaseBusy(false);
    }
  }, [openCase?.id, closeEvidenceRef, closeEvidenceText, closeResolutionNotes, fetchData]);

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
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${caseBadgeCls}`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${openCase.severity === 'RED' ? 'bg-red-500' : 'bg-amber-500'}`}
                      />
                      {openCase.severity} · {openCase.status}
                    </span>
                  </div>

                  {openCase.deviationSummary ? (
                    <div className="text-sm text-slate-700 dark:text-slate-200">
                      {openCase.deviationSummary}
                    </div>
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
                      disabled={
                        caseBusy || (!closeEvidenceText.trim() && !closeEvidenceRef.trim())
                      }
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
                      placeholder={t(
                        'results.deviation.rcaPlaceholder',
                        'Explain the root cause...'
                      )}
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
                          <div
                            key={a.id}
                            className="flex items-center justify-between gap-2 text-sm"
                          >
                            <button
                              type="button"
                              disabled={caseBusy}
                              onClick={() =>
                                void handleUpdateActionStatus(
                                  a,
                                  a.status === 'DONE' ? 'OPEN' : 'DONE'
                                )
                              }
                              className="flex min-w-0 items-center gap-2 text-left"
                            >
                              <span
                                className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border text-[10px] ${
                                  a.status === 'DONE'
                                    ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300'
                                    : 'border-slate-300 dark:border-navy-600 text-slate-400'
                                }`}
                              >
                                {a.status === 'DONE' ? '✓' : ''}
                              </span>
                              <span
                                className={`truncate ${
                                  a.status === 'DONE'
                                    ? 'text-slate-500 line-through dark:text-slate-400'
                                    : 'text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                {a.title}
                              </span>
                            </button>
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

                  <div className="space-y-2 rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30 p-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {t('results.deviation.closeEvidence', 'Closure evidence')}
                    </div>
                    <textarea
                      className={`${inputCls} min-h-[88px] resize-none py-2`}
                      value={closeEvidenceText}
                      onChange={(e) => setCloseEvidenceText(e.target.value)}
                      placeholder={t(
                        'results.deviation.closeEvidenceText',
                        'Describe the evidence that confirms the deviation is closed.'
                      )}
                    />
                    <input
                      className={inputCls}
                      value={closeEvidenceRef}
                      onChange={(e) => setCloseEvidenceRef(e.target.value)}
                      placeholder={t(
                        'results.deviation.closeEvidenceRef',
                        'Link to task, report, attachment, or external proof (optional)'
                      )}
                    />
                    <textarea
                      className={`${inputCls} min-h-[72px] resize-none py-2`}
                      value={closeResolutionNotes}
                      onChange={(e) => setCloseResolutionNotes(e.target.value)}
                      placeholder={t(
                        'results.deviation.closeResolutionNotes',
                        'Resolution notes for audit trail (optional)'
                      )}
                    />
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {t(
                        'results.deviation.closeEvidenceHint',
                        'At least one evidence field is required to close the case.'
                      )}
                    </div>
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
                          title={`${measurementLabel(m)}: ${m.value}`}
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
                                {measurementDate(m)
                                  ? new Date(measurementDate(m)).toLocaleDateString()
                                  : '—'}
                                {m.periodKey && m.periodKey !== measurementDate(m) ? (
                                  <span className="ml-2 text-[10px] uppercase tracking-wide text-slate-500">
                                    {m.periodKey}
                                  </span>
                                ) : null}
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

              {/* Settings */}
              <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('results.drawer.settingsTitle', 'Settings')}
                  </div>
                  {!editMode ? (
                    <button
                      type="button"
                      onClick={() => setEditMode(true)}
                      className="h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.04] text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors"
                    >
                      <span className="inline-flex items-center gap-2">
                        <Pencil size={14} />
                        {t('common.edit', 'Edit')}
                      </span>
                    </button>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t('results.createModal.name', 'Name')} *
                    </div>
                    <input
                      className={inputCls}
                      value={settingsName}
                      onChange={(e) => setSettingsName(e.target.value)}
                      disabled={!editMode}
                    />
                  </div>

                  <div>
                    <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                      {t('results.createModal.description', 'Description')}
                    </div>
                    <textarea
                      className={`${inputCls} h-20 resize-none py-2`}
                      value={settingsDescription}
                      onChange={(e) => setSettingsDescription(e.target.value)}
                      disabled={!editMode}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t('results.createModal.unit', 'Unit')}
                      </div>
                      <input
                        className={inputCls}
                        value={settingsUnit}
                        onChange={(e) => setSettingsUnit(e.target.value)}
                        disabled={!editMode}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t('results.columns.baseline', 'Baseline')}
                      </div>
                      <input
                        className={inputCls}
                        type="number"
                        value={settingsBaseline}
                        onChange={(e) => setSettingsBaseline(e.target.value)}
                        disabled={!editMode}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t('results.columns.target', 'Target')}
                      </div>
                      <input
                        className={inputCls}
                        type="number"
                        value={settingsTarget}
                        onChange={(e) => setSettingsTarget(e.target.value)}
                        disabled={!editMode}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t('results.createModal.frequency', 'Frequency')}
                      </div>
                      <select
                        className={`${inputCls} appearance-none`}
                        value={settingsFrequency}
                        onChange={(e) => setSettingsFrequency(e.target.value as any)}
                        disabled={!editMode}
                      >
                        <option value="DAILY">Daily</option>
                        <option value="WEEKLY">Weekly</option>
                        <option value="MONTHLY">Monthly</option>
                        <option value="QUARTERLY">Quarterly</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t('results.createModal.direction', 'Direction')}
                      </div>
                      <select
                        className={`${inputCls} appearance-none`}
                        value={settingsDirection}
                        onChange={(e) => setSettingsDirection(e.target.value as any)}
                        disabled={!editMode}
                      >
                        <option value="increase">
                          {t('results.direction.increase', 'Increase')}
                        </option>
                        <option value="decrease">
                          {t('results.direction.decrease', 'Decrease')}
                        </option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t('results.drawer.thresholdMode', 'Threshold mode')}
                      </div>
                      <select
                        className={`${inputCls} appearance-none`}
                        value={settingsThresholdMode}
                        onChange={(e) => setSettingsThresholdMode(e.target.value as any)}
                        disabled={!editMode}
                      >
                        <option value="PERCENT_FROM_TARGET">
                          {t('results.drawer.thresholdPercent', 'Percent from target')}
                        </option>
                        <option value="ABSOLUTE">
                          {t('results.drawer.thresholdAbsolute', 'Absolute gap')}
                        </option>
                      </select>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t('results.drawer.amberThreshold', 'Amber threshold')}
                      </div>
                      <input
                        className={inputCls}
                        type="number"
                        step="any"
                        value={settingsAmberThreshold}
                        onChange={(e) => setSettingsAmberThreshold(e.target.value)}
                        disabled={!editMode}
                      />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                        {t('results.drawer.redThreshold', 'Red threshold')}
                      </div>
                      <input
                        className={inputCls}
                        type="number"
                        step="any"
                        value={settingsRedThreshold}
                        onChange={(e) => setSettingsRedThreshold(e.target.value)}
                        disabled={!editMode}
                      />
                    </div>
                  </div>

                  {editMode ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={savingSettings || !settingsName.trim()}
                        onClick={() => void handleSaveSettings()}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-primary-500/30 bg-primary-500/10 text-primary-700 dark:text-primary-300 hover:bg-primary-500/15 transition-colors disabled:opacity-60"
                      >
                        {savingSettings
                          ? t('common.saving', 'Saving...')
                          : t('common.save', 'Save')}
                      </button>
                      <button
                        type="button"
                        disabled={savingSettings}
                        onClick={() => {
                          setEditMode(false);
                          setSettingsName(String((kpi as any)?.name || ''));
                          setSettingsDescription(String((kpi as any)?.description || ''));
                          setSettingsUnit(String((kpi as any)?.unit || ''));
                          setSettingsBaseline(
                            (kpi as any)?.baselineValue != null
                              ? String((kpi as any).baselineValue)
                              : ''
                          );
                          setSettingsTarget(
                            (kpi as any)?.targetValue != null
                              ? String((kpi as any).targetValue)
                              : ''
                          );
                          setSettingsFrequency(
                            ((kpi as any)?.measurementFrequency || 'MONTHLY') as any
                          );
                          setSettingsDirection(
                            (kpi as any)?.direction === 'LOWER_IS_BETTER' ? 'decrease' : 'increase'
                          );
                          setSettingsThresholdMode(
                            ((kpi as any)?.thresholdMode || 'PERCENT_FROM_TARGET') as any
                          );
                          setSettingsAmberThreshold(
                            (kpi as any)?.thresholdMode === 'ABSOLUTE'
                              ? (kpi as any)?.amberThresholdAbs != null
                                ? String((kpi as any).amberThresholdAbs)
                                : ''
                              : (kpi as any)?.amberThresholdPct != null
                                ? String((kpi as any).amberThresholdPct)
                                : ''
                          );
                          setSettingsRedThreshold(
                            (kpi as any)?.thresholdMode === 'ABSOLUTE'
                              ? (kpi as any)?.redThresholdAbs != null
                                ? String((kpi as any).redThresholdAbs)
                                : ''
                              : (kpi as any)?.redThresholdPct != null
                                ? String((kpi as any).redThresholdPct)
                                : ''
                          );
                        }}
                        className="h-8 px-3 rounded-full text-xs font-medium border border-slate-200/70 dark:border-white/[0.08] bg-transparent text-slate-500 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-60"
                      >
                        {t('common.cancel', 'Cancel')}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Links */}
              <div className="rounded-lg border border-slate-200 dark:border-navy-700 bg-slate-50 dark:bg-navy-800 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {t('results.drawer.linksTitle', 'Linked initiatives')}
                  </div>
                  <Link2 size={16} className="text-slate-400" />
                </div>

                {(mappings || []).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {mappings.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/70 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.08] text-xs text-slate-700 dark:text-slate-200"
                      >
                        <span className="truncate max-w-[220px]">
                          {m.initiative_name || t('common.unknown', 'Unknown')}
                        </span>
                        <button
                          type="button"
                          disabled={mappingBusy}
                          onClick={() => void handleUnlinkMapping(m.id)}
                          className="text-slate-400 hover:text-red-400 transition-colors disabled:opacity-60"
                          title={t('common.remove', 'Remove')}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    {t('results.drawer.noLinks', 'No linked initiatives')}
                  </div>
                )}

                <div className="space-y-2">
                  <input
                    className={inputCls}
                    value={initiativeSearch}
                    onChange={(e) => setInitiativeSearch(e.target.value)}
                    placeholder={t('results.drawer.linkSearch', 'Search initiatives to link...')}
                    disabled={mappingBusy}
                  />
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200 dark:border-navy-700 bg-white/60 dark:bg-navy-900/30">
                    {initiatives
                      .filter((i) => {
                        if (!initiativeSearch.trim()) return true;
                        return i.name.toLowerCase().includes(initiativeSearch.toLowerCase());
                      })
                      .filter(
                        (i) => !mappings.some((m) => String(m.initiative_id) === String(i.id))
                      )
                      .slice(0, 25)
                      .map((i) => (
                        <button
                          key={i.id}
                          type="button"
                          disabled={mappingBusy}
                          onClick={() => void handleLinkInitiative(i.id)}
                          className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.04] transition-colors disabled:opacity-60"
                        >
                          {i.name}
                        </button>
                      ))}
                    {initiatives.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-slate-500 dark:text-slate-400">
                        {t('common.loading', 'Loading...')}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Danger zone */}
              <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleDeleteKpi()}
                  className="w-full h-9 text-sm font-medium rounded-full border border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-300 hover:bg-red-500/15 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
                >
                  <Trash2 size={16} />
                  {deleting ? t('common.deleting', 'Deleting...') : t('common.delete', 'Delete')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default KPITimeSeriesDrawer;
