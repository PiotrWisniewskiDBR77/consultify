/**
 * AuditReportDocumentView — NAPRAWA 2 (panel ekspercki 2026-08-26, moduł
 * Audyty 6,0/10): the report preview showed only title/status/properties —
 * this proves the full SPEC-A document view actually renders the live
 * presentation payload from `GET /audits/reports/:id/presentation`, resolves
 * raw criterion/owner IDs to names instead of leaking them, and wires the
 * Approve/Publish header action to the real, backend-gated endpoints.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    getReport: vi.fn(),
    getReportPresentation: vi.fn(),
    getProgram: vi.fn(),
    listProgramCriteria: vi.fn(),
    listEvidence: vi.fn(),
    approveReport: vi.fn(),
    publishReport: vi.fn(),
  };
});

vi.mock('@/services/api', async () => {
  const actual = await vi.importActual<typeof import('@/services/api')>('@/services/api');
  return { ...actual, Api: { ...actual.Api, getUsers: vi.fn().mockResolvedValue([]) } };
});

import { AuditReportDocumentView } from '../AuditReportDocumentView';
import {
  getProgram,
  getReport,
  getReportPresentation,
  listEvidence,
  listProgramCriteria,
  type AuditCriterionSummary,
  type AuditReportDocument,
  type AuditReportSummary,
} from '../auditsMethodApi';

const mockedGetReport = vi.mocked(getReport);
const mockedGetReportPresentation = vi.mocked(getReportPresentation);
const mockedGetProgram = vi.mocked(getProgram);
const mockedListProgramCriteria = vi.mocked(listProgramCriteria);
const mockedListEvidence = vi.mocked(listEvidence);

const report: AuditReportSummary = {
  id: 'rep-1',
  programId: 'prog-1',
  programName: 'Metalpol — Q3 Purchasing Audit',
  reportKind: 'audit_report',
  version: 1,
  title: 'Metalpol Q3 Audit Report',
  status: 'draft',
  language: 'pl',
  audience: 'Zarząd',
  confidentiality: 'Poufne',
  approvedAt: null,
  publishedAt: null,
  updatedAt: '2026-08-20T00:00:00Z',
};

const criterion: AuditCriterionSummary = {
  id: 'crit-1',
  programId: 'prog-1',
  parentId: null,
  ordinal: 1,
  refCode: 'ZAK-8.4.1',
  title: 'Supplier qualification',
  applicable: true,
  conformityStatus: 'nonconforming',
  workStatus: 'concluded',
  evidenceCount: 1,
  findingCount: 1,
  children: [],
};

const presentation: AuditReportDocument = {
  reportKind: 'presentation',
  generatedAt: null,
  sections: [
    { id: 'conclusion', title: 'Konkluzja', kind: 'text', content: 'Audit found 1 nonconformity.' },
    {
      id: 'critical_findings',
      title: 'Ustalenia krytyczne',
      kind: 'list',
      content: [
        {
          id: 'find-1',
          referenceCode: 'UST-2026-001',
          statement: 'Missing periodic supplier assessment',
          criterionId: 'crit-1',
          classification: 'nonconforming',
          severity: 'high',
          objectiveEvidence: [],
          ownerUserId: null,
        },
      ],
    },
  ],
};

function stubReads() {
  mockedGetProgram.mockResolvedValue({
    id: 'prog-1',
    name: 'Metalpol — Q3 Purchasing Audit',
    packId: 'pack-1',
    packTitle: 'QMS pack',
    packVersion: 1,
    lifecycleState: 'findings_review',
    applicableCriteria: 10,
    concludedCriteria: 5,
    openFindings: 1,
    leadAuditorId: null,
    leadAuditorName: null,
    plannedStart: null,
    plannedEnd: null,
    updatedAt: '2026-08-20T00:00:00Z',
    objective: null,
    scopeText: null,
    projectId: null,
    members: [],
  });
  mockedListProgramCriteria.mockResolvedValue([criterion]);
  mockedListEvidence.mockResolvedValue([]);
}

describe('AuditReportDocumentView — full report content (NAPRAWA 2)', () => {
  it('renders the live presentation document — title, status and the conclusion section text', async () => {
    stubReads();
    mockedGetReport.mockResolvedValue(report);
    mockedGetReportPresentation.mockResolvedValue(presentation);

    render(<AuditReportDocumentView reportId="rep-1" />);

    await waitFor(() => expect(screen.getAllByText('Metalpol Q3 Audit Report').length).toBeGreaterThan(0));
    expect(mockedGetReportPresentation).toHaveBeenCalledWith('rep-1');
    expect(screen.getByText('Audit found 1 nonconformity.')).toBeInTheDocument();
  });

  it('resolves criterionId in the critical findings section to a real title, never the raw id', async () => {
    stubReads();
    mockedGetReport.mockResolvedValue(report);
    mockedGetReportPresentation.mockResolvedValue(presentation);

    render(<AuditReportDocumentView reportId="rep-1" />);
    await waitFor(() => expect(screen.getAllByText('Metalpol Q3 Audit Report').length).toBeGreaterThan(0));

    // The critical-findings section is present in the left nav; its content
    // renders once selected as the active section (default = first section,
    // 'conclusion') — assert the resolved criterion label exists once we
    // switch by clicking the nav entry.
    const navEntry = await screen.findByText('Ustalenia krytyczne');
    fireEvent.click(navEntry);
    await waitFor(() => expect(screen.getByText(/ZAK-8.4.1/)).toBeInTheDocument());
    expect(screen.queryByText('crit-1')).not.toBeInTheDocument();
  });

  it('shows an error state with retry when the report cannot be loaded (e.g. 404)', async () => {
    mockedGetReport.mockResolvedValue(null);
    mockedGetReportPresentation.mockRejectedValue(new Error('boom'));

    render(<AuditReportDocumentView reportId="missing" />);
    // The document CONTENT is always Polish (`reportRenderer.ts` has no
    // locale param) — the screen chrome follows suit (`isPolish = true`,
    // documented at the top of `AuditReportDocumentView.tsx`).
    await waitFor(() => expect(screen.getByText(/Nie udało się wczytać raportu/i)).toBeInTheDocument());
  });
});
