import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PerformanceMetricsTab } from '@/views/superadmin/AIPlatformModule/Analytics/PerformanceMetricsTab';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getAIOperationsPerformanceMetrics: vi.fn(),
    getAIOperationsPerformanceTrends: vi.fn(),
    getMissionControlProviders: vi.fn(),
    getLLMHealthDetailed: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

const metricsPayload = {
  data: {
    avgLatency: 450,
    successRate: '99.5',
    avgTokens: 320,
    totalRequests: 1200,
  },
};

const trendsPayload = {
  data: [
    { timestamp: '2026-04-25T10:00:00.000Z', avgLatency: 500, requests: 1000, successRate: '99.0' },
    { timestamp: '2026-04-26T10:00:00.000Z', avgLatency: 450, requests: 1200, successRate: '99.5' },
  ],
};

describe('PerformanceMetricsTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAIOperationsPerformanceMetrics).mockResolvedValue(metricsPayload);
    vi.mocked(Api.getAIOperationsPerformanceTrends).mockResolvedValue(trendsPayload);
    vi.mocked(Api.getMissionControlProviders).mockResolvedValue({
      data: [{ name: 'OpenRouter', avg_latency_ms: 450 }],
    });
    vi.mocked(Api.getLLMHealthDetailed).mockResolvedValue({
      providers: [{ name: 'OpenRouter', status: 'healthy', responseTime: 420 }],
      alerts: [{ severity: 'warning', title: 'Latency spike', description: 'p95 increased' }],
    });
  });

  it('does not render failed critical performance sources as empty metrics', async () => {
    vi.mocked(Api.getAIOperationsPerformanceMetrics).mockRejectedValue(
      new Error('Metrics API down')
    );

    render(<PerformanceMetricsTab />);

    await waitFor(() => {
      expect(screen.getByText('Performance metrics unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Metrics API down')).toBeInTheDocument();
    expect(screen.queryByText('Average Response Time')).not.toBeInTheDocument();
    expect(screen.queryByText('Provider Performance')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });

  it('shows degraded alerts when health alerts are unavailable without faking no alerts', async () => {
    vi.mocked(Api.getLLMHealthDetailed).mockRejectedValue(new Error('Health API down'));

    render(<PerformanceMetricsTab />);

    await waitFor(() => {
      expect(screen.getByText('Average Response Time')).toBeInTheDocument();
    });

    expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    expect(screen.getAllByText('n/a').length).toBeGreaterThan(0);
    expect(screen.getByText('Performance alerts unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No active alerts.')).not.toBeInTheDocument();
  });

  it('accepts deep wrapped metrics, trends, providers, and health payloads', async () => {
    vi.mocked(Api.getAIOperationsPerformanceMetrics).mockResolvedValue({
      data: { data: metricsPayload.data },
    });
    vi.mocked(Api.getAIOperationsPerformanceTrends).mockResolvedValue({
      data: { data: trendsPayload.data },
    });
    vi.mocked(Api.getMissionControlProviders).mockResolvedValue({
      data: { data: [{ name: 'OpenRouter', avg_latency_ms: '450' }] },
    });
    vi.mocked(Api.getLLMHealthDetailed).mockResolvedValue({
      data: {
        data: {
          providers: [{ name: 'OpenRouter', status: 'healthy', responseTime: '420' }],
          alerts: [{ severity: 'warning', title: 'Latency spike', description: 'p95 increased' }],
        },
      },
    });

    render(<PerformanceMetricsTab />);

    await waitFor(() => {
      expect(screen.getByText('Average Response Time')).toBeInTheDocument();
    });
    expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    expect(screen.getByText('Latency spike')).toBeInTheDocument();
  });

  it('does not render malformed hard metrics payloads as zero metrics', async () => {
    vi.mocked(Api.getAIOperationsPerformanceMetrics).mockResolvedValue({
      data: { avgLatency: 0 },
    });

    render(<PerformanceMetricsTab />);

    await waitFor(() => {
      expect(screen.getByText('Performance metrics unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Performance metrics response was incomplete')).toBeInTheDocument();
    expect(screen.queryByText('Average Response Time')).not.toBeInTheDocument();
  });
});
