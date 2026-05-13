import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AIMemorySettings } from '@/components/settings/AIMemorySettings';

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
    getAIMemory: vi.fn(),
    saveAIMemory: vi.fn(),
    clearAIMemoryData: vi.fn(),
  },
}));

const enabledPreferences = {
  enabled: true,
  retentionDays: 30,
  includeConversations: true,
  includePreferences: true,
  includeContext: true,
};

describe('AIMemorySettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getAIMemory).mockResolvedValue({ preferences: enabledPreferences });
    vi.mocked(Api.saveAIMemory).mockResolvedValue({ success: true });
    vi.mocked(Api.clearAIMemoryData).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render failed memory preference loads as editable defaults', async () => {
    vi.mocked(Api.getAIMemory).mockRejectedValue(new Error('Memory backend down'));

    render(<AIMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText('AI memory settings unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Enable Memory')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
  });

  it('does not show success when save read-back returns stale memory settings', async () => {
    vi.mocked(Api.getAIMemory)
      .mockResolvedValueOnce({ preferences: enabledPreferences })
      .mockResolvedValueOnce({ preferences: enabledPreferences });

    render(<AIMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText('Enable Memory')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'AI memory settings were not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalledWith('AI memory settings saved');
  });

  it('shows success only after memory settings are confirmed by read-back', async () => {
    vi.mocked(Api.getAIMemory)
      .mockResolvedValueOnce({ preferences: enabledPreferences })
      .mockResolvedValueOnce({ preferences: { ...enabledPreferences, enabled: false } });

    render(<AIMemorySettings />);

    await waitFor(() => {
      expect(screen.getByText('Enable Memory')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('AI memory settings saved');
    });
  });
});
