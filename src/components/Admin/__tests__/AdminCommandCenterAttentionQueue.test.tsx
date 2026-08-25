import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRealT } from '@/test-utils/realTranslations';
import { Api } from '../../../services/api';
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
    getAdminRiskSummary: vi.fn(),
    getTenantAdminAuditStats: vi.fn(),
    getAdminBillingAlerts: vi.fn(),
    getHealthPanelSummary: vi.fn(),
  },
}));
vi.mock('../../../services/enterpriseComplianceApi', () => ({
  getComplianceCostAttribution: vi.fn(),
}));
const api = vi.mocked(Api);
const renderPanel = () =>
  render(
    <MemoryRouter>
      <AdminCommandCenterPanel screen="attention-queue" />
    </MemoryRouter>
  );

describe('Command Center attention queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getAdminRiskSummary.mockResolvedValue({ highRiskCount: 2 });
    api.getTenantAdminAuditStats.mockResolvedValue({ unresolvedCount: 3 });
    api.getAdminBillingAlerts.mockResolvedValue({ alerts: [] });
    api.getHealthPanelSummary.mockResolvedValue({ summary: { failed: 0 } });
  });
  it('aggregates four real sources with deep links and freshness', async () => {
    renderPanel();
    expect(await screen.findByText('Ryzyka wymagające przeglądu')).toBeInTheDocument();
    expect(screen.getAllByText(/Źródło:/)).toHaveLength(4);
    expect(screen.getAllByText(/Świeżość:/)).toHaveLength(4);
    expect(screen.getByRole('link', { name: /Alerty budżetowe/ })).toHaveAttribute(
      'href',
      '/admin/billing/budgets-alerts'
    );
  });
  it('shows an honest error when all sources fail', async () => {
    Object.values(api).forEach((fn: any) => fn.mockRejectedValue(new Error('down')));
    renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Nie udało się odczytać żadnego źródła sygnałów.'
    );
  });
});
