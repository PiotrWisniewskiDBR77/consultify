import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { UserManagementCore } from '@/components/shared/UserManagementCore';

vi.mock('@/components/Admin/UserAssignmentsPanel', () => ({
  UserAssignmentsPanel: () => <div>User assignments</div>,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getSuperAdminUsers: vi.fn(),
    getUsers: vi.fn(),
    getUserPlans: vi.fn(),
  },
}));

describe('UserManagementCore honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getSuperAdminUsers).mockRejectedValue(new Error('Users backend down'));
    vi.mocked(Api.getUsers).mockRejectedValue(new Error('Users backend down'));
    vi.mocked(Api.getUserPlans).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render user load failures as an empty user table', async () => {
    render(
      <UserManagementCore
        mode="platform"
        organizations={[{ id: 'org-1', name: 'Acme', status: 'active' }]}
        showInvite
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Users unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search users...')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Invite User/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Add User/i })).toBeDisabled();
  });
});
