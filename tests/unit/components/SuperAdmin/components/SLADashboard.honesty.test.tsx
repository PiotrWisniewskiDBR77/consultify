import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SLADashboard } from '@/views/superadmin/components/SLADashboard';

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

const mockSLAFetches = () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(
      okJson({
        totalCalls: 1000,
        errorRate: 0.05,
        avgLatency: 800,
        byDay: [{ date: '2026-04-26', calls: 1000 }],
      })
    )
    .mockResolvedValueOnce(
      okJson({
        logs: [
          { latency: 800 },
          { latency: 1200 },
          { latency: 2000 },
        ],
      })
    );
};

describe('SLADashboard honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
    window.localStorage.setItem('token', 'test-token');
  });

  it('does not render failed SLA sources as synthetic compliance metrics', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(okJson({ totalCalls: 0, errorRate: 0, byDay: [] }))
      .mockResolvedValueOnce(failJson({ error: 'Logs down' }));

    render(<SLADashboard />);

    await waitFor(() => {
      expect(screen.getByText('SLA metrics unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load SLA logs')).toBeInTheDocument();
    expect(screen.queryByText('SLA Compliant')).not.toBeInTheDocument();
    expect(screen.queryByText('Request Statistics')).not.toBeInTheDocument();
    expect(screen.queryByText('No SLA breaches recorded in this period')).not.toBeInTheDocument();
  });

  it('renders SLA compliance only from loaded analytics and log data', async () => {
    mockSLAFetches();

    render(<SLADashboard />);

    await waitFor(() => {
      expect(screen.getByText('SLA Compliant')).toBeInTheDocument();
    });

    expect(screen.getAllByText('99.950%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1,000').length).toBeGreaterThan(0);
    expect(screen.getByText('No SLA breaches recorded in this period')).toBeInTheDocument();
    expect(screen.queryByText('SLA Breach Detected')).not.toBeInTheDocument();
  });

  it('accepts deep wrapped analytics and logs payloads', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        okJson({
          data: {
            data: {
              totalCalls: '1000',
              errorRate: '0.05',
              avgLatency: '800',
              byDay: [{ date: '2026-04-26' }],
            },
          },
        })
      )
      .mockResolvedValueOnce(
        okJson({
          data: {
            data: {
              logs: [{ latency: '800' }, { latency: '1200' }, { latency: '2000' }],
            },
          },
        })
      );

    render(<SLADashboard />);

    await waitFor(() => {
      expect(screen.getByText('SLA Compliant')).toBeInTheDocument();
    });
    expect(screen.getAllByText('99.950%').length).toBeGreaterThan(0);
  });

  it('does not render malformed SLA logs as synthetic compliance', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(
        okJson({
          totalCalls: 1000,
          errorRate: 0,
          avgLatency: 800,
          byDay: [],
        })
      )
      .mockResolvedValueOnce(okJson({ logs: { unexpected: true } }));

    render(<SLADashboard />);

    await waitFor(() => {
      expect(screen.getByText('SLA metrics unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('SLA logs response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('SLA Compliant')).not.toBeInTheDocument();
  });
});
