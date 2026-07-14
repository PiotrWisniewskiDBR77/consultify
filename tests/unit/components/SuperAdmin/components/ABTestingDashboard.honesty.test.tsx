import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ABTestingDashboard } from '@/views/superadmin/components/ABTestingDashboard';
import api from '@/services/api';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const draftExperiment = {
  id: 'experiment-1',
  name: 'Prompt v2',
  description: 'Prompt experiment',
  type: 'PROMPT',
  status: 'DRAFT',
  variants: [
    {
      id: 'control',
      name: 'Control',
      description: 'Current',
      traffic: 50,
      participants: 0,
      conversions: 0,
      conversionRate: 0,
      avgSatisfaction: 0,
      avgLatency: 0,
    },
    {
      id: 'variant-a',
      name: 'Variant A',
      description: 'New',
      traffic: 50,
      participants: 0,
      conversions: 0,
      conversionRate: 0,
      avgSatisfaction: 0,
      avgLatency: 0,
    },
  ],
  targetMetric: 'satisfaction',
  minimumSampleSize: 100,
  confidenceLevel: 95,
  createdAt: 'not-a-date',
  createdBy: 'admin',
};

describe('ABTestingDashboard honest workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({
      data: {
        success: true,
        data: [draftExperiment],
      },
    });
    vi.mocked(api.post).mockResolvedValue({ success: true });
  });

  it('does not render experiment load failures as an empty list with active create', async () => {
    vi.mocked(api.get).mockRejectedValue(new Error('Experiments API down'));

    render(<ABTestingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('A/B experiments unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Experiments API down')).toBeInTheDocument();
    expect(screen.queryByText('No experiments found')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Experiment/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /DRAFT/i })).toBeDisabled();
  });

  it('refetches experiments after create and lifecycle actions', async () => {
    render(<ABTestingDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Prompt v2')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /New Experiment/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Chat Prompt v2 Test'), {
      target: { value: 'New Prompt Test' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Experiment/i }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/ai/ab-testing/experiments',
        expect.objectContaining({ name: 'New Prompt Test' })
      );
    });
    expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByTitle('Start'));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/ai/ab-testing/experiments/experiment-1/start', {});
    });
    expect(vi.mocked(api.get).mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
