/**
 * M15-H03 — awaria odczytu członków NIE MOŻE udawać pustej organizacji.
 *
 * Regresja: `catch` robił `toast.error(...)` + `setMembers([])`, więc po zniknięciu
 * toastu administrator widział tabelę z komunikatem „No members found for this
 * workspace." dla organizacji, która ma ludzi. Błąd 500 backendu wyglądał
 * identycznie jak prawdziwie pusta lista.
 */

import { render, screen, waitFor } from '@testing-library/react';
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

describe('M15-H03 — błąd odczytu członków jest jawnym stanem błędu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.getInvitations.mockResolvedValue([]);
  });

  it('pokazuje stan błędu, gdy API zwraca 500', async () => {
    mockedApi.getOrganizationMembers.mockRejectedValue(new Error('Internal Server Error'));

    render(<AdminMembersRolesPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('members-load-error')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('NIE degraduje błędu do komunikatu o braku członków', async () => {
    mockedApi.getOrganizationMembers.mockRejectedValue(new Error('Internal Server Error'));

    render(<AdminMembersRolesPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('members-load-error')).toBeInTheDocument();
    });
    expect(screen.queryByText(/No members found for this workspace/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Nie znaleziono członków/i)).not.toBeInTheDocument();
  });

  it('udostępnia ponowienie próby', async () => {
    mockedApi.getOrganizationMembers.mockRejectedValue(new Error('Internal Server Error'));

    render(<AdminMembersRolesPanel />);

    await waitFor(() => {
      expect(screen.getByTestId('members-load-error')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /Spróbuj ponownie|Try again/i })).toBeInTheDocument();
  });

  it('prawdziwie pusta lista nadal pokazuje stan pusty, a nie błąd', async () => {
    mockedApi.getOrganizationMembers.mockResolvedValue([]);

    render(<AdminMembersRolesPanel />);

    await waitFor(() => {
      expect(screen.queryByTestId('members-load-error')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/No members found for this workspace/i)).toBeInTheDocument();
  });
});
