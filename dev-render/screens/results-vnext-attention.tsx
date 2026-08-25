/**
 * RN-G5 §G #30 — dev-render host for the REAL `ResultsAttentionPage`
 * (`../../src/components/ResultsVNext/attention/ResultsAttentionPage.tsx`).
 * Mounts the ACTUAL production component (not a second reimplementation) —
 * `Api.get` is stubbed for the three real endpoints
 * (`/vnext/results/kpi/attention`, `/vnext/results/okr/attention`,
 * `/vnext/results/okr/team-health`), the same `Api` object
 * `attentionApi.ts` itself calls (mirrors
 * `results-vnext-kpi-scorecards.tsx`'s own `Api.get`-stub convention, NOT
 * `window.fetch` — this package's client follows `kpiApi.ts`'s convention,
 * not `roiApi.ts`'s).
 *
 * URL params (Menu 2 tab always starts on "KPI" — `ResultsAttentionPage`
 * takes no props, source-tab is internal `useState`; click "OKR" to switch):
 *   ?kpiState=ready|loading|empty|error    KPI attention fetch outcome
 *   &okrState=ready|loading|empty|error    OKR attention + team-health fetch
 *                                          outcome (both share this param —
 *                                          same tab, same Promise.all-style
 *                                          load in the real page)
 *   &ff=off                   force BOTH flags OFF (disabled panel)
 *
 * Golden-flow click chain (see acceptance report for the actual run):
 *   1. Menu2 tab "KPI" (default) -> chip "Brak właściciela" -> row click -> preview -> Esc closes it
 *   2. chip "Zaległe obowiązki" -> row click -> preview -> "Otwórz KPI" (navigates)
 *   3. Menu2 tab "OKR" -> chip "Eskalowane zestawy" -> row click -> preview -> "Otwórz Set OKR"
 *   4. chip "Zdrowie zespołu — zestawy" (team-health) -> row click -> preview
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ResultsAttentionPage } from '../../src/components/ResultsVNext/attention/ResultsAttentionPage';
import { Api } from '../../src/services/api';
import { OrganizationApi } from '../../src/services/api/organizations.api';
import { useAppStore } from '../../src/store/useAppStore';

// night-fixes-a P0 #4 (2026-08-26, NIGHT_SWEEP_A_REPORT_20260826.md): the
// page now resolves every `*UserId` to a real member name via
// `OrganizationApi.getOrganizationMembers(currentOrganization.id)` — stub
// both so the harness renders the REAL id->name resolution, not a
// same-as-before "fetch fails, falls back to short id" no-op.
useAppStore.setState({ currentOrganization: { id: 'org-demo', name: 'Firma Demo Sp. z o.o.' } });
OrganizationApi.getOrganizationMembers = (async () => [
  { userId: 'user-anna', email: 'anna.kowalska@firma-demo.pl', name: 'Anna Kowalska', role: 'member', status: 'active' },
  { userId: 'user-marek', email: 'marek.nowak@firma-demo.pl', name: 'Marek Nowak', role: 'member', status: 'active' },
]) as typeof OrganizationApi.getOrganizationMembers;

const params = new URLSearchParams(window.location.search);
const flagOff = params.get('ff') === 'off';
const kpiState = params.get('kpiState') || 'ready';
const okrState = params.get('okrState') || 'ready';

if (!flagOff) {
  try {
    window.localStorage.setItem('ff.results_vnext_kpi_registry', '1');
    window.localStorage.setItem('ff.results_vnext_okr_registry', '1');
  } catch {
    // no-op — dev-render only
  }
}

const MOCK_KPI_ATTENTION = {
  processCoverage: [
    { primaryProcessId: 'proc-pakowanie', totalKpis: 5, activeKpis: 4 },
    { primaryProcessId: null, totalKpis: 2, activeKpis: 1 },
  ],
  ownerLoad: [
    { ownerUserId: 'user-anna', activeKpiCount: 6, openDeviationCaseCount: 2 },
    { ownerUserId: 'user-marek', activeKpiCount: 3, openDeviationCaseCount: 0 },
  ],
  missingOwnership: [
    { kpiId: 'kpi-defekty-na-milion-002', kpiCode: 'DPMO-002' },
    { kpiId: 'kpi-czas-przestoju-003', kpiCode: 'DWT-003' },
  ],
  performanceDistribution: { onTarget: 8, warning: 3, critical: 1, neutralOrMissing: 2 },
  overdueObligations: [
    {
      obligationId: 'obl-1',
      kpiId: 'kpi-oee-linia-pakowania-001',
      assigneeUserId: 'user-anna',
      obligationType: 'measurement_due',
      dueAt: '2026-08-05T00:00:00Z',
    },
  ],
  repeatedDeviations: [
    {
      kpiId: 'kpi-koszt-pracy-004',
      kpiCode: 'LC-004',
      caseCountLast180Days: 3,
      anySelfReportedRecurrence: true,
    },
  ],
  ineffectiveCorrectiveActions: [
    { caseId: 'case-1', kpiId: 'kpi-koszt-pracy-004', verificationId: 'ver-1', status: 'ineffective' as const },
  ],
};

const MOCK_OKR_ATTENTION = {
  staleCheckins: [{ setId: 'set-1', title: 'Q3 Sprzedaż', nextCheckinDueAt: '2026-08-01T00:00:00Z' }],
  lowConfidenceObjectives: [
    { keyResultId: 'kr-1', objectiveId: 'obj-1', setId: 'set-1', title: 'Zwiększ NPS', confidence: 'low' },
  ],
  openSupportRequests: [
    { requestId: 'sr-1', setId: 'set-1', objectiveId: 'obj-1', keyResultId: 'kr-1', assignedToUserId: 'user-anna', status: 'open' },
  ],
  openBlockers: [
    { checkInId: 'ci-1', keyResultId: 'kr-1', objectiveId: 'obj-1', setId: 'set-1', blocker: 'Brak dostępu do danych CRM' },
  ],
  escalatedSets: [{ setId: 'set-2', title: 'Redukcja kosztów Q3', attentionState: 'escalated' }],
};

const MOCK_TEAM_HEALTH = {
  countsByStatus: [{ status: 'active', count: 4 }],
  countsByScopeType: [{ scopeType: 'company', count: 1 }],
  attentionBreakdown: [{ attentionState: 'escalated', count: 1 }],
  sets: [
    { setId: 'set-1', currentVersion: 3, status: 'active', scopeType: 'team' },
    { setId: 'set-2', currentVersion: 5, status: 'active', scopeType: 'company' },
  ],
};

const NEVER_RESOLVES = new Promise(() => {});

function outcomeFor(state: string, ready: unknown, empty: unknown) {
  if (state === 'loading') return NEVER_RESOLVES;
  if (state === 'error') {
    const err: any = new Error('Failed to load attention data');
    err.status = 500;
    return Promise.reject(err);
  }
  if (state === 'empty') return Promise.resolve(empty);
  return Promise.resolve(ready);
}

const realGet = Api.get.bind(Api);
Api.get = (async (url: string) => {
  if (url.startsWith('/vnext/results/kpi/attention')) {
    return outcomeFor(kpiState, { attention: MOCK_KPI_ATTENTION }, {
      attention: {
        processCoverage: [],
        ownerLoad: [],
        missingOwnership: [],
        performanceDistribution: { onTarget: 0, warning: 0, critical: 0, neutralOrMissing: 0 },
        overdueObligations: [],
        repeatedDeviations: [],
        ineffectiveCorrectiveActions: [],
      },
    });
  }
  if (url.startsWith('/vnext/results/okr/attention')) {
    return outcomeFor(okrState, { attention: MOCK_OKR_ATTENTION }, {
      attention: { staleCheckins: [], lowConfidenceObjectives: [], openSupportRequests: [], openBlockers: [], escalatedSets: [] },
    });
  }
  if (url.startsWith('/vnext/results/okr/team-health')) {
    return outcomeFor(okrState, { teamHealth: MOCK_TEAM_HEALTH }, {
      teamHealth: { countsByStatus: [], countsByScopeType: [], attentionBreakdown: [], sets: [] },
    });
  }
  return realGet(url);
}) as typeof Api.get;

const ResultsVNextAttentionScreen: React.FC = () => (
  <div className="h-screen bg-c-bg text-c-text">
    <MemoryRouter initialEntries={['/results/attention']}>
      <Routes>
        <Route path="/results/attention" element={<ResultsAttentionPage />} />
        <Route path="/results/kpi" element={<div data-testid="dev-render-fake-kpi-route">KPI route</div>} />
        <Route path="/results/okr" element={<div data-testid="dev-render-fake-okr-route">OKR route</div>} />
      </Routes>
    </MemoryRouter>
  </div>
);

export default ResultsVNextAttentionScreen;
