import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PortfolioDecisionQueue } from '../../../src/components/MyWork/PortfolioDecisionQueue';
import {
  decidePortfolioDecision,
  getMyGateSignoffs,
  listMyPortfolioDecisions,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class RuntimeApiError extends Error {
    constructor(readonly status: number) {
      super(String(status));
    }
  },
  decidePortfolioDecision: vi.fn(),
  getMyGateSignoffs: vi.fn(),
  listMyPortfolioDecisions: vi.fn(),
}));

const decision = {
  version: 1,
  decisionId: 'portfolio-decision-1',
  initiativeId: 'initiative-1',
  status: 'PENDING' as const,
  requesterId: 'owner-1',
  authorityId: 'authority-1',
  scenarioId: 'scenario-1',
  scenarioVersion: 4,
  initiativeVersion: 9,
  cardVersions: { 'summary-scope': 2, 'strategic-fit': 3 },
  membershipSnapshot: {
    initiativeId: 'initiative-1',
    initiativeVersion: 9,
    disposition: 'INCLUDED',
    rank: 2,
    rankOverride: null,
    confidence: 'ESTIMATED',
    rationale: 'Best evidence-backed fit',
  },
  requestedAt: '2026-08-09T12:00:00.000Z',
  dueAt: '2026-08-20T12:00:00.000Z',
  policy: { policyId: 'policy-standard', policyVersion: 3 },
};

describe('PortfolioDecisionQueue', () => {
  beforeEach(() => {
    vi.mocked(listMyPortfolioDecisions).mockReset();
    vi.mocked(decidePortfolioDecision)
      .mockReset()
      .mockResolvedValue({
        response: { status: 'CONDITIONALLY_APPROVED' },
        mutation: { lifecycleState: 'APPROVED_BACKLOG' },
      });
    vi.mocked(getMyGateSignoffs).mockReset().mockResolvedValue({ items: [] });
  });

  it('shows the exact Initiative, Scenario, Card and membership snapshot and fails closed when governance is unknown', async () => {
    vi.mocked(listMyPortfolioDecisions).mockResolvedValue({ decisions: [decision] });
    render(<PortfolioDecisionQueue />);
    fireEvent.click(
      await screen.findByRole('row', { name: /Portfolio Decision initiative-1 scenario-1/ })
    );
    expect(screen.getByText('portfolio-decision-1')).toBeInTheDocument();
    expect(screen.getByText('initiative-1 · v9')).toBeInTheDocument();
    expect(screen.getAllByText('scenario-1 · v4')).toHaveLength(2);
    expect(screen.getByText(/"summary-scope":2/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('quorum is not satisfied');
    expect(screen.getByRole('button', { name: 'Record Portfolio Decision' })).toBeDisabled();
    expect(decidePortfolioDecision).not.toHaveBeenCalled();
  });

  it('records conditional approval only with conditions and reads back APPROVED_BACKLOG when governance is explicitly not enforced', async () => {
    vi.mocked(getMyGateSignoffs).mockResolvedValue({
      items: [
        {
          gate: 'PORTFOLIO',
          decisionId: 'portfolio-decision-1',
          quorum: {
            quorumId: 'PORTFOLIO:portfolio-decision-1',
            version: 2,
            status: 'SATISFIED',
            receiptId: 'receipt-1',
            signoffs: [],
            updatedAt: '2026-08-10T00:00:00.000Z',
          },
        },
      ],
    });
    vi.mocked(listMyPortfolioDecisions)
      .mockResolvedValueOnce({ decisions: [decision] })
      .mockResolvedValueOnce({ decisions: [] });
    render(<PortfolioDecisionQueue />);
    fireEvent.click(
      await screen.findByRole('row', { name: /Portfolio Decision initiative-1 scenario-1/ })
    );
    fireEvent.change(screen.getByLabelText('Portfolio outcome'), {
      target: { value: 'CONDITIONALLY_APPROVED' },
    });
    fireEvent.change(screen.getByLabelText('Portfolio Decision rationale'), {
      target: { value: 'Approve with owner checkpoint.' },
    });
    expect(screen.getByRole('button', { name: 'Record Portfolio Decision' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Portfolio conditions'), {
      target: { value: 'Confirm Benefit Owner\nRefresh demand estimate' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Record Portfolio Decision' }));
    await waitFor(() =>
      expect(decidePortfolioDecision).toHaveBeenCalledWith(
        'initiative-1',
        expect.objectContaining({
          decisionId: 'portfolio-decision-1',
          expectedVersion: 10,
          outcome: 'CONDITIONALLY_APPROVED',
          conditions: ['Confirm Benefit Owner', 'Refresh demand estimate'],
          mergeTargetInitiativeId: null,
          governanceQuorumRef: {
            quorumId: 'PORTFOLIO:portfolio-decision-1',
            version: 2,
            receiptId: 'receipt-1',
          },
        })
      )
    );
    expect(await screen.findByRole('status')).toHaveTextContent('APPROVED_BACKLOG');
  });
});
