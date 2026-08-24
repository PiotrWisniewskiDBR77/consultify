/**
 * „Zakres i tryb współpracy" — czwarty ekran redesignu (etap B/FAZA 2).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Celów na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().goals` (bufor edycji) ORAZ realny
 * zapis serwerowy `PUT /organization-context-store` + readback na
 * „Zapisz zmiany" (DEC-2026-08-24-15, warunek (a)).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../../services/api';
import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationScopeCollaborationScreen from '../OrganizationScopeCollaborationScreen';
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
    <OrganizationScopeCollaborationScreen>
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
    </OrganizationScopeCollaborationScreen>
  );
}

const GOALS_FIXTURE = {
  primaryObjective: '',
  secondaryObjectives: '',
  topPriorities: [],
  kpis: [],
  inScope: [{ id: 's1', item: 'Zakład A', notes: 'Pełny audyt' }],
  outScope: [],
  noGo: [],
  transformationArchetype: 'fast',
  aiRole: '',
  steeringCadence: '',
};

describe('OrganizationScopeCollaborationScreen', () => {
  const setGoals = vi.fn();
  const updateGoalsList = vi.fn();

  beforeEach(() => {
    setGoals.mockReset();
    updateGoalsList.mockReset();
    vi.mocked(Api.get).mockReset().mockResolvedValue({});
    vi.mocked(Api.put).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(useContextBuilderStore).mockReturnValue({
      goals: GOALS_FIXTURE,
      setGoals,
      updateGoalsList,
    } as never);
  });

  it('scala dawne dwa ekrany Celów w dwie sekcje jednego ekranu z realnymi danymi', () => {
    renderScreen();

    expect(screen.getByTestId('org-card-scope')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-collaboration')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Zakład A')).toBeInTheDocument();
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Wszystkie:5');
    expect(screen.getByTestId('chip-filled')).toHaveTextContent('Uzupełnione:2');
  });

  it('wybór segmentu trafia do tego samego store, co stary ekran (setGoals)', () => {
    renderScreen();

    fireEvent.click(screen.getByRole('radio', { name: 'Współpilot' }));
    expect(setGoals).toHaveBeenCalledWith({ aiRole: 'partner' });
  });

  it('dodanie pozycji zakresu trafia do updateGoalsList("inScope", …)', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Dodaj obszar'));
    expect(updateGoalsList).toHaveBeenCalledWith(
      'inScope',
      expect.arrayContaining([
        expect.objectContaining({ item: 'Zakład A' }),
        expect.objectContaining({ item: '' }),
      ])
    );
  });

  it('przy montowaniu pobiera GET /organization-context-store i hydratuje store, gdy serwer ma dane', async () => {
    const serverGoals = { ...GOALS_FIXTURE, transformationArchetype: 'deep' };
    vi.mocked(Api.get).mockResolvedValue({ goals: serverGoals });

    renderScreen();

    await waitFor(() => expect(setGoals).toHaveBeenCalledWith(serverGoals));
  });

  it('„Zapisz zmiany" zapisuje sekcję goals na serwerze i weryfikuje odczyt zwrotny (readback)', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({}) // mount — brak danych na serwerze
      .mockResolvedValueOnce({ goals: GOALS_FIXTURE }); // readback po zapisie

    renderScreen();
    await waitFor(() => expect(Api.get).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('org-state-panel-save'));

    await waitFor(() => expect(Api.put).toHaveBeenCalledTimes(1));
    const [url, payload] = vi.mocked(Api.put).mock.calls[0];
    expect(url).toBe('/organization-context-store');
    expect(payload).toEqual({ goals: GOALS_FIXTURE });

    await waitFor(() => expect(Api.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(setGoals).toHaveBeenCalledWith(GOALS_FIXTURE));
  });
});
