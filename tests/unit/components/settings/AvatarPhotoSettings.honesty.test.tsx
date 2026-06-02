import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import toast from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { User } from '@/types';
import { AvatarPhotoSettings } from '@/components/settings/AvatarPhotoSettings';

vi.mock('react-hot-toast', () => ({
  default: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    uploadAvatar: vi.fn(),
    removeAvatar: vi.fn(),
    getMe: vi.fn(),
  },
}));

const baseUser = {
  id: 'user-1',
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  role: 'USER',
};

const asUser = (user: Partial<User>) => user as User;

describe('AvatarPhotoSettings honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:avatar-preview'),
      revokeObjectURL: vi.fn(),
    });
    vi.mocked(Api.uploadAvatar).mockResolvedValue({ avatarUrl: 'https://cdn.example.com/new.png' });
    vi.mocked(Api.removeAvatar).mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not claim upload success when profile read-back returns the old avatar', async () => {
    const onUpdateUser = vi.fn();
    vi.mocked(Api.getMe).mockResolvedValue(
      asUser({ ...baseUser, avatarUrl: 'https://cdn.example.com/old.png' })
    );

    render(<AvatarPhotoSettings currentUser={asUser(baseUser)} onUpdateUser={onUpdateUser} />);

    fireEvent.drop(screen.getByLabelText('Upload profile photo'), {
      dataTransfer: {
        files: [new File(['avatar'], 'avatar.png', { type: 'image/png' })],
      },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Photo/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Profile photo upload was not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(onUpdateUser).not.toHaveBeenCalled();
    expect(screen.getByText('avatar.png')).toBeInTheDocument();
  });

  it('does not claim removal success when profile read-back still has an avatar', async () => {
    const onUpdateUser = vi.fn();
    vi.mocked(Api.getMe).mockResolvedValue(
      asUser({ ...baseUser, avatarUrl: 'https://cdn.example.com/old.png' })
    );

    render(
      <AvatarPhotoSettings
        currentUser={asUser({ ...baseUser, avatarUrl: 'https://cdn.example.com/old.png' })}
        onUpdateUser={onUpdateUser}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Remove Photo/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Profile photo removal was not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(onUpdateUser).not.toHaveBeenCalled();
  });
});
