import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AdminUserManagement } from '@/views/admin/AdminUserManagement';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/hooks/useUserCan', () => ({
  useUserCan: () => ({
    canDelete: true,
    canEdit: true,
  }),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: { id: 'admin-1' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getUsers: vi.fn(),
    getUserPlans: vi.fn(),
    addUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
  },
}));

describe('AdminUserManagement honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getUsers).mockRejectedValue(new Error('Tenant users backend down'));
    vi.mocked(Api.getUserPlans).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render failed tenant user loads as an empty member table', async () => {
    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('Users unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search users...')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Add User/i })).toBeDisabled();
    screen.getAllByRole('combobox').forEach((combobox) => {
      expect(combobox).toBeDisabled();
    });
  });

  it('refetches tenant users after add and status update workflows', async () => {
    vi.stubGlobal('confirm', vi.fn(() => true));
    const activeUser = {
      id: 'user-1',
      firstName: 'Ada',
      lastName: 'Admin',
      email: 'ada@example.com',
      role: 'USER',
      status: 'active',
    };
    const inactiveUser = { ...activeUser, status: 'inactive' };

    vi.mocked(Api.getUsers)
      .mockResolvedValueOnce({ users: [] })
      .mockResolvedValueOnce({ users: [activeUser] })
      .mockResolvedValueOnce({ users: [inactiveUser] });
    vi.mocked(Api.getUserPlans).mockResolvedValue([]);
    vi.mocked(Api.addUser).mockResolvedValue({ id: 'user-1' });
    vi.mocked(Api.updateUser).mockResolvedValue({ success: true });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add User/i }));
    fireEvent.change(screen.getByPlaceholderText('First Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Admin' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(Api.addUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Ada',
          lastName: 'Admin',
          email: 'ada@example.com',
        })
      );
      expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Deactivate user'));
    await waitFor(() => {
      expect(Api.updateUser).toHaveBeenCalledWith('user-1', { status: 'inactive' });
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
    expect(Api.getUsers).toHaveBeenCalledTimes(3);
  });

  it('does not claim user creation success when tenant users read-back is stale', async () => {
    vi.mocked(Api.getUsers)
      .mockResolvedValueOnce({ users: [] })
      .mockResolvedValueOnce({ users: [] });
    vi.mocked(Api.getUserPlans).mockResolvedValue([]);
    vi.mocked(Api.addUser).mockResolvedValue({ id: 'user-1' });

    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('No users found')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add User/i }));
    fireEvent.change(screen.getByPlaceholderText('First Name'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByPlaceholderText('Last Name'), { target: { value: 'Admin' } });
    fireEvent.change(screen.getByPlaceholderText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'User creation was not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalledWith('User created');
    expect(screen.getByText('Add New User')).toBeInTheDocument();
  });
});
