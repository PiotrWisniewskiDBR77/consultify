import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { ExportDataSettings } from '@/components/settings/ExportDataSettings';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const toastMock = vi.fn();

vi.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

describe('ExportDataSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.get).mockRejectedValue(new Error('Export history down'));
    vi.mocked(Api.post).mockResolvedValue({
      requestId: 'export-1',
      status: 'pending',
      requestedAt: '2026-04-26T10:00:00Z',
    });
  });

  it('does not render failed export history loads as an empty export history', async () => {
    render(<ExportDataSettings currentUser={{ id: 'user-1', email: 'user@example.com' } as any} />);

    await waitFor(() => {
      expect(screen.getByText('Export history unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No export requests yet')).not.toBeInTheDocument();
  });

  it('does not claim export request success when history read-back does not contain the request', async () => {
    vi.mocked(Api.get).mockResolvedValue({ requests: [] });

    render(<ExportDataSettings currentUser={{ id: 'user-1', email: 'user@example.com' } as any} />);

    await waitFor(() => {
      expect(screen.getByText('No export requests yet')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Request Data Export/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Request Export$/i }));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('alert')
          .some((alert) =>
            alert.textContent?.includes('Data export request was not confirmed by the server')
          )
      ).toBe(true);
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        variant: 'destructive',
        description: 'Data export request was not confirmed by the server',
      })
    );
    expect(
      toastMock.mock.calls.some(([arg]) => arg?.title === 'Export Requested')
    ).toBeFalsy();
  });
});
