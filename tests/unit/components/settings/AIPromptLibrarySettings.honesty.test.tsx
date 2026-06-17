import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AIPromptLibrarySettings } from '@/components/settings/AIPromptLibrarySettings';

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('@/services/api', () => ({
  Api: {
    getPromptLibrary: vi.fn(),
    savePromptLibrary: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

describe('AIPromptLibrarySettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render built-in prompts as editable data when prompt library load fails', async () => {
    vi.mocked(Api.getPromptLibrary).mockRejectedValue(new Error('Prompt API down'));

    render(<AIPromptLibrarySettings />);

    await waitFor(() => {
      expect(screen.getByText('Prompt library unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Prompt API down')).toBeInTheDocument();
    expect(screen.queryByText('Professional')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New Prompt/i })).toBeDisabled();
  });

  it('does not claim prompt creation success when read-back is stale', async () => {
    vi.mocked(Api.getPromptLibrary)
      .mockResolvedValueOnce({ prompts: [] })
      .mockResolvedValueOnce({ prompts: [] });
    vi.mocked(Api.savePromptLibrary).mockResolvedValue({ success: true });

    render(<AIPromptLibrarySettings />);

    await waitFor(() => {
      expect(screen.getByText('Professional')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /New Prompt/i }));
    fireEvent.change(screen.getByPlaceholderText(/interview deep-dive/i), {
      target: { value: 'Refresh proof prompt' },
    });
    fireEvent.change(screen.getByPlaceholderText(/write your reusable prompt here/i), {
      target: { value: 'This prompt must be confirmed by read-back.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Create$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Prompt library save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Create Prompt')).toBeInTheDocument();
  });
});
