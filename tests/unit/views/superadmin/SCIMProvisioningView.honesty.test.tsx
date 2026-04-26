import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from '@/services/api';
import SCIMProvisioningView from '@/views/superadmin/SCIMProvisioningView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
  }),
}));

vi.mock('@/services/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('SCIMProvisioningView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockRejectedValue(new Error('SCIM admin backend down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
});
