import { CheckCircle2, Clock, GitCommit } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import type { FinanceVersionSnapshot } from '../../services/api/v8/finance';

interface FinanceVersionTimelineProps {
  snapshots: FinanceVersionSnapshot[];
}

export const FinanceVersionTimeline: React.FC<FinanceVersionTimelineProps> = ({ snapshots }) => {
  const { t } = useTranslation();
  if (snapshots.length === 0) return null;

  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
        <Clock size={12} />
        <span>{t('finance.lane.versions.history', 'Version History')}</span>
      </div>
      {sorted.map((snap) => (
        <div key={snap.snapshotId} className="flex items-start gap-2">
          <div className="mt-0.5">
            {snap.isFinalized ? (
              <CheckCircle2 size={14} className="text-emerald-400" />
            ) : (
              <GitCommit size={14} className="text-slate-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  snap.versionType === 'actual'
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-300'
                    : 'bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-300'
                }`}
              >
                {snap.versionType}
              </span>
              {snap.isFinalized && (
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                  {t('finance.lane.versions.finalized', 'finalized')}
                </span>
              )}
              <span className="text-[10px] text-slate-600 dark:text-slate-500 ml-auto whitespace-nowrap">
                {new Date(snap.createdAt).toLocaleDateString('pl-PL')}
              </span>
            </div>
            {snap.switchoverDate && (
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t('finance.lane.versions.switchover', 'Switchover')}{' '}
                {new Date(snap.switchoverDate).toLocaleDateString('pl-PL')}
                {snap.switchoverActor &&
                  ` ${t('finance.lane.versions.by', 'by')} ${snap.switchoverActor}`}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
