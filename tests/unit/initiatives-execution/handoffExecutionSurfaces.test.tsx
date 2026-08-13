import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HandoffAcceptanceQueue } from '../../../src/components/MyWork/HandoffAcceptanceQueue';
import { ExecutionRealizationsSurface } from '../../../src/components/Execution/ExecutionRealizationsSurface';
import {
  decideHandoffAcceptance,
  listExecutionCases,
  listMyHandoffAcceptances,
  readExecutionCase,
  readHandoffPackage,
  readRegisteredInitiative,
} from '../../../src/services/initiatives-execution/runtimeApi';
vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  decideHandoffAcceptance: vi.fn(),
  listMyHandoffAcceptances: vi.fn(),
  readExecutionCase: vi.fn(),
  readHandoffPackage: vi.fn(),
  readRegisteredInitiative: vi.fn(),
  listExecutionCases: vi.fn(),
}));
vi.mock('../../../src/components/MyWork/gateSignoffProjection', () => ({
  useGateSignoffGuard: () => ({
    ready: true,
    quorumRef: { quorumId: 'HANDOFF:handoff-d1', version: 1, receiptId: 'receipt-handoff' },
  }),
}));
beforeEach(() => {
  vi.mocked(listMyHandoffAcceptances)
    .mockResolvedValueOnce({
      decisions: [
        {
          version: 1,
          decisionId: 'handoff-d1',
          initiativeId: 'i1',
          handoffPackageId: 'pack1',
          handoffPackageVersion: 2,
          executionCaseId: 'case1',
          requesterId: 'o',
          authorityId: 'm',
          status: 'PENDING',
          dueAt: '2026-08-20',
          rolloutChildren: { pilot: [{ id: 'p' }], waves: [] },
        },
      ],
    })
    .mockResolvedValue({ decisions: [] });
  vi.mocked(readRegisteredInitiative).mockResolvedValue({
    version: 9,
    updatedAt: '2026-08-10T08:00:00.000Z',
    initiative: {
      initiativeId: 'i1',
      lifecycleState: 'IN_EXECUTION',
      title: 'Program poprawy jakości',
      problem: 'Rosnący poziom reklamacji.',
      proposedOutcome: 'Spadek reklamacji o 20%',
      projectId: 'p1',
      initiativeOwnerId: 'owner-1',
      readiness: 'READY',
      source: {
        proposalId: 'proposal-1',
        proposalVersion: 1,
        sourceType: 'assessment-finding',
        sourceId: 'finding-1',
        sourceVersion: 1,
        freshness: 'CURRENT',
      },
    },
  } as any);
  vi.mocked(readHandoffPackage).mockResolvedValue({ handoffPackageId: 'pack1', version: 2 });
  vi.mocked(decideHandoffAcceptance).mockResolvedValue({ status: 'APPLIED' });
  vi.mocked(readExecutionCase).mockResolvedValue({
    executionCaseId: 'case1',
    detail: {
      state: 'ACTIVE',
      acceptedBaseline: { scope: 'x' },
      portfolio: { id: 'pf' },
      plan: { id: 'pl' },
      capacity: { id: 'cp' },
      gaps: [{ ownerId: 'u', dueAt: '2026-09-01' }],
      rolloutChildren: { pilot: [{ id: 'p' }], waves: [] },
    },
  });
  vi.mocked(listExecutionCases).mockResolvedValue({
    cases: [
      {
        executionCaseId: 'case1',
        version: 1,
        initiativeId: 'i1',
        state: 'ACTIVE',
        executionManagerId: 'm',
        handoffPackageId: 'pack1',
        updatedAt: '2026-08-10',
      },
    ],
  });
});
describe('Handoff and Realizacje', () => {
  it('accepts exact pack using current canonical Initiative version and reads back stable case', async () => {
    render(<HandoffAcceptanceQueue />);
    const row = await screen.findByRole('row', { name: /Handoff Acceptance i1 pack1 v2 case1/ });
    fireEvent.click(row);
    fireEvent.keyDown(row.closest('div[tabindex="0"]')!, { key: 'Enter' });
    fireEvent.change(screen.getByLabelText('Handoff rationale'), {
      target: { value: 'Accepted exact package' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept handoff' }));
    await waitFor(() =>
      expect(decideHandoffAcceptance).toHaveBeenCalledWith(
        'i1',
        expect.objectContaining({
          expectedVersion: 9,
          decisionId: 'handoff-d1',
          outcome: 'ACCEPT',
          governanceQuorumRef: {
            quorumId: 'HANDOFF:handoff-d1',
            version: 1,
            receiptId: 'receipt-handoff',
          },
        })
      )
    );
    expect(await screen.findByText(/Execution Case case1/)).toBeInTheDocument();
  });
  it('renders an in-execution initiative as a canonical card linked to its workspace', async () => {
    render(<ExecutionRealizationsSurface scope="all" />);
    const card = (await screen.findByText('Program poprawy jakości')).closest('a');
    expect(card).toHaveAttribute('href', '/initiatives?mode=doc&open=i1');
    expect(screen.getByText('W realizacji')).toBeInTheDocument();
    expect(screen.getByText('Rosnący poziom reklamacji.')).toBeInTheDocument();
    expect(screen.getByText('1 otwarta luka')).toBeInTheDocument();
    expect(readExecutionCase).toHaveBeenCalledWith('case1');
  });

  it('does not expose execution-case implementation identifiers in the portfolio card', async () => {
    render(<ExecutionRealizationsSurface scope="all" />);
    expect(await screen.findByText('Program poprawy jakości')).toBeInTheDocument();
    expect(screen.queryByText(/Execution Case case1/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pack1/)).not.toBeInTheDocument();
  });
});
