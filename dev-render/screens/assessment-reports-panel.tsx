/**
 * Dev-render host for the REAL `<ReportsManagementPanel />` (Assessment →
 * Manage → Reports tab), migrated off a bespoke <table> onto the production
 * <StandardTable> facade (§27-todo backlog item). No re-implementation: the
 * component fetches through `Api.get()` (services/api.ts, itself backed by
 * `fetch('/api/...')`), so we stub `window.fetch` with engine-shaped mock
 * JSON keyed by URL path (pattern from dev-render/screens/zwornik-projects.tsx).
 *
 * Exercises: StandardTable columns (Report/Author/Status/Initiatives/Updated),
 * sectioned kebab (primary: context-aware Submit Review/Edit/Review/View +
 * Export PDF/PPTX/Word when eligible · universal Preview/Edit · destructive
 * Delete gated to DRAFT/CONFIGURING/GENERATED).
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { ReportsManagementPanel } from '../../src/components/assessment/manage/ReportsManagementPanel';

const ASSESSMENT_ID = 'assess-dbr77-1';

const REPORTS = [
  {
    id: 'rep-1',
    title: 'DBR77 — Raport diagnostyczny Q3 2026',
    status: 'GENERATED',
    createdAt: '2026-07-01T08:00:00Z',
    updatedAt: '2026-07-10T09:00:00Z',
    createdByName: 'Piotr Wiśniewski',
    initiativesCount: 0,
    config: { assessmentRunId: 'ar-42', workbenchReviewState: 'in_progress' },
  },
  {
    id: 'rep-2',
    title: 'Segment Manufacturing — podsumowanie zarządcze',
    status: 'IN_REVIEW',
    createdAt: '2026-06-20T08:00:00Z',
    updatedAt: '2026-07-08T11:00:00Z',
    createdByName: 'Anna Kowalska',
    initiativesCount: 0,
  },
  {
    id: 'rep-3',
    title: 'Raport zarządu — decyzja inwestycyjna',
    status: 'APPROVED',
    createdAt: '2026-05-15T08:00:00Z',
    updatedAt: '2026-06-30T10:00:00Z',
    createdByName: 'Piotr Wiśniewski',
    initiativesCount: 6,
  },
  {
    id: 'rep-4',
    title: 'Draft: raport dla sponsora regionalnego',
    status: 'DRAFT',
    createdAt: '2026-07-11T08:00:00Z',
    updatedAt: '2026-07-11T08:00:00Z',
    createdByName: 'Marek Zieliński',
    initiativesCount: 0,
  },
  {
    id: 'rep-5',
    title: 'Raport wysłany do klienta zewnętrznego',
    status: 'SENT_EXTERNAL',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '2026-05-01T08:00:00Z',
    createdByName: 'Anna Kowalska',
    initiativesCount: 4,
  },
];

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __ASSESSMENT_REPORTS_FETCH__?: boolean };
if (!g.__ASSESSMENT_REPORTS_FETCH__) {
  g.__ASSESSMENT_REPORTS_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      if (url.includes('/report-builder') && url.includes('sourceType=ASSESSMENT')) {
        return jsonResponse({ reports: REPORTS });
      }
      if (url.includes('/report-builder/') && url.includes('/finalize')) {
        return jsonResponse({ ok: true });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function AssessmentReportsPanelScreen(): React.ReactElement {
  return (
    <MemoryRouter initialEntries={['/']}>
      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px' }}>
        <ReportsManagementPanel
          assessmentId={ASSESSMENT_ID}
          assessmentName="DBR77 · Digital Readiness Diagnosis"
          workflowStatus="APPROVED"
          canManage
          onRefresh={async () => {}}
          onOpenReport={() => {}}
          onCreateReport={() => {}}
        />
      </div>
    </MemoryRouter>
  );
}
