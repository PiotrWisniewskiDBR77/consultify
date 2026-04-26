import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { OrganizationsView } from '@/views/superadmin/OrganizationsView';

vi.mock('@/components/shared/InfoButton', () => ({
  InfoButton: () => null,
}));

vi.mock('@/views/superadmin/SuperAdminOrgDetailsModal', () => ({
  SuperAdminOrgDetailsModal: () => null,
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/services/api', () => ({
  Api: {
    getOrganizations: vi.fn(),
    getAccessRequests: vi.fn(),
    getAccessCodes: vi.fn(),
  },
}));

describe('OrganizationsView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render organization load failures as an empty organization table', async () => {
    vi.mocked(Api.getOrganizations).mockRejectedValue(new Error('Organization backend down'));
    vi.mocked(Api.getAccessRequests).mockResolvedValue([]);
    vi.mocked(Api.getAccessCodes).mockResolvedValue([]);

    render(<OrganizationsView />);

    await waitFor(() => {
      expect(screen.getByText('Organizations unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('No organizations found')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search organizations...')).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: /Pending Requests/i }));
    expect(screen.getByText('Access requests unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No access requests found.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Access Codes/i }));
    expect(screen.getByText('Access codes unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No access codes generated yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate New Code/i })).toBeDisabled();
  });

  it('keeps organizations visible while degraded access requests and codes are unavailable', async () => {
    vi.mocked(Api.getOrganizations).mockResolvedValue([
      {
        id: 'org-1',
        name: 'Acme',
        plan: 'pro',
        status: 'active',
        user_count: 3,
        created_at: '2026-01-01T00:00:00.000Z',
      },
    ]);
    vi.mocked(Api.getAccessRequests).mockRejectedValue(new Error('Requests down'));
    vi.mocked(Api.getAccessCodes).mockRejectedValue(new Error('Codes down'));

    render(<OrganizationsView />);

    await waitFor(() => {
      expect(screen.getByText('Acme')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Pending Requests/i }));
    expect(screen.getByText('Access requests unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No access requests found.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Access Codes/i }));
    expect(screen.getByText('Access codes unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No access codes generated yet.')).not.toBeInTheDocument();
  });
});
