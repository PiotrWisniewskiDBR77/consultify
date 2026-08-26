/**
 * AuditReportDocumentView — R1 (panel powtórny DEC-117, blokier najcięższy):
 * poprzednia wersja WYRZUCAŁA `getReport(reportId)`'s payload i renderowała
 * WYŁĄCZNIE `GET /audits/reports/:id/presentation` (zawsze 8-sekcyjny deck),
 * niezależnie od tego, jaki dokument faktycznie leży w `audit_reports.payload`
 * i jest objęty `content_hash`em — zatwierdzający czytał inny byt niż ten,
 * który zatwierdzał. Ten plik dowodzi:
 *   1. domyślny widok renderuje `report.payload` (pełny, zaplombowany
 *      dokument z `renderAuditReport` — 13 sekcji, w tym `group`/`keyValue`,
 *      których poprzedni widok w ogóle nie umiał wyrenderować);
 *   2. `GET /reports/:id/presentation` NIE jest wołane, dopóki użytkownik
 *      jawnie nie przełączy trybu na „Widok dla zarządu";
 *   3. po przełączeniu prezentacja renderuje się poprawnie, a etykieta
 *      „Rodzaj" w panelu Właściwości mówi prawdę PER TRYB (raport audytu vs.
 *      widok prezentacyjny) — nigdy jedno pod maską drugiego;
 *   4. Zatwierdź działa z domyślnego (pełnego) widoku — dokładnie ten sam,
 *      bramkowany endpoint co poprzednio.
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
  approveReport,
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
const mockedApproveReport = vi.mocked(approveReport);

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

// The 13-section `renderAuditReport` payload — the DOCUMENT that is actually
// hashed/approved (`audit_reports.payload`). Deliberately exercises a
// `group` section (findings_by_severity) and a `keyValue` section (scope) —
// the two kinds the previous view could not render at all.
const fullPayload: AuditReportDocument = {
  reportKind: 'audit_report',
  generatedAt: '2026-08-20T00:00:00Z',
  sections: [
    { id: 'executive_summary', title: 'Streszczenie zarządcze', kind: 'text', content: 'Audit found 1 nonconformity in supplier qualification.' },
    {
      id: 'scope',
      title: 'Zakres i cele',
      kind: 'keyValue',
      content: { scopeText: 'Purchasing process Q3 2026', scopeJson: null, objectives: 'Verify supplier qualification controls' },
    },
    { id: 'methodology', title: 'Metodyka', kind: 'text', content: 'Sample-based testing against the QMS procedure.' },
    { id: 'limitations', title: 'Ograniczenia', kind: 'list', content: ['No significant scope limitations identified.'] },
    { id: 'overall_conclusion', title: 'Wniosek ogólny', kind: 'text', content: 'One nonconformity identified.' },
    {
      id: 'findings_by_severity',
      title: 'Ustalenia wg istotności',
      kind: 'group',
      content: [
        {
          key: 'high',
          items: [
            {
              id: 'find-1',
              referenceCode: 'UST-2026-014',
              statement: 'Missing periodic supplier assessment',
              criterionId: 'crit-1',
              classification: 'nonconforming',
              severity: 'high',
              objectiveEvidence: [],
              contradictingEvidence: [],
              status: 'confirmed',
              rootCause: null,
              rootCauseConfirmed: false,
              residualRisk: null,
              ownerUserId: null,
            },
          ],
        },
      ],
    },
    { id: 'findings_by_area', title: 'Ustalenia wg obszaru/procesu', kind: 'group', content: [] },
    { id: 'objective_evidence_references', title: 'Odniesienia do obiektywnych dowodów', kind: 'table', content: [] },
    { id: 'systemic_conclusions', title: 'Wnioski systemowe', kind: 'list', content: [] },
    { id: 'corrective_action_plan', title: 'Plan działań korygujących', kind: 'table', content: [] },
    { id: 'verification_plan', title: 'Plan weryfikacji', kind: 'table', content: [] },
    { id: 'appendices', title: 'Załączniki', kind: 'group', content: { team: [], evidenceRegister: [] } },
    { id: 'traceability_matrix', title: 'Macierz traceability', kind: 'table', content: [] },
  ],
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
          referenceCode: 'UST-2026-014',
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
  payload: fullPayload as unknown as Record<string, unknown>,
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

describe('AuditReportDocumentView — R1: full report is the default document', () => {
  it('renders report.payload by default — title, executive summary text — and does NOT call /presentation', async () => {
    stubReads();
    mockedGetReport.mockResolvedValue(report);

    render(<AuditReportDocumentView reportId="rep-1" />);

    await waitFor(() => expect(screen.getAllByText('Metalpol Q3 Audit Report').length).toBeGreaterThan(0));
    expect(screen.getByText(/Audit found 1 nonconformity in supplier qualification/)).toBeInTheDocument();
    expect(mockedGetReportPresentation).not.toHaveBeenCalled();
  });

  it('renders a `group`-kind section (findings_by_severity) resolving the criterion id to a real title', async () => {
    stubReads();
    mockedGetReport.mockResolvedValue(report);
    render(<AuditReportDocumentView reportId="rep-1" />);
    await waitFor(() => expect(screen.getAllByText('Metalpol Q3 Audit Report').length).toBeGreaterThan(0));

    fireEvent.click(await screen.findByText('Ustalenia wg istotności'));
    await waitFor(() => expect(screen.getByText(/ZAK-8.4.1/)).toBeInTheDocument());
    expect(screen.queryByText('crit-1')).not.toBeInTheDocument();
  });

  it('renders a `keyValue`-kind section (scope) — the previous view had no branch for this kind at all', async () => {
    stubReads();
    mockedGetReport.mockResolvedValue(report);
    render(<AuditReportDocumentView reportId="rep-1" />);
    await waitFor(() => expect(screen.getAllByText('Metalpol Q3 Audit Report').length).toBeGreaterThan(0));

    fireEvent.click(await screen.findByText('Zakres i cele'));
    await waitFor(() => expect(screen.getByText('Purchasing process Q3 2026')).toBeInTheDocument());
    expect(screen.getByText('Verify supplier qualification controls')).toBeInTheDocument();
  });

  it('the "Rodzaj" property reads "Raport audytu" by default, then "Widok prezentacyjny" after switching — never the other under the wrong label', async () => {
    stubReads();
    mockedGetReport.mockResolvedValue(report);
    mockedGetReportPresentation.mockResolvedValue(presentation);
    render(<AuditReportDocumentView reportId="rep-1" />);
    await waitFor(() => expect(screen.getAllByText('Metalpol Q3 Audit Report').length).toBeGreaterThan(0));

    expect(screen.getByText('Raport audytu')).toBeInTheDocument();
    expect(screen.queryByText('Widok prezentacyjny')).not.toBeInTheDocument();

    // Mode switch lives in Menu 1's kebab (`extraOverflowItems` — the only
    // WORKING mechanism; `NModeHeaderConfig.secondaryActions` is a dead prop
    // in `NModeHeader.tsx`, see the pre-existing red
    // `NModeHeader.ownerActions.test.tsx`).
    const kebabTrigger = document.querySelector('button[aria-haspopup="menu"]');
    expect(kebabTrigger).toBeTruthy();
    fireEvent.click(kebabTrigger!);
    fireEvent.click(await screen.findByRole('menuitem', { name: /widok dla zarządu|executive view/i }));

    await waitFor(() => expect(mockedGetReportPresentation).toHaveBeenCalledWith('rep-1'));
    await waitFor(() => expect(screen.getByText('Audit found 1 nonconformity.')).toBeInTheDocument());
    expect(screen.getByText('Widok prezentacyjny')).toBeInTheDocument();
    expect(screen.queryByText('Raport audytu')).not.toBeInTheDocument();

    // Switching back returns to the full document without a second fetch of
    // /presentation. Re-query the trigger — `NModeShell` briefly unmounts the
    // header while `activeDocument` is null (sections.length===0 during the
    // presentation fetch), so the earlier `kebabTrigger` reference is stale.
    const kebabTrigger2 = document.querySelector('button[aria-haspopup="menu"]');
    expect(kebabTrigger2).toBeTruthy();
    fireEvent.click(kebabTrigger2!);
    fireEvent.click(await screen.findByRole('menuitem', { name: /pełny raport|full report/i }));
    await waitFor(() => expect(screen.getByText('Raport audytu')).toBeInTheDocument());
    expect(mockedGetReportPresentation).toHaveBeenCalledTimes(1);
  });

  it('Approve is available and works from the default (full) view — same gated endpoint as before', async () => {
    stubReads();
    mockedGetReport.mockResolvedValue(report);
    mockedApproveReport.mockResolvedValue({ ...report, status: 'approved' });
    render(<AuditReportDocumentView reportId="rep-1" />);
    await waitFor(() => expect(screen.getAllByText('Metalpol Q3 Audit Report').length).toBeGreaterThan(0));

    const approveButtons = screen.getAllByRole('button', { name: /Zatwierdź|Approve/i });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => expect(mockedApproveReport).toHaveBeenCalledWith('rep-1'));
  });

  it('shows an error state with retry when the report or its payload cannot be loaded (e.g. 404 / missing payload)', async () => {
    mockedGetReport.mockResolvedValue(null);
    render(<AuditReportDocumentView reportId="missing" />);
    await waitFor(() => expect(screen.getByText(/Nie udało się wczytać raportu/i)).toBeInTheDocument());
  });
});
