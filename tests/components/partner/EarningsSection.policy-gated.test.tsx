import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { V8PartnerApi } from '@/services/api/v8';
import { EarningsSection } from '@/views/partner/sections/EarningsSection';

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getEarningsSummary: vi.fn(),
    getCommissionTransactions: vi.fn(),
    getPayouts: vi.fn(),
    getProgramStatus: vi.fn(),
  },
  shouldFallbackToLegacyPartner: () => false,
}));

vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

describe('EarningsSection policy gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8PartnerApi.getEarningsSummary).mockRejectedValue(new Error('Policy disabled'));
    vi.mocked(V8PartnerApi.getCommissionTransactions).mockRejectedValue(
      new Error('Policy disabled')
    );
    vi.mocked(V8PartnerApi.getPayouts).mockRejectedValue(new Error('Policy disabled'));
    vi.mocked(V8PartnerApi.getProgramStatus).mockResolvedValue({
      lifecyclePhase: 'earn',
      partnerOrganizationStatus: 'active',
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

  it('renders the intentional economics gate instead of a retryable load error', async () => {
    render(<EarningsSection subsection="payouts" />);

    expect(await screen.findByText('Partner economics unavailable')).toBeInTheDocument();
    expect(screen.getByText(/AMD-PRT-ECONOMICS-002/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /try again|retry/i })).not.toBeInTheDocument();
  });
});
