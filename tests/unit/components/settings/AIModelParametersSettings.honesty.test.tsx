import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AIModelParametersSettings } from '@/components/settings/AIModelParametersSettings';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getAIAvailableModels: vi.fn(),
    getAIUserSettings: vi.fn(),
    updateAIUserSettings: vi.fn(),
  },
}));

const models = [
  {
    id: 'model-1',
    name: 'Vector DBR77',
    provider: 'dbr77',
    model_id: 'vector-dbr77',
    endpoint: null,
    tier: 'PLATFORM',
    visibility: 'public',
    is_active: true,
    is_default: true,
    cost_per_1k: 0,
    context_window: 128000,
  },
  {
    id: 'model-2',
    name: 'Cloud Model',
    provider: 'openai',
    model_id: 'cloud-model',
    endpoint: null,
    tier: 'STANDARD',
    visibility: 'public',
    is_active: true,
    is_default: false,
    cost_per_1k: 1,
    context_window: 16000,
  },
];

const initialSettings = {
  preferred_model_id: 'model-1',
  visible_model_ids: ['model-1'],
  model_temperature: 0.7,
  max_tokens: 4096,
};

describe('AIModelParametersSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAIAvailableModels).mockResolvedValue(models);
    vi.mocked(Api.getAIUserSettings).mockResolvedValue(initialSettings);
    vi.mocked(Api.updateAIUserSettings).mockResolvedValue({ success: true });
  });

  it('does not render failed model preference loads as editable empty model settings', async () => {
    vi.mocked(Api.getAIAvailableModels).mockRejectedValue(new Error('Models backend down'));

    render(<AIModelParametersSettings />);

    await waitFor(() => {
      expect(screen.getByText('AI model preferences unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No AI models are configured yet.')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
  });

  it('does not show success when save read-back returns stale model preferences', async () => {
    vi.mocked(Api.getAIUserSettings)
      .mockResolvedValueOnce(initialSettings)
      .mockResolvedValueOnce(initialSettings);

    render(<AIModelParametersSettings />);

    await waitFor(() => {
      expect(screen.getByText('Cloud Model')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cloud Model'));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Model preferences were not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalledWith('Model & parameters saved');
  });

  it('shows success only after model preferences are confirmed by read-back', async () => {
    vi.mocked(Api.getAIUserSettings)
      .mockResolvedValueOnce(initialSettings)
      .mockResolvedValueOnce({
        ...initialSettings,
        visible_model_ids: ['model-1', 'model-2'],
      });

    render(<AIModelParametersSettings />);

    await waitFor(() => {
      expect(screen.getByText('Cloud Model')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Cloud Model'));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Model & parameters saved');
    });
  });
});
