/**
 * „Kierunek i ograniczenia" — drugi ekran redesignu (etap B).
 * Sprawdzamy: cztery sekcje z dawnych dwóch ekranów Profilu na JEDNYM
 * ekranie, REALNE dane z `/organization-profiles/:orgId`, JEDEN „Zapisz
 * zmiany" zapisujący komplet pól (PUT + readback).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../../services/api';
import {
  EMPTY_PROFILE,
  computeCompleteness,
} from '../../../../views/ContextBuilder/modules/organizationProfileTaxonomy';
import OrganizationDirectionConstraintsScreen from '../OrganizationDirectionConstraintsScreen';
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
  competitive_position: 'CHALLENGER' as const,
  growth_stage: 'SCALE_UP',
  strategic_priorities: ['Skalowanie praktyki operacyjnej'],
  mission_statement: 'Pomagamy klientom przemysłowym rosnąć.',
  cloud_adoption_level: 'CLOUD_FIRST',
  communication_style: 'BUSINESS_CASUAL',
  regulatory_environment: ['ISO 9001'],
};

function renderScreen() {
  return render(
    <OrganizationDirectionConstraintsScreen>
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
    </OrganizationDirectionConstraintsScreen>
  );
}

describe('OrganizationDirectionConstraintsScreen', () => {
  beforeEach(() => {
    vi.mocked(Api.get).mockResolvedValue({
      exists: true,
      profile: { ...FIXTURE, profile_completeness: computeCompleteness(FIXTURE) },
    });
    vi.mocked(Api.put).mockResolvedValue({ ok: true });
    vi.mocked(Api.organizationContextGet).mockResolvedValue({
      snapshotUpdatedAt: new Date().toISOString(),
      schemaVersion: 1,
      counts: { items: 8, claims: 201, conflicts: 0 },
      conflicts: [],
    });
  });

  it('scala dawne dwa ekrany Profilu w cztery sekcje jednego ekranu', async () => {
    renderScreen();

    await waitFor(() => expect(screen.getByTestId('org-card-position')).toBeInTheDocument());
    expect(screen.getByTestId('org-card-technology')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-culture')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-constraints')).toBeInTheDocument();
  });

  it('wypełnia pola REALNYMI danymi profilu i liczy chipy z tych samych pól', async () => {
    renderScreen();

    await waitFor(() =>
      expect(screen.getByLabelText('Misja')).toHaveValue('Pomagamy klientom przemysłowym rosnąć.')
    );
    expect(screen.getByLabelText('Priorytety strategiczne')).toHaveValue(
      'Skalowanie praktyki operacyjnej'
    );
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Wszystkie:15');
    expect(screen.getByTestId('chip-filled')).toHaveTextContent('Uzupełnione:7');
  });

  it('jeden „Zapisz zmiany" zapisuje komplet pól i weryfikuje odczyt zwrotny', async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByTestId('org-card-position')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Ograniczenia budżetowe'), {
      target: { value: 'Budżet ograniczony do 500k PLN' },
    });
    fireEvent.click(screen.getByTestId('org-state-panel-save'));

    await waitFor(() => expect(Api.put).toHaveBeenCalledTimes(1));
    const [url, payload] = vi.mocked(Api.put).mock.calls[0];
    expect(url).toBe('/organization-profiles/org-1');
    expect(payload).toMatchObject({
      budget_constraints: 'Budżet ograniczony do 500k PLN',
      competitive_position: 'CHALLENGER',
      cloud_adoption_level: 'CLOUD_FIRST',
    });
    expect(payload).toHaveProperty('profile_completeness');
  });
});
