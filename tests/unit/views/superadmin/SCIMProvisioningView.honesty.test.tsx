import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/services/api';
import SCIMProvisioningView from '@/views/superadmin/SCIMProvisioningView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

const serviceProvider = {
  id: 'sp-1',
  organizationId: 'org-1',
  baseUrl: 'https://example.com/api/scim/v2',
  patchSupported: true,
  filterSupported: true,
  isActive: true,
  lastSyncAt: null,
  syncStatus: 'healthy',
};

const mapping = {
  id: 'map-1',
  externalGroupId: 'group-1',
  externalGroupName: 'Consultify Admins',
  internalRole: 'admin',
  customRoleId: null,
  isActive: true,
};

const token = {
  id: 'token-1',
  name: 'Azure AD SCIM',
  description: null,
  tokenPrefix: 'scim_1234',
  scopes: ['users:read'],
  lastUsedAt: null,
  usageCount: 0,
  expiresAt: null,
  isActive: true,
  createdAt: '2026-04-26T00:00:00.000Z',
};

const mockScimLoad = (mappings = [], tokens = []) => {
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === '/scim/admin/service-provider') {
      return Promise.resolve({ data: { data: serviceProvider } });
    }
    if (path === '/scim/admin/tokens') {
      return Promise.resolve({ data: { data: tokens } });
    }
    if (path === '/scim/admin/group-mappings') {
      return Promise.resolve({ data: { data: mappings } });
    }
    if (path === '/scim/admin/sync-logs?limit=50') {
      return Promise.resolve({ data: { data: [] } });
    }
    if (path === '/scim/admin/conflicts') {
      return Promise.resolve({ data: { data: [] } });
    }
    return Promise.reject(new Error(`Unexpected path: ${path}`));
  });
};

describe('SCIMProvisioningView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockRejectedValue(new Error('SCIM admin backend down'));
    vi.mocked(api.post).mockResolvedValue({ data: { data: mapping } });
    vi.mocked(api.delete).mockResolvedValue({ data: { data: { success: true } } });
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a degraded load error instead of empty SCIM setup states when admin data fails', async () => {
    render(<SCIMProvisioningView />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load SCIM data')).toBeInTheDocument();
    });

    expect(screen.getByText('SCIM admin backend down')).toBeInTheDocument();
    expect(screen.queryByText('Enable SCIM')).not.toBeInTheDocument();
    expect(screen.queryByText('No tokens generated yet')).not.toBeInTheDocument();
    expect(screen.queryByText('No group mappings configured')).not.toBeInTheDocument();
    expect(screen.queryByText('No sync activity yet')).not.toBeInTheDocument();
    expect(screen.queryByText('No conflicts detected')).not.toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('does not close group mapping modal when create read-back is stale', async () => {
    mockScimLoad([]);

    render(<SCIMProvisioningView />);

    fireEvent.click(await screen.findByRole('button', { name: /Group Mappings/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Add Mapping$/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., 00000000-0000-0000-0000-000000000000'), {
      target: { value: 'group-1' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g., Consultify Admins'), {
      target: { value: 'Consultify Admins' },
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'admin' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^Add Mapping$/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'SCIM group mapping was not confirmed by the server'
      );
    });
    expect(screen.getByText('Add Group Mapping')).toBeInTheDocument();
  });

  it('does not show generated token when token list read-back is stale', async () => {
    mockScimLoad([]);
    vi.mocked(api.post).mockResolvedValue({ data: { data: { ...token, token: 'secret-token' } } });

    render(<SCIMProvisioningView />);

    fireEvent.click(await screen.findByRole('button', { name: /API Tokens/i }));
    await screen.findByText('No tokens generated yet');
    fireEvent.click(screen.getByRole('button', { name: /Generate Token/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Azure AD SCIM'), {
      target: { value: 'Azure AD SCIM' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'SCIM token generation was not confirmed by the server'
      );
    });
    expect(screen.queryByText('Token Generated')).not.toBeInTheDocument();
  });

  it('shows generated token only after token list read-back confirms it', async () => {
    mockScimLoad([]);
    vi.mocked(api.post).mockResolvedValue({ data: { data: { ...token, token: 'secret-token' } } });

    render(<SCIMProvisioningView />);

    fireEvent.click(await screen.findByRole('button', { name: /API Tokens/i }));
    await screen.findByText('No tokens generated yet');
    fireEvent.click(screen.getByRole('button', { name: /Generate Token/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Azure AD SCIM'), {
      target: { value: 'Azure AD SCIM' },
    });
    mockScimLoad([], [token]);
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/i }));

    await waitFor(() => {
      expect(screen.getByText('Token Generated')).toBeInTheDocument();
    });
    expect(screen.getByText('secret-token')).toBeInTheDocument();
  });

  it('does not remove token when revoke read-back keeps the token', async () => {
    mockScimLoad([], [token]);

    render(<SCIMProvisioningView />);

    fireEvent.click(await screen.findByRole('button', { name: /API Tokens/i }));
    expect(await screen.findByText('Azure AD SCIM')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Revoke token Azure AD SCIM'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'SCIM token revocation was not confirmed by the server'
      );
    });
    expect(screen.getByText('Azure AD SCIM')).toBeInTheDocument();
  });

  it('closes group mapping modal only after create is confirmed by read-back', async () => {
    mockScimLoad([]);

    render(<SCIMProvisioningView />);

    fireEvent.click(await screen.findByRole('button', { name: /Group Mappings/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Add Mapping$/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., 00000000-0000-0000-0000-000000000000'), {
      target: { value: 'group-1' },
    });
    fireEvent.change(screen.getByPlaceholderText('e.g., Consultify Admins'), {
      target: { value: 'Consultify Admins' },
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'admin' } });
    mockScimLoad([mapping]);
    fireEvent.click(screen.getAllByRole('button', { name: /^Add Mapping$/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByText('Add Group Mapping')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Consultify Admins')).toBeInTheDocument();
  });

  it('does not remove group mapping when delete read-back keeps the mapping', async () => {
    mockScimLoad([mapping]);

    render(<SCIMProvisioningView />);

    fireEvent.click(await screen.findByRole('button', { name: /Group Mappings/i }));
    expect(await screen.findByText('Consultify Admins')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(await screen.findByText('Delete mapping'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'SCIM group mapping deletion was not confirmed by the server'
      );
    });
    expect(screen.getByText('Consultify Admins')).toBeInTheDocument();
  });

  it('accepts wrapped SCIM payloads and nested token create responses', async () => {
    let tokenLoads = 0;
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/scim/admin/service-provider') {
        return Promise.resolve({ data: { serviceProvider } });
      }
      if (path === '/scim/admin/tokens') {
        tokenLoads += 1;
        return Promise.resolve({
          data: {
            tokens: tokenLoads > 1 ? [token] : [],
          },
        });
      }
      if (path === '/scim/admin/group-mappings') {
        return Promise.resolve({ data: { groupMappings: [mapping] } });
      }
      if (path === '/scim/admin/sync-logs?limit=50') {
        return Promise.resolve({ data: { logs: [] } });
      }
      if (path === '/scim/admin/conflicts') {
        return Promise.resolve({ data: { conflicts: [] } });
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });
    vi.mocked(api.post).mockResolvedValue({ data: { token: { ...token, token: 'secret-token' } } });

    render(<SCIMProvisioningView />);

    fireEvent.click(await screen.findByRole('button', { name: /Group Mappings/i }));
    expect(await screen.findByText('Consultify Admins')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /API Tokens/i }));
    await screen.findByText('No tokens generated yet');
    fireEvent.click(screen.getByRole('button', { name: /Generate Token/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Azure AD SCIM'), {
      target: { value: 'Azure AD SCIM' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/i }));

    await waitFor(() => {
      expect(screen.getByText('Token Generated')).toBeInTheDocument();
    });
    expect(screen.getByText('secret-token')).toBeInTheDocument();
  });

  it('does not claim token revoke success when read-back is unavailable', async () => {
    let tokenLoads = 0;
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/scim/admin/service-provider') {
        return Promise.resolve({ data: { data: serviceProvider } });
      }
      if (path === '/scim/admin/tokens') {
        tokenLoads += 1;
        if (tokenLoads > 1) return Promise.reject(new Error('Read-back down'));
        return Promise.resolve({ data: { data: [token] } });
      }
      if (path === '/scim/admin/group-mappings') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (path === '/scim/admin/sync-logs?limit=50') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (path === '/scim/admin/conflicts') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    render(<SCIMProvisioningView />);

    fireEvent.click(await screen.findByRole('button', { name: /API Tokens/i }));
    expect(await screen.findByText('Azure AD SCIM')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Revoke token Azure AD SCIM'));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'SCIM token revocation was not confirmed by the server'
      );
    });
  });

  it('does not render malformed SCIM list payloads as empty setup states', async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/scim/admin/service-provider') {
        return Promise.resolve({ data: { data: serviceProvider } });
      }
      if (path === '/scim/admin/tokens') {
        return Promise.resolve({ data: { data: { unexpected: true } } });
      }
      if (path === '/scim/admin/group-mappings') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (path === '/scim/admin/sync-logs?limit=50') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (path === '/scim/admin/conflicts') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    render(<SCIMProvisioningView />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load SCIM data')).toBeInTheDocument();
    });
    expect(screen.getByText('SCIM tokens response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No tokens generated yet')).not.toBeInTheDocument();
  });

  it('does not claim SCIM enablement when read-back remains inactive', async () => {
    const inactiveProvider = { ...serviceProvider, isActive: false };
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === '/scim/admin/service-provider') {
        return Promise.resolve({ data: { data: inactiveProvider } });
      }
      if (path === '/scim/admin/tokens') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (path === '/scim/admin/group-mappings') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (path === '/scim/admin/sync-logs?limit=50') {
        return Promise.resolve({ data: { data: [] } });
      }
      if (path === '/scim/admin/conflicts') {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.reject(new Error(`Unexpected path: ${path}`));
    });

    render(<SCIMProvisioningView />);

    fireEvent.click(await screen.findByRole('button', { name: /Enable SCIM/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'SCIM enablement was not confirmed by the server'
      );
    });
  });
});
