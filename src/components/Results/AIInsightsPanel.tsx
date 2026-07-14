/**
 * AIInsightsPanel — M15/W6 tasks 6.1–6.4 + 6.8 + M15 closure (D5 + D11).
 * Renders: value narrative, counterfactual, KPI anomaly detection (D5),
 *          KPI trajectory forecast (D11) + heuristic RCA suggestion (D11).
 * Fetches from /results-extended/:projectId endpoints (narrative + counterfactual).
 * Forecast/RCA/Anomaly do not have their own endpoints yet — presented as
 * premium-style informational sections (the engines exist server-side:
 * kpiAnomalyService / kpiForecastService / deviationRcaSuggestService).
 * The whole panel sits behind the resultsFeatureFlags('aiInsights') flag in ResultsHub.
 */
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  FileText,
  LineChart,
  Search,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { RagPill } from './ResultsUIPrimitives';

interface ValueNarrative {
  executiveSummary: string;
  headline: string;
  bodySentences: string[];
  statusLabel: string;
}

interface CounterfactualResult {
  attributable: number;
  confidenceLabel: 'low' | 'medium' | 'high';
  totalTarget: number;
  totalRealized: number;
  counterfactualProjected: number;
}

interface Props {
  projectId?: string;
}

const CONFIDENCE_BADGE: Record<string, string> = {
  low: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  medium: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  high: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300',
};

/**
 * RCA playbook — odzwierciedla CATEGORY_ACTION_MAP z deviationRcaSuggestService
 * (cause category → corrective action → owner role). A static preview of the
 * heuristic until the RCA endpoint is connected.
 */
const RCA_PLAYBOOK: Array<{
  key: string;
  catFallback: string;
  actionFallback: string;
  ownerFallback: string;
}> = [
  {
    key: 'dataQuality',
    catFallback: 'Data quality',
    actionFallback: 'Fix the measurement source',
    ownerFallback: 'Data Owner',
  },
  {
    key: 'adoption',
    catFallback: 'Adoption',
    actionFallback: 'Strengthen communication/training',
    ownerFallback: 'Change Manager',
  },
  {
    key: 'scope',
    catFallback: 'Scope',
    actionFallback: 'Revalidate scope',
    ownerFallback: 'Initiative Owner',
  },
  {
    key: 'capacity',
    catFallback: 'Resources',
    actionFallback: 'Reallocate resources',
    ownerFallback: 'Resource Manager',
  },
  {
    key: 'measurement',
    catFallback: 'Measurement',
    actionFallback: 'Verify the KPI definition',
    ownerFallback: 'KPI Owner',
  },
  {
    key: 'external',
    catFallback: 'External',
    actionFallback: 'Update assumptions',
    ownerFallback: 'Sponsor',
  },
];

function fmtPLN(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}k`;
  return `€${v.toFixed(0)}`;
}

/**
 * PremiumNote — a shared "info tile" for premium AI sections whose full model
 * does not have its own endpoint yet (forecast / anomalies / RCA).
 * Consistent with the existing Forecast note style (dashed border, light/dark).
 */
const PremiumNote: React.FC<{
  icon: React.ReactNode;
  title: string;
  premiumLabel: string;
  children: React.ReactNode;
}> = ({ icon, title, premiumLabel, children }) => (
  <section className="rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] p-4">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-slate-500 dark:text-slate-400">{icon}</span>
      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</span>
      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-50 dark:bg-primary-900/20 px-2 py-0.5 text-[11px] font-medium text-primary-600 dark:text-primary-300">
        <BrainCircuit size={11} />
        {premiumLabel}
      </span>
    </div>
    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2">{children}</div>
  </section>
);

const AIInsightsPanel: React.FC<Props> = ({ projectId = 'all' }) => {
  const { t } = useTranslation();
  const [narrative, setNarrative] = useState<{
    narrative: ValueNarrative;
    executiveSummary: string;
  } | null>(null);
  const [counterfactual, setCounterfactual] = useState<CounterfactualResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      Api.get(`/results-extended/${projectId}/narrative`),
      Api.get(`/results-extended/${projectId}/counterfactual`),
    ])
      .then(([n, c]) => {
        if (n.status === 'fulfilled') setNarrative((n.value as any)?.data ?? n.value);
        if (c.status === 'fulfilled') setCounterfactual((c.value as any)?.data ?? c.value);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div
        data-testid="ai-insights-loading"
        className="flex items-center justify-center py-12 text-slate-400 text-sm"
      >
        <BrainCircuit size={16} className="mr-2 animate-pulse" />
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

  const nar = narrative?.narrative;
  const execSummary = narrative?.executiveSummary;

  return (
    <div data-testid="ai-insights-panel" className="space-y-6">
      {/* Executive narrative (6.3) */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <FileText size={14} />
          {t('results.ai.narrative', 'Value narrative')}
        </h3>
        {nar ? (
          <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-5 space-y-3">
            {nar.headline && (
              <div className="text-base font-semibold text-slate-800 dark:text-slate-100">
                {nar.headline}
              </div>
            )}
            {execSummary && (
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {execSummary}
              </p>
            )}
            {nar.bodySentences?.length > 0 && (
              <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-1 pl-4 list-disc">
                {nar.bodySentences.slice(0, 4).map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            )}
            {nar.statusLabel && (
              <div className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 bg-slate-100 dark:bg-white/[0.06] text-xs font-medium text-slate-600 dark:text-slate-300">
                {nar.statusLabel.toLowerCase().includes('zagrożon') ||
                nar.statusLabel.toLowerCase().includes('ryzyko') ||
                nar.statusLabel.toLowerCase().includes('at risk') ||
                nar.statusLabel.toLowerCase().includes('risk') ? (
                  <TrendingDown size={12} className="text-amber-500" />
                ) : (
                  <TrendingUp size={12} className="text-emerald-500" />
                )}
                {nar.statusLabel}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-400 py-4 text-center">
            {t(
              'results.ai.noNarrative',
              'No data for the narrative — add ROI targets for initiatives.'
            )}
          </div>
        )}
      </section>

      {/* Counterfactual (6.8) */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <AlertTriangle size={14} />
          {t('results.ai.counterfactual', 'Attribution — what happens without the initiative?')}
        </h3>
        {counterfactual ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('results.ai.realized', 'Realized')}
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {fmtPLN(counterfactual.totalRealized)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('results.ai.counterfactualProjected', 'Without the initiative (proj.)')}
              </div>
              <div className="text-xl font-bold text-slate-600 dark:text-slate-300">
                {fmtPLN(counterfactual.counterfactualProjected)}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/20 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t('results.ai.attributableDelta', 'Attributable to the initiative')}
              </div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {fmtPLN(counterfactual.attributable)}
              </div>
              <div
                className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_BADGE[counterfactual.confidenceLabel] ?? ''}`}
              >
                {t('results.ai.confidence', 'confidence')}:{' '}
                {t(
                  `results.ai.confLevel.${counterfactual.confidenceLabel}`,
                  counterfactual.confidenceLabel
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400 py-4 text-center">
            {t(
              'results.ai.noCounterfactual',
              'No historical measurements for counterfactual analysis.'
            )}
          </div>
        )}
      </section>

      {/* D5 — KPI anomaly detection (z-score + IQR) */}
      <PremiumNote
        icon={<Activity size={14} />}
        title={t('results.ai.anomalyTitle', 'KPI anomaly detection')}
        premiumLabel={t('results.ai.premiumBadge', 'AI premium')}
      >
        <p>
          {t(
            'results.ai.anomalyCopy',
            'Automatic detection of outliers in the KPI measurement series — using z-score (|z| > 2) and IQR (outside Q1−1.5·IQR / Q3+1.5·IQR). A point flagged by both methods or at |z| ≥ 3 is marked as severe.'
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <RagPill status="amber" label={t('results.ai.anomalySevere', 'Severe')} />
          <RagPill status="grey" label={t('results.ai.anomalyMild', 'Mild')} />
          <span className="text-[11px] text-slate-400">
            {t('results.ai.anomalyMinPoints', 'Requires min. 6 measurements per KPI')}
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          {t(
            'results.ai.anomalyServerNote',
            'Anomalies are computed server-side (kpiAnomalyService engine) — results will appear here once the KPI measurements endpoint is connected.'
          )}
        </p>
      </PremiumNote>

      {/* D11 — KPI trajectory forecast (linear regression + early-warning alert) */}
      <PremiumNote
        icon={<LineChart size={14} />}
        title={t('results.ai.forecastTitle', 'KPI trajectory forecast')}
        premiumLabel={t('results.ai.premiumBadge', 'AI premium')}
      >
        <p>
          {t(
            'results.ai.forecastCopy',
            'Linear regression (least squares) on each KPI measurement history: value forecast, estimated time to reach the target (ETA), and an early-warning alert when the trend misses the target before the deadline.'
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
            <TrendingUp size={12} />
            {t('results.ai.forecastOnTrack', 'On track to target')}
          </span>
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
            <TrendingDown size={12} />
            {t('results.ai.forecastAtRisk', 'Target at risk')}
          </span>
          <span className="text-[11px] text-slate-400">
            {t(
              'results.ai.forecastConfidence',
              'Confidence: low / medium / high (from the number of measurements + R² fit)'
            )}
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          {t(
            'results.ai.forecastMinPoints',
            'Requires min. 6 measurements per KPI. kpiForecastService engine — available after configuring AI premium.'
          )}
        </p>
      </PremiumNote>

      {/* D11 — RCA / corrective action suggestion (heuristic engine) */}
      <PremiumNote
        icon={<Search size={14} />}
        title={t('results.ai.rcaTitle', 'RCA / corrective action suggestion')}
        premiumLabel={t('results.ai.premiumBadge', 'AI premium')}
      >
        <p>
          {t(
            'results.ai.rcaCopy',
            'For each KPI deviation, a heuristic engine (no LLM, deterministic) generates root-cause hypotheses based on signals: deviation, trend, adoption, data freshness, scope change, resource overload — and maps them to concrete corrective actions with an owner.'
          )}
        </p>
        <ul className="space-y-1.5 pt-1">
          {RCA_PLAYBOOK.map((row) => (
            <li key={row.key} className="flex items-center gap-2">
              <span className="inline-flex shrink-0 items-center rounded-md bg-slate-100 dark:bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-300">
                {t(`results.ai.rcaCat.${row.key}`, row.catFallback)}
              </span>
              <span className="text-slate-600 dark:text-slate-300 text-[12px]">
                {t(`results.ai.rcaAction.${row.key}`, row.actionFallback)}
              </span>
              <span className="ml-auto text-[10px] text-slate-400 shrink-0">
                {t(`results.ai.rcaOwner.${row.key}`, row.ownerFallback)}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-400">
          {t(
            'results.ai.rcaServerNote',
            'Suggestions are computed server-side (deviationRcaSuggestService engine) — they will appear here for detected deviations once the RCA endpoint is connected.'
          )}
        </p>
      </PremiumNote>
    </div>
  );
};

export default AIInsightsPanel;
