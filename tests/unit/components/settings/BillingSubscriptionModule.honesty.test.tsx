import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BillingSubscriptionModule } from '@/components/settings/modules/BillingSubscriptionModule';
import { Api } from '@/services/api';

const refreshPolicy = vi.fn();
const tMock = (key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key);

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/contexts/AccessPolicyContext', () => ({
  usePolicySnapshot: () => ({ snapshot: null, refresh: refreshPolicy }),
  useSubscriptionStatus: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    cancelSubscription: vi.fn(),
    changePlan: vi.fn(),
    get: vi.fn(),
    getSubscriptionPlans: vi.fn(),
    subscribeToPlan: vi.fn(),
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

const activeSubscription = {
  plan: 'pro',
  status: 'active',
  currentPeriodEnd: '2026-05-26T00:00:00.000Z',
  cancelAtPeriodEnd: false,
};

const mockBillingGets = (subscription = activeSubscription) => {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    if (url === '/api/billing/subscription') return { data: subscription };
    if (url === '/api/billing/usage') return { data: null };
    if (url === '/api/billing/invoices') return { data: [] };
    if (url === '/api/billing/payment-methods') return { data: [] };
    return { data: null };
  });
};

describe('BillingSubscriptionModule honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getSubscriptionPlans).mockResolvedValue([]);
  });

  it('does not render failed billing loads as an empty subscription state', async () => {
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/billing/subscription') throw new Error('Billing API down');
      return { data: null };
    });

    render(<BillingSubscriptionModule currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Billing data unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Billing API down')).toBeInTheDocument();
    expect(screen.queryByText('Cancel Subscription')).not.toBeInTheDocument();
  });

  it('does not claim cancellation success when read-back keeps subscription active', async () => {
    mockBillingGets();
    vi.mocked(Api.cancelSubscription).mockResolvedValue({ success: true });
    vi.stubGlobal('confirm', vi.fn(() => true));

    render(<BillingSubscriptionModule currentUser={user as any} onUpdateUser={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: /Cancel Subscription/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Subscription cancellation was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(refreshPolicy).not.toHaveBeenCalled();
  });
});
