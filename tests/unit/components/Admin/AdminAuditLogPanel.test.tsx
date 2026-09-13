import { Blob as NodeBlob } from 'node:buffer';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAuditLogPanel } from '@/components/Admin/AdminAuditLogPanel';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    exportOwnOrganizationData: vi.fn(),
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

describe('Admin organization self-service export', () => {
  const props = {
    organizationId: 'org-a',
    actorId: 'owner-a',
    actorRole: 'OWNER',
    showOrganizationExport: true,
  };
  const makeBlob = (org = 'org-a') =>
    new NodeBlob([
      JSON.stringify({
        organization: { id: org },
        securityManifest: { complete: false, unresolvedTables: [{ table: 'unknown' }] },
        skipped: [],
      }),
    ]) as unknown as Blob;
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getTenantAdminAuditLogs).mockResolvedValue({ logs: [] });
    vi.mocked(Api.getTenantAdminAuditStats).mockResolvedValue({ totalLogs: 0 });
    vi.mocked(Api.getAdminRiskSummary).mockResolvedValue({ summary: {} });
    vi.mocked(Api.getAdminComplianceSummary).mockResolvedValue({ summary: {} });
    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:own-export'),
        revokeObjectURL: vi.fn(),
      })
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  it.each(['OWNER', 'ADMIN'])(
    'downloads original partial JSON for %s through the own-organization helper',
    async (actorRole) => {
      const blob = makeBlob();
      vi.mocked(Api.exportOwnOrganizationData).mockResolvedValue(blob);
      render(<AdminAuditLogPanel {...props} actorRole={actorRole} />);
      fireEvent.click(screen.getByRole('button', { name: 'Export organization data (JSON)' }));
      expect((await screen.findByRole('status')).textContent).toContain(
        'Partial export downloaded'
      );
      expect(Api.exportOwnOrganizationData).toHaveBeenCalledWith('org-a');
      expect(Api.exportTenantAdminAuditLogs).not.toHaveBeenCalled();
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    }
  );
  it.each([
    { actorRole: 'MEMBER' },
    { organizationId: undefined },
    { actorId: undefined },
    { showOrganizationExport: false },
  ])('hides export when context is unsupported: %j', async (override) => {
    render(<AdminAuditLogPanel {...props} {...override} />);
    await screen.findByText('Total logs');
    expect(
      screen.queryByRole('button', { name: 'Export organization data (JSON)' })
    ).not.toBeInTheDocument();
  });
  it.each(['organization', 'actor', 'role', 'route', 'unmount'])(
    'suppresses late file after %s changes',
    async (change) => {
      let finish!: (blob: Blob) => void;
      vi.mocked(Api.exportOwnOrganizationData).mockReturnValue(
        new Promise((resolve) => {
          finish = resolve;
        })
      );
      const view = render(<AdminAuditLogPanel {...props} />);
      fireEvent.click(screen.getByRole('button', { name: 'Export organization data (JSON)' }));
      if (change === 'unmount') view.unmount();
      else
        view.rerender(
          <AdminAuditLogPanel
            {...props}
            {...(change === 'organization'
              ? { organizationId: 'org-b' }
              : change === 'actor'
                ? { actorId: 'owner-b' }
                : change === 'route'
                  ? { showOrganizationExport: false }
                  : { actorRole: 'MEMBER' })}
          />
        );
      await act(async () => {
        finish(makeBlob());
      });
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
      expect(screen.queryByText(/Partial export downloaded/)).not.toBeInTheDocument();
    }
  );
  it('allows export when the separate audit log failed to load', async () => {
    vi.mocked(Api.getTenantAdminAuditLogs).mockRejectedValue(new Error('Audit unavailable'));
    vi.mocked(Api.exportOwnOrganizationData).mockResolvedValue(makeBlob());
    render(<AdminAuditLogPanel {...props} />);
    await screen.findByText('Audit unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Export organization data (JSON)' }));
    await screen.findByRole('status');
    expect(Api.exportOwnOrganizationData).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Total logs')).not.toBeInTheDocument();
  });
  it('denies a failed response without a file, resets state and permits retry', async () => {
    vi.mocked(Api.exportOwnOrganizationData)
      .mockRejectedValueOnce(new Error('Legal hold'))
      .mockResolvedValueOnce(makeBlob());
    render(<AdminAuditLogPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export organization data (JSON)' }));
    await screen.findByText('Legal hold');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Export organization data (JSON)' }));
    await screen.findByRole('status');
    expect(Api.exportOwnOrganizationData).toHaveBeenCalledTimes(2);
  });
  it('keeps the new tenant request pending when the old tenant request rejects late', async () => {
    let rejectA!: (error: Error) => void;
    let resolveB!: (blob: Blob) => void;
    vi.mocked(Api.exportOwnOrganizationData)
      .mockReturnValueOnce(
        new Promise((_resolve, reject) => {
          rejectA = reject;
        })
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          resolveB = resolve;
        })
      );
    const view = render(<AdminAuditLogPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export organization data (JSON)' }));
    view.rerender(<AdminAuditLogPanel {...props} organizationId="org-b" />);
    fireEvent.click(screen.getByRole('button', { name: 'Export organization data (JSON)' }));
    await act(async () => {
      rejectA(new Error('Old tenant failure'));
    });
    expect(screen.queryByText('Old tenant failure')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Preparing organization export…' })).toBeDisabled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
    await act(async () => {
      resolveB(makeBlob('org-b'));
    });
    await screen.findByRole('status');
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });
  it('disables the connected control while a request is pending', async () => {
    let finish!: (blob: Blob) => void;
    vi.mocked(Api.exportOwnOrganizationData).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      })
    );
    render(<AdminAuditLogPanel {...props} />);
    fireEvent.click(screen.getByRole('button', { name: 'Export organization data (JSON)' }));
    const pending = screen.getByRole('button', { name: 'Preparing organization export…' });
    expect(pending.isConnected).toBe(true);
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(Api.exportOwnOrganizationData).toHaveBeenCalledTimes(1);
    await act(async () => {
      finish(makeBlob());
    });
    await screen.findByRole('status');
  });
});
