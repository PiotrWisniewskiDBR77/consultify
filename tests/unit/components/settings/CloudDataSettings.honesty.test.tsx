import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CloudDataSettings } from '@/components/settings/CloudDataSettings';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

describe('CloudDataSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('does not render failed cloud source loads as an empty editable list', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Cloud API down'));

    render(<CloudDataSettings />);

    await waitFor(() => {
      expect(screen.getByText('Cloud sources unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Cloud API down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add source/i })).toBeDisabled();
    expect(screen.queryByText('No cloud sources connected yet.')).not.toBeInTheDocument();
  });

  it('does not claim cloud source connection success when read-back is stale', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ sources: [] })
      .mockResolvedValueOnce({ sources: [] });
    vi.mocked(Api.post).mockResolvedValue({ source: { id: 'src-1' } });

    render(<CloudDataSettings />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add source/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add source/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Company Drive'), {
      target: { value: 'Company Drive' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Connect$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Cloud source connection was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('e.g. Company Drive')).toBeInTheDocument();
  });

  it('does not claim cloud source disconnection success when read-back still contains it', async () => {
    const source = {
      id: 'src-1',
      provider: 'google_drive',
      name: 'Company Drive',
      status: 'active',
      createdAt: '2026-04-26T10:00:00.000Z',
    };
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ sources: [source] })
      .mockResolvedValueOnce({ sources: [source] });
    vi.mocked(Api.delete).mockResolvedValue({ success: true });

    render(<CloudDataSettings />);

    await screen.findByText('Company Drive');

    fireEvent.click(screen.getByTitle('Disconnect'));

    await waitFor(() => {
      expect(
        screen.getByText('Cloud source disconnection was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Company Drive')).toBeInTheDocument();
  });
});
