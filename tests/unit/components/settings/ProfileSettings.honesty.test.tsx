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

  it('has no independent regional writers and directs users to the canonical screen', () => {
    render(<ProfileSettings currentUser={baseUser as any} onUpdateUser={vi.fn()} />);

    expect(screen.queryByLabelText('Timezone')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Date Format')).not.toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /24-hour/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Regional Settings' })).toBeInTheDocument();
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

  it('keeps local edits when parent rerenders with a refreshed server snapshot', async () => {
    const onUpdateUser = vi.fn();
    const { rerender } = render(
      <ProfileSettings currentUser={{ ...baseUser, jobTitle: 'Platform SuperAdmin' } as any} onUpdateUser={onUpdateUser} />
    );

    fireEvent.change(screen.getByDisplayValue('Platform SuperAdmin'), {
      target: { value: 'Engineering Manager' },
    });
    expect(screen.getByDisplayValue('Engineering Manager')).toBeInTheDocument();

    rerender(
      <ProfileSettings
        currentUser={{ ...baseUser, jobTitle: 'Platform SuperAdmin', department: 'Finance' } as any}
        onUpdateUser={onUpdateUser}
      />
    );

    expect(screen.getByDisplayValue('Engineering Manager')).toBeInTheDocument();
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
      expect(
        screen.getByText('First name is required before saving', {
          selector: '#first-name-validation-error',
        })
      ).toBeInTheDocument();
    });
  });

  it('sanitizes repeated first name fragments during input', async () => {
    const onUpdateUser = vi.fn();
    render(<ProfileSettings currentUser={{ ...baseUser, firstName: 'Piotr' } as any} onUpdateUser={onUpdateUser} />);

    fireEvent.change(screen.getByDisplayValue('Piotr'), {
      target: { value: 'PiotrPiotrTestPiotr' },
    });

    expect(screen.getByDisplayValue('PiotrTest')).toBeInTheDocument();
  });

  it('strips the previous job title when a thrashed input appends it as a suffix', async () => {
    const onUpdateUser = vi.fn();
    const userWithTitle = { ...baseUser, jobTitle: 'Platform SuperAdmin' };
    const persistedUser = { ...userWithTitle, jobTitle: 'Engineering Manager' };
    vi.mocked(Api.getMe).mockResolvedValue(persistedUser);

    render(<ProfileSettings currentUser={userWithTitle as any} onUpdateUser={onUpdateUser} />);

    fireEvent.change(screen.getByDisplayValue('Platform SuperAdmin'), {
      target: { value: 'Engineering ManagerPlatform SuperAdmin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(Api.updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ jobTitle: 'Engineering Manager' })
      );
    });
  });

  it('strips the previous job title when typing appends after the buffered value', async () => {
    const onUpdateUser = vi.fn();
    const userWithTitle = { ...baseUser, jobTitle: 'Platform SuperAdmin' };
    const persistedUser = { ...userWithTitle, jobTitle: 'Engineering Manager' };
    vi.mocked(Api.getMe).mockResolvedValue(persistedUser);

    render(<ProfileSettings currentUser={userWithTitle as any} onUpdateUser={onUpdateUser} />);

    fireEvent.change(screen.getByDisplayValue('Platform SuperAdmin'), {
      target: { value: 'Platform SuperAdminEngineering Manager' },
    });

    expect(screen.getByDisplayValue('Engineering Manager')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(Api.updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ jobTitle: 'Engineering Manager' })
      );
    });
  });

  it('strips duplicated typed text plus the previous job title from thrashed payloads', async () => {
    const onUpdateUser = vi.fn();
    const userWithTitle = { ...baseUser, jobTitle: 'Platform SuperAdmin' };
    const persistedUser = { ...userWithTitle, jobTitle: 'Engineering Manager' };
    vi.mocked(Api.getMe).mockResolvedValue(persistedUser);

    render(<ProfileSettings currentUser={userWithTitle as any} onUpdateUser={onUpdateUser} />);

    fireEvent.change(screen.getByDisplayValue('Platform SuperAdmin'), {
      target: { value: 'Engineering ManagerEngineering ManagerPlatform SuperAdmin' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(Api.updateUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ jobTitle: 'Engineering Manager' })
      );
    });
  });

  it('sanitizes duplicated job title fragments during input', async () => {
    const onUpdateUser = vi.fn();
    const userWithTitle = { ...baseUser, jobTitle: 'Platform SuperAdmin' };

    render(<ProfileSettings currentUser={userWithTitle as any} onUpdateUser={onUpdateUser} />);

    fireEvent.change(screen.getByDisplayValue('Platform SuperAdmin'), {
      target: { value: 'Engineering Manager' },
    });
    expect(screen.getByDisplayValue('Engineering Manager')).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue('Engineering Manager'), {
      target: { value: 'Product LeadEngineering ManagerEngineering Man' },
    });

    expect(screen.getByDisplayValue('Product Lead')).toBeInTheDocument();
  });
});
