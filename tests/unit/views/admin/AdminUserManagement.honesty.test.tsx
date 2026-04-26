import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { AdminUserManagement } from '@/views/admin/AdminUserManagement';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/hooks/useUserCan', () => ({
  useUserCan: () => ({
    canDelete: true,
    canEdit: true,
  }),
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: { id: 'admin-1' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getUsers: vi.fn(),
    getUserPlans: vi.fn(),
  },
}));

describe('AdminUserManagement honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(Api.getUsers).mockRejectedValue(new Error('Tenant users backend down'));
    vi.mocked(Api.getUserPlans).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render failed tenant user loads as an empty member table', async () => {
    render(<AdminUserManagement />);

    await waitFor(() => {
      expect(screen.getByText('Users unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No users found')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search users...')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Add User/i })).toBeDisabled();
    screen.getAllByRole('combobox').forEach((combobox) => {
      expect(combobox).toBeDisabled();
    });
  });
});
