/**
 * D.2 — dev-render host for the REAL `<ResultsSearchRegistry>`
 * (`src/components/ResultsVNext/ResultsSearchRegistry.tsx`) — the component
 * `ResultsKpiRegistryPage.tsx` mounts verbatim when `?resultsView=search`
 * is present (line ~1366: `if (searchMode) return <ResultsSearchRegistry
 * />;`). Mounted directly (not via the full KPI page wrapper) — this IS the
 * real leaf component that owns every bit of search behaviour (fetch,
 * columns, empty-state copy, preview), same "mount the real thing, not a
 * reimplementation" doctrine every sibling RN-G2 harness screen in this
 * directory follows, just at the component level instead of the page level
 * (mirrors `results-vnext-registry-shell.tsx` mounting
 * `ResultsVNextRegistryShell` directly rather than a full page).
 *
 * `resultsSearchApi.ts`'s `searchResults()` calls `Api.get<T>(url)` and
 * reads `response.data` — the real `Api.get` wraps every payload via
 * `toAxiosLikeResponse` (`src/services/api.ts`), so this mock returns
 * `{ data: {...} }`, NOT the bare payload some sibling harnesses' `Api.get`
 * mocks return for other endpoints that are read without `.data`.
 *
 * URL params:
 *   ?screen=results-vnext-search-registry
 *   &state=ready|empty|error   (default ready) — forces the search response
 *                               for any query >= 2 chars once typed
 *   &q=<initial query>         pre-fills the search box (default empty, so
 *                               the FIRST screenshot is the honest
 *                               "type at least 2 characters" state without
 *                               any interaction)
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ResultsSearchRegistry } from '../../src/components/ResultsVNext/ResultsSearchRegistry';
import { Api } from '../../src/services/api';
import type { ResultsSearchHit } from '../../src/components/ResultsVNext/resultsSearchApi';

const harnessParams = new URLSearchParams(window.location.search);
const registryState = harnessParams.get('state') || 'ready';
const initialQuery = harnessParams.get('q') || '';

// Real-shaped hits — one per domain (KPI/OKR/ROI), same field shape
// `resultsSearchRepository.ts` actually returns (verified against
// tests/integration/results/day46.search-gateway-scenarios.realpg.test.ts's
// own real-Gateway "hit" assertion).
const MOCK_HITS: ResultsSearchHit[] = [
  {
    kind: 'kpi',
    id: 'kpi-1',
    title: 'Odchylenie budżetu utrzymania ruchu względem planu rocznego',
    subtitle: 'KPI-0142',
    status: 'active',
    updatedAt: '2026-08-20T09:00:00Z',
    matchedField: 'title',
    href: '/results/kpi?kpiId=kpi-1',
  },
  {
    kind: 'okr_set',
    id: 'okr-set-1',
    title: 'Skrócić czas przezbrojenia linii A o 30%',
    subtitle: 'Q3 FY26 — Jednostka biznesowa',
    status: 'active',
    updatedAt: '2026-08-18T09:00:00Z',
    matchedField: 'title',
    href: '/results/okr?setId=okr-set-1',
  },
  {
    kind: 'roi_case',
    id: 'roi-case-1',
    title: 'Automatyzacja linii pakowania',
    subtitle: null,
    status: 'modeling',
    updatedAt: '2026-08-07T10:00:00Z',
    matchedField: 'title',
    href: '/results/roi?caseId=roi-case-1',
  },
];

Api.get = (async (url: string) => {
  if (url.startsWith('/vnext/results/search')) {
    const params = new URLSearchParams(url.split('?')[1] ?? '');
    const q = params.get('q') ?? '';
    if (q.length < 2) {
      return {
        data: {
          query: q,
          kinds: ['kpi', 'okr_set', 'roi_case'],
          results: [],
          nextCursor: null,
          scopeCompleteness: 'FULL',
          unavailableKinds: [],
        },
      };
    }
    if (registryState === 'error') {
      const err: any = new Error('Upstream search service returned a 503.');
      err.status = 503;
      throw err;
    }
    const results = registryState === 'empty' ? [] : MOCK_HITS;
    return {
      data: {
        query: q,
        kinds: ['kpi', 'okr_set', 'roi_case'],
        results,
        nextCursor: null,
        scopeCompleteness: 'FULL',
        unavailableKinds: [],
      },
    };
  }
  throw new Error(`results-vnext-search-registry mock: unhandled Api.get ${url}`);
}) as typeof Api.get;

export default function ResultsVNextSearchRegistryScreen() {
  const [seeded, setSeeded] = React.useState(false);
  React.useEffect(() => {
    // Types the initial query (if any) into the real input so `&q=` can
    // drive straight to the hit/empty state without a manual click —
    // dispatched as a real input event, not a state hack, so the
    // component's own controlled-input path is exercised honestly.
    if (!initialQuery || seeded) return;
    const input = document.querySelector<HTMLInputElement>(
      'input[aria-label="Szukaj w Wynikach"], input[aria-label="Search Results"]'
    );
    if (input) {
      const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value'
      )?.set;
      setter?.call(input, initialQuery);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      setSeeded(true);
    }
  });
  return (
    <MemoryRouter>
      <div className="h-full" data-testid="results-vnext-search-harness">
        <ResultsSearchRegistry />
      </div>
    </MemoryRouter>
  );
}
