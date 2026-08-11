import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ScheduleDecisionQueue } from '../../../src/components/MyWork/ScheduleDecisionQueue';
import {
  decideScheduleDecision,
  listMyScheduleDecisions,
  readHandoffPackage,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class RuntimeApiError extends Error {
    constructor(readonly status: number) {
      super(String(status));
    }
  },
  decideScheduleDecision: vi.fn(),
  listMyScheduleDecisions: vi.fn(),
  readHandoffPackage: vi.fn(),
}));
vi.mock('../../../src/components/MyWork/gateSignoffProjection', () => ({
  useGateSignoffGuard: () => ({
    ready: true,
    quorumRef: {
      quorumId: 'SCHEDULE:schedule-decision-1',
      version: 1,
      receiptId: 'receipt-schedule',
    },
  }),
}));

describe('ScheduleDecisionQueue', () => {
  beforeEach(() => {
    vi.mocked(listMyScheduleDecisions)
      .mockReset()
      .mockResolvedValueOnce({
        decisions: [
          {
            version: 1,
            decisionId: 'schedule-decision-1',
            initiativeId: 'initiative-1',
            status: 'PENDING',
            requesterId: 'owner-1',
            authorityId: 'authority-1',
            executionManagerId: 'manager-1',
            initiativeVersion: 7,
            dueAt: '2026-08-20T12:00:00.000Z',
            portfolio: { id: 'portfolio-1', version: 3 },
            plan: {
              id: 'plan-1',
              version: 4,
              windowUnit: 'WEEK',
              timezone: 'Europe/Warsaw',
              window: { earliest: '2026-09-01', target: '2026-09-15', latest: '2026-09-30' },
            },
            capacity: { id: 'capacity-1', version: 2 },
            commitmentVersions: { 'commitment-1': 5 },
            criticalPeriodIds: ['period-1'],
            criticalDependencies: [
              { dependencyId: 'dependency-1', state: 'RESOLVED', critical: true },
            ],
          },
        ],
      })
      .mockResolvedValue({ decisions: [] });
    vi.mocked(decideScheduleDecision)
      .mockReset()
      .mockResolvedValue({
        aggregateVersion: 9,
        response: { handoffPackageId: 'handoff:initiative-1:v9' },
      });
    vi.mocked(readHandoffPackage)
      .mockReset()
      .mockResolvedValue({ handoffPackageId: 'handoff:initiative-1:v9', version: 1 });
  });

  it('opens with keyboard and approves the canonical decision with exact refs and handoff read-back', async () => {
    render(<ScheduleDecisionQueue />);
    const row = await screen.findByRole('row', { name: /Schedule Decision initiative-1/ });
    fireEvent.click(row);
    const layout = row.closest('div[tabindex="0"]')!;
    fireEvent.keyDown(layout, { key: 'Enter' });
    expect(screen.getByText('schedule-decision-1')).toBeInTheDocument();
    expect(screen.getByText('commitment-1 v5')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Schedule Decision rationale'), {
      target: { value: 'Inputs are exact and accepted.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Approve schedule' }));
    await waitFor(() =>
      expect(decideScheduleDecision).toHaveBeenCalledWith(
        'initiative-1',
        expect.objectContaining({
          expectedVersion: 8,
          decisionId: 'schedule-decision-1',
          outcome: 'APPROVED',
          rationale: 'Inputs are exact and accepted.',
          governanceQuorumRef: {
            quorumId: 'SCHEDULE:schedule-decision-1',
            version: 1,
            receiptId: 'receipt-schedule',
          },
        })
      )
    );
    expect(await screen.findByRole('status')).toHaveTextContent('frozen Handoff Package');
    expect(screen.getByText(/handoff:initiative-1:v9/)).toBeInTheDocument();
    expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
  });
});
