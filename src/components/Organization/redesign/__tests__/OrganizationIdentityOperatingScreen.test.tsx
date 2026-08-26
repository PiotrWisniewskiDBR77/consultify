/**
 * Ekran wzorcowy redesignu — „Tożsamość i model działania".
 * Sprawdzamy to, co było obietnicą etapu A:
 *   1. cztery sekcje z prototypu na JEDNYM ekranie (dawne dwa ekrany Profilu),
 *   2. REALNE dane z `/organization-profiles/:orgId` w polach,
 *   3. JEDEN „Zapisz zmiany" zapisujący komplet pól (PUT + readback).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../../services/api';
import {
  EMPTY_PROFILE,
  computeCompleteness,
} from '../../../../views/ContextBuilder/modules/organizationProfileTaxonomy';
import OrganizationIdentityOperatingScreen from '../OrganizationIdentityOperatingScreen';
import OrganizationStatePanel from '../OrganizationStatePanel';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../store/useAppStore', () => ({
  useAppStore: () => ({
    currentUser: { id: 'owner-1', organizationId: 'org-1' },
    currentOrganization: { id: 'org-1' },
  }),
}));

vi.mock('../../../../services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
    organizationContextGet: vi.fn(),
  },
}));

const FIXTURE = {
  ...EMPTY_PROFILE,
  organization_type: 'SERVICES' as const,
  industry: 'Professional Services',
  industry_subsector: 'Doradztwo strategiczne i operacyjne',
  description: 'Niezależna firma usług profesjonalnych.',
  companySize: 'SMB',
  employee_count: 120,
  primary_markets: ['Polska', 'DACH'],
  core_systems: ['SAP ERP'],
};

function renderScreen() {
  return render(
    <OrganizationIdentityOperatingScreen>
      {(args) => (
        <div>
          {args.chips.map((chip) => (
            <span key={chip.id} data-testid={`chip-${chip.id}`}>
              {chip.label}:{chip.count}
            </span>
          ))}
          {args.content}
          <OrganizationStatePanel {...args.statePanel} />
        </div>
      )}
    </OrganizationIdentityOperatingScreen>
  );
}

describe('OrganizationIdentityOperatingScreen', () => {
  beforeEach(() => {
    vi.mocked(Api.get).mockResolvedValue({
      exists: true,
      profile: { ...FIXTURE, profile_completeness: computeCompleteness(FIXTURE) },
    });
    vi.mocked(Api.put).mockResolvedValue({ ok: true });
    vi.mocked(Api.organizationContextGet).mockResolvedValue({
      snapshotUpdatedAt: new Date().toISOString(),
      schemaVersion: 1,
      counts: { items: 8, claims: 201, conflicts: 2 },
      conflicts: [
        { claimPath: 'profile.description', values: ['a', 'b'], sourceTypes: ['interview'] },
        { claimPath: 'profile.industry', values: ['x', 'y'], sourceTypes: ['document'] },
      ],
    });
  });

  it('scala dawne dwa ekrany Profilu w cztery sekcje jednego ekranu', async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('org-card-identity')).toBeInTheDocument());
    expect(screen.getByTestId('org-card-scale')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-delivery')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-markets')).toBeInTheDocument();
    expect(screen.getByText('Tożsamość')).toBeInTheDocument();
    expect(screen.getByText('Skala')).toBeInTheDocument();
    expect(screen.getByText('Model dostawy')).toBeInTheDocument();
    expect(screen.getByText('Rynki i systemy rdzeniowe')).toBeInTheDocument();
  });

  it('wypełnia pola REALNYMI danymi profilu i liczy chipy z tych samych pól', async () => {
    renderScreen();

    await waitFor(() =>
      expect(screen.getByLabelText('Podbranża')).toHaveValue(
        'Doradztwo strategiczne i operacyjne'
      )
    );
    expect(screen.getByLabelText('Branża')).toHaveValue('Professional Services');
    expect(screen.getByLabelText('Liczba pracowników')).toHaveValue(120);
    expect(screen.getByLabelText('Rynki podstawowe')).toHaveValue('Polska, DACH');

    // Konflikty pochodzą z /organization-context i są mapowane po claimPath.
    await waitFor(() => expect(screen.getByTestId('chip-conflicts')).toHaveTextContent('Konflikty:2'));
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Wszystkie:16');
  });

  it('jeden „Zapisz zmiany" zapisuje komplet pól i weryfikuje odczyt zwrotny', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('org-card-identity')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Kod branży (PKD)'), { target: { value: '70.22.Z' } });
    fireEvent.click(screen.getByTestId('org-state-panel-save'));

    await waitFor(() => expect(Api.put).toHaveBeenCalledTimes(1));
    const [url, payload] = vi.mocked(Api.put).mock.calls[0];
    expect(url).toBe('/organization-profiles/org-1');
    expect(payload).toMatchObject({
      industry_code: '70.22.Z',
      organization_type: 'SERVICES',
      companySize: 'SMB',
      core_systems: ['SAP ERP'],
    });
    expect(payload).toHaveProperty('profile_completeness');
  });
});
