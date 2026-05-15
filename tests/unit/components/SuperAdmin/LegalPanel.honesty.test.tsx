import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { LegalPanel } from '@/components/SuperAdmin/LegalPanel';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

const toast = vi.hoisted(() => ({
  error: vi.fn(),
  success: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getSuperAdminLegalDocs: vi.fn(),
    publishSuperAdminLegalDoc: vi.fn(),
    toggleSuperAdminLegalDocActive: vi.fn(),
  },
}));

const activeDoc = {
  id: 'doc-1',
  doc_type: 'TERMS_OF_SERVICE',
  title: 'Terms of Service',
  version: '1.0',
  effective_from: 'not-a-date',
  is_active: true,
};

describe('LegalPanel honest workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValue([]);
    vi.mocked(Api.publishSuperAdminLegalDoc).mockResolvedValue({ id: 'doc-2' });
    vi.mocked(Api.toggleSuperAdminLegalDocActive).mockResolvedValue({ success: true });
  });

  it('does not render failed legal document loads as an empty document list', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs).mockRejectedValue(new Error('Legal backend down'));

    render(<LegalPanel />);

    await waitFor(() => {
      expect(screen.getByText('Legal documents unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Legal backend down')).toBeInTheDocument();
    expect(screen.queryByText('No legal documents')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish Document/i })).toBeDisabled();
  });

  it('does not close publish modal or show success when read-back is stale', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValue([]);

    render(<LegalPanel />);

    await screen.findByText('No legal documents');
    fireEvent.click(screen.getByRole('button', { name: /Publish Document/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Terms of Service v2.0'), {
      target: { value: 'Terms of Service' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter document content in Markdown format...'), {
      target: { value: '# Terms' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Publish$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Legal document publish was not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalledWith('Document published');
    expect(screen.getByText('Publish Legal Document')).toBeInTheDocument();
  });

  it('shows publish success only after the new document is confirmed by read-back', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...activeDoc, id: 'doc-2' }]);

    render(<LegalPanel />);

    await screen.findByText('No legal documents');
    fireEvent.click(screen.getByRole('button', { name: /Publish Document/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Terms of Service v2.0'), {
      target: { value: 'Terms of Service' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter document content in Markdown format...'), {
      target: { value: '# Terms' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Publish$/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Document published');
    });
    expect(screen.queryByText('Publish Legal Document')).not.toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
  });

  it('shows an error when toggle read-back keeps the old active state', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs)
      .mockResolvedValueOnce([activeDoc])
      .mockResolvedValueOnce([activeDoc]);

    render(<LegalPanel />);

    await screen.findByText('Terms of Service');
    fireEvent.click(screen.getByRole('button', { name: /Active/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Legal document status was not confirmed by the server'
      );
    });
  });
});
