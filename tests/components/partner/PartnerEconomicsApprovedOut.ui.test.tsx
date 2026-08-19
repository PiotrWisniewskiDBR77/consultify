import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import PartnerProgramConfig from '@/views/superadmin/partners/PartnerProgramConfig';
import { PartnerSettlementsView } from '@/views/superadmin/revenue/PartnerSettlementsView';

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/services/api/v8/client', () => ({ v8Post: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : fallback?.defaultValue || _key,
    i18n: { language: 'en' },
  }),
}));

const summary = {
  totalPendingCommissions: 1,
  totalPendingPayouts: 1,
  pendingCommissionAmount: 100,
  pendingPayoutAmount: 90,
  thisMonthCommissions: 100,
  thisMonthPayouts: 90,
};

function configureReads() {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    if (url.endsWith('/review-queue')) return { success: true, data: [] } as any;
    if (url.endsWith('/applications')) return { success: true, data: [] } as any;
    if (url.endsWith('/reporting')) return { success: true, data: {} } as any;
    if (url.endsWith('/summary')) return { success: true, data: summary } as any;
    if (url.endsWith('/pending-commissions'))
      return {
        success: true,
        data: [
          {
            id: 'commission-1',
            partnerOrgId: 'partner-1',
            partnerName: 'Partner One',
            organizationId: 'org-1',
            organizationName: 'Customer One',
            transactionType: 'subscription',
            transactionDate: '2026-08-19T00:00:00.000Z',
            grossAmount: 100,
            commissionRate: 10,
            commissionAmount: 10,
            currency: 'EUR',
            status: 'PENDING',
            createdAt: '2026-08-19T00:00:00.000Z',
          },
        ],
      } as any;
    if (url.endsWith('/pending-payouts'))
      return {
        success: true,
        data: [
          {
            id: 'payout-1',
            partnerOrgId: 'partner-1',
            partnerName: 'Partner One',
            periodStart: '2026-08-01',
            periodEnd: '2026-08-31',
            grossAmount: 100,
            fees: 10,
            netAmount: 90,
            currency: 'EUR',
            transactionCount: 1,
            status: 'PENDING',
            requestedAt: '2026-08-19T00:00:00.000Z',
          },
        ],
      } as any;
    if (url.endsWith('/attributions')) return { success: true, data: [] } as any;
    if (url.includes('/expiring-attributions')) return { success: true, data: [] } as any;
    if (url.includes('/code-analytics')) return { success: true, data: [] } as any;
    throw new Error(`Unexpected GET ${url}`);
  });
}

describe('Partner economics approved-out UI', () => {
  beforeEach(() => configureReads());

  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  it('keeps operator review while hiding commission, discount and payout authoring', async () => {
    render(<PartnerProgramConfig />);

    expect(await screen.findByText('Partner economics are read-only')).toBeInTheDocument();
    expect(screen.getByText(/AMD-PRT-ECONOMICS-002/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save discount settings/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /save payout settings/i })).toBeNull();
    expect(screen.queryByText('Commission Rates by Tier')).toBeNull();
    expect(Api.put).not.toHaveBeenCalled();
    expect(Api.delete).not.toHaveBeenCalled();
  });

  it('renders settlement history without any approved-out mutation affordance', async () => {
    render(<PartnerSettlementsView />);

    expect(await screen.findByText('Partner economics are read-only')).toBeInTheDocument();
    expect(screen.getByText(/AMD-PRT-ECONOMICS-002/)).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText('Partner One').length).toBeGreaterThan(0));
    expect(screen.queryByRole('button', { name: /^approve/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^process$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /^complete$/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /remove attribution/i })).toBeNull();
    expect(Api.post).not.toHaveBeenCalled();
    expect(Api.put).not.toHaveBeenCalled();
    expect(Api.delete).not.toHaveBeenCalled();
  });
});
