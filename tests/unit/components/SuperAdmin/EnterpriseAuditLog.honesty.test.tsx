import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseAuditLog } from '@/components/SuperAdmin/system/EnterpriseAuditLog';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getAuditLogs: vi.fn(),
    getAuditLogStats: vi.fn(),
    exportAuditLogs: vi.fn(),
  },
}));

describe('EnterpriseAuditLog honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.getAuditLogs).mockRejectedValue(new Error('Audit log backend down'));
    vi.mocked(Api.getAuditLogStats).mockResolvedValue({
      total: 0,
      low_risk: 0,
      medium_risk: 0,
      high_risk: 0,
      critical_risk: 0,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render audit log load failures as empty logs or zero stats', async () => {
    render(<EnterpriseAuditLog />);

    await waitFor(() => {
      expect(screen.getByText('Audit log overview unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Audit logs unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No audit logs found')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Events')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Export/i })[0]).toBeDisabled();
    expect(screen.getByPlaceholderText(/Search by action/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /^Filters$/i })).toBeDisabled();
  });

  it('does not render audit analytics as empty charts when audit data cannot load', async () => {
    render(<EnterpriseAuditLog />);

    fireEvent.click(screen.getByRole('button', { name: /Analytics/i }));

    await waitFor(() => {
      expect(screen.getByText('Audit analytics unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No data')).not.toBeInTheDocument();
    expect(screen.queryByText('Risk Distribution')).not.toBeInTheDocument();
  });
});
