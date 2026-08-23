import type { StandardModuleTab } from '@/components/standard';
import { ROUTES } from '@/routes/routeConfig';

import type { ResultsVNextDomain } from './types';

export const RESULTS_DOMAIN_TABS: StandardModuleTab[] = [
  { id: 'kpi', label: 'KPI' },
  { id: 'okr', label: 'OKR' },
  { id: 'roi', label: 'ROI' },
];

export function getResultsDomainPath(domain: string): string {
  const pathname =
    domain === 'okr'
      ? ROUTES.RESULTS_OKR.ROOT
      : domain === 'roi'
        ? ROUTES.RESULTS_ROI.ROOT
        : ROUTES.RESULTS_KPI.ROOT;
  const search = typeof window === 'undefined' ? '' : window.location.search;
  return `${pathname}${search}`;
}

export function isResultsDomain(value: string): value is ResultsVNextDomain {
  return value === 'kpi' || value === 'okr' || value === 'roi';
}
