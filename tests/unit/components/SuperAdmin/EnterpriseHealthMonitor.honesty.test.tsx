import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EnterpriseHealthMonitor } from '@/components/SuperAdmin/system/EnterpriseHealthMonitor';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getSystemHealth: vi.fn(),
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('EnterpriseHealthMonitor honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});

    vi.mocked(Api.getSystemHealth).mockRejectedValue(new Error('Health backend down'));
    vi.mocked(Api.get).mockRejectedValue(new Error('System health endpoint down'));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render health load failures as zero metrics or empty service data', async () => {
    render(<EnterpriseHealthMonitor />);

    await waitFor(() => {
      expect(screen.getByText('System health overview unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('System health unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Response time')).not.toBeInTheDocument();
    expect(screen.queryByText('Active providers')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Services/i }));
    expect(screen.getByText('Service health unavailable')).toBeInTheDocument();
    expect(screen.queryByText('API Server')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Metrics/i }));
    expect(screen.getByText('Health metrics unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Requests/min')).not.toBeInTheDocument();
  });

  it('does not render alert load failures as no alerts configured', async () => {
    render(<EnterpriseHealthMonitor />);

    await waitFor(() => {
      expect(screen.getByText('System health overview unavailable')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Alerts/i }));

    await waitFor(() => {
      expect(screen.getByText('Alert configuration unavailable')).toBeInTheDocument();
    });
    expect(screen.queryByText('No alerts configured')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Alert/i })).toBeDisabled();
  });
});
