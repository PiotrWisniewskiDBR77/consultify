import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CustomReportsTab } from '@/views/superadmin/AIPlatformModule/Analytics/CustomReportsTab';
import Api from '@/services/api';

vi.mock('@/services/api', () => {
  const api = {
    getAnalyticsReports: vi.fn(),
    getReportExecutions: vi.fn(),
    createAnalyticsReport: vi.fn(),
    deleteAnalyticsReport: vi.fn(),
    executeAnalyticsReport: vi.fn(),
    scheduleAnalyticsReport: vi.fn(),
  };
  return { default: api, Api: api };
});

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

const report = {
  id: 'report_1',
  name: 'AI Usage Weekly',
  description: 'Usage report',
  report_type: 'ai_usage',
  filters_json: '{}',
  columns_json: '[]',
  created_by_email: 'admin@example.com',
  execution_count: 1,
  last_executed_at: '2026-04-26T10:00:00.000Z',
  created_at: '2026-04-26T09:00:00.000Z',
  updated_at: '2026-04-26T09:00:00.000Z',
};

describe('CustomReportsTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAnalyticsReports).mockResolvedValue([report]);
    vi.mocked(Api.getReportExecutions).mockResolvedValue([]);
    vi.mocked(Api.createAnalyticsReport).mockResolvedValue({ success: true });
  });

  it('does not render report load failures as an empty saved reports list', async () => {
    vi.mocked(Api.getAnalyticsReports).mockRejectedValue(new Error('Reports API down'));

    render(<CustomReportsTab />);

    await waitFor(() => {
      expect(screen.getByText('Saved reports unavailable')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Reports API down').length).toBeGreaterThan(0);
    expect(screen.queryByText('No reports yet. Create one to get started.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New Report' })).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('refetches reports after creating a custom report', async () => {
    vi.mocked(Api.getAnalyticsReports)
      .mockResolvedValueOnce([report])
      .mockResolvedValueOnce([
        report,
        {
          ...report,
          id: 'report_2',
          name: 'Monthly Users',
          report_type: 'users',
        },
      ]);

    render(<CustomReportsTab />);

    await waitFor(() => {
      expect(screen.getByText('AI Usage Weekly')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'New Report' }));
    fireEvent.change(screen.getByPlaceholderText('Monthly Users Report'), {
      target: { value: 'Monthly Users' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create Report' }));

    await waitFor(() => {
      expect(Api.createAnalyticsReport).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Monthly Users',
          report_type: 'users',
        })
      );
    });

    await waitFor(() => {
      expect(Api.getAnalyticsReports).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('Monthly Users')).toBeInTheDocument();
  });
});
