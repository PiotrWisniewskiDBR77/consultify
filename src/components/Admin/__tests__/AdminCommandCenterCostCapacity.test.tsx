import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Api } from '../../../services/api';
import { getComplianceCostAttribution } from '../../../services/enterpriseComplianceApi';
import { AdminCommandCenterPanel } from '../AdminCommandCenterPanel';
vi.mock('../../../services/api', () => ({
  Api: {
    getAdminBillingSummary: vi.fn(),
    getAdminBillingUsageDetails: vi.fn(),
    getAdminBillingAlerts: vi.fn(),
    getHealthPanelSummary: vi.fn(),
  },
}));
vi.mock('../../../services/enterpriseComplianceApi', () => ({
  getComplianceCostAttribution: vi.fn(),
}));
const api = vi.mocked(Api);
const attribution = vi.mocked(getComplianceCostAttribution);
describe('Command Center cost and capacity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAdminBillingSummary.mockResolvedValue({ currentCost: 12.5, forecast: 20, seatsUsed: 7 });
    api.getAdminBillingUsageDetails.mockResolvedValue({ utilizationPercent: 25 });
    api.getAdminBillingAlerts.mockResolvedValue({ alerts: [{ id: 'a1' }] });
    api.getHealthPanelSummary.mockResolvedValue({ summary: { failed: 0 } });
    attribution.mockResolvedValue({
      totalCost: 12.5,
      byUser: [{ userId: 'u1', cost: 12.5, messageCount: 3 }],
      byModel: [],
      byDay: [],
    });
  });
  it('aggregates five sources and links to canonical billing screens', async () => {
    render(
      <MemoryRouter>
        <AdminCommandCenterPanel screen="cost-capacity" />
      </MemoryRouter>
    );
    expect((await screen.findAllByText('12.50')).length).toBeGreaterThan(0);
    expect(screen.getByText('u1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Alerty budżetowe/ })).toHaveAttribute(
      'href',
      '/admin/billing/budgets-alerts'
    );
    expect(screen.getByRole('link', { name: 'Szczegóły wykorzystania' })).toHaveAttribute(
      'href',
      '/admin/billing/usage-costs'
    );
  });
});
