import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import SecurityIncidentsView from '@/views/superadmin/iam/SecurityIncidentsView';

vi.mock('@/services/api', () => ({
  Api: {
    getSecurityIncidents: vi.fn(),
    getSecurityIncidentStats: vi.fn(),
    createSecurityIncident: vi.fn(),
    resolveSecurityIncident: vi.fn(),
    deleteSecurityIncident: vi.fn(),
  },
}));

const incidentStats = {
  totalIncidents: 0,
  byStatus: {
    open: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
  },
  bySeverity: {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  },
};

const incident = {
  id: 'incident-1',
  incidentType: 'suspicious_activity',
  severity: 'MEDIUM',
  status: 'open',
  description: 'Suspicious login',
  affectedResources: ['user-1'],
  detectedAt: 'not-a-date',
  resolvedAt: null,
  resolutionNotes: null,
  createdAt: '2026-04-26T00:00:00.000Z',
  resolvedBy: null,
};

describe('SecurityIncidentsView honest UI', () => {
  const openRowActions = () => {
    fireEvent.click(screen.getByRole('button', { name: 'Row actions' }));
  };

  const chooseRowAction = (name: string) => {
    openRowActions();
    fireEvent.click(screen.getByRole('menuitem', { name }));
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'confirm',
      vi.fn(() => true)
    );
    vi.mocked(Api.getSecurityIncidents).mockRejectedValue(new Error('Incidents backend down'));
    vi.mocked(Api.getSecurityIncidentStats).mockResolvedValue(incidentStats);
    vi.mocked(Api.createSecurityIncident).mockResolvedValue({ id: 'incident-1' });
    vi.mocked(Api.resolveSecurityIncident).mockResolvedValue({ success: true });
    vi.mocked(Api.deleteSecurityIncident).mockResolvedValue({ success: true });
  });

  it('does not render incident load failures as empty incident data', async () => {
    render(<SecurityIncidentsView />);

    await waitFor(() => {
      expect(screen.getByText('Security incidents unavailable')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Incidents backend down').length).toBeGreaterThan(0);
    expect(screen.getByText('Security incident list unavailable')).toBeInTheDocument();

    expect(screen.queryByText('No security incidents found')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Incidents')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Filters/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Report Incident/i })).toBeDisabled();
    expect(Api.createSecurityIncident).not.toHaveBeenCalled();
    expect(Api.resolveSecurityIncident).not.toHaveBeenCalled();
    expect(Api.deleteSecurityIncident).not.toHaveBeenCalled();
  });

  it('does not close create modal when incident read-back is stale', async () => {
    vi.mocked(Api.getSecurityIncidents).mockResolvedValue([]);

    render(<SecurityIncidentsView />);

    await screen.findByText('No security incidents found');
    fireEvent.click(screen.getByRole('button', { name: /Report Incident/i }));
    fireEvent.change(screen.getByPlaceholderText('Describe the security incident...'), {
      target: { value: 'Suspicious login' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Report Incident/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Security incident creation was not confirmed by the server'
      );
    });
    expect(screen.getByText('Report Security Incident')).toBeInTheDocument();
  });

  it('keeps create modal open when create response does not include an id', async () => {
    vi.mocked(Api.getSecurityIncidents).mockResolvedValue([]);
    vi.mocked(Api.createSecurityIncident).mockResolvedValue({ success: true });

    render(<SecurityIncidentsView />);

    await screen.findByText('No security incidents found');
    fireEvent.click(screen.getByRole('button', { name: /Report Incident/i }));
    fireEvent.change(screen.getByPlaceholderText('Describe the security incident...'), {
      target: { value: 'Suspicious login' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Report Incident/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Security incident creation response was incomplete'
      );
    });
    expect(screen.getByText('Report Security Incident')).toBeInTheDocument();
  });

  it('does not crash or render NaN when incident stats response is malformed', async () => {
    vi.mocked(Api.getSecurityIncidents).mockResolvedValue([]);
    vi.mocked(Api.getSecurityIncidentStats).mockResolvedValue({
      totalIncidents: 'bad-total',
      byStatus: null,
      bySeverity: { critical: 'bad-critical' },
    });

    render(<SecurityIncidentsView />);

    await screen.findByText('No security incidents found');

    expect(screen.queryByText(/NaN|bad-/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  });

  it('accepts wrapped incident payloads and exposes labelled actions', async () => {
    vi.mocked(Api.getSecurityIncidents).mockResolvedValue({
      data: { data: { incidents: [incident] } },
    });
    vi.mocked(Api.getSecurityIncidentStats).mockResolvedValue({
      data: { data: incidentStats },
    });

    render(<SecurityIncidentsView />);

    expect(await screen.findByText('Suspicious login')).toBeInTheDocument();
    openRowActions();
    expect(screen.getByRole('menuitem', { name: 'View Details' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Resolve' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
  });

  it('normalizes staging incident rows before rendering details', async () => {
    vi.mocked(Api.getSecurityIncidents).mockResolvedValue({
      incidents: [
        {
          id: 'incident-snake-case',
          incident_type: 'privilege_escalation',
          severity: 'critical',
          status: 'open',
          description: 'Privileged session anomaly',
          affected_resources: '["admin-session-1","api-key-2"]',
          detected_at: '2026-04-28T19:17:00.000Z',
          resolved_at: null,
          resolution_notes: null,
          created_at: '2026-04-28T19:17:00.000Z',
          resolved_by: '{"first_name":"Security","last_name":"Operator","email":"sec@example.com"}',
        },
      ],
    });

    render(<SecurityIncidentsView />);

    expect(await screen.findByText('Privileged session anomaly')).toBeInTheDocument();
    chooseRowAction('View Details');

    expect(screen.getAllByText('Privilege Escalation').length).toBeGreaterThan(0);
    expect(screen.getByText('admin-session-1')).toBeInTheDocument();
    expect(screen.getByText('api-key-2')).toBeInTheDocument();
    expect(screen.queryByText('Something went very wrong!')).not.toBeInTheDocument();
  });

  it('closes create modal only after incident is confirmed by read-back', async () => {
    vi.mocked(Api.getSecurityIncidents).mockResolvedValueOnce([]).mockResolvedValueOnce([incident]);

    render(<SecurityIncidentsView />);

    await screen.findByText('No security incidents found');
    fireEvent.click(screen.getByRole('button', { name: /Report Incident/i }));
    fireEvent.change(screen.getByPlaceholderText('Describe the security incident...'), {
      target: { value: 'Suspicious login' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Report Incident/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByText('Report Security Incident')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Suspicious login')).toBeInTheDocument();
  });

  it('does not resolve or delete incidents when read-back remains stale', async () => {
    vi.mocked(Api.getSecurityIncidents).mockResolvedValue([incident]);

    render(<SecurityIncidentsView />);

    await screen.findByText('Suspicious login');
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    chooseRowAction('Resolve');
    fireEvent.change(screen.getByPlaceholderText('Resolution notes...'), {
      target: { value: 'Reviewed' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Resolve$/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Security incident resolution was not confirmed by the server'
      );
    });

    chooseRowAction('Delete');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Security incident deletion was not confirmed by the server'
      );
    });
    expect(screen.getByText('Suspicious login')).toBeInTheDocument();
  });

  it('does not report delete success when incident read-back is unavailable', async () => {
    vi.mocked(Api.getSecurityIncidents)
      .mockResolvedValueOnce([incident])
      .mockRejectedValueOnce(new Error('Read-back down'));

    render(<SecurityIncidentsView />);

    await screen.findByText('Suspicious login');
    chooseRowAction('Delete');

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Security incident deletion was not confirmed by the server'
      );
    });
  });

  it('treats an absent incident after resolve as confirmed', async () => {
    vi.mocked(Api.getSecurityIncidents).mockResolvedValueOnce([incident]).mockResolvedValueOnce([]);

    render(<SecurityIncidentsView />);

    await screen.findByText('Suspicious login');
    chooseRowAction('Resolve');
    fireEvent.change(screen.getByPlaceholderText('Resolution notes...'), {
      target: { value: 'Reviewed' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /^Resolve$/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('Resolution notes...')).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('accepts a deeply wrapped create response when read-back confirms it', async () => {
    vi.mocked(Api.getSecurityIncidents).mockResolvedValueOnce([]).mockResolvedValueOnce([incident]);
    vi.mocked(Api.createSecurityIncident).mockResolvedValue({
      data: { data: { incident: { id: 'incident-1' } } },
    });

    render(<SecurityIncidentsView />);

    await screen.findByText('No security incidents found');
    fireEvent.click(screen.getByRole('button', { name: /Report Incident/i }));
    fireEvent.change(screen.getByPlaceholderText('Describe the security incident...'), {
      target: { value: 'Suspicious login' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: /Report Incident/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.queryByText('Report Security Incident')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Suspicious login')).toBeInTheDocument();
  });

  it('does not render malformed incident payloads as an empty list', async () => {
    vi.mocked(Api.getSecurityIncidents).mockResolvedValue({ unexpected: true });

    render(<SecurityIncidentsView />);

    await waitFor(() => {
      expect(screen.getByText('Security incidents unavailable')).toBeInTheDocument();
    });
    expect(
      screen.getAllByText('Security incidents response was not a list').length
    ).toBeGreaterThan(0);
    expect(screen.queryByText('No security incidents found')).not.toBeInTheDocument();
  });
});
