import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface StaleDataBadgeProps {
  isRefreshable: boolean;
  lastDataTimestamp?: string;
  generatedAt?: string;
  onRefresh: () => void;
  isPl: boolean;
  isRefreshing?: boolean;
}

function isStale(lastDataTimestamp?: string, generatedAt?: string): boolean {
  if (!generatedAt) return false;
  if (!lastDataTimestamp) return true;
  return new Date(lastDataTimestamp) < new Date(generatedAt);
}

export const StaleDataBadge: React.FC<StaleDataBadgeProps> = ({
  isRefreshable,
  lastDataTimestamp,
  generatedAt,
  onRefresh,
  isPl,
  isRefreshing,
}) => {
  const { t } = useTranslation();
  if (!isRefreshable) return null;

  const stale = isStale(lastDataTimestamp, generatedAt);

  if (isRefreshing) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
        <Loader2 className="w-3 h-3 animate-spin" />
        {t('reportBuilder.staleDataBadge.refreshing', 'Refreshing…')}
      </span>
    );
  }

  if (stale) {
    return (
      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:hover:bg-amber-900/60 transition-colors"
        title={
          t('reportBuilder.staleDataBadge.dataMayBeStaleClickTo', 'Data may be stale. Click to refresh.')
        }
      >
        <AlertTriangle className="w-3 h-3" />
        {t('reportBuilder.staleDataBadge.staleData', 'Stale data')}
        <RefreshCw className="w-3 h-3 ml-0.5" />
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
      <CheckCircle2 className="w-3 h-3" />
      {t('reportBuilder.staleDataBadge.upToDate', 'Up to date')}
    </span>
  );
};

export default StaleDataBadge;
