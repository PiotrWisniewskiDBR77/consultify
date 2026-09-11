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
// [ODMROZENIE 06_EXECUTION DEC-453] J7 (spójność językowa): kod miał polski
// defaultValue w t() mimo poprawnego klucza EN w public/locales — domyślny
// tekst W KODZIE poprawiono na angielski (Decision title/Needed by
// (required)/Reject/missing-context message).
// NAPRAWA (dług 11.09, bramka-9): ÓWCZESNY mock (t: (k, fallback) => fallback)
// ignorował i18n.language i zawsze zwracał ten angielski fallback — stąd
// asercje poszły za EN. Klucze użyte w tym ekranie MAJĄ realne tłumaczenia PL
// w public/locales/pl/translation.json — z poprawnym mockiem (resolvePlKey,
// jak realny react-i18next dla language:'pl') renderuje się to, co widzi
// polski użytkownik. Kontrakt (pola/walidacja/trasy) bez zmian, dogonione
// tylko oczekiwania językowe. Wzór: ExecutionWorkSurface.daneRealne.test.tsx.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import plTranslation from '../../../../public/locales/pl/translation.json';

const resolvePlKey = (key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      plTranslation as unknown
    );
  return typeof value === 'string' ? value : undefined;
};

// Referencja `t`/`useTranslation` STABILNA między renderami (jak realny
// react-i18next) — inline-owy mock daje NOWĄ funkcję za każdym wywołaniem
// hooka, co przy `t` w tablicy zależności `useCallback`/`useEffect` w
// `ExecutionControlSurface.tsx` (np. `loadGovernance`) potrafi wywołać pętlę
// re-renderów („Maximum update depth exceeded" — znalezione i naprawione tą
// samą naprawą w `raidSygnaly.test.tsx` 11.09).
const tStabilne = (k: string, fallback?: unknown) => {
  const resolved = resolvePlKey(k);
  if (resolved !== undefined) return resolved;
  return typeof fallback === 'string' ? fallback : k;
};
const i18nStabilne = { language: 'pl' };
const useTranslationStabilne = { t: tStabilne, i18n: i18nStabilne };

vi.mock('react-i18next', () => ({
  useTranslation: () => useTranslationStabilne,
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
 * REJESTRUJE ją u gospodarza (`ExecutionHub`), żeby przycisk stanął po prawej
 * stronie Menu 2. Test montuje więc mały gospodarz, który renderuje to, co
 * powierzchnia zarejestruje — inaczej klikałby przycisk, którego w tym
 * drzewie nie ma.
 *
 * PORZĄDEK PASKÓW 08.09.2026: kanałów jest teraz DWA, nie jeden. Slot filtrów
 * (`onRegisterFilterControl`) niesie WYŁĄCZNIE filtry (dropdown „Termin"),
 * a JEDEN primary CTA zakładki jedzie osobno (`onRegisterPrimaryCta`) na
 * prawy skraj Menu 2, ciemnym wypełnionym przyciskiem — kanon TRIADA §A2/§C4.
 * Wcześniej „Nowa decyzja" była `btn-secondary` doklejonym do filtrów: akcja
 * główna zakładki wyglądała jak przycisk pomocniczy i wspólnie z resztą
 * łamała pasek na kolejne linie (uwaga właściciela z Pracy).
 */
const Gospodarz: React.FC = () => {
  const [kontrolka, setKontrolka] = React.useState<React.ReactNode>(null);
  const [cta, setCta] = React.useState<{
    label: string;
    onClick: () => void;
    testId?: string;
  } | null>(null);
  return (
    <MemoryRouter>
      <div data-testid="menu2">
        {kontrolka}
        {cta ? (
          <button type="button" data-testid={cta.testId} onClick={cta.onClick}>
            {cta.label}
          </button>
        ) : null}
      </div>
      <ExecutionControlSurface
        activePreset="decyzje"
        onRegisterFilterControl={setKontrolka}
        onRegisterPrimaryCta={setCta}
      />
    </MemoryRouter>
  );
};

const zamontuj = () => render(<Gospodarz />);

const otworzFormularz = async () => {
  /*
    [ODMROZENIE 06_EXECUTION DEC-453] P16/R5: CTA „Nowa decyzja" widzi tylko
    ten, kto może decyzję utworzyć. ZMIERZONE 07.09 na koncie MEMBER
    (`anna.kowalska@dbr77.com`, API 4161): `POST /api/decisions` odsyła
    **403 Permission denied** (`approve_changes`) — więc przed R5 ten blok
    testował formularz pod przyciskiem, który dla MEMBER-a i tak nie mógł
    zadziałać. Reguła (`canDecide`) jest ta sama, którą R3 zastosował do akcji
    rozstrzygających; sam formularz i jego payload sprawdzamy dalej BEZ ZMIAN,
    tyle że rolą, która ma do niego prawo.
  */
  uzytkownik.role = 'ADMIN';
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

    // NAPRAWA (dług 11.09): test nazywa się „PO POLSKU" — asercja szukała
    // angielskiego tekstu (artefakt starego mocka). `execution.decisions.
    // errors.missingContext` MA tłumaczenie PL, dogonione do realnego renderu.
    await waitFor(() =>
      expect(
        screen.getByText('Brakuje danych decyzji — uzupełnij inicjatywę, termin i decydenta.')
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
    // NAPRAWA (dług 11.09): test nazywa się „po polsku" — asercja szukała
    // angielskiego tekstu (artefakt starego mocka). `execution.decisions.
    // errors.forbidden` MA tłumaczenie PL.
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
    expect(screen.queryByText('Reject')).toBeNull();
    expect(screen.queryByText('Nieaktualna')).toBeNull();
  });

  it('ADMIN widzi je także na CUDZEJ decyzji', async () => {
    uzytkownik.role = 'ADMIN';
    zamontuj();
    await waitFor(() => expect(screen.getByText('Cudza decyzja po terminie')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Cudza decyzja po terminie'));
    await waitFor(() => expect(screen.getByText('Rozstrzygnij')).toBeInTheDocument());
    // NAPRAWA (dług 11.09): 'execution.decisions.actions.reject' MA
    // tłumaczenie PL ("Odrzuć") — artefakt starego mocka szukał EN.
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
    expect(screen.queryByText('Reject')).toBeNull();
    // Uzasadnienie zostaje na widoku — to jest cały sens „wpisu nieusuwalnego".
    expect(screen.getByText('Zakres wypadł z programu.')).toBeInTheDocument();
  });
});
