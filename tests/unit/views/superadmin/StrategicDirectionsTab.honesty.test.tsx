import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StrategicDirectionsTab } from '@/views/superadmin/AIPlatformModule/Knowledge/StrategicDirectionsTab';
import { Api } from '@/services/api';
import { toast } from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getAllGlobalStrategies: vi.fn(),
    toggleGlobalStrategy: vi.fn(),
    createGlobalStrategy: vi.fn(),
    updateGlobalStrategy: vi.fn(),
  },
}));

const strategy = {
  id: 'strategy-1',
  title: 'Digital First',
  description: 'Prefer digital workflows',
  is_active: true,
  priority: 'medium',
  progress_percentage: 10,
  success_metrics: ['adoption'],
};

describe('StrategicDirectionsTab honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAllGlobalStrategies).mockResolvedValue([strategy]);
    vi.mocked(Api.toggleGlobalStrategy).mockResolvedValue({ success: true });
    vi.mocked(Api.createGlobalStrategy).mockResolvedValue({ strategy: { id: 'strategy-2' } });
    vi.mocked(Api.updateGlobalStrategy).mockResolvedValue({ success: true });
  });

  it('accepts deep wrapped strategy payloads', async () => {
    vi.mocked(Api.getAllGlobalStrategies).mockResolvedValue({
      data: { data: { strategies: [strategy] } },
    });

    render(<StrategicDirectionsTab />);

    expect(await screen.findByText('Digital First')).toBeInTheDocument();
    expect(screen.queryByText('Strategic directions unavailable')).not.toBeInTheDocument();
  });

  it('does not render malformed strategy payloads as an empty healthy list', async () => {
    vi.mocked(Api.getAllGlobalStrategies).mockResolvedValue({
      data: { data: { unexpected: true } },
    });

    render(<StrategicDirectionsTab />);

    await waitFor(() => {
      expect(screen.getByText('Strategic directions unavailable')).toBeInTheDocument();
    });
    expect(screen.getByText('Strategic directions response was not a list')).toBeInTheDocument();
    expect(screen.queryByText('No Strategic Directions')).not.toBeInTheDocument();
  });

  it('does not claim toggle success when read-back remains stale', async () => {
    render(<StrategicDirectionsTab />);

    await screen.findByText('Digital First');
    fireEvent.click(screen.getByTitle('Deactivate'));

    await waitFor(() => {
      expect(screen.getByText('Strategy update was not confirmed by the server')).toBeInTheDocument();
    });
    expect(toast.success).not.toHaveBeenCalledWith('Strategy updated');
  });

  it('confirms create through read-back before closing the modal', async () => {
    vi.mocked(Api.getAllGlobalStrategies)
      .mockResolvedValueOnce([strategy])
      .mockResolvedValueOnce([
        strategy,
        {
          ...strategy,
          id: 'strategy-2',
          title: 'AI Quality',
          description: 'Improve answer quality',
        },
      ]);

    render(<StrategicDirectionsTab />);

    await screen.findByText('Digital First');
    fireEvent.click(screen.getByRole('button', { name: /Add Strategic Direction/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g., Digital First'), {
      target: { value: 'AI Quality' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Explain how the AI should behave or what it should prioritize...'),
      {
        target: { value: 'Improve answer quality' },
      }
    );
    fireEvent.click(screen.getByRole('button', { name: /^Add Strategy$/i }));

    await waitFor(() => {
      expect(Api.createGlobalStrategy).toHaveBeenCalledWith(
        'AI Quality',
        'Improve answer quality',
        expect.objectContaining({ priority: 'medium' })
      );
    });
    expect(await screen.findByText('AI Quality')).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith('Strategy added');
  });
});
