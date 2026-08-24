/**
 * „Gotowość organizacji" — dziesiąty ekran redesignu (etap B).
 * `gaps-freshness` i `decisions-conflicts` w legacy renderowały DOKŁADNIE
 * ten sam komponent co `summary` (`OrganizationDecisionQualityPanel`
 * ignoruje `screen` poza atrybutem `data-screen`) — montując go RAZ, żadna
 * treść z tych czterech legacy tras nie ginie.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { organizationGovernedContextApi } from '../../../../services/organizationGovernedContextApi';
import OrganizationReadinessScreen from '../OrganizationReadinessScreen';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: 'pl', resolvedLanguage: 'pl' } }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../../../services/organizationGovernedContextApi', () => ({
  organizationGovernedContextApi: {
    listClaims: vi.fn(),
    listVersions: vi.fn(),
  },
}));

describe('OrganizationReadinessScreen', () => {
  beforeEach(() => {
    vi.mocked(organizationGovernedContextApi.listClaims).mockResolvedValue([]);
    vi.mocked(organizationGovernedContextApi.listVersions).mockResolvedValue([]);
  });

  it('renderuje stan gotowości z REALNEGO API governed-context', async () => {
    render(<OrganizationReadinessScreen title="Gotowość organizacji" />);

    await waitFor(() => expect(organizationGovernedContextApi.listClaims).toHaveBeenCalled());
    expect(await screen.findByText('Stan organizacji')).toBeInTheDocument();
  });
});
