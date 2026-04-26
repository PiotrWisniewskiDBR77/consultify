import { render, screen, waitFor } from '@testing-library/react';
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
  });
});
