/**
 * @vitest-environment jsdom
 *
 * P16 / R3 (DEC-453) — ROZSTRZYGANIE DECYZJI W ZAKŁADCE „Decyzje i ryzyka".
 *
 * ZMIERZONE PRZED R3 (kopia bazy `consultify_p16r3`, API 4156,
 * evidence/p16-r3/przed/api-przed.txt):
 *   · `POST /api/decisions` z payloadem ekranu (`{title, sourceType}`) →
 *     400 „Missing decision context", ZA KAŻDYM RAZEM,
 *   · `StandardTable` bez `rowMenu`, podgląd bez bloku akcji → decyzji
 *     w ogóle nie dało się rozstrzygnąć z tego ekranu.
 *
 * MUTACJE, na które ten plik reaguje (sprawdzone ręcznie, przywrócone):
 *   (f) usunięcie `sourceId` z payloadu `createDecision` → RED
 *       („Nowa decyzja" znów wysyła kontekst, którego serwer nie przyjmie),
 *   (f') usunięcie `dueDate` z warunku aktywności przycisku → RED,
 *   (g) dopuszczenie pustego uzasadnienia (`disabled={busy}` zamiast
 *       `disabled={!trimmed || busy}` w `ReasonDialog`) → RED,
 *   (l) pokazanie bloku akcji bez sprawdzenia `canDecide` → RED
 *       (MEMBER widziałby przycisk, który i tak odbije się o 403).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const uzytkownik = { id: 'user-1', role: 'MEMBER' as string };
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({ currentUser: uzytkownik, currentOrganization: { id: 'org-1' } }),
}));

const {
  apiGet,
  raidList,
  createDecision,
  decideDecision,
  escalateDecision,
  getOrganizationMembers,
} = vi.hoisted(() => ({
  apiGet: vi.fn(),
  raidList: vi.fn(),
  createDecision: vi.fn(),
  decideDecision: vi.fn(),
  escalateDecision: vi.fn(),
  getOrganizationMembers: vi.fn(),
}));

/**
 * Atrapa `ApiError` musi powstać w `vi.hoisted`, nie jako zwykła klasa na
 * górze pliku: `vi.mock` jest wynoszony ponad deklaracje, więc klasa
 * zadeklarowana `class ... {}` jest jeszcze w martwej strefie czasowej, gdy
 * fabryka moku się wykonuje (zmierzone: „Cannot access 'TestowyApiError'
 * before initialization").
 */
const { TestowyApiError } = vi.hoisted(() => ({
  TestowyApiError: class TestowyApiError extends Error {
    errorCode: string;
    status?: number;
    constructor(payload: any, fallback: string, status?: number) {
      super(String(payload?.error ?? fallback));
      this.errorCode = String(payload?.code ?? payload?.errorCode ?? 'INTERNAL').toUpperCase();
      this.status = status;
    }
  },
}));

vi.mock('@/services/api', () => ({
  Api: { get: apiGet, raidList, createDecision, decideDecision, escalateDecision },
  ApiError: TestowyApiError,
}));
vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers },
}));

const { listInterventions, listManagementSignals, listCapacityOptions } = vi.hoisted(() => ({
  listInterventions: vi.fn(),
  listManagementSignals: vi.fn(),
  listCapacityOptions: vi.fn(),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listInterventions,
  listManagementSignals,
  listCapacityOptions,
  createMaterialChange: vi.fn(),
  draftIntervention: vi.fn(),
  ingestManagementSignal: vi.fn(),
  transitionIntervention: vi.fn(),
}));

import { ExecutionControlSurface } from '../ExecutionControlSurface';

const dzien = (przesuniecie: number) =>
  new Date(Date.now() + przesuniecie * 86_400_000).toISOString();

const MOJA_DECYZJA = {
  id: 'dec-moja',
  title: 'Moja decyzja po terminie',
  status: 'ESCALATED',
  decisionOwnerId: 'user-1',
  ownerName: 'Tester Testowy',
  dueDate: dzien(-5),
  isOverdue: true,
  daysOverdue: 5,
  escalationStep: 1,
};

const CUDZA_DECYZJA = {
  id: 'dec-cudza',
  title: 'Cudza decyzja po terminie',
  status: 'PENDING',
  decisionOwnerId: 'user-2',
  ownerName: 'Anna Kowalska',
  dueDate: dzien(-3),
  isOverdue: true,
  daysOverdue: 3,
  escalationStep: 0,
};

const INICJATYWY = [
  { id: 'ini-1', name: 'Migracja ERP', status: 'EXECUTING', ownerId: 'osoba-1' },
  { id: 'ini-2', name: 'Zamknięta', status: 'DONE', ownerId: 'osoba-2' },
];

beforeEach(() => {
  vi.clearAllMocks();
  uzytkownik.role = 'MEMBER';
  apiGet.mockImplementation((sciezka: string) =>
    Promise.resolve(sciezka === '/initiatives' ? INICJATYWY : [MOJA_DECYZJA, CUDZA_DECYZJA])
  );
  raidList.mockResolvedValue([]);
  getOrganizationMembers.mockResolvedValue([
    { userId: 'user-1', name: 'Tester Testowy' },
    { userId: 'user-2', name: 'Anna Kowalska' },
  ]);
  createDecision.mockResolvedValue({ id: 'nowa-1' });
  decideDecision.mockResolvedValue({ id: 'dec-moja', status: 'APPROVED' });
  escalateDecision.mockResolvedValue({ id: 'dec-moja', escalationStep: 2 });
  listInterventions.mockResolvedValue({ items: [] });
  listManagementSignals.mockResolvedValue({ items: [] });
  listCapacityOptions.mockResolvedValue({ items: [] });
});

/**
 * „Nowa decyzja" NIE jest rysowana przez samą powierzchnię — powierzchnia
 * REJESTRUJE ten węzeł u gospodarza (`ExecutionHub`) przez
 * `onRegisterFilterControl`, żeby przycisk stanął po prawej stronie Menu 2.
 * Test montuje więc mały gospodarz, który renderuje zarejestrowany węzeł —
 * inaczej klikałby przycisk, którego w tym drzewie nie ma.
 */
const Gospodarz: React.FC = () => {
  const [kontrolka, setKontrolka] = React.useState<React.ReactNode>(null);
  return (
    <MemoryRouter>
      <div data-testid="menu2">{kontrolka}</div>
      <ExecutionControlSurface
        activePreset="decyzje"
        onRegisterFilterControl={setKontrolka}
      />
    </MemoryRouter>
  );
};

const zamontuj = () => render(<Gospodarz />);

const otworzFormularz = async () => {
  zamontuj();
  await waitFor(() => expect(screen.getByText('Moja decyzja po terminie')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Nowa decyzja' }));
  await waitFor(() => expect(screen.getByLabelText('Inicjatywa (wymagana)')).toBeInTheDocument());
};

describe('(f) „Nowa decyzja" wysyła kontekst, który serwer przyjmuje', () => {
  it('przycisk zapisu jest NIEAKTYWNY bez inicjatywy i bez terminu', async () => {
    await otworzFormularz();
    const zapisz = screen.getByTestId('execution-new-decision-save');
    expect(zapisz).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Tytuł decyzji'), {
      target: { value: 'proba-r3-test' },
    });
    // Sam tytuł to DOKŁADNIE payload sprzed R3 — i dokładnie ten, który
    // serwer odrzucał z 400. Przycisk musi zostać nieaktywny.
    expect(zapisz).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Inicjatywa (wymagana)'), {
      target: { value: 'ini-1' },
    });
    expect(zapisz).toBeDisabled(); // wciąż brak terminu

    fireEvent.change(screen.getByLabelText('Potrzebna do dnia (wymagane)'), {
      target: { value: '2026-10-15' },
    });
    expect(zapisz).toBeEnabled();
  });

  it('wysyła initiativeId + sourceId + sourceType + dueDate + decydenta', async () => {
    await otworzFormularz();
    fireEvent.change(screen.getByLabelText('Tytuł decyzji'), {
      target: { value: 'proba-r3-test' },
    });
    fireEvent.change(screen.getByLabelText('Inicjatywa (wymagana)'), {
      target: { value: 'ini-1' },
    });
    fireEvent.change(screen.getByLabelText('Potrzebna do dnia (wymagane)'), {
      target: { value: '2026-10-15' },
    });
    fireEvent.click(screen.getByTestId('execution-new-decision-save'));

    await waitFor(() => expect(createDecision).toHaveBeenCalledTimes(1));
    const payload = createDecision.mock.calls[0][0];
    expect(payload.title).toBe('proba-r3-test');
    expect(payload.initiativeId).toBe('ini-1');
    // `sourceType` BEZ `sourceId` to był cały defekt: serwer wymaga PARY.
    expect(payload.sourceType).toBe('execution');
    expect(payload.sourceId).toBe('ini-1');
    expect(payload.dueDate).toContain('2026-10-15');
    // Decydent domyślnie = właściciel wybranej inicjatywy.
    expect(payload.decisionOwnerId).toBe('osoba-1');
  });

  it('lista inicjatyw pokazuje TYLKO realizacje w toku', async () => {
    await otworzFormularz();
    const select = screen.getByLabelText('Inicjatywa (wymagana)') as HTMLSelectElement;
    const opcje = Array.from(select.options).map((o) => o.textContent);
    expect(opcje).toContain('Migracja ERP');
    expect(opcje).not.toContain('Zamknięta');
  });

  it('błąd serwera pokazuje się PO POLSKU, nie jako „Failed to create decision"', async () => {
    createDecision.mockRejectedValue(
      new TestowyApiError({ error: 'Missing decision context' }, 'Failed to create decision', 400)
    );
    await otworzFormularz();
    fireEvent.change(screen.getByLabelText('Tytuł decyzji'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Inicjatywa (wymagana)'), {
      target: { value: 'ini-1' },
    });
    fireEvent.change(screen.getByLabelText('Potrzebna do dnia (wymagane)'), {
      target: { value: '2026-10-15' },
    });
    fireEvent.click(screen.getByTestId('execution-new-decision-save'));

    await waitFor(() =>
      expect(
        screen.getByText(
          'Brakuje danych decyzji — uzupełnij inicjatywę, termin i decydenta.'
        )
      ).toBeInTheDocument()
    );
    expect(screen.queryByText('Failed to create decision')).toBeNull();
  });
});

describe('(g) rozstrzygnięcie BEZ uzasadnienia jest zablokowane', () => {
  const otworzPodgladMojejDecyzji = async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Moja decyzja po terminie')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Moja decyzja po terminie'));
    await waitFor(() => expect(screen.getByText('Rozstrzygnij')).toBeInTheDocument());
  };

  it('przycisk potwierdzenia w oknie powodu jest nieaktywny przy pustym polu', async () => {
    await otworzPodgladMojejDecyzji();
    fireEvent.click(screen.getByText('Rozstrzygnij'));
    await waitFor(() =>
      expect(screen.getByTestId('execution-decision-reason-dialog')).toBeInTheDocument()
    );
    const potwierdz = screen.getByTestId('execution-decision-reason-confirm');
    expect(potwierdz).toBeDisabled();

    // Sam biały znak to NIE jest uzasadnienie.
    fireEvent.change(screen.getByTestId('execution-decision-reason-input'), {
      target: { value: '   ' },
    });
    expect(potwierdz).toBeDisabled();
    expect(decideDecision).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('execution-decision-reason-input'), {
      target: { value: 'Zakres potwierdzony przez sponsora.' },
    });
    expect(potwierdz).toBeEnabled();
  });

  it('po wpisaniu uzasadnienia woła PATCH /decisions/:id/decide ze statusem i powodem', async () => {
    await otworzPodgladMojejDecyzji();
    fireEvent.click(screen.getByText('Rozstrzygnij'));
    await waitFor(() =>
      expect(screen.getByTestId('execution-decision-reason-dialog')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByTestId('execution-decision-reason-input'), {
      target: { value: 'Zakres potwierdzony przez sponsora.' },
    });
    fireEvent.click(screen.getByTestId('execution-decision-reason-confirm'));

    await waitFor(() => expect(decideDecision).toHaveBeenCalledTimes(1));
    expect(decideDecision).toHaveBeenCalledWith(
      'dec-moja',
      'approved',
      'Zakres potwierdzony przez sponsora.'
    );
    // `decided_at`/`decided_by` ustawia SERWER z `req.user` — front ich nie wysyła.
    expect(decideDecision.mock.calls[0]).toHaveLength(3);
  });

  it('„Nieaktualna" idzie tą samą trasą ze statusem `superseded`', async () => {
    await otworzPodgladMojejDecyzji();
    fireEvent.click(screen.getByText('Nieaktualna'));
    await waitFor(() =>
      expect(screen.getByTestId('execution-decision-reason-dialog')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByTestId('execution-decision-reason-input'), {
      target: { value: 'Zakres wypadł z programu.' },
    });
    fireEvent.click(screen.getByTestId('execution-decision-reason-confirm'));
    await waitFor(() =>
      expect(decideDecision).toHaveBeenCalledWith(
        'dec-moja',
        'superseded',
        'Zakres wypadł z programu.'
      )
    );
  });

  it('odmowa serwera (403) pokazuje się w oknie po polsku', async () => {
    decideDecision.mockRejectedValue(
      new TestowyApiError(
        { error: 'Only decision owner can decide' },
        'Failed to decide decision',
        403
      )
    );
    await otworzPodgladMojejDecyzji();
    fireEvent.click(screen.getByText('Rozstrzygnij'));
    await waitFor(() =>
      expect(screen.getByTestId('execution-decision-reason-dialog')).toBeInTheDocument()
    );
    fireEvent.change(screen.getByTestId('execution-decision-reason-input'), {
      target: { value: 'powód' },
    });
    fireEvent.click(screen.getByTestId('execution-decision-reason-confirm'));
    await waitFor(() =>
      expect(screen.getByTestId('execution-decision-reason-error')).toHaveTextContent(
        'Nie masz uprawnień do tej operacji'
      )
    );
  });
});

describe('(l) kto widzi akcje rozstrzygające', () => {
  it('MEMBER NIE widzi ich na CUDZEJ decyzji', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Cudza decyzja po terminie')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cudza decyzja po terminie'));
    await waitFor(() => expect(screen.getAllByText('Dni po terminie').length).toBeGreaterThan(1));
    expect(screen.queryByText('Rozstrzygnij')).toBeNull();
    expect(screen.queryByText('Odrzuć')).toBeNull();
    expect(screen.queryByText('Nieaktualna')).toBeNull();
  });

  it('ADMIN widzi je także na CUDZEJ decyzji', async () => {
    uzytkownik.role = 'ADMIN';
    zamontuj();
    await waitFor(() => expect(screen.getByText('Cudza decyzja po terminie')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cudza decyzja po terminie'));
    await waitFor(() => expect(screen.getByText('Rozstrzygnij')).toBeInTheDocument());
    expect(screen.getByText('Odrzuć')).toBeInTheDocument();
    expect(screen.getByText('Nieaktualna')).toBeInTheDocument();
  });

  it('decyzja JUŻ ROZSTRZYGNIĘTA nie ma bloku akcji (wpis nieusuwalny)', async () => {
    apiGet.mockImplementation((sciezka: string) =>
      Promise.resolve(
        sciezka === '/initiatives'
          ? INICJATYWY
          : [
              {
                ...MOJA_DECYZJA,
                status: 'SUPERSEDED',
                decisionRationale: 'Zakres wypadł z programu.',
                decidedAt: dzien(-1),
              },
            ]
      )
    );
    zamontuj();
    await waitFor(() => expect(screen.getByText('Moja decyzja po terminie')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Moja decyzja po terminie'));
    await waitFor(() => expect(screen.getAllByText('Dni po terminie').length).toBeGreaterThan(1));
    // „Nieaktualna" pojawia się jako STATUS (w tabeli i w podglądzie), ale
    // ANI RAZU jako przycisk akcji — to jest cała różnica.
    expect(screen.getAllByText('Nieaktualna').length).toBeGreaterThan(0);
    expect(
      screen.queryAllByRole('button', { name: 'Nieaktualna' })
    ).toHaveLength(0);
    expect(screen.queryByText('Rozstrzygnij')).toBeNull();
    expect(screen.queryByText('Odrzuć')).toBeNull();
    // Uzasadnienie zostaje na widoku — to jest cały sens „wpisu nieusuwalnego".
    expect(screen.getByText('Zakres wypadł z programu.')).toBeInTheDocument();
  });
});
