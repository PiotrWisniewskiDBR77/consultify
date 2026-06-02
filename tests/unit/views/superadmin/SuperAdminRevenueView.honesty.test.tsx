import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SuperAdminRevenueView } from '@/views/superadmin/SuperAdminRevenueView';

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

describe('SuperAdminRevenueView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.get).mockRejectedValue(new Error('Revenue backend down'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render all-source revenue failures as empty KPI cards or no-data tables', async () => {
    render(<SuperAdminRevenueView />);

    await waitFor(() => {
      expect(screen.getByText('Revenue dashboard unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Monthly Recurring Revenue')).not.toBeInTheDocument();
    expect(screen.queryByText('Tokens Consumed')).not.toBeInTheDocument();
    expect(screen.queryByText('No subscriptions yet')).not.toBeInTheDocument();
    expect(screen.queryByText('No revenue data available')).not.toBeInTheDocument();
    expect(screen.queryByText('Operational cost metrics unavailable')).not.toBeInTheDocument();
  });
});
