import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIMissionControl } from '@/components/Admin/AIMissionControl';
import { Api } from '@/services/api';

const t = vi.hoisted(
  () => (_key: string, fallback?: string, values?: Record<string, unknown>) =>
    (fallback || _key).replace(/\{\{(\w+)\}\}/g, (_match, key) => String(values?.[key] ?? ''))
);
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));
vi.mock('i18next', () => ({ default: { t } }));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const statusPayload = {
  providers: [
    {
      name: 'OpenRouter',
      type: 'llm',
      status: 'ACTIVE',
      visibility: 'public',
    },
  ],
  metrics: {
    uptime50: 98.5,
    avgLatencyMs: 420,
    totalRequests: 123,
  },
  timestamp: '2026-04-26T10:00:00.000Z',
};

describe('AIMissionControl honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockResolvedValue(statusPayload);
    vi.mocked(Api.post).mockResolvedValue({
      capability: 'connection',
      status: 'SUCCESS',
      latency: 250,
      details: { ok: true },
    });
  });

  it('does not render failed mission status as zero degraded operational metrics', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Mission status down'));

    render(<AIMissionControl />);

    await waitFor(() => {
      expect(screen.getByText('AI mission control unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Mission status down')).toBeInTheDocument();
    expect(screen.queryByText('Success Rate (Last 50)')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
    expect(screen.queryByText('No active providers')).not.toBeInTheDocument();

    for (const button of screen.getAllByRole('button', { name: /Run Test/i })) {
      expect(button).toBeDisabled();
    }
  });

  it('renders live status and refetches it after capability diagnostics', async () => {
    render(<AIMissionControl />);

    await waitFor(() => {
      expect(screen.getByText('98.5%')).toBeInTheDocument();
    });

    expect(screen.getByText('Excellent')).toBeInTheDocument();
    expect(screen.getByText('420ms')).toBeInTheDocument();
    expect(screen.getByText('OpenRouter')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Run Test/i })[0]);

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/api/llm/health/test/connection', { context: {} });
    });

    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledTimes(2);
    });
    expect(screen.getAllByText(/SUCCESS \(250ms\)/i).length).toBeGreaterThan(0);
  });

  it('accepts deep wrapped status and diagnostic payloads', async () => {
    vi.mocked(Api.get).mockResolvedValue({ data: { data: statusPayload } });
    vi.mocked(Api.post).mockResolvedValue({
      data: {
        data: {
          capability: 'connection',
          status: 'SUCCESS',
          latency: '125',
          details: { ok: true },
        },
      },
    });

    render(<AIMissionControl />);

    await waitFor(() => {
      expect(screen.getByText('98.5%')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: /Run Test/i })[0]);

    await waitFor(() => {
      expect(screen.getAllByText(/SUCCESS \(125ms\)/i).length).toBeGreaterThan(0);
    });
  });

  it('does not render malformed mission status as zero healthy metrics', async () => {
    vi.mocked(Api.get).mockResolvedValue({
      providers: { unexpected: true },
      metrics: { uptime50: 0 },
    });

    render(<AIMissionControl />);

    await waitFor(() => {
      expect(screen.getByText('AI mission control unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('AI mission status response was incomplete')).toBeInTheDocument();
    expect(screen.queryByText('Success Rate (Last 50)')).not.toBeInTheDocument();
    expect(screen.queryByText('0.0%')).not.toBeInTheDocument();
  });
});
