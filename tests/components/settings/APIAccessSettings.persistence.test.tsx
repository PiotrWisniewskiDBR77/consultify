import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APIAccessSettings } from '@/components/settings/APIAccessSettings';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

describe('APIAccessSettings persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    (Api.get as any).mockResolvedValue({
      data: {
        keys: [
          {
            id: 'key-1',
            name: 'Demo API key',
            keyPrefix: 'sk_demo_12',
            createdAt: '2026-04-25T08:00:00.000Z',
            permissions: ['read'],
          },
        ],
      },
    });
  });

  it('loads keys from /api/settings/api-keys and creates a persisted key through the API', async () => {
    (Api.post as any).mockResolvedValue({
      data: {
        key: {
          id: 'key-2',
          name: 'Production API',
          key: 'sk_live_created_once',
          keyPrefix: 'sk_live_cr',
          createdAt: '2026-04-25T09:00:00.000Z',
        },
      },
    });

    render(<APIAccessSettings />);

    expect(await screen.findByText('Demo API key')).toBeInTheDocument();
    expect(Api.get).toHaveBeenCalledWith('/api/settings/api-keys');

    await userEvent.click(screen.getByRole('button', { name: /create key/i }));
    await userEvent.type(screen.getByPlaceholderText(/production api/i), 'Production API');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/api/settings/api-keys', { name: 'Production API' });
    });
    expect(await screen.findByText('sk_live_created_once')).toBeInTheDocument();
  });

  it('deletes an existing key through /api/settings/api-keys/:id', async () => {
    (Api.delete as any).mockResolvedValue({ success: true });

    render(<APIAccessSettings />);

    expect(await screen.findByText('Demo API key')).toBeInTheDocument();
    await userEvent.click(screen.getByTitle('Delete'));

    await waitFor(() => {
      expect(Api.delete).toHaveBeenCalledWith('/api/settings/api-keys/key-1');
    });
    expect(screen.queryByText('Demo API key')).not.toBeInTheDocument();
  });
});
