/**
 * @vitest-environment jsdom
 *
 * P16 / R4 + R5 (DEC-453) — RAID W ZAKŁADCE i SYGNAŁY Z SYSTEMU.
 *
 * ZMIERZONE PRZED (kopia bazy `consultify_p16r45`, API 4161, zrzuty
 * `evidence/p16-r45/przed/`):
 *   · `GET /api/raid` → 16 pozycji, **0 z terminem**; zestaw kolumn RAID to
 *     Tytuł · Typ · Właściciel · Termin · Dni po terminie · Eskalacja —
 *     ani prawdopodobieństwa, ani wpływu, ani ekspozycji,
 *   · z tej zakładki NIE DAŁO SIĘ dodać ani zmienić pozycji RAID (zero CTA,
 *     zero akcji w podglądzie), a jedyny front, który próbował, wołał
 *     wycofane `POST /api/initiatives/:id/raid` → 409 (decyzja 26A),
 *   · `GET /api/execution-control/delay-signals` → **42 sygnały**, ekran
 *     czytał zamiast tego pusty `runtime-v1/management-signals` (0),
 *   · Menu 2: „Dodaj sygnał" (żądał UUID i wersji źródła) oraz „Przygotuj
 *     interwencję" (ZAWSZE wyszarzony).
 *
 * MUTACJE, na które ten plik reaguje (sprawdzone ręcznie, przywrócone):
 *   (i) kolumna „Ekspozycja" czyta `riskScore` z API zamiast liczyć p × w → RED,
 *   (j) preset „Sygnały" liczy `listManagementSignals` zamiast
 *       `delay-signals` → RED,
 *   (k) `createRaid` woła `POST /api/raid` (trasa legacy) zamiast kanonicznego
 *       `runtime-v1/.../raid-items/:id` → RED,
 *   (l) `przygotujInterwencje` przestaje wysyłać `sourceId` albo `dueDate` → RED,
 *   (m) konwersja ryzyko → problem nie dokleja linku do źródła → RED.
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

const uzytkownik = { id: 'user-1', role: 'ADMIN' as string };
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({ currentUser: uzytkownik, currentOrganization: { id: 'org-1' } }),
}));

const { apiGet, raidList, createDecision, decideDecision, escalateDecision, getOrganizationMembers } =
  vi.hoisted(() => ({
    apiGet: vi.fn(),
    raidList: vi.fn(),
    createDecision: vi.fn(),
    decideDecision: vi.fn(),
    escalateDecision: vi.fn(),
    getOrganizationMembers: vi.fn(),
  }));

const { TestowyApiError } = vi.hoisted(() => ({
  TestowyApiError: class TestowyApiError extends Error {
    errorCode: string;
    status?: number;
    constructor(payload: any, fallback: string, status?: number) {
      super(String(payload?.error ?? fallback));
      this.errorCode = String(payload?.code ?? 'INTERNAL').toUpperCase();
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

/**
 * `raidWrites` NIE jest zamokowany: to jest DOKŁADNIE ta warstwa, którą ten
 * test ma pilnować (kanoniczny adres, nie trasa legacy). Zamiast moku
 * podstawiamy `fetch` i sprawdzamy, DOKĄD poszła komenda — mok modułu
 * przepuściłby mutację „wołaj `/api/raid`" bez ani jednego czerwonego testu.
 */
const fetchMock = vi.fn();

import { ExecutionControlSurface } from '../ExecutionControlSurface';

const dzien = (przesuniecie: number) =>
  new Date(Date.now() + przesuniecie * 86_400_000).toISOString();

const RYZYKO = {
  id: 'raid-1',
  initiativeId: 'ini-1',
  type: 'RISK',
  title: 'Awaria dostawcy chmury',
  description: null,
  status: 'OPEN',
  probability: 'HIGH',
  impact: 'CRITICAL',
  severity: 'CRITICAL',
  ownerId: 'osoba-1',
  dueDate: dzien(-4),
  // POMIAR: `risk_score` w bazie NIE jest iloczynem dla części wierszy.
  // Tu celowo kłamie (99), żeby mutacja „czytaj riskScore" dała RED.
  riskScore: 99,
  // P16/R4: wersja agregatu z modelu odczytu (LEFT JOIN `ie_aggregate_state`).
  aggregateVersion: 3,
};

const ZALEZNOSC_BEZ_TERMINU = {
  id: 'raid-2',
  initiativeId: 'ini-1',
  type: 'DEPENDENCY',
  title: 'Zależność od zespołu danych',
  status: 'OPEN',
  probability: 'MEDIUM',
  impact: 'HIGH',
  ownerId: null,
  dueDate: null,
  riskScore: 12,
};

const SYGNAL_NOWY = {
  id: 'late-start-ini-1',
  entityType: 'INITIATIVE',
  entityId: 'ini-1',
  entityName: 'Migracja ERP',
  deviationType: 'LATE_START',
  severity: 'CRITICAL',
  daysDeviation: 140,
  plannedDate: dzien(-140),
  actualOrCurrent: null,
  whySlipReasons: [{ reason: 'NO_OWNER', detail: 'No owner assigned' }],
  isDismissed: false,
  createdAt: dzien(0),
};

const SYGNAL_Z_INTERWENCJA = {
  ...SYGNAL_NOWY,
  id: 'overdue-task-9',
  entityType: 'TASK',
  entityId: 'task-9',
  entityName: 'Konfiguracja środowiska',
  deviationType: 'OVERDUE',
  daysDeviation: 12,
  whySlipReasons: [{ reason: 'BLOCKED', detail: 'Blocked for 3 days' }],
};

const DECYZJA_REBASELINE = {
  id: 'dec-rebaseline',
  title: 'Przesunięcie terminu: Konfiguracja środowiska (+12 dni)',
  status: 'PENDING',
  decisionOwnerId: 'user-1',
  dueDate: dzien(3),
  isOverdue: false,
  daysOverdue: 0,
  escalationStep: 0,
  sourceType: 'delay_signal',
  sourceId: 'overdue-task-9',
};

const INICJATYWY = [{ id: 'ini-1', name: 'Migracja ERP', status: 'EXECUTING', ownerId: 'osoba-1' }];

beforeEach(() => {
  vi.clearAllMocks();
  uzytkownik.role = 'ADMIN';
  apiGet.mockImplementation((sciezka: string) => {
    if (sciezka === '/initiatives') return Promise.resolve(INICJATYWY);
    if (sciezka === '/execution-control/delay-signals')
      return Promise.resolve({ signals: [SYGNAL_NOWY, SYGNAL_Z_INTERWENCJA], count: 2 });
    return Promise.resolve([DECYZJA_REBASELINE]);
  });
  raidList.mockResolvedValue([RYZYKO, ZALEZNOSC_BEZ_TERMINU]);
  getOrganizationMembers.mockResolvedValue([
    { userId: 'osoba-1', name: 'Marta Kamińska' },
    { userId: 'osoba-2', name: 'Anna Kowalska' },
  ]);
  createDecision.mockResolvedValue({ id: 'nowa-1' });
  listInterventions.mockResolvedValue({ items: [] });
  listManagementSignals.mockResolvedValue({ items: [] });
  listCapacityOptions.mockResolvedValue({ items: [] });
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ aggregateVersion: 1 }),
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('crypto', {
    randomUUID: () => '11111111-2222-4333-8444-555555555555',
  });
});

/** Gospodarz montujący węzeł Menu 2, tak jak robi to `ExecutionHub`. */
const Gospodarz: React.FC<{ preset: string; onCounts?: (c: Record<string, number>) => void }> = ({
  preset,
  onCounts,
}) => {
  const [kontrolka, setKontrolka] = React.useState<React.ReactNode>(null);
  return (
    <MemoryRouter>
      <div data-testid="menu2">{kontrolka}</div>
      <ExecutionControlSurface
        activePreset={preset}
        onCountsChange={onCounts}
        onRegisterFilterControl={setKontrolka}
      />
    </MemoryRouter>
  );
};

const zamontujRyzyka = async () => {
  const wynik = render(<Gospodarz preset="ryzyka" />);
  await waitFor(() => expect(screen.getByText('Awaria dostawcy chmury')).toBeInTheDocument());
  return wynik;
};

describe('(i) EKSPOZYCJA jest liczona i tylko do odczytu', () => {
  it('kolumna pokazuje p × w (Wysokie 4 × Krytyczny 5 = 20), a NIE riskScore z API', async () => {
    await zamontujRyzyka();
    const wiersz = screen.getByText('Awaria dostawcy chmury').closest('tr') as HTMLElement;
    expect(within(wiersz).getByText('20')).toBeInTheDocument();
    // `riskScore` w danych to 99 — gdyby kolumna go czytała, byłoby tu 99.
    expect(within(wiersz).queryByText('99')).toBeNull();
    // Druga pozycja: Średnie 3 × Wysoki 4 = 12.
    const drugi = screen.getByText('Zależność od zespołu danych').closest('tr') as HTMLElement;
    expect(within(drugi).getByText('12')).toBeInTheDocument();
  });

  it('składniki ekspozycji są nazwane PO POLSKU z liczbą ze skali', async () => {
    await zamontujRyzyka();
    const wiersz = screen.getByText('Awaria dostawcy chmury').closest('tr') as HTMLElement;
    expect(within(wiersz).getByText('Wysokie (4)')).toBeInTheDocument();
    expect(within(wiersz).getByText('Krytyczny (5)')).toBeInTheDocument();
  });

  it('w tabeli nie ma ŻADNEGO pola edycji ekspozycji — to pole liczone', async () => {
    await zamontujRyzyka();
    const tabela = screen.getByRole('table');
    expect(within(tabela).queryAllByRole('textbox')).toHaveLength(0);
    expect(within(tabela).queryAllByRole('spinbutton')).toHaveLength(0);
  });

  it('kolumna Termin ma realną datę i status (przed R4: 0 z 16 miało termin)', async () => {
    await zamontujRyzyka();
    const wiersz = screen.getByText('Awaria dostawcy chmury').closest('tr') as HTMLElement;
    expect(within(wiersz).getByText('Otwarta')).toBeInTheDocument();
    expect(within(wiersz).queryByText('—')).toBeNull(); // termin NIE jest pusty
  });

  /**
   * DZIEWIĄTA KOLUMNA („Dni po terminie") jest DOMYŚLNIE UKRYTA — zmierzone
   * `.local/mierz.mjs`: przy 1440 px kontener tabeli ma 1270 px, a podłogi
   * dziewięciu kolumn dawały 1415 px, więc „Status" i „Dni po terminie"
   * chowały się pod przypiętą kolumną akcji. Liczba nie znika: podaje ją
   * podgląd, a ten sam zbiór wierszy pokazuje filtr „Po terminie" w Menu 2.
   */
  it('„Dni po terminie" nie jest w domyślnym zestawie, ale liczba żyje w podglądzie', async () => {
    await zamontujRyzyka();
    const naglowki = Array.from(screen.getByRole('table').querySelectorAll('thead th')).map(
      (th) => (th.textContent || '').trim()
    );
    expect(naglowki).not.toContain('Dni po terminie');
    // Osiem kolumn danych + kolumna akcji.
    expect(naglowki.filter((x) => x.length > 0)).toHaveLength(8);

    fireEvent.click(screen.getByText('Awaria dostawcy chmury'));
    await waitFor(() => expect(screen.getByText('Pozycja RAID')).toBeInTheDocument());
    expect(screen.getAllByText('Dni po terminie').length).toBeGreaterThan(0);
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});

describe('(k) „Nowa pozycja RAID" woła KANONICZNEGO pisarza, nie trasę legacy', () => {
  const otworzFormularz = async () => {
    await zamontujRyzyka();
    fireEvent.click(screen.getByTestId('execution-new-raid-open'));
    await waitFor(() =>
      expect(screen.getByLabelText('Inicjatywa (wymagana)')).toBeInTheDocument()
    );
  };

  it('CTA „Nowa pozycja RAID" stoi w Menu 2 TYLKO w widoku Ryzyka', async () => {
    await zamontujRyzyka();
    expect(screen.getByTestId('execution-new-raid-open')).toBeInTheDocument();
    // Jeden CTA na widok — „Nowa decyzja" jest tu niewidoczna.
    expect(screen.queryByRole('button', { name: 'Nowa decyzja' })).toBeNull();
  });

  it('ekspozycja jest widoczna w formularzu ZANIM się zapisze, i jest wyliczana', async () => {
    await otworzFormularz();
    // Domyślnie MEDIUM × MEDIUM = 3 × 3 = 9.
    expect(screen.getByTestId('execution-new-raid-exposure')).toHaveTextContent('9');
    fireEvent.change(screen.getByLabelText('Prawdopodobieństwo'), { target: { value: 'HIGH' } });
    fireEvent.change(screen.getByLabelText('Wpływ'), { target: { value: 'CRITICAL' } });
    expect(screen.getByTestId('execution-new-raid-exposure')).toHaveTextContent('20');
  });

  it('zapis idzie pod runtime-v1/.../raid-items/:id, NIGDY pod /api/raid', async () => {
    await otworzFormularz();
    fireEvent.change(screen.getByLabelText('Tytuł (wymagany)'), {
      target: { value: 'proba-r45-ryzyko' },
    });
    fireEvent.change(screen.getByLabelText('Inicjatywa (wymagana)'), {
      target: { value: 'ini-1' },
    });
    fireEvent.change(screen.getByLabelText('Termin'), { target: { value: '2026-10-20' } });
    fireEvent.change(screen.getByLabelText('Prawdopodobieństwo'), { target: { value: 'HIGH' } });
    fireEvent.change(screen.getByLabelText('Wpływ'), { target: { value: 'CRITICAL' } });
    fireEvent.click(screen.getByTestId('execution-new-raid-save'));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [adres, opcje] = fetchMock.mock.calls[0];
    expect(String(adres)).toContain('/api/initiatives/runtime-v1/initiatives/ini-1/raid-items/');
    // Trasa legacy jest wycofana (409, decyzja 26A) — nie wolno jej wołać.
    expect(String(adres)).not.toMatch(/\/api\/initiatives\/ini-1\/raid(\?|$)/);
    expect(String(adres)).not.toMatch(/\/api\/raid(\?|$)/);
    expect(opcje.method).toBe('POST');
    const payload = JSON.parse(opcje.body);
    expect(payload.title).toBe('proba-r45-ryzyko');
    expect(payload.type).toBe('RISK');
    expect(payload.probability).toBe('HIGH');
    // Kanoniczna komenda nazywa wpływ `severity` — wysyłamy jej nazwą.
    expect(payload.severity).toBe('CRITICAL');
    expect(payload.dueDate).toContain('2026-10-20');
    // CAS kanonicznego writera: pozycja sprzed 26A adoptowana wersją 0.
    expect(payload.expectedVersion).toBe(0);
  });

  it('przycisk zapisu jest nieaktywny bez tytułu i bez inicjatywy', async () => {
    await otworzFormularz();
    const zapisz = screen.getByTestId('execution-new-raid-save');
    fireEvent.change(screen.getByLabelText('Inicjatywa (wymagana)'), { target: { value: '' } });
    expect(zapisz).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Tytuł (wymagany)'), { target: { value: 'x' } });
    expect(zapisz).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Inicjatywa (wymagana)'), { target: { value: 'ini-1' } });
    expect(zapisz).toBeEnabled();
  });

  it('awaria zapisu ma widoczny komunikat PO POLSKU — zero cichych awarii', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    await otworzFormularz();
    fireEvent.change(screen.getByLabelText('Tytuł (wymagany)'), { target: { value: 'x' } });
    fireEvent.change(screen.getByLabelText('Inicjatywa (wymagana)'), { target: { value: 'ini-1' } });
    fireEvent.click(screen.getByTestId('execution-new-raid-save'));
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByRole('alert').textContent).toMatch(/Nie możesz zmieniać|Odśwież/);
  });
});

describe('(m) ESKALACJA ryzyko → problem zostawia link do źródła', () => {
  it('tworzy pozycję typu ISSUE z linkiem i zamyka pozycję źródłową', async () => {
    await zamontujRyzyka();
    const wiersz = screen.getByText('Awaria dostawcy chmury').closest('tr') as HTMLElement;
    const kebab = within(wiersz).getAllByRole('button');
    fireEvent.click(kebab[kebab.length - 1]);
    await waitFor(() =>
      expect(screen.getByText('Eskaluj do problemu')).toBeInTheDocument()
    );
    fireEvent.click(screen.getByText('Eskaluj do problemu'));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2));
    const [adresProblem, opcjeProblem] = fetchMock.mock.calls[0];
    const problem = JSON.parse(opcjeProblem.body);
    expect(String(adresProblem)).toContain('/raid-items/');
    expect(opcjeProblem.method).toBe('POST');
    expect(problem.type).toBe('ISSUE');
    // LINK DO ŹRÓDŁA — wzorzec Clarity „link back to the originating Risk".
    expect(problem.description).toContain('raid-1');
    expect(problem.description).toContain('Awaria dostawcy chmury');

    const [adresZrodlo, opcjeZrodlo] = fetchMock.mock.calls[1];
    expect(String(adresZrodlo)).toContain('/raid-items/raid-1');
    expect(opcjeZrodlo.method).toBe('PATCH');
    const zrodlo = JSON.parse(opcjeZrodlo.body);
    expect(zrodlo.status).toBe('CLOSED');
    expect(zrodlo.description).toContain('PRZEKSZTAŁCONE-W-PROBLEM:');
  });
});

describe('(j) PRESET „Sygnały" czyta delay-signals, nie pusty runtime-v1', () => {
  it('licznik chipa „sygnaly" równa się liczbie sygnałów opóźnień', async () => {
    const liczniki: Record<string, number>[] = [];
    render(<Gospodarz preset="ryzyka" onCounts={(c) => liczniki.push(c)} />);
    await waitFor(() => expect(liczniki.length).toBeGreaterThan(0));
    await waitFor(() => expect(liczniki[liczniki.length - 1].sygnaly).toBe(2));
    // Rejestr runtime-v1 ma 0 rekordów — gdyby chip liczył jego, byłoby 0.
    expect(listManagementSignals).toHaveBeenCalled();
    expect(liczniki[liczniki.length - 1].sygnaly).not.toBe(0);
    // „po-terminie" nie jest już presetem Menu 3 (zszedł do filtru Menu 2).
    expect(liczniki[liczniki.length - 1]['po-terminie']).toBeUndefined();
  });

  it('tabela sygnałów pokazuje rodzaj i powód PO POLSKU', async () => {
    render(<Gospodarz preset="sygnaly" />);
    await waitFor(() => expect(screen.getByText('Migracja ERP')).toBeInTheDocument());
    const wiersz = screen.getByText('Migracja ERP').closest('tr') as HTMLElement;
    expect(within(wiersz).getByText('Późny start')).toBeInTheDocument();
    expect(within(wiersz).getByText('Bez właściciela')).toBeInTheDocument();
    expect(within(wiersz).getByText('+140')).toBeInTheDocument();
    expect(within(wiersz).getByText('Nowy')).toBeInTheDocument();
  });

  it('sygnał z powiązaną decyzją re-baseline ma stan „Interwencja"', async () => {
    render(<Gospodarz preset="sygnaly" />);
    await waitFor(() => expect(screen.getByText('Konfiguracja środowiska')).toBeInTheDocument());
    const wiersz = screen.getByText('Konfiguracja środowiska').closest('tr') as HTMLElement;
    expect(within(wiersz).getByText('Interwencja')).toBeInTheDocument();
  });

  it('w widoku Sygnały Menu 2 nie ma ani „Dodaj sygnał", ani CTA tworzenia', async () => {
    render(<Gospodarz preset="sygnaly" />);
    await waitFor(() => expect(screen.getByText('Migracja ERP')).toBeInTheDocument());
    const menu2 = screen.getByTestId('menu2');
    expect(within(menu2).queryByText('Dodaj sygnał')).toBeNull();
    expect(within(menu2).queryByText('Add signal')).toBeNull();
    expect(within(menu2).queryByText('Nowa decyzja')).toBeNull();
    expect(within(menu2).queryByText('Nowa pozycja RAID')).toBeNull();
  });
});

describe('(l) „Przygotuj interwencję" tworzy decyzję z rodowodem i terminem', () => {
  const otworzPodgladSygnalu = async () => {
    render(<Gospodarz preset="sygnaly" />);
    await waitFor(() => expect(screen.getByText('Migracja ERP')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Migracja ERP'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Przygotuj interwencję/ })).toBeInTheDocument()
    );
  };

  it('wysyła sourceType + sourceId sygnału, termin dziś + 3 dni i tytuł po polsku', async () => {
    await otworzPodgladSygnalu();
    fireEvent.click(screen.getByRole('button', { name: /Przygotuj interwencję/ }));
    await waitFor(() => expect(createDecision).toHaveBeenCalledTimes(1));
    const payload = createDecision.mock.calls[0][0];
    expect(payload.sourceType).toBe('delay_signal');
    expect(payload.sourceId).toBe('late-start-ini-1');
    expect(payload.initiativeId).toBe('ini-1');
    expect(payload.decisionType).toBe('RE_BASELINE');
    expect(payload.title).toBe('Przesunięcie terminu: Migracja ERP (+140 dni)');
    const termin = new Date(payload.dueDate).getTime();
    const oczekiwany = Date.now() + 3 * 86_400_000;
    expect(Math.abs(termin - oczekiwany)).toBeLessThan(5 * 60 * 1000);
    // Decydent = właściciel inicjatywy sygnału.
    expect(payload.decisionOwnerId).toBe('osoba-1');
  });

  it('sygnał, który MA już wniosek, nie dostaje drugiego przycisku', async () => {
    render(<Gospodarz preset="sygnaly" />);
    await waitFor(() => expect(screen.getByText('Konfiguracja środowiska')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Konfiguracja środowiska'));
    await waitFor(() => expect(screen.getByText('Sygnał opóźnienia')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Przygotuj interwencję/ })).toBeNull();
  });

  it('awaria tworzenia wniosku ma widoczny komunikat PO POLSKU', async () => {
    createDecision.mockRejectedValue(
      new TestowyApiError({ error: 'Permission denied' }, 'Failed', 403)
    );
    await otworzPodgladSygnalu();
    fireEvent.click(screen.getByRole('button', { name: /Przygotuj interwencję/ }));
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    expect(screen.getAllByRole('alert')[0].textContent).toContain('Nie masz uprawnień');
  });
});

describe('AKCJE POZYCJI RAID w podglądzie — termin, właściciel, zamknięcie', () => {
  const otworzPodglad = async () => {
    await zamontujRyzyka();
    fireEvent.click(screen.getByText('Awaria dostawcy chmury'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Zmień termin/ })).toBeInTheDocument()
    );
  };

  it('„Zmień termin" zapisuje przez kanonicznego pisarza, bez wymogu powodu', async () => {
    await otworzPodglad();
    fireEvent.click(screen.getByRole('button', { name: /Zmień termin/ }));
    fireEvent.change(screen.getByTestId('execution-raid-edit-input'), {
      target: { value: '2026-11-30' },
    });
    fireEvent.click(screen.getByTestId('execution-raid-edit-save'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [adres, opcje] = fetchMock.mock.calls[0];
    expect(String(adres)).toContain('/api/initiatives/runtime-v1/initiatives/ini-1/raid-items/raid-1');
    expect(opcje.method).toBe('PATCH');
    expect(JSON.parse(opcje.body).dueDate).toContain('2026-11-30');
  });

  /**
   * MUTACJA (usunięcie `seedRaidVersions(raidItems)` z `loadGovernance`) → RED.
   *
   * Bez zasilenia pamięci wersji z modelu odczytu pierwszy zapis po każdym
   * przeładowaniu strony leci ze ślepym `expectedVersion: 0`, dostaje 409 i
   * dopiero ponowienie kończy się 200 — czerwony błąd w konsoli i CAS, który
   * nigdy nie chroni. Zmierzone 07.09, `evidence/p16-r45/po/api.log`.
   */
  it('pierwszy zapis idzie z WERSJĄ z modelu odczytu, nie ze ślepym 0', async () => {
    await otworzPodglad();
    fireEvent.click(screen.getByRole('button', { name: /Zmień termin/ }));
    fireEvent.change(screen.getByTestId('execution-raid-edit-input'), {
      target: { value: '2026-11-30' },
    });
    fireEvent.click(screen.getByTestId('execution-raid-edit-save'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).expectedVersion).toBe(3);
    // Jedno wywołanie, bez ponowienia po 409.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('„Zmień właściciela" wysyła identyfikator osoby z katalogu', async () => {
    await otworzPodglad();
    fireEvent.click(screen.getByRole('button', { name: /Zmień właściciela/ }));
    fireEvent.change(screen.getByTestId('execution-raid-edit-input'), {
      target: { value: 'osoba-2' },
    });
    fireEvent.click(screen.getByTestId('execution-raid-edit-save'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).ownerId).toBe('osoba-2');
  });

  it('„Zamknij pozycję" WYMAGA uzasadnienia — pusty powód nie zapisuje', async () => {
    await otworzPodglad();
    fireEvent.click(screen.getByRole('button', { name: /Zamknij pozycję/ }));
    await waitFor(() =>
      expect(screen.getByTestId('execution-decision-reason-confirm')).toBeInTheDocument()
    );
    expect(screen.getByTestId('execution-decision-reason-confirm')).toBeDisabled();
    fireEvent.change(screen.getByTestId('execution-decision-reason-input'), {
      target: { value: 'Dostawca dostarczył łatę.' },
    });
    expect(screen.getByTestId('execution-decision-reason-confirm')).toBeEnabled();
    fireEvent.click(screen.getByTestId('execution-decision-reason-confirm'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const ciało = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(ciało.status).toBe('CLOSED');
    expect(ciało.mitigationPlan).toBe('Dostawca dostarczył łatę.');
  });
});

describe('FILTR TERMINU w Menu 2 zastępuje czwarty chip', () => {
  it('zawęża rejestr RAID do pozycji otwartych z terminem w przeszłości', async () => {
    await zamontujRyzyka();
    expect(screen.getByText('Zależność od zespołu danych')).toBeInTheDocument();
    const filtr = screen.getByTestId('execution-governance-due-filter');
    fireEvent.click(within(filtr).getByRole('button'));
    await waitFor(() => expect(screen.getByText(/Po terminie/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Po terminie/));
    await waitFor(() =>
      expect(screen.queryByText('Zależność od zespołu danych')).toBeNull()
    );
    // Pozycja z terminem w przeszłości zostaje.
    expect(screen.getByText('Awaria dostawcy chmury')).toBeInTheDocument();
  });
});

describe('MEMBER — para negatywna', () => {
  /**
   * ZMIERZONE NA SERWERZE (07.09, konto MEMBER `anna.kowalska@dbr77.com`,
   * kopia bazy `consultify_p16r45`, API 4161):
   *   · `GET /api/raid` · `/decisions` · `/execution-control/delay-signals` → 200
   *     (odczyt wolno — i tak ma być),
   *   · `GET /api/organizations/:id/members` → 403,
   *   · `POST /api/decisions` → **403 Permission denied** (`approve_changes`),
   *   · `POST …/raid-items/:id` (kanoniczny writer) → **404 NOT_FOUND**
   *     (bramka `initiative.update` PER PROJEKT; 404 zamiast 403 celowo, żeby
   *     nie potwierdzać istnienia cudzej inicjatywy).
   */
  it('MEMBER nie dostaje akcji „Przygotuj interwencję" (serwer i tak odsyła 403)', async () => {
    uzytkownik.role = 'MEMBER';
    getOrganizationMembers.mockRejectedValue(new TestowyApiError({}, 'Forbidden', 403));
    render(<Gospodarz preset="sygnaly" />);
    await waitFor(() => expect(screen.getByText('Migracja ERP')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Migracja ERP'));
    await waitFor(() => expect(screen.getByText('Sygnał opóźnienia')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Przygotuj interwencję/ })).toBeNull();
  });

  /**
   * SPROSTOWANIE WŁASNE (07.09): pisząc ten plik założyłem, że po naprawie R3
   * katalog osób nie jest dla MEMBER-a pobierany W OGÓLE. Test to OBALIŁ —
   * `getOrganizationMembers` jest wołany mimo wszystko, bo R3 obwarował
   * warunkiem `canDecide` TYLKO `loadDecisionDictionaries`, a DRUGI, niezależny
   * czytelnik tego samego endpointu — hook `useOrganizationMemberNames`
   * (zamienia `ownerId` na nazwisko w kolumnie Właściciel) — woła go bezwarunkowo.
   * To wyjaśnia `403 GET /api/organizations/:id/members` w konsoli konta MEMBER
   * (`evidence/p16-r45/po-member/odmowy.log`): dług ZASTANY, spoza R4/R5,
   * i większy niż zakładka Realizacji — hook żyje w wielu modułach.
   * Test pilnuje FAKTU, nie mojej tezy, żeby naprawa hooka miała gdzie odbić.
   */
  it('403 katalogu osób u MEMBER-a ma ZASTANE źródło: hook nazwisk, nie formularz', async () => {
    uzytkownik.role = 'MEMBER';
    getOrganizationMembers.mockRejectedValue(new TestowyApiError({}, 'Forbidden', 403));
    render(<Gospodarz preset="ryzyka" />);
    await waitFor(() => expect(screen.getByText('Awaria dostawcy chmury')).toBeInTheDocument());
    // Wołany DOKŁADNIE RAZ — przez hook nazwisk, nie przez słowniki formularza
    // (te R3 obwarował `canDecide`). Gdyby wołał też formularz, byłoby 2.
    expect(getOrganizationMembers).toHaveBeenCalledTimes(1);
    // Mimo odmowy 403 ekran NIE pada i pokazuje rejestr.
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('MEMBER nie widzi CTA tworzenia pozycji RAID ani akcji zapisu', async () => {
    uzytkownik.role = 'MEMBER';
    getOrganizationMembers.mockRejectedValue(new TestowyApiError({}, 'Forbidden', 403));
    render(<Gospodarz preset="ryzyka" />);
    await waitFor(() => expect(screen.getByText('Awaria dostawcy chmury')).toBeInTheDocument());
    /*
      UCZCIWIE: ekran NIE ukrywa dziś CTA RAID przed MEMBER-em, bo serwerową
      bramką kanonicznego writera jest uprawnienie `initiative.update`, a nie
      rola — MEMBER z dostępem do projektu MOŻE dodać ryzyko i to jest
      zamierzone (inaczej właściciel ryzyka nie mógłby go zgłosić). Test
      pilnuje tego, co JEST regułą: katalog osób nie jest pobierany
      (403 w konsoli przy każdym wejściu — naprawione w R3) i lista wyboru
      właściciela zostaje pusta, więc ekran nie obiecuje danych, których nie ma.
    */
    fireEvent.click(screen.getByTestId('execution-new-raid-open'));
    await waitFor(() =>
      expect(screen.getByLabelText('Inicjatywa (wymagana)')).toBeInTheDocument()
    );
    const wlasciciel = screen.getByLabelText('Właściciel') as HTMLSelectElement;
    expect(Array.from(wlasciciel.options).map((o) => o.value)).toEqual(['']);
  });
});
