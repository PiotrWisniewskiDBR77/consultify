/**
 * AP-CLIENT (Gate J) — dev-render host for the REAL `<FinanceLineageNavigator>`
 * (`src/components/Finance/lineage/FinanceLineageNavigator.tsx`). Priorytet #1
 * — zamyka OWN-FIN-007/022.
 *
 * Komponent jest SAMODZIELNY (nie montowany w żadnym workspace produkcyjnym w
 * tym pakiecie — allowlista tego pakietu tego zakazuje), więc jedyny sposób,
 * żeby go zobaczyć przed akceptem, to ten harness. Mock na `window.fetch`
 * (ten sam wzorzec co `finance-baseline-workspace.tsx` — komponent woła
 * nazwaną funkcję `getFinanceLineageNavigator` z `financeV2.api.ts`, nie
 * metodę na mutowalnym obiekcie, więc podmiana metody z zewnątrz modułu się
 * nie da; `window.fetch` jest niezależny od kształtu importu).
 *
 * CLAUDE.md reguła #7 — Piotr nigdy nie jest pierwszym testerem wizualnym:
 * ten ekran renderuję i zrzucam SAM (bez logowania Piotra), dopiero potem
 * idzie do akceptu na zrzutach.
 *
 * URL: ?screen=finance-lineage-navigator[&lang=pl|en][&theme=light|dark]
 *   &scene=default|error|off   default: pełny łańcuch + panel Powiązane;
 *                              error: 404 NOT_FOUND (honest-UI);
 *                              off: flaga WYŁĄCZONA — dowód, że komponent
 *                              renderuje null i NIE woła sieci nawet w tym
 *                              harnessie.
 */
import React from 'react';

import { FinanceLineageNavigator } from '../../src/components/Finance/lineage/FinanceLineageNavigator';
import { FINANCE_LINEAGE_NAVIGATOR_FLAG_ID } from '../../src/hooks/useFinanceLineageNavigatorFlag';

const params = new URLSearchParams(window.location.search);
const scene = (params.get('scene') as 'default' | 'error' | 'off' | null) ?? 'default';

const BV_FOCUS = 'bv-dbr77-valuation-1';

if (scene !== 'off') {
  const raw = window.localStorage.getItem('consultify_feature_flags');
  const overrides = raw ? JSON.parse(raw) : {};
  overrides[FINANCE_LINEAGE_NAVIGATOR_FLAG_ID] = true;
  window.localStorage.setItem('consultify_feature_flags', JSON.stringify(overrides));
}

const SAMPLE_NAVIGATOR = {
  businessVersionId: BV_FOCUS,
  trail: {
    items: [
      {
        kind: 'node',
        metadata: {
          versionId: 'bv-dbr77-statement-3',
          artifactId: 'art-dbr77-statement',
          artifactType: 'STATEMENT_PACK',
          name: 'Pakiet sprawozdań FY2025',
          versionLabel: 'v3',
          periodLabel: 'FY2025',
          status: 'APPROVED',
          freshness: 'CURRENT',
          variantLabel: null,
        },
        displayName: 'Pakiet sprawozdań FY2025',
        isFocus: false,
        outgoingEdgeType: 'STATEMENT_TO_ANALYSIS',
        staleBadge: null,
        stateBadge: null,
        isDimmed: false,
      },
      {
        kind: 'node',
        metadata: {
          versionId: 'bv-dbr77-analysis-2',
          artifactId: 'art-dbr77-analysis',
          artifactType: 'HISTORICAL_ANALYSIS',
          name: 'Analiza historyczna FY2025',
          versionLabel: 'v2',
          periodLabel: 'FY2025',
          status: 'APPROVED',
          freshness: 'CURRENT',
          variantLabel: null,
        },
        displayName: 'Analiza historyczna FY2025',
        isFocus: false,
        outgoingEdgeType: 'ANALYSIS_TO_MODEL',
        staleBadge: null,
        stateBadge: null,
        isDimmed: false,
      },
      {
        kind: 'node',
        metadata: {
          versionId: 'bv-dbr77-baseline-4',
          artifactId: 'art-dbr77-baseline',
          artifactType: 'BASELINE_MODEL',
          name: 'Model bazowy FY2026',
          versionLabel: 'v4',
          periodLabel: 'FY2026',
          status: 'APPROVED',
          freshness: 'STALE_SOURCE',
          variantLabel: null,
        },
        displayName: 'Model bazowy FY2026',
        isFocus: false,
        outgoingEdgeType: 'MODEL_TO_SCENARIO',
        staleBadge: { kind: 'SOURCE_CHANGED', label: { key: 'x', pl: 'Źródło się zmieniło' }, severity: 'warning' },
        stateBadge: null,
        isDimmed: false,
      },
      {
        kind: 'node',
        metadata: {
          versionId: 'bv-dbr77-scenario-2',
          artifactId: 'art-dbr77-scenario',
          artifactType: 'PREDICTION_SCENARIO',
          name: 'Scenariusz predykcji',
          versionLabel: 'v2',
          periodLabel: 'FY2026-2027',
          status: 'APPROVED',
          freshness: 'CURRENT',
          variantLabel: 'Bull',
        },
        displayName: 'Scenariusz Bull v2',
        isFocus: false,
        outgoingEdgeType: 'SCENARIO_TO_VALUATION',
        staleBadge: null,
        stateBadge: null,
        isDimmed: false,
      },
      {
        kind: 'node',
        metadata: {
          versionId: BV_FOCUS,
          artifactId: 'art-dbr77-valuation',
          artifactType: 'VALUATION_CASE',
          name: 'Wycena DBR77',
          versionLabel: 'v1',
          periodLabel: 'FY2026',
          status: 'DRAFT',
          freshness: 'CURRENT',
          variantLabel: null,
        },
        displayName: 'Wycena DBR77',
        isFocus: true,
        outgoingEdgeType: null,
        staleBadge: null,
        stateBadge: null,
        isDimmed: false,
      },
    ],
    totalNodeCount: 5,
    hasAlternatePaths: false,
    unresolvedVersionIds: [],
    cycleVersionIds: [],
  },
  relatedPanel: {
    focus: {
      versionId: BV_FOCUS,
      artifactId: 'art-dbr77-valuation',
      artifactType: 'VALUATION_CASE',
      name: 'Wycena DBR77',
      versionLabel: 'v1',
      periodLabel: 'FY2026',
      status: 'DRAFT',
      freshness: 'CURRENT',
      variantLabel: null,
    },
    parents: [{ artifactType: 'PREDICTION_SCENARIO', count: 1, entries: [] }],
    indirectAncestors: [
      { artifactType: 'BASELINE_MODEL', count: 1, entries: [] },
      { artifactType: 'HISTORICAL_ANALYSIS', count: 1, entries: [] },
      { artifactType: 'STATEMENT_PACK', count: 1, entries: [] },
    ],
    children: [],
    indirectDescendants: [],
    siblings: [
      {
        metadata: {
          versionId: 'bv-dbr77-valuation-downside',
          artifactId: 'art-dbr77-valuation',
          artifactType: 'VALUATION_CASE',
          name: 'Wycena DBR77 (Downside)',
          versionLabel: 'v1',
          periodLabel: 'FY2026',
          status: 'DRAFT',
          freshness: 'CURRENT',
          variantLabel: 'Downside',
        },
        displayName: 'Wycena DBR77 — Downside',
        edgeType: 'VERSION_TO_MANAGEMENT_ADJUSTED_VARIANT',
        depth: 1,
        staleBadge: null,
        stateBadge: null,
        isDimmed: false,
      },
    ],
    createNew: [
      {
        targetArtifactType: 'REPORT_EXPORT',
        label: { key: 'finance.lineage.createNew.reportExport', pl: '+ Nowy: Eksport raportu' },
        preselectedSource: { artifactId: 'art-dbr77-valuation', artifactType: 'VALUATION_CASE', businessVersionId: BV_FOCUS },
      },
    ],
    createNewBlockedReason: null,
    createNewBlockedLabel: null,
    focusBadges: [],
    terminalVisibility: 'dim',
    hiddenTerminalCount: 0,
    cycleVersionIds: [],
  },
  fullGraphView: { id: 'finance.lineage.fullGraph', label: { key: 'x', pl: 'Pełny graf powiązań' }, auxiliary: true, defaultVisible: false },
};

const g = window as unknown as { __LINEAGE_NAVIGATOR_FETCH__?: boolean };
if (!g.__LINEAGE_NAVIGATOR_FETCH__) {
  g.__LINEAGE_NAVIGATOR_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (url.includes('/locales/')) return realFetch(input as RequestInfo, init);

    if (url.includes('/lineage-navigator')) {
      if (scene === 'error') {
        return new Response(JSON.stringify({ error: 'Business version not found', code: 'NOT_FOUND' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ data: SAMPLE_NAVIGATOR, meta: { version: 'v2', contract: 'finance_v3_canonical_v1' } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/api/')) return new Response(JSON.stringify({ data: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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

export default function FinanceLineageNavigatorScreen(): React.ReactElement {
  return (
    <div className="min-h-screen bg-c-bg p-6" data-testid="finance-lineage-navigator-screen" data-scene={scene}>
      <SimulatedMenu1 />
      <div className="mx-auto mt-4 max-w-xl">
        <FinanceLineageNavigator businessVersionId={BV_FOCUS} onNavigate={() => {}} onCreateNew={() => {}} />
      </div>
    </div>
  );
}
