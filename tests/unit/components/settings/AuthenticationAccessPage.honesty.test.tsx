import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AuthenticationAccessPage } from '@/components/settings/security/AuthenticationAccessPage';

vi.mock('@/components/Profile/MFASetup', () => ({
  MFASetup: () => <div>MFA setup</div>,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getActiveSessions: vi.fn(),
    getLoginHistory: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    changePassword: vi.fn(),
    revokeSession: vi.fn(),
    revokeAllSessions: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('AuthenticationAccessPage honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getActiveSessions).mockRejectedValue(new Error('Sessions down'));
    vi.mocked(Api.getLoginHistory).mockRejectedValue(new Error('History down'));
    vi.mocked(Api.get).mockRejectedValue(new Error('Recovery down'));
  });

  it('shows an honest MVP deferral instead of mounting the MFA setup flow', async () => {
    render(
      <AuthenticationAccessPage
        currentUser={{ id: 'user-1', email: 'user@example.com', mfaEnabled: false } as any}
      />
    );

    await waitFor(() =>
      expect(screen.getByTestId('mfa-mvp-disabled')).toHaveTextContent(
        'Not available in the MVP demo'
      )
    );
    expect(screen.queryByText('MFA setup')).not.toBeInTheDocument();
  });

  it('does not render failed auth data loads as empty sessions or login history', async () => {
    render(
      <AuthenticationAccessPage
        currentUser={{ id: 'user-1', email: 'user@example.com', mfaEnabled: false } as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Active sessions unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Login history unavailable')).toBeInTheDocument();
    expect(screen.getByText('Recovery options unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No active sessions found')).not.toBeInTheDocument();
    expect(screen.queryByText('No login history available')).not.toBeInTheDocument();
    expect(screen.queryByText('Recovery Email')).not.toBeInTheDocument();
    expect(screen.queryByText('Backup Codes')).not.toBeInTheDocument();
  });

  it('refetches active sessions after terminating a session', async () => {
    vi.mocked(Api.getActiveSessions)
      .mockResolvedValueOnce({
        sessions: [
          { id: 'current', deviceInfo: 'Current Browser', current: true },
          { id: 'other', deviceInfo: 'Other Browser', current: false },
        ],
      })
      .mockResolvedValueOnce({
        sessions: [{ id: 'current', deviceInfo: 'Current Browser', current: true }],
      });
    vi.mocked(Api.getLoginHistory).mockResolvedValue([]);
    vi.mocked(Api.get).mockResolvedValue({
      recoveryEmail: '',
      recoveryPhone: '',
      backupCodesCount: 0,
    });
    vi.mocked(Api.revokeSession).mockResolvedValue({ success: true });

    render(
      <AuthenticationAccessPage
        currentUser={{ id: 'user-1', email: 'user@example.com', mfaEnabled: false } as any}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Other Browser')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Terminate'));

    await waitFor(() => {
      expect(Api.revokeSession).toHaveBeenCalledWith('other');
      expect(Api.getActiveSessions).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('Other Browser')).not.toBeInTheDocument();
    });
  });
});
