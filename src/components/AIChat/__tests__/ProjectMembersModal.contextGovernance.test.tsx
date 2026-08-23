import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getProjectMembers, getProjectKnowledge } = vi.hoisted(() => ({
  getProjectMembers: vi.fn(),
  getProjectKnowledge: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
}));

vi.mock('../../../services/api', () => ({
  Api: {
    getProjectMembers,
    getProjectKnowledge,
    addProjectMember: vi.fn(),
    updateProjectMemberRole: vi.fn(),
    removeProjectMember: vi.fn(),
    addProjectKnowledge: vi.fn(),
    deleteProjectKnowledge: vi.fn(),
    uploadChatAttachment: vi.fn(),
  },
}));

vi.mock('../../../store/useChatProjectStore', () => ({
  useChatProjectStore: () => ({
    updateProject: vi.fn(),
    fetchProjects: vi.fn(),
    projects: [{ id: 'p1', visibility: 'private' }],
  }),
}));

import { ProjectMembersModal } from '../ProjectMembersModal';

describe('ProjectMembersModal shared-context governance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectMembers.mockResolvedValue({ members: [], myRole: 'owner' });
  });

  it('renders owner, source, version, hash and durable audit history', async () => {
    getProjectKnowledge.mockResolvedValue({
      historyStatus: 'available',
      knowledge: [
        {
          id: 'k1',
          kind: 'text',
          title: 'Mandate',
          content: 'Grow in EU',
          added_by: 'owner-1',
          version: 1,
          content_hash: 'sha256:abc',
          hash_basis: 'content',
          provenance: { type: 'user_note', reference: null },
        },
      ],
      history: [
        {
          id: 'ae-context-1',
          timestamp: '2026-08-23T12:00:00.000Z',
          actorId: 'owner-1',
          action: 'chat.project_context_added',
          after: { version: 1, contentHash: 'sha256:abc' },
        },
      ],
    });

    render(<ProjectMembersModal isOpen onClose={vi.fn()} projectId="p1" projectName="Strategy" />);

    expect(await screen.findByText('Mandate')).toBeInTheDocument();
    expect(screen.getByText(/Owner: owner-1/)).toHaveTextContent('Version: 1');
    expect(screen.getByText(/Owner: owner-1/)).toHaveTextContent('Source: user_note');
    expect(screen.getByText(/Owner: owner-1/)).toHaveTextContent('Content hash: sha256:abc');
    expect(screen.getByText(/chat\.project_context_added/)).toHaveTextContent('owner-1');
    expect(screen.getByText(/chat\.project_context_added/)).toHaveTextContent('sha256:abc');
  });

  it('does not turn an audit readback failure into an empty-history claim', async () => {
    getProjectKnowledge.mockResolvedValue({
      knowledge: [],
      history: [],
      historyStatus: 'unavailable',
    });

    render(<ProjectMembersModal isOpen onClose={vi.fn()} projectId="p1" projectName="Strategy" />);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Context history could not be loaded.')
    );
    expect(screen.queryByText('No context changes recorded.')).not.toBeInTheDocument();
  });
});

