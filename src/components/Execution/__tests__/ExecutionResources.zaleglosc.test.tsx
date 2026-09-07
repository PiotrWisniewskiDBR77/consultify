/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] P16-R1 (§4 D1, §6 f).
 *
 * ZMIERZONY DEFEKT (07.09, kopia bazy `consultify_p16r1`, org DBR77):
 * `workloadCapacityService.getExecutionResourcePlan` doliczał CAŁĄ pracę po
 * terminie do popytu pierwszego tygodnia, więc wiersz Marka Nowaka mówił
 * „112 h / 40 h / 280 %", a kolejne tygodnie 0 h. Nie było czego kliknąć:
 * zaległość nie miała ani własnej liczby, ani ani jednej akcji.
 *
 * KONTRAKT PO NAPRAWIE: zaległość stoi w OSOBNEJ kolumnie (tylko w wierszu
 * bieżącego tygodnia), klik w liczbę otwiera listę zadań zaległych, a każde
 * ma trzy akcje jadące jednym istniejącym zapisem `PUT /api/tasks/:id`:
 * przenieś na tydzień (`dueDate`) · uznaj za zamknięte (`status`) · zmniejsz
 * zakres (`estimatedHours`). Po każdym zapisie plan jest CZYTANY OD NOWA z
 * serwera — liczba w kolumnie ma być faktem, nie obietnicą.
 *
 * DOWÓD MUTACYJNY (wykonany ręcznie 07.09):
 *  - usunięcie `await loadPlan()` z `wykonajAkcjeZaleglosci` -> test
 *    „odświeża plan" RED (jedno wywołanie zamiast dwóch);
 *  - zamiana `{ dueDate }` na `{ due_date }` w `przeniesZadanieNaTermin` ->
 *    test „woła PUT … z dueDate" RED.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object') {
        const opts = fallback as Record<string, unknown>;
        const wzorzec = typeof opts.defaultValue === 'string' ? opts.defaultValue : k;
        return wzorzec.replace(/\{\{(\w+)\}\}/g, (_m, name) => String(opts[name] ?? ''));
      }
      return k;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({ currentUser: { id: 'user-anna' }, isChatCollapsed: true }),
}));

const { listExecutionCases, readExecutionWork, readOperationalAllocations, readExecutionCase } =
  vi.hoisted(() => ({
    listExecutionCases: vi.fn(),
    readExecutionWork: vi.fn(),
    readOperationalAllocations: vi.fn(),
    readExecutionCase: vi.fn(),
  }));

const { readExecutionResourcePlan, saveUserCapacity } = vi.hoisted(() => ({
  readExecutionResourcePlan: vi.fn(),
  saveUserCapacity: vi.fn(),
}));

// Podmieniamy WYŁĄCZNIE odczyt planu i zapis dostępności. Trzy akcje
// zaległości zostają PRAWDZIWE — inaczej test sprawdzałby własną atrapę
// zamiast tego, co naprawdę leci na `PUT /api/tasks/:id`.
vi.mock('@/services/execution/resourcePlanApi', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/services/execution/resourcePlanApi')>();
  return { ...actual, readExecutionResourcePlan, saveUserCapacity };
});

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases,
  readExecutionWork,
  readOperationalAllocations,
  readExecutionCase,
  readExecutionMilestones: vi.fn(),
  proposeOperationalAllocation: vi.fn(),
  simulateOperationalAllocation: vi.fn(),
  transitionOperationalAllocation: vi.fn(),
}));

import { ExecutionResourcesSurface } from '../ExecutionResourcesSurface';

const ZADANIE = {
  taskId: 'zadanie-1',
  title: 'DBR77: Zweryfikować eksport raportów',
  status: 'todo',
  dueDate: '2026-09-02',
  daysOverdue: 5,
  estimatedHours: 6,
  remainingHours: 6,
};

const wiersz = (weekStart: string, zZalegloscia: boolean) => ({
  userId: 'u-marek',
  name: 'Marek Nowak',
  role: 'Konsultant',
  weekStart,
  demandHours: zZalegloscia ? 16 : 8,
  supplyHours: 40,
  utilizationPercent: zZalegloscia ? 40 : 20,
  gapHours: zZalegloscia ? 24 : 32,
  overdueHours: 0,
  backlogHours: zZalegloscia ? 6 : 0,
  backlogTaskIds: zZalegloscia ? [ZADANIE.taskId] : [],
  backlogTasks: zZalegloscia ? [ZADANIE] : [],
  taskCount: 2,
  supplySource: 'DOMYSLNA' as const,
});

const PLAN = {
  asOf: '2026-09-07T10:00:00.000Z',
  weeks: ['2026-09-07', '2026-09-14'],
  rows: [wiersz('2026-09-07', true), wiersz('2026-09-14', false)],
  people: [
    {
      userId: 'u-marek',
      name: 'Marek Nowak',
      role: 'Konsultant',
      weeklyCapacityHours: 40,
      availabilityPercent: 100,
      supplySource: 'DOMYSLNA' as const,
      backlogHours: 6,
      unscheduledHours: 0,
      backlogTaskIds: [ZADANIE.taskId],
      backlogTasks: [ZADANIE],
    },
  ],
  summary: {
    peopleCount: 1,
    demandHours: 24,
    supplyHours: 80,
    gapHours: 56,
    utilizationPercent: 30,
    overloadedCount: 0,
    peopleWithoutProfileSupply: 1,
    backlogHoursTotal: 6,
    backlogPeople: 1,
  },
};

let zapisy: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];

const renderSurface = () =>
  render(
    <MemoryRouter initialEntries={['/execution']}>
      <ExecutionResourcesSurface activePreset="osoby" />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  zapisy = [];
  listExecutionCases.mockResolvedValue({ cases: [] });
  readExecutionResourcePlan.mockResolvedValue(PLAN);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo, init?: RequestInit) => {
      zapisy.push({
        url: String(input),
        method: String(init?.method ?? 'GET'),
        body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {},
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({}),
      } as unknown as Response;
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const otworzZaleglosc = async () => {
  const uzytkownik = userEvent.setup();
  renderSurface();
  const wejscie = await screen.findByTestId('execution-resources-backlog-open-u-marek');
  await uzytkownik.click(wejscie);
  await screen.findByTestId('execution-resources-backlog-panel');
  return uzytkownik;
};

describe('Zasoby — zaległość jako osobna kolumna z akcjami (P16-R1)', () => {
  it('zaległość stoi TYLKO w wierszu bieżącego tygodnia, w pozostałych „—"', async () => {
    renderSurface();

    await screen.findByTestId('execution-resources-backlog-open-u-marek');
    expect(screen.getByTestId('execution-resources-backlog-open-u-marek')).toHaveTextContent('6 h');
    // Drugi tydzień tej samej osoby: myślnik, nie „0 h" i nie druga szóstka.
    expect(screen.getAllByTestId(/execution-resources-backlog-open-/)).toHaveLength(1);
  });

  it('„Przenieś na tydzień" woła PUT /api/tasks/:id z dueDate i odświeża plan', async () => {
    const uzytkownik = await otworzZaleglosc();

    await uzytkownik.click(screen.getByTestId(`execution-resources-backlog-move-${ZADANIE.taskId}`));
    const pole = screen.getByTestId('execution-resources-backlog-move-date');
    await uzytkownik.clear(pole);
    await uzytkownik.type(pole, '2026-09-14');
    await uzytkownik.click(screen.getByTestId('execution-resources-backlog-move-confirm'));

    await waitFor(() => expect(zapisy.length).toBeGreaterThan(0));
    expect(zapisy[0].url).toBe(`/api/tasks/${ZADANIE.taskId}`);
    expect(zapisy[0].method).toBe('PUT');
    expect(zapisy[0].body).toEqual({ dueDate: '2026-09-14' });
    // Odświeżenie planu z serwera: pierwsze wywołanie przy montowaniu,
    // drugie PO zapisie.
    await waitFor(() => expect(readExecutionResourcePlan).toHaveBeenCalledTimes(2));
  });

  it('„Uznaj za zamknięte" idzie kanoniczną ścieżką silnika (todo -> in_progress -> done)', async () => {
    const uzytkownik = await otworzZaleglosc();

    await uzytkownik.click(
      screen.getByTestId(`execution-resources-backlog-close-${ZADANIE.taskId}`)
    );

    await waitFor(() => expect(zapisy.length).toBe(2));
    expect(zapisy.map((z) => z.body)).toEqual([{ status: 'in_progress' }, { status: 'done' }]);
    expect(zapisy.every((z) => z.method === 'PUT')).toBe(true);
    await waitFor(() => expect(readExecutionResourcePlan).toHaveBeenCalledTimes(2));
  });

  it('„Zmniejsz zakres" woła PUT z estimatedHours', async () => {
    const uzytkownik = await otworzZaleglosc();

    await uzytkownik.click(
      screen.getByTestId(`execution-resources-backlog-scope-${ZADANIE.taskId}`)
    );
    const pole = screen.getByTestId('execution-resources-backlog-scope-hours');
    await uzytkownik.clear(pole);
    await uzytkownik.type(pole, '2');
    await uzytkownik.click(screen.getByTestId('execution-resources-backlog-scope-confirm'));

    await waitFor(() => expect(zapisy.length).toBe(1));
    expect(zapisy[0].body).toEqual({ estimatedHours: 2 });
  });

  it('odmowa zapisu daje komunikat PO POLSKU, a nie pusty ekran', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 409, json: async () => ({ error: 'blocked' }) }) as unknown as Response)
    );
    const uzytkownik = await otworzZaleglosc();

    await uzytkownik.click(
      screen.getByTestId(`execution-resources-backlog-close-${ZADANIE.taskId}`)
    );

    const komunikat = await screen.findByTestId('execution-resources-backlog-error');
    expect(komunikat.textContent ?? '').toMatch(/zablokowane niepodjętą decyzją/);
  });
});
