import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SecurityPoliciesView } from '@/views/superadmin/SecurityPoliciesView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    getOrganizations: vi.fn(),
    getOrgPolicies: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    putOrgPolicy: vi.fn(),
  },
}));

const globalPolicy = {
  id: '__global__',
  organizationId: null,
  passwordMinLength: 8,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSpecial: false,
  passwordExpiryDays: 0,
  passwordHistoryCount: 0,
  maxLoginAttempts: 5,
  lockoutDurationMinutes: 15,
  sessionTimeoutMinutes: 480,
  concurrentSessionsLimit: 5,
  requireSessionBinding: false,
  ipAllowlist: [],
  ipBlocklist: [],
  geoRestrictions: [],
  mfaRequired: false,
  mfaMethods: ['totp'],
  mfaRememberDeviceDays: 30,
  compliancePreset: 'none',
};

describe('SecurityPoliciesView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.get).mockImplementation(async (path: string) => {
      if (path === '/security-policies/defaults') return { policy: globalPolicy };
      if (path === '/security-policies/all') return { policies: [] };
      return {};
    });
    vi.mocked(Api.getOrganizations).mockResolvedValue([]);
    vi.mocked(Api.getOrgPolicies).mockResolvedValue({ policies: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render security policy load failures as empty configuration', async () => {
    vi.mocked(Api.get).mockRejectedValueOnce(new Error('Security policies backend down'));

    render(<SecurityPoliciesView />);

    await waitFor(() => {
      expect(screen.getByText('Security policies unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Security policies backend down')).toBeInTheDocument();
    expect(screen.queryByText('Global Default Policy')).not.toBeInTheDocument();
    expect(screen.queryByText('Password Policy')).not.toBeInTheDocument();
  });

  it('does not claim account lockouts are empty when no lockout list is loaded', async () => {
    render(<SecurityPoliciesView />);

    await waitFor(() => {
      expect(screen.getByText('Global Default Policy')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Account Lockouts/i }));

    expect(screen.getByText('Account lockout list unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No locked accounts')).not.toBeInTheDocument();
    expect(screen.queryByText('All accounts are accessible')).not.toBeInTheDocument();
  });
});
