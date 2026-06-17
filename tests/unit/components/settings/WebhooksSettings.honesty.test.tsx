import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { WebhooksSettings } from '@/components/settings/WebhooksSettings';

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

describe('WebhooksSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed webhook loads as an empty editable list', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Webhook API down'));

    render(<WebhooksSettings />);

    await waitFor(() => {
      expect(screen.getByText('Webhooks unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Webhook API down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Webhook/i })).toBeDisabled();
  });

  it('does not claim webhook creation success when read-back is stale', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ data: { webhooks: [] } })
      .mockResolvedValueOnce({ data: { webhooks: [] } });
    vi.mocked(Api.post).mockResolvedValue({ data: { success: true } });

    render(<WebhooksSettings />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add Webhook/i })).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add Webhook/i }));
    fireEvent.change(screen.getByPlaceholderText('https://api.example.com/webhook'), {
      target: { value: 'https://example.com/webhook' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'task.created' }));
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(screen.getByText('Webhook creation was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Create New Webhook')).toBeInTheDocument();
  });

  it('does not claim webhook settings success when read-back returns old settings', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({
        data: {
          webhooks: [
            {
              id: 'webhook-1',
              name: 'CRM Webhook',
              url: 'https://example.com/webhook',
              events: ['task.created'],
              isActive: true,
              secret: 'old-secret',
              retryConfig: {
                maxRetries: 3,
                backoffStrategy: 'exponential',
                retryDelays: [1000, 2000, 5000],
              },
              filterRules: {},
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        data: {
          webhooks: [
            {
              id: 'webhook-1',
              name: 'CRM Webhook',
              url: 'https://example.com/webhook',
              events: ['task.created'],
              isActive: true,
              secret: 'old-secret',
              retryConfig: {
                maxRetries: 3,
                backoffStrategy: 'exponential',
                retryDelays: [1000, 2000, 5000],
              },
              filterRules: {},
            },
          ],
        },
      });
    vi.mocked(Api.put).mockResolvedValue({ data: { success: true } });

    render(<WebhooksSettings />);

    await screen.findByText('CRM Webhook');

    fireEvent.click(screen.getByTitle('Settings'));
    fireEvent.change(screen.getByDisplayValue('old-secret'), {
      target: { value: 'new-secret' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Webhook settings save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Advanced Settings')).toBeInTheDocument();
  });
});
