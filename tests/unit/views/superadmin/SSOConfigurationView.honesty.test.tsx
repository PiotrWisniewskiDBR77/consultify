import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SSOConfigurationView } from '@/views/superadmin/SSOConfigurationView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    getOrganizations: vi.fn(),
    getSsoConfigs: vi.fn(),
    saveGoogleSsoConfig: vi.fn(),
    toggleSsoConfig: vi.fn(),
    deleteSsoConfig: vi.fn(),
  },
}));

describe('SSOConfigurationView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getOrganizations).mockResolvedValue([{ id: 'org-1', name: 'Acme' }]);
    vi.mocked((Api as any).getSsoConfigs).mockRejectedValue(new Error('SSO config backend down'));
    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/sso/domains') {
        throw new Error('SSO domain backend down');
      }
      return { data: {} };
    });
  });

  it('does not render SSO config or domain load failures as empty tables', async () => {
    render(<SSOConfigurationView />);

    await waitFor(() => {
      expect(screen.getByText('SSO configurations unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('SSO config backend down')).toBeInTheDocument();
    expect(screen.queryByText('No SSO configurations found')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Domain Mapping/i }));
    expect(screen.getByText('SSO domain mappings unavailable')).toBeInTheDocument();
    expect(screen.getByText('SSO domain backend down')).toBeInTheDocument();
    expect(screen.queryByText('No domain mappings configured yet')).not.toBeInTheDocument();
  });
});
