import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { SettingsApi } from '@/services/api/settings.api';
import { RegionalSettings } from '@/components/settings/RegionalSettings';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('@/services/api/settings.api', () => ({
  SettingsApi: {
    getRegionalPreferences: vi.fn(),
    updateRegionalPreferences: vi.fn(),
  },
}));

const user = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  role: 'USER',
  timezone: 'Europe/Warsaw',
  units: 'metric',
};

const initialPreferences = {
  timezone: 'Europe/Warsaw',
  units: 'metric',
  currency: 'PLN',
  numberFormat: 'pl-PL',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  firstDayOfWeek: 'monday',
};

describe('RegionalSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockResolvedValue({});
    vi.mocked(SettingsApi.getRegionalPreferences).mockResolvedValue({
      preferences: initialPreferences,
    });
    vi.mocked(SettingsApi.updateRegionalPreferences).mockResolvedValue({ success: true });
  });

  it('does not render failed regional preference loads as editable current-user fallbacks', async () => {
    vi.mocked(SettingsApi.getRegionalPreferences).mockRejectedValue(
      new Error('Regional backend down')
    );

    render(<RegionalSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Regional preferences unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Timezone')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Save Changes/i })).not.toBeInTheDocument();
  });

  it('cold-hydrates all display-format fields from the canonical regional API', async () => {
    render(<RegionalSettings currentUser={user as any} onUpdateUser={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('First Day of Week')).toBeInTheDocument());
    expect(SettingsApi.getRegionalPreferences).toHaveBeenCalledTimes(1);
    expect(screen.getByDisplayValue('Europe/Warsaw')).toBeInTheDocument();
    expect(Array.from(document.querySelectorAll('select')).some((select) => select.value === 'PLN')).toBe(true);
    expect(Array.from(document.querySelectorAll('select')).some((select) => select.value === 'pl-PL')).toBe(true);
    expect(screen.getByRole('radio', { name: /Day\/Month\/Year/i })).toBeChecked();
    expect(screen.getByRole('button', { name: /Metric/i })).toHaveClass('border-amber-500');
    expect(screen.getByRole('radio', { name: /24-hour/i })).toBeChecked();
  });

  it('does not show success when regional save read-back returns stale preferences', async () => {
    const onUpdateUser = vi.fn();
    vi.mocked(SettingsApi.getRegionalPreferences)
      .mockResolvedValueOnce({ preferences: initialPreferences })
      .mockResolvedValueOnce({ preferences: initialPreferences });

    render(<RegionalSettings currentUser={user as any} onUpdateUser={onUpdateUser} />);

    await waitFor(() => {
      expect(screen.getByText('First Day of Week')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sunday' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Regional preferences were not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalledWith('Regional preferences saved');
    expect(onUpdateUser).not.toHaveBeenCalled();
  });

  it('shows success only after regional preferences are confirmed by read-back', async () => {
    const onUpdateUser = vi.fn();
    vi.mocked(SettingsApi.getRegionalPreferences)
      .mockResolvedValueOnce({ preferences: initialPreferences })
      .mockResolvedValueOnce({
        preferences: { ...initialPreferences, firstDayOfWeek: 'sunday' },
      });

    render(<RegionalSettings currentUser={user as any} onUpdateUser={onUpdateUser} />);

    await waitFor(() => {
      expect(screen.getByText('First Day of Week')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Sunday' }));
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Regional preferences saved');
    });

    // onUpdateUser is intentionally NOT called — timezone/units are personal display
    // preferences only and do not need to be mirrored onto the user object.
    expect(onUpdateUser).not.toHaveBeenCalled();
  });
});
