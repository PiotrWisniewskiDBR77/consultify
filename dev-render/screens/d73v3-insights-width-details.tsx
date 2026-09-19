/**
 * D-73 v3 (Wpis 196/203, DEC-680) — KROK 0 reproduction harness for the LIVE
 * `/assessment?tab=outputs` (Insights) surface.
 *
 * The live route renders the REAL `AssessmentOutputsTab` (AppRoutes.tsx:2558 →
 * AssessmentHub.tsx:2498). v2 (`206f0e797a`) fixed `OutputsAggregateTabContent`
 * — the Materials hub, a DIFFERENT surface this route never mounts. This screen
 * mounts the real `AssessmentOutputsTab` so the supervisor can reproduce, on the
 * actual component, the two defects QC12 measured live on staging 29:
 *   1. TYPE/VERSION badges truncate ("Conclusion"→"Co…", "Needs review"→"Need…")
 *      once the preview pane opens and FilterableTable compresses the columns
 *      toward the no-`dataType` fit floor (90px).
 *   2. The DETAILS panel of a Conclusion row shows 6× "—" (Session, Method pack,
 *      Findings, Limitations, Content hash, Superseded by) because the panel
 *      renders kernel-snapshot fields a conclusion never carries, and the
 *      conclusion's own record (`ConclusionsApi.get`) is never fetched.
 *
 * Data path (all three loaders go through `fetchWithRetry` → `window.fetch`):
 *   • listOutputs()        → GET /api/method/outputs        (kernel "Frozen output")
 *   • pobierzOcenyZastane() → GET /api/assessments          (legacy "Session record")
 *   • pobierzWnioskiOceny() → GET /api/conclusions          (the "Conclusion" row)
 *   • getOutput(id)        → GET /api/method/outputs/:id     (kernel snapshot on open)
 *   • ConclusionsApi.get(id)→ GET /api/conclusions/:id       (conclusion detail on open)
 *
 * URL: /d73v3-insights-width-details.html?theme=light|dark&lang=pl|en
 */
import React from 'react';

import { AssessmentOutputsTab } from '../../src/components/assessment/AssessmentOutputsTab';
import { AppProviders } from '../../src/providers/AppProviders';
import { useAppStore } from '../../src/store/useAppStore';

// The QC12 Conclusion row, with a FULL record so the post-fix DETAILS has real
// values to render (2 evidence refs, 1 source artifact, status needs_review).
const CONCLUSION = {
  id: 'concl-qc12-1',
  organizationId: 'org-dbr77-demo',
  projectId: null,
  title: 'Quality and Compliance Maturity — assessment report',
  statement:
    'The organization manages quality and compliance through mature, audited processes.',
  sourceModule: 'assessment',
  sourceArtifactRefs: [
    { type: 'assessment_report', id: 'report-qc12-1', title: 'DBR77 Quality Report Q3 2026' },
  ],
  sourcePackId: 'pack-qc12-1',
  confidenceLevel: 'high',
  limits: 'Sample limited to 3 interviews.',
  evidenceRefs: [
    { type: 'assessment_report', ref: 'report-qc12-1', excerpt: 'Maturity score 4.1' },
    { type: 'interview', ref: 'int-qc12-1', excerpt: 'Process audited annually' },
  ],
  recommendedNextAction: 'Publish to readout.',
  status: 'needs_review',
  ownerId: 'user-piotr-demo',
  reviewerId: null,
  sponsorId: null,
  createdBy: 'user-piotr-demo',
  createdAt: '2026-09-15T10:00:00.000Z',
  updatedAt: '2026-09-16T11:20:00.000Z',
};

const CONCLUSION_DETAIL = {
  conclusion: CONCLUSION,
  sourcePack: {
    id: 'pack-qc12-1',
    organizationId: 'org-dbr77-demo',
    projectId: null,
    sourceModule: 'assessment',
    sourceArtifactRefs: CONCLUSION.sourceArtifactRefs,
    evidenceRefs: CONCLUSION.evidenceRefs,
    contextSummary: 'Captured from the Q3 2026 digital-readiness assessment.',
    limitations: ['Sample limited to 3 interviews.'],
    capturedAt: '2026-09-15T09:50:00.000Z',
    createdAt: '2026-09-15T09:50:00.000Z',
    updatedAt: '2026-09-15T09:50:00.000Z',
  },
  conversions: [],
};

// Kernel output → renders the "Frozen output" TYPE badge.
const KERNEL_OUTPUT = {
  id: 'out-kernel-1',
  organizationId: 'org-dbr77-demo',
  sessionId: 'sess-drd-1',
  module: 'assessment',
  methodPackId: 'drd',
  methodPackVersion: '2.0',
  outputVersion: 1,
  revisionOfOutputId: null,
  scope: 'Digital Readiness — Area A',
  limitationsCount: 1,
  findingsCount: 3,
  contentHash: 'abcdef1234567890',
  frozenAt: '2026-08-10T10:00:00.000Z',
  createdAt: '2026-08-10T10:00:00.000Z',
  status: 'current',
  supersededByOutputId: null,
};

const KERNEL_OUTPUT_DETAIL = {
  output: {
    id: 'out-kernel-1',
    organizationId: 'org-dbr77-demo',
    sessionId: 'sess-drd-1',
    module: 'assessment',
    methodPackId: 'drd',
    methodPackVersion: '2.0',
    outputVersion: 1,
    scope: 'Digital Readiness — Area A',
    current: {},
    target: {},
    gap: {},
    limitations: ['Sample size limited to 3 interviews'],
    findings: [{ id: 'f1' }, { id: 'f2' }, { id: 'f3' }],
    contentHash: 'abcdef1234567890',
    frozenAt: '2026-08-10T10:00:00.000Z',
  },
  superseded: false,
  supersededByOutputId: null,
};

// Legacy assessment → renders the "Session record" TYPE badge (ocena~<id>).
const LEGACY_ASSESSMENT = {
  id: 'assess-legacy-1',
  organizationId: 'org-dbr77-demo',
  name: 'Segment Manufacturing — DRD Light',
  status: 'completed',
  type: 'drd_light',
  createdAt: '2026-05-20T08:00:00.000Z',
  updatedAt: '2026-07-08T09:15:00.000Z',
  progress: 100,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Stub window.fetch at module scope — before any loader captures a reference.
{
  const originalFetch = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    const path = url.replace(/^https?:\/\/[^/]+/, '');

    if (method !== 'GET') return json({ ok: true });

    // GET /api/method/outputs/:id  (kernel snapshot — must precede the list route)
    const outputDetail = path.match(/^\/api\/method\/outputs\/([^/?]+)/);
    if (outputDetail) {
      return outputDetail[1] === KERNEL_OUTPUT.id
        ? json(KERNEL_OUTPUT_DETAIL)
        : json({ error: { code: 'NOT_FOUND' } }, 404);
    }
    // GET /api/method/outputs  (kernel list)
    if (/^\/api\/method\/outputs(\?.*)?$/.test(path)) {
      return json({ outputs: [KERNEL_OUTPUT], total: 1 });
    }
    // GET /api/conclusions/:id  (conclusion detail — must precede the list route)
    const conclDetail = path.match(/^\/api\/conclusions\/([^/?]+)/);
    if (conclDetail) {
      return conclDetail[1] === CONCLUSION.id
        ? json(CONCLUSION_DETAIL)
        : json({ error: { code: 'NOT_FOUND' } }, 404);
    }
    // GET /api/conclusions  (conclusion list)
    if (/^\/api\/conclusions(\?.*)?$/.test(path)) {
      return json({ conclusions: [CONCLUSION] });
    }
    // GET /api/assessments  (legacy session records)
    if (/^\/api\/assessments(\?.*)?$/.test(path)) {
      return json({ assessments: [LEGACY_ASSESSMENT] });
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}

const D73V3InsightsWidthDetailsScreen: React.FC = () => {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
    // ThemeSync (AppProviders) drives the `dark` class off the store, overriding
    // a manual DOM toggle — set the store directly (DEC-664 convention).
    useAppStore.setState({ theme });
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <AppProviders>
      <div className="h-screen w-screen overflow-hidden bg-c-bg text-c-text">
        <AssessmentOutputsTab />
      </div>
    </AppProviders>
  );
};

export default D73V3InsightsWidthDetailsScreen;
