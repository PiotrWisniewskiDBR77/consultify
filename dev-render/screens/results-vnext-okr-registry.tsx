/**
 * RN-G2 P3 #23 — visual QA harness for the OKR Set registry.
 *
 * ── OQ-UI-I FIX (2026-08-11, RN-G3 lane `okr` full-tool task) ────────────
 * Independent verification found this screen did NOT mount the real
 * `ResultsOkrHub` — it rebuilt the screen from `ResultsVNextRegistryShell` +
 * the presenter functions directly, with every callback (`onRetry`,
 * `onChipChange`, row-menu actions beyond preview) wired to a no-op. That
 * proves the PRESENTERS render correctly; it proves nothing about
 * `ResultsOkrHub`'s own hook order, fetch orchestration, or state machine —
 * exactly the class of defect that only surfaced in the KPI registry
 * because that harness (uniquely, before this fix) mounted the real
 * component. Recorded as OQ-UI-I in `RN_G2_OPEN_QUESTIONS_UI.md`.
 *
 * Fixed here: mounts the REAL `ResultsOkrHub` (which itself owns
 * `ResultsVNextRegistryShell` + the drill-down state machine down to
 * `OkrSetWorkspace`/`OkrObjectivesView`/etc.), with `window.fetch` stubbed
 * for `/api/vnext/results/okr/*` (same pattern as
 * `results-vnext-legacy-archive.tsx`/`assessment-initiatives-panel.tsx` —
 * `okrApi.ts` uses a raw `fetch()` client, not the `Api.*` facade, so
 * stubbing `Api` methods would not intercept anything here). The mock data
 * below is UNCHANGED from the prior version (all 10 statuses, the genuine
 * 2-way honest-missing domain for `overallProgress`/`overallConfidence` —
 * see the retained note further down) — only the mounting mechanism
 * changed, so this screen's own visual output is expected to be pixel-
 * identical to before the fix.
 *
 * URL params:
 *   ?tab=org|my|company           which Menu 2 tab (default org) — all three
 *                                  now genuinely hit DIFFERENT stubbed routes
 *                                  (`/sets`, `/my`, `/company`), same as the
 *                                  real backend's own three distinct routes.
 *   &state=ready|loading|empty|error   loading/error freeze the stub (never
 *                                  resolves / always 503); empty returns [].
 *   &selected=<setId|none>        deep-link via `?setId=` (real Hub's own
 *                                  deep-link param) — 'none' leaves nothing
 *                                  selected.
 *   &view=hub|set                 RN-G5 (2026-08-12): which real route to
 *                                  mount at — `hub` (`/results/okr`,
 *                                  `ResultsOkrHub`, default) or `set`
 *                                  (`/results/okr/sets/:okrSetId`,
 *                                  `OkrSetToolPage` — a REAL cold direct-URL
 *                                  entry, not a click-through).
 *   &setId=<id>                   which set id the `set` view starts on
 *                                  (default 'okr-set-5', an active set);
 *                                  'okr-set-8' is closed/terminal (honest
 *                                  read-only render). Any id NOT in
 *                                  `MOCK_SETS` (e.g. 'does-not-exist') 404s
 *                                  -> the SAME forbidden state a cross-org id
 *                                  would (both collapse into one response
 *                                  server-side, D06/D07).
 */
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { ResultsOkrHub } from '../../src/components/ResultsVNext/okr/ResultsOkrHub';
import { OkrSetToolPage } from '../../src/components/ResultsVNext/okr/OkrSetToolPage';
import type { OkrSetDto } from '../../src/components/ResultsVNext/okr/okrApi';
import { ROUTES } from '../../src/routes/routeConfig';

// ── Mock OKR Sets — one representative row per real status (all 10 from
//    `OKR_SET_STATUSES`, including the two reserved/unreachable ones for
//    exhaustiveness) and spanning the genuine 2-way honest-missing domain
//    for overallProgress/overallConfidence (real value vs null — see
//    `okrRegistryMappers.ts`'s `parseOkrProgress` doc comment for why a 3rd
//    `'not_calculable'` row is deliberately absent: the wire cannot carry
//    that distinction for a Set, only for Objectives/Key Results).
const MOCK_SETS: OkrSetDto[] = [
  {
    setId: 'okr-set-1',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'team',
    scopeId: 'team-operations',
    ownerUserId: 'user-anna-kowalska',
    reviewerUserId: 'user-piotr-wisniewski',
    title: 'Zbudować cyfrową dojrzałość operacji do poziomu 4',
    status: 'draft',
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 1,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-08-01T09:00:00Z',
    updatedBy: null,
    updatedAt: '2026-08-01T09:00:00Z',
  },
  {
    setId: 'okr-set-2',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'business_unit',
    scopeId: 'bu-manufacturing',
    ownerUserId: 'user-tomasz-nowak',
    reviewerUserId: 'user-piotr-wisniewski',
    title: 'Uzyskać dyscyplinę finansową portfela inicjatyw (wymaga poprawek)',
    status: 'changes_requested',
    submittedBy: 'user-tomasz-nowak',
    submittedAt: '2026-08-02T10:00:00Z',
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: 'user-piotr-wisniewski',
    changesRequestedAt: '2026-08-04T14:00:00Z',
    changesRequestedReason: 'Key Result 2 nie ma zdefiniowanej geometrii docelowej — uzupełnij przed ponownym złożeniem.',
    currentVersion: 2,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 3,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-07-20T09:00:00Z',
    updatedBy: 'user-piotr-wisniewski',
    updatedAt: '2026-08-04T14:00:00Z',
  },
  {
    setId: 'okr-set-3',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'team',
    scopeId: 'team-quality',
    ownerUserId: 'user-piotr-wisniewski',
    reviewerUserId: 'user-anna-kowalska',
    title: 'Ograniczyć reklamacje jakościowe o połowę',
    status: 'submitted',
    submittedBy: 'user-piotr-wisniewski',
    submittedAt: '2026-08-08T11:00:00Z',
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 2,
    createdBy: 'user-piotr-wisniewski',
    createdAt: '2026-07-25T09:00:00Z',
    updatedBy: 'user-piotr-wisniewski',
    updatedAt: '2026-08-08T11:00:00Z',
  },
  {
    setId: 'okr-set-4',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'company',
    scopeId: 'org-1',
    ownerUserId: 'user-anna-kowalska',
    reviewerUserId: null,
    title: 'Uzyskać certyfikację ISO 27001 dla całej organizacji',
    status: 'approved',
    submittedBy: 'user-anna-kowalska',
    submittedAt: '2026-07-15T09:00:00Z',
    approvedBy: 'user-piotr-wisniewski',
    approvedAt: '2026-07-20T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-4-v1',
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 4,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-07-01T09:00:00Z',
    updatedBy: 'user-piotr-wisniewski',
    updatedAt: '2026-07-20T09:00:00Z',
  },
  {
    setId: 'okr-set-5',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h2',
    scopeType: 'individual',
    scopeId: 'user-anna-kowalska',
    ownerUserId: 'user-anna-kowalska',
    reviewerUserId: 'user-tomasz-nowak',
    title: 'Wdrożyć MES na 3 liniach produkcyjnych',
    status: 'active',
    submittedBy: 'user-anna-kowalska',
    submittedAt: '2026-06-01T09:00:00Z',
    approvedBy: 'user-tomasz-nowak',
    approvedAt: '2026-06-05T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-5-v1',
    overallProgress: '0.625',
    overallConfidence: 'medium',
    attentionState: 'watch',
    lastCheckinAt: '2026-08-05T09:00:00Z',
    nextCheckinDueAt: '2026-08-19T09:00:00Z',
    carriedFromSetId: null,
    rowVersion: 9,
    createdBy: 'user-anna-kowalska',
    createdAt: '2026-06-01T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2026-08-05T09:00:00Z',
  },
  {
    setId: 'okr-set-6',
    organizationId: 'org-1',
    programId: 'program-fy26',
    cycleId: 'cycle-fy26-h1',
    scopeType: 'business_unit',
    scopeId: 'bu-manufacturing',
    ownerUserId: 'user-tomasz-nowak',
    reviewerUserId: 'user-piotr-wisniewski',
    title: 'Skrócić czas przezbrojenia linii A o 30%',
    status: 'active',
    submittedBy: 'user-tomasz-nowak',
    submittedAt: '2026-02-01T09:00:00Z',
    approvedBy: 'user-piotr-wisniewski',
    approvedAt: '2026-02-05T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-6-v1',
    overallProgress: '0.91',
    overallConfidence: 'high',
    attentionState: 'none',
    lastCheckinAt: '2026-08-07T09:00:00Z',
    nextCheckinDueAt: '2026-08-21T09:00:00Z',
    carriedFromSetId: null,
    rowVersion: 12,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2026-01-15T09:00:00Z',
    updatedBy: 'user-tomasz-nowak',
    updatedAt: '2026-08-07T09:00:00Z',
  },
  {
    setId: 'okr-set-7',
    organizationId: 'org-1',
    programId: 'program-fy25',
    cycleId: 'cycle-fy25-h2',
    scopeType: 'team',
    scopeId: 'team-quality',
    ownerUserId: 'user-piotr-wisniewski',
    reviewerUserId: 'user-anna-kowalska',
    title: 'Zredukować liczbę reklamacji dostawców o 20% (przegląd)',
    status: 'review',
    submittedBy: 'user-piotr-wisniewski',
    submittedAt: '2026-01-10T09:00:00Z',
    approvedBy: 'user-anna-kowalska',
    approvedAt: '2026-01-15T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-7-v1',
    overallProgress: '1.04',
    overallConfidence: 'high',
    attentionState: 'none',
    lastCheckinAt: '2026-07-28T09:00:00Z',
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 15,
    createdBy: 'user-piotr-wisniewski',
    createdAt: '2026-01-01T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2026-07-28T09:00:00Z',
  },
  {
    setId: 'okr-set-8',
    organizationId: 'org-1',
    programId: 'program-fy25',
    cycleId: 'cycle-fy25-h1',
    scopeType: 'company',
    scopeId: 'org-1',
    ownerUserId: 'user-anna-kowalska',
    reviewerUserId: null,
    title: 'Wejść na rynek DACH z ofertą konsultingową',
    status: 'closed',
    submittedBy: 'user-anna-kowalska',
    submittedAt: '2025-07-01T09:00:00Z',
    approvedBy: 'user-piotr-wisniewski',
    approvedAt: '2025-07-05T09:00:00Z',
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: 1,
    latestApprovedSnapshotId: 'snap-8-v1',
    overallProgress: '0.78',
    overallConfidence: 'medium',
    attentionState: 'none',
    lastCheckinAt: '2025-12-20T09:00:00Z',
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 20,
    createdBy: 'user-anna-kowalska',
    createdAt: '2025-06-01T09:00:00Z',
    updatedBy: 'user-piotr-wisniewski',
    updatedAt: '2025-12-31T09:00:00Z',
  },
  {
    setId: 'okr-set-9',
    organizationId: 'org-1',
    programId: 'program-fy25',
    cycleId: 'cycle-fy25-h1',
    scopeType: 'individual',
    scopeId: 'user-tomasz-nowak',
    ownerUserId: 'user-tomasz-nowak',
    reviewerUserId: 'user-anna-kowalska',
    title: 'Przejść certyfikację Six Sigma Green Belt (anulowane)',
    status: 'cancelled',
    submittedBy: null,
    submittedAt: null,
    approvedBy: null,
    approvedAt: null,
    changesRequestedBy: null,
    changesRequestedAt: null,
    changesRequestedReason: null,
    currentVersion: 1,
    approvedVersion: null,
    latestApprovedSnapshotId: null,
    overallProgress: null,
    overallConfidence: null,
    attentionState: 'none',
    lastCheckinAt: null,
    nextCheckinDueAt: null,
    carriedFromSetId: null,
    rowVersion: 2,
    createdBy: 'user-tomasz-nowak',
    createdAt: '2025-08-01T09:00:00Z',
    updatedBy: 'user-anna-kowalska',
    updatedAt: '2025-08-10T09:00:00Z',
  },
];

const params = new URLSearchParams(window.location.search);
const state = params.get('state') || 'ready';
// RN-G5 (2026-08-12) — which real route to mount at, mirroring
// `results-vnext-roi-registry.tsx`'s own `?view=`. `set` (a REAL cold
// direct-URL entry to `OkrSetToolPage`) needs the `okrRegistry` flag ON —
// unlike the rest of this file, which mounts `ResultsOkrHub` directly and so
// never needed the flag before (that Hub itself doesn't gate on it).
const view = params.get('view') === 'set' ? 'set' : 'hub';
const setIdParam = params.get('setId') || 'okr-set-5';
try {
  window.localStorage.setItem('ff.results_vnext_okr_registry', '1');
} catch {
  // no-op — dev-render only
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const g = window as unknown as { __OKR_REGISTRY_FETCH__?: boolean };
if (!g.__OKR_REGISTRY_FETCH__) {
  g.__OKR_REGISTRY_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (!url.includes('/api/vnext/results/okr/')) return realFetch(input as RequestInfo, init);
      if (state === 'loading') return new Promise<Response>(() => {}); // never resolves
      if (state === 'error') return jsonResponse({ error: 'Service unavailable', code: 'OKR_UNAVAILABLE' }, 503);
      const rows = state === 'empty' ? [] : MOCK_SETS;
      // Three genuinely distinct real routes — org (`/sets`, no scope
      // narrowing), `/my` (owner-or-reviewer only), `/company` (scope_type
      // pinned) — mirrors the real three-tab distinction the Hub itself
      // documents in its own header.
      if (url.match(/\/sets\/[^/?]+$/)) {
        const setId = url.split('/sets/')[1]?.split(/[?/]/)[0];
        const set = MOCK_SETS.find((s) => s.setId === setId);
        return set ? jsonResponse({ set }) : jsonResponse({ error: 'not found', code: 'NOT_FOUND' }, 404);
      }
      if (url.match(/\/sets(\?|$)/)) return jsonResponse({ sets: rows });
      if (url.match(/\/my(\?|$)/)) return jsonResponse({ sets: rows.filter((s) => s.ownerUserId === 'user-anna-kowalska' || s.reviewerUserId === 'user-anna-kowalska') });
      if (url.match(/\/company(\?|$)/)) return jsonResponse({ sets: rows.filter((s) => s.scopeType === 'company') });
    } catch {
      /* fall through to real fetch */
    }
    return realFetch(input as RequestInfo, init);
  };
}

// RN-G5 (2026-08-12) — a REAL two-route `<Routes>` tree (same convention
// `results-vnext-kpi-tool.tsx`/`results-vnext-roi-registry.tsx` use) so the
// Sets registry's "Otwórz obszar roboczy" `navigate()`, the `OkrSetToolPage`
// cold direct-URL load, and its "back to registry" breadcrumb all exercise
// the REAL router. `PROGRAMS`/`.CYCLES` get plain marker routes (their own
// real page is `OkrProgramsPage`/`OkrCyclesPage`, already covered by the
// separate `results-vnext-okr-admin.tsx` harness) — this file's own job is
// only to prove the two new registry buttons `navigate()` to the EXACT
// right path, not to re-render those pages' own mock plumbing a second
// time.
const initialPath = view === 'set' ? ROUTES.RESULTS_OKR.SET.replace(':okrSetId', setIdParam) : ROUTES.RESULTS_OKR.ROOT;

const ResultsVNextOkrRegistryScreen: React.FC = () => {
  useTranslation();
  return (
    <div className="h-screen bg-c-bg text-c-text">
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path={ROUTES.RESULTS_OKR.ROOT} element={<ResultsOkrHub />} />
          <Route path={ROUTES.RESULTS_OKR.SET} element={<OkrSetToolPage />} />
          <Route
            path={ROUTES.RESULTS_OKR.PROGRAMS}
            element={<div data-testid="dev-render-okr-programs-marker" className="p-6 text-c-text">Programy OKR (dev-render marker — realna strona: OkrProgramsPage, harness results-vnext-okr-admin.tsx)</div>}
          />
          <Route
            path={ROUTES.RESULTS_OKR.CYCLES}
            element={<div data-testid="dev-render-okr-cycles-marker" className="p-6 text-c-text">Cykle OKR (dev-render marker — realna strona: OkrCyclesPage, harness results-vnext-okr-admin.tsx)</div>}
          />
        </Routes>
      </MemoryRouter>
    </div>
  );
};

export default ResultsVNextOkrRegistryScreen;
