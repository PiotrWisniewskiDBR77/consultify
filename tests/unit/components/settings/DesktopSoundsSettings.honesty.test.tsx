import { render, screen, waitFor } from '@testing-library/react';
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

  it('N3: hides the desktop-popup and sound controls behind a single planned notice, keeping the honest mobile-push card', async () => {
    vi.mocked(Api.get).mockResolvedValue(prefs);
    vi.mocked(Api.put).mockResolvedValue({ success: true });

    render(<DesktopSoundsSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    // The already-honest "coming soon" card is untouched.
    await screen.findByText('Mobile push notifications');
    expect(screen.getByText('Coming soon')).toBeInTheDocument();

    // No control anywhere in src/ ever consumed these preferences to
    // actually show a popup or play a sound (notyfikacje-audyt.md §1E/§1F) —
    // none of their interactive controls should render.
    expect(screen.queryByText('Desktop Notifications')).not.toBeInTheDocument();
    expect(screen.queryByText('Sound Alerts')).not.toBeInTheDocument();
    expect(screen.queryByText('Show desktop notifications')).not.toBeInTheDocument();
    expect(screen.queryByText('Enable Sounds')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('switch')).toHaveLength(0);

    // A single honest notice replaces them.
    expect(
      screen.getByText('Planned — this channel will go live after rollout')
    ).toBeInTheDocument();
  });
});
