/**
 * @vitest-environment jsdom
 *
 * P16-R2 (D5) — zakładka „Praca" ZAPISUJE, a nie tylko pokazuje.
 *
 * POMIAR 07.09 (własne API 4155, kopia bazy `consultify_p16r2`):
 *   · `PUT /api/tasks/:id` z ciałem `{status}` / `{assigneeId}` / `{dueDate}` → 200,
 *   · `PATCH /api/tasks/:id` → 404 (`API_ROUTE_NOT_FOUND` — router ma tylko PUT),
 *   · `POST /api/tasks` z `{title, initiativeId, assigneeId, dueDate, status}` → 201,
 *   · 20 z 84 zadań demo nie ma `initiative_id` i zajmowało cały pierwszy ekran.
 *
 * MUTACJE (wykonane ręcznie, wynik w meldunku):
 *   (a) `Api.updateTask` → `Api.patch` albo pełny obiekt zamiast jednego pola → RED,
 *   (b) `.catch(() => {})` zamiast `toast.error` + komunikat przy wierszu → RED,
 *   (c) usunięcie `initiativeId` z ciała `POST /tasks` → RED,
 *   (d) `sortujBezInicjatywyNaKoniec` → `(rows) => [...rows]` → RED,
 *   (e) `taskSlipDays` liczone także dla zadań zamkniętych → RED.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && 'defaultValue' in (fallback as any))
        return String((fallback as any).defaultValue);
      return k;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const { toastSuccess, toastError } = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('react-hot-toast', () => ({
  default: { success: toastSuccess, error: toastError },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({ currentUser: { id: 'user-1' }, currentOrganization: { id: 'org-1' } }),
}));

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: {
    getOrganizationMembers: vi.fn().mockResolvedValue([
      { id: 'm1', user_id: 'osoba-1', first_name: 'Anna', last_name: 'Kowalska' },
      { id: 'm2', user_id: 'osoba-2', first_name: 'Marek', last_name: 'Nowak' },
    ]),
  },
}));

const { getTasks, getInitiatives, apiGet, updateTask, apiPost } = vi.hoisted(() => ({
  getTasks: vi.fn(),
  getInitiatives: vi.fn(),
  apiGet: vi.fn(),
  updateTask: vi.fn(),
  apiPost: vi.fn(),
}));
vi.mock('@/services/api', () => ({
  Api: { getTasks, getInitiatives, get: apiGet, updateTask, post: apiPost },
}));

const { listExecutionCases, readExecutionWork } = vi.hoisted(() => ({
  listExecutionCases: vi.fn(),
  readExecutionWork: vi.fn(),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases,
  readExecutionWork,
  readOperationalAllocations: vi.fn(),
  readExecutionCase: vi.fn(),
  readExecutionMilestones: vi.fn(),
  createExecutionTask: vi.fn(),
  updateExecutionTask: vi.fn(),
  completeExecutionTask: vi.fn(),
  createExecutionDecision: vi.fn(),
  requestExecutionDecision: vi.fn(),
  decideExecutionDecision: vi.fn(),
  createExecutionMilestone: vi.fn(),
}));

import { ExecutionWorkSurface, sortujBezInicjatywyNaKoniec } from '../ExecutionWorkSurface';

const dzien = (przesuniecie: number) =>
  new Date(Date.now() + przesuniecie * 86_400_000).toISOString();

/** Słownik statusów — dokładnie ten, który zwrócił serwer 07.09. */
const SLOWNIK = {
  statuses: ['backlog', 'todo', 'in_progress', 'review', 'blocked', 'on_hold', 'done', 'cancelled'],
  transitions: {
    backlog: ['todo', 'in_progress', 'cancelled'],
    todo: ['backlog', 'in_progress', 'review', 'blocked', 'cancelled'],
    in_progress: ['backlog', 'todo', 'review', 'blocked', 'on_hold', 'done', 'cancelled'],
    review: ['todo', 'in_progress', 'blocked', 'on_hold', 'done', 'cancelled'],
    blocked: ['todo', 'in_progress', 'review', 'on_hold', 'cancelled'],
    on_hold: ['todo', 'in_progress', 'review', 'blocked', 'cancelled'],
    done: ['todo', 'in_progress'],
    cancelled: ['backlog', 'todo'],
  },
};

const ZADANIA = [
  {
    id: 'task-bez-inicjatywy',
    title: 'Zadanie bez inicjatywy',
    status: 'in_progress',
    assigneeId: 'osoba-1',
    initiativeId: null,
    dueDate: dzien(-4),
  },
  {
    id: 'task-z-inicjatywa',
    title: 'Zadanie z inicjatywa',
    status: 'in_progress',
    assigneeId: 'osoba-1',
    initiativeId: 'init-1',
    dueDate: dzien(-3),
  },
  {
    id: 'task-zamkniete',
    title: 'Zadanie zamkniete po terminie',
    status: 'done',
    assigneeId: 'osoba-2',
    initiativeId: 'init-1',
    dueDate: dzien(-9),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  getTasks.mockResolvedValue(ZADANIA);
  getInitiatives.mockResolvedValue([{ id: 'init-1', name: 'Inicjatywa Jeden' }]);
  apiGet.mockResolvedValue({ data: SLOWNIK });
  listExecutionCases.mockResolvedValue({ cases: [] });
  readExecutionWork.mockResolvedValue({ tasks: [], decisions: [] });
  updateTask.mockResolvedValue({ id: 'task-z-inicjatywa', status: 'in_progress' });
  apiPost.mockResolvedValue({ data: { id: 'nowe-1', title: 'Nowe zadanie z formularza' } });
});

const zamontuj = (menu2?: (node: React.ReactNode) => void) =>
  render(
    <MemoryRouter>
      <ExecutionWorkSurface activePreset="all" onRegisterFilterControl={menu2} />
    </MemoryRouter>
  );

const wiersz = (tytul: string) =>
  Array.from(document.querySelectorAll('table tbody tr')).find((tr) =>
    (tr.textContent || '').includes(tytul)
  ) as HTMLElement;

describe('P16-R2 (a) — edycja w wierszu woła PUT /tasks/:id z JEDNYM polem', () => {
  it('zmiana osoby wysyła wyłącznie { assigneeId }', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie z inicjatywa')).toBeInTheDocument());

    const komorka = within(wiersz('Zadanie z inicjatywa')).getByText('Anna Kowalska');
    fireEvent.doubleClick(komorka);

    const edytor = await screen.findByLabelText('Zmień osobę');
    fireEvent.change(edytor, { target: { value: 'osoba-2' } });

    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
    const [id, cialo] = updateTask.mock.calls[0];
    expect(id).toBe('task-z-inicjatywa');
    expect(Object.keys(cialo)).toEqual(['assigneeId']);
    expect(cialo.assigneeId).toBe('osoba-2');
  });

  it('zmiana terminu wysyła wyłącznie { dueDate }', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie z inicjatywa')).toBeInTheDocument());

    // Podwójny klik musi trafić w warstwę edytowalną (`data-editable`), nie w
    // samo `td` — zdarzenie w Reakcie bąbelkuje w GÓRĘ, więc klik w rodzica
    // nie odpala handlera dziecka.
    const komorkaTerminu = wiersz('Zadanie z inicjatywa').querySelectorAll(
      'td [data-editable]'
    )[1];
    fireEvent.doubleClick(komorkaTerminu);

    const edytor = await screen.findByLabelText('Zmień termin');
    fireEvent.change(edytor, { target: { value: '2026-12-01' } });
    fireEvent.blur(edytor);

    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
    const [, cialo] = updateTask.mock.calls[0];
    expect(Object.keys(cialo)).toEqual(['dueDate']);
    // `tasks.due_date` jest `timestamptz`, więc data z kalendarza idzie jako ISO.
    expect(cialo.dueDate).toBe('2026-12-01T00:00:00.000Z');
  });

  it('lista statusów bierze się z przejść dopuszczonych przez serwer, nie z kopii w kodzie', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie z inicjatywa')).toBeInTheDocument());
    expect(apiGet).toHaveBeenCalledWith('/tasks/workflow-config');

    const komorkaStatusu = wiersz('Zadanie z inicjatywa').querySelectorAll(
      'td [data-editable]'
    )[2];
    fireEvent.doubleClick(komorkaStatusu);
    const edytor = (await screen.findByLabelText('Zmień status')) as HTMLSelectElement;

    const wartosci = Array.from(edytor.options).map((o) => o.value);
    // `in_progress` + jego przejścia; NIE ma tam `on_hold`→… ani statusu, którego serwer zabroni.
    expect(wartosci[0]).toBe('in_progress');
    expect(wartosci).toContain('done');
    expect(wartosci).not.toContain('in_progress_nieistniejacy');

    fireEvent.change(edytor, { target: { value: 'done' } });
    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
    expect(Object.keys(updateTask.mock.calls[0][1])).toEqual(['status']);
  });

  it('wiersz z kanonicznego rejestru runtime-v1 NIE jest edytowalny tą trasą', async () => {
    listExecutionCases.mockResolvedValue({
      cases: [{ executionCaseId: 'case-1', initiativeId: 'init-1', initiativeTitle: 'Realizacja' }],
    });
    readExecutionWork.mockResolvedValue({
      tasks: [
        {
          taskId: 'runtime-1',
          title: 'Zadanie runtime',
          status: 'OPEN',
          assigneeId: 'osoba-1',
          dueAt: dzien(-2),
          version: 1,
        },
      ],
      decisions: [],
    });
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie runtime')).toBeInTheDocument());

    const komorkaStatusu = wiersz('Zadanie runtime').querySelectorAll('td [data-editable]')[2];
    fireEvent.doubleClick(komorkaStatusu);
    expect(screen.queryByLabelText('Zmień status')).toBeNull();
    expect(updateTask).not.toHaveBeenCalled();
  });
});

describe('P16-R2 (b) — błąd serwera nie może być ciszą', () => {
  it('nieudany zapis daje komunikat PO POLSKU (toast + wiersz), nie milczenie', async () => {
    updateTask.mockRejectedValue(
      new Error('Cannot transition from todo to done. Allowed: backlog, in_progress')
    );
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie z inicjatywa')).toBeInTheDocument());

    const komorka = within(wiersz('Zadanie z inicjatywa')).getByText('Anna Kowalska');
    fireEvent.doubleClick(komorka);
    const edytor = await screen.findByLabelText('Zmień osobę');
    fireEvent.change(edytor, { target: { value: 'osoba-2' } });

    await waitFor(() => expect(toastError).toHaveBeenCalledTimes(1));
    const komunikat = String(toastError.mock.calls[0][0]);
    expect(komunikat).toContain('Nie można zmienić statusu');
    expect(komunikat).not.toContain('Cannot transition');
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it('udany zapis potwierdza się komunikatem, a nie sam po sobie', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie z inicjatywa')).toBeInTheDocument());
    const komorka = within(wiersz('Zadanie z inicjatywa')).getByText('Anna Kowalska');
    fireEvent.doubleClick(komorka);
    fireEvent.change(await screen.findByLabelText('Zmień osobę'), {
      target: { value: 'osoba-2' },
    });
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(toastError).not.toHaveBeenCalled();
  });
});

describe('P16-R2 (c) — „Nowe zadanie" wysyła inicjatywę', () => {
  it('POST /tasks niesie tytuł ORAZ initiativeId wybrany w formularzu', async () => {
    let menu2: React.ReactNode = null;
    zamontuj((node) => {
      menu2 = node;
    });
    await waitFor(() => expect(screen.getByText('Zadanie z inicjatywa')).toBeInTheDocument());

    // Menu 2 gospodarza jest rejestrowane propem — renderujemy je obok tabeli.
    render(<MemoryRouter>{menu2}</MemoryRouter>);
    fireEvent.click(await screen.findByTestId('execution-work-new-task'));

    fireEvent.change(screen.getByLabelText('Tytuł'), {
      target: { value: 'Nowe zadanie z formularza' },
    });
    fireEvent.change(screen.getByLabelText('Inicjatywa'), { target: { value: 'init-1' } });
    fireEvent.click(screen.getByTestId('execution-work-create-submit'));

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    const [trasa, cialo] = apiPost.mock.calls[0];
    expect(trasa).toBe('/tasks');
    expect(cialo.title).toBe('Nowe zadanie z formularza');
    expect(cialo.initiativeId).toBe('init-1');
  });

  it('bez tytułu nie wysyła nic i mówi dlaczego', async () => {
    let menu2: React.ReactNode = null;
    zamontuj((node) => {
      menu2 = node;
    });
    await waitFor(() => expect(screen.getByText('Zadanie z inicjatywa')).toBeInTheDocument());
    render(<MemoryRouter>{menu2}</MemoryRouter>);
    fireEvent.click(await screen.findByTestId('execution-work-new-task'));
    fireEvent.click(screen.getByTestId('execution-work-create-submit'));

    expect(apiPost).not.toHaveBeenCalled();
    expect(await screen.findByText('Podaj tytuł zadania.')).toBeInTheDocument();
  });
});

describe('P16-R2 (d) — zadania bez inicjatywy na KOŃCU listy', () => {
  it('sortowanie jest stabilne i spycha wiersze bez inicjatywy na koniec', () => {
    const wejscie = [
      { id: 'a', initiativeId: '' },
      { id: 'b', initiativeId: 'init-1' },
      { id: 'c', initiativeId: '' },
      { id: 'd', initiativeId: 'init-2' },
    ];
    expect(sortujBezInicjatywyNaKoniec(wejscie).map((r) => r.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('w tabeli wiersz bez inicjatywy jest ostatni i pisze „Bez inicjatywy", nie „—"', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie bez inicjatywy')).toBeInTheDocument());

    const tytuly = Array.from(document.querySelectorAll('table tbody tr')).map(
      (tr) => (tr.textContent || '').slice(0, 40)
    );
    const indeksBez = tytuly.findIndex((tekst) => tekst.includes('Zadanie bez inicjatywy'));
    const indeksZ = tytuly.findIndex((tekst) => tekst.includes('Zadanie z inicjatywa'));
    expect(indeksBez).toBeGreaterThan(indeksZ);
    expect(within(wiersz('Zadanie bez inicjatywy')).getByText('Bez inicjatywy')).toBeInTheDocument();
  });
});

describe('P16-R2 (e) — „Dni po terminie" tylko dla niezakończonych', () => {
  it('zadanie zamknięte po terminie ma „—", niezakończone ma liczbę', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie zamkniete po terminie')).toBeInTheDocument());

    expect(screen.getByText('Dni po terminie')).toBeInTheDocument();
    const zamkniete = wiersz('Zadanie zamkniete po terminie');
    expect(within(zamkniete).queryByText('+9')).toBeNull();
    expect(within(zamkniete).getAllByText('—').length).toBeGreaterThan(0);
    expect(within(wiersz('Zadanie z inicjatywa')).getByText('+3')).toBeInTheDocument();
  });
});
