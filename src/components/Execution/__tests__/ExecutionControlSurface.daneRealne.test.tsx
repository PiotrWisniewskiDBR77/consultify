/**
 * @vitest-environment jsdom
 *
 * 1.12-R1 (C) — zakładka „Sterowanie" staje się „Decyzje i ryzyka"
 * i czyta REALNE rejestry.
 *
 * POMIAR 06.09 (org DBR77, API 127.0.0.1:4100):
 *   · `runtime-v1/management-signals` → 0, `runtime-v1/interventions` → 0
 *     (jedyne dwa źródła, które ta powierzchnia czytała),
 *   · `/api/decisions` → 35, z tego 25 otwartych i 12 po terminie
 *     (wszystkie 12 ze statusem ESCALATED, `escalationLevelName` red 3 / amber 9),
 *   · `/api/raid` → 16 pozycji, 0 z terminem.
 *
 * MUTACJE, na które ten plik reaguje:
 *   (1) powrót źródła do `listManagementSignals`/`listInterventions` → padają
 *       wszystkie przypadki o liczbie wierszy,
 *   (2) zawężenie decyzji do `status === 'PENDING'` → „27 w rejestrze" spada do 13.
 *
 * AKTUALIZACJA P16/R3 (DEC-453) — trzy przypadki zmieniły oczekiwanie, bo
 * zmienił się KONTRAKT, nie implementacja:
 *   · rejestr pokazuje 27 wierszy, nie 25: decyzja rozstrzygnięta ZOSTAJE
 *     w rejestrze z nowym statusem („wpis nieusuwalny", AUDYT_RYNKU_PMO §4.3).
 *     Przed R3 znikała z ekranu w chwili rozstrzygnięcia — i to był defekt,
 *     nie funkcja. Odpada wyłącznie decyzja ARCHIWALNA (`CANCELLED`).
 *   · kolumna „Eskalacja" pokazuje KROK (`1/3`, `2/3`), nie barwę
 *     (Czerwona/Bursztynowa) — barwa była dotkliwością wyliczaną z terminu
 *     i priorytetu, a nie „o ile podniesiono".
 *   · licznik presetu „Po terminie" liczy TYLKO decyzje nierozstrzygnięte.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({ currentUser: { id: 'user-1' }, currentOrganization: { id: 'org-1' } }),
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
vi.mock('@/services/api', () => ({
  Api: { get: apiGet, raidList, createDecision, decideDecision, escalateDecision },
  ApiError: class ApiError extends Error {
    errorCode: string;
    status?: number;
    constructor(payload: any, fallback: string, status?: number) {
      super(String(payload?.error ?? fallback));
      this.errorCode = String(payload?.code ?? 'INTERNAL').toUpperCase();
      this.status = status;
    }
  },
}));
vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers: getOrganizationMembers },
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

/** 25 otwartych decyzji, z tego 12 po terminie i wszystkie 12 ze statusem ESCALATED. */
const DECYZJE = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `esc-${i}`,
    title: `Decyzja po terminie ${i}`,
    status: 'ESCALATED',
    ownerName: 'Anna Kowalska',
    dueDate: dzien(-(i + 1)),
    isOverdue: true,
    daysOverdue: i + 1,
    escalationLevel: i < 3 ? 2 : 1,
    escalationLevelName: i < 3 ? 'red' : 'amber',
  })),
  ...Array.from({ length: 13 }, (_, i) => ({
    id: `pend-${i}`,
    title: `Decyzja otwarta ${i}`,
    status: 'PENDING',
    ownerName: 'Marek Nowak',
    dueDate: dzien(10),
    isOverdue: false,
    escalationLevel: 0,
    escalationLevelName: 'none',
  })),
  // Rozstrzygnięte — nie należą do rejestru „do rozstrzygnięcia".
  { id: 'done-1', title: 'Decyzja zatwierdzona', status: 'APPROVED', isOverdue: false },
  { id: 'done-2', title: 'Decyzja odrzucona', status: 'REJECTED', isOverdue: false },
];

/** 16 pozycji RAID, żadna z terminem (dokładnie jak na pomiarze). */
const RAID = Array.from({ length: 16 }, (_, i) => ({
  id: `raid-${i}`,
  title: `Ryzyko ${i}`,
  type: i < 9 ? 'RISK' : i < 13 ? 'ISSUE' : 'DEPENDENCY',
  severity: i % 3 === 0 ? 'HIGH' : 'MEDIUM',
  status: 'OPEN',
  ownerId: 'osoba-1',
  dueDate: null,
}));

/** Inicjatywy „w realizacji" — źródło `sourceId` dla „Nowej decyzji" (P16/R3). */
const INICJATYWY = [
  { id: 'ini-1', name: 'Migracja ERP', status: 'EXECUTING', ownerId: 'osoba-1' },
  { id: 'ini-2', name: 'Program jakości', status: 'BLOCKED', ownerId: 'osoba-2' },
  { id: 'ini-3', name: 'Zamknięta', status: 'DONE', ownerId: 'osoba-3' },
];

/**
 * Jedna atrapa API dla trzech źródeł zakładki (P16/R5): inicjatywy, sygnały
 * opóźnień i — domyślnie — rejestr decyzji. `decyzje` podaje przypadek.
 */
const odpowiedz = (sciezka: string, decyzje: unknown): unknown =>
  sciezka === '/initiatives'
    ? INICJATYWY
    : sciezka === '/execution-control/delay-signals'
      ? { signals: [], count: 0 }
      : decyzje;

beforeEach(() => {
  vi.clearAllMocks();
  // [ODMROZENIE 06_EXECUTION DEC-453] P16/R5: atrapa musi ROZRÓŻNIAĆ trzecie
  // źródło. Bez tej gałęzi `/execution-control/delay-signals` dostawał listę
  // DECYZJI i chip „Sygnały" pokazywał 27 zamiast 0 — atrapa karmiła ekran nie
  // tym, co czyta serwer. `sygnalyAtrapa` trzyma to w jednym miejscu, bo
  // pojedyncze przypadki nadpisują `apiGet` własnymi implementacjami.
  apiGet.mockImplementation((sciezka: string) => Promise.resolve(odpowiedz(sciezka, DECYZJE)));
  getOrganizationMembers.mockResolvedValue([
    { userId: 'osoba-1', name: 'Anna Kowalska' },
    { userId: 'osoba-2', name: 'Marek Nowak' },
  ]);
  createDecision.mockResolvedValue({ id: 'nowa-1' });
  decideDecision.mockResolvedValue({ id: 'esc-0', status: 'APPROVED' });
  escalateDecision.mockResolvedValue({ id: 'esc-0', escalationStep: 2 });
  raidList.mockResolvedValue(RAID);
  // Rzeczywistość DBR77: kanoniczny rejestr sterowania jest pusty.
  listInterventions.mockResolvedValue({ items: [] });
  listManagementSignals.mockResolvedValue({ items: [] });
  listCapacityOptions.mockResolvedValue({ items: [] });
});

const zamontuj = (preset = 'decyzje', onCountsChange?: (c: Record<string, number>) => void) =>
  render(
    <MemoryRouter>
      <ExecutionControlSurface activePreset={preset} onCountsChange={onCountsChange} />
    </MemoryRouter>
  );

/**
 * [ODMROZENIE 06_EXECUTION DEC-453] P16/R5: wariant montujący TAKŻE węzeł
 * Menu 2. Filtr terminu („Po terminie") nie jest rysowany przez samą
 * powierzchnię — powierzchnia REJESTRUJE go u gospodarza
 * (`onRegisterFilterControl`), dokładnie jak CTA „Nowa decyzja" w R3.
 */
const zamontujZMenu2 = (preset = 'decyzje') => {
  const Gospodarz: React.FC = () => {
    const [kontrolka, setKontrolka] = React.useState<React.ReactNode>(null);
    return (
      <MemoryRouter>
        <div data-testid="execution-menu2">{kontrolka}</div>
        <ExecutionControlSurface activePreset={preset} onRegisterFilterControl={setKontrolka} />
      </MemoryRouter>
    );
  };
  return render(<Gospodarz />);
};

const wierszeZ = (fragment: string) => {
  const tabela = document.querySelector('table');
  if (!tabela) return [];
  return Array.from(tabela.querySelectorAll('tbody tr')).filter((tr) =>
    (tr.textContent || '').includes(fragment)
  );
};

describe('1.12-R1 (C) — rejestr decyzji i ryzyk', () => {
  it('preset „Decyzje" pokazuje CAŁY rejestr 27 decyzji — także rozstrzygnięte (P16/R3)', async () => {
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    // 25 otwartych + 2 rozstrzygnięte. Rozstrzygnięcie NIE usuwa wpisu
    // z rejestru — „wpis nieusuwalny" (AUDYT_RYNKU_PMO §4.3).
    expect(wierszeZ('Decyzja')).toHaveLength(27);
    expect(screen.getByText('Decyzja zatwierdzona')).toBeInTheDocument();
    expect(screen.getByText('Decyzja odrzucona')).toBeInTheDocument();
  });

  it('decyzja ARCHIWALNA (CANCELLED) nie wchodzi do rejestru', async () => {
    apiGet.mockImplementation((sciezka: string) =>
      Promise.resolve(
        odpowiedz(sciezka, [
          ...DECYZJE,
          { id: 'arch-1', title: 'Decyzja usunięta', status: 'CANCELLED', isOverdue: false },
        ])
      )
    );
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    expect(screen.queryByText('Decyzja usunięta')).toBeNull();
    expect(wierszeZ('Decyzja')).toHaveLength(27);
  });

  it('12 decyzji ma czerwoną liczbę „dni po terminie"', async () => {
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    const czerwone = Array.from(document.querySelectorAll('table td .text-c-danger')).filter((el) =>
      /^\+\d+$/.test((el.textContent || '').trim())
    );
    expect(czerwone).toHaveLength(12);
  });

  it('kolumna Eskalacja pokazuje KROK z licznika serwera, nie barwę (P16/R3)', async () => {
    apiGet.mockImplementation((sciezka: string) =>
      Promise.resolve(
        odpowiedz(
          sciezka,
          DECYZJE.map((d, i) =>
            d.status === 'ESCALATED' ? { ...d, escalationStep: i < 2 ? 3 : 1 } : d
          )
        )
      )
    );
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    // Dwie na maksie (3/3), dziesięć na pierwszym poziomie (1/3).
    expect(screen.getAllByText('3/3')).toHaveLength(2);
    expect(screen.getAllByText('1/3')).toHaveLength(10);
    // Barwa „Czerwona"/„Bursztynowa" to była DOTKLIWOŚĆ, nie krok — po R3
    // nie ma jej w kolumnie w ogóle.
    expect(screen.queryByText('Czerwona')).toBeNull();
    expect(screen.queryByText('Bursztynowa')).toBeNull();
  });

  it('kolumny decyzji to Tytuł · Potrzebna do dnia · Decydent · Status · Dni po terminie · Eskalacja', async () => {
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    const naglowki = Array.from(document.querySelectorAll('table thead th')).map((th) =>
      (th.textContent || '').replace(/[^\p{L} ]/gu, '').trim()
    );
    expect(naglowki).toContain('Potrzebna do dnia');
    expect(naglowki).toContain('Decydent');
    expect(naglowki).toContain('Status');
    // „Typ" zostaje WYŁĄCZNIE w RAID — w decyzjach mieszał status z typem.
    expect(naglowki).not.toContain('Typ');
  });

  it('przełącznik „Ryzyka" zmienia ZESTAW KOLUMN, nie tylko filtr', async () => {
    zamontuj('ryzyka');
    await waitFor(() => expect(screen.getByText('Ryzyko 0')).toBeInTheDocument());
    const naglowki = Array.from(document.querySelectorAll('table thead th')).map((th) =>
      (th.textContent || '').replace(/[^\p{L} ]/gu, '').trim()
    );
    expect(naglowki).toContain('Typ');
    // [ODMROZENIE 06_EXECUTION DEC-453] kolumna „Właściciel" ma teraz angielski
    // default 'Owner' (execution.governance.columns.owner, J7) — kontrakt kolumn
    // się nie zmienił, zmienił się tylko język domyślnego tekstu.
    expect(naglowki).toContain('Owner');
    expect(naglowki).not.toContain('Decydent');
    expect(naglowki).not.toContain('Potrzebna do dnia');
  });

  it('preset „Ryzyka" pokazuje 16 pozycji RAID, z terminem „—" (0 z 16 ma datę)', async () => {
    zamontuj('ryzyka');
    await waitFor(() => expect(screen.getByText('Ryzyko 0')).toBeInTheDocument());
    expect(wierszeZ('Ryzyko')).toHaveLength(16);
    // [ODMROZENIE 06_EXECUTION DEC-453] J7b: mock `t` zwraca DOMYŚLNY tekst
    // z kodu, a ten jest od 08.09 ANGIELSKI (zasada §2.3 PLANU językowego —
    // polski żyje wyłącznie w `public/locales/pl/`). Asercje sprawdzają ten
    // sam kontrakt, tylko w języku, który realnie stoi w kodzie.
    expect(screen.getAllByText('Risk').length).toBeGreaterThan(0); // etykieta typu
  });

  /*
    [ODMROZENIE 06_EXECUTION DEC-453] P16/R5: „Po terminie" NIE JEST JUŻ
    PRESETEM MENU 3 — zszedł do Menu 2 jako filtr terminu, bo kanon Triady
    dopuszcza najwyżej trzy chipy, a §4 D4 wymaga trzeciego chipa „Sygnały".
    REGUŁA, której ten test pilnował, ZOSTAJE BEZ ZMIAN (decyzja rozstrzygnięta
    po terminie nie jest zaległością) — zmienia się wyłącznie miejsce, z którego
    użytkownik ją włącza, więc test steruje teraz filtrem, a nie presetem.
    Sam filtr sprawdza `ExecutionControlSurface.raidSygnaly.test.tsx`.
  */
  it('filtr „Po terminie" liczy TYLKO decyzje nierozstrzygnięte (P16/R3)', async () => {
    apiGet.mockImplementation((sciezka: string) =>
      Promise.resolve(
        odpowiedz(sciezka, [
          ...DECYZJE,
          // Rozstrzygnięta PO TERMINIE — jest w rejestrze, ale nie jest już
          // zaległością: filtr „Po terminie" ma jej NIE liczyć.
          {
            id: 'done-late',
            title: 'Decyzja rozstrzygnięta po terminie',
            status: 'APPROVED',
            dueDate: dzien(-30),
            isOverdue: true,
            daysOverdue: 30,
          },
        ])
      )
    );
    const { getByTestId } = zamontujZMenu2('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    // Rozstrzygnięta po terminie JEST w rejestrze (wpis nieusuwalny)…
    expect(screen.getByText('Decyzja rozstrzygnięta po terminie')).toBeInTheDocument();
    // …ale po włączeniu filtru terminu znika, bo zaległością już nie jest.
    const filtr = getByTestId('execution-governance-due-filter');
    fireEvent.click(within(filtr).getByRole('button'));
    fireEvent.click(await screen.findByText(/^Po terminie/));
    await waitFor(() =>
      expect(screen.queryByText('Decyzja rozstrzygnięta po terminie')).toBeNull()
    );
    expect(wierszeZ('Decyzja po terminie')).toHaveLength(12);
  });

  it('liczniki Menu 3 to dokładnie trzy presety z realnymi liczbami', async () => {
    const onCountsChange = vi.fn();
    zamontuj('decyzje', onCountsChange);
    await waitFor(() =>
      expect((onCountsChange.mock.calls.at(-1)?.[0] as Record<string, number>)?.decyzje).toBe(27)
    );
    const ostatnie = onCountsChange.mock.calls.at(-1)?.[0] as Record<string, number>;
    // [ODMROZENIE 06_EXECUTION DEC-453] P16/R5: trzeci chip to „Sygnały",
    // a nie „Po terminie" (ten zszedł do filtru Menu 2). Nadal DOKŁADNIE trzy.
    expect(Object.keys(ostatnie).sort()).toEqual(['decyzje', 'ryzyka', 'sygnaly']);
    expect(ostatnie.ryzyka).toBe(16);
    expect(ostatnie.sygnaly).toBe(0); // ta atrapa nie zwraca sygnałów opóźnień
  });

  it('nie rysuje pustej tabeli interwencji, gdy runtime-v1 ma 0 rekordów', async () => {
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    expect(screen.queryByText('Brak spraw interwencyjnych')).toBeNull();
    expect(document.querySelectorAll('table')).toHaveLength(1);
  });

  it('podgląd otwiera się na klik i pokazuje dni po terminie', async () => {
    zamontuj('decyzje');
    await waitFor(() => expect(screen.getByText('Decyzja po terminie 0')).toBeInTheDocument());
    screen.getByText('Decyzja po terminie 0').click();
    await waitFor(() => expect(screen.getAllByText('Dni po terminie').length).toBeGreaterThan(1));
  });
});
