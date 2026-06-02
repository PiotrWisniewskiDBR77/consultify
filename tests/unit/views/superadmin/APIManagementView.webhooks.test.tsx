import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APIManagementView } from '@/views/superadmin/APIManagementView';
import { Api } from '@/services/api';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getOrganizations: vi.fn().mockResolvedValue([{ id: 'org-1', name: 'Acme' }]),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('APIManagementView honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockResolvedValue({ keys: [] });
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Acme' }]);
  });

  it('keeps webhooks read-only until the superadmin webhook workflow is reconciled', async () => {
    render(<APIManagementView />);

    await waitFor(() => {
      expect(screen.getByText('API Management')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Webhooks/i }));

    expect(screen.getByText('Webhook management unavailable')).toBeInTheDocument();
    expect(screen.getByText(/routes are reconciled/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Webhook/i })).toBeDisabled();
    expect(screen.queryByText('Create Webhook')).not.toBeInTheDocument();
    expect(screen.queryByText('No webhooks configured')).not.toBeInTheDocument();
    expect(Api.post).not.toHaveBeenCalledWith(expect.stringContaining('/webhooks'), expect.anything());
    expect(Api.delete).not.toHaveBeenCalledWith(expect.stringContaining('/webhooks'));
  });

  it('does not render API key load failures as zero key metrics or empty list', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('API keys backend down'));

    render(<APIManagementView />);

    await waitFor(() => {
      expect(screen.getByText('API keys unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('API keys backend down')).toBeInTheDocument();
    expect(screen.queryByText('No API keys created yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Keys')).not.toBeInTheDocument();
  });

  it('blocks key creation when organizations cannot load', async () => {
    vi.mocked(Api.getOrganizations).mockRejectedValue(new Error('Organizations API down'));

    render(<APIManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Organizations unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Organizations API down')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create API Key/i })).toBeDisabled();
  });

  it('refetches API keys after create and revoke workflows', async () => {
    const firstKey = {
      id: 'key-1',
      organizationId: 'org-1',
      organizationName: 'Acme',
      name: 'Initial Key',
      keyPrefix: 'ck_init',
      keyType: 'service',
      scopes: ['read:users'],
      usageCount: 1,
      isActive: true,
      createdAt: '2026-04-26T10:00:00.000Z',
    };
    const createdKey = {
      ...firstKey,
      id: 'key-2',
      name: 'Created Key',
      keyPrefix: 'ck_created',
      lastUsedAt: 'not-a-date',
    };

    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/api/superadmin/api-keys') {
        const callCount = vi.mocked(Api.get).mock.calls.filter(([calledPath]) => calledPath === path)
          .length;
        return { keys: callCount <= 1 ? [firstKey] : [createdKey] };
      }
      return {};
    });
    vi.mocked(Api.post).mockResolvedValue({
      id: 'key-2',
      key: 'ck_created_plaintext',
      name: 'Created Key',
    });
    vi.mocked(Api.delete).mockResolvedValue({ success: true });

    render(<APIManagementView />);

    expect(await screen.findByText('Initial Key')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Create API Key/i }));
    fireEvent.change(screen.getByPlaceholderText('Production API Key'), {
      target: { value: 'Created Key' },
    });
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'org-1' },
    });
    fireEvent.click(screen.getByLabelText('read:users'));
    fireEvent.click(screen.getByRole('button', { name: /^Create Key$/i }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        '/api/superadmin/api-keys',
        expect.objectContaining({
          organizationId: 'org-1',
          name: 'Created Key',
          scopes: ['read:users'],
        })
      );
      expect(screen.getByText('Created Key')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Revoke Key'));
    fireEvent.click(screen.getByRole('button', { name: /^Revoke Key$/i }));

    await waitFor(() => {
      expect(Api.delete).toHaveBeenCalledWith('/api/superadmin/api-keys/key-2');
    });
    expect(
      vi.mocked(Api.get).mock.calls.filter(([path]) => path === '/api/superadmin/api-keys').length
    ).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });

  it('keeps create modal open when API key creation read-back is stale', async () => {
    vi.mocked(Api.get).mockResolvedValue({ keys: [] });
    vi.mocked(Api.post).mockResolvedValue({
      id: 'key-2',
      key: 'ck_created_plaintext',
      name: 'Created Key',
    });

    render(<APIManagementView />);

    await screen.findByText('No API keys created yet');
    fireEvent.click(screen.getByRole('button', { name: /Create API Key/i }));
    fireEvent.change(screen.getByPlaceholderText('Production API Key'), {
      target: { value: 'Created Key' },
    });
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'org-1' },
    });
    fireEvent.click(screen.getByLabelText('read:users'));
    fireEvent.click(screen.getByRole('button', { name: /^Create Key$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'API key creation was not confirmed by the server'
      );
    });
    expect(screen.getByPlaceholderText('Production API Key')).toBeInTheDocument();
    expect(screen.queryByText('API Key Created: Created Key')).not.toBeInTheDocument();
  });

  it('does not report revoke success when API key read-back remains active', async () => {
    const key = {
      id: 'key-1',
      organizationId: 'org-1',
      organizationName: 'Acme',
      name: 'Active Key',
      keyPrefix: 'ck_active',
      keyType: 'service',
      scopes: ['read:users'],
      usageCount: 1,
      isActive: true,
      createdAt: '2026-04-26T10:00:00.000Z',
    };

    vi.mocked(Api.get).mockResolvedValue({ keys: [key] });
    vi.mocked(Api.delete).mockResolvedValue({ success: true });

    render(<APIManagementView />);

    await screen.findByText('Active Key');
    fireEvent.click(screen.getByTitle('Revoke Key'));
    fireEvent.click(screen.getByRole('button', { name: /^Revoke Key$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'API key revoke was not confirmed by the server'
      );
    });
    expect(screen.getByText('Active Key')).toBeInTheDocument();
  });

  it('does not report revoke success when API key read-back is unavailable', async () => {
    const key = {
      id: 'key-1',
      organizationId: 'org-1',
      organizationName: 'Acme',
      name: 'Active Key',
      keyPrefix: 'ck_active',
      keyType: 'service',
      scopes: ['read:users'],
      usageCount: 1,
      isActive: true,
      createdAt: '2026-04-26T10:00:00.000Z',
    };

    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/api/superadmin/api-keys') {
        const callCount = vi.mocked(Api.get).mock.calls.filter(([calledPath]) => calledPath === path)
          .length;
        if (callCount > 1) {
          throw new Error('Read-back down');
        }
        return { keys: [key] };
      }
      return {};
    });
    vi.mocked(Api.delete).mockResolvedValue({ success: true });

    render(<APIManagementView />);

    await screen.findByText('Active Key');
    fireEvent.click(screen.getByTitle('Revoke Key'));
    fireEvent.click(screen.getByRole('button', { name: /^Revoke Key$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'API key revoke was not confirmed by the server'
      );
    });
  });

  it('does not render invalid API usage metrics as NaN or Infinity', async () => {
    const key = {
      id: 'key-1',
      organizationId: 'org-1',
      organizationName: 'Acme',
      name: 'Usage Key',
      keyPrefix: 'ck_usage',
      keyType: 'service',
      scopes: ['read:users'],
      usageCount: 1,
      isActive: true,
      createdAt: '2026-04-26T10:00:00.000Z',
    };

    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/api/superadmin/api-keys') {
        return { keys: [key] };
      }
      if (path === '/api/superadmin/api-keys/key-1/usage') {
        return {
          totals: {
            total_requests: 'bad-total',
            avg_response_time: 'bad-latency',
            total_errors: 'bad-errors',
          },
          endpoints: [{ method: 'GET', endpoint: '/v1/chat', count: 'bad-count' }],
        };
      }
      return {};
    });

    render(<APIManagementView />);

    await screen.findByText('Usage Key');
    fireEvent.click(screen.getByTitle('View Usage'));
    fireEvent.click(screen.getByRole('button', { name: /Usage Analytics/i }));

    await waitFor(() => {
      expect(screen.getByText('/v1/chat')).toBeInTheDocument();
    });

    expect(screen.queryByText(/NaN|Infinity|bad-/i)).not.toBeInTheDocument();
    expect(screen.getByText('0ms')).toBeInTheDocument();
  });

  it('accepts wrapped API key and organization payloads', async () => {
    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/api/superadmin/api-keys') {
        return {
          data: {
            data: {
              keys: [
                {
                  id: 'key-1',
                  organizationId: 'org-1',
                  name: 'Wrapped Key',
                  key_prefix: 'ck_wrapped',
                  key_type: 'service',
                  scopes: 'not-json',
                  usage_count: 'bad-usage',
                  isActive: '1',
                  created_at: 'not-a-date',
                },
              ],
            },
          },
        };
      }
      return {};
    });
    vi.mocked(Api.getOrganizations).mockResolvedValue({
      data: { data: { organizations: [{ id: 'org-1', name: 'Wrapped Org' }] } },
    });

    render(<APIManagementView />);

    expect(await screen.findByText('Wrapped Key')).toBeInTheDocument();
    expect(screen.getByText('Wrapped Org')).toBeInTheDocument();
    expect(screen.getByText('ck_wrapped...')).toBeInTheDocument();
    expect(screen.queryByText(/NaN|not-json|bad-usage/i)).not.toBeInTheDocument();
  });

  it('accepts a wrapped create response but still requires read-back confirmation', async () => {
    vi.mocked(Api.get).mockResolvedValue({ keys: [] });
    vi.mocked(Api.post).mockResolvedValue({
      data: {
        data: {
          id: 'key-2',
          key: 'ck_created_plaintext',
          name: 'Created Key',
        },
      },
    });

    render(<APIManagementView />);

    await screen.findByText('No API keys created yet');
    fireEvent.click(screen.getByRole('button', { name: /Create API Key/i }));
    fireEvent.change(screen.getByPlaceholderText('Production API Key'), {
      target: { value: 'Created Key' },
    });
    fireEvent.change(screen.getAllByRole('combobox')[0], {
      target: { value: 'org-1' },
    });
    fireEvent.click(screen.getByLabelText('read:users'));
    fireEvent.click(screen.getByRole('button', { name: /^Create Key$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'API key creation was not confirmed by the server'
      );
    });
    expect(screen.getByPlaceholderText('Production API Key')).toBeInTheDocument();
    expect(screen.queryByText('API Key Created: Created Key')).not.toBeInTheDocument();
  });

  it('does not render malformed API key payloads as an empty key list', async () => {
    vi.mocked(Api.get).mockResolvedValue({ data: { data: { unexpected: true } } });

    render(<APIManagementView />);

    await waitFor(() => {
      expect(screen.getByText('API keys unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('API keys response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No API keys created yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Keys')).not.toBeInTheDocument();
  });
});
