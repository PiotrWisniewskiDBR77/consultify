import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminSecuritySettings } from '@/views/admin/AdminSecuritySettings';
import toast from 'react-hot-toast';

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
    expect(screen.getByRole('alert')).toHaveTextContent('Security settings unavailable');

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
    expect(screen.getByRole('alert')).toHaveTextContent('OAuth provider status unavailable');
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeEnabled();
  });

  it('does not claim success when saved security settings are not confirmed by read-back', async () => {
    const staleSettings = {
      mfaRequired: true,
      ssoEnabled: false,
      sessionTimeout: 60,
      ipWhitelist: '10.0.0.1',
      loginMaxAttempts: 3,
      lockoutDuration: 60,
    };
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === '/api/security/admin-settings' && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
        });
      }

      if (url === '/api/security/admin-settings') {
        return Promise.resolve({
          ok: true,
          json: async () => staleSettings,
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          google: { configured: false, loginUrl: '' },
          microsoft: { configured: false, loginUrl: '' },
          linkedin: { configured: false, loginUrl: '' },
        }),
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSecuritySettings />);

    await waitFor(() => {
      expect(screen.getByText('Require Two-Factor Authentication')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText(/192\.168\.1\.0\/24/i), {
      target: { value: '10.0.0.1\n172.16.0.1' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Security settings save was not confirmed by the server'
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('uses status role while loading', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, json: async () => ({}) } as any), 20)
          )
      )
    );

    render(<AdminSecuritySettings />);
    expect(screen.getByRole('status')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });

  it('does not leak raw backend error details on save failure', async () => {
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === '/api/security/admin-settings' && options?.method === 'PUT') {
        return Promise.resolve({
          ok: false,
          json: async () => ({
            error: 'postgres connection failed',
            code: 'INTERNAL_X',
          }),
        });
      }
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
        ok: true,
        json: async () => ({
          google: { configured: false, loginUrl: '' },
          microsoft: { configured: false, loginUrl: '' },
          linkedin: { configured: false, loginUrl: '' },
        }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<AdminSecuritySettings />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Save Changes/i })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save security settings');
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Code: INTERNAL_X');
    expect(screen.getByRole('alert').textContent || '').not.toContain('postgres');
    expect(toast.error).toHaveBeenCalledWith('Failed to save security settings. Please try again.');
  });
});
