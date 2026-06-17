import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopSoundsSettings } from '@/components/settings/DesktopSoundsSettings';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback?: string | { defaultValue?: string }) =>
  typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key);

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
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

const prefs = {
  pushEnabled: false,
  desktopEnabled: true,
  soundEnabled: true,
  soundPerType: {},
  desktopPosition: 'top-right',
  desktopDuration: 5000,
};

describe('DesktopSoundsSettings honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed desktop sound loads as editable defaults', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Sound API down'));

    render(<DesktopSoundsSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Desktop sound settings unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Sound API down')).toBeInTheDocument();
    expect(screen.queryByText('Desktop Notifications')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale preferences', async () => {
    vi.mocked(Api.get).mockResolvedValue(prefs);
    vi.mocked(Api.put).mockResolvedValue({ success: true });

    render(<DesktopSoundsSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await screen.findByText('Desktop Notifications');
    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Desktop sound settings save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
