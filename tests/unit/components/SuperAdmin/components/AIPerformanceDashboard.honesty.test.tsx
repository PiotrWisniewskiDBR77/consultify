import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIPerformanceDashboard } from '@/views/superadmin/components/AIPerformanceDashboard';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const okJson = (body: unknown) =>
  ({
    ok: true,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

const failJson = (body: unknown) =>
  ({
    ok: false,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

const mockPerformanceFetches = () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      okJson({
        totalCalls: 10,
        totalTokens: 5000,
        errorRate: 2,
        avgLatency: 1200,
        byDay: [{ date: '2026-04-26', calls: 10 }],
      })
    )
    .mockResolvedValueOnce(
      okJson({
        logs: [
          {
            provider: 'openrouter',
            model: 'gpt-4o',
            prompt: 'analysis',
            tokens: 500,
            latency: 1200,
          },
        ],
      })
    )
    .mockResolvedValueOnce(
      okJson({
        totalCost: 1.25,
        byProvider: {
          openrouter: { tokens: 500, cost: 0.25 },
        },
      })
    );
};

describe('AIPerformanceDashboard honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    window.localStorage.setItem('token', 'test-token');
  });

  it('does not render failed performance sources as zero KPI cards', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(failJson({ error: 'Analytics down' }))
      .mockResolvedValueOnce(okJson({ logs: [] }))
      .mockResolvedValueOnce(okJson({ totalCost: 0, byProvider: {} }));

    render(<AIPerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI performance metrics unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load performance metrics')).toBeInTheDocument();
    expect(screen.queryByText('Avg Response')).not.toBeInTheDocument();
    expect(screen.queryByText('System Health')).not.toBeInTheDocument();
  });

  it('renders real performance data only after all critical sources load', async () => {
    mockPerformanceFetches();

    render(<AIPerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Avg Response')).toBeInTheDocument();
    });

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('$1.25')).toBeInTheDocument();
    expect(screen.getByText('analysis')).toBeInTheDocument();
    expect(screen.getByText('gpt-4o')).toBeInTheDocument();
    expect(screen.queryByText('AI performance metrics unavailable')).not.toBeInTheDocument();
  });

  it('accepts deep wrapped performance source payloads', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        okJson({
          data: {
            data: {
              totalCalls: '10',
              totalTokens: '5000',
              errorRate: '2',
              avgLatency: '1200',
              byDay: [{ date: '2026-04-26', calls: '10' }],
            },
          },
        })
      )
      .mockResolvedValueOnce(
        okJson({
          data: {
            data: {
              logs: [
                {
                  provider: 'openrouter',
                  model: 'gpt-4o',
                  prompt: 'analysis',
                  tokens: '500',
                  latency: '1200',
                },
              ],
            },
          },
        })
      )
      .mockResolvedValueOnce(
        okJson({
          data: {
            data: {
              totalCost: '1.25',
              byProvider: {
                openrouter: { tokens: '500', cost: '0.25' },
              },
            },
          },
        })
      );

    render(<AIPerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Avg Response')).toBeInTheDocument();
    });
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('$1.25')).toBeInTheDocument();
    expect(screen.getByText('analysis')).toBeInTheDocument();
  });

  it('does not render malformed performance logs as zero KPI cards', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        okJson({
          totalCalls: 10,
          totalTokens: 5000,
          errorRate: 2,
          avgLatency: 1200,
          byDay: [],
        })
      )
      .mockResolvedValueOnce(okJson({ logs: { unexpected: true } }))
      .mockResolvedValueOnce(okJson({ totalCost: 1.25, byProvider: {} }));

    render(<AIPerformanceDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI performance metrics unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Performance logs response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('Avg Response')).not.toBeInTheDocument();
  });
});
