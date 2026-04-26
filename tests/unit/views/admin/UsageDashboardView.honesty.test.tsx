import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { UsageDashboardView } from '@/views/admin/UsageDashboardView';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('UsageDashboardView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
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

  it('does not render failed usage loads as zero metrics or empty breakdowns', async () => {
    render(<UsageDashboardView />);

    await waitFor(() => {
      expect(screen.getByText('Usage dashboard unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('AI Tokens')).not.toBeInTheDocument();
    expect(screen.queryByText('No usage data available')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: '7d' })).toBeDisabled();
  });
});
