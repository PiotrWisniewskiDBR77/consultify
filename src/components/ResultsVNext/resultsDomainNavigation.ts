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
  /**
   * DEC-422b/e (06.09, słowa właściciela): „Raporty zarządcze przenieś do menu
   * drugiego — we WSZYSTKICH miejscach menu drugiego. […] Ten wyszukiwak
   * wywalamy, tutaj robimy raporty zarządcze."
   *
   * Menu 2 modułu Wyniki = KPI · OKR · ROI · Raporty zarządcze. Zakładka
   * „Wyszukiwarka" (`search`) została usunięta razem z komponentem
   * `ResultsSearchRegistry`, `resultsSearchApi` i flagą `resultsSearch` —
   * nie miały innego konsumenta. „Raporty zarządcze" NIE stoją za flagą:
   * są stałym elementem Menu 2, tak samo jak trzy domeny obok.
   *
   * Ta funkcja jest jedynym źródłem zakładek Menu 2 dla WSZYSTKICH ekranów
   * Wyników (KPI/OKR/ROI hub, raporty P7K, karta scorecardu) — dlatego jedna
   * zmiana tutaj realizuje „we wszystkich miejscach menu drugiego".
   */
  const withReports: StandardModuleTab[] = [
    ...RESULTS_DOMAIN_TABS,
    { id: 'reports', label: i18n.t('results.managementReportsTab', 'Raporty zarządcze') },
  ];
  // 2026-09-02 (wołacze duty) — "Archiwum"/"Archive" tab, default OFF
  // (`resultsLegacyArchive`, see resultsVNextFeatureFlags.ts). Appended
  // last, same additive shape as before: when the flag is OFF this returns
  // byte-for-byte the same array as `withReports`.
  return isResultsVNextFlagEnabled('resultsLegacyArchive')
    ? [...withReports, { id: 'legacy', label: i18n.t('results.legacyArchiveTab', 'Archive') }]
    : withReports;
}

export function getResultsDomainPath(domain: string): string {
  const params =
    typeof window === 'undefined'
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  if (domain === 'reports') params.set('resultsView', 'reports');
  else if (domain === 'legacy') params.set('resultsView', 'legacy');
  else params.delete('resultsView');
  const pathname =
    domain === 'legacy'
      ? // Legacy archive stays on whichever domain route the user is
        // currently on (kpi/roi/okr) — unlike `reports`, which always routes
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
