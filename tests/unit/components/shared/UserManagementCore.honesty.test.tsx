import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { UserManagementCore } from '@/components/shared/UserManagementCore';

vi.mock('@/views/superadmin/components/UserAssignmentsPanel', () => ({
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
    updateSuperAdminUser: vi.fn(),
    createSuperAdminUser: vi.fn(),
  },
}));

describe('UserManagementCore honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getSuperAdminUsers).mockRejectedValue(new Error('Users backend down'));
    vi.mocked(Api.getUsers).mockRejectedValue(new Error('Users backend down'));
    vi.mocked(Api.getUserPlans).mockResolvedValue([]);
    vi.mocked(Api.updateSuperAdminUser).mockResolvedValue(undefined);
    vi.mocked(Api.createSuperAdminUser).mockResolvedValue({} as any);
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

  it('saves project role, department and job title from edit modal', async () => {
    vi.mocked(Api.getSuperAdminUsers).mockResolvedValue([
      {
        id: 'user-1',
        firstName: 'Alicja',
        lastName: 'Nowak',
        email: 'alicja@example.com',
        role: 'USER',
        status: 'active',
        projectRole: 'TEAM_LEAD',
        department: 'Operations',
        jobTitle: 'Ops Manager',
      } as any,
    ]);

    render(<UserManagementCore mode="platform" organizations={[]} showInvite />);

    await waitFor(() => {
      expect(screen.getByText('Alicja Nowak')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Edit'));

    const projectRoleSelect = screen.getByDisplayValue('TEAM_LEAD');
    const departmentInput = screen.getByDisplayValue('Operations');
    const jobTitleInput = screen.getByDisplayValue('Ops Manager');

    fireEvent.change(projectRoleSelect, { target: { value: 'PROJECT_MANAGER' } });
    fireEvent.change(departmentInput, { target: { value: 'Manufacturing' } });
    fireEvent.change(jobTitleInput, { target: { value: 'Plant Lead' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(Api.updateSuperAdminUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          projectRole: 'PROJECT_MANAGER',
          department: 'Manufacturing',
          jobTitle: 'Plant Lead',
        })
      );
    });
  });
});
