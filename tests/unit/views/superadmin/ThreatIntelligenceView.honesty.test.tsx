import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import ThreatIntelligenceView from '@/views/superadmin/iam/ThreatIntelligenceView';

vi.mock('@/services/api', () => ({
  Api: {
    getThreats: vi.fn(),
    getThreatStats: vi.fn(),
    addThreat: vi.fn(),
    blockThreat: vi.fn(),
    unblockThreat: vi.fn(),
    deleteThreat: vi.fn(),
    checkIPReputation: vi.fn(),
    checkDomainReputation: vi.fn(),
  },
}));

describe('ThreatIntelligenceView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getThreats).mockRejectedValue(new Error('Threat feed backend down'));
    vi.mocked(Api.getThreatStats).mockResolvedValue({
      totalThreats: 0,
      blockedCount: 0,
      byThreatLevel: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
      },
      ipCount: 0,
      domainCount: 0,
      avgReputation: 0,
    });
  });

  it('does not render threat load failures as an empty threat feed', async () => {
    render(<ThreatIntelligenceView />);

    await waitFor(() => {
      expect(screen.getByText('Threat intelligence unavailable')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Threat feed backend down').length).toBeGreaterThan(0);
    expect(screen.getByText('Threat list unavailable')).toBeInTheDocument();

    expect(screen.queryByText('No threats found')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Threats')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Filters/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Add Threat/i })).toBeDisabled();
    expect(Api.addThreat).not.toHaveBeenCalled();
    expect(Api.blockThreat).not.toHaveBeenCalled();
    expect(Api.unblockThreat).not.toHaveBeenCalled();
    expect(Api.deleteThreat).not.toHaveBeenCalled();
  });
});
