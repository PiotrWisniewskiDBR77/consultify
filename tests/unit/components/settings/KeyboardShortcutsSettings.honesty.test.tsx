import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KeyboardShortcutsSettings } from '@/components/settings/KeyboardShortcutsSettings';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('@/services/api', () => ({
  Api: {
    getShortcuts: vi.fn(),
    saveShortcuts: vi.fn(),
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

const shortcuts = {
  preset: 'default',
  enabled: true,
  showHints: true,
  customShortcuts: {},
  disabledShortcuts: [],
};

describe('KeyboardShortcutsSettings honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed shortcut loads as editable defaults', async () => {
    vi.mocked(Api.getShortcuts).mockRejectedValue(new Error('Shortcuts API down'));

    render(<KeyboardShortcutsSettings currentUser={user as any} />);

    await waitFor(() => {
      expect(screen.getByText('Keyboard shortcuts unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Shortcuts API down')).toBeInTheDocument();
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale shortcuts', async () => {
    const onUpdate = vi.fn();
    vi.mocked(Api.getShortcuts)
      .mockResolvedValueOnce({ preferences: shortcuts })
      .mockResolvedValueOnce({ preferences: shortcuts });
    vi.mocked(Api.saveShortcuts).mockResolvedValue({ success: true });

    render(<KeyboardShortcutsSettings currentUser={user as any} onUpdate={onUpdate} />);

    await screen.findByText('Keyboard Shortcuts');
    fireEvent.click(screen.getByRole('button', { name: /VS Code/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Keyboard shortcuts save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
