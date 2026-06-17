import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WorkingHoursSettings } from '@/components/settings/WorkingHoursSettings';
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

const makeSchedule = (startTime = '09:00') => ({
  monday: { enabled: true, startTime, endTime: '17:00' },
  tuesday: { enabled: true, startTime, endTime: '17:00' },
  wednesday: { enabled: true, startTime, endTime: '17:00' },
  thursday: { enabled: true, startTime, endTime: '17:00' },
  friday: { enabled: true, startTime, endTime: '17:00' },
  saturday: { enabled: false, startTime: '09:00', endTime: '17:00' },
  sunday: { enabled: false, startTime: '09:00', endTime: '17:00' },
});

describe('WorkingHoursSettings honest UI', () => {
  const user = { id: 'user-1', email: 'user@example.com', timezone: 'UTC' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render failed working-hours loads as editable defaults', async () => {
    vi.mocked(Api.get).mockRejectedValue(new Error('Working hours API down'));

    render(<WorkingHoursSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Working hours unavailable')).toBeInTheDocument();
    });

    expect(screen.getByText('Working hours API down')).toBeInTheDocument();
    expect(screen.queryByText('Weekly Schedule')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
  });

  it('does not claim working-hours save success when read-back returns stale schedule', async () => {
    const onUpdateUser = vi.fn();
    vi.mocked(Api.get)
      .mockResolvedValueOnce({ schedule: makeSchedule('09:00'), timezone: 'UTC' })
      .mockResolvedValueOnce({ schedule: makeSchedule('09:00'), timezone: 'UTC' });
    vi.mocked(Api.put).mockResolvedValue({ success: true });

    render(<WorkingHoursSettings currentUser={user as any} onUpdateUser={onUpdateUser} />);

    await screen.findByText('Weekly Schedule');

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '10:00' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(screen.getByText('Working hours save was not confirmed by the server')).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(onUpdateUser).not.toHaveBeenCalled();
  });
});
