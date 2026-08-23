import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getConversationVisibilityReceipts, fetchProjects } = vi.hoisted(() => ({
  getConversationVisibilityReceipts: vi.fn(),
  fetchProjects: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('../../../services/api', () => ({
  Api: { getConversationVisibilityReceipts },
}));

vi.mock('../../../store/useChatProjectStore', () => ({
  useChatProjectStore: () => ({
    projects: [],
    isLoading: false,
    fetchProjects,
    createProject: vi.fn(),
    updateProject: vi.fn(),
    moveConversationToProject: vi.fn(),
    getPersonalProjects: () => [],
    getTeamProjects: () => [],
  }),
}));

import { MoveToProjectModal } from '../MoveToProjectModal';

describe('MoveToProjectModal visibility receipt readback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProjects.mockResolvedValue(undefined);
  });

  it('renders durable policy, scope and receipt identity after reopening', async () => {
    getConversationVisibilityReceipts.mockResolvedValue({
      receipts: [
        {
          id: 'ae-visibility-1',
          timestamp: '2026-08-23T12:00:00.000Z',
          actorId: 'user-owner-1',
          from: { scope: 'private_unassigned' },
          to: { scope: 'organization' },
          policyVersion: 'chat-history-visibility-v1',
        },
      ],
    });

    render(
      <MoveToProjectModal
        isOpen
        onClose={vi.fn()}
        conversation={{ id: 'conversation-1', title: 'Strategy' }}
      />
    );

    expect(await screen.findByText('Visibility history')).toBeInTheDocument();
    expect(screen.getByText(/private_unassigned → organization/)).toBeInTheDocument();
    expect(screen.getByText(/chat-history-visibility-v1/)).toHaveTextContent('ae-visibility-1');
    expect(screen.getByText('Actor: user-owner-1')).toBeInTheDocument();
    expect(getConversationVisibilityReceipts).toHaveBeenCalledWith('conversation-1');
  });

  it('keeps readback failure visible instead of implying no history', async () => {
    getConversationVisibilityReceipts.mockRejectedValue(new Error('offline'));

    render(
      <MoveToProjectModal
        isOpen
        onClose={vi.fn()}
        conversation={{ id: 'conversation-1', title: 'Strategy' }}
      />
    );

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Visibility history could not be loaded.')
    );
    expect(
      screen.queryByText('No organization visibility changes recorded.')
    ).not.toBeInTheDocument();
  });
});

