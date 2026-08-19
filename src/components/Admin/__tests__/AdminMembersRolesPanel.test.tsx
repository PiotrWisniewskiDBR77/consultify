/**
 * AdminMembersRolesPanel — core membership UI tests (Module 17).
 *
 * Verifies the live admin people section loads members, exposes the role
 * guidance matrix (owner/admin/member/guest), and routes role changes through
 * the organization member API for owner/admin viewers.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { toast } from 'react-hot-toast';
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

const findTableText = async (text: string) =>
  (await screen.findAllByText(text)).find((node) => node.closest('tr'))!;

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
    expect((await screen.findAllByText('member@acme.test')).length).toBeGreaterThan(0);
  });

  it('renders the role guidance matrix for all roles', async () => {
    render(<AdminMembersRolesPanel />);
    await screen.findAllByText('member@acme.test');
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
    let changed = false;
    mockedApi.changeAdminOrganizationMemberRole.mockImplementation(async () => {
      changed = true;
      return { success: true };
    });
    mockedApi.getOrganizationMembers.mockImplementation(async () =>
      changed ? members.map((member) => member.user_id === 'member-1' ? { ...member, role: 'ADMIN' } : member) : members
    );
    render(<AdminMembersRolesPanel />);
    const emailCell = await findTableText('member@acme.test');

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
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Member role updated'));
  });

  it('does not report role success when exact read-back contradicts the command', async () => {
    render(<AdminMembersRolesPanel />);
    const row = (await findTableText('member@acme.test')).closest('tr')!;
    fireEvent.change(row.querySelector('select')!, { target: { value: 'ADMIN' } });

    await waitFor(() => expect(mockedApi.changeAdminOrganizationMemberRole).toHaveBeenCalled());
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        'Role command completed without exact member read-back. Retry uses the same command identity.'
      )
    );
    expect(toast.success).not.toHaveBeenCalledWith('Member role updated');
  });

  it('reconciles a stale role conflict and gives the next intent a fresh command identity', async () => {
    const serverMembers = members.map((member) =>
      member.user_id === 'member-1' ? { ...member, role: 'GUEST' } : member
    );
    mockedApi.getOrganizationMembers
      .mockResolvedValueOnce(members)
      .mockResolvedValue(serverMembers);
    mockedApi.changeAdminOrganizationMemberRole
      .mockRejectedValueOnce(new Error('Membership changed; refresh before retrying'))
      .mockResolvedValueOnce({ success: true });

    render(<AdminMembersRolesPanel />);
    const initialRow = (await findTableText('member@acme.test')).closest('tr')!;
    fireEvent.change(initialRow.querySelector('select')!, { target: { value: 'ADMIN' } });

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Membership changed on the server. Current role: Guest. Review and retry.'
      )
    );
    const firstCommandId = mockedApi.changeAdminOrganizationMemberRole.mock.calls[0][4];
    const reconciledRow = (await findTableText('member@acme.test')).closest('tr')!;
    expect((reconciledRow.querySelector('select') as HTMLSelectElement).value).toBe('GUEST');

    mockedApi.getOrganizationMembers.mockResolvedValue(
      serverMembers.map((member) =>
        member.user_id === 'member-1' ? { ...member, role: 'ADMIN' } : member
      )
    );
    fireEvent.change(reconciledRow.querySelector('select')!, { target: { value: 'ADMIN' } });
    await waitFor(() => expect(mockedApi.changeAdminOrganizationMemberRole).toHaveBeenCalledTimes(2));
    expect(mockedApi.changeAdminOrganizationMemberRole.mock.calls[1][3]).toBe('GUEST');
    expect(mockedApi.changeAdminOrganizationMemberRole.mock.calls[1][4]).not.toBe(firstCommandId);
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
    await screen.findAllByText('member@acme.test');
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
    expect((await findTableText('new@acme.test')).closest('tr')).toBeInTheDocument();
  });

  it('resends and revokes a pending invitation with exact cold read-back', async () => {
    let resendCount = 0;
    const pending = { id: 'invite-1', email: 'new@acme.test', role: 'MEMBER', status: 'pending', resend_count: 0 };
    mockedApi.getInvitations.mockImplementation(async () => [{ ...pending, resend_count: resendCount }]);
    mockedApi.resendOrganizationInvitation.mockImplementation(async () => {
      resendCount += 1;
      return { success: true };
    });
    mockedApi.revokeOrganizationInvitation.mockResolvedValue({ success: true });

    render(<AdminMembersRolesPanel />);
    const row = (await findTableText('new@acme.test')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: 'Resend' }));
    await waitFor(() =>
      expect(mockedApi.resendOrganizationInvitation).toHaveBeenCalledWith('org-1', 'invite-1', expect.any(String))
    );

    mockedApi.getInvitations.mockResolvedValue([
      { ...pending, status: 'revoked' },
    ]);
    fireEvent.click(within((await findTableText('new@acme.test')).closest('tr')!).getByRole('button', { name: 'Revoke' }));
    await waitFor(() =>
      expect(mockedApi.revokeOrganizationInvitation).toHaveBeenCalledWith('org-1', 'invite-1', expect.any(String))
    );
    await waitFor(async () => expect(within((await findTableText('new@acme.test')).closest('tr')!).queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument());
  });

  it('requires confirmation and exact absence before reporting a member removal', async () => {
    let removed = false;
    mockedApi.revokeAdminOrganizationMember.mockImplementation(async () => {
      removed = true;
      return { success: true };
    });
    mockedApi.getOrganizationMembers.mockImplementation(async () =>
      removed ? members.filter((member) => member.user_id !== 'member-1') : members
    );

    render(<AdminMembersRolesPanel />);
    const row = (await findTableText('member@acme.test')).closest('tr')!;
    fireEvent.click(within(row).getByRole('button', { name: /row actions/i }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));

    expect(mockedApi.revokeAdminOrganizationMember).not.toHaveBeenCalled();
    const dialog = await screen.findByRole('dialog', { name: 'Remove workspace member?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove member' }));

    await waitFor(() => expect(mockedApi.revokeAdminOrganizationMember).toHaveBeenCalled());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Member removed'));
    expect(screen.queryByText('member@acme.test')).not.toBeInTheDocument();
  });
});
