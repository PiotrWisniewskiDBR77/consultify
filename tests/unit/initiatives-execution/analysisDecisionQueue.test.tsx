import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AnalysisDecisionQueue } from '../../../src/components/MyWork/AnalysisDecisionQueue';
import {
  decideAnalysis,
  listMyAnalysisDecisions,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class RuntimeApiError extends Error {
    constructor(readonly status: number) {
      super(String(status));
    }
  },
  decideAnalysis: vi.fn(),
  listMyAnalysisDecisions: vi.fn(),
}));
vi.mock('../../../src/components/MyWork/gateSignoffProjection', () => ({
  useGateSignoffGuard: () => ({
    ready: true,
    quorumRef: {
      quorumId: 'ANALYSIS:analysis-decision-1',
      version: 1,
      receiptId: 'receipt-analysis',
    },
  }),
}));

describe('AnalysisDecisionQueue', () => {
  beforeEach(() => {
    vi.mocked(listMyAnalysisDecisions)
      .mockReset()
      .mockResolvedValue([
        {
          version: 7,
          decisionId: 'analysis-decision-1',
          initiativeId: 'initiative-1',
          gate: 'ANALYSIS',
          status: 'PENDING',
          requesterId: 'owner-1',
          authorityId: 'authority-1',
          dueAt: '2026-08-20T12:00:00.000Z',
          requestedAt: '2026-08-09T12:00:00.000Z',
          cardVersions: Object.fromEntries(
            Array.from({ length: 10 }, (_, index) => [`card-${index}`, 1])
          ),
        },
      ]);
    vi.mocked(decideAnalysis)
      .mockReset()
      .mockResolvedValue({ status: 'APPLIED', aggregateVersion: 8 });
  });

  it('approves the canonical Analysis Decision ID inside its dedicated queue', async () => {
    render(<AnalysisDecisionQueue />);
    const row = await screen.findByRole('row', { name: /Analysis Decision initiative-1 ANALYSIS/ });
    fireEvent.click(row);
    expect(screen.getByText('analysis-decision-1')).toBeInTheDocument();
    expect(screen.getByText('10/10')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Analysis Decision rationale'), {
      target: { value: 'Evidence accepted.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve analysis' }));
    await waitFor(() =>
      expect(decideAnalysis).toHaveBeenCalledWith(
        'initiative-1',
        expect.objectContaining({
          decisionId: 'analysis-decision-1',
          expectedVersion: 7,
          outcome: 'APPROVED',
          rationale: 'Evidence accepted.',
        })
      )
    );
  });
});
