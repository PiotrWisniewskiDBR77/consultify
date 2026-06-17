import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIBehaviorSettings } from '@/components/settings/AIBehaviorSettings';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('@/services/api', () => ({
  Api: {
    getAIInstructions: vi.fn(),
    getAIPersonality: vi.fn(),
    saveAIInstructions: vi.fn(),
    saveAIPersonality: vi.fn(),
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

const instructions = {
  systemPrompt: '',
  responseStyle: 'balanced',
  includeContext: true,
  maxContextLength: 4000,
};

const personality = {
  tone: 'professional',
  formality: 'balanced',
  verbosity: 'concise',
};

describe('AIBehaviorSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed AI behavior loads as editable defaults', async () => {
    vi.mocked(Api.getAIInstructions).mockRejectedValue(new Error('AI behavior API down'));
    vi.mocked(Api.getAIPersonality).mockResolvedValue({ preferences: personality });

    render(<AIBehaviorSettings />);

    await waitFor(() => {
      expect(screen.getByText('AI behavior settings unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('AI behavior API down')).toBeInTheDocument();
    expect(screen.queryByText('AI Behavior & Instructions')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale AI behavior', async () => {
    vi.mocked(Api.getAIInstructions)
      .mockResolvedValueOnce({ preferences: instructions })
      .mockResolvedValueOnce({ preferences: instructions });
    vi.mocked(Api.getAIPersonality).mockResolvedValue({ preferences: personality });
    vi.mocked(Api.saveAIInstructions).mockResolvedValue({ success: true });
    vi.mocked(Api.saveAIPersonality).mockResolvedValue({ success: true });

    render(<AIBehaviorSettings />);

    await screen.findByText('AI Behavior & Instructions');
    fireEvent.change(screen.getByPlaceholderText(/I prefer concise responses/i), {
      target: { value: 'Prefer very short answers.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('AI behavior settings save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
