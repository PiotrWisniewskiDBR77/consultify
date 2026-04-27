import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'react-hot-toast';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OrganizationProfileView } from '@/views/admin/OrganizationProfileView';

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentOrganization: { id: 'org-1', name: 'Acme' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('OrganizationProfileView honest UI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('does not render failed profile loads as editable seeded defaults', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })
    );

    render(<OrganizationProfileView />);

    await waitFor(() => {
      expect(screen.getByText('Organization profile unavailable')).toBeInTheDocument();
    });

    expect(screen.queryByText('Company Details')).not.toBeInTheDocument();
    expect(screen.queryByText('Technology')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save Changes/i })).toBeDisabled();
  });

  it('marks favicon upload read-only when profile data loads', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          exists: true,
          profile: {
            description: 'Loaded profile',
            industry: 'Consulting',
            companySize: '11-50',
          },
        }),
      })
    );

    render(<OrganizationProfileView />);

    await waitFor(() => {
      expect(screen.getByText('Company Details')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Branding/i }));

    await waitFor(() => {
      expect(screen.getByText('Favicon upload is read-only')).toBeInTheDocument();
    });
  });

  it('does not claim profile save success when read-back returns stale profile data', async () => {
    const fetchMock = vi.fn((url: string, options?: RequestInit) => {
      if (url === '/api/organization-profiles/org-1' && options?.method === 'PUT') {
        return Promise.resolve({
          ok: true,
          json: async () => ({}),
        });
      }

      return Promise.resolve({
        ok: true,
        json: async () => ({
          exists: true,
          profile: {
            description: 'Loaded profile',
            industry: 'Consulting',
            companySize: '11-50',
            website: '',
            logoUrl: '',
            faviconUrl: '',
            brandColor: '#8B5CF6',
            accentColor: '#10B981',
            customDomain: '',
            customDomainVerified: false,
            defaultTimezone: 'Europe/Warsaw',
            defaultLanguage: 'en',
            dateFormat: 'DD/MM/YYYY',
            timeFormat: '24h',
            currency: 'USD',
            linkedinUrl: '',
            twitterUrl: '',
          },
        }),
      });
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<OrganizationProfileView />);

    await waitFor(() => {
      expect(screen.getByText('Company Details')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Brief description of your organization...'), {
      target: { value: 'Updated profile' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Save Changes/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Organization profile save was not confirmed by the server'
      );
    });

    expect(toast.success).not.toHaveBeenCalled();
  });
});
