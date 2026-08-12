/**
 * RN-G2 P2/G2-create — dev-render host for the REAL `ResultsRoiHub`
 * (`src/components/ResultsVNext/roi/ResultsRoiHub.tsx`) — the "All cases" /
 * "Benefits realization" registry tabs, the quick-create modal
 * (`RoiCaseCreateModal`) and the 7-transition dialog (`RoiTransitionDialog`).
 *
 * RN-G2 UI OQ-UI-I FIX (`docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md`):
 * this screen previously reassembled the registry from
 * `ResultsVNextRegistryShell` + `roiRegistryPresenters.tsx` builder
 * functions fed by hand-built props, with every callback (`onClose`,
 * `onRetry`, `onSubmit`, `onTransition`...) a no-op — a second
 * implementation of the screen, not the shipped one, so nothing exercised
 * here proved the real component's hooks/state/fetch orchestration. It now
 * mounts the ACTUAL `ResultsRoiHub` with `window.fetch` stubbed for
 * `/vnext/results/roi*` (the same bare-`fetch` client `roiApi.ts` uses —
 * NOT the giant `Api` object, see that file's header) plus
 * `${API_URL}/initiatives` (the quick-create initiative picker,
 * `InitiativeApi.getInitiatives`, also a bare `fetch`). Pattern mirrors
 * `results-vnext-roi-full-tool.tsx` (stateful mock DB, one real screen) —
 * this file's mock is registry-shaped instead (six cases spanning every
 * status bucket + a benefits-realization rollup) so bucket-chip filtering,
 * multi-row quick-create, and all 7 transitions have real data to exercise
 * through the REAL component, not a synthetic single-case fixture.
 * `onClose`/`onSubmit`/`onRetry` throughout are the REAL ones ResultsRoiHub
 * itself wires — nothing here overrides them with a no-op, so Esc/focus-
 * return through the quick-create modal and the transition dialog is
 * genuinely exercised when clicked through, not structurally unverifiable
 * (OQ-UI-G #2 / OQ-UI-I "onClose is a no-op" finding — closed for this
 * screen).
 *
 * URL params:
 *   ?state=ready|loading|empty|error   forces `GET /cases` outcome (both
 *                                       Menu 2 tabs share this — same
 *                                       convention the pre-existing screen
 *                                       and `results-vnext-roi-full-tool.tsx`
 *                                       already use)
 *   &calc=loading|ready                forces the "All cases" preview's lazy
 *                                       calculation-run fetch to stay
 *                                       in-flight vs resolved (default ready)
 *   &createResult=success|error|conflict   outcome of the NEXT `POST /cases`
 *                                       (quick-create submit); default success
 *   &transitionResult=success|error|conflict   outcome of the NEXT transition
 *                                       POST; default success
 *   &view=hub|case                     RN-G5 (2026-08-12): which real route
 *                                       to mount at — `hub` (`/results/roi`,
 *                                       `ResultsRoiHub`, default) or `case`
 *                                       (`/results/roi/cases/:roiCaseId`,
 *                                       `RoiCaseToolPage` — a REAL cold
 *                                       direct-URL entry, not a click-through)
 *   &caseId=<id>                       which case id the `case` view starts
 *                                       on; default 'roi-case-1'.
 *                                       'roi-case-9' is archived+cancelled
 *                                       (honest read-only render). Any id NOT
 *                                       in the mock DB (e.g. 'does-not-exist')
 *                                       404s -> the SAME forbidden state a
 *                                       cross-org id would (both collapse
 *                                       into one response server-side,
 *                                       D06/D07 — this mock does not fork
 *                                       them either)
 *
 * Golden-flow click chain (see acceptance report for the actual run):
 *   1. row click on a case -> preview opens, lazy calc-run resolves
 *   2. kebab -> a lifecycle transition -> `RoiTransitionDialog` -> submit
 *   3. Menu2 primary CTA "Nowa sprawa ROI" -> `RoiCaseCreateModal` -> submit
 *   4. Menu2 tab "Realizacja korzyści" -> row click -> preview
 *   5. Esc closes the last-opened modal; focus returns to its trigger
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ResultsRoiHub } from '../../src/components/ResultsVNext/roi/ResultsRoiHub';
import { RoiCaseToolPage } from '../../src/components/ResultsVNext/roi/RoiCaseToolPage';
import { ROUTES } from '../../src/routes/routeConfig';
import { API_URL } from '../../src/services/api';
import type { RoiCaseListItem, RoiCaseStatus, RoiCalculationRunSummary, RoiOrgBenefitsRealizationRow } from '../../src/components/ResultsVNext/roi/roiApi';

const harnessParams = new URLSearchParams(window.location.search);
const registryState = harnessParams.get('state') || 'ready';
const calcState = harnessParams.get('calc') || 'ready';
const createResultParam = (harnessParams.get('createResult') as 'success' | 'error' | 'conflict' | null) ?? 'success';
const transitionResultParam = (harnessParams.get('transitionResult') as 'success' | 'error' | 'conflict' | null) ?? 'success';
const view = harnessParams.get('view') === 'case' ? 'case' : 'hub';
const caseIdParam = harnessParams.get('caseId') || 'roi-case-1';

try {
  window.localStorage.setItem('ff.results_vnext_roi_registry', '1');
  // A fake, self-issued JWT — `tokenService.decodeToken` only base64-decodes
  // the payload, it never verifies a signature — under the `token` key
  // `tokenService.getToken()` reads. Deliberately NOT `auth_token`/
  // `consultify-storage` (the keys `getAuthToken()` in
  // `AccessPolicyContext.tsx` and friends read): those stay empty so the
  // heavy provider tree's own network calls keep no-op'ing, exactly as
  // `dev-render/mocks/seedStore.ts`'s header documents. This only unlocks
  // `ResultsRoiHub`'s own `resolveCurrentUserIdFromToken()` so the
  // quick-create form's owner field is a real id, not an honest-but-
  // untestable "missing" edge case.
  const payload = btoa(JSON.stringify({ id: 'user-piotr-demo', exp: 9999999999 }));
  window.localStorage.setItem('token', `header.${payload}.signature`);
} catch {
  // no-op — dev-render only
}

// ==========================================================================
// In-memory, STATEFUL mock DB — one case per status bucket + a benefits
// rollup, spanning the honest-missing domain (null / not_calculable / real).
// ==========================================================================

let seq = 0;
const nextId = (prefix: string) => `${prefix}-${(seq += 1)}`;

const cases: RoiCaseListItem[] = [
  {
    caseId: 'roi-case-1', organizationId: 'org-1', initiativeId: 'init-101',
    title: 'Automatyzacja linii pakowania', ownerUserId: 'user-anna-kowalska',
    status: 'modeling', currency: 'PLN', granularity: 'monthly',
    analysisStart: '2026-01-01', analysisEnd: '2026-12-31',
    nextActionType: 'complete_economic_model', nextActionDueAt: '2026-08-20', nextReviewAt: null,
    submittedAt: null, approvedAt: null, rejectedAt: null, rejectionReason: null,
    changesRequestedAt: null, changesRequestedReason: null, archivedAt: null,
    rowVersion: 3, createdAt: '2026-07-01T09:00:00Z', updatedAt: '2026-08-07T10:00:00Z',
  },
  {
    caseId: 'roi-case-2', organizationId: 'org-1', initiativeId: 'init-102',
    title: 'Migracja legacy MES', ownerUserId: 'user-tomasz-nowak',
    status: 'submitted_for_approval', currency: 'PLN', granularity: 'monthly',
    analysisStart: '2026-02-01', analysisEnd: '2027-01-31',
    nextActionType: 'review_decision', nextActionDueAt: '2026-08-15', nextReviewAt: null,
    submittedAt: '2026-08-02T12:00:00Z', approvedAt: null, rejectedAt: null, rejectionReason: null,
    changesRequestedAt: null, changesRequestedReason: null, archivedAt: null,
    rowVersion: 5, createdAt: '2026-06-15T09:00:00Z', updatedAt: '2026-08-02T12:00:00Z',
  },
  {
    caseId: 'roi-case-3', organizationId: 'org-1', initiativeId: 'init-103',
    title: 'Program szkoleń Lean (zero cost basis)', ownerUserId: 'user-piotr-wisniewski',
    status: 'approved', currency: 'PLN', granularity: 'annual',
    analysisStart: '2026-01-01', analysisEnd: '2028-12-31',
    nextActionType: 'start_tracking', nextActionDueAt: null, nextReviewAt: null,
    submittedAt: '2026-07-10T09:00:00Z', approvedAt: '2026-07-20T09:00:00Z', rejectedAt: null, rejectionReason: null,
    changesRequestedAt: null, changesRequestedReason: null, archivedAt: null,
    rowVersion: 8, createdAt: '2026-05-01T09:00:00Z', updatedAt: '2026-07-20T09:00:00Z',
  },
  {
    caseId: 'roi-case-4', organizationId: 'org-1', initiativeId: 'init-104',
    title: 'Rollup finansowy — jedno źródło', ownerUserId: 'user-anna-kowalska',
    status: 'tracking', currency: 'PLN', granularity: 'monthly',
    analysisStart: '2025-09-01', analysisEnd: '2026-08-31',
    nextActionType: 'record_actual', nextActionDueAt: '2026-08-31', nextReviewAt: '2026-09-01',
    submittedAt: '2025-08-01T09:00:00Z', approvedAt: '2025-08-15T09:00:00Z', rejectedAt: null, rejectionReason: null,
    changesRequestedAt: null, changesRequestedReason: null, archivedAt: null,
    rowVersion: 22, createdAt: '2025-07-01T09:00:00Z', updatedAt: '2026-08-05T09:00:00Z',
  },
  {
    caseId: 'roi-case-5', organizationId: 'org-1', initiativeId: 'init-105',
    title: 'Wdrożenie robotyzacji magazynu (odrzucone)', ownerUserId: 'user-tomasz-nowak',
    status: 'rejected', currency: 'PLN', granularity: 'monthly',
    analysisStart: '2026-01-01', analysisEnd: '2026-12-31',
    nextActionType: null, nextActionDueAt: null, nextReviewAt: null,
    submittedAt: '2026-06-01T09:00:00Z', approvedAt: null, rejectedAt: '2026-06-10T09:00:00Z',
    rejectionReason: 'Założenia bazowe niespójne z audytem finansowym Q2.',
    changesRequestedAt: null, changesRequestedReason: null, archivedAt: null,
    rowVersion: 6, createdAt: '2026-05-10T09:00:00Z', updatedAt: '2026-06-10T09:00:00Z',
  },
  {
    caseId: 'roi-case-6', organizationId: 'org-1', initiativeId: 'init-106',
    title: 'Cyfryzacja obiegu dokumentów (szkic)', ownerUserId: 'user-piotr-wisniewski',
    status: 'draft', currency: 'EUR', granularity: 'monthly',
    analysisStart: null, analysisEnd: null,
    nextActionType: 'set_baseline', nextActionDueAt: null, nextReviewAt: null,
    submittedAt: null, approvedAt: null, rejectedAt: null, rejectionReason: null,
    changesRequestedAt: null, changesRequestedReason: null, archivedAt: null,
    rowVersion: 1, createdAt: '2026-08-01T09:00:00Z', updatedAt: '2026-08-01T09:00:00Z',
  },
  // RN-G5 (2026-08-12) — ARCHIVED case, reachable ONLY via a direct id (the
  // registry's default `listRoiCases` excludes archived rows server-side;
  // `getRoiCase` uses `includeArchived: true` so a known id must still
  // resolve — `roi.routes.ts` "GET /cases/:caseId" comment). Proves
  // `RoiCaseToolPage`/`RoiCaseFullTool` render an honest, read-only view for
  // a terminal+archived record instead of a blank/broken screen.
  {
    caseId: 'roi-case-9', organizationId: 'org-1', initiativeId: 'init-109',
    title: 'Program pilotażowy IoT (zarchiwizowany)', ownerUserId: 'user-tomasz-nowak',
    status: 'cancelled', currency: 'PLN', granularity: 'monthly',
    analysisStart: '2025-01-01', analysisEnd: '2025-12-31',
    nextActionType: null, nextActionDueAt: null, nextReviewAt: null,
    submittedAt: '2025-02-01T09:00:00Z', approvedAt: null, rejectedAt: null, rejectionReason: null,
    changesRequestedAt: null, changesRequestedReason: null,
    archivedAt: '2025-12-15T09:00:00Z',
    rowVersion: 4, createdAt: '2025-01-05T09:00:00Z', updatedAt: '2025-12-15T09:00:00Z',
  },
];

// Mock calculation runs, keyed by caseId — spans the honest-missing domain:
//   roi-case-1 -> no run yet (null)
//   roi-case-2 -> completed, all real values
//   roi-case-3 -> completed, but irrStatus !== 'computed' (not_calculable IRR)
//   roi-case-4 -> failed run (not_calculable everywhere)
const MOCK_RUNS: Record<string, RoiCalculationRunSummary | null> = {
  'roi-case-1': null,
  'roi-case-2': {
    runId: 'run-2', caseId: 'roi-case-2', status: 'completed', scenarioId: null,
    totalCosts: 420000, totalFinancialBenefits: 980000, simpleRoi: 133.3, npv: 512000,
    irrPct: 34.2, irrStatus: 'computed', paybackPeriods: 14, discountedPaybackPeriods: 16,
    benefitCostRatio: 2.33, warnings: [], completedAt: '2026-08-02T11:00:00Z', createdAt: '2026-08-02T11:00:00Z',
  },
  'roi-case-3': {
    runId: 'run-3', caseId: 'roi-case-3', status: 'completed', scenarioId: null,
    totalCosts: 0, totalFinancialBenefits: 210000, simpleRoi: null, npv: 198000,
    irrPct: null, irrStatus: 'no_sign_change', paybackPeriods: 0, discountedPaybackPeriods: 0,
    benefitCostRatio: null, warnings: ['Zero-cost basis — cost line total is 0'],
    completedAt: '2026-07-19T11:00:00Z', createdAt: '2026-07-19T11:00:00Z',
  },
  'roi-case-4': {
    runId: 'run-4', caseId: 'roi-case-4', status: 'failed', scenarioId: null,
    totalCosts: null, totalFinancialBenefits: null, simpleRoi: null, npv: null,
    irrPct: null, irrStatus: 'not_applicable', paybackPeriods: null, discountedPaybackPeriods: null,
    benefitCostRatio: null, warnings: ['Mixed-currency benefit lines could not be resolved'],
    completedAt: '2026-08-04T09:00:00Z', createdAt: '2026-08-04T09:00:00Z',
  },
};

const benefitsRows: RoiOrgBenefitsRealizationRow[] = [
  { caseId: 'roi-case-4', initiativeId: 'init-104', title: 'Rollup finansowy — jedno źródło', status: 'tracking', approvedFinancialBenefits: 140000, actualFinancialBenefits: 98000, benefitsRealizationPct: 70 },
  { caseId: 'roi-case-7', initiativeId: 'init-107', title: 'Optymalizacja logistyki dostaw', status: 'benefits_realization', approvedFinancialBenefits: 260000, actualFinancialBenefits: null, benefitsRealizationPct: null },
  { caseId: 'roi-case-8', initiativeId: 'init-108', title: 'Konsolidacja centrów danych (zero denominator)', status: 'tracking', approvedFinancialBenefits: 0, actualFinancialBenefits: 12000, benefitsRealizationPct: null },
];

// Mock initiatives — deliberately overlap with `cases[*].initiativeId`
// (init-101..106) plus two extra WITHOUT an existing ROI case yet
// (init-201/202), so a QA reviewer can see the picker is a real,
// independent initiative list, not derived from the case rows on screen.
const MOCK_INITIATIVES = [
  { id: 'init-101', title: 'Automatyzacja linii pakowania' },
  { id: 'init-102', title: 'Migracja legacy MES' },
  { id: 'init-103', title: 'Program szkoleń Lean' },
  { id: 'init-104', title: 'Rollup finansowy — jedno źródło' },
  { id: 'init-105', title: 'Wdrożenie robotyzacji magazynu' },
  { id: 'init-106', title: 'Cyfryzacja obiegu dokumentów' },
  { id: 'init-201', title: 'Konsolidacja dostawców logistycznych' },
  { id: 'init-202', title: 'Modernizacja floty serwisowej' },
];

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function errorResponse(message: string, status: number, code?: string): Response {
  return jsonResponse({ error: message, code }, status);
}

const STATUS_AFTER: Record<string, RoiCaseStatus> = {
  approve: 'approved',
  reject: 'rejected',
  'request-changes': 'changes_requested',
  'reopen-for-revision': 'modeling',
  cancel: 'cancelled',
  'start-pir': 'post_investment_review',
  close: 'closed',
};

const g = window as unknown as { __RVN_ROI_REGISTRY_FETCH__?: boolean };
if (!g.__RVN_ROI_REGISTRY_FETCH__) {
  g.__RVN_ROI_REGISTRY_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (rawUrl.includes('/locales/')) return realFetch(input as RequestInfo, init);

    // ---- InitiativeApi.getInitiatives (quick-create's picker) ----
    if (rawUrl.includes(`${API_URL}/initiatives`)) {
      return jsonResponse(MOCK_INITIATIVES);
    }

    const m = rawUrl.match(/\/vnext\/results\/roi(\/.*)?$/);
    if (!m) return realFetch(input as RequestInfo, init);

    const method = (init?.method ?? 'GET').toUpperCase();
    const [path] = (m[1] ?? '/').split('?');
    const body: any = init?.body ? JSON.parse(String(init.body)) : {};
    const seg = path.split('/').filter(Boolean);

    if (path === '/org/benefits-realization') {
      if (registryState === 'error') return errorResponse('Upstream ROI service returned a 503.', 503, 'ROI_INTERNAL_ERROR');
      if (registryState === 'empty') return jsonResponse({ attention: { cases: [], portfolioTotals: { totalApprovedFinancialBenefits: 0, totalActualFinancialBenefits: 0, caseCountWithActual: 0, caseCountTotal: 0 } } });
      return jsonResponse({
        attention: {
          cases: benefitsRows,
          portfolioTotals: {
            totalApprovedFinancialBenefits: benefitsRows.reduce((s, r) => s + (r.approvedFinancialBenefits ?? 0), 0),
            totalActualFinancialBenefits: benefitsRows.reduce((s, r) => s + (r.actualFinancialBenefits ?? 0), 0),
            caseCountWithActual: benefitsRows.filter((r) => r.actualFinancialBenefits !== null).length,
            caseCountTotal: benefitsRows.length,
          },
        },
      });
    }

    if (path === '/cases' && method === 'GET') {
      if (registryState === 'loading') return new Promise(() => { /* never resolves */ });
      if (registryState === 'error') return errorResponse('Upstream ROI service returned a 503.', 503, 'ROI_INTERNAL_ERROR');
      if (registryState === 'empty') return jsonResponse({ cases: [] });
      return jsonResponse({ cases });
    }
    if (path === '/cases' && method === 'POST') {
      if (createResultParam === 'error') return errorResponse('Nazwa sprawy jest wymagana.', 400, 'VALIDATION_ERROR');
      if (createResultParam === 'conflict') return errorResponse('Sprawa została zmieniona przez kogoś innego w międzyczasie.', 409, 'STALE_VERSION');
      const created: RoiCaseListItem = {
        caseId: nextId('roi-case'), organizationId: 'org-1', initiativeId: body.initiativeId,
        title: body.title, ownerUserId: body.ownerUserId, status: 'draft',
        currency: body.currency, granularity: 'monthly', analysisStart: null, analysisEnd: null,
        nextActionType: 'set_baseline', nextActionDueAt: null, nextReviewAt: null,
        submittedAt: null, approvedAt: null, rejectedAt: null, rejectionReason: null,
        changesRequestedAt: null, changesRequestedReason: null, archivedAt: null,
        rowVersion: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      cases.unshift(created);
      return jsonResponse({ outcome: 'applied', created: true, case: created }, 201);
    }

    const transitionMatch = seg[0] === 'cases' && seg[2] === 'transitions';
    if (transitionMatch && method === 'POST') {
      const caseId = seg[1];
      const action = seg[3] ?? '';
      const target = cases.find((c) => c.caseId === caseId);
      if (!target) return errorResponse('ROI case not found', 404, 'NOT_FOUND');
      if (transitionResultParam === 'error') return errorResponse('Powód jest wymagany dla tego przejścia.', 400, 'VALIDATION_ERROR');
      if (transitionResultParam === 'conflict') return errorResponse('Sprawa została zmieniona przez kogoś innego w międzyczasie.', 409, 'STALE_VERSION', );
      const next = STATUS_AFTER[action];
      if (next) target.status = next;
      target.rowVersion += 1;
      target.updatedAt = new Date().toISOString();
      if (action === 'reject') target.rejectionReason = body.rejectionReason ?? null;
      if (action === 'request-changes') target.changesRequestedReason = body.changeRequestNotes ?? null;
      return jsonResponse({ outcome: 'applied', case: target });
    }

    if (seg[0] === 'cases' && seg.length === 2 && method === 'GET') {
      // RN-G5 (2026-08-12) — the same `?state=` param the "All cases" list
      // above respects, reused here for `RoiCaseToolPage`'s OWN load state
      // (`?view=case`). A nonexistent id and a cross-org id are
      // INDISTINGUISHABLE 404s (matches the real `getRoiCase` server route —
      // organization-scoped query, no row for either case, D06/D07) — this
      // mock does not special-case a "cross-org" id differently, on purpose.
      if (registryState === 'loading') return new Promise(() => { /* never resolves */ });
      if (registryState === 'error') return errorResponse('Upstream ROI service returned a 503.', 503, 'ROI_INTERNAL_ERROR');
      const found = cases.find((c) => c.caseId === seg[1]);
      return found ? jsonResponse({ case: found }) : errorResponse('ROI case not found', 404, 'NOT_FOUND');
    }

    if (seg[2] === 'calculation-runs' && method === 'GET') {
      const caseId = seg[1];
      if (calcState === 'loading') return new Promise(() => { /* never resolves */ });
      const run = MOCK_RUNS[caseId] ?? null;
      return jsonResponse({ runs: run ? [run] : [] });
    }

    return errorResponse(`dev-render ROI registry mock: unmatched ${method} ${path}`, 404, 'MOCK_UNMATCHED');
  };
}

// RN-G5 (2026-08-12) — a REAL two-route `<Routes>` tree (same convention
// `results-vnext-kpi-tool.tsx` established for the KPI tool), not a single
// static entry — proves the "Open full tool" row action's `navigate()`,
// the `RoiCaseToolPage` cold direct-URL load, and its "back to registry"
// breadcrumb all exercise the REAL router, not a stubbed no-op. A
// `/results/roi` marker distinct from the real `ResultsRoiHub` render is
// deliberately NOT used here (unlike the KPI harness) — this screen's own
// golden-flow click chain (see file header) already exercises the real Hub
// at that path, so swapping it for a marker would break that chain when
// `view=hub` (the default).
const initialPath =
  view === 'case' ? ROUTES.RESULTS_ROI.CASE.replace(':roiCaseId', caseIdParam) : ROUTES.RESULTS_ROI.ROOT;

const ResultsVNextRoiRegistryScreen: React.FC = () => (
  <div className="h-screen bg-c-bg text-c-text">
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path={ROUTES.RESULTS_ROI.ROOT} element={<ResultsRoiHub />} />
        <Route path={ROUTES.RESULTS_ROI.CASE} element={<RoiCaseToolPage />} />
      </Routes>
    </MemoryRouter>
  </div>
);

export default ResultsVNextRoiRegistryScreen;
