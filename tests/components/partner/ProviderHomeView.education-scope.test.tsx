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
    t: (key: string, options?: any) => {
      if (options?.returnObjects) {
        if (String(key).includes('.results')) {
          return ['Result item'];
        }
        return [];
      }
      return options?.defaultValue || key;
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

    expect(screen.getByText('Sharpen Your Skills with Partner Academy')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Structured partner enablement beyond support docs: foundations, role-specific tracks, and certification readiness.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Academy boundary')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Help and partner docs explain workflows when you are working. Partner Academy is the separate learning layer for structured progression, repeatable enablement, and certification signals.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Foundations')).toBeInTheDocument();
    expect(screen.getByText('Role path')).toBeInTheDocument();
    expect(screen.getByText('Certification')).toBeInTheDocument();
  });
});
