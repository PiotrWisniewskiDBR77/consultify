import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PrivacySettings } from '@/components/settings/PrivacySettings';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback: string) => fallback;

vi.mock('@/services/api', () => ({
  Api: {
    getPrivacyPreferences: vi.fn(),
    savePrivacyPreferences: vi.fn(),
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

describe('PrivacySettings honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };
  const preferences = {
    showOnlineStatus: true,
    activityVisibility: 'team',
    profileVisibility: 'organization',
    allowMentions: true,
    showInDirectory: true,
    shareActivityWithAI: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed privacy loads as editable default preferences', async () => {
    vi.mocked(Api.getPrivacyPreferences).mockRejectedValue(new Error('Privacy API down'));

    render(<PrivacySettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Privacy preferences unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Privacy API down')).toBeInTheDocument();
    expect(screen.queryByText('Online Status')).not.toBeInTheDocument();
  });

  it('does not claim privacy save success when read-back returns stale preferences', async () => {
    vi.mocked(Api.getPrivacyPreferences)
      .mockResolvedValueOnce({ preferences })
      .mockResolvedValueOnce({ preferences });
    vi.mocked(Api.savePrivacyPreferences).mockResolvedValue({ success: true });

    render(<PrivacySettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await screen.findByText('Online Status');

    fireEvent.click(screen.getAllByRole('switch')[0]);
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Privacy preferences save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
