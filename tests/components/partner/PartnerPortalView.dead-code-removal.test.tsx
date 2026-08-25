/**
 * Module 19 MVP regression tests.
 *
 * Guards three cleanups that must not regress:
 *  1. The dead, hardcoded `PerformanceSection` (score "85" / "Top 15% of
 *     partners") is gone — the real, API-wired `MetricsSection` is canonical.
 *  2. The dead, hardcoded `BillingSection` (mock invoices/licenses for the 503
 *     stub endpoints) is gone.
 *  3. `MetricsSection` renders the score breakdown from the API payload (not a
 *     hardcoded array), so the breakdown values are wired end-to-end.
 */

import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
vi.mock('../../../src/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../../src/services/api/v8', () => ({
  V8PartnerApi: {
    getConnection: vi.fn(),
    getReferralAnalytics: vi.fn(),
    getEarningsSummary: vi.fn(),
    getProgramStatus: vi.fn(),
  },
  shouldFallbackToLegacyPartner: () => false,
}));

import { Api } from '../../../src/services/api';
import { V8PartnerApi } from '../../../src/services/api/v8';
import { PartnerPortalViewNew } from '../../../src/views/partner/PartnerPortalView';

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '../../../src/views/partner/PartnerPortalView.tsx'),
  'utf8'
);

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
  </BrowserRouter>
);

describe('PartnerPortalView — dead-code removal (module 19 MVP)', () => {
  it('no longer defines the hardcoded PerformanceSection component', () => {
    expect(SOURCE).not.toContain('const PerformanceSection');
    expect(SOURCE).not.toContain('Top 15% of partners');
  });

  it('no longer defines the hardcoded BillingSection component (503 stub mocks)', () => {
    expect(SOURCE).not.toContain('const BillingSection');
  });

  it('does not reference the dead components anywhere', () => {
    expect(SOURCE).not.toContain('<PerformanceSection');
    expect(SOURCE).not.toContain('<BillingSection');
  });
});

describe('MetricsSection — API-wired score breakdown (module 19 MVP)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8PartnerApi.getReferralAnalytics).mockResolvedValue({
      analytics: {
        totalClicks: 10,
        uniqueClicks: 8,
        signups: 2,
        trials: 1,
        paidCustomers: 1,
        conversionRate: 20,
        clicksByDay: [],
        clicksBySource: [],
      },
      days: 30,
    } as any);
    vi.mocked(V8PartnerApi.getEarningsSummary).mockResolvedValue({
      earnings: {
        totalEarned: 0,
        totalPending: 0,
        totalApproved: 0,
        totalPaid: 0,
        thisMonth: 0,
        thisMonthCount: 0,
        lastMonth: 0,
        readyForPayout: 0,
        currency: 'EUR',
      },
    } as any);
    vi.mocked(V8PartnerApi.getProgramStatus).mockResolvedValue({
      lifecyclePhase: 'earn',
      payoutSettingsComplete: false,
      balances: {
        grossEarned: 0,
        paidOut: 0,
        heldAmount: 0,
        availableToPayout: 0,
        currency: 'EUR',
      },
      whatNext: [],
      hold: null,
    } as any);
  });

  it('renders the breakdown values returned by GET /api/partners/metrics', async () => {
    const breakdown = {
      clientAcquisition: 77,
      projectDelivery: 66,
      customerSatisfaction: 55,
      certificationProgress: 44,
    };

    vi.mocked(V8PartnerApi.getConnection).mockResolvedValue({ connected: true } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/metrics') {
        return {
          success: true,
          data: {
            revenue: { totalYTD: 0, change: 0, byMonth: [] },
            clients: { retention: 0, newThisQuarter: 0, churned: 0, avgProjectDuration: 0 },
            performance: { score: 61, breakdown, ranking: 'Governed runtime snapshot' },
            satisfaction: { score: 0, responses: 0, trend: 'flat' },
          },
        } as any;
      }
      // Other section fetches are irrelevant here.
      return { success: true, data: {} } as any;
    });

    render(
      <MemoryRouter initialEntries={['/?tab=metrics']}>
        <I18nextProvider i18n={i18n}>
          <PartnerPortalViewNew />
        </I18nextProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/api/partners/metrics');
    });

    // Values come straight from the API payload, proving the breakdown is wired
    // (and not the old hardcoded [90, 88, 92, 70] / "85" placeholder).
    await waitFor(() => {
      expect(screen.getByText('77%')).toBeInTheDocument();
    });
    expect(screen.getByText('66%')).toBeInTheDocument();
    expect(screen.getByText('55%')).toBeInTheDocument();
    expect(screen.getByText('44%')).toBeInTheDocument();
  });
});
