import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CalendarSyncSettings } from '@/components/settings/CalendarSyncSettings';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    connectCalendar: vi.fn(),
    disconnectCalendar: vi.fn(),
    getCalendarSettings: vi.fn(),
    getCalendars: vi.fn(),
    updateCalendarSettings: vi.fn(),
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
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

describe('CalendarSyncSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
    vi.mocked(Api.getCalendarSettings).mockResolvedValue({
      syncTasks: true,
      syncMeetings: true,
    });
  });

  it('does not render failed calendar loads as disconnected provider defaults', async () => {
    vi.mocked(Api.getCalendars).mockRejectedValue(new Error('Calendar API down'));

    render(<CalendarSyncSettings />);

    await waitFor(() => {
      expect(screen.getByText('Calendar sync unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Calendar API down')).toBeInTheDocument();
    expect(screen.queryByText('Google Calendar')).not.toBeInTheDocument();
  });

  it('does not claim calendar disconnect success when read-back still shows it connected', async () => {
    const connectedCalendar = {
      id: 'google',
      name: 'Google Calendar',
      icon: 'calendar',
      connected: true,
      connection: {
        externalEmail: 'user@example.com',
        calendarName: 'Primary',
        lastSyncAt: '2026-04-26T10:00:00.000Z',
        syncTasks: true,
        syncMeetings: true,
      },
    };
    vi.mocked(Api.getCalendars)
      .mockResolvedValueOnce([connectedCalendar])
      .mockResolvedValueOnce([connectedCalendar]);
    vi.mocked(Api.disconnectCalendar).mockResolvedValue({ success: true });

    render(<CalendarSyncSettings />);

    await screen.findByText('Google Calendar');

    fireEvent.click(screen.getByTitle('Disconnect'));

    await waitFor(() => {
      expect(
        screen.getByText('Calendar disconnection was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not claim sync settings success when read-back returns stale values', async () => {
    vi.mocked(Api.getCalendars).mockResolvedValue([]);
    vi.mocked(Api.getCalendarSettings)
      .mockResolvedValueOnce({ syncTasks: true, syncMeetings: true })
      .mockResolvedValueOnce({ syncTasks: true, syncMeetings: true });
    vi.mocked(Api.updateCalendarSettings).mockResolvedValue({ success: true });

    render(<CalendarSyncSettings />);

    await screen.findByText('Sync Tasks');

    fireEvent.click(screen.getAllByRole('checkbox')[0]);

    await waitFor(() => {
      expect(
        screen.getByText('Calendar sync settings save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
