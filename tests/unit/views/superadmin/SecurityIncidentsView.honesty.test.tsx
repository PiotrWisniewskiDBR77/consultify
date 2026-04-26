import { render, screen, waitFor } from '@testing-library/react';
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

describe('SecurityIncidentsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getSecurityIncidents).mockRejectedValue(new Error('Incidents backend down'));
    vi.mocked(Api.getSecurityIncidentStats).mockResolvedValue({
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
    });
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
});
