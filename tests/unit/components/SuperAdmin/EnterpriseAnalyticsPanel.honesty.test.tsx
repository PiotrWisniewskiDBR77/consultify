import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseAnalyticsPanel } from '@/components/SuperAdmin/system/EnterpriseAnalyticsPanel';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getSystemAnalytics: vi.fn(),
    getAnalyticsReports: vi.fn(),
  },
}));

describe('EnterpriseAnalyticsPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.getSystemAnalytics).mockRejectedValue(new Error('Analytics backend down'));
    vi.mocked(Api.getAnalyticsReports).mockRejectedValue(
      new Error('Scheduled reports backend down')
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render analytics load failures as zero dashboards or downloadable reports', async () => {
    render(<EnterpriseAnalyticsPanel />);

    await waitFor(() => {
      expect(screen.getByText('Analytics dashboard unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('API Requests')).not.toBeInTheDocument();
    expect(screen.queryByText('AI Requests')).not.toBeInTheDocument();
    expect(screen.queryByText('Performance Breakdown')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Generate Report/i }));

    await waitFor(() => {
      expect(screen.getByText('Report generation unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('Custom Report Builder')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Scheduled Reports/i }));

    await waitFor(() => {
      expect(screen.getByText('Scheduled reports unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('No scheduled reports')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schedule Report/i })).toBeDisabled();
  });

  it('marks missing chart and performance fields as unavailable instead of generated zero data', async () => {
    vi.mocked(Api.getSystemAnalytics).mockResolvedValue({
      metrics: {
        api: { total_requests: 42, change: 1 },
        ai: { total_requests: 7, change: 2 },
        users: { active_today: 3 },
        database: { total_queries: 99 },
      },
      charts: {},
    });
    vi.mocked(Api.getAnalyticsReports).mockResolvedValue([]);

    render(<EnterpriseAnalyticsPanel />);

    await waitFor(() => {
      expect(screen.getByText('API Requests')).toBeInTheDocument();
    });

    expect(screen.getByText('API traffic chart unavailable')).toBeInTheDocument();
    expect(screen.getByText('AI usage chart unavailable')).toBeInTheDocument();
    expect(screen.getByText('Performance breakdown unavailable')).toBeInTheDocument();
    expect(screen.queryByText('/api/projects')).not.toBeInTheDocument();
    expect(screen.queryByText('< 100ms')).not.toBeInTheDocument();
  });
});
