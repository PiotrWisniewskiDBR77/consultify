/**
 * „Wyzwania i dowody" — piąty ekran redesignu (etap B/FAZA 2).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Wyzwań na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().challenges` (bufor edycji) ORAZ
 * że „Zapisz zmiany" woła `contextSync.saveNow()` — JEDYNY pisarz do
 * `/organization-context-store` (DEC-2026-08-24-15 warunek (a)), a także
 * powrót `ContextDocUploader` w sekcji „Dowody" (warunek (b)).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrgContextSyncHandle } from '../useOrgContextStoreSection';
import { useContextBuilderStore } from '../../../../store/useContextBuilderStore';
import OrganizationChallengesEvidenceScreen from '../OrganizationChallengesEvidenceScreen';
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
// `uploadDocument` is kept as a jest fn because `ContextDocUploader` calls it
// on file-select (not exercised by these tests, but must exist as a fn).
vi.mock('../../../../services/api', () => ({ Api: { uploadDocument: vi.fn() } }));

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
    <OrganizationChallengesEvidenceScreen contextSync={contextSync}>
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
    </OrganizationChallengesEvidenceScreen>
  );
}

const CHALLENGES_FIXTURE = {
  declaredChallenges: [
    { id: 'c1', challenge: 'Wysoki wskaźnik braków', area: 'Jakość', severity: 'High', notes: '' },
  ],
  rootCauseAnswers: {},
  evidence: [],
  activeBlockers: [],
};

describe('OrganizationChallengesEvidenceScreen', () => {
  const updateChallengesList = vi.fn();

  beforeEach(() => {
    updateChallengesList.mockReset();
    vi.mocked(useContextBuilderStore).mockReturnValue({
      challenges: CHALLENGES_FIXTURE,
      updateChallengesList,
    } as never);
  });

  it('scala dawne dwa ekrany Wyzwań w dwie sekcje jednego ekranu z realnymi danymi', () => {
    renderScreen();

    expect(screen.getByTestId('org-card-challenges')).toBeInTheDocument();
    expect(screen.getByTestId('org-card-evidence')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Wysoki wskaźnik braków')).toBeInTheDocument();
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Wszystkie:2');
    expect(screen.getByTestId('chip-filled')).toHaveTextContent('Uzupełnione:1');
  });

  it('dodanie dowodu trafia do updateChallengesList("evidence", …)', () => {
    renderScreen();

    fireEvent.click(screen.getByText('Dodaj dowód'));
    expect(updateChallengesList).toHaveBeenCalledWith(
      'evidence',
      expect.arrayContaining([expect.objectContaining({ metric: '' })])
    );
  });

  it('edycja wyzwania trafia do updateChallengesList("declaredChallenges", …)', () => {
    renderScreen();

    fireEvent.change(screen.getByDisplayValue('Wysoki wskaźnik braków'), {
      target: { value: 'Wysoki wskaźnik braków (Linia 2)' },
    });
    expect(updateChallengesList).toHaveBeenCalledWith(
      'declaredChallenges',
      expect.arrayContaining([expect.objectContaining({ challenge: 'Wysoki wskaźnik braków (Linia 2)' })])
    );
  });

  it('sekcja „Dowody" osadza ContextDocUploader (warunek (b), DEC-2026-08-24-15)', () => {
    renderScreen();

    expect(screen.getByText('Dokumenty pomocnicze')).toBeInTheDocument();
    expect(screen.getByText('Dla: Dowody')).toBeInTheDocument();
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
