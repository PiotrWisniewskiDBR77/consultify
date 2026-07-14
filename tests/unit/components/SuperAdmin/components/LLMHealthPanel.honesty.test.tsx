import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMHealthPanel } from '@/views/superadmin/components/LLMHealthPanel';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

const healthPayload = {
  success: true,
  providers: [
    {
      id: 'provider-1',
      name: 'OpenRouter',
      providerId: 'openrouter',
      status: 'healthy',
      statusLabel: {
        text: 'Healthy',
        textEn: 'Healthy',
        color: 'green',
        icon: 'check',
      },
      isHealthy: true,
      isDegraded: false,
      isUnhealthy: false,
      errorCategory: null,
      error: null,
      rawError: null,
      statusCode: null,
      responseTime: 123,
      lastCheck: 'not-a-date',
    },
  ],
  alerts: [],
  summary: {
    total: 1,
    healthy: 1,
    degraded: 0,
    unhealthy: 0,
    healthyCount: 1,
    degradedCount: 0,
    unhealthyCount: 0,
    lastCheck: 'not-a-date',
  },
};

const jsonResponse = (body: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

describe('LLMHealthPanel honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(healthPayload)));
    window.localStorage.setItem('token', 'test-token');
  });

  it('does not render health load failures as zero healthy provider metrics', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'Health API down' }, false));

    render(<LLMHealthPanel autoRefresh={false} />);

    await waitFor(() => {
      expect(screen.getByText('LLM health unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Failed to fetch health data')).toBeInTheDocument();
    expect(screen.queryByText('Status Providerów')).not.toBeInTheDocument();
    expect(screen.queryByText('Zdrowe')).not.toBeInTheDocument();
  });

  it('uses safe dates and refetches after provider tests without local patching', async () => {
    render(<LLMHealthPanel autoRefresh={false} />);

    await waitFor(() => {
      expect(screen.getByText('OpenRouter')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('OpenRouter'));

    await waitFor(() => {
      expect(screen.getAllByText(/Unknown date/i).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Testuj ponownie/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/llm/health/test-provider',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ providerId: 'provider-1' }),
        })
      );
    });

    expect(
      vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/llm/health/detailed')
    ).toHaveLength(2);
  });

  it('accepts deep wrapped health payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ data: { data: healthPayload } })));

    render(<LLMHealthPanel autoRefresh={false} />);

    expect(await screen.findByText('OpenRouter')).toBeInTheDocument();
    expect(screen.queryByText('LLM health unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed health payloads as zero healthy metrics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({
          success: true,
          providers: { unexpected: true },
          summary: { total: 0 },
        })
      )
    );

    render(<LLMHealthPanel autoRefresh={false} />);

    await waitFor(() => {
      expect(screen.getByText('LLM health unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('LLM health providers response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('Status Providerów')).not.toBeInTheDocument();
  });
});
