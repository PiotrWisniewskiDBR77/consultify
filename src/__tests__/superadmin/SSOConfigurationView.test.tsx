import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('../../services/api', () => {
  const getSsoConfigs = vi.fn().mockResolvedValue({
    configs: [
      {
        id: 'id-1',
        organizationId: 'org-1',
        organizationName: 'Org One',
        provider: 'google',
        status: 'active',
        domains: ['example.com'],
        createdAt: '2026-01-01',
      },
    ],
  });
  return {
    Api: {
      getSsoConfigs,
      saveGoogleSsoConfig: vi.fn().mockResolvedValue({ success: true }),
      toggleSsoConfig: vi.fn().mockResolvedValue({ success: true }),
      deleteSsoConfig: vi.fn().mockResolvedValue({ success: true }),
    },
  };
});

import { SSOConfigurationView } from '../../views/superadmin/SSOConfigurationView';

describe('SSOConfigurationView', () => {
  it('renders overview stats and loads configs', async () => {
    render(<SSOConfigurationView />);

    await waitFor(() => {
      expect(screen.getByText('Total SSO Configs')).toBeInTheDocument();
    });

    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Google/OIDC')).toBeInTheDocument();
    expect(screen.getByText('Configure SSO')).toBeInTheDocument();
  });
});
