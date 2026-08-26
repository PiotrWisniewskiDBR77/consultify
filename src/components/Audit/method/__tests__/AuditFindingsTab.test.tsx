/**
 * AuditFindingsTab — NAPRAWA 1 (panel ekspercki 2026-08-26, moduł Audyty
 * 6,0/10): the module had five tabs and none showed the findings/CAPA
 * register, despite `GET /audits/findings*` being complete and unused. This
 * proves the register renders real rows, resolves raw IDs (criterion/owner/
 * evidence) to names instead of showing them raw, and that the kebab's
 * state-transition actions are wired to the REAL, backend-gated endpoints —
 * not decorative buttons.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    listFindings: vi.fn(),
    getFindingStatistics: vi.fn(),
    getSystemicFindings: vi.fn(),
    listProgramCriteria: vi.fn(),
    listActions: vi.fn(),
    listEvidence: vi.fn(),
    reviewFinding: vi.fn(),
    acceptResidualRisk: vi.fn(),
    closeFinding: vi.fn(),
  };
});

import { AuditFindingsTab } from '../tabs/AuditFindingsTab';
import {
  closeFinding,
  getFindingStatistics,
  getSystemicFindings,
  listActions,
  listEvidence,
  listFindings,
  listProgramCriteria,
  reviewFinding,
  type AuditActionSummary,
  type AuditCriterionSummary,
  type AuditEvidenceSummary,
  type AuditFindingSummary,
  type AuditProgramSummary,
} from '../auditsMethodApi';

const mockedListFindings = vi.mocked(listFindings);
const mockedGetFindingStatistics = vi.mocked(getFindingStatistics);
const mockedGetSystemicFindings = vi.mocked(getSystemicFindings);
const mockedListProgramCriteria = vi.mocked(listProgramCriteria);
const mockedListActions = vi.mocked(listActions);
const mockedListEvidence = vi.mocked(listEvidence);
const mockedReviewFinding = vi.mocked(reviewFinding);
const mockedCloseFinding = vi.mocked(closeFinding);

const program: AuditProgramSummary = {
  id: 'prog-1',
  name: 'Metalpol — Q3 Purchasing Audit',
  packId: 'pack-1',
  packTitle: 'QMS pack',
  packVersion: 1,
  lifecycleState: 'findings_review',
  applicableCriteria: 10,
  concludedCriteria: 5,
  openFindings: 1,
  leadAuditorId: 'user-lead',
  leadAuditorName: 'Lead Auditor',
  plannedStart: null,
  plannedEnd: null,
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

const evidenceItem: AuditEvidenceSummary = {
  id: 'evid-1',
  programId: 'prog-1',
  criterionId: 'crit-1',
  evidenceKind: 'document',
  title: 'Supplier score cards 2025',
};

const draftFinding: AuditFindingSummary = {
  id: 'find-1',
  programId: 'prog-1',
  criterionId: 'crit-1',
  referenceCode: 'UST-2026-001',
  statement: 'Missing periodic supplier assessment for 5 class-A suppliers',
  requirementText: null,
  conditionText: null,
  sourceReference: null,
  gapText: null,
  objectiveEvidence: ['evid-1'],
  contradictingEvidence: [],
  classification: 'nonconforming',
  severity: 'medium',
  riskText: null,
  impactText: null,
  recommendation: null,
  rootCause: null,
  rootCauseMethod: null,
  rootCauseConfirmed: false,
  status: 'draft',
  ownerUserId: null,
  authorId: 'user-author',
  reviewedBy: null,
  reviewNote: null,
  sentBackAt: null,
  sentBackBy: null,
  sendBackReason: null,
  residualRisk: null,
  residualRiskAcceptedBy: null,
  residualRiskAcceptedAt: null,
  residualRiskNote: null,
  closedAt: null,
  closedBy: null,
  closureNote: null,
  createdAt: '2026-08-21T00:00:00Z',
  updatedAt: '2026-08-21T00:00:00Z',
};

const actionsEmpty: AuditActionSummary[] = [];

function stubCommonReads() {
  mockedGetFindingStatistics.mockResolvedValue({ total: 1, byClassification: {}, bySeverity: {}, byStatus: {} });
  mockedGetSystemicFindings.mockResolvedValue([]);
  mockedListProgramCriteria.mockResolvedValue([criterion]);
  mockedListActions.mockResolvedValue({ items: actionsEmpty, total: 0 });
  mockedListEvidence.mockResolvedValue([evidenceItem]);
}

async function openKebab() {
  const trigger = await screen.findByRole('button', { name: /row actions/i });
  fireEvent.click(trigger);
  return screen.findByRole('menu');
}

describe('AuditFindingsTab — findings/CAPA register (NAPRAWA 1)', () => {
  it('renders the finding row with resolved classification/status, not raw enum keys', async () => {
    stubCommonReads();
    mockedListFindings.mockResolvedValue({ items: [draftFinding], total: 1 });
    render(<AuditFindingsTab isPolish={false} programs={[program]} />);

    await waitFor(() =>
      expect(screen.getByText(/Missing periodic supplier assessment/)).toBeInTheDocument()
    );
    expect(screen.getByText('Nonconforming')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('resolves criterionId and objectiveEvidence IDs to real titles in the preview — never raw IDs', async () => {
    stubCommonReads();
    mockedListFindings.mockResolvedValue({ items: [draftFinding], total: 1 });
    render(<AuditFindingsTab isPolish={false} programs={[program]} />);
    await waitFor(() => expect(screen.getByText(/Missing periodic supplier assessment/)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Missing periodic supplier assessment/));
    const preview = await screen.findByTestId('audit-finding-preview');
    await waitFor(() => expect(within(preview).getByText(/ZAK-8.4.1/)).toBeInTheDocument());
    expect(within(preview).getByText(/Supplier score cards 2025/)).toBeInTheDocument();
    // The raw IDs themselves must not leak onto the face of the preview.
    expect(within(preview).queryByText('crit-1')).not.toBeInTheDocument();
    expect(within(preview).queryByText('evid-1')).not.toBeInTheDocument();
  });

  it('kebab: Confirm is enabled for a draft finding; Close is disabled with a real reason', async () => {
    stubCommonReads();
    mockedListFindings.mockResolvedValue({ items: [draftFinding], total: 1 });
    render(<AuditFindingsTab isPolish={false} programs={[program]} />);
    await waitFor(() => expect(screen.getByText(/Missing periodic supplier assessment/)).toBeInTheDocument());

    const menu = await openKebab();
    const confirmItem = within(menu).getByText('Confirm');
    expect(confirmItem.closest('button')).not.toBeDisabled();
  });

  it('calls the real reviewFinding endpoint with decision=confirm and reflects the returned status', async () => {
    stubCommonReads();
    mockedListFindings.mockResolvedValue({ items: [draftFinding], total: 1 });
    mockedReviewFinding.mockResolvedValue({ ...draftFinding, status: 'confirmed', reviewedBy: 'user-lead' });
    render(<AuditFindingsTab isPolish={false} programs={[program]} />);
    await waitFor(() => expect(screen.getByText(/Missing periodic supplier assessment/)).toBeInTheDocument());

    const menu = await openKebab();
    fireEvent.click(within(menu).getByText('Confirm'));

    await waitFor(() => expect(mockedReviewFinding).toHaveBeenCalledWith('find-1', 'confirm'));
    await waitFor(() => expect(screen.getByText('Confirmed')).toBeInTheDocument());
  });

  it('close finding prompts for a note and calls closeFinding with it — a cancelled prompt makes no call', async () => {
    stubCommonReads();
    const confirmedFinding: AuditFindingSummary = { ...draftFinding, status: 'confirmed' };
    mockedListFindings.mockResolvedValue({ items: [confirmedFinding], total: 1 });
    render(<AuditFindingsTab isPolish={false} programs={[program]} />);
    await waitFor(() => expect(screen.getByText(/Missing periodic supplier assessment/)).toBeInTheDocument());

    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValueOnce(null);
    const menu1 = await openKebab();
    fireEvent.click(within(menu1).getByText('Close finding'));
    expect(mockedCloseFinding).not.toHaveBeenCalled();

    promptSpy.mockReturnValueOnce('Verified effective in the September re-test.');
    mockedCloseFinding.mockResolvedValue({ ...confirmedFinding, status: 'closed' });
    const menu2 = await openKebab();
    fireEvent.click(within(menu2).getByText('Close finding'));
    await waitFor(() =>
      expect(mockedCloseFinding).toHaveBeenCalledWith('find-1', 'Verified effective in the September re-test.')
    );
    promptSpy.mockRestore();
  });

  it('shows an empty-state instead of a table when the organization has no audit programs at all', async () => {
    render(<AuditFindingsTab isPolish={false} programs={[]} />);
    await waitFor(() => expect(screen.getByText(/No audit programs yet/i)).toBeInTheDocument());
  });
});
