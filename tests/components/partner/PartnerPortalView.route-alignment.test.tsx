/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// F2 fix: don't import the real i18next singleton in tests — it's a true
// module-level singleton (src/i18n.ts calls i18n.init() at import time) and
// importing it directly across many test files leaks state between them,
// crashing the coverage collection run. react-i18next is globally mocked in
// tests/setup.ts (I18nextProvider is a passthrough), so this stub only needs
// to satisfy the `i18n` prop shape.
const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };
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
        expect.objectContaining({
          pathname: '/partner',
          search: expect.stringContaining('tab=documentation'),
        }),
        expect.objectContaining({ replace: true })
      );
    });
  });

  it('shows the ready Consultify partner program before profile connection', async () => {
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/api/partners/connection') {
        return {
          success: true,
          data: { data: { connected: false, selfConnectEnabled: false, organization: null } },
        } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    render(
      <MemoryRouter initialEntries={['/partner?tab=documentation']}>
        <I18nextProvider i18n={i18n}>
          <PartnerPortalViewNew />
          <LocationProbe />
        </I18nextProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Program overview')).toBeInTheDocument();
    expect(screen.getByText('Models and commercial terms')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/partner?tab=documentation');
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/resources');
    expect(mockNavigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.stringContaining('tab=partner-home') }),
      expect.anything()
    );
  });
});
