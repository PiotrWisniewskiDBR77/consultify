import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';
import { OrganizationAdminPanel } from '@/components/Organization/OrganizationAdminPanel';

vi.mock('@/services/api', () => ({
  Api: {
    delete: vi.fn(),
    get: vi.fn(),
    getUserOrganizations: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme' },
  }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('OrganizationAdminPanel domains honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockResolvedValue([]);
  });

  it('does not claim custom domain success when organization read-back is stale', async () => {
    vi.mocked(Api.getUserOrganizations).mockResolvedValue([
      { id: 'org-1', custom_domain: '', domain_verified: false },
    ]);
    vi.mocked(Api.patch).mockResolvedValue({});

    render(<OrganizationAdminPanel section="domains" />);

    await waitFor(() => {
      expect(screen.getByText('Custom Domain')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('app.company.com'), {
      target: { value: 'app.acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save domain/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Custom domain save was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });

  it('does not claim approved email domain success when list read-back is stale', async () => {
    vi.mocked(Api.getUserOrganizations).mockResolvedValue([
      { id: 'org-1', custom_domain: '', domain_verified: false },
    ]);
    vi.mocked(Api.get).mockResolvedValue([]);
    vi.mocked(Api.post).mockResolvedValue({});

    render(<OrganizationAdminPanel section="domains" />);

    await waitFor(() => {
      expect(screen.getByText('Approved Email Domains')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('company.com'), {
      target: { value: 'acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/i }));

    await waitFor(() => {
      expect(
        screen.getByText('Approved email domain was not confirmed by the server')
      ).toBeInTheDocument();
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
