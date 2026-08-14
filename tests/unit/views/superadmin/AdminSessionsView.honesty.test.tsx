import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import AdminSessionsView from '@/views/superadmin/iam/AdminSessionsView';

vi.mock('@/services/api', () => ({
  Api: {
    getAdminSessions: vi.fn(),
    getAdminSessionStats: vi.fn(),
    revokeAdminSession: vi.fn(),
    revokeAllAdminSessions: vi.fn(),
  },
}));

const stats = {
  total: 1,
  active: 1,
  mfaVerified: 1,
  uniqueAdmins: 1,
  jitActive: 0,
  breakGlassActive: 0,
};

const session = {
  id: 'session-1',
  adminId: 'admin-1',
  ipAddress: '10.0.0.1',
  userAgent: 'Mozilla/5.0',
  mfaVerified: true,
  createdAt: 'not-a-date',
  expiresAt: 'not-a-date',
  isActive: true,
  admin: {
    email: 'admin@example.com',
    firstName: 'Ada',
    lastName: 'Admin',
  },
};

describe('AdminSessionsView honest UI', () => {
  const revokeSession = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Revoke Session' }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    vi.mocked(Api.getAdminSessions).mockRejectedValue(new Error('Admin sessions backend down'));
    vi.mocked(Api.getAdminSessionStats).mockResolvedValue(stats);
    vi.mocked(Api.revokeAdminSession).mockResolvedValue({ success: true });
    vi.mocked(Api.revokeAllAdminSessions).mockResolvedValue({ success: true });
  });

  it('does not render session load failures as zero stats or an empty active-session list', async () => {
    render(<AdminSessionsView />);

    await waitFor(() => {
      expect(screen.getByText('Admin sessions unavailable')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Admin sessions backend down').length).toBeGreaterThan(0);
    expect(screen.queryByText('No active sessions found')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Sessions')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Revoke All Sessions/i })).toBeDisabled();
    expect(Api.revokeAdminSession).not.toHaveBeenCalled();
    expect(Api.revokeAllAdminSessions).not.toHaveBeenCalled();
  });

  it('does not revoke a single session locally when read-back remains stale', async () => {
    vi.mocked(Api.getAdminSessions).mockResolvedValue({ sessions: [session] });

    render(<AdminSessionsView />);

    await screen.findByText('admin@example.com');
    expect(screen.getAllByText('Unknown date').length).toBeGreaterThan(0);
    revokeSession();

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Admin session revocation was not confirmed by the server'
      );
    });
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('removes a revoked session only after read-back confirms it is gone', async () => {
    vi.mocked(Api.getAdminSessions)
      .mockResolvedValueOnce({ sessions: [session] })
      .mockResolvedValueOnce({ sessions: [] });

    render(<AdminSessionsView />);

    await screen.findByText('admin@example.com');
    revokeSession();

    await waitFor(() => {
      expect(screen.queryByText('admin@example.com')).not.toBeInTheDocument();
    });
    expect(screen.getByText('No active sessions found')).toBeInTheDocument();
  });

  it('does not report bulk revoke success when read-back still has sessions', async () => {
    vi.mocked(Api.getAdminSessions).mockResolvedValue({ sessions: [session] });

    render(<AdminSessionsView />);

    await screen.findByText('admin@example.com');
    fireEvent.click(screen.getByRole('button', { name: /Revoke All Sessions/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Bulk admin session revocation was not confirmed by the server'
      );
    });
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });

  it('does not render malformed session stats as NaN', async () => {
    vi.mocked(Api.getAdminSessions).mockResolvedValue({ sessions: [] });
    vi.mocked(Api.getAdminSessionStats).mockResolvedValue({
      total: 'bad-total',
      active: 'bad-active',
      mfaVerified: 'bad-mfa',
      uniqueAdmins: 'bad-admins',
      jitActive: 'bad-jit',
      breakGlassActive: 'bad-bg',
    });

    render(<AdminSessionsView />);

    await screen.findByText('No active sessions found');

    expect(screen.queryByText(/NaN|bad-/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('accepts wrapped session and stats payloads', async () => {
    vi.mocked(Api.getAdminSessions).mockResolvedValue({ data: { data: { sessions: [session] } } });
    vi.mocked(Api.getAdminSessionStats).mockResolvedValue({
      data: {
        data: {
          totalSessions: 1,
          activeSessions: 1,
          mfaVerifiedSessions: 1,
          uniqueAdmins: 1,
          jitActive: 0,
          breakGlassActive: 0,
        },
      },
    });

    render(<AdminSessionsView />);

    expect(await screen.findByText('admin@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Row actions' })).toBeInTheDocument();
    expect(screen.queryByText('Admin sessions unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed session payloads as an empty active-session list', async () => {
    vi.mocked(Api.getAdminSessions).mockResolvedValue({ unexpected: true });

    render(<AdminSessionsView />);

    await waitFor(() => {
      expect(screen.getByText('Admin sessions unavailable')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Admin sessions response was not a list').length).toBeGreaterThan(0);
    expect(screen.queryByText('No active sessions found')).not.toBeInTheDocument();
  });
});
