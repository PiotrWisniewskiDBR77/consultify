/**
 * Dev-render host for the REAL `<InitiativesManagementPanel />` (Assessment →
 * Manage → Initiatives tab), migrated off a bespoke <table> onto the
 * production <StandardTable> facade (§27-todo backlog item). No
 * re-implementation: the component fetches through raw `fetch('/api/...')`,
 * so we stub `window.fetch` with engine-shaped mock JSON keyed by URL path
 * (pattern from dev-render/screens/zwornik-projects.tsx).
 *
 * Exercises: StandardTable columns (Initiative/Priority/Status/Impact-Effort/
 * Owner/Created), inline status quick-change select over the status chip,
 * sectioned kebab (primary: Open in Initiatives + Duplicate · status
 * transitions · universal Edit/Preview · destructive Delete).
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { InitiativesManagementPanel } from '../../src/components/assessment/manage/InitiativesManagementPanel';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';

const ASSESSMENT_ID = 'assess-dbr77-1';

const INITIATIVES = [
  {
    id: 'init-1',
    title: 'Wdrożyć jednolity model danych produkcyjnych',
    description: 'Ujednolicenie schematów danych między liniami produkcyjnymi.',
    status: 'EXECUTING',
    priority: 'critical',
    risk: 'high',
    category: 'Operacje',
    createdAt: '2026-06-02T10:00:00Z',
    updatedAt: '2026-07-10T08:30:00Z',
    ownerName: 'Piotr Wiśniewski',
    impact: 9,
    effort: 6,
  },
  {
    id: 'init-2',
    title: 'Zautomatyzować raportowanie OEE',
    description: 'Dashboard OEE zasilany z hali w czasie rzeczywistym.',
    status: 'PENDING_REVIEW',
    priority: 'high',
    risk: 'medium',
    category: 'Manufacturing',
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-07-08T14:00:00Z',
    ownerName: 'Anna Kowalska',
    impact: 7,
    effort: 4,
  },
  {
    id: 'init-3',
    title: 'Przegląd dostawców krytycznych komponentów',
    status: 'REVIEW',
    priority: 'medium',
    risk: 'low',
    category: 'Zakupy',
    createdAt: '2026-06-20T11:00:00Z',
    updatedAt: '2026-07-05T09:15:00Z',
    ownerName: 'Marek Zieliński',
    impact: 5,
    effort: 3,
  },
  {
    id: 'init-4',
    title: 'Program szkoleń Lean dla brygadzistów',
    status: 'DONE',
    priority: 'medium',
    risk: 'low',
    category: 'HR',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-06-01T16:00:00Z',
    ownerName: 'Anna Kowalska',
    impact: 6,
    effort: 5,
  },
  {
    id: 'init-5',
    title: 'Migracja legacy MES na nową platformę',
    status: 'BLOCKED',
    priority: 'critical',
    risk: 'high',
    category: 'IT',
    createdAt: '2026-05-10T08:00:00Z',
    updatedAt: '2026-07-09T12:00:00Z',
    ownerName: 'Tomasz Nowak',
    impact: 10,
    effort: 9,
  },
  {
    id: 'init-6',
    title: 'Draft: konsolidacja magazynów regionalnych',
    status: 'DRAFT',
    priority: 'low',
    risk: 'medium',
    category: 'Logistyka',
    createdAt: '2026-07-11T08:00:00Z',
    updatedAt: '2026-07-11T08:00:00Z',
  },
];

const RUNS = [
  {
    id: 'run-1',
    methodologyId: 'impact-feasibility',
    requestedCount: 5,
    createdBy: 'AI',
    createdAt: '2026-06-02T09:00:00Z',
    provenance: { assessmentRunId: 'ar-42', workbenchRunState: 'completed' },
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __ASSESSMENT_INITIATIVES_FETCH__?: boolean };
if (!g.__ASSESSMENT_INITIATIVES_FETCH__) {
  g.__ASSESSMENT_INITIATIVES_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/generated-initiatives')) {
        return jsonResponse({ initiatives: INITIATIVES });
      }
      if (url.includes('/initiative-generation-runs')) {
        return jsonResponse({ runs: RUNS });
      }
      if (url.match(/\/api\/initiatives\/[^/]+\/status$/)) {
        return jsonResponse({ ok: true });
      }
      if (url.match(/\/api\/initiatives\/[^/]+$/) && (init?.method === 'DELETE' || !init?.method)) {
        return jsonResponse({ ok: true });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function AssessmentInitiativesPanelScreen(): React.ReactElement {
  return (
    <FeatureFlagsProvider showDevTools={false}>
      <MemoryRouter initialEntries={['/']}>
        <div style={{ padding: '16px' }}>
          <InitiativesManagementPanel
            assessmentId={ASSESSMENT_ID}
            assessmentName="DBR77 · Digital Readiness Diagnosis"
            workflowStatus="APPROVED"
            canManage
            canGenerateInitiatives
            onRefresh={async () => {}}
            onGenerateInitiatives={async () => {}}
          />
        </div>
      </MemoryRouter>
    </FeatureFlagsProvider>
  );
}
