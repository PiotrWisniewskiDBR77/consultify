import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseSecurityPanel } from '@/components/SuperAdmin/system/EnterpriseSecurityPanel';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getSecurityEvents: vi.fn(),
    getSecurityEventStats: vi.fn(),
    getSuperAdminActiveSessions: vi.fn(),
    getIPAccessRules: vi.fn(),
    getSecurityPolicies: vi.fn(),
    getComplianceFrameworks: vi.fn(),
    resolveSecurityEvent: vi.fn(),
    terminateSession: vi.fn(),
    updateIPRule: vi.fn(),
    updateSecurityPolicy: vi.fn(),
  },
}));

describe('EnterpriseSecurityPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.getSecurityEvents).mockRejectedValue(new Error('Security events backend down'));
    vi.mocked(Api.getSecurityEventStats).mockResolvedValue({
      total: 0,
      critical: 0,
      high: 0,
      unresolved: 0,
    });
    vi.mocked(Api.getSuperAdminActiveSessions).mockRejectedValue(
      new Error('Session backend down')
    );
    vi.mocked(Api.getIPAccessRules).mockRejectedValue(new Error('IP rules backend down'));
    vi.mocked(Api.getSecurityPolicies).mockRejectedValue(new Error('Policies backend down'));
    vi.mocked(Api.getComplianceFrameworks).mockRejectedValue(
      new Error('Compliance backend down')
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render security event load failures as an empty event list or zero stats', async () => {
    render(<EnterpriseSecurityPanel />);

    await waitFor(() => {
      expect(screen.getByText('Security events unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Security event list unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No security events found')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Events')).not.toBeInTheDocument();

    expect(screen.getByDisplayValue('All Severities')).toBeDisabled();
    expect(screen.getByDisplayValue('All Event Types')).toBeDisabled();
    expect(screen.getByDisplayValue('All Status')).toBeDisabled();
  });

  it('does not render failed session loads as no active sessions', async () => {
    render(<EnterpriseSecurityPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Sessions/i }));

    await waitFor(() => {
      expect(screen.getByText('Active session list unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No active sessions')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Terminate All/i })).toBeDisabled();
  });

  it('does not claim IP access is open when IP rules cannot load', async () => {
    render(<EnterpriseSecurityPanel />);

    fireEvent.click(screen.getByRole('button', { name: /IP Rules/i }));

    await waitFor(() => {
      expect(screen.getByText('IP access rules unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No IP rules configured')).not.toBeInTheDocument();
    expect(screen.queryByText('All IP addresses are currently allowed')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Rule/i })).toBeDisabled();
  });

  it('shows degraded/read-only states for policies, compliance, and SIEM workflows', async () => {
    render(<EnterpriseSecurityPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Policies/i }));

    await waitFor(() => {
      expect(screen.getByText('Security policies unavailable')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Compliance/i }));

    await waitFor(() => {
      expect(screen.getByText('Compliance frameworks unavailable')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Run Assessment/i })).toBeDisabled();
    expect(screen.getByText('SIEM configuration workflow unavailable')).toBeInTheDocument();
  });
});
