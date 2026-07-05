/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import i18n from '../../../src/i18n';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8', () => ({
  V8PartnerApi: {
    getReferralAnalytics: vi.fn(),
    getEarningsSummary: vi.fn(),
  },
}));

import { Api } from '../../../src/services/api';
import { PartnerPortalViewNew } from '../../../src/views/partner/PartnerPortalView';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

describe('PartnerPortalView route alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();

    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/connection') {
        return {
          success: true,
          data: { data: { connected: true, organization: { name: 'Partner Org' } } },
        } as any;
      }

      if (url === '/api/partners/resources') {
        return {
          success: true,
          data: {
            data: {
              documentation: [],
              marketing: [],
              caseStudies: [],
              templates: [],
            },
          },
        } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('canonicalizes legacy resources path into the governed documentation tab', async () => {
    render(
      <MemoryRouter initialEntries={['/partner/resources']}>
        <I18nextProvider i18n={i18n}>
          <PartnerPortalViewNew />
        </I18nextProvider>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/partner', search: expect.stringContaining('tab=documentation') }),
        expect.objectContaining({ replace: true })
      );
    });
  });
});
