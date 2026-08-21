import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminMembersRolesPanel } from '@/components/Admin/AdminMembersRolesPanel';
import { Api } from '@/services/api';

let mockedUser = { id: 'user-1', email: 'owner@example.com', role: 'OWNER' };
let mockedMembers: any[] = [];

vi.mock('@/services/api', () => ({
  Api: {
    getOrganizationMembers: vi.fn(() => Promise.resolve(mockedMembers)),
    post: vi.fn().mockResolvedValue({ code: { code: 'TENANT-CODE-123' } }),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme' },
    currentUser: mockedUser,
  }),
}));

vi.mock('@/views/admin/OwnershipManagementView', () => ({
  OwnershipManagementView: () => <div>Ownership management</div>,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AdminMembersRolesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUser = { id: 'user-1', email: 'owner@example.com', role: 'OWNER' };
    mockedMembers = [{ user_id: 'user-1', name: 'Owner User', email: 'owner@example.com', role: 'OWNER', status: 'ACTIVE' }];
  });

  it('does not render forbidden management controls for a read-only member persona', async () => {
    mockedUser = { id: 'user-2', email: 'member@example.com', role: 'USER' };
    mockedMembers = [
      { user_id: 'user-1', email: 'owner@example.com', role: 'OWNER', status: 'ACTIVE' },
      { user_id: 'user-2', email: 'member@example.com', role: 'MEMBER', status: 'ACTIVE' },
    ];

    render(<AdminMembersRolesPanel />);

    expect(await screen.findByText(/Read-only access/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add member/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Generate code/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Team Invite Code')).not.toBeInTheDocument();
    expect(screen.queryByText('Ownership management')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('generates tenant access codes through the access-codes generate endpoint', async () => {
    render(<AdminMembersRolesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /Generate code/i }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/access-codes/generate', {
        type: 'INVITE',
        organizationId: 'org-1',
        maxUses: 50,
        expiresInDays: 7,
        metadata: { invitedRole: 'MEMBER' },
      });
    });
    expect(await screen.findByText('TENANT-CODE-123')).toBeInTheDocument();
  });

  it('keeps tenant admin focused on team management and routes ownership through safeguards', async () => {
    render(<AdminMembersRolesPanel />);

    expect(await screen.findByText('Members & Roles')).toBeInTheDocument();
    expect(screen.getByText('Team Invite Code')).toBeInTheDocument();
    expect(screen.getByText('Ownership management')).toBeInTheDocument();
    expect(screen.queryByText(/security, collaboration, integrations, and audit/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Maximum participant registrations')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Maximum team registrations')).toBeInTheDocument();

    const ownerOptions = (await screen.findAllByRole('option', { name: 'Owner' })).filter((option) =>
      option.closest('tr')
    );
    expect(ownerOptions).toHaveLength(1);
    expect(ownerOptions[0]).toBeDisabled();

    const roleSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const ownerRoleSelect = roleSelects.find((select) => select.value === 'OWNER');
    expect(ownerRoleSelect).toBeDisabled();
  });
});
