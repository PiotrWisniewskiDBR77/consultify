import { ArrowRight } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Banner } from '../shared/Banner';
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
    <Banner
      className="mb-3"
      variant={isDestructive ? 'danger' : 'warning'}
      title={t('finance.lane.degraded.activeIssues', 'Finance lane has {{count}} active issue(s)', {
        count: degradedAlerts.length,
      })}
      message={
        <>
          <span>
            {top.title}: {top.description}
          </span>
          <span className="mt-1 flex items-center gap-1 text-c-text-muted">
            <ArrowRight size={10} aria-hidden="true" /> {top.nextAction}
          </span>
        </>
      }
      action={
        onViewAll
          ? { label: t('finance.lane.degraded.viewAll', 'View all'), onClick: onViewAll }
          : undefined
      }
    />
  );
};
