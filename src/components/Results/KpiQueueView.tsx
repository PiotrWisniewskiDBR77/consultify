import { AlertTriangle, Clock3, ExternalLink, ListTodo, ShieldAlert } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { buildKpiQueueGroups, type ResultsKPI } from './kpiDomain';

interface KpiQueueViewProps {
  kpis: ResultsKPI[];
  onOpenKpi: (kpiId: string) => void;
}

interface QueueLaneConfig {
  id: keyof ReturnType<typeof buildKpiQueueGroups>;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  accentClassName: string;
}

export const KpiQueueView: React.FC<KpiQueueViewProps> = ({ kpis, onOpenKpi }) => {
  const { t } = useTranslation();

  const queueGroups = useMemo(() => buildKpiQueueGroups(kpis), [kpis]);

  const lanes: QueueLaneConfig[] = [
    {
      id: 'needsEntry',
      title: t('results.kpi.queue.needsEntry', 'Needs entry'),
      subtitle: t('results.kpi.queue.needsEntryHint', 'Signals that are stale or missing fresh data'),
      icon: <Clock3 size={16} />,
      accentClassName: 'text-amber-500',
    },
    {
      id: 'belowTarget',
      title: t('results.kpi.queue.belowTarget', 'Below target'),
      subtitle: t('results.kpi.queue.belowTargetHint', 'KPIs under target and ready for investigation'),
      icon: <AlertTriangle size={16} />,
      accentClassName: 'text-red-500',
    },
    {
      id: 'discrepancy',
      title: t('results.kpi.queue.discrepancy', 'Discrepancy'),
      subtitle: t('results.kpi.queue.discrepancyHint', 'Active deviation and reconciliation cases'),
      icon: <ShieldAlert size={16} />,
      accentClassName: 'text-cyan-500',
    },
    {
      id: 'requiresReview',
      title: t('results.kpi.queue.requiresReview', 'Requires review'),
      subtitle: t(
        'results.kpi.queue.requiresReviewHint',
        'The operating queue that should move into scorecard and action'
      ),
      icon: <ListTodo size={16} />,
      accentClassName: 'text-primary-500',
    },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-5">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {t('results.kpi.queue.eyebrow', 'KPI queue')}
        </div>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
          {t('results.kpi.queue.title', 'Operational triage by signal quality and review need')}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
          {t(
            'results.kpi.queue.copy',
            'This queue groups all KPI work that still needs entry, inspection, reconciliation, or a follow-up action.'
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {lanes.map((lane) => {
          const items = queueGroups[lane.id];

          return (
            <div
              key={lane.id}
              className="rounded-2xl border border-slate-200/70 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className={`flex items-center gap-2 text-sm font-semibold ${lane.accentClassName}`}>
                    {lane.icon}
                    {lane.title}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{lane.subtitle}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
                  {items.length}
                </span>
              </div>

              <div className="mt-4 space-y-2">
                {items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-white/[0.08] px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t('results.kpi.queue.empty', 'Nothing in this queue right now.')}
                  </div>
                ) : (
                  items.slice(0, 8).map((kpi) => (
                    <button
                      key={`${lane.id}-${kpi.id}`}
                      type="button"
                      onClick={() => onOpenKpi(kpi.id)}
                      className="w-full rounded-xl border border-slate-200/70 dark:border-white/[0.06] bg-slate-50/70 dark:bg-white/[0.02] px-4 py-3 text-left hover:bg-white dark:hover:bg-white/[0.04] transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
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
                        <ExternalLink size={14} className="mt-0.5 text-slate-400" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default KpiQueueView;
