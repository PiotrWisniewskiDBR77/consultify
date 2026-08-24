/**
 * „Ryzyka i szanse" — siódmy ekran redesignu (etap B/FAZA 2).
 * Sprawdzamy: dwie sekcje z dawnych ekranów Syntezy na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().synthesis` (bufor edycji) ORAZ
 * realny zapis serwerowy `PUT /organization-context-store` + readback na
 * „Zapisz zmiany" (DEC-2026-08-24-15, warunek (a)).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../../services/api';
import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationRisksOpportunitiesScreen from '../OrganizationRisksOpportunitiesScreen';
import OrganizationStatePanel from '../OrganizationStatePanel';

vi.mock('../../../../store/useContextBuilderStore');

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

vi.mock('react-hot-toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../../services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

function renderScreen() {
  return render(
    <OrganizationRisksOpportunitiesScreen>
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
    </OrganizationRisksOpportunitiesScreen>
  );
}

const SYNTHESIS_FIXTURE = {
  risks: [{ id: 'r1', risk: 'Opór kadry średniej', why: '', severity: 'High', mitigation: '' }],
  strengths: [],
  selectedScenarioId: '',
};

describe('OrganizationRisksOpportunitiesScreen', () => {
  const setSynthesis = vi.fn();
  const updateSynthesisList = vi.fn();

  beforeEach(() => {
    setSynthesis.mockReset();
    updateSynthesisList.mockReset();
    vi.mocked(Api.get).mockReset().mockResolvedValue({});
    vi.mocked(Api.put).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(useContextBuilderStore).mockReturnValue({
      synthesis: SYNTHESIS_FIXTURE,
      setSynthesis,
      updateSynthesisList,
    } as never);
  });

  it('scala dawne dwa ekrany Syntezy w dwie sekcje jednego ekranu z realnymi danymi', () => {
    renderScreen();

    expect(screen.getByTestId('org-card-risks')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-strengths')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Opór kadry średniej')).toBeInTheDocument();
  });

  it('dodanie szansy trafia do updateSynthesisList("strengths", …)', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Dodaj szansę'));
    expect(updateSynthesisList).toHaveBeenCalledWith(
      'strengths',
      expect.arrayContaining([expect.objectContaining({ enabler: '' })])
    );
  });

  it('edycja ryzyka trafia do updateSynthesisList("risks", …)', () => {
    renderScreen();

    fireEvent.change(screen.getByDisplayValue('Opór kadry średniej'), {
      target: { value: 'Opór kadry średniej i związkowej' },
    });
    expect(updateSynthesisList).toHaveBeenCalledWith(
      'risks',
      expect.arrayContaining([expect.objectContaining({ risk: 'Opór kadry średniej i związkowej' })])
    );
  });

  it('przy montowaniu pobiera GET /organization-context-store i hydratuje store, gdy serwer ma dane', async () => {
    const serverSynthesis = { ...SYNTHESIS_FIXTURE, strengths: [{ id: 's1', enabler: 'Zespół R&D' }] };
    vi.mocked(Api.get).mockResolvedValue({ synthesis: serverSynthesis });

    renderScreen();

    await waitFor(() => expect(setSynthesis).toHaveBeenCalledWith(serverSynthesis));
  });

  it('„Zapisz zmiany" zapisuje sekcję synthesis na serwerze i weryfikuje odczyt zwrotny (readback)', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({}) // mount — brak danych na serwerze
      .mockResolvedValueOnce({ synthesis: SYNTHESIS_FIXTURE }); // readback po zapisie

    renderScreen();
    await waitFor(() => expect(Api.get).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('org-state-panel-save'));

    await waitFor(() => expect(Api.put).toHaveBeenCalledTimes(1));
    const [url, payload] = vi.mocked(Api.put).mock.calls[0];
    expect(url).toBe('/organization-context-store');
    expect(payload).toEqual({ synthesis: SYNTHESIS_FIXTURE });

    await waitFor(() => expect(Api.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(setSynthesis).toHaveBeenCalledWith(SYNTHESIS_FIXTURE));
  });
});
