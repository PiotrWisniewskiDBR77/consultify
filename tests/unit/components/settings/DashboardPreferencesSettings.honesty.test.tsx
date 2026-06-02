import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DashboardPreferencesSettings } from '@/components/settings/DashboardPreferencesSettings';
import { invalidateDashboardPreferencesCache } from '@/hooks/useDashboardPreferences';
import { Api } from '@/services/api';

const tMock = (_key: string, fallback: string) => fallback;

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/hooks/useDashboardPreferences', () => ({
  invalidateDashboardPreferencesCache: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
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
  defaultLandingPage: 'ai-assistant',
  showGreeting: true,
  compactMode: false,
  autoRefreshInterval: 0,
  liveUpdates: false,
  widgets: {
    tasks: true,
    initiatives: true,
    calendar: true,
    aiInsights: true,
    recentActivity: true,
    quickActions: true,
    metrics: true,
  },
};

describe('DashboardPreferencesSettings honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render failed dashboard preference loads as editable defaults', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Dashboard API down'));

    render(<DashboardPreferencesSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard preferences unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Dashboard API down')).toBeInTheDocument();
    expect(screen.queryByText('Default Landing Page')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset to Defaults/i })).toBeDisabled();
  });

  it('does not claim autosave success when read-back returns stale preferences', async () => {
    vi.useFakeTimers();
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ preferences })
      .mockResolvedValueOnce({ preferences });
    vi.mocked(Api.put).mockResolvedValue({ success: true });

    render(<DashboardPreferencesSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await screen.findByText('Default Landing Page');

    fireEvent.click(screen.getByRole('button', { name: /My Work/i }));

    await act(async () => {
      vi.advanceTimersByTime(650);
    });

    await waitFor(() => {
      expect(
        screen.getByText('Dashboard preferences save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(invalidateDashboardPreferencesCache).not.toHaveBeenCalled();
  });
});
