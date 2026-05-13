import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AuditLogView } from '@/views/admin/AuditLogView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getTenantAdminAuditLogs: vi.fn(),
    exportTenantAdminAuditLogs: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('AuditLogView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getTenantAdminAuditLogs).mockRejectedValue(new Error('Audit API down'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render failed audit log loads as no activity found or exportable data', async () => {
    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Audit logs unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Audit activity unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No Activity Found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('Search logs...')).toBeDisabled();
    screen.getAllByRole('combobox').forEach((combobox) => {
      expect(combobox).toBeDisabled();
    });
  });

  it('loads tenant admin audit logs through the P32 audit endpoint', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'log-1',
          admin_id: 'admin-1',
          action_type: 'update_security_policy',
          metadata_json: JSON.stringify({
            orgId: 'org-1',
            adminName: 'Admin User',
            adminEmail: 'admin@example.com',
            resource: 'Security',
            resourceName: 'MFA policy',
          }),
          ip_address: '127.0.0.1',
          created_at: '2026-04-26T10:00:00.000Z',
        },
      ],
      total: 1,
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(Api.getTenantAdminAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 100, offset: 0 })
      );
    });
    expect(screen.getByText('Admin User')).toBeInTheDocument();
    expect(screen.getByText('SECURITY')).toBeInTheDocument();
    expect(screen.getByText(/MFA policy/)).toBeInTheDocument();
    expect(screen.queryByText('Audit logs unavailable')).not.toBeInTheDocument();
  });

  it('renders invalid audit timestamps as unknown dates instead of Invalid Date', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'log-invalid-date',
          admin_id: 'admin-1',
          action_type: 'export_audit_logs',
          metadata_json: JSON.stringify({
            adminName: 'Admin User',
            adminEmail: 'admin@example.com',
            resource: 'Audit',
            resourceName: 'CSV export',
          }),
          ip_address: '127.0.0.1',
          created_at: 'not-a-date',
        },
      ],
      total: 1,
    });

    render(<AuditLogView />);

    await waitFor(() => {
      expect(screen.getByText('Unknown date')).toBeInTheDocument();
    });

    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument();
  });
});
