import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseFeatureFlags } from '@/components/SuperAdmin/system/EnterpriseFeatureFlags';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getFeatureFlags: vi.fn(),
    toggleFeatureFlag: vi.fn(),
    deleteFeatureFlag: vi.fn(),
    createFeatureFlag: vi.fn(),
    updateFeatureFlag: vi.fn(),
    getFeatureFlagHistory: vi.fn(),
  },
}));

const featureFlag = {
  id: 'flag-1',
  flag_key: 'new_checkout',
  name: 'New Checkout',
  enabled: false,
  flag_type: 'boolean',
  targeting_rules: [],
  rollout_percentage: 100,
  environment: 'production',
  created_at: 'not-a-date',
  updated_at: 'not-a-date',
};

describe('EnterpriseFeatureFlags honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('confirm', vi.fn(() => true));

    vi.mocked(Api.getFeatureFlags).mockRejectedValue(new Error('Feature flags backend down'));
    vi.mocked(Api.getFeatureFlagHistory).mockResolvedValue([]);
    vi.mocked(Api.createFeatureFlag).mockResolvedValue({ id: 'flag-1' });
    vi.mocked(Api.updateFeatureFlag).mockResolvedValue({ success: true });
    vi.mocked(Api.toggleFeatureFlag).mockResolvedValue({ success: true });
    vi.mocked(Api.deleteFeatureFlag).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render feature flag load failures as zero flag stats or an empty flag list', async () => {
    render(<EnterpriseFeatureFlags />);

    await waitFor(() => {
      expect(screen.getByText('Feature flag overview unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Feature flags unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Total Flags')).not.toBeInTheDocument();
    expect(screen.queryByText('No feature flags found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Flag/i })).toBeDisabled();
    expect(screen.getByPlaceholderText('Search flags...')).toBeDisabled();
  });

  it('does not render failed feature flag history loads as no history available', async () => {
    vi.mocked(Api.getFeatureFlags).mockResolvedValue([featureFlag]);
    vi.mocked(Api.getFeatureFlagHistory).mockRejectedValue(new Error('History backend down'));

    render(<EnterpriseFeatureFlags />);

    await waitFor(() => {
      expect(screen.getByText('New Checkout')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /View history for New Checkout/i }));

    await waitFor(() => {
      expect(screen.getByText('Feature flag history unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('No history available')).not.toBeInTheDocument();
  });

  it('keeps create modal open when feature flag creation read-back is stale', async () => {
    vi.mocked(Api.getFeatureFlags).mockResolvedValue([]);

    render(<EnterpriseFeatureFlags />);

    await screen.findByText('No feature flags found');
    fireEvent.click(screen.getByRole('button', { name: /Create Flag/i }));
    fireEvent.change(screen.getByPlaceholderText('new_feature'), {
      target: { value: 'new_checkout' },
    });
    fireEvent.change(screen.getByLabelText('Flag Name'), {
      target: { value: 'New Checkout' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('alert')
          .some((alert) =>
            alert.textContent?.includes('Feature flag creation was not confirmed by the server')
          )
      ).toBe(true);
    });
    expect(screen.getByPlaceholderText('new_feature')).toBeInTheDocument();
  });

  it('keeps create modal open when feature flag creation response has no id', async () => {
    vi.mocked(Api.getFeatureFlags).mockResolvedValue([]);
    vi.mocked(Api.createFeatureFlag).mockResolvedValue({ success: true });

    render(<EnterpriseFeatureFlags />);

    await screen.findByText('No feature flags found');
    fireEvent.click(screen.getByRole('button', { name: /Create Flag/i }));
    fireEvent.change(screen.getByPlaceholderText('new_feature'), {
      target: { value: 'new_checkout' },
    });
    fireEvent.change(screen.getByLabelText('Flag Name'), {
      target: { value: 'New Checkout' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(
        screen
          .getAllByRole('alert')
          .some((alert) =>
            alert.textContent?.includes('Feature flag creation response was incomplete')
          )
      ).toBe(true);
    });
    expect(screen.getByPlaceholderText('new_feature')).toBeInTheDocument();
  });

  it('does not toggle or delete feature flags when read-back remains stale', async () => {
    vi.mocked(Api.getFeatureFlags).mockResolvedValue([featureFlag]);

    render(<EnterpriseFeatureFlags />);

    await screen.findByText('New Checkout');
    fireEvent.click(screen.getByRole('button', { name: /Enable New Checkout/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Feature flag toggle was not confirmed by the server'
      );
    });
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('New Checkout'));
    expect(screen.getAllByText('Unknown date').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /Delete New Checkout/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Feature flag deletion was not confirmed by the server'
      );
    });
    expect(screen.getByText('New Checkout')).toBeInTheDocument();
  });

  it('accepts wrapped feature flag payloads and renders unknown types safely', async () => {
    vi.mocked(Api.getFeatureFlags).mockResolvedValue({
      flags: [{ ...featureFlag, flag_type: 'unexpected' }],
    });

    render(<EnterpriseFeatureFlags />);

    expect(await screen.findByText('New Checkout')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
