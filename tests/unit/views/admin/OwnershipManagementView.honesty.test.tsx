import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminApi } from '@/services/api/admin.api';
import { OwnershipManagementView } from '@/views/admin/OwnershipManagementView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/services/api/admin.api', () => ({
  AdminApi: {
    getOrganizationOwnership: vi.fn(),
    getOrganizationAdmins: vi.fn(),
    getPendingOwnershipTransfer: vi.fn(),
    transferOrganizationOwnership: vi.fn(),
    cancelOrganizationOwnershipTransfer: vi.fn(),
    acceptOrganizationOwnershipTransfer: vi.fn(),
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

const ownershipResponse = {
  ownership: { ownerUserId: 'user-1', createdAt: '2026-04-26T00:00:00.000Z' },
  owner: {
    id: 'user-1',
    firstName: 'Owner',
    lastName: 'User',
    email: 'owner@example.com',
  },
};

describe('OwnershipManagementView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('does not render failed ownership loads as an empty owner card', async () => {
    vi.mocked(AdminApi.getOrganizationOwnership).mockRejectedValue(new Error('Ownership down'));
    vi.mocked(AdminApi.getOrganizationAdmins).mockResolvedValue([]);
    vi.mocked(AdminApi.getPendingOwnershipTransfer).mockResolvedValue(null);

    render(<OwnershipManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Ownership information unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('OWNER')).not.toBeInTheDocument();
    expect(screen.queryByText('Initial Setup')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Transfer Ownership/i })).not.toBeInTheDocument();
  });

  it('marks pending transfer status degraded without hiding loaded ownership details', async () => {
    vi.mocked(AdminApi.getOrganizationOwnership).mockResolvedValue(ownershipResponse);
    vi.mocked(AdminApi.getOrganizationAdmins).mockResolvedValue([]);
    vi.mocked(AdminApi.getPendingOwnershipTransfer).mockRejectedValue(new Error('Transfer down'));

    render(<OwnershipManagementView />);

    await waitFor(() => {
      expect(screen.getByText('Owner User')).toBeInTheDocument();
    });

    expect(screen.getByText('Pending ownership transfer status unavailable')).toBeInTheDocument();
    expect(screen.getByText('OWNER')).toBeInTheDocument();
  });
});
