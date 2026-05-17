import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SavedReportsView from '@/views/superadmin/analytics/SavedReportsView';
import Api from '@/services/api';

vi.mock('@/services/api', () => ({
  default: {
    getAnalyticsReports: vi.fn(),
    getReportExecutions: vi.fn(),
    createAnalyticsReport: vi.fn(),
    deleteAnalyticsReport: vi.fn(),
    executeAnalyticsReport: vi.fn(),
    scheduleAnalyticsReport: vi.fn(),
  },
}));

const report = {
  id: 'report-1',
  name: 'Weekly Users',
  description: 'Users',
  report_type: 'users',
  filters_json: '{}',
  columns_json: '[]',
  execution_count: 0,
  last_executed_at: 'not-a-date',
  created_at: '2026-04-26T00:00:00.000Z',
  updated_at: '2026-04-26T00:00:00.000Z',
};

describe('SavedReportsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(Api.getAnalyticsReports).mockResolvedValue([]);
    vi.mocked(Api.getReportExecutions).mockResolvedValue([]);
    vi.mocked(Api.createAnalyticsReport).mockResolvedValue({ success: true });
    vi.mocked(Api.deleteAnalyticsReport).mockResolvedValue({ success: true });
    vi.mocked(Api.scheduleAnalyticsReport).mockResolvedValue({ success: true });
  });

  it('does not render report load failures as an empty saved report list', async () => {
    vi.mocked(Api.getAnalyticsReports).mockRejectedValue(new Error('Reports backend down'));

    render(<SavedReportsView />);

    await screen.findByText('Saved reports unavailable');

    expect(screen.getAllByText('Reports backend down').length).toBeGreaterThan(0);
    expect(screen.queryByText('No reports yet. Create one to get started.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Report/i })).toBeDisabled();
  });

  it('keeps create modal open when report creation read-back is stale', async () => {
    render(<SavedReportsView />);

    await screen.findByText('No reports yet. Create one to get started.');
    fireEvent.click(screen.getByRole('button', { name: /New Report/i }));
    fireEvent.change(screen.getByPlaceholderText('Monthly Users Report'), {
      target: { value: 'Users Report' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Report/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Report creation was not confirmed by the server'
      );
    });
    expect(screen.getByPlaceholderText('Monthly Users Report')).toBeInTheDocument();
  });

  it('does not delete or schedule reports when read-back remains stale', async () => {
    vi.mocked(Api.getAnalyticsReports).mockResolvedValue([report]);

    render(<SavedReportsView />);

    await screen.findByText('Weekly Users');
    fireEvent.click(screen.getByText('Weekly Users'));
    await waitFor(() => {
      expect(Api.getReportExecutions).toHaveBeenCalledWith('report-1');
    });
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Schedule/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Schedule/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Report schedule was not confirmed by the server'
      );
    });
    expect(screen.getByText('Schedule Report')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    fireEvent.click(screen.getByRole('button', { name: /Delete report Weekly Users/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Report deletion was not confirmed by the server'
      );
    });
    expect(screen.getAllByText('Weekly Users').length).toBeGreaterThan(0);
  });

  it('accepts wrapped report and execution payloads with nested create and execute responses', async () => {
    vi.mocked(Api.getAnalyticsReports)
      .mockResolvedValueOnce({ data: { data: { reports: [] } } })
      .mockResolvedValueOnce({ data: { data: { reports: [report] } } })
      .mockResolvedValueOnce({ data: { data: { reports: [report] } } });
    vi.mocked(Api.createAnalyticsReport).mockResolvedValue({
      data: { data: { report: { id: 'report-1' } } },
    });
    vi.mocked(Api.getReportExecutions)
      .mockResolvedValueOnce({ data: { data: { executions: [] } } })
      .mockResolvedValueOnce({
        data: { data: { executions: [{ id: 'exec-1', report_id: 'report-1', status: 'completed', executed_at: 'not-a-date' }] } },
      });
    vi.mocked(Api.executeAnalyticsReport).mockResolvedValue({
      data: { data: { id: 'exec-1', data: [{ email: 'a@example.com' }], rowCount: 1 } },
    });

    render(<SavedReportsView />);

    await screen.findByText('No reports yet. Create one to get started.');
    fireEvent.click(screen.getByRole('button', { name: /New Report/i }));
    fireEvent.change(screen.getByPlaceholderText('Monthly Users Report'), {
      target: { value: 'Weekly Users' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Report/i }));

    await waitFor(() => {
      expect(screen.queryByText('Create New Report')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Weekly Users'));
    await waitFor(() => {
      expect(Api.getReportExecutions).toHaveBeenCalledWith('report-1');
    });
    fireEvent.click(screen.getByRole('button', { name: /Run Now/i }));

    expect(await screen.findByText('a@example.com')).toBeInTheDocument();
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
  });

  it('does not render malformed report payloads as an empty saved report list', async () => {
    vi.mocked(Api.getAnalyticsReports).mockResolvedValue({ unexpected: true });

    render(<SavedReportsView />);

    await screen.findByText('Saved reports unavailable');
    expect(screen.getAllByText('Saved reports response was not a list').length).toBeGreaterThan(0);
    expect(screen.queryByText('No reports yet. Create one to get started.')).not.toBeInTheDocument();
  });

  it('does not claim delete success when report read-back is unavailable', async () => {
    vi.mocked(Api.getAnalyticsReports)
      .mockResolvedValueOnce([report])
      .mockRejectedValueOnce(new Error('Read-back failed'));

    render(<SavedReportsView />);

    await screen.findByText('Weekly Users');
    fireEvent.click(screen.getByText('Weekly Users'));
    fireEvent.click(screen.getByRole('button', { name: /Delete report Weekly Users/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Report deletion was not confirmed by the server'
      );
    });
  });
});
