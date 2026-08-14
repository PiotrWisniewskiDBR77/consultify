import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SuperAdminLegalView } from '@/views/superadmin/SuperAdminLegalView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getSuperAdminLegalDocs: vi.fn(),
    getSuperAdminLegalDocById: vi.fn(),
    publishSuperAdminLegalDoc: vi.fn(),
    toggleSuperAdminLegalDocActive: vi.fn(),
  },
}));

describe('SuperAdminLegalView honest workflows', () => {
  const openFirstRowActions = () => {
    fireEvent.click(screen.getAllByRole('button', { name: 'Row actions' })[0]);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValue([]);
    vi.mocked(Api.publishSuperAdminLegalDoc).mockResolvedValue({ id: 'doc-2' });
    vi.mocked(Api.toggleSuperAdminLegalDocActive).mockResolvedValue({ success: true });
  });

  it('does not allow publishing when legal documents failed to load', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs).mockRejectedValue(new Error('Legal backend down'));

    render(<SuperAdminLegalView />);

    await waitFor(() => {
      expect(screen.getByText('Legal documents unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Legal backend down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Publish New Version/i })).toBeDisabled();
    expect(screen.queryByText(/No legal documents found/i)).not.toBeInTheDocument();
  });

  it('does not close the publish form when read-back does not confirm the new legal document', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValue([]);

    render(<SuperAdminLegalView />);

    await screen.findByText(/No legal documents found/i);

    fireEvent.click(screen.getByRole('button', { name: /Publish New Version/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Terms of Service'), {
      target: { value: 'Terms of Service' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter document content in Markdown format...'), {
      target: { value: '# Terms' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Publish$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Legal document publish was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Publish New Document Version')).toBeInTheDocument();
  });

  it('keeps publish form open when publish response does not include an id', async () => {
    vi.mocked(Api.publishSuperAdminLegalDoc).mockResolvedValue({ success: true });

    render(<SuperAdminLegalView />);

    await screen.findByText(/No legal documents found/i);
    fireEvent.click(screen.getByRole('button', { name: /Publish New Version/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Terms of Service'), {
      target: { value: 'Terms of Service' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter document content in Markdown format...'), {
      target: { value: '# Terms' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Publish$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Legal document publish response was incomplete')
      ).toBeInTheDocument();
    });
    expect(screen.getByText('Publish New Document Version')).toBeInTheDocument();
  });

  it('renders camelCase legal document status honestly', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValue([
      {
        id: 'doc-1',
        docType: 'PRIVACY',
        title: 'Privacy Policy',
        version: '1.0',
        effective_from: '2026-04-26',
        isActive: true,
      },
    ]);

    render(<SuperAdminLegalView />);

    expect(await screen.findByText('PRIVACY')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    openFirstRowActions();
    expect(screen.getByRole('menuitem', { name: 'Deactivate' })).toBeInTheDocument();
  });

  it('does not treat string false active values as active documents', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValue([
      {
        id: 'doc-1',
        doc_type: 'TOS',
        title: 'Terms of Service',
        version: '1.0',
        effective_from: '2026-04-26',
        is_active: 'false',
      },
    ]);

    render(<SuperAdminLegalView />);

    expect(await screen.findByText('Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
    openFirstRowActions();
    expect(screen.getByRole('menuitem', { name: 'Activate' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  it('does not render malformed legal document payloads as an empty document list', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<SuperAdminLegalView />);

    await waitFor(() => {
      expect(screen.getByText('Legal documents unavailable')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Legal document list response was not returned by the server')
    ).toBeInTheDocument();
    expect(screen.queryByText(/No legal documents found/i)).not.toBeInTheDocument();
  });

  it('closes publish form only after legal document is confirmed by read-back', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValueOnce([]);

    render(<SuperAdminLegalView />);

    await screen.findByText(/No legal documents found/i);

    fireEvent.click(screen.getByRole('button', { name: /Publish New Version/i }));
    const generatedVersion = (screen.getByPlaceholderText('e.g. 2025-12-20.1') as HTMLInputElement)
      .value;
    fireEvent.change(screen.getByPlaceholderText('e.g. Terms of Service'), {
      target: { value: 'Terms of Service' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter document content in Markdown format...'), {
      target: { value: '# Terms' },
    });

    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValueOnce([
      {
        id: 'doc-2',
        doc_type: 'TOS',
        title: 'Terms of Service',
        version: generatedVersion,
        effective_from: '2026-04-26',
        is_active: true,
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: /^Publish$/i }));

    await waitFor(() => {
      expect(screen.queryByText('Publish New Document Version')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
  });

  it('shows an error when active state read-back remains stale after toggle', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs)
      .mockResolvedValueOnce([
        {
          id: 'doc-1',
          doc_type: 'TOS',
          title: 'Terms of Service',
          version: '1.0',
          effective_from: 'not-a-date',
          is_active: true,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'doc-1',
          doc_type: 'TOS',
          title: 'Terms of Service',
          version: '1.0',
          effective_from: 'not-a-date',
          is_active: true,
        },
      ]);

    render(<SuperAdminLegalView />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
    openFirstRowActions();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(
        screen.getByText('Legal document status was not confirmed by the server')
      ).toBeInTheDocument();
    });
  });

  it('accepts wrapped legal document payloads and wrapped publish responses', async () => {
    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValueOnce({
      data: {
        data: {
          documents: [
            {
              id: 'doc-1',
              doc_type: 'PRIVACY',
              title: 'Privacy Policy',
              version: '1.0',
              effective_from: 'not-a-date',
              is_active: true,
            },
          ],
        },
      },
    });
    vi.mocked(Api.publishSuperAdminLegalDoc).mockResolvedValue({
      data: { data: { document: { id: 'doc-2' } } },
    });

    render(<SuperAdminLegalView />);

    expect(await screen.findByText('Privacy Policy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Publish New Version/i }));
    const generatedVersion = (screen.getByPlaceholderText('e.g. 2025-12-20.1') as HTMLInputElement)
      .value;
    fireEvent.change(screen.getByPlaceholderText('e.g. Terms of Service'), {
      target: { value: 'Terms of Service' },
    });
    fireEvent.change(screen.getByPlaceholderText('Enter document content in Markdown format...'), {
      target: { value: '# Terms' },
    });
    vi.mocked(Api.getSuperAdminLegalDocs).mockResolvedValueOnce({
      data: {
        data: {
          documents: [
            {
              id: 'doc-2',
              doc_type: 'TOS',
              title: 'Terms of Service',
              version: generatedVersion,
              effective_from: '2026-04-26',
              is_active: true,
            },
          ],
        },
      },
    });

    fireEvent.click(screen.getByRole('button', { name: /^Publish$/i }));

    await waitFor(() => {
      expect(screen.queryByText('Publish New Document Version')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Terms of Service')).toBeInTheDocument();
    expect(
      screen.queryByText('Legal document publish was not confirmed by the server')
    ).not.toBeInTheDocument();
  });
});
