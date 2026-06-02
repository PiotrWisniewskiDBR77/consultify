import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LLMObservatoryTab } from '@/views/superadmin/AIPlatformModule/Analytics/LLMObservatoryTab';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getAIOperationsLLMObservatory: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
  },
}));

const observatoryPayload = {
  period: '30d',
  summary: {
    totalRequests: 1200,
    successfulRequests: 1188,
    failedRequests: 12,
    successRate: 99,
    errorRate: 1,
    avgLatencyMs: 450,
    totalTokens: 250000,
    totalCost: 12.34,
    providersUsed: 1,
    modelsUsed: 2,
    incidents: 0,
    activeIncidents: 0,
  },
  timeline: [
    {
      bucket: '2026-04-26',
      requests: 1200,
      successful: 1188,
      failed: 12,
      successRate: 99,
      avgLatencyMs: 450,
      tokens: 250000,
      cost: 12.34,
    },
  ],
  providers: [
    {
      provider: 'openrouter',
      name: 'OpenRouter',
      active: true,
      currentStatus: 'healthy',
      lastHealthCheck: '2026-04-26T10:00:00.000Z',
      requestCount: 1200,
      successRate: 99,
      errorRate: 1,
      avgLatencyMs: 450,
      totalTokens: 250000,
      totalCost: 12.34,
      uptimePct: 99.9,
      healthSamples: 10,
      unavailableSamples: 0,
      modelId: 'openai/gpt-4o',
    },
  ],
  models: [
    {
      provider: 'openrouter',
      model: 'openai/gpt-4o',
      requests: 1200,
      tokens: 250000,
      cost: 12.34,
      avgLatencyMs: 450,
    },
  ],
  errorCategories: [],
  incidents: [],
};

describe('LLMObservatoryTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAIOperationsLLMObservatory).mockResolvedValue(observatoryPayload);
  });

  it('does not render failed observatory loads as zero historical metrics', async () => {
    vi.mocked(Api.getAIOperationsLLMObservatory).mockRejectedValue(
      new Error('Observatory API down')
    );

    render(<LLMObservatoryTab />);

    await waitFor(() => {
      expect(screen.getByText('LLM observatory unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Observatory API down')).toBeInTheDocument();
    expect(screen.queryByText('Requests')).not.toBeInTheDocument();
    expect(screen.queryByText('No historical request data for this period')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('renders observability metrics from the live analytics payload', async () => {
    render(<LLMObservatoryTab />);

    await waitFor(() => {
      expect(screen.getAllByText('1.2K').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('OpenRouter').length).toBeGreaterThan(0);
    expect(screen.getByText('openai/gpt-4o')).toBeInTheDocument();
    expect(screen.getByText('$12.34')).toBeInTheDocument();
    expect(Api.getAIOperationsLLMObservatory).toHaveBeenCalledWith('30d');
  });

  it('accepts deep wrapped observatory payloads', async () => {
    vi.mocked(Api.getAIOperationsLLMObservatory).mockResolvedValue({
      data: {
        data: observatoryPayload,
      },
    });

    render(<LLMObservatoryTab />);

    await waitFor(() => {
      expect(screen.getAllByText('1.2K').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('OpenRouter').length).toBeGreaterThan(0);
    expect(screen.queryByText('LLM observatory unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed observatory lists as empty healthy analytics', async () => {
    vi.mocked(Api.getAIOperationsLLMObservatory).mockResolvedValue({
      ...observatoryPayload,
      providers: { unexpected: true },
    });

    render(<LLMObservatoryTab />);

    await waitFor(() => {
      expect(screen.getByText('LLM observatory unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('LLM observatory response was incomplete')).toBeInTheDocument();
    expect(screen.queryByText('Requests')).not.toBeInTheDocument();
    expect(screen.queryByText('No historical request data for this period')).not.toBeInTheDocument();
  });
});
