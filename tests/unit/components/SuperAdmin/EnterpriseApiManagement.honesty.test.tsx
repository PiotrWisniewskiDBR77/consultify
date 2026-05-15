import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseApiManagement } from '@/components/SuperAdmin/system/EnterpriseApiManagement';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    getOrganizations: vi.fn(),
  },
}));

describe('EnterpriseApiManagement honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/superadmin/api-keys') throw new Error('API keys backend down');
      return {};
    });
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Acme' }]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render API key load failures as an empty key list', async () => {
    render(<EnterpriseApiManagement />);

    await waitFor(() => {
      expect(screen.getByText('API keys unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('API keys backend down')).toBeInTheDocument();
    expect(screen.queryByText('No API keys found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create API Key/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('Search API keys...')).toBeDisabled();
  });

  it('does not invite usage inspection when API keys cannot load', async () => {
    render(<EnterpriseApiManagement />);

    fireEvent.click(screen.getByRole('button', { name: /Usage Analytics/i }));

    await waitFor(() => {
      expect(screen.getByText('API key usage unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Select an API key to view usage analytics')).not.toBeInTheDocument();
  });

  it('creates, revokes, and loads usage through superadmin API contracts with refetch', async () => {
    const activeKey = {
      id: 'key-1',
      organizationId: 'org-1',
      organizationName: 'Acme',
      name: 'Prod Integration',
      keyPrefix: 'ck_live_123...',
      keyType: 'service',
      scopes: ['read:users'],
      rateLimitPerMinute: 60,
      rateLimitPerDay: 10000,
      allowedIps: [],
      usageCount: 0,
      isActive: true,
      createdAt: '2026-04-26T10:00:00.000Z',
    };
    const createdKey = {
      ...activeKey,
      id: 'key-2',
      name: 'Created Key',
      keyPrefix: 'ck_created...',
      createdAt: 'not-a-date',
    };

    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/superadmin/api-keys') {
        const callCount = vi.mocked(Api.get).mock.calls.filter(([calledPath]) => calledPath === path)
          .length;
        return callCount <= 1 ? [activeKey] : [createdKey];
      }
      if (path === '/superadmin/api-keys/key-2/usage') {
        return {
          totals: { total_requests: 10, total_errors: 0, avg_response_time: 12 },
          daily: [{ date: 'not-a-date', requests: 0, errors: 0, avg_response_time: 0 }],
          endpoints: [{ endpoint: '/v1/users', method: 'GET', requests: 10 }],
        };
      }
      return {};
    });
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Acme' }]);
    vi.mocked(Api.post).mockResolvedValue({
      id: 'key-2',
      key: 'ck_created_plaintext',
    });
    vi.mocked(Api.delete).mockResolvedValue({ success: true });

    render(<EnterpriseApiManagement />);

    await waitFor(() => {
      expect(screen.getByText('Prod Integration')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Create API Key/i }));
    fireEvent.change(screen.getByPlaceholderText('My API Key'), {
      target: { value: 'Created Key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Read Users/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        '/superadmin/api-keys',
        expect.objectContaining({
          organizationId: 'org-1',
          name: 'Created Key',
          scopes: ['read:users'],
        })
      );
      expect(screen.getByText('Created Key')).toBeInTheDocument();
      expect(screen.getByText('ck_created_plaintext')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('View Usage'));
    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/superadmin/api-keys/key-2/usage');
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();

    vi.stubGlobal('confirm', vi.fn(() => true));
    fireEvent.click(screen.getByRole('button', { name: /API Keys/i }));
    fireEvent.click(screen.getByTitle('Revoke'));

    await waitFor(() => {
      expect(Api.delete).toHaveBeenCalledWith('/superadmin/api-keys/key-2');
    });
    expect(
      vi.mocked(Api.get).mock.calls.filter(([path]) => path === '/superadmin/api-keys').length
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps create modal open when API key creation response is incomplete', async () => {
    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/superadmin/api-keys') return [];
      return {};
    });
    vi.mocked(Api.post).mockResolvedValue({ key: 'ck_created_plaintext' });

    render(<EnterpriseApiManagement />);

    await screen.findByText('No API keys found');
    fireEvent.click(screen.getByRole('button', { name: /Create API Key/i }));
    fireEvent.change(screen.getByPlaceholderText('My API Key'), {
      target: { value: 'Created Key' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Read Users/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'API key creation response was incomplete'
      );
    });
    expect(screen.getByRole('heading', { name: 'Create API Key' })).toBeInTheDocument();
  });

  it('does not claim revoke success when read-back remains active', async () => {
    const activeKey = {
      id: 'key-1',
      organizationId: 'org-1',
      organizationName: 'Acme',
      name: 'Prod Integration',
      keyPrefix: 'ck_live_123...',
      keyType: 'service',
      scopes: ['read:users'],
      rateLimitPerMinute: 60,
      rateLimitPerDay: 10000,
      allowedIps: [],
      usageCount: 0,
      isActive: true,
      createdAt: '2026-04-26T10:00:00.000Z',
    };
    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/superadmin/api-keys') return { keys: [activeKey] };
      return {};
    });
    vi.mocked(Api.delete).mockResolvedValue({ success: true });
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<EnterpriseApiManagement />);

    await screen.findByText('Prod Integration');
    fireEvent.click(screen.getByTitle('Revoke'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'API key revoke was not confirmed by the server'
      );
    });
    expect(screen.getByText('Prod Integration')).toBeInTheDocument();
  });
});
