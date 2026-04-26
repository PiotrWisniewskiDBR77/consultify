import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminSecuritySettings } from '@/views/admin/AdminSecuritySettings';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('AdminSecuritySettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not render failed security settings loads as editable default policies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    render(<AdminSecuritySettings />);

    await waitFor(() => {
      expect(screen.getByText('Security settings unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Require Two-Factor Authentication')).not.toBeInTheDocument();
    expect(screen.queryByText('Session Timeout')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
  });

  it('keeps security settings editable while marking OAuth status unavailable when only OAuth fails', async () => {
    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/security/admin-settings') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            mfaRequired: true,
            ssoEnabled: false,
            sessionTimeout: 60,
            ipWhitelist: '10.0.0.1',
            loginMaxAttempts: 3,
            lockoutDuration: 60,
          }),
        });
      }

      return Promise.resolve({
        ok: false,
        status: 503,
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSecuritySettings />);

    await waitFor(() => {
      expect(screen.getByText('Require Two-Factor Authentication')).toBeInTheDocument();
    });

    expect(screen.getByText('OAuth provider status unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeEnabled();
  });
});
