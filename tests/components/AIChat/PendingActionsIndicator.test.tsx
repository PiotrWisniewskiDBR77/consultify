/**
 * PendingActionsIndicator Component Tests
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { PendingActionsIndicator } from '../../../src/components/AIChat/PendingActionsIndicator';
import { Api } from '../../../src/services/api';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: any[]) => toastSuccess(...args),
    error: (...args: any[]) => toastError(...args),
  },
}));

describe('PendingActionsIndicator (L2)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-21T12:00:00.000Z'));
    toastSuccess.mockClear();
    toastError.mockClear();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as any).mockRestore?.();
    vi.useRealTimers();
  });

  it('renders null when there are no pending actions', async () => {
    vi.spyOn(Api, 'getPendingAIActions').mockResolvedValueOnce([]);
    const { container } = render(<PendingActionsIndicator projectId="p1" />);

    await waitFor(() => {
      expect(container).toBeEmptyDOMElement();
    });
  });

  it('in compact mode shows count and expands to list on click', async () => {
    vi.spyOn(Api, 'getPendingAIActions').mockResolvedValueOnce([
      {
        id: 'a1',
        action_type: 'CREATE_DRAFT_TASK',
        status: 'PENDING',
        created_at: '2026-02-21T11:59:30.000Z',
        payload: { title: 'Draft task', riskLevel: 'LOW' },
      },
      {
        id: 'a2',
        action_type: 'ANALYZE_RISKS',
        status: 'PENDING',
        created_at: '2026-02-21T11:58:00.000Z',
        payload: { title: 'Analyze risks', riskLevel: 'HIGH' },
      },
    ] as any);

    render(<PendingActionsIndicator projectId="p1" compact />);

    expect(await screen.findByText('2 pending')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pending/i }));

    expect(await screen.findByText('Pending Actions')).toBeInTheDocument();
    expect(screen.getByText('Draft task')).toBeInTheDocument();
    expect(screen.getByText('Analyze risks')).toBeInTheDocument();
  });

  it('approves an action, removes it from the list, and calls callback', async () => {
    vi.spyOn(Api, 'getPendingAIActions').mockResolvedValueOnce([
      {
        id: 'a1',
        action_type: 'CREATE_DRAFT_TASK',
        status: 'PENDING',
        created_at: '2026-02-21T11:59:30.000Z',
        payload: { title: 'Draft task', riskLevel: 'LOW' },
      },
    ] as any);
    vi.spyOn(Api, 'approveAIAction').mockResolvedValueOnce(undefined as any);
    const onActionDecided = vi.fn();

    render(<PendingActionsIndicator projectId="p1" compact onActionDecided={onActionDecided} />);
    expect(await screen.findByText('1 pending')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pending/i }));

    const approveBtn = await screen.findByTitle('Approve');
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(Api.approveAIAction).toHaveBeenCalledWith('a1');
      expect(toastSuccess).toHaveBeenCalledWith('Action approved');
      expect(onActionDecided).toHaveBeenCalledWith('a1', 'approved');
      expect(screen.queryByText('Draft task')).not.toBeInTheDocument();
    });
  });

  it('shows toast error when rejecting fails and keeps action visible', async () => {
    vi.spyOn(Api, 'getPendingAIActions').mockResolvedValueOnce([
      {
        id: 'a1',
        action_type: 'ANALYZE_RISKS',
        status: 'PENDING',
        created_at: '2026-02-21T11:58:00.000Z',
        payload: { title: 'Analyze risks', riskLevel: 'HIGH' },
      },
    ] as any);
    vi.spyOn(Api, 'rejectAIAction').mockRejectedValueOnce(new Error('nope'));

    render(<PendingActionsIndicator projectId="p1" compact />);
    expect(await screen.findByText('1 pending')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pending/i }));

    const rejectBtn = await screen.findByTitle('Reject');
    fireEvent.click(rejectBtn);

    await waitFor(() => {
      expect(Api.rejectAIAction).toHaveBeenCalledWith('a1');
      expect(toastError).toHaveBeenCalledWith('Failed to reject action');
      expect(screen.getByText('Analyze risks')).toBeInTheDocument();
    });
  });
});

