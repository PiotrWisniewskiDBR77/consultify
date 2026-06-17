import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AvailabilitySettings } from '@/components/settings/AvailabilitySettings';
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

const dnd = { enabled: false, until: null };
const quietHours = {
  enabled: false,
  startTime: '22:00',
  endTime: '08:00',
  daysOfWeek: [0, 6],
  allowUrgent: true,
  allowMentions: false,
  allowDirectMessages: false,
  autoReplyEnabled: false,
  autoReplyMessage: '',
};

describe('AvailabilitySettings honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed availability loads as editable defaults', async () => {
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/settings/notifications/dnd') throw new Error('Availability API down');
      return { preferences: quietHours };
    });

    render(<AvailabilitySettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Availability settings unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Availability API down')).toBeInTheDocument();
    expect(screen.queryByText('Do Not Disturb')).not.toBeInTheDocument();
  });

  it('does not claim save success when read-back returns stale DND settings', async () => {
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/settings/notifications/dnd') return dnd;
      return { preferences: quietHours };
    });
    vi.mocked(Api.put).mockResolvedValue({ success: true });

    render(<AvailabilitySettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await screen.findByText('Do Not Disturb');
    fireEvent.click(screen.getByRole('button', { name: /1 hour/i }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Availability settings save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
