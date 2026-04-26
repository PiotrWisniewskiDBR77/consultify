import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import AdminAuditLogsView from '@/views/superadmin/iam/AdminAuditLogsView';

vi.mock('@/services/api', () => ({
  Api: {
    getAdminAuditLogs: vi.fn(),
    getAdminAuditStats: vi.fn(),
    resolveAdminAuditLog: vi.fn(),
    exportAdminAuditLogs: vi.fn(),
  },
}));

describe('AdminAuditLogsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAdminAuditLogs).mockRejectedValue(new Error('Admin audit backend down'));
    vi.mocked(Api.getAdminAuditStats).mockResolvedValue({
      total_logs: 0,
      unresolved_count: 0,
      high_risk_count: 0,
      medium_risk_count: 0,
      low_risk_count: 0,
      avg_risk_score: 0,
    });
  });

  it('does not render audit log load failures as empty audit logs', async () => {
    render(<AdminAuditLogsView />);

    await waitFor(() => {
      expect(screen.getByText('Admin audit logs unavailable')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Admin audit backend down').length).toBeGreaterThan(0);
    expect(screen.getByText('Admin audit log list unavailable')).toBeInTheDocument();

    expect(screen.queryByText('No audit logs found')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Logs')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Filters/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeDisabled();
    expect(Api.resolveAdminAuditLog).not.toHaveBeenCalled();
    expect(Api.exportAdminAuditLogs).not.toHaveBeenCalled();
  });
});
