import { AlertTriangle, ClipboardList, Target, TrendingUp } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import type { V8ResultsDashboardSnapshot } from '@/services/api/v8/results';

import type { FilterChip } from '../shared/ModuleHub/ActiveFilters';
import { buildKpiOverviewMetrics, type ResultsKPI } from './kpiDomain';

interface KpiOverviewViewProps {
  kpis: ResultsKPI[];
  governedSnapshot?: V8ResultsDashboardSnapshot | null;
  onOpenCatalog: (filters?: FilterChip[]) => void;
  onOpenQueue: (filters?: FilterChip[]) => void;
  onOpenScorecards: () => void;
  onOpenReports: () => void;
  onOpenKpi: (kpiId: string) => void;
}

interface CockpitCardProps {
  title: string;
  value: string | number;
  hint: string;
  accentClassName: string;
  onClick?: () => void;
}

const CockpitCard: React.FC<CockpitCardProps> = ({
  title,
  value,
  hint,
  accentClassName,
  onClick,
}) => {
  const Element = onClick ? 'button' : 'div';

  return (
    <Element
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-4 text-left transition-colors ${onClick ? 'hover:bg-white dark:hover:bg-white/[0.05]' : ''}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {title}
          </div>
          <div className={`mt-2 text-2xl font-semibold ${accentClassName}`}>{value}</div>
        </div>
        <div className="max-w-[180px] text-right text-xs text-slate-500 dark:text-slate-400">
          {hint}
        </div>
      </div>
    </Element>
  );
};

export const KpiOverviewView: React.FC<KpiOverviewViewProps> = ({
  kpis,
  governedSnapshot,
  onOpenCatalog,
  onOpenQueue,
  onOpenScorecards,
  onOpenReports,
  onOpenKpi,
}) => {
  const { t } = useTranslation();

  const metrics = useMemo(() => buildKpiOverviewMetrics(kpis), [kpis]);

  const spotlight = useMemo(
    () =>
      [...kpis]
        .sort((a, b) => {
          const rank = (kpi: ResultsKPI) => {
            if (kpi.openDeviationCase?.severity === 'RED') return 4;
            if (kpi.status === 'below') return 3;
            if (kpi.needsEntry) return 2;
            if (kpi.status === 'no-data') return 1;
            return 0;
          };
          return rank(b) - rank(a);
        })
        .slice(0, 5),
    [kpis]
  );

  const reviewArtifacts = governedSnapshot?.recentReviewPacks || [];

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-gradient-to-br from-white to-slate-50 dark:from-navy-900 dark:to-navy-950 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {t('results.kpi.overview.eyebrow', 'KPI overview')}
            </div>
            <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              {t(
                'results.kpi.overview.title',
                'Closed-loop cockpit for signal, report, reconciliation, and next action'
              )}
            </h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
              {t(
                'results.kpi.overview.copy',
                'Use this surface to triage stale signals, inspect degraded KPIs, move into scorecards, and close the loop with reconciliation and next actions.'
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                onOpenQueue([
                  {
                    id: 'queue:review',
                    column: 'queue',
                    value: 'requires-review',
                    label: 'Requires review',
                  },
                ])
              }
              className="inline-flex items-center gap-2 rounded-full bg-navy-900 dark:bg-[#F4F7FB] px-4 py-2 text-sm font-medium text-white dark:text-navy-950 hover:bg-navy-800 dark:hover:bg-[#DDE5EF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <AlertTriangle size={16} />
              {t('results.kpi.overview.cta.review', 'Open data / signals')}
            </button>
            <button
              type="button"
              onClick={onOpenScorecards}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200/70 dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              <ClipboardList size={16} />
              {t('results.kpi.overview.cta.scorecards', 'Open scorecards')}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CockpitCard
          title={t('results.kpi.overview.cards.total', 'Governed KPIs')}
          value={governedSnapshot?.kpiScorecard.totalKpis ?? metrics.total}
          hint={t(
            'results.kpi.overview.cards.totalHint',
            'All KPI definitions currently in runtime'
          )}
          accentClassName="text-slate-900 dark:text-white"
          onClick={() => onOpenCatalog()}
        />
        <CockpitCard
          title={t('results.kpi.overview.cards.deviation', 'Needs operator attention')}
          value={metrics.below + metrics.needsEntry}
          hint={t(
            'results.kpi.overview.cards.deviationHint',
            'Below target or missing fresh signal'
          )}
          accentClassName="text-amber-500"
          onClick={() =>
            onOpenQueue([
              {
                id: 'queue:review',
                column: 'queue',
                value: 'requires-review',
                label: 'Requires review',
              },
            ])
          }
        />
        <CockpitCard
          title={t('results.kpi.overview.cards.reconciliation', 'Unresolved reconciliation')}
          value={
            governedSnapshot?.reconciliationHealth.unresolvedCount ?? metrics.openDeviationCases
          }
          hint={t(
            'results.kpi.overview.cards.reconciliationHint',
            'Cases that still need evidence or closure'
          )}
          accentClassName="text-blue-500"
          onClick={() =>
            onOpenQueue([
              {
                id: 'queue:discrepancy',
                column: 'queue',
                value: 'discrepancy',
                label: 'Discrepancy',
              },
            ])
          }
        />
        <CockpitCard
          title={t('results.kpi.overview.cards.onTarget', 'On target')}
          value={metrics.onTarget}
          hint={t(
            'results.kpi.overview.cards.onTargetHint',
            'Signals that currently meet their target'
          )}
          accentClassName="text-emerald-500"
          onClick={() =>
            onOpenCatalog([
              { id: 'status:on-target', column: 'status', value: 'on-target', label: 'On target' },
            ])
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {t('results.kpi.overview.spotlight', 'Signal spotlight')}
              </h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {t(
                  'results.kpi.overview.spotlightHint',
                  'Priority signal list ordered by deviation severity, stale data, and reporting readiness.'
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenQueue()}
              className="text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('common.open', 'Open')}
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {spotlight.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('results.kpi.overview.empty', 'No KPI signals available yet.')}
              </div>
            ) : (
              spotlight.map((kpi) => (
                <button
                  key={kpi.id}
                  type="button"
                  onClick={() => onOpenKpi(kpi.id)}
                  className="w-full rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] px-4 py-3 text-left hover:bg-white dark:hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                        {kpi.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{kpi.initiativeName || t('common.noData', 'No data')}</span>
                        <span>·</span>
                        <span>
                          {t('results.columns.current', 'Current')}: {kpi.latestValue ?? '—'}
                        </span>
                        <span>·</span>
                        <span>
                          {t('results.columns.target', 'Target')}: {kpi.targetValue ?? '—'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {kpi.needsEntry ? (
                        <span className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-300">
                          {t('results.filters.needsEntry', 'Needs entry')}
                        </span>
                      ) : null}
                      {kpi.openDeviationCase ? (
                        <span className="inline-flex rounded-full bg-danger-500/10 px-2 py-0.5 text-[11px] font-medium text-danger-500">
                          {kpi.openDeviationCase.severity}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <TrendingUp size={16} className="text-emerald-500" />
              {t('results.kpi.overview.health', 'Signal health')}
            </div>
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() =>
                  onOpenCatalog([
                    { id: 'status:below', column: 'status', value: 'below', label: 'Below target' },
                  ])
                }
                className="flex w-full items-center justify-between rounded-xl border border-slate-200/70 dark:border-white/[0.06] px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <span>{t('results.kpi.overview.healthBelow', 'Below target')}</span>
                <span className="font-semibold text-danger-500">{metrics.below}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenCatalog([
                    { id: 'status:no-data', column: 'status', value: 'no-data', label: 'No data' },
                  ])
                }
                className="flex w-full items-center justify-between rounded-xl border border-slate-200/70 dark:border-white/[0.06] px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <span>{t('results.kpi.overview.healthNoData', 'No fresh signal')}</span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {metrics.noData}
                </span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onOpenQueue([
                    {
                      id: 'queue:needs-entry',
                      column: 'queue',
                      value: 'needs-entry',
                      label: 'Needs entry',
                    },
                  ])
                }
                className="flex w-full items-center justify-between rounded-xl border border-slate-200/70 dark:border-white/[0.06] px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <span>{t('results.kpi.overview.healthNeedsEntry', 'Needs entry')}</span>
                <span className="font-semibold text-amber-500">{metrics.needsEntry}</span>
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Target size={16} className="text-primary-500" />
              {t('results.kpi.overview.reviewArtifacts', 'Review artifacts')}
            </div>
            <div className="mt-4 space-y-2">
              {reviewArtifacts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] px-3 py-6 text-sm text-slate-500 dark:text-slate-400">
                  {t(
                    'results.kpi.overview.reviewArtifactsEmpty',
                    'No recent KPI review packs yet. Create a scorecard to close the loop.'
                  )}
                </div>
              ) : (
                reviewArtifacts.slice(0, 3).map((pack) => (
                  <button
                    key={pack.packId}
                    type="button"
                    onClick={onOpenReports}
                    className="flex w-full items-center justify-between rounded-xl border border-slate-200/70 dark:border-white/[0.06] px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {pack.reviewPeriod}
                      </div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {pack.kpiSummaryCount} KPI · {pack.deviationHighlightCount} deviations
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-300">
                      {pack.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KpiOverviewView;
