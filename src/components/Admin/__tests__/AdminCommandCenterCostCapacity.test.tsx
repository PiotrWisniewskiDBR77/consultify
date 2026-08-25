import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { Api } from '../../../services/api';
import { getComplianceCostAttribution } from '../../../services/enterpriseComplianceApi';
import { AdminCommandCenterPanel } from '../AdminCommandCenterPanel';

// Opt-in to real PL translation resolution (tests/setup.ts's global
// react-i18next mock is key-agnostic by repo convention). This panel's
// own admin day-2 i18n contract (AdminDay2I18n.test.ts) forbids defaultValue
// fallbacks, so its tests assert literal Polish strings resolved from the
// real shipped translation.json instead.
vi.mock('react-i18next', () => {
  const t = createRealT('pl');
  return { useTranslation: () => ({ t, i18n: { language: 'pl' } }) };
});

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

  it('renders an honest empty state when there is no cost attribution', async () => {
    attribution.mockResolvedValue({ totalCost: 0, byUser: [], byModel: [], byDay: [] });
    render(
      <MemoryRouter>
        <AdminCommandCenterPanel screen="cost-capacity" />
      </MemoryRouter>
    );
    expect(await screen.findByText('Brak atrybucji kosztów')).toBeInTheDocument();
  });

  it('surfaces a degraded-source warning when part of the aggregation fails', async () => {
    api.getAdminBillingAlerts.mockRejectedValue(new Error('billing alerts unavailable'));
    api.getHealthPanelSummary.mockRejectedValue(new Error('health panel unavailable'));
    render(
      <MemoryRouter>
        <AdminCommandCenterPanel screen="cost-capacity" />
      </MemoryRouter>
    );
    expect(
      await screen.findByText('Część źródeł kosztu lub pojemności jest niedostępna.')
    ).toBeInTheDocument();
  });
});
