import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SpendingAlertsView } from '@/views/admin/SpendingAlertsView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1' },
    currentUser: { email: 'admin@example.com' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getUsage: vi.fn(),
  },
}));

describe('SpendingAlertsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getUsage).mockRejectedValue(new Error('Usage backend down'));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not render failed usage and alert loads as blank usage cards or no alerts configured', async () => {
    render(<SpendingAlertsView />);

    await waitFor(() => {
      expect(screen.getByText('Spending alerts unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Usage data unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No Alerts Configured')).not.toBeInTheDocument();
    expect(screen.queryByText('--')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Alert/i })).toBeDisabled();
  });
});
