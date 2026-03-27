import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter } from 'react-router-dom';

import i18n from '../../../src/i18n';

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8', () => ({
  V8PartnerApi: {
    updateOrganizationRegions: vi.fn(),
  },
  shouldFallbackToLegacyPartner: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { Api } from '../../../src/services/api';
import { shouldFallbackToLegacyPartner, V8PartnerApi } from '../../../src/services/api/v8';
import { PartnerPortalViewNew } from '../../../src/views/partner/PartnerPortalView';

function renderView() {
  return render(
    <MemoryRouter initialEntries={['/partner?tab=regions']}>
      <I18nextProvider i18n={i18n}>
        <PartnerPortalViewNew />
      </I18nextProvider>
    </MemoryRouter>,
  );
}

describe('PartnerPortalView regions V8 seam', () => {
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

      if (url === '/api/partners/organization') {
        return {
          success: true,
          data: {
            data: {
              id: 'partner-org-1',
              name: 'Test Partner Co',
              contactEmail: 'partner@example.com',
              tier: 'GOLD',
              status: 'active',
              publicListingEnabled: false,
              specializations: [],
              regions: ['DACH'],
            },
          },
        } as any;
      }

      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('uses the V8 route first for region updates', async () => {
    vi.mocked(V8PartnerApi.updateOrganizationRegions).mockResolvedValue({
      success: true,
      message: 'Regions updated successfully',
    } as any);
    vi.mocked(shouldFallbackToLegacyPartner).mockReturnValue(false);

    renderView();

    fireEvent.click(await screen.findByRole('checkbox', { name: 'CEE' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Regions' }));

    await waitFor(() => {
      expect(V8PartnerApi.updateOrganizationRegions).toHaveBeenCalledWith({
        regions: ['DACH', 'CEE'],
      });
    });
    expect(Api.put).not.toHaveBeenCalledWith('/api/partners/organization/regions', expect.anything());
    expect(toastSuccess).toHaveBeenCalledWith('Regions updated');
  });

  it('falls back to the legacy route for bounded compatibility errors', async () => {
    vi.mocked(V8PartnerApi.updateOrganizationRegions).mockRejectedValue({
      response: { status: 404 },
    });
    vi.mocked(shouldFallbackToLegacyPartner).mockReturnValue(true);
    vi.mocked(Api.put).mockResolvedValue({ success: true } as any);

    renderView();

    fireEvent.click(await screen.findByRole('checkbox', { name: 'CEE' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save Regions' }));

    await waitFor(() => {
      expect(Api.put).toHaveBeenCalledWith('/api/partners/organization/regions', {
        regions: ['DACH', 'CEE'],
      });
    });
    expect(toastSuccess).toHaveBeenCalledWith('Regions updated');
    expect(toastError).not.toHaveBeenCalled();
  });
});
