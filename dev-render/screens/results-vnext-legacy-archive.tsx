/**
 * RN-G2 — visual QA harness for the REAL
 * `<ResultsVNextLegacyArchivePanel>` (src/components/ResultsVNext/legacy/).
 * Mounts the production component; only `window.fetch` is stubbed for the
 * `.../legacy` index endpoint (the component uses a small, dedicated `fetch`
 * client — `legacyArchiveApi.ts` — not the giant `Api` object, so there is
 * no `Api.get` method to patch instead; pattern mirrors
 * `dev-render/screens/decision-record.tsx`'s own `window.fetch` stub).
 *
 * URL params:
 *   ?screen=results-vnext-legacy-archive
 *   &domain=kpi|roi|okr                  which domain's mock rows (default kpi)
 *   &state=ready|loading|empty|error     forces the fetch outcome (default ready)
 *   &lang=pl|en                          i18next language (main.tsx already wires this globally)
 *
 * No pre-select param: the panel starts with no row selected (matches its
 * real behaviour — preview only opens on a row click/kebab "Podgląd"). Use
 * `shot.mjs --click="text=<label>"` to open the preview for a screenshot.
 */
import React from 'react';

import { ResultsVNextLegacyArchivePanel } from '../../src/components/ResultsVNext';
import type { ResultsVNextDomain } from '../../src/components/ResultsVNext/types';

const params = new URLSearchParams(window.location.search);
const domain = (params.get('domain') as ResultsVNextDomain) || 'kpi';
const state = params.get('state') || 'ready';

type MockIndexRow = {
  sourceTable: string;
  originDomain: 'results_legacy' | 'table_platform_live';
  label: string;
  count: number;
};

// Real source-table names per domain, verified against each
// `*LegacyArchiveRepository.ts`'s own `getLegacyArchiveIndex`/
// `getRoiLegacyArchiveIndex`/`getOkrLegacyArchiveIndex` — not invented.
const MOCK_INDEX: Record<ResultsVNextDomain, MockIndexRow[]> = {
  kpi: [
    { sourceTable: 'kpis', originDomain: 'results_legacy', label: 'Legacy archive — read-only', count: 12 },
    {
      sourceTable: 'kpi_definitions',
      originDomain: 'results_legacy',
      label: 'Legacy archive — read-only',
      count: 34,
    },
    {
      sourceTable: 'v8_kpi_definitions',
      originDomain: 'results_legacy',
      label: 'Legacy archive — read-only',
      count: 0,
    },
    {
      sourceTable: 'tp_kpi_definitions',
      originDomain: 'table_platform_live',
      label: 'Table Platform — live, external to Results',
      count: 7,
    },
  ],
  roi: [
    {
      sourceTable: 'analysis_financials',
      originDomain: 'results_legacy',
      label: 'ROI legacy archive — read-only',
      count: 21,
    },
    {
      sourceTable: 'digitization_analyses',
      originDomain: 'results_legacy',
      label: 'ROI legacy archive — read-only',
      count: 5,
    },
    {
      sourceTable: 'initiative_benefits',
      originDomain: 'results_legacy',
      label: 'ROI legacy archive — read-only',
      count: 18,
    },
    {
      sourceTable: 'roi_assumptions',
      originDomain: 'results_legacy',
      label: 'ROI legacy archive — read-only',
      count: 40,
    },
    {
      sourceTable: 'roi_realized_values',
      originDomain: 'results_legacy',
      label: 'ROI legacy archive — read-only',
      count: 9,
    },
    {
      sourceTable: 'benefits_register',
      originDomain: 'results_legacy',
      label: 'ROI legacy archive — read-only',
      count: 0,
    },
    {
      sourceTable: 'v8_roi_realization_entries',
      originDomain: 'results_legacy',
      label: 'ROI legacy archive — read-only',
      count: 3,
    },
  ],
  okr: [
    { sourceTable: 'okr_cycles', originDomain: 'results_legacy', label: 'OKR legacy archive — read-only', count: 6 },
    {
      sourceTable: 'okr_objectives',
      originDomain: 'results_legacy',
      label: 'OKR legacy archive — read-only',
      count: 28,
    },
    {
      sourceTable: 'okr_key_results',
      originDomain: 'results_legacy',
      label: 'OKR legacy archive — read-only',
      count: 61,
    },
    {
      sourceTable: 'okr_check_ins',
      originDomain: 'results_legacy',
      label: 'OKR legacy archive — read-only',
      count: 0,
    },
  ],
};

const g = window as unknown as { __RVN_LEGACY_ARCHIVE_FETCH__?: boolean };
if (!g.__RVN_LEGACY_ARCHIVE_FETCH__) {
  g.__RVN_LEGACY_ARCHIVE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    const legacyMatch = url.match(/\/vnext\/results\/(kpi|roi|okr)\/legacy(?:\?|$)/);
    if (legacyMatch) {
      const matchedDomain = legacyMatch[1] as ResultsVNextDomain;

      if (state === 'loading') {
        // Never resolves within the harness's settle window — shows the
        // StandardTable loading skeleton (header + column geometry kept,
        // per R04-2C).
        return new Promise(() => {
          /* intentionally never resolves */
        });
      }
      if (state === 'error') {
        return new Response(JSON.stringify({ error: 'Internal server error', code: 'KPI_LEGACY_ARCHIVE_INTERNAL_ERROR' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      const data = state === 'empty' ? [] : MOCK_INDEX[matchedDomain];
      return new Response(
        JSON.stringify({
          data,
          meta: {
            label: `${matchedDomain.toUpperCase()} legacy archive index`,
            readOnly: true,
            organizationId: 'org-dbr77-demo',
            fetchedAt: new Date().toISOString(),
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return realFetch(input as RequestInfo, init);
  };
}

export function ResultsVNextLegacyArchiveScreen(): React.ReactElement {
  return (
    <div style={{ height: '100vh', width: '100vw', overflow: 'hidden' }} className="bg-white dark:bg-navy-900">
      <ResultsVNextLegacyArchivePanel domain={domain} />
    </div>
  );
}

export default ResultsVNextLegacyArchiveScreen;
