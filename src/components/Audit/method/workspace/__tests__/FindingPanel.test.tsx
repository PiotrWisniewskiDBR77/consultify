/**
 * FindingPanel — ogniwa „ustalenie" i „odpowiedź właściciela". Mockuje
 * `../workspaceApi` NA POZIOMIE MODUŁU.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../workspaceApi', async () => {
  const actual = await vi.importActual<typeof import('../workspaceApi')>('../workspaceApi');
  return {
    ...actual,
    listFindings: vi.fn(),
    getFinding: vi.fn(),
    createFinding: vi.fn(),
    reviewFinding: vi.fn(),
    submitManagementResponse: vi.fn(),
    acceptResidualRisk: vi.fn(),
    createIntent: vi.fn(),
    decideProposal: vi.fn(),
    commitProposal: vi.fn(),
  };
});

import { FindingPanel } from '../FindingPanel';
import * as workspaceApi from '../workspaceApi';
import type { WorkspaceCapability, WorkspaceFinding, WorkspaceFindingDetail } from '../workspaceApi';

const mockedListFindings = vi.mocked(workspaceApi.listFindings);
const mockedGetFinding = vi.mocked(workspaceApi.getFinding);
const mockedReviewFinding = vi.mocked(workspaceApi.reviewFinding);

function findingSummary(overrides: Partial<WorkspaceFinding> = {}): WorkspaceFinding {
  return {
    id: 'finding-1',
    programId: 'prog-1',
    criterionId: 'crit-1',
    referenceCode: 'F-1',
    statement: 'Access control policy is missing required approvals',
    requirementText: null,
    conditionText: null,
    gapText: null,
    objectiveEvidence: ['ev-1'],
    contradictingEvidence: [],
    classification: 'nonconforming',
    severity: 'medium',
    recommendation: null,
    rootCause: null,
    rootCauseMethod: null,
    rootCauseConfirmed: false,
    status: 'draft',
    ownerUserId: null,
    authorId: 'user-author',
    reviewedBy: null,
    aiProposed: false,
    residualRisk: null,
    residualRiskNote: null,
    closedAt: null,
    closureNote: null,
    createdAt: '2026-08-01T00:00:00Z',
    updatedAt: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function findingDetail(overrides: Partial<WorkspaceFindingDetail> = {}): WorkspaceFindingDetail {
  return {
    ...findingSummary(),
    managementResponses: [],
    correctiveActions: [],
    verifications: [],
    ...overrides,
  };
}

function renderPanel(props: {
  capabilities: WorkspaceCapability[];
  currentUserId: string | null;
  selectedFindingId?: string | null;
  maxRows?: number;
}) {
  const onSelectFinding = vi.fn();
  const onFindingDetailChange = vi.fn();
  const utils = render(
    <FindingPanel
      programId="prog-1"
      criterionId="crit-1"
      capabilities={new Set(props.capabilities)}
      currentUserId={props.currentUserId}
      isPolish
      selectedFindingId={props.selectedFindingId ?? null}
      onSelectFinding={onSelectFinding}
      onFindingDetailChange={onFindingDetailChange}
      maxRows={props.maxRows}
    />
  );
  return { ...utils, onSelectFinding, onFindingDetailChange };
}

describe('FindingPanel', () => {
  it('lists findings in a real StandardTable', async () => {
    mockedListFindings.mockResolvedValue({ items: [findingSummary()], total: 1 });
    const { container } = renderPanel({ capabilities: ['finding.review'], currentUserId: 'user-reviewer' });

    await waitFor(() => expect(screen.getByText(/access control policy is missing/i)).toBeInTheDocument());
    expect(container.querySelector('table')).toBeInTheDocument();
  });

  it('does not offer "confirm" to the author of their own draft finding', async () => {
    mockedListFindings.mockResolvedValue({ items: [findingSummary()], total: 1 });
    mockedGetFinding.mockResolvedValue(findingDetail({ authorId: 'user-author', status: 'draft' }));
    renderPanel({ capabilities: ['finding.review'], currentUserId: 'user-author', selectedFindingId: 'finding-1' });

    await waitFor(() => expect(mockedGetFinding).toHaveBeenCalledWith('finding-1'));

    await waitFor(() =>
      expect(screen.getByText(/nie możesz zrecenzować własnego ustalenia/i)).toBeInTheDocument()
    );
    expect(screen.queryByRole('button', { name: /potwierdź/i })).not.toBeInTheDocument();
  });

  it('offers review actions to an independent reviewer', async () => {
    mockedListFindings.mockResolvedValue({ items: [findingSummary()], total: 1 });
    mockedGetFinding.mockResolvedValue(findingDetail({ authorId: 'user-author', status: 'draft' }));
    mockedReviewFinding.mockResolvedValue(findingSummary({ status: 'confirmed' }));
    renderPanel({ capabilities: ['finding.review'], currentUserId: 'user-reviewer', selectedFindingId: 'finding-1' });

    const confirmButton = await screen.findByRole('button', { name: /^potwierdź$/i });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(mockedReviewFinding).toHaveBeenCalledWith('finding-1', expect.objectContaining({ decision: 'confirm' })));
  });

  it('does not offer the "new finding" form without finding.draft', async () => {
    mockedListFindings.mockResolvedValue({ items: [], total: 0 });
    renderPanel({ capabilities: ['finding.review'], currentUserId: 'user-reviewer' });

    await waitFor(() => expect(mockedListFindings).toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /nowe ustalenie/i })).not.toBeInTheDocument();
  });

  it('maxRows (DEC-88 phase-card table) truncates to N rows with a "show all" toggle; unset stays unlimited', async () => {
    const items = [
      findingSummary({ id: 'f-1', referenceCode: 'F-1', statement: 'First finding statement text' }),
      findingSummary({ id: 'f-2', referenceCode: 'F-2', statement: 'Second finding statement text' }),
      findingSummary({ id: 'f-3', referenceCode: 'F-3', statement: 'Third finding statement text' }),
    ];
    mockedListFindings.mockResolvedValue({ items, total: 3 });
    renderPanel({ capabilities: ['finding.review'], currentUserId: 'user-reviewer', maxRows: 2 });

    await waitFor(() => expect(screen.getByText(/first finding/i)).toBeInTheDocument());
    expect(screen.getByText(/second finding/i)).toBeInTheDocument();
    expect(screen.queryByText(/third finding/i)).not.toBeInTheDocument();

    const showAll = screen.getByRole('button', { name: /pokaż wszystkie \(3\)/i });
    fireEvent.click(showAll);
    expect(await screen.findByText(/third finding/i)).toBeInTheDocument();
  });

  it('without maxRows, every row renders and no "show all" toggle appears (V1 unaffected)', async () => {
    const items = [
      findingSummary({ id: 'f-1', referenceCode: 'F-1', statement: 'First finding statement text' }),
      findingSummary({ id: 'f-2', referenceCode: 'F-2', statement: 'Second finding statement text' }),
      findingSummary({ id: 'f-3', referenceCode: 'F-3', statement: 'Third finding statement text' }),
    ];
    mockedListFindings.mockResolvedValue({ items, total: 3 });
    renderPanel({ capabilities: ['finding.review'], currentUserId: 'user-reviewer' });

    await waitFor(() => expect(screen.getByText(/third finding/i)).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /pokaż wszystkie/i })).not.toBeInTheDocument();
  });
});
