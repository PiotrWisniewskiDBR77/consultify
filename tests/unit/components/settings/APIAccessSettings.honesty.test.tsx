import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { APIAccessSettings } from '@/components/settings/APIAccessSettings';

vi.mock('@/services/api', () => ({
  Api: {
    delete: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
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
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

describe('APIAccessSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('does not render failed API key loads as an empty editable list', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('API keys down'));

    render(<APIAccessSettings />);

    await waitFor(() => {
      expect(screen.getByText('API keys unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('API keys down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Key/i })).toBeDisabled();
    expect(screen.queryByText('No API keys yet. Create one to get started.')).not.toBeInTheDocument();
  });

  it('does not claim API key creation success when read-back is stale', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ data: { keys: [] } })
      .mockResolvedValueOnce({ data: { keys: [] } });
    vi.mocked(Api.post).mockResolvedValue({
      data: {
        key: {
          id: 'key-1',
          name: 'Production API',
          key: 'sk_test_secret',
          keyPrefix: 'sk_test',
          createdAt: '2026-04-26T10:00:00.000Z',
        },
      },
    });

    render(<APIAccessSettings />);

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Create Key/i })[0]).not.toBeDisabled();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Create Key/i })[0]);
    fireEvent.change(screen.getByPlaceholderText('e.g., Production API'), {
      target: { value: 'Production API' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(screen.getByText('API key creation was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText("Save this key now. You won't be able to see it again.")).not.toBeInTheDocument();
  });

  it('does not claim API key settings success when read-back returns old values', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({
        data: {
          keys: [
            {
              id: 'key-1',
              name: 'Production API',
              keyPrefix: 'sk_old',
              createdAt: '2026-04-26T10:00:00.000Z',
              rateLimit: 100,
              permissions: ['read'],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          keys: [
            {
              id: 'key-1',
              name: 'Production API',
              keyPrefix: 'sk_old',
              createdAt: '2026-04-26T10:00:00.000Z',
              rateLimit: 100,
              permissions: ['read'],
            },
          ],
        },
      });
    vi.mocked(Api.put).mockResolvedValue({ data: { success: true } });

    render(<APIAccessSettings />);

    await screen.findByText('Production API');

    fireEvent.click(screen.getByTitle('Settings'));
    fireEvent.change(screen.getByPlaceholderText('1000'), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('API key settings save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
  });

  it('does not expose rotated API key secret when read-back keeps the old prefix', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({
        data: {
          keys: [
            {
              id: 'key-1',
              name: 'Production API',
              keyPrefix: 'sk_old',
              createdAt: '2026-04-26T10:00:00.000Z',
              permissions: ['read'],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          keys: [
            {
              id: 'key-1',
              name: 'Production API',
              keyPrefix: 'sk_old',
              createdAt: '2026-04-26T10:00:00.000Z',
              permissions: ['read'],
            },
          ],
        },
      });
    vi.mocked(Api.post).mockResolvedValue({
      data: { key: { key: 'sk_new_secret', keyPrefix: 'sk_new' } },
    });

    render(<APIAccessSettings />);

    await screen.findByText('Production API');

    fireEvent.click(screen.getByTitle('Rotate key'));

    await waitFor(() => {
      expect(screen.getByText('API key rotation was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.queryByText('sk_new_secret')).not.toBeInTheDocument();
  });
});
