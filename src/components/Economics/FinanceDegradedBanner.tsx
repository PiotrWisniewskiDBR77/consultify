import React from 'react';
import { useTranslation } from 'react-i18next';

import { AlertTriangle, ArrowRight, ChevronRight } from 'lucide-react';

import type { DegradedAlert } from './hooks/useFinanceLane';

interface FinanceDegradedBannerProps {
  degradedAlerts: DegradedAlert[];
  onViewAll?: () => void;
}

const SEVERITY_ORDER = { destructive: 0, warning: 1, info: 2 } as const;

export const FinanceDegradedBanner: React.FC<FinanceDegradedBannerProps> = ({
  degradedAlerts,
  onViewAll,
}) => {
  const { t } = useTranslation();
  if (degradedAlerts.length === 0) return null;

  const sorted = [...degradedAlerts].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 2) - (SEVERITY_ORDER[b.severity] ?? 2)
  );
  const top = sorted[0];
  const isDestructive = top.severity === 'destructive';

  return (
    <div
      className={`rounded-lg border p-3 mb-3 flex items-start gap-3 ${
        isDestructive
          ? 'bg-rose-50 border-rose-200 dark:bg-rose-500/10 dark:border-rose-500/20'
          : 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20'
      }`}
    >
      <AlertTriangle
        size={16}
        className={`mt-0.5 flex-shrink-0 ${
          isDestructive ? 'text-rose-500' : 'text-amber-500'
        }`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            isDestructive
              ? 'text-rose-700 dark:text-rose-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}
        >
          {t('finance.lane.degraded.activeIssues', 'Finance lane has {{count}} active issue(s)', { count: degradedAlerts.length })}
        </p>
        <p
          className={`text-xs mt-0.5 ${
            isDestructive
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {top.title}: {top.description}
        </p>
        <p className="text-xs mt-1 flex items-center gap-1 text-slate-600 dark:text-slate-400">
          <ArrowRight size={10} /> {top.nextAction}
        </p>
      </div>
      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className={`flex-shrink-0 text-xs font-medium flex items-center gap-0.5 hover:underline ${
            isDestructive
              ? 'text-rose-600 dark:text-rose-400'
              : 'text-amber-600 dark:text-amber-400'
          }`}
        >
          {t('finance.lane.degraded.viewAll', 'View all')} <ChevronRight size={12} />
        </button>
      )}
    </div>
  );
};
