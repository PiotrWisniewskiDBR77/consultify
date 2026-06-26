/**
 * AIInsightsPanel — M15/W6 tasks 6.1–6.4 + 6.8 + domknięcie M15 (D5 + D11).
 * Renders: value narrative, counterfactual, KPI anomaly detection (D5),
 *          KPI trajectory forecast (D11) + heuristic RCA suggestion (D11).
 * Fetches from /results-extended/:projectId endpoints (narrative + counterfactual).
 * Forecast/RCA/Anomaly nie mają jeszcze osobnych endpointów — prezentowane jako
 * sekcje informacyjne premium-style (silniki istnieją po stronie serwera:
 * kpiAnomalyService / kpiForecastService / deviationRcaSuggestService).
 * Cały panel jest osadzony za flagą resultsFeatureFlags('aiInsights') w ResultsHub.
 */
import {
  AlertTriangle,
  Activity,
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
 * (kategoria przyczyny → akcja naprawcza → rola właściciela). Statyczny podgląd
 * heurystyki do czasu podpięcia endpointu RCA.
 */
const RCA_PLAYBOOK: Array<{
  key: string;
  catFallback: string;
  actionFallback: string;
  ownerFallback: string;
}> = [
  { key: 'dataQuality', catFallback: 'Jakość danych', actionFallback: 'Napraw źródło pomiaru', ownerFallback: 'Data Owner' },
  { key: 'adoption', catFallback: 'Adopcja', actionFallback: 'Wzmocnij komunikację/szkolenia', ownerFallback: 'Change Manager' },
  { key: 'scope', catFallback: 'Zakres', actionFallback: 'Rewaliduj zakres', ownerFallback: 'Initiative Owner' },
  { key: 'capacity', catFallback: 'Zasoby', actionFallback: 'Realokuj zasoby', ownerFallback: 'Resource Manager' },
  { key: 'measurement', catFallback: 'Pomiar', actionFallback: 'Zweryfikuj definicję KPI', ownerFallback: 'KPI Owner' },
  { key: 'external', catFallback: 'Zewnętrzne', actionFallback: 'Aktualizuj założenia', ownerFallback: 'Sponsor' },
];

function fmtPLN(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M PLN`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)} k PLN`;
  return `${v.toFixed(0)} PLN`;
}

/**
 * PremiumNote — wspólny „kafelek informacyjny" dla sekcji AI premium, których
 * pełny model jeszcze nie ma osobnego endpointu (prognoza / anomalie / RCA).
 * Spójny ze stylem istniejącej noty Forecast (dashed border, light/dark).
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
    <div className="text-xs text-slate-500 dark:text-slate-400 space-y-2">
      {children}
    </div>
  </section>
);

const AIInsightsPanel: React.FC<Props> = ({ projectId = 'all' }) => {
  const { t } = useTranslation();
  const [narrative, setNarrative] = useState<{ narrative: ValueNarrative; executiveSummary: string } | null>(null);
  const [counterfactual, setCounterfactual] = useState<CounterfactualResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      Api.get(`/results-extended/${projectId}/narrative`),
      Api.get(`/results-extended/${projectId}/counterfactual`),
    ]).then(([n, c]) => {
      if (n.status === 'fulfilled') setNarrative((n.value as any)?.data ?? n.value);
      if (c.status === 'fulfilled') setCounterfactual((c.value as any)?.data ?? c.value);
    }).finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div data-testid="ai-insights-loading" className="flex items-center justify-center py-12 text-slate-400 text-sm">
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
          {t('results.ai.narrative', 'Narracja wartości')}
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
                {nar.statusLabel.toLowerCase().includes('zagrożon') || nar.statusLabel.toLowerCase().includes('ryzyko')
                  ? <TrendingDown size={12} className="text-amber-500" />
                  : <TrendingUp size={12} className="text-emerald-500" />}
                {nar.statusLabel}
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-400 py-4 text-center">
            {t('results.ai.noNarrative', 'Brak danych do narracji — dodaj cele ROI dla inicjatyw.')}
          </div>
        )}
      </section>

      {/* Counterfactual (6.8) */}
      <section>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
          <AlertTriangle size={14} />
          {t('results.ai.counterfactual', 'Atrybucja — co bez inicjatywy?')}
        </h3>
        {counterfactual ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('results.ai.realized', 'Zrealizowane')}</div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {fmtPLN(counterfactual.totalRealized)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('results.ai.counterfactualProjected', 'Bez inicjatywy (proj.)')}</div>
              <div className="text-xl font-bold text-slate-600 dark:text-slate-300">
                {fmtPLN(counterfactual.counterfactualProjected)}
              </div>
            </div>
            <div className="rounded-xl border border-emerald-200 dark:border-emerald-700/50 bg-emerald-50 dark:bg-emerald-900/20 p-4">
              <div className="text-xs text-slate-500 dark:text-slate-400">{t('results.ai.attributableDelta', 'Atrybucja do inicjatywy')}</div>
              <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                {fmtPLN(counterfactual.attributable)}
              </div>
              <div className={`mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${CONFIDENCE_BADGE[counterfactual.confidenceLabel] ?? ''}`}>
                {t('results.ai.confidence', 'pewność')}: {t(`results.ai.confLevel.${counterfactual.confidenceLabel}`, counterfactual.confidenceLabel)}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-400 py-4 text-center">
            {t('results.ai.noCounterfactual', 'Brak historycznych pomiarów do analizy kontrfaktycznej.')}
          </div>
        )}
      </section>

      {/* D5 — Wykrywanie anomalii KPI (z-score + IQR) */}
      <PremiumNote
        icon={<Activity size={14} />}
        title={t('results.ai.anomalyTitle', 'Wykrywanie anomalii KPI')}
        premiumLabel={t('results.ai.premiumBadge', 'AI premium')}
      >
        <p>
          {t(
            'results.ai.anomalyCopy',
            'Automatyczne wykrywanie punktów odstających w szeregu pomiarów KPI — metodą z-score (|z| > 2) oraz IQR (poza Q1−1.5·IQR / Q3+1.5·IQR). Punkt wskazany przez obie metody lub przy |z| ≥ 3 oznaczany jest jako poważny (severe).',
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <RagPill status="amber" label={t('results.ai.anomalySevere', 'Poważne')} />
          <RagPill status="grey" label={t('results.ai.anomalyMild', 'Łagodne')} />
          <span className="text-[11px] text-slate-400">
            {t('results.ai.anomalyMinPoints', 'Wymaga min. 6 pomiarów na KPI')}
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          {t(
            'results.ai.anomalyServerNote',
            'Anomalie liczone po stronie serwera (silnik kpiAnomalyService) — wynik pojawi się tu po podpięciu endpointu pomiarów KPI.',
          )}
        </p>
      </PremiumNote>

      {/* D11 — Prognoza trajektorii KPI (regresja liniowa + alert wyprzedzający) */}
      <PremiumNote
        icon={<LineChart size={14} />}
        title={t('results.ai.forecastTitle', 'Prognoza trajektorii KPI')}
        premiumLabel={t('results.ai.premiumBadge', 'AI premium')}
      >
        <p>
          {t(
            'results.ai.forecastCopy',
            'Regresja liniowa (least squares) na historii pomiarów każdego KPI: prognoza wartości, szacowany termin osiągnięcia celu (ETA) oraz alert wyprzedzający, gdy trend nie trafia w cel przed deadline.',
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
            <TrendingUp size={12} />
            {t('results.ai.forecastOnTrack', 'Na trajektorii do celu')}
          </span>
          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px] font-medium">
            <TrendingDown size={12} />
            {t('results.ai.forecastAtRisk', 'Cel zagrożony')}
          </span>
          <span className="text-[11px] text-slate-400">
            {t('results.ai.forecastConfidence', 'Pewność: low / medium / high (z liczby pomiarów + dopasowania R²)')}
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          {t(
            'results.ai.forecastMinPoints',
            'Wymaga min. 6 pomiarów na KPI. Silnik kpiForecastService — dostępne po konfiguracji AI premium.',
          )}
        </p>
      </PremiumNote>

      {/* D11 — Sugestia RCA / akcji naprawczej (heurystyczny silnik) */}
      <PremiumNote
        icon={<Search size={14} />}
        title={t('results.ai.rcaTitle', 'Sugestia RCA / akcji naprawczej')}
        premiumLabel={t('results.ai.premiumBadge', 'AI premium')}
      >
        <p>
          {t(
            'results.ai.rcaCopy',
            'Dla każdego odchylenia KPI heurystyczny silnik (bez LLM, deterministyczny) generuje hipotezy przyczyn źródłowych na podstawie sygnałów: odchylenie, trend, adopcja, świeżość danych, zmiana zakresu, przeciążenie zasobów — i mapuje je na konkretne akcje naprawcze z właścicielem.',
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
            'Sugestie liczone po stronie serwera (silnik deviationRcaSuggestService) — pojawią się tu dla wykrytych odchyleń po podpięciu endpointu RCA.',
          )}
        </p>
      </PremiumNote>

    </div>
  );
};

export default AIInsightsPanel;
