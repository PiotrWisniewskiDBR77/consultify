import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminMembersRolesPanel } from '@/components/Admin/AdminMembersRolesPanel';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: {
    getOrganizationMembers: vi.fn().mockResolvedValue([
      {
        user_id: 'user-1',
        name: 'Owner User',
        email: 'owner@example.com',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    ]),
    post: vi.fn().mockResolvedValue({ code: { code: 'TENANT-CODE-123' } }),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme' },
    currentUser: { id: 'user-1', email: 'owner@example.com' },
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
  });

  it('generates tenant access codes through the P32 admin endpoint', async () => {
    render(<AdminMembersRolesPanel />);

    fireEvent.click(await screen.findByRole('button', { name: /Generate code/i }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/admin/access-codes', {
        role: 'MEMBER',
        maxUses: 50,
        expiresInDays: 7,
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

    const ownerOptions = screen.getAllByRole('option', { name: 'Owner' });
    expect(ownerOptions).toHaveLength(1);
    expect(ownerOptions[0]).toBeDisabled();

    const roleSelects = screen.getAllByRole('combobox') as HTMLSelectElement[];
    const ownerRoleSelect = roleSelects.find((select) => select.value === 'OWNER');
    expect(ownerRoleSelect).toBeDisabled();
  });
});
