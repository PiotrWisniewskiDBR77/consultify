import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { getAiSlaStatus, getTenantSlos } from '../../../services/adminSlaSloApi';
import { AdminSlaSloPanel } from '../AdminSlaSloPanel';
vi.mock('../../../services/adminSlaSloApi', () => ({
  getTenantSlos: vi.fn(),
  getAiSlaStatus: vi.fn(),
}));
describe('AdminSlaSloPanel', () => {
  it('renders tenant SLO read-only and fixed AI target disclosure', async () => {
    vi.mocked(getTenantSlos).mockResolvedValue([
      {
        id: 's1',
        slo_name: 'Availability',
        target_percentage: 99.9,
        window_days: 30,
        current_percentage: 99.95,
        budget_remaining: 0.5,
      },
    ]);
    vi.mocked(getAiSlaStatus).mockResolvedValue({ status: 'ok' });
    render(<AdminSlaSloPanel />);
    expect(await screen.findByText('Availability')).toBeInTheDocument();
    expect(
      screen.getByText('Cele AI-SLA są obecnie stałe i nie można ich konfigurować na tym ekranie.')
    ).toBeInTheDocument();
  });

  it('renders an honest empty state when no SLOs are defined', async () => {
    vi.mocked(getTenantSlos).mockResolvedValue([]);
    vi.mocked(getAiSlaStatus).mockResolvedValue({ status: 'ok' });
    render(<AdminSlaSloPanel />);
    expect(
      await screen.findByText('Dla tej organizacji nie zdefiniowano celów SLO.')
    ).toBeInTheDocument();
  });

  it('renders an API error', async () => {
    vi.mocked(getTenantSlos).mockRejectedValue(new Error('slo service down'));
    vi.mocked(getAiSlaStatus).mockResolvedValue({ status: 'ok' });
    render(<AdminSlaSloPanel />);
    expect(await screen.findByText('slo service down')).toBeInTheDocument();
  });
});
