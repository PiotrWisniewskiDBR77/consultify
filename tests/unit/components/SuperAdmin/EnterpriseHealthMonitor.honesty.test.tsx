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

const healthData = {
  api: { status: 'up', responseTime: 25, version: '1.0.0' },
  database: { status: 'up', responseTime: 10, type: 'postgres' },
  ai: { status: 'up', providers: { openai: true, anthropic: false, groq: false } },
  system: {
    nodeVersion: 'v20',
    environment: 'test',
    uptime: { seconds: 60, formatted: '1m' },
    memory: { used: 100, total: 200, percent: 50 },
    loadAvg: [0.1, 0.2, 0.3],
    cpus: 2,
  },
  timestamp: 'not-a-date',
};

const alert = {
  id: 'alert-1',
  name: 'CPU high',
  metric: 'cpu_usage',
  threshold: 90,
  operator: 'gt',
  enabled: true,
  channels: [],
};

const mockHealthyPayloads = (alertsPayload: unknown) => {
  vi.mocked(Api.get).mockImplementation(async (url: string) => {
    if (url === '/system-health/detailed') {
      return healthData;
    }
    if (url === '/system-health/services') {
      return {
        data: {
          api: { status: 'up', responseTime: 25 },
          database: { status: 'up', latency: 10 },
          ai: { status: 'up' },
          storage: { status: 'up' },
        },
      };
    }
    if (url === '/system-health/metrics') {
      return { data: { api: { requests_last_hour: 120 }, timestamp: 'not-a-date' } };
    }
    if (url === '/system-health/alerts') {
      return alertsPayload;
    }
    return {};
  });
};

describe('EnterpriseHealthMonitor honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('confirm', vi.fn(() => true));

    vi.mocked(Api.getSystemHealth).mockRejectedValue(new Error('Health backend down'));
    vi.mocked(Api.get).mockRejectedValue(new Error('System health endpoint down'));
    vi.mocked(Api.post).mockResolvedValue({ id: 'alert-2' });
    vi.mocked(Api.put).mockResolvedValue({ success: true });
    vi.mocked(Api.delete).mockResolvedValue({ success: true });
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

  it('keeps create alert form open when creation response has no id', async () => {
    mockHealthyPayloads([]);
    vi.mocked(Api.post).mockResolvedValue({ success: true });

    render(<EnterpriseHealthMonitor />);

    await screen.findByText('All systems operational');
    expect(Api.get).toHaveBeenCalledWith('/system-health/detailed');
    expect(Api.get).toHaveBeenCalledWith('/system-health/services');
    expect(Api.get).toHaveBeenCalledWith('/system-health/metrics');
    expect(Api.get).toHaveBeenCalledWith('/system-health/alerts');
    fireEvent.click(screen.getByRole('button', { name: /Alerts/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add Alert/i }));
    fireEvent.change(screen.getByPlaceholderText('Alert name'), {
      target: { value: 'CPU high' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Alert creation response was incomplete');
    });
    expect(screen.getByPlaceholderText('Alert name')).toBeInTheDocument();
  });

  it('does not claim alert create, toggle, or delete when read-back remains stale', async () => {
    mockHealthyPayloads([alert]);

    render(<EnterpriseHealthMonitor />);

    await screen.findByText('All systems operational');
    fireEvent.click(screen.getByRole('button', { name: /Alerts/i }));
    fireEvent.click(screen.getByRole('button', { name: /Add Alert/i }));
    fireEvent.change(screen.getByPlaceholderText('Alert name'), {
      target: { value: 'Memory high' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Alert creation was not confirmed by the server'
      );
    });
    expect(Api.post).toHaveBeenCalledWith('/system-health/alerts', expect.any(Object));

    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    fireEvent.click(screen.getByRole('button', { name: /Disable alert CPU high/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Alert toggle was not confirmed by the server'
      );
    });
    expect(Api.put).toHaveBeenCalledWith('/system-health/alerts/alert-1/toggle', {});

    fireEvent.click(screen.getByRole('button', { name: /Delete alert CPU high/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Alert deletion was not confirmed by the server'
      );
    });
    expect(Api.delete).toHaveBeenCalledWith('/system-health/alerts/alert-1');
    expect(screen.getByText('CPU high')).toBeInTheDocument();
  });

  it('accepts wrapped alert payloads and renders malformed alert fields safely', async () => {
    mockHealthyPayloads({
      data: {
        alerts: [
          {
            id: 'alert-1',
            name: 123,
            metric: null,
            threshold: 'bad',
            operator: 'unexpected',
            enabled: 'true',
          },
        ],
      },
    });

    render(<EnterpriseHealthMonitor />);

    await screen.findByText('All systems operational');
    fireEvent.click(screen.getByRole('button', { name: /Alerts/i }));

    expect(screen.getByText('123')).toBeInTheDocument();
    expect(screen.getByText(/Unknown\s*>\s*0/)).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
  });
});
