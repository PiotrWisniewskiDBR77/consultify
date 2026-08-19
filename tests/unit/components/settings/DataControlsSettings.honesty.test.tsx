import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DataControlsSettings } from '@/components/settings/DataControlsSettings';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    getGdprConsents: vi.fn(),
    getGdprRetention: vi.fn(),
    getGdprExportStatus: vi.fn(),
    getGdprDeletionStatus: vi.fn(),
    cancelGdprDeletion: vi.fn(),
    requestGdprDeletion: vi.fn(),
    requestGdprExport: vi.fn(),
    saveGdprConsents: vi.fn(),
    saveGdprRetention: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const consents = {
  analytics: true,
  personalization: true,
  marketing: false,
  thirdPartySharing: false,
  aiTraining: true,
};

const retention = {
  period: '365',
  autoDelete: false,
};

const renderSettings = () =>
  render(
    <MemoryRouter>
      <DataControlsSettings currentUser={{ id: 'user-1', email: 'user@example.com' } as any} />
    </MemoryRouter>
  );

describe('DataControlsSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:export'),
      revokeObjectURL: vi.fn(),
    });
    vi.mocked(Api.getGdprConsents).mockResolvedValue({ consents });
    vi.mocked(Api.getGdprRetention).mockResolvedValue({ retention });
    vi.mocked(Api.getGdprDeletionStatus).mockResolvedValue({ request: null });
  });

  it('does not render failed data-control loads as editable defaults', async () => {
    vi.mocked(Api.getGdprConsents).mockRejectedValue(new Error('GDPR API down'));
    vi.mocked(Api.getGdprRetention).mockResolvedValue({ retention });

    renderSettings();

    await waitFor(() => {
      expect(screen.getByText('Data controls unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('GDPR API down')).toBeInTheDocument();
    expect(screen.queryByText('Consent Management')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale consents', async () => {
    vi.mocked(Api.getGdprConsents)
      .mockResolvedValueOnce({ consents })
      .mockResolvedValueOnce({ consents });
    vi.mocked(Api.getGdprRetention).mockResolvedValue({ retention });
    vi.mocked(Api.saveGdprConsents).mockResolvedValue({ success: true });
    vi.mocked(Api.saveGdprRetention).mockResolvedValue({ success: true });

    renderSettings();

    await screen.findByText('Consent Management');
    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Data controls save was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('restores a pending deletion request after a cold mount and cancels by exact receipt id', async () => {
    vi.mocked(Api.getGdprDeletionStatus)
      .mockResolvedValueOnce({
        request: { id: 'delete-receipt-1', status: 'pending', requestedAt: '2026-08-19T10:00:00Z' },
      })
      .mockResolvedValueOnce({ request: null });
    vi.mocked(Api.cancelGdprDeletion).mockResolvedValue({
      success: true,
      request: { id: 'delete-receipt-1', status: 'cancelled' },
    });

    renderSettings();

    await screen.findByText('Deletion request pending');
    expect(screen.getByText(/delete-receipt-1/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete Account' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel deletion request' }));

    await waitFor(() => {
      expect(Api.cancelGdprDeletion).toHaveBeenCalledWith('delete-receipt-1');
      expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith('Deletion request cancelled');
  });

  it('submits a reauthenticated deletion request and claims success only after exact read-back', async () => {
    vi.mocked(Api.getGdprDeletionStatus)
      .mockResolvedValueOnce({ request: null })
      .mockResolvedValueOnce({ request: { id: 'delete-receipt-new', status: 'pending' } });
    vi.mocked(Api.requestGdprDeletion).mockResolvedValue({
      success: true,
      request: { id: 'delete-receipt-new', status: 'pending' },
    });

    renderSettings();
    await screen.findByRole('button', { name: 'Delete Account' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    fireEvent.change(screen.getByPlaceholderText('delete my data'), {
      target: { value: 'delete my data' },
    });
    fireEvent.change(screen.getByPlaceholderText('Your account password'), {
      target: { value: 'correct-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit deletion request' }));

    await waitFor(() => {
      expect(Api.requestGdprDeletion).toHaveBeenCalledWith('correct-password');
      expect(screen.getByText('Deletion request pending')).toBeInTheDocument();
    });
    expect(toast.success).toHaveBeenCalledWith(
      'Deletion request recorded. No data will be erased while policy approval is pending.'
    );
  });

  it('does not claim cancellation when cold read-back still returns an active request', async () => {
    const active = { request: { id: 'delete-receipt-2', status: 'pending' } };
    vi.mocked(Api.getGdprDeletionStatus).mockResolvedValue(active);
    vi.mocked(Api.cancelGdprDeletion).mockResolvedValue({
      success: true,
      request: { id: 'delete-receipt-2', status: 'cancelled' },
    });

    renderSettings();
    await screen.findByText('Deletion request pending');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel deletion request' }));

    await waitFor(() =>
      expect(screen.getByText('Account deletion cancellation was not confirmed by read-back')).toBeInTheDocument()
    );
    expect(toast.success).not.toHaveBeenCalledWith('Deletion request cancelled');
  });

  it('polls pending export to ready and downloads only through the canonical receipt route', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(Api.requestGdprExport).mockResolvedValue({
      success: true,
      request: { id: 'receipt-1', status: 'pending' },
    });
    vi.mocked(Api.getGdprExportStatus)
      .mockResolvedValueOnce({ request: { id: 'receipt-1', status: 'pending' } })
      .mockResolvedValueOnce({ request: { id: 'receipt-1', status: 'ready' } });
    vi.mocked(Api.get).mockResolvedValue({ profile: { id: 'user-1' } });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderSettings();
    await screen.findByText('Export Your Data');
    fireEvent.click(screen.getByRole('button', { name: /Request Export/i }));
    await vi.advanceTimersByTimeAsync(4_000);

    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/api/gdpr/download-export/receipt-1');
    });
    expect(Api.getGdprExportStatus).toHaveBeenCalledTimes(2);
    expect(click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:export');
    expect(toast.success).toHaveBeenCalledWith('Data exported successfully');
    expect(vi.mocked(Api.get).mock.calls.some(([path]) => path === '/api/user/data-export')).toBe(false);
    click.mockRestore();
    vi.useRealTimers();
  });

  it('deduplicates concurrent clicks into one export request', async () => {
    let resolveRequest!: (value: unknown) => void;
    vi.mocked(Api.requestGdprExport).mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      }) as never
    );

    renderSettings();
    await screen.findByText('Export Your Data');
    const button = screen.getByRole('button', { name: /Request Export/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(Api.requestGdprExport).toHaveBeenCalledTimes(1);
    resolveRequest({ success: false });
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it.each([
    ['request rejection', () => vi.mocked(Api.requestGdprExport).mockResolvedValue({ success: false })],
    [
      'status mismatch',
      () => {
        vi.mocked(Api.requestGdprExport).mockResolvedValue({
          request: { id: 'receipt-1', status: 'pending' },
        });
        vi.mocked(Api.getGdprExportStatus).mockResolvedValue({
          request: { id: 'different-receipt', status: 'ready' },
        });
      },
    ],
    [
      'status request failure',
      () => {
        vi.mocked(Api.requestGdprExport).mockResolvedValue({
          request: { id: 'receipt-1', status: 'pending' },
        });
        vi.mocked(Api.getGdprExportStatus).mockRejectedValue(new Error('status unavailable'));
      },
    ],
    [
      'failed processing status',
      () => {
        vi.mocked(Api.requestGdprExport).mockResolvedValue({
          request: { id: 'receipt-1', status: 'pending' },
        });
        vi.mocked(Api.getGdprExportStatus).mockResolvedValue({
          request: { id: 'receipt-1', status: 'failed' },
        });
      },
    ],
    [
      'download failure',
      () => {
        vi.mocked(Api.requestGdprExport).mockResolvedValue({
          request: { id: 'receipt-1', status: 'ready' },
        });
        vi.mocked(Api.get).mockRejectedValue(new Error('download denied'));
      },
    ],
  ])('fails closed on %s without claiming success or downloading', async (_label, arrange) => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    arrange();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderSettings();
    await screen.findByText('Export Your Data');
    fireEvent.click(screen.getByRole('button', { name: /Request Export/i }));
    await vi.advanceTimersByTimeAsync(2_000);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    expect(toast.success).not.toHaveBeenCalledWith('Data exported successfully');
    expect(click).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    click.mockRestore();
    vi.useRealTimers();
  });

  it('fails closed when processing never becomes ready', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.mocked(Api.requestGdprExport).mockResolvedValue({
      request: { id: 'receipt-1', status: 'pending' },
    });
    vi.mocked(Api.getGdprExportStatus).mockResolvedValue({
      request: { id: 'receipt-1', status: 'pending' },
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    renderSettings();
    await screen.findByText('Export Your Data');
    fireEvent.click(screen.getByRole('button', { name: /Request Export/i }));
    await vi.advanceTimersByTimeAsync(60_000);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());

    expect(Api.getGdprExportStatus).toHaveBeenCalledTimes(30);
    expect(Api.get).not.toHaveBeenCalled();
    expect(click).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalledWith('Data exported successfully');
    click.mockRestore();
    vi.useRealTimers();
  });
});
