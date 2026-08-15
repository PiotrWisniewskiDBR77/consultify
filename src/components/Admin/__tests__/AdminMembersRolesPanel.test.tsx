/**
 * AdminMembersRolesPanel — core membership UI tests (Module 17).
 *
 * Verifies the live admin people section loads members, exposes the role
 * guidance matrix (owner/admin/member/guest), and routes role changes through
 * the organization member API for owner/admin viewers.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (
      key: string,
      fallback?: string | Record<string, unknown>,
      values?: Record<string, unknown>
    ) => {
      const translations: Record<string, string> = {
        'admin.membersRoles.guidance.owner.denial':
          'Only an owner can assign or remove another owner.',
        'admin.membersRoles.guidance.guest.denial': 'Guests cannot access admin tools.',
      };
      const options = typeof fallback === 'object' ? fallback : (values ?? {});
      const template =
        translations[key] ??
        (typeof fallback === 'string' ? fallback : String(options.defaultValue ?? key));
      return template.replace(/{{(\w+)}}/g, (_match, name: string) => String(options[name] ?? ''));
    },
    i18n: { language: 'en' },
  }),
}));

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
    addOrganizationMember: vi.fn(),
    updateOrganizationMemberRole: vi.fn(),
    removeOrganizationMember: vi.fn(),
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
  mockedApi.getOrganizationMembers.mockResolvedValue(members);
  mockedApi.updateOrganizationMemberRole.mockResolvedValue({ success: true });
});

describe('AdminMembersRolesPanel', () => {
  it('loads members for the active organization', async () => {
    render(<AdminMembersRolesPanel />);
    await waitFor(() => expect(mockedApi.getOrganizationMembers).toHaveBeenCalledWith('org-1'));
    expect(await screen.findByText('member@acme.test')).toBeInTheDocument();
  });

  it('gives every rendered role selector an accessible name', async () => {
    render(<AdminMembersRolesPanel />);
    await screen.findByText('member@acme.test');

    const selects = screen.getAllByRole('combobox');
    expect(selects.length).toBeGreaterThan(0);
    for (const select of selects) {
      expect(select).toHaveAccessibleName();
    }
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
      expect(mockedApi.updateOrganizationMemberRole).toHaveBeenCalledWith(
        'org-1',
        'member-1',
        'ADMIN'
      )
    );
  });
});
