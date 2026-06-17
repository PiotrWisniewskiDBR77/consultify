import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AccessibilitySettings } from '@/components/settings/AccessibilitySettings';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('@/services/api', () => ({
  Api: {
    getAccessibilitySettings: vi.fn(),
    updateAccessibilitySettings: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
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
  fontSize: 'medium',
  highContrastMode: false,
  reduceMotion: false,
  screenReaderOptimized: false,
  showKeyboardShortcuts: true,
  focusHighlight: true,
  cursorSize: 'default',
  textSpacing: 'default',
  underlineLinks: false,
  colorBlindMode: 'none',
  fontFamily: 'system',
  lineHeight: 'default',
  letterSpacing: 'default',
  voiceCommandsEnabled: false,
  textToSpeechEnabled: false,
  speechToTextEnabled: false,
  caretWidth: 'default',
  focusIndicatorStyle: 'default',
};

describe('AccessibilitySettings honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed accessibility loads as editable defaults', async () => {
    vi.mocked(Api.getAccessibilitySettings).mockRejectedValue(new Error('Accessibility API down'));

    render(<AccessibilitySettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Accessibility preferences unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Accessibility API down')).toBeInTheDocument();
    expect(screen.queryByText('Typography')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale preferences', async () => {
    vi.mocked(Api.getAccessibilitySettings)
      .mockResolvedValueOnce({ preferences })
      .mockResolvedValueOnce({ preferences });
    vi.mocked(Api.updateAccessibilitySettings).mockResolvedValue({ success: true });

    render(<AccessibilitySettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await screen.findByText('Typography');
    fireEvent.click(screen.getAllByRole('button', { name: /Large/i })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /Save Changes/i })[0]);

    await waitFor(() => {
      expect(
        screen.getByText('Accessibility preferences save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
