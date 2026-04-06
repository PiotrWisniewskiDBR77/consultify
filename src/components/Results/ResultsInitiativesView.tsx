import React from 'react';
import { useTranslation } from 'react-i18next';

import type { ResultsTrackedInitiative } from './kpiDomain';

interface ResultsInitiativesViewProps {
  initiatives: ResultsTrackedInitiative[];
  onOpenInitiativeKpis: (initiativeId: string) => void;
}

export const ResultsInitiativesView: React.FC<ResultsInitiativesViewProps> = ({
  initiatives,
  onOpenInitiativeKpis,
}) => {
  const { t } = useTranslation();

  if (initiatives.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
        {t(
          'results.initiatives.empty',
          'No tracked initiatives for the selected lifecycle bucket yet.'
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-navy-700/60 bg-white/70 dark:bg-navy-900/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200/70 dark:border-navy-700/60 text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <th className="px-4 py-3">{t('results.initiatives.name', 'Initiative')}</th>
              <th className="px-4 py-3">{t('common.status', 'Status')}</th>
              <th className="px-4 py-3">{t('results.initiatives.kpis', 'Tracked KPI')}</th>
              <th className="px-4 py-3">{t('results.initiatives.alerts', 'Needs attention')}</th>
              <th className="px-4 py-3">{t('results.initiatives.reports', 'Reports')}</th>
              <th className="px-4 py-3 text-right">{t('common.actions', 'Actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/50 dark:divide-navy-700/50">
            {initiatives.map((initiative) => {
              const attentionCount =
                initiative.belowTargetCount +
                initiative.needsEntryCount +
                initiative.openDeviationCount;

              return (
                <tr key={initiative.initiativeId}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {initiative.initiativeName}
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {initiative.lifecycleBucket === 'in-realization'
                        ? t('results.lifecycle.inRealization', 'In realization')
                        : t('results.lifecycle.realized', 'Realized')}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                    {initiative.initiativeStatus}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 dark:text-white">{initiative.trackedKpiCount}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {initiative.realizationKpiCount}/{initiative.postImplementationKpiCount}{' '}
                      {t('results.initiatives.phaseSplit', 'realization/post')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 dark:text-white">{attentionCount}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {initiative.belowTargetCount} {t('results.filters.below', 'below')},{' '}
                      {initiative.needsEntryCount} {t('results.filters.needsEntry', 'needs entry')}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 dark:text-white">{initiative.openReportCount}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                      {initiative.lastReportTitle || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenInitiativeKpis(initiative.initiativeId)}
                      className="inline-flex items-center rounded-full border border-slate-300/70 dark:border-navy-600/70 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-navy-800/70 transition-colors"
                    >
                      {t('results.initiatives.openKpis', 'Open KPI')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultsInitiativesView;
