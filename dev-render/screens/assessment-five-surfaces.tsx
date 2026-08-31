/**
 * T22 FINAL CLOSEOUT (Part E) — Mock host for the REAL `AssessmentHub`
 * screen with `assessmentFiveSurfacesV1` forced ON, so the supervisor can
 * screenshot the ACTUAL 5-tab shell (Library/Processes/Outputs/Reports/
 * Initiatives) — real component, real StandardTable/StandardPreview,
 * real AssessmentOutputsTab, before the default flip is shown live.
 *
 * Same pattern as assessment-menu3-status-chips.tsx: mount the real
 * component inside the real `AppProviders` tree, seed a demo session (no
 * auth token), force the flag via the localStorage-backed override + an
 * inner `<FeatureFlagsProvider config={{enableLocalOverrides:true}}>`
 * (harness-only, never ships), and monkey-patch the `Api` methods this
 * screen calls on mount — `Api` is a plain exported object, so reassigning
 * a method patches the same singleton every module imports.
 *
 * Outputs tab data: AssessmentOutputsTab.tsx calls
 * `fetchAssessmentOutputArtifacts()` → `Api.get('/artifacts?limit=200')`
 * (assessmentOutputs.ts). Mock rows below cover both populated fields and
 * the null-field placeholder path (QA-CORRECTION-1) so both states are
 * visible in one screenshot pass.
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

useAppStore.setState({
  theme: new URLSearchParams(window.location.search).get('theme') === 'dark' ? 'dark' : 'light',
} as any);

try {
  const existing = JSON.parse(localStorage.getItem('consultify_feature_flags') || '{}');
  localStorage.setItem(
    'consultify_feature_flags',
    JSON.stringify({ ...existing, assessmentFiveSurfacesV1: true })
  );
} catch {
  // ignore
}

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
];

const MOCK_REPORTS = [
  {
    id: 'report-1',
    name: 'DBR77 Digital Readiness — Raport zarządczy Q3 2026',
    status: 'approved',
    assessmentId: 'assess-1',
    assessmentName: 'DBR77 · Digital Readiness Diagnosis — Grupa',
    assessmentType: 'drd',
    createdAt: '2026-07-05T09:00:00Z',
    updatedAt: '2026-07-10T12:00:00Z',
    createdBy: 'user-piotr-demo',
  },
];

const MOCK_USERS = [
  { id: 'user-piotr-demo', firstName: 'Piotr', lastName: 'Wiśniewski' },
  { id: 'user-anna-demo', firstName: 'Anna', lastName: 'Kowalska' },
];

const MOCK_INITIATIVES = [
  {
    id: 'initiative-assessment-1',
    name: 'Stabilize production-data governance',
    status: 'pending_review',
    priority: 'high',
    impact: 'high',
    sourceType: 'assessment_report',
    sourceId: 'report-1',
    reportName: 'DBR77 Digital Readiness — Raport zarządczy Q3 2026',
    createdBy: 'user-piotr-demo',
    createdAt: '2026-07-10T12:15:00Z',
    updatedAt: '2026-07-11T08:30:00Z',
  },
];

const MOCK_REPORT_DETAIL = {
  id: 'report-1',
  name: 'DBR77 Digital Readiness — Raport zarządczy Q3 2026',
  status: 'approved',
  assessmentId: 'assess-1',
  assessmentName: 'DBR77 · Digital Readiness Diagnosis — Grupa',
  assessmentType: 'drd',
  createdAt: '2026-07-05T09:00:00Z',
  updatedAt: '2026-07-10T12:00:00Z',
  createdBy: 'user-piotr-demo',
};

// Outputs Library rows — one fully-populated, one with several null fields
// so the empty-placeholder path (QA-CORRECTION-1) shows too.
const MOCK_ARTIFACTS = [
  {
    artifactId: 'artifact-out-1',
    resolvedTitle: 'DBR77 Digital Readiness — Raport zarządczy Q3 2026',
    outputType: 'report',
    artifactFamily: 'document',
    deliveryState: 'published',
    visibilityScope: 'organization',
    isDraft: false,
    ownerName: 'Piotr Wiśniewski',
    createdBy: 'user-piotr-demo',
    createdAt: '2026-07-05T09:00:00Z',
    lastTransitionAt: '2026-07-10T12:00:00Z',
    originRuntime: 'assessment_report',
    originRecordId: 'assess-1',
    openPath: '/assessment/assess-1',
    exportPath: null,
    deletePath: null,
    authority: 'assessment_report',
  },
  {
    artifactId: 'artifact-out-2',
    resolvedTitle: null,
    outputType: null,
    artifactFamily: 'document',
    deliveryState: null,
    visibilityScope: 'organization',
    isDraft: true,
    ownerName: null,
    createdBy: 'user-anna-demo',
    createdAt: '2026-07-09T09:00:00Z',
    lastTransitionAt: '2026-07-09T09:30:00Z',
    originRuntime: 'assessment_report',
    originRecordId: 'assess-2',
    openPath: '/assessment/assess-2',
    exportPath: null,
    deletePath: null,
    authority: 'assessment_report',
  },
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
  if (url === '/initiatives?source=assessment') return MOCK_INITIATIVES;
  if (url.startsWith('/artifacts')) return { data: MOCK_ARTIFACTS };
  if (url === '/assessment-reports/report-1/full') return { report: MOCK_REPORT_DETAIL };
  if (url === '/report-builder/report-1/exports') return { exports: [] };
  return (originalGet as any)(url, ...rest);
}) as typeof Api.get;

// Method Core session list — the ACTUAL call this screen was missing.
// `AssessmentHub.loadAssessmentListCore()` (src/components/assessment/
// AssessmentHub.tsx) does NOT read `Api.get` for the canonical DRD list —
// it calls `listSessions()` from `@/method-core/api/methodCoreApi.ts`,
// which builds `GET /api/method/sessions?methodPackId=...&limit=...&offset=...`
// via `fetchWithRetry` → raw `window.fetch`, bypassing the `Api` singleton
// entirely. None of the `Api.*` overrides above ever see this request. Since
// H2 (dev-render/vite.config.ts) made the harness return an honest 404 for
// unmocked `/api/**` paths (previously vite lied with a 200 text/html page),
// this call now genuinely fails, and `loadAssessmentListCore` surfaces
// `assessment.hub.warnings.methodCoreUnavailable` ("Nie udało się wczytać
// sesji DRD z Rdzenia metody…") as a persistent banner. Two DRD sessions
// here (mirroring `MOCK_ASSESSMENTS`' two 'drd'-typed rows above, which are
// otherwise invisible — `loadAssessmentListCore` excludes `type==='DRD'`
// legacy rows on the assumption they live in Method Core) clear the banner
// with a plausible demo payload, same shape as
// `dev-render/mocks/methodCoreFakeServer.ts`'s in-memory sessions.
const MOCK_METHOD_SESSIONS = [
  {
    id: 'sess-drd-five-0001',
    organizationId: 'org-dbr77-demo',
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'in_review',
    domainStage: 'Oś 2 — Technologia i dane',
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
    id: 'sess-drd-five-0002',
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
    frozenSnapshotId: 'output-five-0002',
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

export function AssessmentFiveSurfacesScreen(): React.ReactElement {
  const initialTab = new URLSearchParams(window.location.search).get('tab') || undefined;
  return (
    <AppProviders>
      <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
        <div style={{ height: '100vh', overflow: 'auto' }}>
          <AssessmentHub initialTab={initialTab as any} />
        </div>
      </FeatureFlagsProvider>
    </AppProviders>
  );
}

export default AssessmentFiveSurfacesScreen;
