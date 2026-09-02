import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

const i18n: any = { language: 'en', changeLanguage: () => Promise.resolve() };

vi.mock('../../../src/services/api', () => ({ Api: { get: vi.fn() } }));
vi.mock('../../../src/services/api/v8', () => ({
  V8PartnerApi: {
    getConnection: vi.fn(),
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

function renderProjects() {
  return render(
    <MemoryRouter initialEntries={['/partner?tab=projects']}>
      <I18nextProvider i18n={i18n}>
        <PartnerPortalViewNew />
      </I18nextProvider>
    </MemoryRouter>
  );
}

describe('Day 188 Partner projects honest empty/error states', { retry: 0 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8PartnerApi.getConnection).mockResolvedValue({ connected: true } as any);
    vi.mocked(shouldFallbackToLegacyPartner).mockReturnValue(false);
    vi.mocked(Api.get).mockRejectedValue(new Error('Legacy route must not be called'));
  });

  it('renders the unchanged empty state for a successful empty response', async () => {
    vi.mocked(V8PartnerApi.getProjects).mockResolvedValue({ projects: [] } as any);

    renderProjects();

    expect(await screen.findByText('No active projects yet')).toBeInTheDocument();
    expect(screen.queryByText('Partner projects are temporarily unavailable.')).toBeNull();
  });

  it('renders an error instead of the empty state when the governed read fails', async () => {
    vi.mocked(V8PartnerApi.getProjects).mockRejectedValue({
      status: 500,
      code: 'PARTNER_PROJECTS_QUERY_FAILED',
    });

    renderProjects();

    await waitFor(() => {
      expect(screen.getByText('Partner projects are temporarily unavailable.')).toBeInTheDocument();
    });
    expect(screen.queryByText('No active projects yet')).toBeNull();
    expect(Api.get).not.toHaveBeenCalledWith('/api/partners/projects');
  });
});
