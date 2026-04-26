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

describe('EnterpriseFeatureFlags honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.getFeatureFlags).mockRejectedValue(new Error('Feature flags backend down'));
    vi.mocked(Api.getFeatureFlagHistory).mockResolvedValue([]);
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
    vi.mocked(Api.getFeatureFlags).mockResolvedValue([
      {
        id: 'flag-1',
        flag_key: 'new_checkout',
        name: 'New Checkout',
        enabled: true,
        flag_type: 'boolean',
        targeting_rules: [],
        rollout_percentage: 100,
        environment: 'production',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);
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
});
