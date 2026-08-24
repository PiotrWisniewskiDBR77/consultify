/**
 * „Cele i mierniki" — trzeci ekran redesignu (etap B/FAZA 2).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Celów na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().goals` (bufor edycji) ORAZ że
 * „Zapisz zmiany" woła `contextSync.saveNow()` — JEDYNY pisarz do
 * `/organization-context-store` (`useOrgContextSync`, montowany raz w
 * `OrganizationView`; DEC-2026-08-24-15 warunek (a); patrz komentarz w
 * `useOrgContextStoreSection.ts` o wyścigu dwóch niezależnych pisarzy, który
 * wykrył live-runtime dowód końcowy tego kroku).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrgContextSyncHandle } from '../useOrgContextStoreSection';
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

// `useContextBuilderStore` (auto-mocked below) still imports the REAL
// `services/api.ts` module transitively for type purposes at collection
// time; that module initializes i18n at import scope. Stub it minimally so
// that transitive import doesn't crash the react-i18next mock above (this
// test doesn't call Api directly — the screen only talks to the server via
// the `contextSync` prop now, see header comment).
vi.mock('../../../../services/api', () => ({ Api: {} }));

function makeContextSync(overrides?: Partial<OrgContextSyncHandle>): OrgContextSyncHandle {
  return {
    saveNow: vi.fn().mockResolvedValue(true),
    isSyncing: false,
    isUnsynced: false,
    ...overrides,
  };
}

function renderScreen(contextSync: OrgContextSyncHandle = makeContextSync()) {
  return render(
    <OrganizationGoalsMetricsScreen contextSync={contextSync}>
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

  it('„Zapisz zmiany" woła contextSync.saveNow() — JEDYNY pisarz do serwera', async () => {
    const contextSync = makeContextSync();
    renderScreen(contextSync);

    fireEvent.click(screen.getByTestId('org-state-panel-save'));

    expect(contextSync.saveNow).toHaveBeenCalledTimes(1);
  });

  it('gdy contextSync.isUnsynced=true, panel pokazuje napis o buforze lokalnym', () => {
    renderScreen(makeContextSync({ isUnsynced: true }));

    expect(
      screen.getByText(/Dane zapisywane są lokalnie \(bufor roboczy\)/)
    ).toBeInTheDocument();
  });

  it('gdy contextSync.isUnsynced=false (zapisane/potwierdzone), napis o buforze lokalnym znika', () => {
    renderScreen(makeContextSync({ isUnsynced: false }));

    expect(screen.queryByText(/Dane zapisywane są lokalnie/)).not.toBeInTheDocument();
  });
});
