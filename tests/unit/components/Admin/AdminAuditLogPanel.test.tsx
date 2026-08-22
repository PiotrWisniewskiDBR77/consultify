import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAuditLogPanel } from '@/components/Admin/AdminAuditLogPanel';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getTenantAdminAuditLogs: vi.fn(),
    getTenantAdminAuditStats: vi.fn(),
    getAdminRiskSummary: vi.fn(),
    getAdminComplianceSummary: vi.fn(),
    exportTenantAdminAuditLogs: vi.fn(),
    updateAdminComplianceDataRetention: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('AdminAuditLogPanel authoritative states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({ logs: [] });
    vi.mocked(Api.getTenantAdminAuditStats).mockResolvedValue({ totalLogs: 0 });
    vi.mocked(Api.getAdminRiskSummary).mockResolvedValue({ summary: {} });
    vi.mocked(Api.getAdminComplianceSummary).mockResolvedValue({ summary: {} });
  });

  it('does not present zero audit metrics as truth after a failed initial load', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs)
      .mockRejectedValueOnce(new Error('Audit unavailable'))
      .mockResolvedValueOnce({ logs: [] });
    render(<AdminAuditLogPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Audit unavailable');
    expect(screen.queryByText('Total logs')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(await screen.findByText('Total logs')).toBeInTheDocument();
  });

  it('renders a nonempty canonical IAM audit projection and its authoritative count', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'iam-audit-1',
          action_type: 'role_change',
          admin_id: 'owner-1',
          metadata_json: JSON.stringify({ before: { role: 'MEMBER' }, after: { role: 'ADMIN' } }),
          risk_level: 'high',
          risk_score: 60,
          status: 'logged',
          created_at: '2026-08-22T08:00:00.000Z',
        },
      ],
    });
    vi.mocked(Api.getTenantAdminAuditStats).mockResolvedValue({
      totalLogs: 1,
      unresolvedCount: 1,
      highRiskCount: 1,
    });

    render(<AdminAuditLogPanel />);

    expect(await screen.findByText('role change')).toBeInTheDocument();
    expect(screen.getByText('owner-1')).toBeInTheDocument();
    expect(screen.getByText('high (60)')).toBeInTheDocument();
    expect(screen.getAllByText('1')).toHaveLength(3);
  });
});
