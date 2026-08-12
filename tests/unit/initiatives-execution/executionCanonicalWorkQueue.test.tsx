import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ExecutionCanonicalWorkQueue } from '../../../src/components/MyWork/ExecutionCanonicalWorkQueue';
import {
  listMyExecutionWork,
  listMyOperationalAllocations,
  readExecutionCase,
  transitionCanonicalTask,
} from '../../../src/services/initiatives-execution/runtimeApi';

vi.mock('../../../src/services/initiatives-execution/runtimeApi', () => ({
  RuntimeApiError: class extends Error {
    status = 409;
  },
  listMyExecutionWork: vi.fn(),
  listMyOperationalAllocations: vi.fn(),
  readExecutionCase: vi.fn(),
  transitionCanonicalTask: vi.fn(),
  transitionCanonicalDecision: vi.fn(),
}));

describe('ExecutionCanonicalWorkQueue hardening parity', () => {
  beforeEach(() => {
    vi.mocked(listMyExecutionWork).mockResolvedValue({
      tasks: [
        {
          version: 6,
          executionCaseId: 'case-1',
          initiativeId: 'initiative-1',
          taskId: 'task-1',
          title: 'Collect evidence',
          status: 'BLOCKED',
          ownerId: 'owner-1',
          assigneeId: 'user-123',
          dueAt: '2026-08-20T00:00:00.000Z',
          slaAt: '2026-08-19T00:00:00.000Z',
          assignment: {
            status: 'OFFERED',
            offeredAt: '2026-08-10T00:00:00.000Z',
            respondedAt: null,
            reason: null,
          },
          milestoneIds: ['milestone-1'],
          blastRadius: [
            {
              milestoneId: 'milestone-1',
              version: 5,
              status: 'AT_RISK',
              readiness: 'BLOCKED',
              forecastVarianceDays: 3,
              sourceVersions: { executionCaseVersion: 11, baselineVersion: 2 },
            },
          ],
        },
      ],
      decisions: [],
    });
    vi.mocked(listMyOperationalAllocations).mockResolvedValue({ items: [] });
    vi.mocked(readExecutionCase).mockResolvedValue({ version: 11 });
    vi.mocked(transitionCanonicalTask).mockResolvedValue({
      aggregateVersion: 7,
      response: {
        executionCaseId: 'case-1',
        taskId: 'task-1',
        status: 'OPEN',
        dueAt: '2026-08-20T00:00:00.000Z',
        slaAt: '2026-08-19T00:00:00.000Z',
        assignment: {
          status: 'ACCEPTED',
          offeredAt: '2026-08-10T00:00:00.000Z',
          respondedAt: '2026-08-10T01:00:00.000Z',
          reason: '',
        },
      },
    });
  });

  it('accepts the same assignment and keeps canonical Task ID/version/status readback in My Work', async () => {
    render(<ExecutionCanonicalWorkQueue />);
    fireEvent.click(await screen.findByRole('button', { name: /task-1/i }));
    expect(screen.getByText(/Zadanie · …task-1/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Zablokowane zadanie wpływa na 1');
    fireEvent.click(screen.getByRole('button', { name: 'Akceptuj przypisanie' }));
    await waitFor(() =>
      expect(transitionCanonicalTask).toHaveBeenCalledWith(
        'case-1',
        'task-1',
        expect.objectContaining({
          expectedVersion: 6,
          expectedCaseVersion: 11,
          action: 'ACCEPT_ASSIGNMENT',
        })
      )
    );
    expect(screen.getByRole('status')).toHaveTextContent('…task-1 · v7 · Otwarte');
    expect(screen.getByText('v7')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Task milestone blast radius' })).toHaveTextContent(
      'Kamień · …estone-1 v5 · Zagrożony · Zablokowany'
    );
    expect(screen.getByText(/Odchylenie prognozy: \+3 dni/)).toBeInTheDocument();
  });
});
