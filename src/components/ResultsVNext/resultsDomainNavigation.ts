import type { StandardModuleTab } from '@/components/standard';
import { ROUTES } from '@/routes/routeConfig';

import type { ResultsVNextDomain } from './types';
import { isResultsVNextFlagEnabled } from './resultsVNextFeatureFlags';

export const RESULTS_DOMAIN_TABS: StandardModuleTab[] = [
  { id: 'kpi', label: 'KPI' },
  { id: 'okr', label: 'OKR' },
  { id: 'roi', label: 'ROI' },
];

export function getResultsDomainTabs(): StandardModuleTab[] {
  return isResultsVNextFlagEnabled('resultsSearch')
    ? [{ id: 'search', label: 'Search' }, ...RESULTS_DOMAIN_TABS]
    : RESULTS_DOMAIN_TABS;
}

export function getResultsDomainPath(domain: string): string {
  const params =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  if (domain === 'search') params.set('resultsView', 'search');
  else params.delete('resultsView');
  const pathname =
    domain === 'okr'
      ? ROUTES.RESULTS_OKR.ROOT
      : domain === 'roi'
        ? ROUTES.RESULTS_ROI.ROOT
        : ROUTES.RESULTS_KPI.ROOT;
  const query = params.toString();
  const search = query ? `?${query}` : '';
  return `${pathname}${search}`;
}

export function isResultsDomain(value: string): value is ResultsVNextDomain {
  return value === 'kpi' || value === 'okr' || value === 'roi';
}
