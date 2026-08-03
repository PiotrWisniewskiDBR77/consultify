/**
 * PortfolioInsightsPanel — M15/W3-W4+W6 tasks 2.6, 3.2, 3.3, 4.3, 4.4, 6.5, 6.6.
 * Renders: manager signals (3.2), reallocation (3.3), run-rate (4.3),
 *           scenarios+IRR (6.5), finance link (6.6), board-pack CTA (4.4).
 * Behind flags (shown in ROI-Analysis tab alongside existing views).
 */
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Clock,
  DollarSign,
  ExternalLink,
  Filter,
  MoveRight,
  TrendingUp,
  Zap,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '@/services/api';

import { FunnelStage } from './ResultsUIPrimitives';

interface BenefitSignal {
  id?: string;
  name?: string;
  title?: string;
  type: string;
  severity: 'warning' | 'critical';
  valueAtStake?: number;
  suggestedAction?: string;
  realizationPct?: number;
  confidence?: number;
}

interface SignalsData {
  signals: BenefitSignal[];
  summary: { total: number; critical: number; warning: number };
}

interface ReallocationMove {
  fromId: string;
  fromName?: string;
  toId: string;
  toName?: string;
  fteSuggested: number;
  rationale: string;
}

interface RunRateData {
  bridge: {
    runRate: number;
    projectedInYear: number;
    alreadyRealized: number;
  };
  timing: {
    totalRunRate: number;
    totalRealized: number;
    aheadOfPlanCount?: number;
    behindPlanCount?: number;
  };
  periodMonths?: number;
  periodMonthsAssumed?: boolean;
}

type FunnelStageKey = 'ideas' | 'validated' | 'inflight' | 'realized';

interface FunnelStageAggregate {
  stage: FunnelStageKey;
  count: number;
  value: number;
  riskAdjustedValue: number;
}

interface FunnelConversionStep {
  from: FunnelStageKey;
  to: FunnelStageKey;
  conversionPct: number;
  leakageValue: number;
}

interface FunnelData {
  stages: FunnelStageAggregate[];
  conversion: FunnelConversionStep[];
  valueAtRisk: { atRiskValue: number; atRiskCount: number };
  total: number;
}

interface ScenarioResult {
  label: string;
  npv: number;
  irr?: number | null;
  paybackMonths?: number | null;
}

interface ScenariosData {
  scenarios: ScenarioResult[];
  irr: number | null;
  paybackPeriod: number | null;
  initiativeCount: number;
}

interface FinanceLinkData {
  aggregate: { totalPositiveImpact: number; totalNegativeImpact: number; netImpact: number } | null;
  mappingCount: number;
}

function fmtPLN(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `€${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `€${(v / 1_000).toFixed(0)}k`;
  return `€${v.toFixed(0)}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '–';
  return `${(v * 100).toFixed(1)}%`;
}

function stageLabel(stage: FunnelStageKey, t: (k: string, d: string) => string): string {
  switch (stage) {
    case 'ideas':
      return t('results.portfolio.funnelStageIdeas', 'Ideas');
    case 'validated':
      return t('results.portfolio.funnelStageValidated', 'Validated');
    case 'inflight':
      return t('results.portfolio.funnelStageInflight', 'In progress');
    case 'realized':
      return t('results.portfolio.funnelStageRealized', 'Realized');
    default:
      return stage;
  }
}

interface Props {
  projectId?: string;
}

const PortfolioInsightsPanel: React.FC<Props> = ({ projectId = 'all' }) => {
  const { t } = useTranslation();
  const [signals, setSignals] = useState<SignalsData | null>(null);
  const [realloc, setRealloc] = useState<{
    moves: ReallocationMove[];
    summary: any;
    capacityAssumed?: boolean;
  } | null>(null);
  const [runRate, setRunRate] = useState<RunRateData | null>(null);
  const [scenarios, setScenarios] = useState<ScenariosData | null>(null);
  const [financeLink, setFinanceLink] = useState<FinanceLinkData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      Api.get(`/results-extended/${projectId}/signals`),
      Api.get(`/results-extended/${projectId}/reallocation`),
      Api.get(`/results-extended/${projectId}/run-rate`),
      Api.get(`/results-extended/${projectId}/scenarios`),
      Api.get(`/results-extended/${projectId}/finance-link`),
      Api.get(`/results-extended/${projectId}/funnel`),
    ])
      .then(([s, r, rr, sc, fl, fn]) => {
        if (s.status === 'fulfilled') setSignals((s.value as any)?.data ?? s.value);
        if (r.status === 'fulfilled') setRealloc((r.value as any)?.data ?? r.value);
        if (rr.status === 'fulfilled') setRunRate((rr.value as any)?.data ?? rr.value);
        if (sc.status === 'fulfilled') setScenarios((sc.value as any)?.data ?? sc.value);
        if (fl.status === 'fulfilled') setFinanceLink((fl.value as any)?.data ?? fl.value);
        if (fn.status === 'fulfilled') setFunnel((fn.value as any)?.data ?? fn.value);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div
        data-testid="portfolio-insights-loading"
        className="flex items-center justify-center py-12 text-slate-400 text-sm"
      >
        <BarChart3 size={16} className="mr-2 animate-pulse" />
        {t('common.loading', 'Loading...')}
      </div>
    );
  }

  return (
    <div data-testid="portfolio-insights-panel" className="space-y-6">
      {/* Value funnel (D6 — portfolio value funnel) */}
      {funnel?.stages && funnel.stages.length > 0 && (funnel.total ?? 0) > 0 && (
        <section data-testid="portfolio-funnel">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Filter size={14} />
            {t('results.portfolio.funnel', 'Portfolio value funnel')}
            <span className="text-xs font-normal text-slate-400">
              ({funnel.total} {t('results.portfolio.funnelInitiatives', 'initiatives')})
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {funnel.stages.map((st, i) => (
              <FunnelStage
                key={st.stage}
                label={stageLabel(st.stage, t)}
                count={st.count}
                value={st.value}
                isActive={i === funnel.stages.length - 1}
              />
            ))}
          </div>
          {/* risk-adjusted value per stage */}
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {funnel.stages.map((st) => (
              <div key={`ra-${st.stage}`} className="text-center text-xs text-slate-400">
                {t('results.portfolio.funnelRiskAdjusted', 'risk-adjusted')}:{' '}
                {fmtPLN(st.riskAdjustedValue)}
              </div>
            ))}
          </div>
          {/* conversion + leakage between adjacent stages */}
          {funnel.conversion && funnel.conversion.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              {funnel.conversion.map((c) => (
                <span key={`${c.from}-${c.to}`} className="inline-flex items-center gap-1.5">
                  <span className="text-slate-400">{stageLabel(c.from, t)}</span>
                  <ArrowRight size={11} className="text-primary-500 shrink-0" />
                  <span className="text-slate-400">{stageLabel(c.to, t)}</span>
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {Math.round(c.conversionPct)}%
                  </span>
                  {c.leakageValue > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      −{fmtPLN(c.leakageValue)} {t('results.portfolio.funnelLeakage', 'leakage')}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}
          {/* value at risk */}
          {funnel.valueAtRisk && funnel.valueAtRisk.atRiskCount > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm">
              <AlertTriangle size={14} className="text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="text-slate-700 dark:text-slate-200">
                {t('results.portfolio.funnelValueAtRisk', 'Value at risk')}:{' '}
                <span className="font-semibold">{fmtPLN(funnel.valueAtRisk.atRiskValue)}</span> (
                {funnel.valueAtRisk.atRiskCount}{' '}
                {t('results.portfolio.funnelInitiatives', 'initiatives')})
              </span>
            </div>
          )}
        </section>
      )}

      {/* Manager signals (3.2 — M15→M14 loop) */}
      {signals && signals.summary.total > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Zap size={14} />
            {t('results.portfolio.signals', 'Signals to M14 Implementation')}
            {signals.summary.critical > 0 && (
              <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                {signals.summary.critical} critical
              </span>
            )}
            <a
              href="/execution"
              className="ml-auto flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline shrink-0"
              title={t('results.portfolio.goToM14', 'Go to M14 Implementation')}
            >
              <ExternalLink size={11} />
              M14
            </a>
          </h3>
          <div className="space-y-2">
            {signals.signals.slice(0, 6).map((sig, i) => (
              <div
                key={sig.id ?? sig.title ?? i}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                  sig.severity === 'critical'
                    ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                    : 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20'
                }`}
              >
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${sig.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`}
                />
                <div className="flex-1 min-w-0">
                  <span className="font-medium truncate block">
                    {sig.name ?? sig.title ?? sig.type}
                  </span>
                </div>
                {sig.realizationPct != null && (
                  <div className="text-xs shrink-0 text-slate-500">
                    {Math.round(sig.realizationPct * 100)}% realized
                  </div>
                )}
              </div>
            ))}
            {signals.signals.length > 6 && (
              <div className="text-xs text-slate-400 text-center">
                +{signals.signals.length - 6} more signals
              </div>
            )}
          </div>
        </section>
      )}

      {/* Run-rate (4.3) */}
      {runRate?.bridge && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Clock size={14} />
            {t('results.portfolio.runRate', 'Run-rate vs in-year')}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              {
                label: t('results.portfolio.annualizedRunRate', 'Annualized run-rate'),
                value: fmtPLN(runRate.bridge.runRate),
              },
              {
                label: t('results.portfolio.projectedFullYear', 'Projected to year-end'),
                value: fmtPLN(runRate.bridge.projectedInYear),
              },
              {
                label: t('results.portfolio.alreadyRealized', 'Realized'),
                value: fmtPLN(runRate.bridge.alreadyRealized),
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4"
              >
                <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100 mt-1">
                  {s.value}
                </div>
              </div>
            ))}
          </div>
          {runRate.timing && (
            <div className="mt-2 text-xs text-slate-400 flex flex-wrap gap-4">
              <span>Run-rate: {fmtPLN(runRate.timing.totalRunRate)}</span>
              <span>Realized: {fmtPLN(runRate.timing.totalRealized)}</span>
              {runRate.timing.aheadOfPlanCount != null && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  {runRate.timing.aheadOfPlanCount} initiatives ahead of plan
                </span>
              )}
              {runRate.timing.behindPlanCount != null && runRate.timing.behindPlanCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {runRate.timing.behindPlanCount} initiatives behind plan
                </span>
              )}
            </div>
          )}
          {/* D8 — assumption flag for measurement window */}
          {runRate.periodMonths != null && (
            <div className="mt-1.5 text-xs text-slate-400 italic">
              {runRate.periodMonthsAssumed
                ? t('results.portfolio.runRateAssumed', 'assumption: 6-month measurement window')
                : t(
                    'results.portfolio.runRateMeasured',
                    'measurement window: {{months}} mo. (from data)'
                  ).replace('{{months}}', String(runRate.periodMonths))}
            </div>
          )}
        </section>
      )}

      {/* Reallocation (3.3) */}
      {realloc && (realloc.moves ?? []).length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <MoveRight size={14} />
            {t('results.portfolio.reallocation', 'Recommended resource shifts')}
          </h3>
          <div className="space-y-2">
            {(realloc.moves ?? []).slice(0, 4).map((m, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] px-3 py-2.5 text-sm"
              >
                <span
                  className="text-slate-500 truncate max-w-[160px]"
                  title={m.fromName ?? m.fromId}
                >
                  {m.fromName ?? m.fromId.slice(0, 12)}
                </span>
                <ArrowRight size={14} className="text-primary-500 shrink-0" />
                <span className="font-medium truncate max-w-[160px]" title={m.toName ?? m.toId}>
                  {m.toName ?? m.toId.slice(0, 12)}
                </span>
                <span className="ml-auto text-xs text-slate-400 shrink-0">
                  {m.fteSuggested} FTE
                </span>
              </div>
            ))}
          </div>
          {/* D8 — capacity assumption flag */}
          {realloc.capacityAssumed && (
            <div className="mt-1.5 text-xs text-slate-400 italic">
              {t(
                'results.portfolio.reallocCapacityAssumed',
                'FTE capacity = assumption (no staffing data)'
              )}
            </div>
          )}
        </section>
      )}

      {/* Scenarios (6.5) */}
      {scenarios && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <TrendingUp size={14} />
            {t('results.portfolio.scenarios', 'Scenarios + IRR')}
            <span className="text-xs font-normal text-slate-400">
              ({scenarios.initiativeCount} initiatives)
            </span>
          </h3>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-white/[0.08] text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="pb-2 pr-4">{t('results.portfolio.scenario', 'Scenario')}</th>
                  <th className="pb-2 pr-4">NPV</th>
                  <th className="pb-2 pr-4">IRR</th>
                  <th className="pb-2">Payback</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.scenarios.map((sc, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-white/[0.04]">
                    <td className="py-2 pr-4 font-medium">{sc.label}</td>
                    <td className="py-2 pr-4">{fmtPLN(sc.npv)}</td>
                    <td className="py-2 pr-4">{fmtPct(sc.irr)}</td>
                    <td className="py-2 text-slate-400">
                      {sc.paybackMonths != null ? `${sc.paybackMonths.toFixed(1)} yrs` : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {scenarios.irr != null && (
            <div className="mt-2 text-xs text-slate-400">
              Base IRR:{' '}
              <span className="font-medium text-slate-600 dark:text-slate-300">
                {fmtPct(scenarios.irr)}
              </span>
              {scenarios.paybackPeriod != null && (
                <>
                  {' '}
                  · Payback:{' '}
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {scenarios.paybackPeriod.toFixed(1)} yrs
                  </span>
                </>
              )}
            </div>
          )}
          {/* D8 — derived-figures assumption note */}
          <div className="mt-1.5 text-xs text-slate-400 italic">
            {t(
              'results.portfolio.scenariosAssumptionNote',
              'IRR / cashflow — v1 model and assumptions'
            )}
          </div>
        </section>
      )}

      {/* Finance link (6.6) */}
      {financeLink && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <DollarSign size={14} />
            {t('results.portfolio.financeLink', 'Link to Finance (M16)')}
          </h3>
          {financeLink.mappingCount === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] p-4 text-sm text-slate-400 text-center">
              {t(
                'results.portfolio.noFinanceLink',
                'No KPI→Finance mappings. Configure them in the Finance module (M16) — kpi_financial_mappings table.'
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {financeLink.aggregate &&
                [
                  {
                    label: t('results.portfolio.positiveImpact', 'Positive impact'),
                    value: fmtPLN(financeLink.aggregate.totalPositiveImpact),
                    color: 'text-emerald-600 dark:text-emerald-400',
                  },
                  {
                    label: t('results.portfolio.negativeImpact', 'Negative impact'),
                    value: fmtPLN(financeLink.aggregate.totalNegativeImpact),
                    color: 'text-red-600 dark:text-red-400',
                  },
                  {
                    label: t('results.portfolio.netImpact', 'Net impact'),
                    value: fmtPLN(financeLink.aggregate.netImpact),
                    color: 'text-primary-600 dark:text-primary-400 font-bold',
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-white/[0.04] p-4"
                  >
                    <div className="text-xs text-slate-500 dark:text-slate-400">{s.label}</div>
                    <div className={`text-lg font-semibold mt-1 ${s.color}`}>{s.value}</div>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* Board-pack CTA (4.4) */}
      <section className="rounded-xl border border-dashed border-primary-200 dark:border-primary-800/40 p-4">
        <div className="flex items-center gap-3">
          <div className="text-primary-500 dark:text-primary-400">
            <BarChart3 size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {t('results.portfolio.boardPack', 'Board-pack / Auto value narrative')}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t(
                'results.portfolio.boardPackDesc',
                'Export a PDF report / deck / table via the M17–M20 generators. Available after configuring Deliverables.'
              )}
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.05] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            onClick={() => window.open('/outputs', '_blank')}
          >
            {t('results.portfolio.boardPackGo', 'Go to Outputs →')}
          </button>
        </div>
      </section>
    </div>
  );
};

export default PortfolioInsightsPanel;
