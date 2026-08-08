import { CheckCircle2, Download, ExternalLink, Loader2, Play, Plus, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  EvBasketFootballField,
  type EvBasketResult,
} from '@/components/Economics/panels/EvBasketFootballField';
import { EmptyState, LoadingState } from '@/components/shared/states';
import { API_URL, getHeaders } from '@/services/api';
import {
  confirmValuationRecommendationCandidateHandoff,
  getValuationRecommendationCandidateHandoff,
  previewValuationRecommendationCandidateHandoff,
} from '@/services/api/v8/financeCandidateHandoffValuation';
import { trackFunnelEvent } from '@/services/funnelAnalytics';
import { isFinanceEvBasketEnabled } from '@/utils/financeEvBasketFlag';
import { valuationDisplayMultiplier } from '@/utils/valuationMonetaryUnit';

import { ExportButton } from '../Finance/ExportButton';
import { FinanceCandidateHandoffModal } from '../Finance/shared/FinanceCandidateHandoffModal';

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

function sensitivityHeatmapColor(value: number, min: number, max: number): string {
  if (min === max) return 'bg-c-surface-raised dark:bg-c-surface-raised';
  const ratio = Math.max(0, Math.min(1, (value - min) / (max - min)));
  if (ratio >= 0.8)
    return 'bg-emerald-200 dark:bg-emerald-900/40 text-emerald-900 dark:text-emerald-200';
  if (ratio >= 0.6)
    return 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300';
  if (ratio >= 0.4)
    return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300';
  if (ratio >= 0.2) return 'bg-amber-100 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300';
  return 'bg-danger-100 dark:bg-danger-900/20 text-danger-800 dark:text-danger-300';
}

function safeNumber(v: unknown, fb: number): number {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : fb;
}

export function formatValuationImpact(
  value: unknown,
  formatter: Intl.NumberFormat,
  multiplier = 1
): string {
  const numeric = safeNumber(value, NaN);
  return Number.isFinite(numeric) ? formatter.format(numeric * multiplier) : String(value ?? '—');
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

type TranslateFn = (key: string, defaultValue: string) => string;

/** Localized label for a valuation status enum (DRAFT / REVIEW / APPROVED). */
export function valuationStatusLabel(raw: unknown, t: TranslateFn): string {
  const s = String(raw ?? '')
    .trim()
    .toUpperCase();
  if (s === 'APPROVED') return t('valuation.enum.status.approved', 'Approved');
  if (s === 'REVIEW') return t('valuation.enum.status.review', 'In review');
  if (s === 'DRAFT') return t('valuation.enum.status.draft', 'Draft');
  return s || t('valuation.enum.status.draft', 'Draft');
}

/** Localized label for a valuation source type (budget / financial_model / manual). */
export function valuationSourceLabel(raw: unknown, t: TranslateFn): string {
  const s = String(raw ?? '')
    .trim()
    .toLowerCase();
  if (s === 'budget') return t('valuation.enum.source.budget', 'Budget');
  if (s === 'financial_model') return t('valuation.enum.source.financialModel', 'Financial model');
  if (s === 'financial_analysis')
    return t('valuation.enum.source.financialAnalysis', 'Financial analysis');
  if (s === 'manual') return t('valuation.enum.source.manual', 'Manual');
  return raw ? String(raw) : t('valuation.enum.source.manual', 'Manual');
}

interface ValuationWorkspaceProps {
  initialValuationId?: string;
  hideSidebar?: boolean;
  onValuationChanged?: () => void;
}

export const ValuationWorkspace: React.FC<ValuationWorkspaceProps> = ({
  initialValuationId,
  hideSidebar,
  onValuationChanged,
}) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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

  // FIN-06: "Send as Initiative Candidate" preview→confirm flow, via the
  // shared FinanceCandidateHandoffModal. This recommendation-conversion
  // action creates a Candidate, never an Initiative directly — Finance is
  // banned from creating Initiatives straight from a recommendation. Only
  // which recommendation the modal is open for needs to live here — the
  // preview/ineligible/confirming/error phase machine is owned by the
  // shared component.
  const [candidateHandoffRecommendationId, setCandidateHandoffRecommendationId] = useState<
    string | null
  >(null);

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
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const d = (await res.json()) as any;
      setValuations((d?.valuations || []) as ValuationListItem[]);
      setLoadError(false);
    } catch {
      setLoadError(true);
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

  useEffect(() => {
    if (initialValuationId && valuations.length > 0 && !selectedId) {
      const match = valuations.find((v) => v.id === initialValuationId);
      if (match) {
        setSelectedId(match.id);
        setActiveStep('assumptions');
      }
    }
  }, [initialValuationId, valuations, selectedId]);

  const computed = safeJson<any>(selected?.results, {});
  const displayMultiplier = valuationDisplayMultiplier(computed);
  const dcf = computed?.dcf;
  const advisory = safeJson<any>(selected?.advisory, null);
  const negotiationPack = safeJson<any>(selected?.negotiation_pack, null);

  // EV KOSZYK (football-field) — za flagą (default OFF; podgląd `?ff_evBasket=1`).
  // Additive: czyta osobny read-only endpoint, nie rusza istniejących surface'ów.
  const evBasketEnabled = useMemo(() => isFinanceEvBasketEnabled(), []);
  const [evBasket, setEvBasket] = useState<EvBasketResult | null>(null);
  const dcfEv = dcf?.enterpriseValue;
  useEffect(() => {
    if (!evBasketEnabled || !selectedId || !Number.isFinite(Number(dcfEv))) {
      setEvBasket(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/economics/valuations/${selectedId}/basket`, {
          headers: getHeaders(),
        });
        if (!res.ok) {
          if (!cancelled) setEvBasket(null);
          return;
        }
        const d = (await res.json()) as { basket?: EvBasketResult | null };
        if (!cancelled) setEvBasket((d?.basket ?? null) as EvBasketResult | null);
      } catch {
        if (!cancelled) setEvBasket(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [evBasketEnabled, selectedId, dcfEv]);

  const fmtCurrency = useMemo(() => {
    const cur = selected?.currency || 'PLN';
    return new Intl.NumberFormat(i18n.language, {
      style: 'currency',
      currency: cur,
      maximumFractionDigits: 0,
      notation: 'compact',
    });
  }, [selected?.currency, i18n.language]);

  const fmtValue = useCallback(
    (v: unknown): string => formatValuationImpact(v, fmtCurrency, displayMultiplier),
    [displayMultiplier, fmtCurrency]
  );

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
      onValuationChanged?.();
    } catch {
      toast.error(t('valuation.create.failed', 'Failed to create valuation'));
    } finally {
      setBusy(false);
    }
  }, [
    createHorizonYears,
    createSourceId,
    createSourceType,
    createTitle,
    fetchValuations,
    t,
    onValuationChanged,
  ]);

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
      onValuationChanged?.();
    } finally {
      setBusy(false);
    }
  }, [fetchValuation, selectedId, t, onValuationChanged]);

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
      onValuationChanged?.();
    } finally {
      setBusy(false);
    }
  }, [fetchValuation, selectedId, t, onValuationChanged]);

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
      onValuationChanged?.();
    } finally {
      setBusy(false);
    }
  }, [i18n.language, selectedId, t, onValuationChanged]);

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
      onValuationChanged?.();
    } finally {
      setBusy(false);
    }
  }, [fetchValuation, selectedId, t, onValuationChanged]);

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
      onValuationChanged?.();
    } finally {
      setBusy(false);
    }
  }, [fetchValuation, selectedId, t, onValuationChanged]);

  // FIN-06: opens the shared FinanceCandidateHandoffModal for a
  // recommendation. The modal itself drives the read-only preview → confirm
  // flow (no lock, no write on preview; a real backend reason if
  // ineligible); this component only needs to remember which recommendation
  // it's open for, so `preview`/`confirm` closures below can bind it.
  const handleOpenCandidateHandoff = useCallback((recommendationId: string) => {
    setCandidateHandoffRecommendationId(recommendationId);
  }, []);

  // FIN-06: fired once by the shared modal right after a successful confirm
  // (a real 4xx/409 — including a TOCTOU race if the recommendation went
  // ineligible between preview and confirm — surfaces as the modal's own
  // error phase instead, and never reaches this callback). `created: false`
  // means the backend's idempotency short-circuit fired — this
  // recommendation was already handed off before — so the toast says that
  // honestly instead of claiming a fresh creation.
  const handleCandidateHandoffConfirmed = useCallback(
    ({ created, candidateId }: { created: boolean; candidateId: string }) => {
      // Reuses the existing `valuation_advisory_recommendation_converted`
      // FunnelEventName (funnelAnalytics.ts is outside this task's file
      // ownership) — the `created`/`candidateId` fields distinguish a fresh
      // Candidate handoff from an idempotent replay in the event payload.
      trackFunnelEvent('valuation_advisory_recommendation_converted', {
        valuationId: selectedId,
        recommendationId: candidateHandoffRecommendationId,
        candidateId,
        created,
      });
      const message = created
        ? t('valuation.advisory.candidateCreated', 'Utworzono kandydata na Initiative')
        : t(
            'valuation.advisory.candidateAlreadyExists',
            'To zalecenie zostało już wcześniej wysłane jako kandydat na Initiative'
          );
      toast(
        (toastMsg) => (
          <div className="flex items-center gap-3">
            <span>{message}</span>
            <button
              className="text-xs font-medium text-c-info dark:text-c-info hover:underline whitespace-nowrap"
              onClick={() => {
                toast.dismiss(toastMsg.id);
                // No direct single-candidate deep link exists today
                // (Initiatives' "Kandydaci" tab is not URL-addressable —
                // InitiativesHub doesn't read a `tab`/`open` param for it),
                // so this honestly opens the hub rather than guessing a URL
                // that wouldn't actually land on the candidate.
                navigate('/initiatives');
              }}
            >
              {t('valuation.advisory.openCandidates', 'Otwórz (zakładka „Kandydaci")')}
            </button>
          </div>
        ),
        { duration: 6000 }
      );
    },
    [candidateHandoffRecommendationId, navigate, selectedId, t]
  );

  return (
    <div className="p-6">
      {!hideSidebar && (
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-c-text dark:text-white">
              {t('valuation.title', 'Enterprise valuation')}
            </h2>
            <p className="text-sm text-c-text-muted dark:text-c-text-muted">
              {t('valuation.subtitle', 'DCF + comps + sensitivity, deck-ready export')}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-3 py-2 rounded-lg text-sm bg-c-text text-c-bg hover:opacity-90 inline-flex items-center gap-2"
          >
            <Plus size={16} /> {t('valuation.create.cta', 'New valuation')}
          </button>
        </div>
      )}

      <div className={hideSidebar ? '' : 'grid grid-cols-12 gap-4'}>
        {!hideSidebar && (
          <div className="col-span-4 bg-white dark:bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle overflow-hidden">
            <div className="px-4 py-3 border-b border-c-border-subtle dark:border-c-border-subtle flex items-center justify-between">
              <div className="text-sm font-semibold text-c-text dark:text-white">
                {t('valuation.list.title', 'Valuations')}
              </div>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-c-text-secondary" />}
            </div>
            <div className="max-h-[520px] overflow-auto divide-y divide-c-border-subtle dark:divide-c-border-subtle">
              {loading && valuations.length === 0 ? (
                <div className="p-4">
                  <LoadingState template="list" rows={4} />
                </div>
              ) : loadError && valuations.length === 0 ? (
                <EmptyState
                  variant="error"
                  compact
                  title={t('valuation.list.loadErrorTitle', 'Could not load valuations')}
                  description={t(
                    'valuation.list.loadErrorDesc',
                    'The valuations source could not be reached. Check your connection and try again.'
                  )}
                  onRetry={() => {
                    void fetchValuations();
                  }}
                />
              ) : valuations.length === 0 ? (
                <EmptyState
                  variant="new"
                  compact
                  title={t('valuation.list.empty', 'No valuations yet. Create one to start.')}
                  description={t(
                    'valuation.list.emptyDesc',
                    'Create a valuation to estimate value from a model or budget.'
                  )}
                  primaryAction={{
                    label: t('valuation.create.cta', 'New valuation'),
                    onClick: () => setShowCreate(true),
                    icon: Plus,
                  }}
                />
              ) : (
                valuations.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedId(v.id);
                      setActiveStep('assumptions');
                    }}
                    className={[
                      'w-full text-left p-4 hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition',
                      selectedId === v.id ? 'bg-c-surface-raised dark:bg-c-surface-raised' : '',
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-c-text dark:text-white">
                          {v.title}
                        </div>
                        <div className="text-xs text-c-text-muted dark:text-c-text-muted mt-0.5">
                          {t('valuation.list.source', 'Source')}:{' '}
                          {valuationSourceLabel(v.sourceType, t)} •{' '}
                          {valuationStatusLabel(v.status, t)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        <div
          className={
            hideSidebar
              ? 'w-full'
              : 'col-span-8 bg-white dark:bg-c-surface rounded-xl border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle p-5'
          }
        >
          {!selectedId || !selected ? (
            <div className="h-[520px] flex items-center justify-center text-sm text-c-text-muted dark:text-c-text-muted">
              {t('valuation.detail.empty', 'Select a valuation to continue')}
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="text-sm font-semibold text-c-text dark:text-white">
                    {selected.title}
                  </div>
                  <div className="text-xs text-c-text-muted dark:text-c-text-muted mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>
                      {t('valuation.detail.status', 'Status')}:{' '}
                      {valuationStatusLabel(selected.status, t)} •{' '}
                      {t('valuation.detail.currency', 'Currency')}: {selected.currency}
                    </span>
                    {selected.source_type &&
                      selected.source_type !== 'manual' &&
                      selected.source_id && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selected.source_type === 'financial_model') {
                              navigate(`/economics?tab=models&openId=${selected.source_id}`);
                            } else if (selected.source_type === 'budget') {
                              navigate(`/economics?tab=prediction&openId=${selected.source_id}`);
                            }
                          }}
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-c-info/10 text-c-info hover:bg-c-info/20 transition font-medium"
                        >
                          <ExternalLink size={10} />
                          {t('valuation.detail.viewSource', 'View source')}
                        </button>
                      )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    disabled={busy}
                    onClick={handleCompute}
                    className="px-3 py-2 rounded-lg text-sm bg-c-surface text-white hover:bg-c-surface-raised disabled:opacity-60 inline-flex items-center gap-2"
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

              {(() => {
                const steps = [
                  'source',
                  'assumptions',
                  'results',
                  'sensitivity',
                  'export',
                ] as const;
                const activeIndex = steps.indexOf(activeStep);
                const progressPercent =
                  steps.length > 1 ? (activeIndex / (steps.length - 1)) * 100 : 0;
                return (
                  <div className="mb-4">
                    <div className="relative mb-3">
                      <div className="absolute top-1/2 left-0 right-0 h-1 -translate-y-1/2 bg-c-surface-raised dark:bg-c-surface-raised rounded-full" />
                      <div
                        className="absolute top-1/2 left-0 h-1 -translate-y-1/2 bg-c-surface rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                      <div className="relative flex justify-between">
                        {steps.map((s, idx) => (
                          <div
                            key={s}
                            className={[
                              'w-3 h-3 rounded-full border-2 transition-colors',
                              idx <= activeIndex
                                ? 'bg-c-accent border-c-accent'
                                : 'bg-white dark:bg-c-surface border-c-border-strong dark:border-c-border-strong',
                            ].join(' ')}
                          />
                        ))}
                      </div>
                    </div>
                    <div
                      className="flex items-center gap-2 border-b border-c-border-subtle dark:border-c-border-subtle pb-3"
                      role="tablist"
                      aria-label={t('valuation.steps.label', 'Valuation steps')}
                    >
                      {steps.map((s) => (
                        <button
                          key={s}
                          role="tab"
                          aria-selected={activeStep === s}
                          aria-controls={`valuation-panel-${s}`}
                          id={`valuation-tab-${s}`}
                          onClick={() => setActiveStep(s)}
                          className={[
                            'px-3 py-1.5 rounded-lg text-sm border transition',
                            activeStep === s
                              ? 'bg-c-surface-raised text-c-text border-c-border-strong dark:border-c-border-strong'
                              : 'bg-white dark:bg-c-surface text-c-text-secondary dark:text-c-text-secondary border-c-border-subtle dark:border-c-border-subtle hover:bg-c-surface-raised dark:hover:bg-c-surface-raised',
                          ].join(' ')}
                        >
                          {t(`valuation.steps.${s}` as any, s)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {activeStep === 'source' && (
                <div className="text-sm text-c-text-muted dark:text-c-text-muted">
                  {t(
                    'valuation.source.note',
                    'Source is set at creation (Budget or Manual for this branch).'
                  )}
                </div>
              )}

              {activeStep === 'assumptions' && (
                <div className="space-y-4">
                  {validationError && (
                    <div className="bg-danger-500/10 border border-danger-500/30 text-danger-400 rounded-xl p-3 text-sm">
                      {validationError}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-c-surface-raised dark:bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle rounded-xl p-4">
                      <div className="text-sm font-semibold text-c-text dark:text-white mb-3">
                        {t('valuation.assumptions.dcfTitle', 'DCF assumptions')}
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-c-text-muted">
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
                            className="mt-1 w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface text-sm text-c-text dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-c-text-muted">
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
                            className="mt-1 w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface text-sm text-c-text dark:text-white"
                          >
                            <option value="gordon">Gordon growth</option>
                            <option value="exit_multiple">Exit multiple</option>
                          </select>
                        </div>
                        {assumptions.terminalMethod === 'gordon' ? (
                          <div>
                            <label className="text-xs text-c-text-muted">
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
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface text-sm text-c-text dark:text-white"
                            />
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {[
                                { label: t('valuation.macro.gdpPl', 'GDP PL ~2.5%'), value: 2.5 },
                                { label: t('valuation.macro.gdpEu', 'GDP EU ~1.5%'), value: 1.5 },
                                { label: t('valuation.macro.gdpUs', 'GDP US ~2.0%'), value: 2.0 },
                                {
                                  label: t(
                                    'valuation.macro.inflationTarget',
                                    'Inflation target ~2.5%'
                                  ),
                                  value: 2.5,
                                },
                                {
                                  label: t('valuation.macro.techGrowth', 'Tech sector ~4.0%'),
                                  value: 4.0,
                                },
                                {
                                  label: t('valuation.macro.conservative', 'Conservative ~1.0%'),
                                  value: 1.0,
                                },
                              ].map((preset) => (
                                <button
                                  key={preset.label}
                                  type="button"
                                  onClick={() =>
                                    setAssumptions((p) => ({
                                      ...p,
                                      terminalGrowthPercent: preset.value,
                                    }))
                                  }
                                  className={[
                                    'text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                                    assumptions.terminalGrowthPercent === preset.value
                                      ? 'border-c-focus bg-c-info/10 text-c-info dark:text-c-info'
                                      : 'border-c-border-subtle dark:border-c-border-strong text-c-text-muted hover:border-c-border-strong',
                                  ].join(' ')}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-c-text-muted">
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
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface text-sm text-c-text dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-c-text-muted">
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
                                className="mt-1 w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface text-sm text-c-text dark:text-white"
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
                          className="w-full px-3 py-2 rounded-lg text-sm bg-c-text text-c-bg hover:opacity-90 disabled:opacity-60"
                        >
                          {t('valuation.assumptions.save', 'Save assumptions')}
                        </button>
                      </div>
                    </div>

                    <div className="bg-c-surface-raised dark:bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle rounded-xl p-4">
                      <div className="text-sm font-semibold text-c-text dark:text-white mb-3">
                        {t('valuation.comps.title', 'Comparable valuation (multiples)')}
                      </div>
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-xs text-c-text-muted">
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
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface text-sm text-c-text dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-c-text-muted">
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
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface text-sm text-c-text dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-c-text-muted">
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
                              className="mt-1 w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface text-sm text-c-text dark:text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-c-text-muted">
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
                            className="mt-1 w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface text-sm text-c-text dark:text-white"
                          />
                        </div>
                        <button
                          disabled={busy}
                          onClick={handleSaveComps}
                          className="w-full px-3 py-2 rounded-lg text-sm bg-c-text text-c-bg hover:opacity-90 disabled:opacity-60"
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
                    <div className="text-sm text-c-text-muted dark:text-c-text-muted">
                      {t('valuation.results.empty', 'Compute the valuation to see results')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-c-surface-raised dark:bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle rounded-xl p-4">
                        <div className="text-sm font-semibold text-c-text dark:text-white mb-2">
                          {t('valuation.results.summary', 'Valuation summary')}
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-c-text-muted">
                              {t('valuation.results.ev', 'Enterprise value (EV)')}
                            </span>
                            <span className="font-mono text-c-text dark:text-white">
                              {fmtValue(dcf.enterpriseValue)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-c-text-muted">
                              {t('valuation.results.equity', 'Equity value')}
                            </span>
                            <span className="font-mono text-c-text dark:text-white">
                              {fmtValue(dcf.equityValue)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-c-text-muted">
                              {t('valuation.results.wacc', 'WACC')}
                            </span>
                            <span className="font-mono text-c-text dark:text-white">
                              {dcf.discountRatePercent}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-c-text-muted">
                              {t('valuation.results.pvSplit', 'PV split (explicit/terminal)')}
                            </span>
                            <span className="font-mono text-c-text dark:text-white">
                              {fmtValue(dcf.pvExplicit)} / {fmtValue(dcf.pvTerminal)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="bg-c-surface-raised dark:bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle rounded-xl p-4">
                        <div className="text-sm font-semibold text-c-text dark:text-white mb-2">
                          {t('valuation.results.comps', 'Comparable range (if set)')}
                        </div>
                        {computed?.comps?.impliedEnterpriseValue ? (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-c-text-muted">
                                {t('valuation.results.compsMin', 'Min')}
                              </span>
                              <span className="font-mono text-c-text dark:text-white">
                                {fmtValue(computed.comps.impliedEnterpriseValue.min)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-c-text-muted">
                                {t('valuation.results.compsMedian', 'Median')}
                              </span>
                              <span className="font-mono text-c-text dark:text-white">
                                {fmtValue(computed.comps.impliedEnterpriseValue.median)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-c-text-muted">
                                {t('valuation.results.compsMax', 'Max')}
                              </span>
                              <span className="font-mono text-c-text dark:text-white">
                                {fmtValue(computed.comps.impliedEnterpriseValue.max)}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-c-text-muted dark:text-c-text-muted">
                            {t('valuation.results.compsEmpty', 'Configure comps in Assumptions')}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* EV KOSZYK — football-field (za flagą ff_evBasket; default OFF) */}
                  {evBasketEnabled && dcf && (
                    <EvBasketFootballField
                      basket={evBasket}
                      subjectLabel={selected?.title}
                      unitLabel={selected?.currency || 'PLN'}
                      formatValue={fmtValue}
                      t={t as (key: string, defaultValue: string) => string}
                    />
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white dark:bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="text-sm font-semibold text-c-text dark:text-white">
                          {t('valuation.advisory.title', 'Valuation advisory')}
                        </div>
                        <button
                          disabled={busy || selected?.status !== 'APPROVED'}
                          onClick={handleGenerateAdvisory}
                          className="px-3 py-1.5 rounded-lg text-xs bg-c-text text-c-bg hover:opacity-90 disabled:opacity-60"
                        >
                          {t('valuation.advisory.generate', 'Generate')}
                        </button>
                      </div>
                      {selected?.status !== 'APPROVED' ? (
                        <div className="text-sm text-c-text-muted dark:text-c-text-muted">
                          {t(
                            'valuation.advisory.approvalGate',
                            'Generate advisory requires APPROVED valuation.'
                          )}
                        </div>
                      ) : !advisory?.recommendations?.length ? (
                        <div className="text-sm text-c-text-muted dark:text-c-text-muted">
                          {t(
                            'valuation.advisory.empty',
                            'Generate advisory to see recommended actions.'
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {advisory.driverDecomposition?.drivers?.length > 0 && (
                            <div className="bg-c-surface-raised dark:bg-c-surface-raised rounded-xl border border-c-border-subtle dark:border-c-border-subtle overflow-hidden">
                              <div className="px-4 py-2 border-b border-c-border-subtle dark:border-c-border-subtle">
                                <h4 className="text-xs font-semibold text-c-text-secondary dark:text-c-text-secondary uppercase tracking-wide">
                                  {t(
                                    'valuation.advisory.driverDecomposition',
                                    'Value Driver Decomposition'
                                  )}
                                </h4>
                              </div>
                              <table
                                /* §27-exempt: edytor komorkowy/workspace, edycja cell-by-cell */ className="w-full text-xs"
                              >
                                <thead>
                                  <tr className="text-c-text-muted border-b border-c-border-subtle dark:border-c-border-subtle">
                                    <th className="px-3 py-1.5 text-left">
                                      {t('valuation.advisory.driver', 'Driver')}
                                    </th>
                                    <th className="px-3 py-1.5 text-right">
                                      {t('valuation.advisory.current', 'Current')}
                                    </th>
                                    <th className="px-3 py-1.5 text-right">
                                      {t('valuation.advisory.change', 'Change')}
                                    </th>
                                    <th className="px-3 py-1.5 text-right">
                                      {t('valuation.advisory.evImpact', 'EV Impact')}
                                    </th>
                                    <th className="px-3 py-1.5 text-left">
                                      {t('valuation.advisory.lever', 'Lever')}
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {advisory.driverDecomposition.drivers.map((d: any, i: number) => (
                                    <tr
                                      key={i}
                                      className="border-b border-c-border-subtle dark:border-c-border-subtle last:border-0"
                                    >
                                      <td className="px-3 py-1.5 font-medium text-c-text dark:text-c-text-secondary">
                                        {d.driver}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-mono text-c-text-secondary dark:text-c-text-muted">
                                        {d.currentValue}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-mono text-c-text dark:text-c-text">
                                        {d.change}
                                      </td>
                                      <td className="px-3 py-1.5 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                        {d.evImpactDirection} {d.evImpactMagnitude}
                                      </td>
                                      <td className="px-3 py-1.5 text-c-text-muted dark:text-c-text-muted max-w-[200px] truncate">
                                        {d.lever}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                              {advisory.driverDecomposition.summary && (
                                <div className="px-4 py-2 text-xs text-c-text-muted dark:text-c-text-muted bg-c-surface-raised dark:bg-c-surface border-t border-c-border-subtle dark:border-c-border-subtle">
                                  {advisory.driverDecomposition.summary}
                                </div>
                              )}
                            </div>
                          )}
                          <div className="space-y-3">
                            {advisory.recommendations.slice(0, 6).map((r: any) => {
                              const impactColors: Record<string, string> = {
                                high: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                                medium:
                                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                                low: 'bg-c-surface-raised text-c-text-secondary dark:bg-c-surface-raised dark:text-c-text-secondary',
                              };
                              const effortColors: Record<string, string> = {
                                low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
                                medium:
                                  'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
                                high: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
                              };
                              const impactKey = String(r.impactTier || '').toLowerCase();
                              const effortKey = String(r.effort || '').toLowerCase();
                              return (
                                <div
                                  key={r.id}
                                  className="p-4 rounded-xl bg-c-surface-raised dark:bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle hover:border-c-border-strong dark:hover:border-c-border-strong transition-colors"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="text-sm font-semibold text-c-text dark:text-white">
                                      {r.title}
                                    </div>
                                    <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-c-surface text-c-text-secondary border border-slate-200/60 dark:border-white/[0.03] dark:bg-c-surface-raised dark:text-c-text-secondary font-medium">
                                      {r.category}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <span
                                      className={[
                                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                        impactColors[impactKey] || impactColors.low,
                                      ].join(' ')}
                                    >
                                      {t('valuation.advisory.impact', 'Impact')}: {r.impactTier}
                                    </span>
                                    <span
                                      className={[
                                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                                        effortColors[effortKey] || effortColors.medium,
                                      ].join(' ')}
                                    >
                                      {t('valuation.advisory.effort', 'Effort')}: {r.effort}
                                    </span>
                                  </div>
                                  <div className="text-xs text-c-text-secondary dark:text-c-text-secondary mt-2.5 line-clamp-3 leading-relaxed">
                                    {r.mechanism || r.hypothesis}
                                  </div>
                                  <div className="mt-3 pt-3 border-t border-c-border-subtle dark:border-c-border-subtle flex items-center gap-2">
                                    <button
                                      disabled={busy}
                                      onClick={() => handleOpenCandidateHandoff(String(r.id))}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-c-text text-c-bg hover:opacity-90 disabled:opacity-60 transition-colors"
                                    >
                                      <Plus size={12} />
                                      {t(
                                        'valuation.advisory.convert',
                                        'Wyślij jako kandydata na Initiative'
                                      )}
                                    </button>
                                    <button
                                      disabled={busy}
                                      onClick={() => handleOpenCandidateHandoff(String(r.id))}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-c-border-subtle dark:border-c-border-strong text-c-text-secondary dark:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
                                    >
                                      <ExternalLink size={12} />
                                      {t('valuation.advisory.details', 'Details')}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {(advisory.guardrails?.length > 0 || advisory.complianceFlags) && (
                            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-500/20">
                              <div className="flex items-start gap-2">
                                <svg
                                  className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
                                  />
                                </svg>
                                <div>
                                  <div className="text-xs font-semibold text-amber-900 dark:text-amber-300 mb-1">
                                    {t('valuation.advisory.complianceNotice', 'Compliance Notice')}
                                  </div>
                                  {advisory.complianceFlags?.regulatoryDisclaimer && (
                                    <p className="text-[10px] text-amber-800 dark:text-amber-400 mb-1">
                                      {advisory.complianceFlags.regulatoryDisclaimer}
                                    </p>
                                  )}
                                  <ul className="text-[10px] text-amber-700 dark:text-amber-500 space-y-0.5 list-disc list-inside">
                                    {(advisory.guardrails || []).map((g: string, i: number) => (
                                      <li key={i}>{g}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="bg-white dark:bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle rounded-xl p-4">
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="text-sm font-semibold text-c-text dark:text-white">
                          {t('valuation.negotiation.title', 'Negotiation pack')}
                        </div>
                        <div className="flex items-center gap-2">
                          {negotiationPack && (
                            <button
                              onClick={async () => {
                                try {
                                  const res = await fetch(
                                    `${API_URL}/economics/valuations/${selectedId}/export/negotiation-pack`,
                                    {
                                      headers: getHeaders(),
                                    }
                                  );
                                  if (res.ok) {
                                    const blob = await res.blob();
                                    const url = URL.createObjectURL(blob);
                                    const a = document.createElement('a');
                                    a.href = url;
                                    a.download = `negotiation-pack-${selectedId?.slice(0, 8)}.md`;
                                    a.click();
                                    URL.revokeObjectURL(url);
                                    toast.success(
                                      t('valuation.negotiation.exported', 'Pack exported')
                                    );
                                  }
                                } catch {
                                  toast.error(t('valuation.export.failed', 'Export failed'));
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg text-xs border border-c-border-strong dark:border-c-border-strong text-c-text-secondary dark:text-c-text-secondary hover:bg-c-surface-raised dark:hover:bg-c-surface-raised"
                            >
                              {t('valuation.negotiation.export', 'Export Pack')}
                            </button>
                          )}
                          <button
                            disabled={busy || selected?.status !== 'APPROVED'}
                            onClick={handleGenerateNegotiationPack}
                            className="px-3 py-1.5 rounded-lg text-xs bg-c-surface text-white hover:bg-c-surface-raised disabled:opacity-60"
                          >
                            {t('valuation.negotiation.generate', 'Generate')}
                          </button>
                        </div>
                      </div>
                      {selected?.status !== 'APPROVED' ? (
                        <div className="text-sm text-c-text-muted dark:text-c-text-muted">
                          {t(
                            'valuation.negotiation.approvalGate',
                            'Generate pack requires APPROVED valuation.'
                          )}
                        </div>
                      ) : !negotiationPack ? (
                        <div className="text-sm text-c-text-muted dark:text-c-text-muted">
                          {t(
                            'valuation.negotiation.empty',
                            'Generate a pack to get pro/contra points and Q&A.'
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs font-semibold text-c-text-secondary dark:text-c-text-secondary mb-1">
                              {t('valuation.negotiation.pro', 'Pro')}
                            </div>
                            <ul className="list-disc pl-5 text-xs text-c-text-secondary dark:text-c-text-secondary space-y-1">
                              {(negotiationPack.proPoints || [])
                                .slice(0, 4)
                                .map((p: any, idx: number) => (
                                  <li key={idx}>{p.oneLiner || p.title}</li>
                                ))}
                            </ul>
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-c-text-secondary dark:text-c-text-secondary mb-1">
                              {t('valuation.negotiation.qa', 'Q&A')}
                            </div>
                            <ul className="list-disc pl-5 text-xs text-c-text-secondary dark:text-c-text-secondary space-y-1">
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
                    <div className="text-sm text-c-text-muted dark:text-c-text-muted">
                      {t('valuation.results.empty', 'Compute the valuation to see results')}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2 bg-c-surface-raised dark:bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle rounded-xl p-4">
                        <div className="text-sm font-semibold text-c-text dark:text-white mb-2">
                          {t('valuation.steps.sensitivity', 'Sensitivity')}
                        </div>
                        <div className="text-xs text-c-text-muted dark:text-c-text-muted mb-3">
                          {computed?.sensitivity?.kind || '—'}
                        </div>
                        {Array.isArray(computed?.sensitivity?.matrix) &&
                        computed.sensitivity.matrix.length > 0 ? (
                          (() => {
                            const matrix = computed.sensitivity.matrix as Array<{
                              wacc: number;
                              g: number;
                              ev: number;
                            }>;
                            const allEv = matrix.map((c: any) => safeNumber(c.ev, 0));
                            const minEv = Math.min(...allEv);
                            const maxEv = Math.max(...allEv);
                            const waccValues = [...new Set(matrix.map((c: any) => c.wacc))].sort(
                              (a, b) => a - b
                            );
                            const gValues = [...new Set(matrix.map((c: any) => c.g))].sort(
                              (a, b) => a - b
                            );
                            const lookup = new Map(
                              matrix.map((c: any) => [`${c.wacc}-${c.g}`, c.ev])
                            );
                            const fmtCell = new Intl.NumberFormat(i18n.language, {
                              notation: 'compact',
                              maximumFractionDigits: 1,
                            });
                            return (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs border-collapse">
                                  <thead>
                                    <tr>
                                      <th className="px-2 py-1.5 text-left text-c-text-muted dark:text-c-text-muted font-medium">
                                        WACC \ g
                                      </th>
                                      {gValues.map((g) => (
                                        <th
                                          key={g}
                                          className="px-2 py-1.5 text-center text-c-text-muted dark:text-c-text-muted font-medium"
                                        >
                                          {g}%
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {waccValues.map((w) => (
                                      <tr key={w}>
                                        <td className="px-2 py-1.5 font-medium text-c-text-secondary dark:text-c-text-secondary border-r border-c-border-subtle dark:border-c-border-subtle">
                                          {w}%
                                        </td>
                                        {gValues.map((g) => {
                                          const ev = safeNumber(lookup.get(`${w}-${g}`), 0);
                                          return (
                                            <td
                                              key={g}
                                              className={[
                                                'px-2 py-1.5 text-center font-mono transition-colors',
                                                sensitivityHeatmapColor(ev, minEv, maxEv),
                                              ].join(' ')}
                                            >
                                              {fmtCell.format(ev * displayMultiplier)}
                                            </td>
                                          );
                                        })}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                <div className="flex items-center gap-2 mt-2 text-[10px] text-c-text-secondary">
                                  <span>{t('valuation.sensitivity.legend', 'Legend')}:</span>
                                  <span className="inline-block w-3 h-3 rounded bg-danger-100 dark:bg-danger-900/20" />
                                  <span>{t('valuation.sensitivity.lower', 'Lower')}</span>
                                  <span className="inline-block w-3 h-3 rounded bg-yellow-100 dark:bg-yellow-900/20" />
                                  <span>{t('valuation.sensitivity.mid', 'Mid')}</span>
                                  <span className="inline-block w-3 h-3 rounded bg-emerald-200 dark:bg-emerald-900/40" />
                                  <span>{t('valuation.sensitivity.higher', 'Higher')}</span>
                                </div>
                              </div>
                            );
                          })()
                        ) : Array.isArray(computed?.sensitivity?.waccGrid) ? (
                          <div className="text-xs text-c-text-secondary dark:text-c-text-secondary">
                            WACC grid:{' '}
                            {(computed.sensitivity.waccGrid as any[]).slice(0, 5).join(', ')}
                          </div>
                        ) : null}
                      </div>

                      <div className="bg-c-surface-raised dark:bg-c-surface-raised border border-c-border-subtle dark:border-c-border-subtle rounded-xl p-4">
                        <div className="text-sm font-semibold text-c-text dark:text-white mb-2">
                          {t('valuation.sensitivity.tornadoTitle', 'Tornado (top drivers)')}
                        </div>
                        {Array.isArray(computed?.tornado) && computed.tornado.length ? (
                          <ul className="list-disc pl-5 text-xs text-c-text-secondary dark:text-c-text-secondary space-y-1">
                            {computed.tornado.slice(0, 8).map((d: any, idx: number) => (
                              <li key={idx}>
                                {String(d?.driver || 'Driver')}: {String(d?.swing ?? '—')}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <div className="text-sm text-c-text-muted dark:text-c-text-muted">—</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeStep === 'export' && (
                <div className="space-y-4">
                  <div className="text-xs text-c-text-muted dark:text-c-text-muted">
                    {t(
                      'valuation.export.approvalGate',
                      'Export requires APPROVED valuation and includes disclaimers.'
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      disabled={busy}
                      onClick={handleExportPptx}
                      className="px-3 py-2 rounded-lg text-sm bg-c-text text-c-bg hover:opacity-90 inline-flex items-center gap-2 disabled:opacity-60"
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download size={16} />}
                      {t('valuation.export.pptx', 'Export PPTX')}
                    </button>
                    {selectedId && (
                      <ExportButton
                        analysisId={selectedId}
                        analysisTitle={selected?.title || ''}
                        analysisType="valuation"
                        className="shrink-0"
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-c-surface border border-slate-200/60 dark:border-white/[0.03] dark:border-c-border-subtle rounded-xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-c-text dark:text-white">
                {t('valuation.create.title', 'New valuation')}
              </h2>
              <button
                onClick={() => setShowCreate(false)}
                className="text-c-text-secondary hover:text-c-text-secondary"
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
                className="w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface-raised text-c-text dark:text-white text-sm"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-c-text-muted mb-1 block">
                    {t('valuation.create.sourceType', 'Source type')}
                  </label>
                  <select
                    value={createSourceType}
                    onChange={(e) => {
                      setCreateSourceType(e.target.value as ValuationSourceType);
                      setCreateSourceId('');
                    }}
                    className="w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface-raised text-c-text dark:text-white text-sm"
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
                  <label className="text-xs text-c-text-muted mb-1 block">
                    {t('valuation.create.horizon', 'Horizon (years)')}
                  </label>
                  <input
                    type="number"
                    value={createHorizonYears}
                    onChange={(e) => setCreateHorizonYears(safeNumber(e.target.value, 5))}
                    className="w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface-raised text-c-text dark:text-white text-sm"
                  />
                </div>
              </div>
              {createSourceType === 'budget' && (
                <div>
                  <label className="text-xs text-c-text-muted mb-1 block">
                    {t('valuation.create.sourceLabel', 'Source')}
                  </label>
                  <select
                    value={createSourceId}
                    onChange={(e) => setCreateSourceId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-c-border-strong dark:border-c-border-strong bg-white dark:bg-c-surface-raised text-c-text dark:text-white text-sm"
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
                className="px-4 py-2 text-sm text-c-text-muted hover:text-c-text-secondary"
              >
                {t('valuation.create.cancel', 'Cancel')}
              </button>
              <button
                disabled={busy}
                onClick={handleCreate}
                className="px-4 py-2 bg-c-text text-c-bg hover:opacity-90 text-sm font-medium rounded-lg disabled:opacity-60"
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

      {candidateHandoffRecommendationId && (
        <FinanceCandidateHandoffModal
          variant="standalone"
          open
          onClose={() => setCandidateHandoffRecommendationId(null)}
          sourceType="finance_valuation_recommendation"
          sourceId={candidateHandoffRecommendationId}
          preview={() =>
            previewValuationRecommendationCandidateHandoff(candidateHandoffRecommendationId)
          }
          confirm={() =>
            confirmValuationRecommendationCandidateHandoff(candidateHandoffRecommendationId)
          }
          fetchHandoff={() =>
            getValuationRecommendationCandidateHandoff(candidateHandoffRecommendationId)
          }
          // No direct single-candidate deep link exists today (Initiatives'
          // "Kandydaci" tab is not URL-addressable — InitiativesHub doesn't
          // read a `tab`/`open` param for it), so this honestly returns null
          // rather than guessing a URL that wouldn't actually land on the
          // candidate — the toast below opens the hub instead.
          getReopenLink={() => null}
          title={t('valuation.advisory.candidateModalTitle', 'Wyślij jako kandydata na Initiative')}
          noticeText={t(
            'valuation.advisory.candidateModalBody',
            'Zostanie utworzony kandydat na Initiative — nie sama Initiative. Kandydata zaakceptujesz w zakładce „Kandydaci" w Initiatives.'
          )}
          confirmLabel={t('valuation.advisory.candidateModalConfirm', 'Wyślij')}
          cancelLabel={t('valuation.advisory.candidateModalCancel', 'Anuluj')}
          closeLabel={t('valuation.advisory.candidateModalClose', 'Zamknij')}
          checkingLabel={t(
            'valuation.advisory.candidateChecking',
            'Sprawdzanie kwalifikowalności…'
          )}
          fitScoreLabel={t('valuation.advisory.candidateFitScore', 'Dopasowanie')}
          previewErrorFallback={t(
            'valuation.advisory.candidatePreviewFailed',
            'Failed to check eligibility'
          )}
          confirmErrorFallback={t(
            'valuation.advisory.candidateHandoffFailed',
            'Failed to send candidate'
          )}
          onConfirmed={handleCandidateHandoffConfirmed}
        />
      )}
    </div>
  );
};

export default ValuationWorkspace;
