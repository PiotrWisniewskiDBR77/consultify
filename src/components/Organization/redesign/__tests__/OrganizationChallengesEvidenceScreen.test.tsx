/**
 * „Wyzwania i dowody" — piąty ekran redesignu (etap B/FAZA 2).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Wyzwań na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().challenges` (bufor edycji) ORAZ
 * realny zapis serwerowy `PUT /organization-context-store` + readback na
 * „Zapisz zmiany" (DEC-2026-08-24-15, warunek (a)), a także powrót
 * `ContextDocUploader` w sekcji „Dowody" (warunek (b)).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../../services/api';
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

vi.mock('../../../../services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
    uploadDocument: vi.fn(),
  },
}));

function renderScreen() {
  return render(
    <OrganizationChallengesEvidenceScreen>
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
  const setChallenges = vi.fn();
  const updateChallengesList = vi.fn();

  beforeEach(() => {
    setChallenges.mockReset();
    updateChallengesList.mockReset();
    vi.mocked(Api.get).mockReset().mockResolvedValue({});
    vi.mocked(Api.put).mockReset().mockResolvedValue({ ok: true });
    vi.mocked(useContextBuilderStore).mockReturnValue({
      challenges: CHALLENGES_FIXTURE,
      setChallenges,
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

  it('przy montowaniu pobiera GET /organization-context-store i hydratuje store, gdy serwer ma dane', async () => {
    const serverChallenges = { ...CHALLENGES_FIXTURE, evidence: [{ id: 'e1', metric: 'Braki 12%' }] };
    vi.mocked(Api.get).mockResolvedValue({ challenges: serverChallenges });

    renderScreen();

    await waitFor(() => expect(setChallenges).toHaveBeenCalledWith(serverChallenges));
  });

  it('„Zapisz zmiany" zapisuje sekcję challenges na serwerze i weryfikuje odczyt zwrotny (readback)', async () => {
    vi.mocked(Api.get)
      .mockResolvedValueOnce({}) // mount — brak danych na serwerze
      .mockResolvedValueOnce({ challenges: CHALLENGES_FIXTURE }); // readback po zapisie

    renderScreen();
    await waitFor(() => expect(Api.get).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('org-state-panel-save'));

    await waitFor(() => expect(Api.put).toHaveBeenCalledTimes(1));
    const [url, payload] = vi.mocked(Api.put).mock.calls[0];
    expect(url).toBe('/organization-context-store');
    expect(payload).toEqual({ challenges: CHALLENGES_FIXTURE });

    await waitFor(() => expect(Api.get).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(setChallenges).toHaveBeenCalledWith(CHALLENGES_FIXTURE));
  });
});
