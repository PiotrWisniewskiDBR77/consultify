/**
 * „Przyczyny i blockery" — szósty ekran redesignu (etap B/FAZA 2).
 * Sprawdzamy: dwie sekcje z dawnych dwóch ekranów Wyzwań na JEDNYM ekranie,
 * REALNE dane z `useContextBuilderStore().challenges` (bufor edycji) ORAZ
 * realny zapis serwerowy `PUT /organization-context-store` + readback na
 * „Zapisz zmiany" (DEC-2026-08-24-15, warunek (a)), a także powrót galerii
 * czterech gotowych blockerów do dodania jednym kliknięciem (warunek (c)).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '../../../../services/api';
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

vi.mock('../../../../services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
  },
}));

function renderScreen() {
  return render(
    <OrganizationRootCausesBlockersScreen>
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
    vi.mocked(Api.get).mockReset().mockResolvedValue({});
    vi.mocked(Api.put).mockReset().mockResolvedValue({ ok: true });
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

  it('przy montowaniu pobiera GET /organization-context-store i hydratuje store, gdy serwer ma dane', async () => {
    const serverChallenges = {
      ...CHALLENGES_FIXTURE,
      rootCauseAnswers: { 0: 'Odpowiedź z serwera.' },
    };
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
