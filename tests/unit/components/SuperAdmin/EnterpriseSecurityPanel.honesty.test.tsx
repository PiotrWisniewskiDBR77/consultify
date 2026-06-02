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

const securityEvent = {
  id: 'event-1',
  event_type: 'LOGIN_FAILED',
  severity: 'HIGH',
  resolved: false,
  created_at: 'not-a-date',
  details: {},
};

const session = {
  id: 'session-1',
  user_id: 'user-1',
  user_email: 'user@example.com',
  device_type: 'desktop',
  browser: 'Chrome',
  ip_address: '10.0.0.1',
  location: 'Warsaw',
  created_at: 'not-a-date',
  last_activity: 'not-a-date',
  is_current: false,
};

const ipRule = {
  id: 'rule-1',
  ip_pattern: '10.0.0.0/24',
  rule_type: 'allow',
  description: 'Office',
  created_at: 'not-a-date',
  created_by: 'admin',
  enabled: true,
};

const policy = {
  id: 'policy-1',
  name: 'Password Policy',
  description: 'Password rules',
  category: 'Security',
  settings: {},
  enabled: true,
  last_updated: 'not-a-date',
};

describe('EnterpriseSecurityPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('confirm', vi.fn(() => true));

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
    vi.mocked(Api.resolveSecurityEvent).mockResolvedValue({ success: true });
    vi.mocked(Api.terminateSession).mockResolvedValue({ success: true });
    vi.mocked(Api.updateIPRule).mockResolvedValue({ success: true });
    vi.mocked(Api.updateSecurityPolicy).mockResolvedValue({ success: true });
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

  it('does not claim security event resolution when read-back remains unresolved', async () => {
    vi.mocked(Api.getSecurityEvents).mockResolvedValue({ events: [securityEvent] });

    render(<EnterpriseSecurityPanel />);

    await screen.findByRole('button', { name: /Resolve security event event-1/i });
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Resolve security event event-1/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Security event resolution was not confirmed by the server'
      );
    });
  });

  it('does not claim session termination when read-back remains stale', async () => {
    vi.mocked(Api.getSecurityEvents).mockResolvedValue({ events: [] });
    vi.mocked(Api.getSuperAdminActiveSessions).mockResolvedValue({ sessions: [session] });

    render(<EnterpriseSecurityPanel />);

    fireEvent.click(screen.getByRole('button', { name: /Sessions/i }));
    await screen.findByText('user@example.com');
    fireEvent.click(screen.getByRole('button', { name: /Terminate session session-1/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Session termination was not confirmed by the server'
      );
    });
  });

  it('does not claim IP rule or policy toggles when read-back remains stale', async () => {
    vi.mocked(Api.getSecurityEvents).mockResolvedValue({ events: [] });
    vi.mocked(Api.getIPAccessRules).mockResolvedValue({ rules: [ipRule] });
    vi.mocked(Api.getSecurityPolicies).mockResolvedValue({ policies: [policy] });

    render(<EnterpriseSecurityPanel />);

    fireEvent.click(screen.getByRole('button', { name: /IP Rules/i }));
    await screen.findByText('10.0.0.0/24');
    fireEvent.click(screen.getByRole('button', { name: /Disable IP rule 10\.0\.0\.0\/24/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'IP rule update was not confirmed by the server'
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /Policies/i }));
    await screen.findByText('Password Policy');
    fireEvent.click(screen.getByRole('button', { name: /Disable policy Password Policy/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Policy update was not confirmed by the server'
      );
    });
  });

  it('accepts wrapped security event payloads and renders malformed fields safely', async () => {
    vi.mocked(Api.getSecurityEvents).mockResolvedValue({
      data: {
        events: [{ ...securityEvent, event_type: 123, severity: 'unexpected' }],
      },
    });

    render(<EnterpriseSecurityPanel />);

    expect(await screen.findByText('123')).toBeInTheDocument();
    expect(screen.getAllByText('LOW').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
