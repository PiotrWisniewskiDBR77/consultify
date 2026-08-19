/**
 * AdminMembersRolesPanel — core membership UI tests (Module 17).
 *
 * Verifies the live admin people section loads members, exposes the role
 * guidance matrix (owner/admin/member/guest), and routes role changes through
 * the organization member API for owner/admin viewers.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../services/api';
import { AdminMembersRolesPanel } from '../AdminMembersRolesPanel';

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../views/admin/OwnershipManagementView', () => ({
  OwnershipManagementView: () => <div data-testid="ownership-view" />,
}));

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1' },
    currentUser: { id: 'viewer-admin' },
  }),
}));

vi.mock('../../../services/api', () => ({
  Api: {
    getOrganizationMembers: vi.fn(),
    getInvitations: vi.fn(),
    createAdminOrganizationInvitation: vi.fn(),
    resendOrganizationInvitation: vi.fn(),
    revokeOrganizationInvitation: vi.fn(),
    addOrganizationMember: vi.fn(),
    updateOrganizationMemberRole: vi.fn(),
    removeOrganizationMember: vi.fn(),
    changeAdminOrganizationMemberRole: vi.fn(),
    revokeAdminOrganizationMember: vi.fn(),
    post: vi.fn(),
  },
}));

const mockedApi = Api as unknown as Record<string, ReturnType<typeof vi.fn>>;

const members = [
  { user_id: 'viewer-admin', email: 'admin@acme.test', role: 'ADMIN', name: 'Admin User' },
  { user_id: 'member-1', email: 'member@acme.test', role: 'MEMBER', name: 'Member One' },
];

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mockedApi.getOrganizationMembers.mockResolvedValue(members);
  mockedApi.getInvitations.mockResolvedValue([]);
  mockedApi.changeAdminOrganizationMemberRole.mockResolvedValue({ success: true });
});

describe('AdminMembersRolesPanel', () => {
  it('loads members for the active organization', async () => {
    render(<AdminMembersRolesPanel />);
    await waitFor(() => expect(mockedApi.getOrganizationMembers).toHaveBeenCalledWith('org-1'));
    expect(await screen.findByText('member@acme.test')).toBeInTheDocument();
  });

  it('renders the role guidance matrix for all roles', async () => {
    render(<AdminMembersRolesPanel />);
    await screen.findByText('member@acme.test');
    // Each role label appears at least once (guidance card; some also as select options).
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Admin').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Member').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Guest').length).toBeGreaterThan(0);
    // The owner-only and guest denial guidance copy is present.
    expect(
      screen.getByText('Only an owner can assign or remove another owner.')
    ).toBeInTheDocument();
    expect(screen.getByText('Guests cannot access admin tools.')).toBeInTheDocument();
  });

  it('routes a role change through the organization member API', async () => {
    render(<AdminMembersRolesPanel />);
    const emailCell = await screen.findByText('member@acme.test');

    // Locate the member-1 table row and its role <select>.
    const row = emailCell.closest('tr');
    expect(row).toBeTruthy();
    const memberRoleSelect = row!.querySelector('select') as HTMLSelectElement;
    expect(memberRoleSelect).toBeTruthy();
    expect(memberRoleSelect.value).toBe('MEMBER');

    fireEvent.change(memberRoleSelect, { target: { value: 'ADMIN' } });

    await waitFor(() =>
      expect(mockedApi.changeAdminOrganizationMemberRole).toHaveBeenCalledWith(
        'org-1',
        'member-1',
        'ADMIN',
        'MEMBER',
        expect.any(String)
      )
    );
  });

  it('creates an invitation and accepts it only after exact server read-back', async () => {
    let invitationCreated = false;
    mockedApi.createAdminOrganizationInvitation.mockImplementation(async () => {
      invitationCreated = true;
      return { invitation: { id: 'invite-1' } };
    });
    mockedApi.getInvitations.mockImplementation(async () =>
      invitationCreated
        ? [{ id: 'invite-1', email: 'new@acme.test', role: 'MEMBER', status: 'pending' }]
        : []
    );

    render(<AdminMembersRolesPanel />);
    await screen.findByText('member@acme.test');
    fireEvent.change(screen.getByLabelText('Member email'), {
      target: { value: 'new@acme.test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add member' }));

    await waitFor(() =>
      expect(mockedApi.createAdminOrganizationInvitation).toHaveBeenCalledWith(
        'org-1',
        'new@acme.test',
        'MEMBER',
        expect.any(String)
      )
    );
    expect((await screen.findByText('new@acme.test')).closest('tr')).toBeInTheDocument();
  });

  it('resends and revokes a pending invitation with exact cold read-back', async () => {
    const pending = { id: 'invite-1', email: 'new@acme.test', role: 'MEMBER', status: 'pending' };
    mockedApi.getInvitations.mockResolvedValue([pending]);
    mockedApi.resendOrganizationInvitation.mockResolvedValue({ success: true });
    mockedApi.revokeOrganizationInvitation.mockResolvedValue({ success: true });

    render(<AdminMembersRolesPanel />);
    const row = (await screen.findByText('new@acme.test')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Resend' }));
    await waitFor(() =>
      expect(mockedApi.resendOrganizationInvitation).toHaveBeenCalledWith('org-1', 'invite-1', expect.any(String))
    );

    mockedApi.getInvitations.mockResolvedValue([
      { ...pending, status: 'revoked' },
    ]);
    fireEvent.click(within((await screen.findByText('new@acme.test')).closest('tr')!).getByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(mockedApi.revokeOrganizationInvitation).toHaveBeenCalledWith('org-1', 'invite-1', expect.any(String))
    );
    await waitFor(() => expect(within(screen.getByText('new@acme.test').closest('tr')!).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument());
  });
});
