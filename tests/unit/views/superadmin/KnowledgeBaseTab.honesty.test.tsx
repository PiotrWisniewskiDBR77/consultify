import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeBaseTab } from '@/views/superadmin/AIPlatformModule/Knowledge/KnowledgeBaseTab';
import { Api } from '@/services/api';
import { toast } from 'react-hot-toast';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getProjects: vi.fn(),
    getApprovedIdeas: vi.fn(),
    getKnowledgeCandidates: vi.fn(),
    updateCandidateStatus: vi.fn(),
    updateKnowledgeCandidate: vi.fn(),
    getAllGlobalStrategies: vi.fn(),
    getKnowledgeDocuments: vi.fn(),
    createGlobalStrategy: vi.fn(),
    updateGlobalStrategy: vi.fn(),
    linkStrategyToDocument: vi.fn(),
    linkStrategyToIdea: vi.fn(),
    unlinkStrategyFromDocument: vi.fn(),
    unlinkStrategyFromIdea: vi.fn(),
    toggleGlobalStrategy: vi.fn(),
    uploadKnowledgeDocument: vi.fn(),
    generateGlobalBrainObservations: vi.fn(),
  },
}));

const candidate = {
  id: 'idea-1',
  source: 'chat',
  content: 'Reuse better prompts',
  reasoning: 'Repeated user pattern',
  status: 'pending',
  created_at: '2026-04-26T10:00:00.000Z',
};

describe('KnowledgeBaseTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getKnowledgeCandidates).mockResolvedValue([candidate]);
    vi.mocked(Api.updateCandidateStatus).mockResolvedValue({ success: true });
  });

  it('accepts deep wrapped candidate payloads', async () => {
    vi.mocked(Api.getKnowledgeCandidates).mockResolvedValue({
      data: { data: { candidates: [candidate] } },
    });

    render(<KnowledgeBaseTab />);

    expect(await screen.findByText('Reuse better prompts')).toBeInTheDocument();
    expect(screen.queryByText('Knowledge base unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed candidate payloads as an empty healthy inbox', async () => {
    vi.mocked(Api.getKnowledgeCandidates).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<KnowledgeBaseTab />);

    await waitFor(() => {
      expect(screen.getByText('Knowledge base unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Knowledge candidates response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No pending ideas found.')).not.toBeInTheDocument();
  });

  it('does not claim approval success when read-back remains stale', async () => {
    render(<KnowledgeBaseTab />);

    await screen.findByText('Reuse better prompts');
    fireEvent.click(screen.getByTitle('Approve & Learn'));

    await waitFor(() => {
      expect(screen.getByText('Idea status update was not confirmed by the server')).toBeInTheDocument();
    });
    expect(toast.success).not.toHaveBeenCalledWith('Idea approved');
  });
});
