import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import PermissionsMatrixView from '@/views/superadmin/iam/PermissionsMatrixView';

vi.mock('@/services/api', () => ({
  Api: {
    getAdminPermissions: vi.fn(),
    getPermissionsMatrix: vi.fn(),
    getPermissionsStats: vi.fn(),
    toggleRolePermission: vi.fn(),
    copyRolePermissions: vi.fn(),
    createAdminPermission: vi.fn(),
    updateAdminPermission: vi.fn(),
    deleteAdminPermission: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const permission = { key: 'ai:use', description: 'Use AI features', category: 'ai' };

const matrix = {
  categories: {
    ai: [permission],
  },
  roles: ['admin', 'viewer'],
  matrix: {
    admin: {
      'ai:use': true,
    },
    viewer: {
      'ai:use': false,
    },
  },
};

describe('PermissionsMatrixView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getAdminPermissions).mockRejectedValue(new Error('Permissions backend down'));
    vi.mocked(Api.getPermissionsMatrix).mockResolvedValue({
      categories: {},
      roles: [],
      matrix: {},
    });
    vi.mocked(Api.getPermissionsStats).mockResolvedValue({
      totalPermissions: 0,
      systemPermissions: 0,
      customPermissions: 0,
      roleAssignments: {},
      categoryBreakdown: {},
    });
  });

  it('does not render permissions load failures as empty permission data', async () => {
    render(<PermissionsMatrixView />);

    await waitFor(() => {
      expect(screen.getByText('Permissions unavailable')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Permissions backend down').length).toBeGreaterThan(0);
    expect(screen.getByText('Permissions matrix unavailable')).toBeInTheDocument();
    expect(screen.getByText('Permission definitions unavailable')).toBeInTheDocument();

    expect(screen.queryByText('No permissions defined')).not.toBeInTheDocument();
    expect(screen.queryByText('Total Permissions')).not.toBeInTheDocument();

    expect(screen.getByRole('button', { name: /Copy Permissions/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Add Permission/i })).toBeDisabled();
    expect(Api.toggleRolePermission).not.toHaveBeenCalled();
    expect(Api.copyRolePermissions).not.toHaveBeenCalled();
  });

  it('does not claim permission toggle success when read-back is stale', async () => {
    vi.mocked(Api.getAdminPermissions).mockResolvedValue([permission]);
    vi.mocked(Api.getPermissionsMatrix).mockResolvedValue({
      categories: {
        ai: [permission],
      },
      roles: ['admin'],
      matrix: {
        admin: {
          'ai:use': false,
        },
      },
    });
    vi.mocked(Api.toggleRolePermission).mockResolvedValue({ success: true });

    render(<PermissionsMatrixView />);

    const grantButton = await screen.findByRole('button', {
      name: 'Grant ai:use for admin',
    });
    fireEvent.click(grantButton);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'Permission toggle was not confirmed by the server'
      );
    });
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Permission toggle was not confirmed by the server'
    );

    expect(toast.success).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', {
        name: 'Grant ai:use for admin',
      })
    ).toBeInTheDocument();
  });

  it('accepts wrapped permission, matrix, and stats payloads', async () => {
    vi.mocked(Api.getAdminPermissions).mockResolvedValue({
      data: { data: { permissions: [permission] } },
    });
    vi.mocked(Api.getPermissionsMatrix).mockResolvedValue({ data: { data: matrix } });
    vi.mocked(Api.getPermissionsStats).mockResolvedValue({
      data: {
        data: {
          totalPermissions: 1,
          systemPermissions: 0,
          customPermissions: 1,
          roleAssignments: { admin: 1, viewer: 0 },
          categoryBreakdown: { ai: 1 },
        },
      },
    });

    render(<PermissionsMatrixView />);

    expect(await screen.findByRole('button', { name: 'Revoke ai:use for admin' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grant ai:use for viewer' })).toBeInTheDocument();
  });

  it('does not claim permission copy success when target role read-back remains stale', async () => {
    vi.mocked(Api.getAdminPermissions).mockResolvedValue([permission]);
    vi.mocked(Api.getPermissionsMatrix).mockResolvedValue(matrix);
    vi.mocked(Api.copyRolePermissions).mockResolvedValue({ success: true });

    render(<PermissionsMatrixView />);

    await screen.findByRole('button', { name: 'Grant ai:use for viewer' });
    fireEvent.click(screen.getByRole('button', { name: /Copy Permissions/i }));
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'admin' } });
    fireEvent.change(selects[1], { target: { value: 'viewer' } });
    fireEvent.click(screen.getAllByRole('button', { name: /Copy Permissions/i }).at(-1)!);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Permission copy was not confirmed by the server'
      );
    });
    expect(toast.success).not.toHaveBeenCalled();
    expect(screen.getByText('Copy Permissions Between Roles')).toBeInTheDocument();
  });

  it('does not render malformed permission payloads as empty definitions', async () => {
    vi.mocked(Api.getAdminPermissions).mockResolvedValue({ unexpected: true });
    vi.mocked(Api.getPermissionsMatrix).mockResolvedValue(matrix);

    render(<PermissionsMatrixView />);

    await waitFor(() => {
      expect(screen.getByText('Permissions unavailable')).toBeInTheDocument();
    });
    expect(screen.getAllByText('Permissions response was not a list').length).toBeGreaterThan(0);
    expect(screen.queryByText('No permissions defined')).not.toBeInTheDocument();
  });
});
