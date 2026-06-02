import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingCenterView } from '@/views/superadmin/BillingCenterView';
import { Api } from '@/services/api';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/components/billing', () => ({
  SubscriptionAnalytics: () => <div>Subscription analytics</div>,
}));

vi.mock('@/views/admin/AdminLLMMultipliers', () => ({
  AdminLLMMultipliers: () => <div>LLM multipliers</div>,
}));

vi.mock('@/views/admin/AdminMarginConfig', () => ({
  AdminMarginConfig: () => <div>Margin config</div>,
}));

vi.mock('@/views/admin/AdminTokenPackages', () => ({
  AdminTokenPackages: () => <div>Token packages</div>,
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

const mockBillingGet = (costsResult: unknown) => {
  vi.mocked(Api.get).mockImplementation(async (path: string) => {
    if (path === '/billing/admin/revenue') {
      return {
        mrr: 1000,
        arr: 12000,
        activeSubscriptions: 2,
        planDistribution: [],
      };
    }
    if (path === '/billing/admin/usage') {
      return {
        totalTokensThisMonth: 100,
        totalStorageGB: 1,
        activeOrganizations: 1,
      };
    }
    if (path === '/billing/admin/operational-costs') {
      if (costsResult instanceof Error) {
        throw costsResult;
      }
      return costsResult;
    }
    return null;
  });
};

describe('BillingCenterView operational costs honesty', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows unavailable state instead of no-data when operational costs fail to load', async () => {
    mockBillingGet(new Error('cost service down'));

    render(<BillingCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Operational cost metrics unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Billing metrics degraded')).toBeInTheDocument();
    expect(screen.queryByText('No operational cost records yet')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Operational Cost')).not.toBeInTheDocument();
  });

  it('shows a no-records state without rendering a false zero total', async () => {
    mockBillingGet({ items: [], totalCost: 0 });

    render(<BillingCenterView />);

    await waitFor(() => {
      expect(screen.getByText('No operational cost records yet')).toBeInTheDocument();
    });

    expect(screen.queryByText('Operational cost metrics unavailable')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Operational Cost')).not.toBeInTheDocument();
  });
});
