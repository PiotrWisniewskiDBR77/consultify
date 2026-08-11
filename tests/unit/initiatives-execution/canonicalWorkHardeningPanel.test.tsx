import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CanonicalWorkHardeningPanel } from '../../../src/components/shared/CanonicalWorkHardeningPanel';
import {
  readExecutionCase,
  transitionCanonicalDecision,
  transitionCanonicalTask,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  readExecutionCase: vi.fn(),
  transitionCanonicalTask: vi.fn(),
  transitionCanonicalDecision: vi.fn(),
}));

const task = {
  version: 4,
  executionCaseId: 'case-1',
  taskId: 'task-1',
  status: 'OPEN',
  dueAt: '2026-08-01T00:00:00.000Z',
  slaAt: '2026-08-02T00:00:00.000Z',
  ownerId: 'owner-1',
  assigneeId: 'assignee-1',
};

describe('CanonicalWorkHardeningPanel', () => {
  beforeEach(() => {
    vi.mocked(readExecutionCase).mockReset().mockResolvedValue({ version: 8 });
    vi.mocked(transitionCanonicalTask)
      .mockReset()
      .mockResolvedValue({
        aggregateVersion: 5,
        response: {
          ...task,
          assignment: {
            status: 'OFFERED',
            offeredAt: '2026-08-10T00:00:00.000Z',
            respondedAt: null,
            reason: null,
          },
        },
      });
    vi.mocked(transitionCanonicalDecision).mockReset();
  });

  it('offers assignment without changing identity and reads back the exact Task ID/version/status', async () => {
    const onReadback = vi.fn();
    render(<CanonicalWorkHardeningPanel item={task} actorId="owner-1" onReadback={onReadback} />);
    expect(screen.getByText('OVERDUE')).toBeInTheDocument();
    expect(screen.getByText(/Direct reassignment is blocked/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'OFFER ASSIGNMENT' }));
    await waitFor(() =>
      expect(transitionCanonicalTask).toHaveBeenCalledWith(
        'case-1',
        'task-1',
        expect.objectContaining({
          expectedVersion: 4,
          expectedCaseVersion: 8,
          action: 'OFFER_ASSIGNMENT',
        })
      )
    );
    expect(screen.getByRole('status')).toHaveTextContent('task-1 · v5 · OPEN');
    expect(onReadback).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-1' }), 5);
  });

  it('requires a reason and authority-validated command for Decision cancel/reopen', async () => {
    vi.mocked(transitionCanonicalDecision).mockResolvedValue({
      aggregateVersion: 3,
      response: {
        executionCaseId: 'case-1',
        decisionId: 'decision-1',
        version: 2,
        status: 'CANCELED',
        dueAt: '2026-08-01T00:00:00.000Z',
      },
    });
    render(
      <CanonicalWorkHardeningPanel
        actorId="authority-1"
        item={{
          version: 2,
          executionCaseId: 'case-1',
          decisionId: 'decision-1',
          status: 'PENDING',
          dueAt: '2026-08-01T00:00:00.000Z',
          authorityId: 'authority-1',
        }}
      />
    );
    expect(screen.getByRole('button', { name: 'CANCEL' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Controlled-action reason'), {
      target: { value: 'Superseded by governing decision.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'CANCEL' }));
    await waitFor(() =>
      expect(transitionCanonicalDecision).toHaveBeenCalledWith(
        'case-1',
        'decision-1',
        expect.objectContaining({
          action: 'CANCEL',
          reason: 'Superseded by governing decision.',
          expectedVersion: 2,
          expectedCaseVersion: 8,
        })
      )
    );
  });
});
