import { render, screen, waitFor } from '@testing-library/react';
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
});
