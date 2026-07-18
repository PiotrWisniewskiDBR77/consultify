import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OwnershipManagementView } from '@/views/admin/OwnershipManagementView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api/admin.api', () => ({
  AdminApi: {
    getOrganizationOwnership: vi.fn().mockResolvedValue({
      ownership: { ownerUserId: 'user-1', createdAt: '2026-04-26T00:00:00.000Z' },
      owner: {
        id: 'user-1',
        firstName: 'Owner',
        lastName: 'User',
        email: 'owner@example.com',
      },
    }),
    getOrganizationAdmins: vi.fn().mockResolvedValue([]),
    getPendingOwnershipTransfer: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme' },
    currentUser: { id: 'user-1', email: 'owner@example.com' },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('OwnershipManagementView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps ownership as a team safeguard and does not expose organization deletion', async () => {
    render(<OwnershipManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Organization Ownership')).toBeInTheDocument();
    });

    expect(
      screen.getByText('Manage the team owner and ownership transfer safeguards')
    ).toBeInTheDocument();
    expect(screen.getByText(/Owner since/i)).toBeInTheDocument();
    expect(screen.getByText(/cannot be removed from the team list/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Transfer Ownership/i })).toBeInTheDocument();
    expect(screen.queryByText('Delete Organization')).not.toBeInTheDocument();
    expect(screen.queryByText(/billing admin/i)).not.toBeInTheDocument();
  });
});
