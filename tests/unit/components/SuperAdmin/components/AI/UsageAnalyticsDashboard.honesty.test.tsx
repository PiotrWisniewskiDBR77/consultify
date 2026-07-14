import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UsageAnalyticsDashboard } from '@/views/superadmin/components/AI/UsageAnalyticsDashboard';

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const jsonResponse = (body: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

const analyticsPayload = {
  totalTokens: 5000,
  totalCalls: 1200,
  avgLatency: 0.45,
  byDay: [
    { date: '2026-04-25', calls: 500, tokens: 2000 },
    { date: '2026-04-26', calls: 700, tokens: 3000 },
  ],
};

const logsPayload = {
  logs: [
    {
      provider: 'openrouter',
      model: 'openai/gpt-4o',
      action: 'chat',
      tokens: 3000,
      createdAt: '2026-04-26T14:15:00.000Z',
    },
    {
      provider: 'openrouter',
      model: 'openai/gpt-4o',
      action: 'chat',
      tokens: 2000,
      createdAt: '2026-04-26T14:45:00.000Z',
    },
  ],
};

const costsPayload = {
  totalCost: 12.34,
  byProvider: {
    openrouter: { tokens: 5000, cost: 12.34 },
  },
};

describe('UsageAnalyticsDashboard honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(analyticsPayload))
        .mockResolvedValueOnce(jsonResponse(logsPayload))
        .mockResolvedValueOnce(jsonResponse(costsPayload))
    );
  });

  it('does not render failed usage sources as zero metrics and empty charts', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(analyticsPayload))
        .mockResolvedValueOnce(jsonResponse({ message: 'logs unavailable' }, false))
        .mockResolvedValueOnce(jsonResponse(costsPayload))
    );

    render(<UsageAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI usage analytics unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to load AI usage logs')).toBeInTheDocument();
    expect(screen.queryByText('Total Requests')).not.toBeInTheDocument();
    expect(screen.queryByText('No usage trend data for this period')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '7d' })).toBeDisabled();
  });

  it('renders usage analytics only from loaded analytics, logs, and costs', async () => {
    render(<UsageAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('1.2k').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('$12.34').length).toBeGreaterThan(0);
    expect(screen.getAllByText('openai/gpt-4o').length).toBeGreaterThan(0);
    expect(screen.getAllByText('chat').length).toBeGreaterThan(0);
    expect(screen.getByText('14:00 - 15:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'PDF Report' })).toBeDisabled();
    expect(fetch).toHaveBeenCalledWith('/api/llm/analytics?days=60', { headers: {} });
  });

  it('accepts deep wrapped usage analytics payloads', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ data: { data: analyticsPayload } }))
        .mockResolvedValueOnce(jsonResponse({ data: { data: logsPayload } }))
        .mockResolvedValueOnce(jsonResponse({ data: { data: costsPayload } }))
    );

    render(<UsageAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getAllByText('1.2k').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('$12.34').length).toBeGreaterThan(0);
    expect(screen.getAllByText('openai/gpt-4o').length).toBeGreaterThan(0);
  });

  it('does not render malformed usage logs as empty healthy analytics', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(analyticsPayload))
        .mockResolvedValueOnce(jsonResponse({ logs: { unexpected: true } }))
        .mockResolvedValueOnce(jsonResponse(costsPayload))
    );

    render(<UsageAnalyticsDashboard />);

    await waitFor(() => {
      expect(screen.getByText('AI usage analytics unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('AI usage logs response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('Total Requests')).not.toBeInTheDocument();
    expect(screen.queryByText('No usage trend data for this period')).not.toBeInTheDocument();
  });
});
