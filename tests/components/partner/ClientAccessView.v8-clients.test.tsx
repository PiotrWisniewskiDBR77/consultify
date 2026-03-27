/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/services/api/v8', () => ({
  V8PartnerApi: {
    getClients: vi.fn(),
  },
  shouldFallbackToLegacyPartner: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { Api } from '@/services/api';
import { V8PartnerApi } from '@/services/api/v8';
import { ClientAccessView } from '@/views/partner/ClientAccessView';

describe('ClientAccessView partner clients seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/employees') {
        return { success: true, data: [] } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('prefers governed partner clients before legacy fallback', async () => {
    vi.mocked(V8PartnerApi.getClients).mockResolvedValue({
      clients: [
        {
          id: 'org-1',
          organizationId: 'org-1',
          name: 'ACME GmbH',
          organizationName: 'ACME GmbH',
          clientName: 'ACME GmbH',
          status: 'active',
          accessLevel: 'referral link',
          users: 0,
          userCount: 0,
          projects: 0,
          assessmentScore: 0,
          industry: 'Unspecified',
          region: null,
          plan: null,
        },
      ],
    } as any);

    render(
      <MemoryRouter>
        <ClientAccessView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('ACME GmbH')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getClients).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/clients');
  });

  it('falls back to legacy partner clients on bounded compatibility statuses', async () => {
    vi.mocked(V8PartnerApi.getClients).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/clients') {
        return {
          success: true,
          data: {
            data: [
              {
                id: 'org-2',
                name: 'Fallback Industries',
                status: 'active',
                industry: 'Unspecified',
                users: 0,
                projects: 0,
                assessmentScore: 0,
              },
            ],
          },
        } as any;
      }

      if (url === '/api/partners/employees') {
        return { success: true, data: [] } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(
      <MemoryRouter>
        <ClientAccessView />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Fallback Industries')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/partners/clients');
  });
});
