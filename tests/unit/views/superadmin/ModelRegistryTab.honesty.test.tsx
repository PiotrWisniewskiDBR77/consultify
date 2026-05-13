import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { ModelRegistryTab } from '@/views/superadmin/AIPlatformModule/Development/ModelRegistryTab';

vi.mock('@/services/api', () => ({
  Api: {
    getLLMProviders: vi.fn(),
    getLLMHealthDetailed: vi.fn(),
    getLLMControlUsage: vi.fn(),
  },
}));

vi.mock('@/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const provider = {
  id: 'provider-1',
  name: 'OpenRouter GPT',
  provider: 'openrouter',
  model_id: 'openai/gpt-4o',
  is_active: true,
  tier: 'premium',
  context_window: 128000,
  cost_per_1k: 0.01,
  created_at: '2026-04-26T10:00:00.000Z',
};

const healthPayload = {
  providers: [{ id: 'provider-1', status: 'healthy', responseTime: 420 }],
};

const usagePayload = {
  byProvider: [{ provider: 'openrouter', calls: 1200 }],
};

describe('ModelRegistryTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getLLMProviders).mockResolvedValue([provider]);
    vi.mocked(Api.getLLMHealthDetailed).mockResolvedValue(healthPayload);
    vi.mocked(Api.getLLMControlUsage).mockResolvedValue(usagePayload);
  });

  it('does not render model source failures as an empty model registry', async () => {
    vi.mocked(Api.getLLMProviders).mockRejectedValue(new Error('Providers down'));

    render(<ModelRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('Model registry unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Providers down')).toBeInTheDocument();
    expect(screen.queryByText('Total Models')).not.toBeInTheDocument();
  });

  it('renders model registry data from live provider, health, and usage payloads', async () => {
    render(<ModelRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('OpenRouter GPT')).toBeInTheDocument();
    });
    expect(screen.getByText('openai/gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('Premium')).toBeInTheDocument();
    expect(screen.getByText('420ms')).toBeInTheDocument();
    expect(screen.getAllByText('1.2K').length).toBeGreaterThan(0);
  });

  it('accepts deep wrapped model registry payloads', async () => {
    vi.mocked(Api.getLLMProviders).mockResolvedValue({ data: { data: [provider] } });
    vi.mocked(Api.getLLMHealthDetailed).mockResolvedValue({ data: { data: healthPayload } });
    vi.mocked(Api.getLLMControlUsage).mockResolvedValue({ data: { data: usagePayload } });

    render(<ModelRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('OpenRouter GPT')).toBeInTheDocument();
    });
    expect(screen.queryByText('Model registry unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed provider payloads as an empty registry', async () => {
    vi.mocked(Api.getLLMProviders).mockResolvedValue({ data: { data: { unexpected: true } } });

    render(<ModelRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('Model registry unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Model registry providers response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('Total Models')).not.toBeInTheDocument();
  });
});
