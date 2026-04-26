import { render, screen, waitFor } from '@testing-library/react';
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

describe('AdminSessionsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAdminSessions).mockRejectedValue(new Error('Admin sessions backend down'));
    vi.mocked(Api.getAdminSessionStats).mockResolvedValue({
      total: 0,
      active: 0,
      mfaVerified: 0,
      uniqueAdmins: 0,
      jitActive: 0,
      breakGlassActive: 0,
    });
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
});
