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
    getProjects: vi.fn(),
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
    <MemoryRouter initialEntries={['/partner?tab=projects']}>
      <I18nextProvider i18n={i18n}>
        <PartnerPortalViewNew />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe('PartnerPortalView client projects V8 seam', () => {
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

  it('uses the V8 route first for client project reads', async () => {
    vi.mocked(V8PartnerApi.getProjects).mockResolvedValue({
      projects: [
        {
          id: 'project-1',
          name: 'Digital Transformation',
          clientId: 'org-1',
          clientName: 'ACME GmbH',
          framework: 'PMBOK',
          progress: 35,
          status: 'active',
          targetEndDate: '2026-06-30',
        },
      ],
    } as any);
    vi.mocked(shouldFallbackToLegacyPartner).mockReturnValue(false);

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Digital Transformation')).toBeInTheDocument();
    });

    expect(V8PartnerApi.getProjects).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/projects');
  });

  it('falls back to the legacy route for bounded project compatibility errors', async () => {
    vi.mocked(V8PartnerApi.getProjects).mockRejectedValue({ status: 404 });
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

      if (url === '/api/partners/projects') {
        return {
          success: true,
          data: {
            data: [
              {
                id: 'project-2',
                name: 'Fallback PMO Rollout',
                clientId: 'org-2',
                clientName: 'Fallback Industries',
                framework: 'AGILE',
                progress: 50,
                status: 'active',
              },
            ],
          },
        } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    renderView();

    await waitFor(() => {
      expect(screen.getByText('Fallback PMO Rollout')).toBeInTheDocument();
    });

    expect(Api.get).toHaveBeenCalledWith('/api/partners/projects');
  });
});
