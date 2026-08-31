/**
 * #71 odbiór — Mock host for the REAL `AssessmentHub` screen
 * (src/components/assessment/AssessmentHub.tsx — 'list' tab), with the
 * `assessmentMenu3StatusChips` flag forced ON, so the supervisor can
 * screenshot the ACTUAL Menu 3 clickable status-filter chip row (not a
 * `StandardModuleBar`/`StandardTable` re-implementation — see
 * dev-render/screens/assessment-list.tsx, which is a *different*,
 * synthetic component and does NOT exercise AssessmentMenu3ActionBar at all).
 *
 * Same pattern as the other "legacy hub" stories (finance-hub.tsx,
 * discovery-tools-hub.tsx): mount the real component inside the real
 * `AppProviders` tree, seed a demo session (no auth token — see
 * seedStore.ts for why that keeps token-gated fetches from hitting a live
 * backend), and monkey-patch the specific `Api` methods this screen calls
 * on mount (`Api` is a plain exported object — `export const Api = {...}`
 * — so reassigning a method patches the same singleton every module imports).
 *
 * Flag mechanism note: `AppProviders`' <FeatureFlagsProvider> does NOT pass
 * `config={{ enableLocalOverrides: true }}` (grep confirms `enableLocalOverrides`
 * is never set `true` anywhere in src/ — production never honours the
 * `?ff_x=1` style local override for this flag family, only the
 * `consultify_feature_flags` localStorage-backed override read at hook init
 * AND only once `enableLocalOverrides` is true). So this harness wraps
 * AssessmentHub in its OWN inner <FeatureFlagsProvider config={{enableLocalOverrides:true}}>
 * — harness-only, never ships — which shadows the outer one for
 * `useFeatureFlagsContext()`, and seeds the localStorage override before
 * first render so `isEnabled('assessmentMenu3StatusChips')` resolves true.
 */
import React from 'react';

import { AssessmentHub } from '../../src/components/assessment/AssessmentHub';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import {
  DRD_METHOD_PACK_ID,
  DRD_METHOD_PACK_VERSION,
} from '../../src/method-core/methods/drd/compileDrdPack';
import { AppProviders } from '../../src/providers/AppProviders';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';
import { seedRealisticSession } from '../mocks/seedStore';

seedRealisticSession();

// AppProviders' <ThemeSync> reads `theme` from useAppStore and re-applies the
// `.dark` DOM class on mount — the store's default is 'dark' (uiSlice.ts),
// which overrides main.tsx's URL-driven classList.toggle. Sync the store to
// the harness's ?theme= query param so light/dark screenshots actually differ.
useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

// Force the flag ON via the same localStorage-backed override the app's own
// useFeatureFlags() hook reads at init (STORAGE_KEY = 'consultify_feature_flags').
// Only takes effect because the inner <FeatureFlagsProvider> below passes
// `enableLocalOverrides: true` (the real AppProviders tree never does).
try {
  const existing = JSON.parse(localStorage.getItem('consultify_feature_flags') || '{}');
  localStorage.setItem(
    'consultify_feature_flags',
    JSON.stringify({ ...existing, assessmentMenu3StatusChips: true })
  );
} catch {
  // ignore
}

// `assessmentFiveSurfacesV1` (src/hooks/useFeatureFlags.tsx) flipped its
// `defaultValue` to `true` 2026-08-01, AFTER this screen was built passing
// `initialTab="list"` below. `AssessmentHub`'s mount effect only honours
// `initialTab` when it's one of the 5 CURRENT tab ids
// (`FIVE_SURFACES_TAB_IDS` — library/processes/outputs/reports/initiatives);
// the legacy id `'list'` isn't in that set (only the *URL* `?tab=list` gets
// normalized to `processes`, via `resolveFiveSurfacesTabFromUrl` — the prop
// path doesn't reuse it), so `initialTab="list"` now silently falls back to
// the 'library' tab. `statusCounts` (AssessmentHub.tsx) only computes real
// counts for the 'list'/'processes' case — 'library' isn't in that switch,
// so every Menu 3 chip renders 0 regardless of how many assessments are
// loaded. Forcing `?tab=processes` in the URL before mount (the same
// belt-and-suspenders approach `assessment-artifacts-restart.tsx` uses for
// `?tab=outputs`) — plus passing `initialTab="processes"` below — lands this
// screen back on the surface it actually demonstrates.
{
  const p = new URLSearchParams(window.location.search);
  p.set('tab', 'processes');
  window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
}

// 4 assessments spanning draft / in_review / completed so the Menu 3 status
// chip row (dot + count per status) has real variety to show off.
const MOCK_ASSESSMENTS = [
  {
    id: 'assess-1',
    name: 'DBR77 · Digital Readiness Diagnosis — Grupa',
    description: 'Pełna diagnoza 39 obszarów / 5 osi — runda Q3 2026.',
    status: 'in_review',
    type: 'drd',
    progress: 72,
    overallScore: 3.4,
    createdAt: '2026-06-02T08:00:00Z',
    updatedAt: '2026-07-10T11:20:00Z',
    createdBy: 'user-piotr-demo',
  },
  {
    id: 'assess-2',
    name: 'Segment Manufacturing — DRD Light',
    description: 'Skrócona diagnoza pilotażowa — 3 osie priorytetowe.',
    status: 'completed',
    type: 'drd_light',
    progress: 100,
    overallScore: 4.1,
    createdAt: '2026-05-20T08:00:00Z',
    updatedAt: '2026-07-08T09:15:00Z',
    createdBy: 'user-anna-demo',
  },
  {
    id: 'assess-3',
    name: 'Segment Logistics — DRD Light',
    description: 'Nierozpoczęta — czeka na kickoff z liderem BU.',
    status: 'draft',
    type: 'drd_light',
    progress: 0,
    overallScore: 0,
    createdAt: '2026-07-11T08:00:00Z',
    updatedAt: '2026-07-11T08:00:00Z',
    createdBy: 'user-marek-demo',
  },
  {
    id: 'assess-4',
    name: 'Grupa Consultify — Roczna re-diagnoza',
    description: 'Porównanie rok do roku, delta +0.6 vs 2025.',
    status: 'completed',
    type: 'drd',
    progress: 100,
    overallScore: 3.9,
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-06-30T10:00:00Z',
    createdBy: 'user-piotr-demo',
  },
  {
    id: 'assess-5',
    name: 'Segment Sales & Marketing',
    description: 'Wynik wstępny — czeka na walidację panelu ekspertów.',
    status: 'in_review',
    type: 'drd_light',
    progress: 55,
    overallScore: 3.1,
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-09T08:00:00Z',
    createdBy: 'user-marek-demo',
  },
];

const MOCK_REPORTS = [
  {
    id: 'report-1',
    name: 'DBR77 Digital Readiness — Raport zarządczy Q3 2026',
    status: 'published',
    assessmentId: 'assess-1',
    assessmentName: 'DBR77 · Digital Readiness Diagnosis — Grupa',
    assessmentType: 'drd',
    createdAt: '2026-07-05T09:00:00Z',
    updatedAt: '2026-07-10T12:00:00Z',
    createdBy: 'user-piotr-demo',
  },
  {
    id: 'report-2',
    name: 'Manufacturing BU — Raport pilotażowy',
    status: 'draft',
    assessmentId: 'assess-2',
    assessmentName: 'Segment Manufacturing — DRD Light',
    assessmentType: 'drd_light',
    createdAt: '2026-07-09T09:00:00Z',
    updatedAt: '2026-07-09T09:30:00Z',
    createdBy: 'user-anna-demo',
  },
];

const MOCK_USERS = [
  { id: 'user-piotr-demo', firstName: 'Piotr', lastName: 'Wiśniewski' },
  { id: 'user-anna-demo', firstName: 'Anna', lastName: 'Kowalska' },
  { id: 'user-marek-demo', firstName: 'Marek', lastName: 'Zieliński' },
];

Api.getUsers = (async () => MOCK_USERS) as typeof Api.getUsers;
Api.listAssessments = (async () => ({
  items: MOCK_ASSESSMENTS,
  total: MOCK_ASSESSMENTS.length,
})) as typeof Api.listAssessments;
Api.getAssessmentReports = (async () => MOCK_REPORTS) as typeof Api.getAssessmentReports;
Api.listReportImports = (async () => ({ data: [] })) as typeof Api.listReportImports;
const originalGet = Api.get.bind(Api);
Api.get = (async (url: string, ...rest: unknown[]) => {
  if (url.startsWith('/initiatives')) return [];
  return (originalGet as any)(url, ...rest);
}) as typeof Api.get;

// Method Core session list — the ACTUAL call this screen was missing.
// `AssessmentHub.loadAssessmentListCore()` doesn't read `Api.get` for the
// canonical DRD list — it calls `listSessions()` from
// `@/method-core/api/methodCoreApi.ts`, which builds `GET /api/method/
// sessions?methodPackId=...&limit=...&offset=...` via `fetchWithRetry` → raw
// `window.fetch`, bypassing the `Api` singleton the overrides above patch.
// H2 (dev-render/vite.config.ts) made the harness return an honest 404 for
// unmocked `/api/**` paths (previously vite lied with a 200 text/html page),
// so this call now genuinely fails and `loadAssessmentListCore` surfaces
// `assessment.hub.warnings.methodCoreUnavailable` as a persistent banner.
// Two DRD sessions here (standing in for `assess-1`/`assess-4` above, both
// `type: 'drd'` — `loadAssessmentListCore` excludes exactly that type from
// the legacy list on the assumption it lives in Method Core, so those two
// rows were otherwise invisible AND the whole Menu 3 chip row reads 0/0/0)
// clear the banner and give the chip row about-to-count DRD sessions to add
// on top of the 3 `drd_light` legacy rows already mocked above.
const MOCK_METHOD_SESSIONS = [
  {
    id: 'sess-drd-menu3-0001',
    organizationId: 'org-dbr77-demo',
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'in_review',
    domainStage: 'Oś 1 — Procesy Cyfrowe',
    mode: 'guided_manual',
    ownerUserId: 'user-piotr-demo',
    createdAt: '2026-06-02T08:00:00.000Z',
    updatedAt: '2026-07-10T11:20:00.000Z',
    version: 5,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
    hasFrozenOutput: false,
  },
  {
    id: 'sess-drd-menu3-0002',
    organizationId: 'org-dbr77-demo',
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'frozen',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: 'user-piotr-demo',
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-06-30T10:00:00.000Z',
    version: 9,
    frozenSnapshotId: 'output-menu3-0002',
    revisionOfSessionId: null,
    hasFrozenOutput: true,
  },
];

{
  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    // Only the LIST route (`/api/method/sessions` or `?...`) — never
    // `/api/method/sessions/:id` (a sub-path this screen has no need to
    // fake and shouldn't shadow).
    if (method === 'GET' && /\/api\/method\/sessions(\?.*)?$/.test(url)) {
      return new Response(
        JSON.stringify({ sessions: MOCK_METHOD_SESSIONS, total: MOCK_METHOD_SESSIONS.length }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}

export function AssessmentMenu3StatusChipsScreen(): React.ReactElement {
  return (
    <AppProviders>
      <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
        <div style={{ height: '100vh', overflow: 'auto' }}>
          <AssessmentHub initialTab="processes" />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default AssessmentMenu3StatusChipsScreen;
