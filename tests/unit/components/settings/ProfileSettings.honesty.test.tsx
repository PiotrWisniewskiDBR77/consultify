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

  it('sends only changed profile fields when saving', async () => {
    const onUpdateUser = vi.fn();
    const persistedUser = { ...baseUser, department: 'Operations' };
    vi.mocked(Api.getMe).mockResolvedValue(persistedUser);

    render(<ProfileSettings currentUser={baseUser as any} onUpdateUser={onUpdateUser} />);

    fireEvent.change(screen.getByDisplayValue('Select department...'), {
      target: { value: 'Operations' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(Api.updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ department: 'Operations' })
      );
    });

    const payload = vi.mocked(Api.updateUser).mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.firstName).toBeUndefined();
    expect(payload.phone).toBeUndefined();
    expect(payload.jobTitle).toBeUndefined();
  });

  it('blocks save and shows validation when first name is empty', async () => {
    const onUpdateUser = vi.fn();

    render(<ProfileSettings currentUser={baseUser as any} onUpdateUser={onUpdateUser} />);

    fireEvent.change(screen.getByDisplayValue('Jane'), {
      target: { value: '   ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('First name is required before saving');
    });
    expect(Api.updateUser).not.toHaveBeenCalled();
    expect(Api.getMe).not.toHaveBeenCalled();
  });

  it('keeps local edits when parent rerenders with same user snapshot', async () => {
    const onUpdateUser = vi.fn();
    const { rerender } = render(
      <ProfileSettings currentUser={{ ...baseUser } as any} onUpdateUser={onUpdateUser} />
    );

    const firstNameInput = screen.getByDisplayValue('Jane');
    fireEvent.change(firstNameInput, { target: { value: 'Janet' } });
    expect(screen.getByDisplayValue('Janet')).toBeInTheDocument();

    // Simulate parent re-render with a new object identity but unchanged persisted data
    rerender(<ProfileSettings currentUser={{ ...baseUser } as any} onUpdateUser={onUpdateUser} />);

    expect(screen.getByDisplayValue('Janet')).toBeInTheDocument();
  });

  it('marks first name field invalid on empty save attempt', async () => {
    const onUpdateUser = vi.fn();
    render(<ProfileSettings currentUser={baseUser as any} onUpdateUser={onUpdateUser} />);

    const firstNameInput = screen.getByDisplayValue('Jane');
    fireEvent.change(firstNameInput, {
      target: { value: '' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(firstNameInput).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByText('First name is required before saving')).toBeInTheDocument();
    });
  });
});
