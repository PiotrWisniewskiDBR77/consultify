/**
 * RN-G5 §G #11 — dev-render host for the REAL `RoiPirOutcomesTab`
 * (`../../src/components/ResultsVNext/roi/RoiPirOutcomesTab.tsx`), mounted
 * through the real `ResultsRoiPirOutcomesPage` wrapper (flag gate + the
 * component under test), same convention `results-vnext-kpi-scorecards.tsx`
 * uses for its own detail-page-without-a-parent-list screen. `window.fetch`
 * is stubbed for `/vnext/results/roi/org/pir-outcomes` — the SAME bare-fetch
 * client (`roiApi.ts`'s `getJson`) `results-vnext-roi-registry.tsx` stubs
 * for its sibling `/org/benefits-realization` endpoint, not `Api`/`Api.get`.
 *
 * URL params:
 *   ?state=ready|loading|empty|error   `GET /org/pir-outcomes` outcome
 *   &ff=off                            force the `roiRegistry` flag OFF
 *                                       (disabled panel)
 *
 * Golden-flow click chain (see acceptance report for the actual run):
 *   1. row click (fully realized case) -> preview -> Esc closes it
 *   2. row click (case still in review, pirOutcome=null) -> preview shows
 *      the honest "Review in progress" text, not a fabricated outcome
 */
import React from 'react';

import { ResultsRoiPirOutcomesPage } from '../../src/components/ResultsVNext/roi/ResultsRoiPirOutcomesPage';
import { API_URL } from '../../src/services/api';
import type { RoiOrgPirOutcomeCaseRow } from '../../src/components/ResultsVNext/roi/roiApi';

const params = new URLSearchParams(window.location.search);
const stateParam = params.get('state') || 'ready';
const flagOff = params.get('ff') === 'off';

if (!flagOff) {
  try {
    window.localStorage.setItem('ff.results_vnext_roi_registry', '1');
  } catch {
    // no-op — dev-render only
  }
}

const MOCK_CASES: RoiOrgPirOutcomeCaseRow[] = [
  {
    caseId: 'roi-case-4',
    initiativeId: 'init-104',
    title: 'Rollup finansowy — jedno źródło',
    status: 'closed',
    pirOutcome: 'benefits_fully_realized',
    benefitsRealizationPct: 104.2,
    finalizedAt: '2026-07-15T09:00:00Z',
  },
  {
    caseId: 'roi-case-6',
    initiativeId: 'init-106',
    title: 'Automatyzacja fakturowania',
    status: 'closed',
    pirOutcome: 'benefits_partially_realized',
    benefitsRealizationPct: 61.0,
    finalizedAt: '2026-06-01T09:00:00Z',
  },
  {
    caseId: 'roi-case-7',
    initiativeId: 'init-107',
    title: 'Program redukcji przestojów (nietrafiony)',
    status: 'closed',
    pirOutcome: 'benefits_not_realized',
    benefitsRealizationPct: 8.0,
    finalizedAt: '2026-05-20T09:00:00Z',
  },
  {
    caseId: 'roi-case-8',
    initiativeId: 'init-108',
    title: 'Migracja MES — w trakcie przeglądu po inwestycji',
    status: 'post_investment_review',
    pirOutcome: null,
    benefitsRealizationPct: null,
    finalizedAt: null,
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function errorResponse(message: string, status: number, code?: string): Response {
  return jsonResponse({ error: message, code }, status);
}

const g = window as unknown as { __RVN_ROI_PIR_OUTCOMES_FETCH__?: boolean };
if (!g.__RVN_ROI_PIR_OUTCOMES_FETCH__) {
  g.__RVN_ROI_PIR_OUTCOMES_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (rawUrl.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (!rawUrl.includes(`${API_URL}/vnext/results/roi/org/pir-outcomes`)) {
      return realFetch(input as RequestInfo, init);
    }
    if (stateParam === 'loading') return new Promise(() => { /* never resolves */ });
    if (stateParam === 'error') {
      return errorResponse('Upstream ROI service returned a 503.', 503, 'ROI_PERSPECTIVES_INTERNAL_ERROR');
    }
    if (stateParam === 'empty') {
      return jsonResponse({
        outcomes: { cases: [], portfolioTotals: { closedCaseCount: 0, fullyRealizedCount: 0, partiallyRealizedCount: 0, notRealizedCount: 0 } },
      });
    }
    return jsonResponse({
      outcomes: {
        cases: MOCK_CASES,
        portfolioTotals: {
          closedCaseCount: MOCK_CASES.filter((c) => c.status === 'closed').length,
          fullyRealizedCount: MOCK_CASES.filter((c) => c.pirOutcome === 'benefits_fully_realized').length,
          partiallyRealizedCount: MOCK_CASES.filter((c) => c.pirOutcome === 'benefits_partially_realized').length,
          notRealizedCount: MOCK_CASES.filter((c) => c.pirOutcome === 'benefits_not_realized').length,
        },
      },
    });
  };
}

const ResultsVNextRoiPirOutcomesScreen: React.FC = () => (
  <div className="h-screen bg-c-bg text-c-text">
    <ResultsRoiPirOutcomesPage />
  </div>
);

export default ResultsVNextRoiPirOutcomesScreen;
