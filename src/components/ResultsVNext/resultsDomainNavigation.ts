import i18n from 'i18next';

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
  const withSearch = isResultsVNextFlagEnabled('resultsSearch')
    ? [{ id: 'search', label: 'Search' }, ...RESULTS_DOMAIN_TABS]
    : [...RESULTS_DOMAIN_TABS];
  // 2026-09-02 (wołacze duty) — "Archiwum"/"Archive" tab, default OFF
  // (`resultsLegacyArchive`, see resultsVNextFeatureFlags.ts). Appended
  // last, same additive shape as `search` above: when the flag is OFF this
  // returns byte-for-byte the same array as before this change.
  return isResultsVNextFlagEnabled('resultsLegacyArchive')
    ? [...withSearch, { id: 'legacy', label: i18n.t('results.legacyArchiveTab', 'Archive') }]
    : withSearch;
}

export function getResultsDomainPath(domain: string): string {
  const params =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  if (domain === 'search') params.set('resultsView', 'search');
  else if (domain === 'legacy') params.set('resultsView', 'legacy');
  else params.delete('resultsView');
  const pathname =
    domain === 'legacy'
      ? // Legacy archive stays on whichever domain route the user is
        // currently on (kpi/roi/okr) — unlike `search`, which always routes
        // to the KPI page regardless of origin. Falls back to the KPI route
        // when `window` is unavailable (SSR/tests).
        typeof window === 'undefined' || !window.location?.pathname
        ? ROUTES.RESULTS_KPI.ROOT
        : window.location.pathname
      : domain === 'okr'
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
