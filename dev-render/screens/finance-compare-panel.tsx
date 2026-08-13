/**
 * AP-CLIENT (Gate J) — dev-render host for the REAL `<FinanceComparePanel>`
 * (`src/components/Finance/compare/FinanceComparePanel.tsx`). Priorytet #2.
 *
 * Komponent SAMODZIELNY, nie montowany w żadnym workspace produkcyjnym w tym
 * pakiecie. Mock na `window.fetch` (nazwane eksporty, ten sam wzorzec co
 * `finance-baseline-workspace.tsx`/`finance-lineage-navigator.tsx`).
 *
 * URL: ?screen=finance-compare-panel[&lang=pl|en][&theme=light|dark]
 *   &scene=default|off
 */
import React from 'react';

import {
  FinanceComparePanel,
  type FinanceCompareRequest,
} from '../../src/components/Finance/compare/FinanceComparePanel';
import { FINANCE_COMPARE_FLAG_ID } from '../../src/hooks/useFinanceCompareFlag';

const params = new URLSearchParams(window.location.search);
const scene = (params.get('scene') as 'default' | 'off' | null) ?? 'default';

// Explicit true/false (not "skip when off") — localStorage persists across page.goto()
// within the same browser context, so a prior scene left ON would leak into this one.
// See finance-lineage-navigator.tsx for the screenshot review that found this bug.
{
  const raw = window.localStorage.getItem('consultify_feature_flags');
  const overrides = raw ? JSON.parse(raw) : {};
  overrides[FINANCE_COMPARE_FLAG_ID] = scene !== 'off';
  window.localStorage.setItem('consultify_feature_flags', JSON.stringify(overrides));
}

const REQUEST: FinanceCompareRequest = {
  kind: 'periods',
  params: {
    artifactRef: {
      artifactType: 'STATEMENT_PACK',
      artifactId: 'art-dbr77-statement',
      businessVersionId: 'bv-dbr77-statement-3',
    },
    periodIdA: 'per-2025-12',
    periodIdB: 'per-2026-01',
    labelA: 'Grudzień 2025',
    labelB: 'Styczeń 2026',
  },
};

function dim(canonicalLineId: string): Record<string, string> {
  return { canonicalLineId };
}

function point(value: number | null, unit = 'UNITS') {
  return {
    presence: value === null ? 'MISSING' : 'PRESENT',
    valueStatus: value === null ? 'MISSING' : value === 0 ? 'PRESENT_ZERO' : 'PRESENT_NONZERO',
    businessVersionId: 'bv-dbr77-statement-3',
    cellRef: null,
    fullUnitValue: value,
    rawValueDecimal: value === null ? null : String(value),
    unit,
    multiplier: '1',
    nativeCurrency: 'PLN',
    presentationCurrency: 'PLN',
  };
}

const ROWS = [
  { line: 'REVENUE', a: 420000, b: 431000 },
  { line: 'COGS', a: -243600, b: -250000 },
  { line: 'GROSS_MARGIN', a: 176400, b: 181000 },
  { line: 'OPEX', a: -92400, b: -94800 },
  { line: 'EBITDA', a: 84000, b: 86200 },
  { line: 'EBIT', a: 75500, b: 77700 },
  { line: 'NET_INCOME', a: 58563, b: 60426 },
].map(({ line, a, b }) => {
  const absoluteDiff = b - a;
  const pctDiff = a !== 0 ? absoluteDiff / Math.abs(a) : null;
  return {
    matchKey: line,
    dimensions: dim(line),
    a: point(a),
    b: point(b),
    diffKind: 'BOTH_PRESENT',
    absoluteDiff,
    pctDiff,
    materialityFlag: pctDiff !== null && Math.abs(pctDiff) > 0.05,
    note: null,
  };
});

const SAMPLE_RESULT = {
  comparisonType: 'PERIOD',
  generatedAt: '2026-08-12T00:00:00.000Z',
  sourceA: {
    artifactType: 'STATEMENT_PACK',
    businessVersionId: 'bv-dbr77-statement-3',
    label: 'Grudzień 2025',
  },
  sourceB: {
    artifactType: 'STATEMENT_PACK',
    businessVersionId: 'bv-dbr77-statement-3',
    label: 'Styczeń 2026',
  },
  ignoreDimensions: ['periodId'],
  materialityThresholdPct: 5,
  onlyMaterial: false,
  summary: {
    totalRows: ROWS.length,
    bothPresent: ROWS.length,
    missingInA: 0,
    missingInB: 0,
    missingInBoth: 0,
    currencyMismatch: 0,
    materialCount: ROWS.filter((r) => r.materialityFlag).length,
  },
  rows: ROWS,
};

const g = window as unknown as { __COMPARE_PANEL_FETCH__?: boolean };
if (!g.__COMPARE_PANEL_FETCH__) {
  g.__COMPARE_PANEL_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);
    if (url.includes('/compare/periods')) {
      return new Response(JSON.stringify({ data: SAMPLE_RESULT, meta: {} }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/api/'))
      return new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    return realFetch(input as RequestInfo, init);
  };
}

function SimulatedMenu1(): React.ReactElement {
  return (
    <div className="flex h-10 items-center gap-4 border-b border-c-border-subtle bg-c-surface px-4 text-xs text-c-text-secondary">
      <span className="font-semibold text-c-text">Consultify</span>
      <span>Finance</span>
      <span className="text-c-text-muted">(symulowane Menu 1 — nie część tego pakietu)</span>
    </div>
  );
}

export default function FinanceComparePanelScreen(): React.ReactElement {
  return (
    <div
      className="min-h-screen bg-c-bg p-6"
      data-testid="finance-compare-panel-screen"
      data-scene={scene}
    >
      <SimulatedMenu1 />
      <div className="mx-auto mt-4 max-w-3xl">
        <FinanceComparePanel request={REQUEST} />
      </div>
    </div>
  );
}
