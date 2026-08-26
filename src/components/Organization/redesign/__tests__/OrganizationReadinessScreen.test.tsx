/**
 * „Gotowość organizacji" — dziesiąty ekran redesignu, PRZEBUDOWANY wg
 * DEC-2026-08-26-78: pięć wymiarów gotowości pokazane OSOBNO (kompletność,
 * pokrycie dowodami, spójność, aktualność, zatwierdzenie), nigdy jedna
 * liczba zbiorcza. Dane pochodzą z REALNEGO API (`organization-profiles`,
 * `governed-context` claims/versions) — ten sam kontrakt co legacy panel.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../../services/api';
import { organizationGovernedContextApi } from '../../../../services/organizationGovernedContextApi';
import OrganizationReadinessScreen from '../OrganizationReadinessScreen';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, vars?: Record<string, unknown>) => {
      if (!fallback) return _key;
      if (!vars) return fallback;
      return Object.entries(vars).reduce(
        (acc, [k, v]) => acc.replace(`{{${k}}}`, String(v)),
        fallback
      );
    },
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../../store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: { id: 'owner-1', organizationId: 'org-1' },
    currentOrganization: { id: 'org-1' },
  }),
}));

vi.mock('../../../../services/api', () => ({
  Api: { get: vi.fn() },
}));

vi.mock('../../../../services/organizationGovernedContextApi', () => ({
  organizationGovernedContextApi: {
    listClaims: vi.fn(),
    listVersions: vi.fn(),
  },
}));

function claim(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    claimId: 'c1',
    itemId: 'i1',
    claimPath: 'profile.industry',
    value: 'Produkcja',
    confidence: 0.9,
    sourceType: 'document',
    visibilityScope: 'organization',
    reviewState: 'approved',
    approved: true,
    approvalSource: 'explicit_review',
    decidedBy: 'owner-1',
    decidedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('OrganizationReadinessScreen', () => {
  beforeEach(() => {
    vi.mocked(Api.get).mockResolvedValue({ exists: false, profile: null });
  });

  it('renderuje pięć wymiarów gotowości osobno, nie jeden procent zbiorczy', async () => {
    vi.mocked(organizationGovernedContextApi.listClaims).mockResolvedValue([]);
    vi.mocked(organizationGovernedContextApi.listVersions).mockResolvedValue([]);

    render(<OrganizationReadinessScreen title="Gotowość organizacji" />);

    await waitFor(() => expect(screen.getByTestId('org-readiness-dimgrid')).toBeInTheDocument());
    expect(screen.getByTestId('org-readiness-dim-completeness')).toBeInTheDocument();
    expect(screen.getByTestId('org-readiness-dim-evidence')).toBeInTheDocument();
    expect(screen.getByTestId('org-readiness-dim-consistency')).toBeInTheDocument();
    expect(screen.getByTestId('org-readiness-dim-freshness')).toBeInTheDocument();
    expect(screen.getByTestId('org-readiness-dim-approval')).toBeInTheDocument();
  });

  it('spójność liczy REALNE konflikty po claimPath z governed-context', async () => {
    vi.mocked(organizationGovernedContextApi.listClaims).mockResolvedValue([
      claim({ claimId: 'a', claimPath: 'profile.annualRevenue', value: '10M' }),
      claim({ claimId: 'b', claimPath: 'profile.annualRevenue', value: '12M' }),
    ] as never);
    vi.mocked(organizationGovernedContextApi.listVersions).mockResolvedValue([]);

    render(<OrganizationReadinessScreen title="Gotowość organizacji" />);

    await waitFor(() =>
      expect(screen.getByTestId('org-readiness-dim-consistency')).toHaveTextContent(
        '1 rozbieżności'
      )
    );
    expect(screen.getByText(/Konflikt: profile.annualRevenue/)).toBeInTheDocument();
  });

  it('zatwierdzenie pokazuje realną opublikowaną wersję, „Brak" gdy jej nie ma', async () => {
    vi.mocked(organizationGovernedContextApi.listClaims).mockResolvedValue([]);
    vi.mocked(organizationGovernedContextApi.listVersions).mockResolvedValue([
      {
        snapshotId: 's1',
        organizationId: 'org-1',
        version: 3,
        schemaVersion: 1,
        contentHash: 'h',
        claimCount: 10,
        createdAt: new Date().toISOString(),
        createdBy: 'owner-1',
      },
    ] as never);

    render(<OrganizationReadinessScreen title="Gotowość organizacji" />);

    await waitFor(() =>
      expect(screen.getByTestId('org-readiness-dim-approval')).toHaveTextContent('v3')
    );
  });

  it('brak blokad renderuje komunikat „Gotowe" zamiast pustej listy', async () => {
    vi.mocked(organizationGovernedContextApi.listClaims).mockResolvedValue([claim()] as never);
    vi.mocked(organizationGovernedContextApi.listVersions).mockResolvedValue([
      {
        snapshotId: 's1',
        organizationId: 'org-1',
        version: 1,
        schemaVersion: 1,
        contentHash: 'h',
        claimCount: 1,
        createdAt: new Date().toISOString(),
        createdBy: 'owner-1',
      },
    ] as never);

    render(<OrganizationReadinessScreen title="Gotowość organizacji" />);

    expect(await screen.findByText('Gotowe')).toBeInTheDocument();
    expect(
      screen.getByText('Nie ma otwartych konfliktów ani oczekujących decyzji.')
    ).toBeInTheDocument();
  });
});
