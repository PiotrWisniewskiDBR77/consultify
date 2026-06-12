/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import ProviderHomeView from '../../../src/views/partner/ProviderHomeView';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallbackOrOptions?: any, maybeOptions?: any) => {
      const fallback = typeof fallbackOrOptions === 'string' ? fallbackOrOptions : undefined;
      const options =
        typeof fallbackOrOptions === 'object' && fallbackOrOptions !== null
          ? fallbackOrOptions
          : maybeOptions;
      if (options?.returnObjects) {
        if (String(key).includes('.results')) {
          return ['Result item'];
        }
        return [];
      }
      return options?.defaultValue || fallback || key;
    },
  }),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8', () => ({
  V8PartnerApi: {
    getOnboardingStatus: vi.fn(),
  },
  shouldFallbackToLegacyPartner: vi.fn(() => false),
}));

import { Api } from '../../../src/services/api';
import { V8PartnerApi } from '../../../src/services/api/v8';

describe('ProviderHomeView education scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8PartnerApi.getOnboardingStatus).mockResolvedValue({
      status: {
        steps: [],
      },
    } as any);
    vi.mocked(Api.get).mockResolvedValue({} as any);
  });

  it('frames academy as structured enablement beyond partner docs', async () => {
    render(
      <MemoryRouter>
        <ProviderHomeView />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(V8PartnerApi.getOnboardingStatus).toHaveBeenCalled();
    });

    expect(screen.getByText('Rozwijaj umiejętności z Partner Academy')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Ustrukturyzowane wsparcie partnera wykraczające poza dokumentację: podstawy, ścieżki dla ról i gotowość do certyfikacji.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Zakres Academy')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Pomoc i dokumentacja partnera wyjaśniają procesy podczas pracy. Partner Academy to oddzielna warstwa szkoleniowa do ustrukturyzowanego rozwoju, powtarzalnego enablementu i sygnałów certyfikacji.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Podstawy')).toBeInTheDocument();
    expect(screen.getByText('Ścieżka roli')).toBeInTheDocument();
    expect(screen.getByText('Certyfikacja')).toBeInTheDocument();
  });
});
