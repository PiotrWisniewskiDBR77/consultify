import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AIAutoCompleteSettings } from '@/components/settings/AIAutoCompleteSettings';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('@/services/api', () => ({
  Api: {
    getAIAutoComplete: vi.fn(),
    saveAIAutoComplete: vi.fn(),
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

const preferences = {
  enabled: true,
  sensitivity: 0.5,
  suggestionsInComments: true,
  suggestInDocuments: true,
  suggestInChat: true,
};

describe('AIAutoCompleteSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed auto-complete loads as editable defaults', async () => {
    vi.mocked(Api.getAIAutoComplete).mockRejectedValue(new Error('AI autocomplete API down'));

    render(<AIAutoCompleteSettings />);

    await waitFor(() => {
      expect(screen.getByText('AI auto-complete unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('AI autocomplete API down')).toBeInTheDocument();
    expect(screen.queryByText('Auto-Complete & Suggestions')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale auto-complete preferences', async () => {
    vi.mocked(Api.getAIAutoComplete)
      .mockResolvedValueOnce({ preferences })
      .mockResolvedValueOnce({ preferences });
    vi.mocked(Api.saveAIAutoComplete).mockResolvedValue({ success: true });

    render(<AIAutoCompleteSettings />);

    await screen.findByText('Auto-Complete & Suggestions');
    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('AI auto-complete save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
