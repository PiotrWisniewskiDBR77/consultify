import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ModelCatalogTable } from '@/components/SuperAdmin/ModelRegistry/ModelCatalogTable';

const t = (_key: string, fallback?: string | { defaultValue?: string }) => (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key;
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'en' } }) }));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    setCurrentView: vi.fn(),
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
  }),
}));

const provider = {
  id: 'provider-1',
  name: 'OpenRouter GPT-4o',
  provider: 'openrouter',
  provider_type: 'aggregator',
  origin_vendor: 'openai',
  model_id: 'openai/gpt-4o',
  kind: 'TEXT_LLM',
  is_active: true,
  health_status: 'healthy',
  cost_per_1k: 0.002,
  avg_latency_ms: 250,
  context_window: 128000,
  execution_regions: ['EU'],
};

const jsonResponse = (body: unknown, ok = true) =>
  ({
    ok,
    json: vi.fn().mockResolvedValue(body),
  }) as unknown as Response;

describe('ModelCatalogTable honest workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([provider])));
    window.localStorage.setItem('token', 'test-token');
  });

  it('does not render provider load failures as an empty model registry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: 'Providers down' }, false));

    render(<ModelCatalogTable />);

    await waitFor(() => {
      expect(screen.getByText('Model catalog unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Providers down')).toBeInTheDocument();
    expect(screen.queryByText('No models match your filters')).not.toBeInTheDocument();
    expect(screen.queryByText('Total')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add Model/i })).not.toBeInTheDocument();
  });

  it('refetches providers after activation changes instead of optimistic local state', async () => {
    render(<ModelCatalogTable />);

    await waitFor(() => {
      expect(screen.getByText('OpenRouter GPT-4o')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Row actions/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Deactivate/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/llm/providers/provider-1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ is_active: false }),
        })
      );
    });

    expect(vi.mocked(fetch).mock.calls.filter(([url]) => url === '/api/llm/providers')).toHaveLength(
      2
    );
  });
});
