import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PricingRegistryTab } from '@/views/superadmin/AIPlatformModule/Analytics/PricingRegistryTab';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getLLMPricingSnapshots: vi.fn(),
    createLLMPricingSnapshot: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const snapshot = {
  id: 'snap_1',
  provider: 'openrouter',
  model_id: 'openai/gpt-4o-mini',
  currency: 'USD',
  source: 'manual',
  effective_from: '2026-04-26T10:00:00.000Z',
  effective_to: null,
  units: { input_per_1m_tokens: 1, output_per_1m_tokens: 2 },
  notes: 'initial',
  created_at: '2026-04-26T10:00:00.000Z',
};

describe('PricingRegistryTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getLLMPricingSnapshots).mockResolvedValue({ snapshots: [snapshot] });
    vi.mocked(Api.createLLMPricingSnapshot).mockResolvedValue({ snapshot });
  });

  it('does not render pricing snapshot load failures as an empty registry', async () => {
    vi.mocked(Api.getLLMPricingSnapshots).mockRejectedValue(new Error('Pricing DB down'));

    render(<PricingRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('Pricing snapshots unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Pricing DB down')).toBeInTheDocument();
    expect(screen.queryByText('No snapshots.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
    expect(screen.getByPlaceholderText('filter provider')).toBeDisabled();
  });

  it('refetches pricing snapshots after creating a manual snapshot', async () => {
    vi.mocked(Api.getLLMPricingSnapshots)
      .mockResolvedValueOnce({ snapshots: [snapshot] })
      .mockResolvedValueOnce({
        snapshots: [
          snapshot,
          {
            ...snapshot,
            id: 'snap_2',
            model_id: 'anthropic/claude-3-5-sonnet',
          },
        ],
      });

    render(<PricingRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(Api.createLLMPricingSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'openrouter',
          model_id: 'openai/gpt-4o-mini',
          currency: 'USD',
          source: 'manual',
        })
      );
    });

    await waitFor(() => {
      expect(Api.getLLMPricingSnapshots).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText('anthropic/claude-3-5-sonnet')).toBeInTheDocument();
  });

  it('accepts deep wrapped pricing snapshot payloads', async () => {
    vi.mocked(Api.getLLMPricingSnapshots).mockResolvedValue({
      data: {
        data: {
          snapshots: [snapshot],
        },
      },
    });

    render(<PricingRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
    });
    expect(screen.queryByText('Pricing snapshots unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed snapshot payloads as an empty registry', async () => {
    vi.mocked(Api.getLLMPricingSnapshots).mockResolvedValue({
      snapshots: { unexpected: true },
    });

    render(<PricingRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('Pricing snapshots unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Pricing snapshots response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No snapshots.')).not.toBeInTheDocument();
  });

  it('surfaces stale read-back after create instead of reporting success', async () => {
    vi.mocked(Api.getLLMPricingSnapshots)
      .mockResolvedValueOnce({ snapshots: [snapshot] })
      .mockResolvedValueOnce({ snapshots: [snapshot] });

    render(<PricingRegistryTab />);

    await waitFor(() => {
      expect(screen.getByText('openai/gpt-4o-mini')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Pricing snapshot create was not confirmed by the server'
      );
    });
  });
});
