import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { ProfileSettings } from '@/components/settings/ProfileSettings';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api', () => ({
  Api: {
    updateUser: vi.fn(),
    getMe: vi.fn(),
  },
}));

const baseUser = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  role: 'USER',
  phone: '',
  companyName: 'Acme',
  jobTitle: '',
  timezone: 'Europe/Warsaw',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  linkedinId: '',
  displayName: '',
  pronouns: '',
  department: '',
  statusMessage: '',
  isOutOfOffice: false,
  outOfOfficeUntil: '',
  outOfOfficeMessage: '',
};

describe('ProfileSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.updateUser).mockResolvedValue({ success: true });
  });

  it('does not show saved when profile read-back does not confirm persisted values', async () => {
    const onUpdateUser = vi.fn();
    vi.mocked(Api.getMe).mockResolvedValue(baseUser);

    render(<ProfileSettings currentUser={baseUser as any} onUpdateUser={onUpdateUser} />);

    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), {
      target: { value: 'Jane D.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Profile changes were not confirmed by the server'
      );
    });

    expect(screen.queryByText('Saved!')).not.toBeInTheDocument();
    expect(onUpdateUser).not.toHaveBeenCalled();
  });

  it('shows saved only after getMe returns the persisted profile', async () => {
    const onUpdateUser = vi.fn();
    const persistedUser = { ...baseUser, displayName: 'Jane D.' };
    vi.mocked(Api.getMe).mockResolvedValue(persistedUser);

    render(<ProfileSettings currentUser={baseUser as any} onUpdateUser={onUpdateUser} />);

    fireEvent.change(screen.getByPlaceholderText('Jane Doe'), {
      target: { value: 'Jane D.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByText('Saved!')).toBeInTheDocument();
    });

    expect(onUpdateUser).toHaveBeenCalledWith(persistedUser);
  });
});
