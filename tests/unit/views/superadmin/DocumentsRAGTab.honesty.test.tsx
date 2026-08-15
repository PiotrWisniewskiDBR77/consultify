import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentsRAGTab } from '@/views/superadmin/AIPlatformModule/Knowledge/DocumentsRAGTab';
import { Api } from '@/services/api';

const t = (_key: string, fallback?: string | { defaultValue?: string }) => (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
import { toast } from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getMyProjectMemberships: vi.fn(),
    getKnowledgeDocuments: vi.fn(),
    uploadKnowledgeDocument: vi.fn(),
    updateKnowledgeDocument: vi.fn(),
    updateAIGovernanceDocumentVisibility: vi.fn(),
    updateAIGovernanceDocumentSensitivity: vi.fn(),
  },
}));

const documentRow = {
  id: 'doc-1',
  filename: 'strategy.pdf',
  category: 'Best Practices',
  tags: ['strategy'],
  ai_visibility: 'allowed',
  sensitivity: 'internal',
  status: 'indexed',
  created_at: '2026-04-26T10:00:00.000Z',
  chunk_count: 3,
};

describe('DocumentsRAGTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getMyProjectMemberships).mockResolvedValue([]);
    vi.mocked(Api.getKnowledgeDocuments).mockResolvedValue([documentRow]);
    vi.mocked(Api.uploadKnowledgeDocument).mockResolvedValue({
      data: { data: { document: { id: 'doc-2' }, chunkCount: 4 } },
    });
    vi.mocked(Api.updateKnowledgeDocument).mockResolvedValue({ success: true });
    vi.mocked(Api.updateAIGovernanceDocumentVisibility).mockResolvedValue({ success: true });
    vi.mocked(Api.updateAIGovernanceDocumentSensitivity).mockResolvedValue({ success: true });
  });

  it('accepts deep wrapped document payloads', async () => {
    vi.mocked(Api.getKnowledgeDocuments).mockResolvedValue({
      data: { data: { documents: [documentRow] } },
    });

    render(<DocumentsRAGTab />);

    expect(await screen.findByText('strategy.pdf')).toBeInTheDocument();
    expect(screen.queryByText('Knowledge documents unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed document payloads as an empty healthy list', async () => {
    vi.mocked(Api.getKnowledgeDocuments).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<DocumentsRAGTab />);

    await waitFor(() => {
      expect(screen.getByText('Knowledge documents unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Knowledge documents response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No documents indexed yet.')).not.toBeInTheDocument();
  });

  it('does not claim upload success when read-back is stale', async () => {
    vi.mocked(Api.getKnowledgeDocuments).mockResolvedValue([documentRow]);
    const { container } = render(<DocumentsRAGTab />);

    await screen.findByText('strategy.pdf');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hello'], 'new-strategy.pdf', { type: 'application/pdf' });
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: /Upload & Index/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Knowledge document upload was not confirmed by the server')
      ).toBeInTheDocument();
    });
    expect(toast.success).not.toHaveBeenCalledWith('Uploaded & Indexed! (4 chunks)');
  });
});
