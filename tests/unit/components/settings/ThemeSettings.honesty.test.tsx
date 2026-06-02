import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeSettings } from '@/components/settings/ThemeSettings';
import Api from '@/services/api';

const toggleTheme = vi.fn();
const tMock = (_key: string, fallback: string) => fallback;

vi.mock('@/services/api', () => ({
  default: {
    getAppearancePreferences: vi.fn(),
    saveAppearancePreferences: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: Object.assign(
    vi.fn((selector: (state: { theme: string; toggleTheme: typeof toggleTheme }) => unknown) =>
      selector({ theme: 'system', toggleTheme })
    ),
    {
      getState: () => ({ theme: 'system' }),
    }
  ),
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
  theme: 'system',
  accentColor: '#8b5cf6',
  density: 'comfortable',
};

describe('ThemeSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed appearance loads as editable defaults', async () => {
    vi.mocked(Api.getAppearancePreferences).mockRejectedValue(new Error('Appearance API down'));

    render(<ThemeSettings />);

    await waitFor(() => {
      expect(screen.getByText('Appearance preferences unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Appearance API down')).toBeInTheDocument();
    expect(screen.queryByText('Theme & Appearance')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale appearance preferences', async () => {
    vi.mocked(Api.getAppearancePreferences)
      .mockResolvedValueOnce({ preferences })
      .mockResolvedValueOnce({ preferences });
    vi.mocked(Api.saveAppearancePreferences).mockResolvedValue({ success: true });

    render(<ThemeSettings />);

    await screen.findByText('Theme & Appearance');
    fireEvent.click(screen.getByTitle('Blue'));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Appearance settings save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
