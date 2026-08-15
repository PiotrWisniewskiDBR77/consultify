import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

const t = (_key: string, fallback?: string | { defaultValue?: string }) => (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
import { SuperAdminStorageDetailModal } from '@/views/superadmin/SuperAdminStorageDetailModal';

vi.mock('@/services/api', () => ({
  Api: {
    adminDeleteFile: vi.fn(),
    adminGetOrgFiles: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title, description }: { title: string; description: string }) => (
    <div role="alert">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

describe('SuperAdminStorageDetailModal honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render file load failures as an empty organization storage', async () => {
    vi.mocked(Api.adminGetOrgFiles).mockRejectedValue(new Error('Storage API down'));

    render(
      <SuperAdminStorageDetailModal
        orgId="org-1"
        orgName="Acme"
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Organization files unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Storage API down')).toBeInTheDocument();
    expect(screen.queryByText('No files stored for this organization')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search files...')).toBeDisabled();
  });

  it('does not claim file deletion success when read-back is stale', async () => {
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    const onUpdate = vi.fn();
    vi.mocked(Api.adminGetOrgFiles).mockResolvedValue([
      {
        name: 'report.pdf',
        path: 'reports/report.pdf',
        size: 1024,
        created_at: '2026-01-01',
      },
    ]);
    vi.mocked(Api.adminDeleteFile).mockResolvedValue(undefined);

    render(
      <SuperAdminStorageDetailModal
        orgId="org-1"
        orgName="Acme"
        onClose={vi.fn()}
        onUpdate={onUpdate}
      />
    );

    await screen.findByText('report.pdf');
    fireEvent.click(screen.getByRole('button', { name: /Row actions/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Permanently Delete/i }));

    await waitFor(() => {
      expect(screen.getByText('File deletion was not confirmed by the server')).toBeInTheDocument();
    });

    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('renders invalid file dates as Unknown date', async () => {
    vi.mocked(Api.adminGetOrgFiles).mockResolvedValue([
      {
        name: 'broken.txt',
        path: 'broken.txt',
        size: 123,
        created_at: 'not-a-date',
      },
    ]);

    render(
      <SuperAdminStorageDetailModal
        orgId="org-1"
        orgName="Acme"
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
  });

  it('accepts wrapped file payloads and renders malformed file fields safely', async () => {
    vi.mocked(Api.adminGetOrgFiles).mockResolvedValue({
      data: {
        data: {
          files: [
            {
              name: { bad: true },
              path: 'reports/wrapped.pdf',
              size: 'bad-size',
              created_at: 'not-a-date',
            },
          ],
        },
      },
    });

    render(
      <SuperAdminStorageDetailModal
        orgId="org-1"
        orgName="Acme"
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    expect(await screen.findByText('File 1')).toBeInTheDocument();
    expect(screen.getByText('reports/wrapped.pdf')).toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
    expect(screen.getByText('0 B')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Row actions/i }));
    expect(screen.getByRole('menuitem', { name: /Permanently Delete/i })).toBeInTheDocument();
    expect(screen.queryByText('Organization files unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed file payloads as empty organization storage', async () => {
    vi.mocked(Api.adminGetOrgFiles).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(
      <SuperAdminStorageDetailModal
        orgId="org-1"
        orgName="Acme"
        onClose={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Organization files unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Files response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No files stored for this organization')).not.toBeInTheDocument();
  });
});
