import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getOrganizationContextQuotaCopy } from '@/utils/organizationContextQuotaCopy';
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
  const usageSummary = {
    currentPeriod: {
      start: '2026-05-01T00:00:00.000Z',
      end: '2026-05-31T23:59:59.999Z',
      daysElapsed: 3,
      daysRemaining: 28,
    },
    tokens: {
      used: 1000,
      limit: 10000,
      percentage: 10,
      trend: 0,
      requests: 12,
    },
    storage: {
      used: 4600,
      usedFormatted: '4.6 GB',
      limit: 5000,
      limitFormatted: '5 GB',
      percentage: 92,
    },
    seats: {
      used: 4,
      limit: 10,
      percentage: 40,
    },
    cost: {
      current: 25,
      projected: 50,
      planBase: 99,
    },
    breakdown: {
      byUser: [],
      byProject: [],
      byFeature: [],
    },
    trend: [],
    projectedUsage: 2000,
  };

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

  const renderView = () =>
    render(
      <MemoryRouter>
        <UsageDashboardView />
      </MemoryRouter>
    );

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not render failed usage loads as zero metrics or empty breakdowns', async () => {
    renderView();

    await waitFor(() => {
      expect(screen.getByText('Usage dashboard unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('AI Tokens')).not.toBeInTheDocument();
    expect(screen.queryByText('No usage data available')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: '7d' })).toBeDisabled();
  });

  it('renders organization context quota copy for high storage usage', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => usageSummary,
    } as Response);

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Organization Context Storage')).toBeInTheDocument();
    });
    expect(screen.getByText('Organization context storage is critical')).toBeInTheDocument();
    expect(screen.getByText(/Uploads may be blocked soon/)).toBeInTheDocument();
    expect(screen.getByText(/Interview Insight Creator/)).toBeInTheDocument();
    expect(screen.getAllByText('92% used').length).toBeGreaterThan(0);
  });

  it('uses explicit blocked copy at quota exhaustion instead of implying processing success', () => {
    const copy = getOrganizationContextQuotaCopy(100);

    expect(copy.title).toBe('Organization context uploads are blocked');
    expect(copy.description).toContain('quota_blocked metadata only');
    expect(copy.description).toContain('not processed, indexed, or available to AI');
  });
});
