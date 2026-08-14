import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  const openResolveAction = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Resolve' }));
  };

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
    vi.mocked(Api.resolveAdminAuditLog).mockResolvedValue({ success: true });
    vi.mocked(Api.exportAdminAuditLogs).mockResolvedValue({ url: 'https://example.com/audit.csv' });
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

  it('uses safe dates and refetches audit logs after resolving an item', async () => {
    vi.mocked(Api.getAdminAuditLogs)
      .mockResolvedValueOnce({
        logs: [
          {
            id: 'log-1',
            admin_id: 'admin-1',
            action_type: 'delete',
            resource_type: 'organization',
            resource_id: 'org-1',
            ip_address: '127.0.0.1',
            user_agent: 'Test',
            risk_score: 90,
            status: 'unresolved',
            metadata_json: {},
            created_at: 'not-a-date',
            resolved_at: null,
            resolution_notes: null,
            admin: {
              email: 'admin@example.com',
              firstName: 'Ada',
              lastName: 'Admin',
            },
          },
        ],
      })
      .mockResolvedValueOnce({ logs: [] });
    vi.mocked(Api.getAdminAuditStats).mockResolvedValue({
      total_logs: 1,
      unresolved_count: 1,
      high_risk_count: 1,
      medium_risk_count: 0,
      low_risk_count: 0,
      avg_risk_score: 90,
    });
    render(<AdminAuditLogsView />);

    expect(await screen.findByText('delete')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();

    openResolveAction();
    fireEvent.change(screen.getByPlaceholderText('Resolution notes...'), {
      target: { value: 'Reviewed and remediated' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Resolve$/i }).at(-1)!);

    await waitFor(() => {
      expect(Api.resolveAdminAuditLog).toHaveBeenCalledWith('log-1', 'Reviewed and remediated');
      expect(screen.queryByText('delete')).not.toBeInTheDocument();
    });
    expect(Api.getAdminAuditLogs).toHaveBeenCalledTimes(2);
  });

  it('does not claim audit log resolution when read-back remains unresolved', async () => {
    const unresolvedLog = {
      id: 'log-1',
      admin_id: 'admin-1',
      action_type: 'delete',
      resource_type: 'organization',
      resource_id: 'org-1',
      ip_address: '127.0.0.1',
      user_agent: 'Test',
      risk_score: 90,
      status: 'unresolved',
      metadata_json: {},
      created_at: '2026-04-26T00:00:00.000Z',
      resolved_at: null,
      resolution_notes: null,
      admin: {
        email: 'admin@example.com',
        firstName: 'Ada',
        lastName: 'Admin',
      },
    };
    vi.mocked(Api.getAdminAuditLogs).mockResolvedValue({ logs: [unresolvedLog] });

    render(<AdminAuditLogsView />);

    await screen.findByText('delete');
    openResolveAction();
    fireEvent.change(screen.getByPlaceholderText('Resolution notes...'), {
      target: { value: 'Reviewed' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Resolve$/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Audit log resolution was not confirmed by the server'
      );
    });
    expect(screen.getByText('delete')).toBeInTheDocument();
    expect(screen.getByText('Resolve Audit Log')).toBeInTheDocument();
  });

  it('does not render malformed audit stats or risk score as NaN', async () => {
    vi.mocked(Api.getAdminAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'log-1',
          admin_id: 'admin-1',
          action_type: 'login',
          resource_type: '',
          resource_id: '',
          ip_address: '',
          user_agent: 'Test',
          risk_score: 'bad-risk',
          status: 'success',
          metadata_json: {},
          created_at: 'not-a-date',
          resolved_at: null,
          resolution_notes: null,
          admin: null,
        },
      ],
    });
    vi.mocked(Api.getAdminAuditStats).mockResolvedValue({
      total_logs: 'bad-total',
      unresolved_count: 'bad-unresolved',
      high_risk_count: 'bad-high',
      medium_risk_count: 'bad-medium',
      low_risk_count: 'bad-low',
      avg_risk_score: 'bad-avg',
    });

    render(<AdminAuditLogsView />);

    await screen.findByText('login');

    expect(screen.getByText('Unknown admin')).toBeInTheDocument();
    expect(screen.getByText('LOW (0)')).toBeInTheDocument();
    expect(screen.queryByText(/NaN|bad-/i)).not.toBeInTheDocument();
  });

  it('shows an action error when export returns no downloadable file', async () => {
    vi.mocked(Api.getAdminAuditLogs).mockResolvedValue({ logs: [] });
    vi.mocked(Api.exportAdminAuditLogs).mockResolvedValue({});

    render(<AdminAuditLogsView />);

    await screen.findByText('No audit logs found');
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Audit log export did not return a downloadable file'
      );
    });
  });

  it('accepts wrapped audit log, stats, and export payloads', async () => {
    vi.mocked(Api.getAdminAuditLogs).mockResolvedValue({
      data: {
        data: {
          logs: [
            {
              id: 'log-1',
              admin_id: 'admin-1',
              action_type: 'login',
              resource_type: 'session',
              resource_id: 'session-1',
              ip_address: '127.0.0.1',
              user_agent: 'Test',
              risk_score: 10,
              status: 'success',
              metadata_json: {},
              created_at: 'not-a-date',
              resolved_at: null,
              resolution_notes: null,
              admin: {
                email: 'admin@example.com',
                firstName: 'Ada',
                lastName: 'Admin',
              },
            },
          ],
        },
      },
    });
    vi.mocked(Api.getAdminAuditStats).mockResolvedValue({
      data: {
        data: {
          total_logs: 1,
          unresolved_count: 0,
          high_risk_count: 0,
          medium_risk_count: 0,
          low_risk_count: 1,
          avg_risk_score: 10,
        },
      },
    });
    vi.mocked(Api.exportAdminAuditLogs).mockResolvedValue({
      data: { data: { url: 'https://example.com/wrapped-audit.csv' } },
    });

    render(<AdminAuditLogsView />);

    expect(await screen.findByText('login')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Export CSV/i }));

    await waitFor(() => {
      expect(Api.exportAdminAuditLogs).toHaveBeenCalledTimes(1);
    });
  });

  it('surfaces backend integrity banner when audit logs report degraded metadata', async () => {
    vi.mocked(Api.getAdminAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'log-degraded-1',
          admin_id: 'admin-1',
          action_type: 'export_data',
          resource_type: 'organization',
          resource_id: 'org-1',
          ip_address: '127.0.0.1',
          user_agent: 'Test',
          risk_score: 90,
          status: 'logged',
          metadata_json: { _parseError: true, _raw: '{not-json' },
          created_at: '2026-04-26T00:00:00.000Z',
          resolved_at: null,
          resolution_notes: null,
          admin: {
            email: 'qa-admin@qa.consultify.local',
            firstName: 'QA',
            lastName: 'Admin',
          },
        },
      ],
      pagination: { limit: 100, offset: 0, count: 1, hasMore: false },
      integrity: {
        degraded: true,
        reason: 'Admin audit log query failed; serving an empty list to preserve UI integrity.',
        malformedMetadataCount: 1,
      },
    });

    render(<AdminAuditLogsView />);

    await screen.findByText('export_data');
    expect(await screen.findByTestId('audit-integrity-banner')).toHaveTextContent(
      /malformed metadata payloads/i
    );
  });

  it('surfaces malformed-metadata-only banner when backend is healthy but rows are partially bad', async () => {
    vi.mocked(Api.getAdminAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'log-malformed-1',
          admin_id: 'admin-1',
          action_type: 'login',
          resource_type: 'session',
          resource_id: 'session-1',
          ip_address: '127.0.0.1',
          user_agent: 'Test',
          risk_score: 5,
          status: 'logged',
          metadata_json: {},
          created_at: '2026-04-26T00:00:00.000Z',
          resolved_at: null,
          resolution_notes: null,
          admin: {
            email: 'qa-admin@qa.consultify.local',
            firstName: 'QA',
            lastName: 'Admin',
          },
        },
      ],
      pagination: { limit: 100, offset: 0, count: 1, hasMore: false },
      integrity: {
        degraded: false,
        reason: null,
        malformedMetadataCount: 2,
      },
    });

    render(<AdminAuditLogsView />);

    await screen.findByText('login');
    expect(await screen.findByTestId('audit-integrity-banner')).toHaveTextContent(
      /2 audit logs have malformed metadata/i
    );
  });

  it('renders malformed text fields safely and normalizes resolved status', async () => {
    vi.mocked(Api.getAdminAuditLogs).mockResolvedValue({
      logs: [
        {
          id: 'log-1',
          admin_id: 'admin-1',
          action_type: null,
          resource_type: { bad: true },
          resource_id: null,
          ip_address: { bad: true },
          user_agent: 'Test',
          risk_score: 10,
          status: 'RESOLVED',
          metadata_json: {},
          created_at: 'not-a-date',
          resolved_at: null,
          resolution_notes: null,
          admin: {
            email: null,
            firstName: { bad: true },
            lastName: null,
          },
        },
      ],
    });

    render(<AdminAuditLogsView />);

    expect(await screen.findByText('Unknown action')).toBeInTheDocument();
    expect(screen.getByText('Unknown admin')).toBeInTheDocument();
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);
    expect(screen.getByText('Resolved')).toBeInTheDocument();
    expect(screen.queryByText('[object Object]')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Row actions' })).not.toBeInTheDocument();
  });
});
