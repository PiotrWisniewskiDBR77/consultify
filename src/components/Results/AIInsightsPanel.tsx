/**
 * AIInsightsPanel — M15/W6 tasks 6.1–6.4 + 6.8.
 * Renders: forecast alerts, RCA suggestions, value narrative, counterfactual.
 * Fetches from /results-extended/:projectId endpoints.
 * Behind flag resultsFeatureFlags('aiInsights').
 */
import { AlertTriangle, BrainCircuit, FileText, TrendingDown, TrendingUp } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

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

function fmtPLN(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} M PLN`;
  if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(0)} k PLN`;
  return `${v.toFixed(0)} PLN`;
}

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

      {/* Forecast note (6.1 — placeholder, full AI model in W6) */}
      <section className="rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] p-4 text-sm text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 mb-1 font-medium text-slate-600 dark:text-slate-300">
          <BrainCircuit size={14} />
          {t('results.ai.forecastNote', 'Prognoza trajektorii KPI (6.1 — AI premium)')}
        </div>
        <p className="text-xs">
          {t('results.ai.forecastNoteCopy', 'Automatyczna prognoza trendu dla każdego KPI + alert kiedy ryzyko nieosiągnięcia celu. Wymaga min. 6 pomiarów. Dostępna po konfiguracji AI premium.')}
        </p>
      </section>

    </div>
  );
};

export default AIInsightsPanel;
