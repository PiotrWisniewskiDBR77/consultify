import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionsActivitySettings } from '@/components/settings/SessionsActivitySettings';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('@/services/api', () => ({
  Api: {
    getActiveSessions: vi.fn(),
    getLoginHistory: vi.fn(),
    revokeAllSessions: vi.fn(),
    revokeSession: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

describe('SessionsActivitySettings honest UI', () => {
  const currentSession = {
    id: 'session-current',
    deviceInfo: 'Current Browser',
    current: true,
  };
  const otherSession = {
    id: 'session-other',
    deviceInfo: 'Other Browser',
    current: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getLoginHistory).mockResolvedValue([]);
  });

  it('does not render failed session loads as no active sessions', async () => {
    vi.mocked(Api.getActiveSessions).mockRejectedValue(new Error('Sessions API down'));

    render(<SessionsActivitySettings />);

    await waitFor(() => {
      expect(screen.getByText('Active sessions unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Sessions API down')).toBeInTheDocument();
    expect(screen.queryByText('No active sessions found')).not.toBeInTheDocument();
  });

  it('does not claim session termination success when read-back still contains it', async () => {
    vi.mocked(Api.getActiveSessions)
      .mockResolvedValueOnce({ sessions: [currentSession, otherSession] })
      .mockResolvedValueOnce({ sessions: [currentSession, otherSession] });
    vi.mocked(Api.revokeSession).mockResolvedValue({ success: true });

    render(<SessionsActivitySettings />);

    await screen.findByText('Other Browser');

    fireEvent.click(screen.getByTitle('Terminate session'));

    await waitFor(() => {
      expect(screen.getByText('Session termination was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Other Browser')).toBeInTheDocument();
  });

  it('does not claim revoke-all success when read-back still contains other sessions', async () => {
    vi.mocked(Api.getActiveSessions)
      .mockResolvedValueOnce({ sessions: [currentSession, otherSession] })
      .mockResolvedValueOnce({ sessions: [currentSession, otherSession] });
    vi.mocked(Api.revokeAllSessions).mockResolvedValue({ success: true });

    render(<SessionsActivitySettings />);

    await screen.findByText('Other Browser');

    fireEvent.click(screen.getByRole('button', { name: /Sign Out All Other Devices/i }));

    await waitFor(() => {
      expect(screen.getByText('Session revocation was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
