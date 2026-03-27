import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import i18n from '../../../src/i18n';

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8', () => ({
  V8PartnerApi: {
    getClients: vi.fn(),
    getReferralAnalytics: vi.fn(),
    getEarningsSummary: vi.fn(),
  },
  shouldFallbackToLegacyPartner: vi.fn(),
}));

import { Api } from '../../../src/services/api';
import { shouldFallbackToLegacyPartner, V8PartnerApi } from '../../../src/services/api/v8';
import { PartnerPortalViewNew } from '../../../src/views/partner/PartnerPortalView';

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/partner?tab=organizations']}>
      <I18nextProvider i18n={i18n}>
        <PartnerPortalViewNew />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe('PartnerPortalView client organizations V8 seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/connection') {
        return {
          success: true,
          data: {
            data: {
              connected: true,
              organization: { name: 'Test Partner Co' },
            },
          },
        } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('uses the V8 route first for client organizations reads', async () => {
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
    vi.mocked(shouldFallbackToLegacyPartner).mockReturnValue(false);

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Client Organizations')).toBeInTheDocument();
      expect(screen.getByText('ACME GmbH')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getClients).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/clients');
  });

  it('falls back to the legacy route for bounded client compatibility errors', async () => {
    vi.mocked(V8PartnerApi.getClients).mockRejectedValue({ status: 404 });
    vi.mocked(shouldFallbackToLegacyPartner).mockReturnValue(true);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/connection') {
        return {
          success: true,
          data: {
            data: {
              connected: true,
              organization: { name: 'Test Partner Co' },
            },
          },
        } as any;
      }

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

      throw new Error(`Unexpected GET ${url}`);
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Fallback Industries')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/partners/clients');
  });
});
