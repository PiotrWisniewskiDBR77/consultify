import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIPromptLibrarySettings } from '@/components/settings/AIPromptLibrarySettings';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getPromptLibrary: vi.fn(),
    savePromptLibrary: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const tMock = (_key: string, fallback?: string | Record<string, string>) =>
  typeof fallback === 'string' ? fallback : _key;

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tMock,
  }),
}));

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

describe('AIPromptLibrarySettings persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads persisted prompts instead of built-ins and reads saved prompts back after remount', async () => {
    const initialPrompts = [
      {
        id: 'custom-existing',
        name: 'Existing persisted prompt',
        category: 'analysis',
        prompt: 'Use the persisted prompt from the server.',
        createdAt: '2026-04-25',
      },
    ];
    let savedPrompts = initialPrompts;

    (Api.getPromptLibrary as any).mockImplementation(() =>
      Promise.resolve({ prompts: savedPrompts })
    );
    (Api.savePromptLibrary as any).mockImplementation((nextPrompts: typeof initialPrompts) => {
      savedPrompts = nextPrompts;
      return Promise.resolve({ success: true });
    });

    const { unmount } = render(<AIPromptLibrarySettings />);

    expect(await screen.findByText('Existing persisted prompt')).toBeInTheDocument();
    expect(screen.queryByText('Professional')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /new prompt/i }));
    fireEvent.change(screen.getByPlaceholderText(/interview deep-dive/i), {
      target: { value: 'Readback prompt' },
    });
    fireEvent.change(screen.getByPlaceholderText(/write your reusable prompt here/i), {
      target: { value: 'This prompt should survive remount.' },
    });
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(Api.savePromptLibrary).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'Readback prompt',
            prompt: 'This prompt should survive remount.',
          }),
        ])
      );
    });

    unmount();
    render(<AIPromptLibrarySettings />);

    expect(await screen.findByText('Readback prompt')).toBeInTheDocument();
    expect(screen.getByText(/this prompt should survive remount/i)).toBeInTheDocument();
  });
});
