/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getAggregate: vi.fn(),
  adopt: vi.fn(),
  addNote: vi.fn(),
  archiveNote: vi.fn(),
  transition: vi.fn(),
  close: vi.fn(),
  proposeOutput: vi.fn(),
  approveOutput: vi.fn(),
  rejectOutput: vi.fn(),
  materializeOutput: vi.fn(),
}));

vi.mock('@/services/api/meetingCore.api', () => ({ meetingCoreApi: api }));

import { MeetingCorePanel } from '../MeetingCorePanel';

const aggregate = (overrides: Record<string, unknown> = {}) => ({
  meeting: {
    id: 'meeting-1',
    title: 'Quarterly review',
    lifecycleStatus: 'DRAFT',
    purpose: null,
    expectedOutcomes: null,
  },
  participants: [],
  notes: [],
  outputs: [],
  ...overrides,
});

describe('MeetingCorePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adopts an existing legacy meeting without creating a second record', async () => {
    api.getAggregate
      .mockResolvedValueOnce(
        aggregate({ meeting: { ...aggregate().meeting, lifecycleStatus: null } })
      )
      .mockResolvedValueOnce(aggregate());
    api.adopt.mockResolvedValue({ meeting: aggregate().meeting });

    render(<MeetingCorePanel meetingId="meeting-1" isPolish={false} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Enable governed minutes' }));
    await waitFor(() => expect(api.adopt).toHaveBeenCalledWith('meeting-1'));
    expect(await screen.findByText('Draft')).toBeTruthy();
  });

  it('keeps task creation proposal-first and materializes only after approval', async () => {
    const proposedOutput = {
      id: 'output-1',
      outputKind: 'task',
      proposedPayload: { title: 'Send recap' },
      status: 'PROPOSED',
      canonicalId: null,
      idempotencyKey: 'meeting-output-key-1',
      failureReason: null,
    };
    const approvedOutput = { ...proposedOutput, status: 'APPROVED' };
    api.getAggregate
      .mockResolvedValueOnce(aggregate())
      .mockResolvedValueOnce(aggregate({ outputs: [proposedOutput] }))
      .mockResolvedValueOnce(aggregate({ outputs: [approvedOutput] }))
      .mockResolvedValueOnce(
        aggregate({
          outputs: [{ ...approvedOutput, status: 'MATERIALIZED', canonicalId: 'task-1' }],
        })
      );
    api.proposeOutput.mockResolvedValue({ output: proposedOutput });
    api.approveOutput.mockResolvedValue({ output: approvedOutput });
    api.materializeOutput.mockResolvedValue({
      output: { ...approvedOutput, status: 'MATERIALIZED', canonicalId: 'task-1' },
    });

    render(<MeetingCorePanel meetingId="meeting-1" isPolish={false} />);
    fireEvent.change(await screen.findByPlaceholderText('Name the task or decision…'), {
      target: { value: 'Send recap' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Propose for approval' }));

    await waitFor(() => expect(api.proposeOutput).toHaveBeenCalled());
    expect(api.materializeOutput).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(api.approveOutput).toHaveBeenCalledWith('meeting-1', 'output-1'));

    fireEvent.click(await screen.findByRole('button', { name: 'Create' }));
    await waitFor(() =>
      expect(api.materializeOutput).toHaveBeenCalledWith(
        'meeting-1',
        'output-1',
        'meeting-output-key-1'
      )
    );
    expect(await screen.findByText('Created')).toBeTruthy();
  });
});
