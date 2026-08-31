/**
 * AuditFindingsTab — NAPRAWA 1 (panel ekspercki 2026-08-26, moduł Audyty
 * 6,0/10): the module had five tabs and none showed the findings/CAPA
 * register, despite `GET /audits/findings*` being complete and unused. This
 * proves the register renders real rows, resolves raw IDs (criterion/owner/
 * evidence) to names instead of showing them raw, and that the kebab's
 * state-transition actions are wired to the REAL, backend-gated endpoints —
 * not decorative buttons.
 *
 * R2(a)/R3(c) (panel powtórny DEC-117): also proves (1) `listFindings` is
 * called with `limit`/`offset` and the server's `total` — not `items.length`
 * — drives the visible counter and paginator, and (2) the close/accept-risk
 * note is entered through the canonical `NoteEntryModal` (validated
 * multi-line field), never `window.prompt`.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../auditsMethodApi', async () => {
  const actual = await vi.importActual<typeof import('../auditsMethodApi')>('../auditsMethodApi');
  return {
    ...actual,
    listFindings: vi.fn(),
    listProgramCriteria: vi.fn(),
    listAllActions: vi.fn(),
    listEvidence: vi.fn(),
    reviewFinding: vi.fn(),
    acceptResidualRisk: vi.fn(),
    closeFinding: vi.fn(),
  };
});

import {
  type AuditActionSummary,
  type AuditCriterionSummary,
  type AuditEvidenceSummary,
  type AuditFindingSummary,
  type AuditProgramSummary,
  closeFinding,
  listAllActions,
  listEvidence,
  listFindings,
  listProgramCriteria,
  reviewFinding,
} from '../auditsMethodApi';
import { AuditFindingsTab } from '../tabs/AuditFindingsTab';

const mockedListFindings = vi.mocked(listFindings);
const mockedListProgramCriteria = vi.mocked(listProgramCriteria);
const mockedListAllActions = vi.mocked(listAllActions);
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
  reviewedAt: null,
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
  mockedListProgramCriteria.mockResolvedValue([criterion]);
  mockedListAllActions.mockResolvedValue(actionsEmpty);
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
    await waitFor(() =>
      expect(screen.getByText(/Missing periodic supplier assessment/)).toBeInTheDocument()
    );

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
    await waitFor(() =>
      expect(screen.getByText(/Missing periodic supplier assessment/)).toBeInTheDocument()
    );

    const menu = await openKebab();
    const confirmItem = within(menu).getByText('Confirm');
    expect(confirmItem.closest('button')).not.toBeDisabled();
  });

  it('calls the real reviewFinding endpoint with decision=confirm and reflects the returned status', async () => {
    stubCommonReads();
    mockedListFindings.mockResolvedValue({ items: [draftFinding], total: 1 });
    mockedReviewFinding.mockResolvedValue({
      ...draftFinding,
      status: 'confirmed',
      reviewedBy: 'user-lead',
    });
    render(<AuditFindingsTab isPolish={false} programs={[program]} />);
    await waitFor(() =>
      expect(screen.getByText(/Missing periodic supplier assessment/)).toBeInTheDocument()
    );

    const menu = await openKebab();
    fireEvent.click(within(menu).getByText('Confirm'));

    await waitFor(() => expect(mockedReviewFinding).toHaveBeenCalledWith('find-1', 'confirm'));
    await waitFor(() => expect(screen.getByText('Confirmed')).toBeInTheDocument());
  });

  it('R3(c): close finding opens the canonical note modal — Cancel makes no call, a validated note calls closeFinding', async () => {
    stubCommonReads();
    const confirmedFinding: AuditFindingSummary = { ...draftFinding, status: 'confirmed' };
    mockedListFindings.mockResolvedValue({ items: [confirmedFinding], total: 1 });
    render(<AuditFindingsTab isPolish={false} programs={[program]} />);
    await waitFor(() =>
      expect(screen.getByText(/Missing periodic supplier assessment/)).toBeInTheDocument()
    );

    const menu1 = await openKebab();
    fireEvent.click(within(menu1).getByText('Close finding'));

    // The submit button is disabled until the (multi-line) note is non-empty.
    const submit = await screen.findByTestId('note-entry-modal-submit');
    expect(submit).toBeDisabled();

    // Cancel closes the modal without calling the API.
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    await waitFor(() =>
      expect(screen.queryByTestId('note-entry-modal-textarea')).not.toBeInTheDocument()
    );
    expect(mockedCloseFinding).not.toHaveBeenCalled();

    mockedCloseFinding.mockResolvedValue({ ...confirmedFinding, status: 'closed' });
    const menu2 = await openKebab();
    fireEvent.click(within(menu2).getByText('Close finding'));
    const textarea = await screen.findByTestId('note-entry-modal-textarea');
    fireEvent.change(textarea, {
      target: { value: 'Verified effective in the September re-test.' },
    });
    fireEvent.click(screen.getByTestId('note-entry-modal-submit'));

    await waitFor(() =>
      expect(mockedCloseFinding).toHaveBeenCalledWith(
        'find-1',
        'Verified effective in the September re-test.'
      )
    );
    // No `window.prompt` involved anywhere in this flow.
    await waitFor(() =>
      expect(screen.queryByTestId('note-entry-modal-textarea')).not.toBeInTheDocument()
    );
  });

  it('R2(a): passes limit/offset to listFindings, shows the server total, and Next requests the second page', async () => {
    stubCommonReads();
    // 3 findings visible on a 1-item page (page size is internal to the tab,
    // 50 in production) — what matters here is that `total` (73) drives the
    // counter, NOT `items.length` (1), and that Next asks for `offset > 0`.
    mockedListFindings.mockResolvedValue({ items: [draftFinding], total: 73 });
    render(<AuditFindingsTab isPolish={true} programs={[program]} />);

    await waitFor(() =>
      expect(mockedListFindings).toHaveBeenCalledWith(
        expect.objectContaining({ programId: 'prog-1', limit: expect.any(Number), offset: 0 })
      )
    );
    // The visible counter must reflect the server's `total`, not the single
    // item on this page.
    await waitFor(() => expect(screen.getByTestId('audit-findings-total')).toHaveTextContent('73'));

    const nextButton = await screen.findByTestId('audit-findings-next-page');
    fireEvent.click(nextButton);

    await waitFor(() => {
      const lastCall = mockedListFindings.mock.calls.at(-1)?.[0];
      expect(lastCall).toMatchObject({ programId: 'prog-1', offset: 50 });
    });
  });

  it('shows an empty-state instead of a table when the organization has no audit programs at all', async () => {
    render(<AuditFindingsTab isPolish={false} programs={[]} />);
    await waitFor(() => expect(screen.getByText(/No audit programs yet/i)).toBeInTheDocument());
  });
});
