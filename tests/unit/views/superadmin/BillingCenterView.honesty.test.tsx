import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { BillingCenterView } from '@/views/superadmin/BillingCenterView';

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
    getLLMProviders: vi.fn(),
    getTokenPackages: vi.fn(),
    getBillingMargins: vi.fn(),
    getTokenBalance: vi.fn(),
    getManagedContracts: vi.fn(),
    upsertManualContract: vi.fn(),
  },
}));

describe('BillingCenterView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.get).mockRejectedValue(new Error('Billing backend down'));
    vi.mocked(Api.getLLMProviders).mockRejectedValue(new Error('Providers down'));
    vi.mocked(Api.getTokenPackages).mockRejectedValue(new Error('Packages down'));
    vi.mocked(Api.getBillingMargins).mockRejectedValue(new Error('Margins down'));
    vi.mocked(Api.getTokenBalance).mockRejectedValue(new Error('Balance down'));
    vi.mocked(Api.getManagedContracts).mockRejectedValue(new Error('Contracts down'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render billing overview, plan, or transaction load failures as empty commercial data', async () => {
    render(<BillingCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Billing overview unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Monthly Recurring Revenue')).not.toBeInTheDocument();
    expect(screen.queryByText('No subscriptions yet')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Subscription Plans/i }));

    await waitFor(() => {
      expect(screen.getByText('Organization plans unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText(/organization plans.*found/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Plan/i })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Transactions/i }));

    await waitFor(() => {
      expect(screen.getByText('Billing transactions unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('No transactions found')).not.toBeInTheDocument();
  });

  it('does not render token economy or managed contract load failures as zeros or empty contracts', async () => {
    render(<BillingCenterView />);

    await waitFor(() => {
      expect(screen.getByText('Billing overview unavailable')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Token Economy/i }));

    await waitFor(() => {
      expect(screen.getByText('Token economy metrics unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('Active AI Models')).not.toBeInTheDocument();
    expect(screen.queryByText('System Balance')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Manual Contracts/i }));

    await waitFor(() => {
      expect(screen.getByText('Managed contracts unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('No manual contracts configured yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Contract/i })).toBeDisabled();
  });
});
