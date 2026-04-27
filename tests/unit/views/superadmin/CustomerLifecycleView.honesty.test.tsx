import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Api from '@/services/api';
import CustomerLifecycleView from '@/views/superadmin/customers/CustomerLifecycleView';

vi.mock('@/services/api', () => ({
  default: {
    createLifecycleStage: vi.fn(),
    deleteLifecycleStage: vi.fn(),
    getLifecycleStages: vi.fn(),
    getLifecycleStats: vi.fn(),
    getLifecycleTransitions: vi.fn(),
    transitionOrganizationLifecycle: vi.fn(),
    updateLifecycleStage: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/components/Admin/AdminState', () => ({
  DegradedState: ({ title, description }: { title: string; description: string }) => (
    <div role="alert">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  ),
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => <span data-testid="info-button" />,
}));

describe('CustomerLifecycleView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed lifecycle loads as empty stages', async () => {
    vi.mocked(Api.getLifecycleStages).mockRejectedValue(new Error('Lifecycle API down'));
    vi.mocked(Api.getLifecycleTransitions).mockResolvedValue([]);
    vi.mocked(Api.getLifecycleStats).mockResolvedValue({ stageStats: [], totalTransitions: 0 });

    render(<CustomerLifecycleView />);

    await waitFor(() => {
      expect(screen.getByText('Customer lifecycle unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Lifecycle API down')).toBeInTheDocument();
    expect(screen.queryByText('No lifecycle stages defined')).not.toBeInTheDocument();
  });

  it('does not claim stage creation success when read-back is stale', async () => {
    vi.mocked(Api.getLifecycleStages).mockResolvedValue([]);
    vi.mocked(Api.getLifecycleTransitions).mockResolvedValue([]);
    vi.mocked(Api.getLifecycleStats).mockResolvedValue({ stageStats: [], totalTransitions: 0 });
    vi.mocked(Api.createLifecycleStage).mockResolvedValue({ success: true });

    render(<CustomerLifecycleView />);

    await screen.findByText('No lifecycle stages defined');
    fireEvent.click(screen.getByRole('button', { name: /Add Stage/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Trial, Onboarding, Active'), {
      target: { value: 'Trial' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Stage/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Lifecycle stage creation was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('uses safe transition dates', async () => {
    vi.mocked(Api.getLifecycleStages).mockResolvedValue([
      { id: 'stage-1', name: 'Trial', order_index: 0, color: '#3B82F6', is_active: true },
    ]);
    vi.mocked(Api.getLifecycleTransitions).mockResolvedValue([
      {
        id: 'transition-1',
        organization_id: 'org-1',
        organization_name: 'Org One',
        to_stage_id: 'stage-1',
        to_stage_name: 'Trial',
        transitioned_at: 'not-a-date',
      },
    ]);
    vi.mocked(Api.getLifecycleStats).mockResolvedValue({ stageStats: [], totalTransitions: 1 });

    render(<CustomerLifecycleView />);

    expect(await screen.findByText('Unknown date')).toBeInTheDocument();
  });

  it('accepts wrapped lifecycle payloads and nested create responses', async () => {
    const trialStage = {
      id: 'stage-1',
      name: 'Trial',
      order_index: 'bad-order',
      color: '#3B82F6',
      is_active: 'true',
    };
    const onboardingStage = {
      id: 'stage-2',
      name: 'Onboarding',
      order_index: 1,
      color: '#10B981',
      is_active: true,
    };
    vi.mocked(Api.getLifecycleStages)
      .mockResolvedValueOnce({ data: { data: { stages: [trialStage] } } })
      .mockResolvedValueOnce({ data: { data: { stages: [trialStage, onboardingStage] } } });
    vi.mocked(Api.getLifecycleTransitions).mockResolvedValue({
      data: {
        data: {
          transitions: [
            {
              id: 'transition-1',
              organization_id: 'org-1',
              organization_name: 'Org One',
              to_stage_id: 'stage-1',
              to_stage_name: 'Trial',
              transitioned_at: 'not-a-date',
            },
          ],
        },
      },
    });
    vi.mocked(Api.getLifecycleStats).mockResolvedValue({
      data: {
        data: {
          stageStats: [{ stage_id: 'stage-1', stage_name: 'Trial', color: '#3B82F6', count: 'bad' }],
          totalTransitions: 'bad-total',
        },
      },
    });
    vi.mocked(Api.createLifecycleStage).mockResolvedValue({
      data: { data: { stage: { id: 'stage-2' } } },
    });

    const { container } = render(<CustomerLifecycleView />);

    expect((await screen.findAllByText('Trial')).length).toBeGreaterThan(0);
    expect(screen.getByText('Unknown date')).toBeInTheDocument();
    expect(container.textContent).not.toContain('NaN');
    expect(container.textContent).not.toContain('bad');

    fireEvent.click(screen.getByRole('button', { name: /Add Stage/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Trial, Onboarding, Active'), {
      target: { value: 'Onboarding' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Create Stage/i }));

    await waitFor(() => {
      expect(screen.queryByText('Create Lifecycle Stage')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Onboarding')).toBeInTheDocument();
  });

  it('does not claim stage deletion success when read-back is unavailable', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(Api.getLifecycleStages)
      .mockResolvedValueOnce([
        { id: 'stage-1', name: 'Trial', order_index: 0, color: '#3B82F6', is_active: true },
      ])
      .mockRejectedValueOnce(new Error('Lifecycle refresh down'));
    vi.mocked(Api.getLifecycleTransitions).mockResolvedValue([]);
    vi.mocked(Api.getLifecycleStats).mockResolvedValue({ stageStats: [], totalTransitions: 0 });
    vi.mocked(Api.deleteLifecycleStage).mockResolvedValue({ success: true });

    render(<CustomerLifecycleView />);

    await screen.findByText('Trial');
    fireEvent.click(screen.getByRole('button', { name: /Delete lifecycle stage stage-1/i }));

    await waitFor(() => {
      expect(screen.getByText('Lifecycle refresh down')).toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('does not render malformed lifecycle payloads as empty stages', async () => {
    vi.mocked(Api.getLifecycleStages).mockResolvedValue({ unexpected: true });
    vi.mocked(Api.getLifecycleTransitions).mockResolvedValue([]);
    vi.mocked(Api.getLifecycleStats).mockResolvedValue({ stageStats: [], totalTransitions: 0 });

    render(<CustomerLifecycleView />);

    await waitFor(() => {
      expect(screen.getByText('Customer lifecycle unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Lifecycle response was missing list data')).toBeInTheDocument();
    expect(screen.queryByText('No lifecycle stages defined')).not.toBeInTheDocument();
  });
});
