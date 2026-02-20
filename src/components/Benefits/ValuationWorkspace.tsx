import { CheckCircle2, Download, Loader2, Play, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { API_URL, getHeaders } from '@/services/api';
import { trackFunnelEvent } from '@/services/funnelAnalytics';

type ValuationSourceType = 'financial_model' | 'budget' | 'manual';
type TerminalMethod = 'gordon' | 'exit_multiple';
type ExitMultipleMetric = 'EV/EBITDA' | 'EV/Revenue';

interface ValuationListItem {
  id: string;
  title: string;
  status: 'DRAFT' | 'REVIEW' | 'APPROVED';
  sourceType: ValuationSourceType;
  horizonYears: number;
  currency: string;
  updatedAt?: string | null;
}

interface SourcesPayload {
  budgets: Array<{ id: string; title: string; status: string }>;
  financialModels: Array<{ id: string; name: string; status: string }>;
}

interface AssumptionsState {
  waccPercent: number;
  terminalMethod: TerminalMethod;
  terminalGrowthPercent?: number;
  exitMultiple?: number;
  exitMultipleMetric?: ExitMultipleMetric;
  netDebt?: number;
  sharesOutstanding?: number;
  manualForecast?: { years: Array<{ year: number; fcff: number }> };
}

interface MultiplesState {
  metric: ExitMultipleMetric | 'P/E';
  min: number;
  median: number;
  max: number;
  peerSet: Array<{ name: string }>;
}

function safeNumber(v: unknown, fb: number): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : fb;
}

function safeJson<T>(raw: any, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw !== 'string') return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

const DEFAULT_ASSUMPTIONS: AssumptionsState = {
  waccPercent: 12,
  terminalMethod: 'gordon',
  terminalGrowthPercent: 3,
  exitMultiple: 8,
  exitMultipleMetric: 'EV/EBITDA',
  netDebt: 0,
  manualForecast: { years: [] },
};

const DEFAULT_MULTIPLES: MultiplesState = {
  metric: 'EV/EBITDA',
  min: 6,
  median: 8,
  max: 10,
  peerSet: [],
};

export const ValuationWorkspace: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [valuations, setValuations] = useState<ValuationListItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<any | null>(null);
  const [sources, setSources] = useState<SourcesPayload>({ budgets: [], financialModels: [] });

  const [activeStep, setActiveStep] = useState<
    'source' | 'assumptions' | 'results' | 'sensitivity' | 'export'
  >('assumptions');
  const [assumptions, setAssumptions] = useState<AssumptionsState>(DEFAULT_ASSUMPTIONS);
  const [multiples, setMultiples] = useState<MultiplesState>(DEFAULT_MULTIPLES);

  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createSourceType, setCreateSourceType] = useState<ValuationSourceType>('budget');
  const [createSourceId, setCreateSourceId] = useState('');
  const [createHorizonYears, setCreateHorizonYears] = useState(5);

  const fetchSources = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/economics/valuations/sources`, { headers: getHeaders() });
      if (!res.ok) return;
      const d = (await res.json()) as any;
      setSources((d?.sources || { budgets: [], financialModels: [] }) as SourcesPayload);
    } catch {
      // ignore
    }
  }, []);

  const fetchValuations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/economics/valuations`, { headers: getHeaders() });
      if (!res.ok) return;
      const d = (await res.json()) as any;
      setValuations((d?.valuations || []) as ValuationListItem[]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchValuation = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${API_URL}/economics/valuations/${id}`, { headers: getHeaders() });
      if (!res.ok) return;
      const d = (await res.json()) as any;
      const v = d?.valuation || null;
      setSelected(v);
      if (!v) return;
      setAssumptions({ ...DEFAULT_ASSUMPTIONS, ...safeJson(v.assumptions, DEFAULT_ASSUMPTIONS) });
      setMultiples({ ...DEFAULT_MULTIPLES, ...safeJson(v.peers, DEFAULT_MULTIPLES) });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void fetchSources();
    void fetchValuations();
  }, [fetchSources, fetchValuations]);

  useEffect(() => {
    if (!selectedId) return;
    void fetchValuation(selectedId);
  }, [fetchValuation, selectedId]);

  const computed = safeJson<any>(selected?.results, {});
  const dcf = computed?.dcf;
  const advisory = safeJson<any>(selected?.advisory, null);
  const negotiationPack = safeJson<any>(selected?.negotiation_pack, null);

  const validationError = useMemo(() => {
    if (assumptions.terminalMethod === 'gordon') {
      const w = safeNumber(assumptions.waccPercent, 0);
      const g = safeNumber(assumptions.terminalGrowthPercent, 0);
      if (!(g < w))
        return t(
          'valuation.validation.gLessThanWacc',
          'Terminal growth must be lower than WACC (g < WACC)'
        );
    }
    return null;
  }, [assumptions.terminalGrowthPercent, assumptions.terminalMethod, assumptions.waccPercent, t]);

  const handleCreate = useCallback(async () => {
    if (!createTitle.trim()) return;
    if (createSourceType !== 'manual' && !createSourceId) {
      toast.error(t('valuation.create.sourceRequired', 'Select a source first'));
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/economics/valuations`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: createTitle,
          sourceType: createSourceType,
          sourceId: createSourceType === 'manual' ? null : createSourceId,
          horizonYears: createHorizonYears,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error || t('valuation.create.failed', 'Failed to create valuation'));
        return;
      }
      trackFunnelEvent('valuation_created', { valuationId: d?.id, sourceType: createSourceType });
      setShowCreate(false);
      setCreateTitle('');
      await fetchValuations();
      if (d?.id) setSelectedId(String(d.id));
    } catch {
      toast.error(t('valuation.create.failed', 'Failed to create valuation'));
    } finally {
      setBusy(false);
    }
  }, [createHorizonYears, createSourceId, createSourceType, createTitle, fetchValuations, t]);

  const handleSaveAssumptions = useCallback(async () => {
    if (!selectedId) return;
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/economics/valuations/${selectedId}/assumptions`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(assumptions),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          d?.error || t('valuation.assumptions.saveFailed', 'Failed to save assumptions')
        );
        return;
      }
      trackFunnelEvent('valuation_assumption_updated', { valuationId: selectedId });
      toast.success(t('valuation.assumptions.saved', 'Assumptions saved'));
      await fetchValuation(selectedId);
    } finally {
      setBusy(false);
    }
  }, [assumptions, fetchValuation, selectedId, t, validationError]);

  const handleSaveComps = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/economics/valuations/${selectedId}/peers`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(multiples),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error || t('valuation.comps.saveFailed', 'Failed to save comps'));
        return;
      }
      toast.success(t('valuation.comps.saved', 'Comps saved'));
    } finally {
      setBusy(false);
    }
  }, [multiples, selectedId, t]);

  const handleCompute = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/economics/valuations/${selectedId}/compute`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error || t('valuation.compute.failed', 'Compute failed'));
        return;
      }
      toast.success(t('valuation.compute.ok', 'Valuation computed'));
      await fetchValuation(selectedId);
      setActiveStep('results');
    } finally {
      setBusy(false);
    }
  }, [fetchValuation, selectedId, t]);

  const handleApprove = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/economics/valuations/${selectedId}/approve`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error || t('valuation.approve.failed', 'Approval failed'));
        return;
      }
      trackFunnelEvent('valuation_approved', { valuationId: selectedId });
      toast.success(t('valuation.approve.ok', 'Approved'));
      await fetchValuation(selectedId);
    } finally {
      setBusy(false);
    }
  }, [fetchValuation, selectedId, t]);

  const handleExportPptx = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/economics/valuations/${selectedId}/export/pptx`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: i18n.language?.toLowerCase().startsWith('pl') ? 'pl' : 'en',
          theme: 'corporate',
          confidentiality: 'confidential',
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error || t('valuation.export.failed', 'Export failed'));
        return;
      }
      trackFunnelEvent('valuation_exported', { valuationId: selectedId, format: 'pptx' });
      toast.success(t('valuation.export.ok', 'PPTX generated'));
      if (d?.downloadUrl) window.open(d.downloadUrl, '_blank');
    } finally {
      setBusy(false);
    }
  }, [i18n.language, selectedId, t]);

  const handleGenerateAdvisory = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/economics/valuations/${selectedId}/advisory`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(d?.error || t('valuation.advisory.failed', 'Failed to generate advisory'));
        return;
      }
      trackFunnelEvent('valuation_advisory_generated', { valuationId: selectedId });
      toast.success(t('valuation.advisory.ok', 'Advisory generated'));
      await fetchValuation(selectedId);
    } finally {
      setBusy(false);
    }
  }, [fetchValuation, selectedId, t]);

  const handleGenerateNegotiationPack = useCallback(async () => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}/economics/valuations/${selectedId}/negotiation-pack`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(
          d?.error || t('valuation.negotiation.failed', 'Failed to generate negotiation pack')
        );
        return;
      }
      trackFunnelEvent('valuation_negotiation_pack_generated', { valuationId: selectedId });
      toast.success(t('valuation.negotiation.ok', 'Negotiation pack generated'));
      await fetchValuation(selectedId);
    } finally {
      setBusy(false);
    }
  }, [fetchValuation, selectedId, t]);

  const handleConvertRecommendation = useCallback(
    async (recommendationId: string) => {
      if (!selectedId) return;
      setBusy(true);
      try {
        const res = await fetch(
          `${API_URL}/economics/valuations/${selectedId}/advisory/${recommendationId}/convert-to-initiative`,
          { method: 'POST', headers: getHeaders() }
        );
        const d = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(
            d?.error || t('valuation.advisory.convertFailed', 'Failed to create initiative')
          );
          return;
        }
        trackFunnelEvent('valuation_advisory_recommendation_converted', {
          valuationId: selectedId,
          initiativeId: d?.initiativeId,
        });
        toast.success(t('valuation.advisory.convertOk', 'Initiative created'));
      } finally {
        setBusy(false);
      }
    },
    [selectedId, t]
  );

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {t('valuation.title', 'Enterprise valuation')}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t('valuation.subtitle', 'DCF + comps + sensitivity, deck-ready export')}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-3 py-2 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-500 inline-flex items-center gap-2"
        >
          <Plus size={16} /> {t('valuation.create.cta', 'New valuation')}
        </button>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-4 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-navy-700 flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('valuation.list.title', 'Valuations')}
            </div>
            {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
          </div>
          <div className="max-h-[520px] overflow-auto divide-y divide-slate-100 dark:divide-navy-800">
            {valuations.length === 0 ? (
              <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
                {t('valuation.list.empty', 'No valuations yet. Create one to start.')}
              </div>
            ) : (
              valuations.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedId(v.id);
                    setActiveStep('assumptions');
                  }}
                  className={[
                    'w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-navy-800 transition',
                    selectedId === v.id ? 'bg-slate-50 dark:bg-navy-800' : '',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-white">
                        {v.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {t('valuation.list.source', 'Source')}: {v.sourceType} • {v.status}
                      </div>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="col-span-8 bg-white dark:bg-navy-900 rounded-xl border border-slate-200 dark:border-navy-700 p-5">
          {!selectedId || !selected ? (
            <div className="h-[520px] flex items-center justify-center text-sm text-slate-500 dark:text-slate-400">
              {t('valuation.detail.empty', 'Select a valuation to continue')}
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-sm font-semibold text-slate-900 dark:text-white">
                    {selected.title}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {t('valuation.detail.status', 'Status')}: {selected.status} •{' '}
                    {t('valuation.detail.currency', 'Currency')}: {selected.currency}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={busy}
                    onClick={handleCompute}
                    className="px-3 py-2 rounded-lg text-sm bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play size={16} />}
                    {t('valuation.compute.cta', 'Compute')}
                  </button>
                  <button
                    disabled={busy || selected.status === 'APPROVED'}
                    onClick={handleApprove}
                    className="px-3 py-2 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-60 inline-flex items-center gap-2"
                  >
                    <CheckCircle2 size={16} />
                    {t('valuation.approve.cta', 'Approve')}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 border-b border-slate-200 dark:border-navy-700 pb-3 mb-4">
                {(['source', 'assumptions', 'results', 'sensitivity', 'export'] as const).map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => setActiveStep(s)}
                      className={[
                        'px-3 py-1.5 rounded-lg text-sm border transition',
                        activeStep === s
                          ? 'bg-purple-600 text-white border-purple-600'
                          : 'bg-white dark:bg-navy-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-navy-700 hover:bg-slate-50 dark:hover:bg-navy-800',
                      ].join(' ')}
                    >
                      {t(`valuation.steps.${s}` as any, s)}
                    </button>
                  )
                )}
              </div>

              {activeStep === 'source' && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {t(
                    'valuation.source.note',
                    'Source is set at creation (Budget or Manual for this branch).'
                  )}
                </div>
              )}

              {activeStep === 'assumptions' && (
                <div className="space-y-4">
                  {validationError && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl p-3 text-sm">
                      {validationError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                        {t('valuation.assumptions.dcfTitle', 'DCF assumptions')}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-slate-500">
                            {t('valuation.assumptions.wacc', 'WACC (%)')}
                          </label>
                          <input
                            type="number"
                            value={assumptions.waccPercent}
                            onChange={(e) =>
                              setAssumptions((p) => ({
                                ...p,
                                waccPercent: safeNumber(e.target.value, p.waccPercent),
                              }))
                            }
                            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">
                            {t('valuation.assumptions.terminalMethod', 'Terminal method')}
                          </label>
                          <select
                            value={assumptions.terminalMethod}
                            onChange={(e) =>
                              setAssumptions((p) => ({
                                ...p,
                                terminalMethod: e.target.value as TerminalMethod,
                              }))
                            }
                            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                          >
                            <option value="gordon">Gordon growth</option>
                            <option value="exit_multiple">Exit multiple</option>
                          </select>
                        </div>
                        {assumptions.terminalMethod === 'gordon' ? (
                          <div>
                            <label className="text-xs text-slate-500">
                              {t('valuation.assumptions.g', 'Terminal growth g (%)')}
                            </label>
                            <input
                              type="number"
                              value={assumptions.terminalGrowthPercent ?? 0}
                              onChange={(e) =>
                                setAssumptions((p) => ({
                                  ...p,
                                  terminalGrowthPercent: safeNumber(
                                    e.target.value,
                                    p.terminalGrowthPercent ?? 0
                                  ),
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-slate-500">
                                {t('valuation.assumptions.exitMultiple', 'Exit multiple')}
                              </label>
                              <input
                                type="number"
                                value={assumptions.exitMultiple ?? 0}
                                onChange={(e) =>
                                  setAssumptions((p) => ({
                                    ...p,
                                    exitMultiple: safeNumber(e.target.value, p.exitMultiple ?? 0),
                                  }))
                                }
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-slate-500">
                                {t('valuation.assumptions.exitMetric', 'Metric')}
                              </label>
                              <select
                                value={assumptions.exitMultipleMetric || 'EV/EBITDA'}
                                onChange={(e) =>
                                  setAssumptions((p) => ({
                                    ...p,
                                    exitMultipleMetric: e.target.value as ExitMultipleMetric,
                                  }))
                                }
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                              >
                                <option value="EV/EBITDA">EV/EBITDA</option>
                                <option value="EV/Revenue">EV/Revenue</option>
                              </select>
                            </div>
                          </div>
                        )}
                        <button
                          disabled={busy}
                          onClick={handleSaveAssumptions}
                          className="w-full px-3 py-2 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-60"
                        >
                          {t('valuation.assumptions.save', 'Save assumptions')}
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                        {t('valuation.comps.title', 'Comparable valuation (multiples)')}
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-slate-500">
                              {t('valuation.comps.min', 'Min')}
                            </label>
                            <input
                              type="number"
                              value={multiples.min}
                              onChange={(e) =>
                                setMultiples((p) => ({
                                  ...p,
                                  min: safeNumber(e.target.value, p.min),
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">
                              {t('valuation.comps.median', 'Median')}
                            </label>
                            <input
                              type="number"
                              value={multiples.median}
                              onChange={(e) =>
                                setMultiples((p) => ({
                                  ...p,
                                  median: safeNumber(e.target.value, p.median),
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-slate-500">
                              {t('valuation.comps.max', 'Max')}
                            </label>
                            <input
                              type="number"
                              value={multiples.max}
                              onChange={(e) =>
                                setMultiples((p) => ({
                                  ...p,
                                  max: safeNumber(e.target.value, p.max),
                                }))
                              }
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-slate-500">
                            {t('valuation.comps.peers', 'Peers (comma-separated)')}
                          </label>
                          <input
                            value={multiples.peerSet.map((p) => p.name).join(', ')}
                            onChange={(e) =>
                              setMultiples((p) => ({
                                ...p,
                                peerSet: e.target.value
                                  .split(',')
                                  .map((x) => x.trim())
                                  .filter(Boolean)
                                  .slice(0, 20)
                                  .map((name) => ({ name })),
                              }))
                            }
                            placeholder={t(
                              'valuation.comps.peersPlaceholder',
                              'e.g., Company A, Company B'
                            )}
                            className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-900 text-sm text-slate-900 dark:text-white"
                          />
                        </div>
                        <button
                          disabled={busy}
                          onClick={handleSaveComps}
                          className="w-full px-3 py-2 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-60"
                        >
                          {t('valuation.comps.save', 'Save comps')}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 'results' && (
                <div className="space-y-4">
                  {!dcf ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {t('valuation.results.empty', 'Compute the valuation to see results')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                          {t('valuation.results.summary', 'Valuation summary')}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-slate-500">
                              {t('valuation.results.ev', 'Enterprise value (EV)')}
                            </span>
                            <span className="font-mono text-slate-900 dark:text-white">
                              {dcf.enterpriseValue}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">
                              {t('valuation.results.equity', 'Equity value')}
                            </span>
                            <span className="font-mono text-slate-900 dark:text-white">
                              {dcf.equityValue}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">
                              {t('valuation.results.wacc', 'WACC')}
                            </span>
                            <span className="font-mono text-slate-900 dark:text-white">
                              {dcf.discountRatePercent}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">
                              {t('valuation.results.pvSplit', 'PV split (explicit/terminal)')}
                            </span>
                            <span className="font-mono text-slate-900 dark:text-white">
                              {dcf.pvExplicit} / {dcf.pvTerminal}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                          {t('valuation.results.comps', 'Comparable range (if set)')}
                        </div>
                        {computed?.comps?.impliedEnterpriseValue ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                {t('valuation.results.compsMin', 'Min')}
                              </span>
                              <span className="font-mono text-slate-900 dark:text-white">
                                {computed.comps.impliedEnterpriseValue.min}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                {t('valuation.results.compsMedian', 'Median')}
                              </span>
                              <span className="font-mono text-slate-900 dark:text-white">
                                {computed.comps.impliedEnterpriseValue.median}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                {t('valuation.results.compsMax', 'Max')}
                              </span>
                              <span className="font-mono text-slate-900 dark:text-white">
                                {computed.comps.impliedEnterpriseValue.max}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-500 dark:text-slate-400">
                            {t('valuation.results.compsEmpty', 'Configure comps in Assumptions')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {t('valuation.advisory.title', 'Valuation advisory')}
                        </div>
                        <button
                          disabled={busy || selected?.status !== 'APPROVED'}
                          onClick={handleGenerateAdvisory}
                          className="px-3 py-1.5 rounded-lg text-xs bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-60"
                        >
                          {t('valuation.advisory.generate', 'Generate')}
                        </button>
                      </div>
                      {selected?.status !== 'APPROVED' ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {t(
                            'valuation.advisory.approvalGate',
                            'Generate advisory requires APPROVED valuation.'
                          )}
                        </div>
                      ) : !advisory?.recommendations?.length ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {t(
                            'valuation.advisory.empty',
                            'Generate advisory to see recommended actions.'
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {advisory.recommendations.slice(0, 6).map((r: any) => (
                            <div
                              key={r.id}
                              className="p-3 rounded-lg bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
                            >
                              <div className="text-sm font-medium text-slate-900 dark:text-white">
                                {r.title}
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {r.category} • {r.impactTier} • {r.effort}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-300 mt-2 line-clamp-3">
                                {r.mechanism || r.hypothesis}
                              </div>
                              <button
                                disabled={busy}
                                onClick={() => handleConvertRecommendation(String(r.id))}
                                className="mt-2 inline-flex items-center gap-2 text-xs text-purple-700 dark:text-purple-300 hover:underline"
                              >
                                <CheckCircle2 size={14} />
                                {t('valuation.advisory.convert', 'Create initiative')}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white">
                          {t('valuation.negotiation.title', 'Negotiation pack')}
                        </div>
                        <button
                          disabled={busy || selected?.status !== 'APPROVED'}
                          onClick={handleGenerateNegotiationPack}
                          className="px-3 py-1.5 rounded-lg text-xs bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {t('valuation.negotiation.generate', 'Generate')}
                        </button>
                      </div>
                      {selected?.status !== 'APPROVED' ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {t(
                            'valuation.negotiation.approvalGate',
                            'Generate pack requires APPROVED valuation.'
                          )}
                        </div>
                      ) : !negotiationPack ? (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {t(
                            'valuation.negotiation.empty',
                            'Generate a pack to get pro/contra points and Q&A.'
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {t('valuation.negotiation.pro', 'Pro')}
                            </div>
                            <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                              {(negotiationPack.proPoints || [])
                                .slice(0, 4)
                                .map((p: any, idx: number) => (
                                  <li key={idx}>{p.oneLiner || p.title}</li>
                                ))}
                            </ul>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                              {t('valuation.negotiation.qa', 'Q&A')}
                            </div>
                            <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                              {(negotiationPack.qa || []).slice(0, 3).map((q: any, idx: number) => (
                                <li key={idx}>{q.question}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeStep === 'sensitivity' && (
                <div className="space-y-4">
                  {!computed?.sensitivity && !computed?.tornado ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      {t('valuation.results.empty', 'Compute the valuation to see results')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                          {t('valuation.steps.sensitivity', 'Sensitivity')}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {computed?.sensitivity?.kind || '—'}
                        </div>
                        {Array.isArray(computed?.sensitivity?.waccGrid) && (
                          <div className="mt-3 text-xs text-slate-600 dark:text-slate-300">
                            WACC grid:{' '}
                            {(computed.sensitivity.waccGrid as any[]).slice(0, 5).join(', ')}
                          </div>
                        )}
                      </div>

                      <div className="bg-slate-50 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-xl p-4">
                        <div className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
                          {t('valuation.sensitivity.tornadoTitle', 'Tornado (top drivers)')}
                        </div>
                        {Array.isArray(computed?.tornado) && computed.tornado.length ? (
                          <ul className="list-disc pl-5 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                            {computed.tornado.slice(0, 8).map((d: any, idx: number) => (
                              <li key={idx}>
                                {String(d?.driver || 'Driver')}: {String(d?.swing ?? '—')}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-slate-500 dark:text-slate-400">—</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeStep === 'export' && (
                <div className="space-y-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {t(
                      'valuation.export.approvalGate',
                      'Export requires APPROVED valuation and includes disclaimers.'
                    )}
                  </div>
                  <button
                    disabled={busy}
                    onClick={handleExportPptx}
                    className="px-3 py-2 rounded-lg text-sm bg-purple-600 text-white hover:bg-purple-500 inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download size={16} />}
                    {t('valuation.export.pptx', 'Export PPTX')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {t('valuation.create.title', 'New valuation')}
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <input
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                placeholder={t(
                  'valuation.create.titlePlaceholder',
                  'e.g., Fundraising valuation — base case'
                )}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    {t('valuation.create.sourceType', 'Source type')}
                  </label>
                  <select
                    value={createSourceType}
                    onChange={(e) => {
                      setCreateSourceType(e.target.value as ValuationSourceType);
                      setCreateSourceId('');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                  >
                    <option value="budget">
                      {t('valuation.create.source.budget', 'Approved budget (T053)')}
                    </option>
                    <option value="manual">
                      {t('valuation.create.source.manual', 'Manual forecast')}
                    </option>
                    <option value="financial_model" disabled>
                      {t(
                        'valuation.create.source.financialModel',
                        'Approved financial model (T054)'
                      )}
                    </option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    {t('valuation.create.horizon', 'Horizon (years)')}
                  </label>
                  <input
                    type="number"
                    value={createHorizonYears}
                    onChange={(e) => setCreateHorizonYears(safeNumber(e.target.value, 5))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>
              {createSourceType === 'budget' && (
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">
                    {t('valuation.create.sourceLabel', 'Source')}
                  </label>
                  <select
                    value={createSourceId}
                    onChange={(e) => setCreateSourceId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-800 text-slate-900 dark:text-white text-sm"
                  >
                    <option value="">{t('valuation.create.selectSource', 'Select...')}</option>
                    {sources.budgets.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.title} — {b.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700"
              >
                {t('valuation.create.cancel', 'Cancel')}
              </button>
              <button
                disabled={busy}
                onClick={handleCreate}
                className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-500 disabled:opacity-60"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t('valuation.create.create', 'Create')
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValuationWorkspace;
