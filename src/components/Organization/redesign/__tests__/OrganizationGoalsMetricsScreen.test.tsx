/**
 * „Cele i mierniki" — trzeci ekran redesignu (etap B/FAZA 2).
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
import OrganizationGoalsMetricsScreen from '../OrganizationGoalsMetricsScreen';
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
    <OrganizationGoalsMetricsScreen>
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
    </OrganizationGoalsMetricsScreen>
  );
}

const GOALS_FIXTURE = {
  primaryObjective: 'Zostać liderem rynku w 3 lata',
  secondaryObjectives: '',
  topPriorities: ['eff'],
  kpis: [{ id: 'k1', name: 'OEE', baseline: '60%', target: '85%', timeframe: '12m' }],
  inScope: [],
  outScope: [],
  noGo: [],
  transformationArchetype: '',
  aiRole: '',
  steeringCadence: '',
};

describe('OrganizationGoalsMetricsScreen', () => {
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

    expect(screen.getByTestId('org-card-intent')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-metrics')).toBeInTheDocument();
    expect(screen.getByLabelText('Cel nadrzędny')).toHaveValue('Zostać liderem rynku w 3 lata');
    expect(screen.getByDisplayValue('OEE')).toBeInTheDocument();
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Wszystkie:4');
    expect(screen.getByTestId('chip-filled')).toHaveTextContent('Uzupełnione:3');
  });

  it('edycja pola trafia do tego samego store, co stary ekran (setGoals)', () => {
    renderScreen();

    fireEvent.change(screen.getByLabelText('Cele drugorzędne'), {
      target: { value: 'Redukcja emisji CO2' },
    });
    expect(setGoals).toHaveBeenCalledWith({ secondaryObjectives: 'Redukcja emisji CO2' });
  });

  it('dodanie KPI trafia do updateGoalsList("kpis", …)', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Dodaj miernik'));
    expect(updateGoalsList).toHaveBeenCalledWith(
      'kpis',
      expect.arrayContaining([expect.objectContaining({ name: 'OEE' }), expect.objectContaining({ name: '' })])
    );
  });

  it('przy montowaniu pobiera GET /organization-context-store i hydratuje store, gdy serwer ma dane', async () => {
    const serverGoals = { ...GOALS_FIXTURE, primaryObjective: 'Cel z serwera' };
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

  it('gdy readback po zapisie nie zgadza się z wysłanymi danymi, zapis NIE jest uznany za sukces', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ goals: { ...GOALS_FIXTURE, primaryObjective: 'Coś innego' } });

    renderScreen();
    await waitFor(() => expect(Api.get).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('org-state-panel-save'));

    await waitFor(() => expect(Api.get).toHaveBeenCalledTimes(2));
    // Readback się nie zgadza → store NIE jest nadpisywany rozbieżnymi danymi.
    expect(setGoals).not.toHaveBeenCalledWith({ ...GOALS_FIXTURE, primaryObjective: 'Coś innego' });
  });
});
