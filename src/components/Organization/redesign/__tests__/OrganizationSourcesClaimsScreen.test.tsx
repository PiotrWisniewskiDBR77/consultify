/**
 * „Źródła i twierdzenia" — dziewiąty ekran redesignu (etap B).
 * Sprawdzamy: dawne #17 „Pliki" + #18 „Twierdzenia i źródła" + #19
 * „Konflikty źródeł" (który w legacy renderował DOKŁADNIE ten sam komponent
 * co #18) są dostępne na JEDNYM ekranie, przez REALNE komponenty legacy
 * (`OrganizationFilesBoundary`, `GovernedContextWorkspace`).
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { organizationGovernedContextApi } from '../../../../services/organizationGovernedContextApi';
import OrganizationSourcesClaimsScreen from '../OrganizationSourcesClaimsScreen';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'pl', resolvedLanguage: 'pl' },
  }),
}));

vi.mock('../../../../services/organizationGovernedContextApi', () => ({
  organizationGovernedContextApi: {
    listClaimsPage: vi.fn(),
    listVersions: vi.fn(),
  },
}));

describe('OrganizationSourcesClaimsScreen', () => {
  beforeEach(() => {
    vi.mocked(organizationGovernedContextApi.listClaimsPage).mockResolvedValue({ claims: [], total: 0, limit: 200 });
    vi.mocked(organizationGovernedContextApi.listVersions).mockResolvedValue([]);
  });

  it('scala dawne trzy ekrany Źródeł (Pliki + Twierdzenia + Konflikty-duplikat) w jeden ekran', async () => {
    render(<OrganizationSourcesClaimsScreen isAdmin={false} />);

    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Claims, conflicts and publication')).toBeInTheDocument();
    expect(screen.getByText('Pliki organizacji')).toBeInTheDocument();

    await waitFor(() => expect(organizationGovernedContextApi.listClaimsPage).toHaveBeenCalled());
  });
});
