/**
 * Dev-render host for the REAL `<ReportsTable />` (Assessment → Board →
 * Reports tab; global cross-assessment view, distinct from
 * ReportsManagementPanel's per-assessment "Manage" tab), migrated off a
 * bespoke <table> onto the production <StandardTable> facade (§27-todo
 * backlog item, batch 2). No re-implementation: the component fetches
 * through `Api.get()` (services/api.ts, itself backed by `fetch('/api/...')`),
 * so we stub `window.fetch` with engine-shaped mock JSON keyed by URL path
 * (pattern from dev-render/screens/assessment-reports-panel.tsx).
 *
 * Exercises: StandardTable columns (Report/Author/Context/Status/Updated),
 * status badges fixed off crimson (In Review/Generated/Utilized -> blue/
 * indigo, kanon pułapka #1), sectioned kebab (primary: View + Export PDF/
 * PPTX/Word + Share + Generate Initiatives · statusTransitions: Approve/
 * Send Back/Send Internal/Send External wg statusu · universal Preview/Edit
 * · destructive disabled — brak API delete w tym globalnym widoku).
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ReportsTable } from '../../src/components/assessment/ReportsTable';

const REPORTS = [
  {
    id: 'rep-1',
    title: 'DBR77 — Raport diagnostyczny Q3 2026',
    sourceType: 'ASSESSMENT',
    sourceId: 'assess-1',
    sourceName: 'DBR77 · Digital Readiness Diagnosis',
    status: 'IN_REVIEW',
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-10T09:00:00Z',
    createdByName: 'Piotr Wiśniewski',
    initiativesCount: 0,
  },
  {
    id: 'rep-2',
    title: 'Segment Manufacturing — podsumowanie zarządcze',
    sourceType: 'ASSESSMENT',
    sourceId: 'assess-2',
    sourceName: 'Manufacturing · Deep Dive',
    status: 'APPROVED',
    createdAt: '2026-06-20T08:00:00Z',
    updatedAt: '2026-07-08T11:00:00Z',
    createdByName: 'Anna Kowalska',
    initiativesCount: 6,
  },
  {
    id: 'rep-3',
    title: 'Raport zarządu — decyzja inwestycyjna',
    sourceType: 'ASSESSMENT',
    sourceId: 'assess-3',
    sourceName: 'DBR77 · Board Review',
    status: 'SENT_INTERNAL',
    createdAt: '2026-05-15T08:00:00Z',
    updatedAt: '2026-06-30T10:00:00Z',
    createdByName: 'Piotr Wiśniewski',
    initiativesCount: 6,
  },
  {
    id: 'rep-4',
    title: 'Raport wysłany do klienta zewnętrznego',
    sourceType: 'ASSESSMENT',
    sourceId: 'assess-4',
    sourceName: 'Klient zewnętrzny · Retail SA',
    status: 'SENT_EXTERNAL',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-05-01T08:00:00Z',
    createdByName: 'Anna Kowalska',
    initiativesCount: 4,
  },
  {
    id: 'rep-5',
    title: 'DBR77 — raport wykorzystany w programie transformacji',
    sourceType: 'ASSESSMENT',
    sourceId: 'assess-5',
    sourceName: 'DBR77 · Program transformacji',
    status: 'UTILIZED',
    createdAt: '2026-03-01T08:00:00Z',
    updatedAt: '2026-04-01T08:00:00Z',
    createdByName: 'Marek Zieliński',
    initiativesCount: 9,
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __ASSESSMENT_REPORTS_TABLE_FETCH__?: boolean };
if (!g.__ASSESSMENT_REPORTS_TABLE_FETCH__) {
  g.__ASSESSMENT_REPORTS_TABLE_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/report-builder') && url.includes('sourceType=ASSESSMENT')) {
        return jsonResponse({ reports: REPORTS });
      }
      if (
        url.includes('/report-builder/') &&
        /\/(approve|mark-sent-internal|mark-sent-external|send-back|share)$/.test(url)
      ) {
        return jsonResponse({ ok: true, link: { url: '/share/mock-token' } });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function AssessmentReportsTableScreen(): React.ReactElement {
  return (
    <MemoryRouter initialEntries={['/']}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px', height: 640 }}>
        <ReportsTable projectId="proj-1" onCreateInitiatives={() => {}} onOpenReport={() => {}} />
      </div>
    </MemoryRouter>
  );
}
