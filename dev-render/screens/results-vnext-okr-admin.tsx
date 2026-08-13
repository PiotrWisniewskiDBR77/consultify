/**
 * RN-G3 lane `okr` full-tool task (2026-08-11) — visual QA harness for the
 * Program/Cycle admin surfaces (`OkrProgramsPage`/`OkrCyclesPage`), same
 * `window.fetch` stub pattern as `results-vnext-okr-workspace.tsx`.
 *
 * URL params: &page=programs|cycles (default programs)
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { OkrProgramsPage } from '../../src/components/ResultsVNext/okr/OkrProgramsPage';
import { OkrCyclesPage } from '../../src/components/ResultsVNext/okr/OkrCyclesPage';

const params = new URLSearchParams(window.location.search);
const page = (params.get('page') as 'programs' | 'cycles') || 'programs';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const MOCK_PROGRAM = {
  programId: 'program-fy26',
  organizationId: 'org-1',
  name: 'Program OKR FY26',
  status: 'active' as const,
  cycleModel: 'quarterly',
  annualDirectionEnabled: true,
  objectiveMinRecommended: 1,
  objectiveMaxRecommended: 3,
  krMinRequired: 2,
  krMaxRecommended: 5,
  checkinFrequency: 'weekly',
  approvalRequired: true,
  scoringModel: 'zero_to_one',
  objectiveRollupModel: 'equal_average',
  confidenceEnabled: true,
  confidenceModel: 'high_medium_low',
  objectiveConfidenceModel: 'lowest_kr',
  visibilityDefault: 'OPEN_ORG',
  committedVsAspirationalEnabled: true,
  managerReviewRequired: true,
  selfReviewRequired: true,
  reflectionRequiredForClose: false,
  recognitionEnabled: true,
  activePolicyVersionId: 'policy-v2',
  rowVersion: 4,
  createdBy: 'user-anna-kowalska',
  createdAt: '2026-05-01T09:00:00Z',
  updatedBy: 'user-anna-kowalska',
  updatedAt: '2026-06-01T09:00:00Z',
};
const MOCK_PROGRAM_DRAFT = { ...MOCK_PROGRAM, programId: 'program-fy27-draft', name: 'Program OKR FY27 (szkic)', status: 'draft' as const, rowVersion: 1, activePolicyVersionId: null };

const MOCK_CYCLE_ACTIVE = {
  cycleId: 'cycle-fy26-h2',
  organizationId: 'org-1',
  programId: 'program-fy26',
  name: 'FY26 H2',
  startDate: '2026-07-01',
  endDate: '2026-12-31',
  draftOpenAt: '2026-06-15T09:00:00Z',
  submissionDueAt: '2026-06-25T09:00:00Z',
  approvalDueAt: '2026-06-30T09:00:00Z',
  activeStartAt: '2026-07-01T09:00:00Z',
  midcycleReviewAt: '2026-09-15T09:00:00Z',
  finalUpdateDueAt: '2026-12-20T09:00:00Z',
  reviewOpenAt: '2026-12-15T09:00:00Z',
  reflectionDueAt: '2026-12-28T09:00:00Z',
  managerReviewDueAt: '2026-12-30T09:00:00Z',
  closeAt: '2026-12-31T23:59:00Z',
  status: 'active' as const,
  policyVersionId: 'policy-v2',
  rowVersion: 3,
  createdBy: 'user-anna-kowalska',
  createdAt: '2026-05-15T09:00:00Z',
  updatedBy: 'user-anna-kowalska',
  updatedAt: '2026-07-01T09:00:00Z',
};
const MOCK_CYCLE_PLANNED = { ...MOCK_CYCLE_ACTIVE, cycleId: 'cycle-fy27-h1', name: 'FY27 H1', status: 'planned' as const, rowVersion: 1 };

const g = window as unknown as { __OKR_ADMIN_FETCH__?: boolean };
if (!g.__OKR_ADMIN_FETCH__) {
  g.__OKR_ADMIN_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (!url.includes('/api/vnext/results/okr/')) return realFetch(input as RequestInfo, init);
      if (url.match(/\/programs$/) && method === 'GET') return jsonResponse({ programs: [MOCK_PROGRAM, MOCK_PROGRAM_DRAFT] });
      if (url.match(/\/programs$/) && method === 'POST') return jsonResponse({ outcome: 'applied', program: MOCK_PROGRAM_DRAFT }, 201);
      if (url.match(/\/programs\/[^/]+\/draft$/) && method === 'PATCH') return jsonResponse({ outcome: 'applied', program: MOCK_PROGRAM_DRAFT });
      if (url.match(/\/programs\/[^/]+\/publish$/) && method === 'POST')
        return jsonResponse({ outcome: 'applied', program: { ...MOCK_PROGRAM_DRAFT, status: 'active' }, policyVersion: { policyVersionId: 'policy-v3', versionNumber: 3 } });
      if (url.match(/\/cycles$/) && method === 'GET') return jsonResponse({ cycles: [MOCK_CYCLE_ACTIVE, MOCK_CYCLE_PLANNED] });
      if (url.match(/\/cycles$/) && method === 'POST') return jsonResponse({ outcome: 'applied', cycle: MOCK_CYCLE_PLANNED }, 201);
      if (url.match(/\/cycles\/[^/]+\/(open-drafting|activate|open-review|close|cancel)$/) && method === 'POST')
        return jsonResponse({ outcome: 'applied', cycle: MOCK_CYCLE_PLANNED });
    } catch {
      /* fall through */
    }
    return realFetch(input as RequestInfo, init);
  };
}

const ResultsVNextOkrAdminScreen: React.FC = () => {
  useTranslation();
  return <div className="h-screen bg-c-bg text-c-text">{page === 'cycles' ? <OkrCyclesPage /> : <OkrProgramsPage />}</div>;
};

export default ResultsVNextOkrAdminScreen;
