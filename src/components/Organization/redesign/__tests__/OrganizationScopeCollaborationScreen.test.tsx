/**
 * „Zakres i tryb współpracy" — czwarty ekran redesignu (etap B/FAZA 2).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Celów na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().goals` (bufor edycji) ORAZ że
 * „Zapisz zmiany" woła `contextSync.saveNow()` — JEDYNY pisarz do
 * `/organization-context-store` (`useOrgContextSync`, montowany raz w
 * `OrganizationView`; DEC-2026-08-24-15 warunek (a)).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrgContextSyncHandle } from '../useOrgContextStoreSection';
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

// See OrganizationGoalsMetricsScreen.test.tsx header comment — minimal stub
// to short-circuit the real services/api.ts → i18n init transitive import.
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
    <OrganizationScopeCollaborationScreen contextSync={contextSync}>
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

  it('„Zapisz zmiany" woła contextSync.saveNow() — JEDYNY pisarz do serwera', () => {
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
});
