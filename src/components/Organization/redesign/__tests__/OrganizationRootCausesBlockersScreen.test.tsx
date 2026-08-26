/**
 * „Przyczyny i blockery" — szósty ekran redesignu (etap B/FAZA 2).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Wyzwań na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().challenges` (bufor edycji) ORAZ
 * że „Zapisz zmiany" woła `contextSync.saveNow()` — JEDYNY pisarz do
 * `/organization-context-store` (DEC-2026-08-24-15 warunek (a)), a także
 * powrót galerii czterech gotowych blockerów do dodania jednym kliknięciem
 * (warunek (c)).
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrgContextSyncHandle } from '../useOrgContextStoreSection';
import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationRootCausesBlockersScreen from '../OrganizationRootCausesBlockersScreen';
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
    <OrganizationRootCausesBlockersScreen contextSync={contextSync}>
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
    </OrganizationRootCausesBlockersScreen>
  );
}

const CHALLENGES_FIXTURE = {
  declaredChallenges: [],
  rootCauseAnswers: { 0: 'Zarząd boi się delegować decyzje.' },
  evidence: [],
  activeBlockers: [
    { id: 'b1', type: 'Culture', title: 'Lęk przed porażką', desc: '', status: 'confirmed' },
  ],
};

describe('OrganizationRootCausesBlockersScreen', () => {
  const setChallenges = vi.fn();

  beforeEach(() => {
    setChallenges.mockReset();
    vi.mocked(useContextBuilderStore).mockReturnValue({
      challenges: CHALLENGES_FIXTURE,
      setChallenges,
    } as never);
  });

  it('scala dawne dwa ekrany Wyzwań w dwie sekcje jednego ekranu z realnymi danymi', () => {
    renderScreen();

    expect(screen.getByTestId('org-card-rootcause')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-blockers')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Zarząd boi się delegować decyzje.')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Lęk przed porażką')).toBeInTheDocument();
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Wszystkie:2');
    expect(screen.getByTestId('chip-filled')).toHaveTextContent('Uzupełnione:2');
  });

  it('odpowiedź na pytanie diagnostyczne trafia do setChallenges(rootCauseAnswers)', () => {
    renderScreen();

    fireEvent.change(screen.getByDisplayValue('Zarząd boi się delegować decyzje.'), {
      target: { value: 'Zarząd boi się delegować decyzje operacyjne.' },
    });
    expect(setChallenges).toHaveBeenCalledWith({
      rootCauseAnswers: { 0: 'Zarząd boi się delegować decyzje operacyjne.' },
    });
  });

  it('dodanie blockera trafia do setChallenges(activeBlockers)', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Dodaj blocker'));
    expect(setChallenges).toHaveBeenCalledWith({
      activeBlockers: expect.arrayContaining([
        expect.objectContaining({ title: 'Lęk przed porażką' }),
        expect.objectContaining({ title: '' }),
      ]),
    });
  });

  it('galeria pokazuje 4 gotowe blockery, jeden już dodany jest oznaczony, a klik na nowy dodaje go (warunek (c))', () => {
    renderScreen();

    const gallery = screen.getByTestId('org-blocker-gallery');
    const buttons = within(gallery).getAllByRole('button');
    expect(buttons).toHaveLength(4);
    expect(within(gallery).getByText('Nadmiar spotkań')).toBeInTheDocument();
    expect(within(gallery).getByText('Zmęczenie zmianą')).toBeInTheDocument();
    expect(within(gallery).getByText('Fragmentacja danych')).toBeInTheDocument();

    // „Lęk przed porażką" jest już w activeBlockers fixture'a → przycisk wyłączony.
    const alreadyAdded = within(gallery).getByText('Lęk przed porażką').closest('button');
    expect(alreadyAdded).toBeDisabled();

    fireEvent.click(within(gallery).getByText('Nadmiar spotkań'));
    expect(setChallenges).toHaveBeenCalledWith({
      activeBlockers: expect.arrayContaining([
        expect.objectContaining({ title: 'Lęk przed porażką' }),
        expect.objectContaining({
          title: 'Nadmiar spotkań',
          type: 'Process',
          status: 'confirmed',
        }),
      ]),
    });
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
