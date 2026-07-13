/**
 * Dev-render host for the REAL `<InitiativesTable />` (Assessment → Board →
 * Initiatives tab; distinct from InitiativesManagementPanel's "Manage" tab),
 * migrated off a bespoke <table> onto the production <StandardTable> facade
 * (§27-todo backlog item, batch 2). No re-implementation: the component
 * fetches through raw `fetch('/api/...')`, so we stub `window.fetch` with
 * engine-shaped mock JSON keyed by URL path (pattern from
 * dev-render/screens/assessment-initiatives-panel.tsx).
 *
 * Exercises: StandardTable columns (Initiative/Status/Completeness/Owner/
 * Priority/Budget), inline StatusTransitionDropdown + completeness checker
 * per row, sectioned kebab (primary: View Details + Duplicate disabled-note
 * · universal Preview/Edit · destructive Delete gated to DRAFT/PLANNING).
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { InitiativesTable } from '../../src/components/assessment/InitiativesTable';

const INITIATIVES = [
  {
    id: 'init-1',
    name: 'Wdrożyć jednolity model danych produkcyjnych',
    summary: 'Ujednolicenie schematów danych między liniami produkcyjnymi.',
    status: 'DRAFT',
    priority: 'CRITICAL',
    axis: 'Operacje',
    projectId: 'proj-1',
    projectName: 'DBR77 · Manufacturing',
    locationId: 'loc-1',
    locationName: 'Zakład Poznań',
    expectedRoi: 2.4,
    costCapex: 850000,
    charterCompleteness: 40,
    ownerBusiness: { id: 'u1', firstName: 'Piotr', lastName: 'Wiśniewski' },
    createdAt: '2026-06-02T10:00:00Z',
    updatedAt: '2026-07-10T08:30:00Z',
  },
  {
    id: 'init-2',
    name: 'Zautomatyzować raportowanie OEE',
    summary: 'Dashboard OEE zasilany z hali w czasie rzeczywistym.',
    status: 'PLANNING',
    priority: 'HIGH',
    axis: 'Manufacturing',
    projectId: 'proj-1',
    projectName: 'DBR77 · Manufacturing',
    locationId: 'loc-1',
    locationName: 'Zakład Poznań',
    expectedRoi: 1.8,
    costCapex: 320000,
    charterCompleteness: 75,
    ownerBusiness: { id: 'u2', firstName: 'Anna', lastName: 'Kowalska' },
    createdAt: '2026-06-15T09:00:00Z',
    updatedAt: '2026-07-08T14:00:00Z',
  },
  {
    id: 'init-3',
    name: 'Przegląd dostawców krytycznych komponentów',
    summary: 'Audyt ryzyka łańcucha dostaw dla komponentów o pojedynczym źródle.',
    status: 'DRAFT',
    priority: 'MEDIUM',
    axis: 'Zakupy',
    projectId: 'proj-2',
    projectName: 'DBR77 · Zakupy',
    locationId: 'loc-2',
    locationName: 'Zakład Wrocław',
    expectedRoi: 1.1,
    costCapex: 45000,
    charterCompleteness: 20,
    createdAt: '2026-06-20T11:00:00Z',
    updatedAt: '2026-07-05T09:15:00Z',
  },
  {
    id: 'init-4',
    name: 'Program szkoleń Lean dla brygadzistów',
    summary: 'Cykl warsztatów Lean dla liderów zmian produkcyjnych.',
    status: 'PLANNING',
    priority: 'LOW',
    axis: 'HR',
    projectId: 'proj-3',
    projectName: 'DBR77 · HR',
    expectedRoi: 0.6,
    costCapex: 60000,
    charterCompleteness: 90,
    ownerBusiness: { id: 'u2', firstName: 'Anna', lastName: 'Kowalska' },
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-06-01T16:00:00Z',
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __ASSESSMENT_INITIATIVES_TABLE_FETCH__?: boolean };
if (!g.__ASSESSMENT_INITIATIVES_TABLE_FETCH__) {
  g.__ASSESSMENT_INITIATIVES_TABLE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/api/initiatives/by-status/')) {
        return jsonResponse({ initiatives: INITIATIVES });
      }
      if (url.match(/\/api\/initiatives\/[^/]+$/) && init?.method === 'DELETE') {
        return jsonResponse({ ok: true });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function AssessmentInitiativesTableScreen(): React.ReactElement {
  return (
    <MemoryRouter initialEntries={['/']}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px', height: 640 }}>
        <InitiativesTable projectId="proj-1" onOpenInitiative={() => {}} />
      </div>
    </MemoryRouter>
  );
}
