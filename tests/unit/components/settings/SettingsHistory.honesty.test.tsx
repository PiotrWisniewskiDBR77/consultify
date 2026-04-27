import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsHistory } from '@/components/settings/advanced/SettingsHistory';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback?: string) => fallback ?? _key;

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    getSettingsHistory: vi.fn(),
    restoreSettingsEntry: vi.fn(),
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

const entry = {
  id: 'entry-1',
  category: 'Privacy',
  setting: 'Profile visibility',
  action: 'updated',
  oldValue: 'private',
  newValue: 'organization',
  timestamp: '2026-04-26T10:00:00.000Z',
  device: 'Desktop',
  ipAddress: '127.0.0.1',
};

describe('SettingsHistory honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('does not render failed history loads as empty history', async () => {
    vi.mocked(Api.getSettingsHistory).mockRejectedValue(new Error('History API down'));

    render(<SettingsHistory currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Settings history unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('History API down')).toBeInTheDocument();
    expect(screen.queryByText('No settings changes found')).not.toBeInTheDocument();
  });

  it('does not claim restore success when history refresh fails after restore', async () => {
    vi.mocked(Api.getSettingsHistory)
      .mockResolvedValueOnce({ entries: [entry] })
      .mockRejectedValueOnce(new Error('Refresh failed'));
    vi.mocked(Api.restoreSettingsEntry).mockResolvedValue({ success: true });

    render(<SettingsHistory currentUser={user as any} onUpdateUser={vi.fn()} />);

    fireEvent.click(await screen.findByText('Profile visibility'));
    fireEvent.click(screen.getByRole('button', { name: /Restore Previous Value/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Settings history refresh after restore was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
