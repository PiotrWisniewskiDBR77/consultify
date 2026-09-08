/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] Podglad osoby nie moze stawiac zaleglosci
 * obok liczby, ktora jej nie dotyczy.
 *
 * ZMIERZONY DEFEKT (08.09, kopia bazy stagingu, org DBR77, konto wlasciciela):
 * w podgladzie wiersza „Piotr Wisniewski" stalo obok siebie
 * „Zaleglosc 341 h", „Zadania 0" i „Przydzialy kanoniczne 0" — czytane
 * wprost: liczba wzieta znikad. Obie zerowe liczby byly poprawne, ale o czym
 * INNYM: `taskCount` to zadania POPYTU TEGO TYGODNIA (petla popytu w
 * `workloadCapacityService.ts` pomija zadania po terminie: `continue`), a
 * przydzialy kanoniczne pochodza z `ie_aggregate_state`, podczas gdy zaleglosc
 * liczona jest z tabeli `tasks`. Zweryfikowane w bazie: 102 otwarte zadania
 * Piotra, wszystkie po terminie, 341 h pozostalych godzin.
 *
 * KONTRAKT: etykieta nazywa okno, ktorego liczba dotyczy, a obok stoi liczba
 * zadan, z ktorych zaleglosc naprawde jest policzona.
 *
 * DOWOD MUTACYJNY: przywrocenie etykiety `Zadania` i skasowanie wiersza
 * `Zadania zalegle` -> oba ponizsze testy RED.
 */
import { render, screen } from '@testing-library/react';
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
    selector({ currentUser: { id: 'u-piotr' }, isChatCollapsed: true }),
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

/** 102 zadania Piotra, wszystkie po terminie — ksztalt 1:1 z danymi DBR77. */
const ZALEGLE = Array.from({ length: 102 }, (_, i) => ({
  taskId: `zadanie-${i + 1}`,
  title: `DBR77 zadanie ${i + 1}`,
  status: 'todo',
  dueDate: '2026-02-09',
  daysOverdue: 211,
  estimatedHours: 4,
  remainingHours: 4,
}));

const wiersz = (weekStart: string, pierwszy: boolean) => ({
  userId: 'u-piotr',
  name: 'Piotr Wiśniewski',
  role: 'Platform SuperAdmin',
  weekStart,
  demandHours: 0,
  supplyHours: 40,
  utilizationPercent: 0,
  gapHours: 40,
  overdueHours: 0,
  backlogHours: pierwszy ? 341 : 0,
  backlogTaskIds: pierwszy ? ZALEGLE.map((z) => z.taskId) : [],
  backlogTasks: pierwszy ? ZALEGLE : [],
  // ZERO — bo caly popyt tego tygodnia jest pusty, praca jest po terminie.
  taskCount: 0,
  supplySource: 'DOMYSLNA' as const,
});

const PLAN = {
  asOf: '2026-09-08T04:00:00.000Z',
  weeks: ['2026-09-07', '2026-09-14'],
  rows: [wiersz('2026-09-07', true), wiersz('2026-09-14', false)],
  people: [
    {
      userId: 'u-piotr',
      name: 'Piotr Wiśniewski',
      role: 'Platform SuperAdmin',
      weeklyCapacityHours: 40,
      availabilityPercent: 100,
      supplySource: 'DOMYSLNA' as const,
      backlogHours: 341,
      unscheduledHours: 0,
      backlogTaskIds: ZALEGLE.map((z) => z.taskId),
      backlogTasks: ZALEGLE,
    },
  ],
  summary: {
    peopleCount: 1,
    demandHours: 0,
    supplyHours: 80,
    gapHours: 80,
    utilizationPercent: 0,
    overloadedCount: 0,
    peopleWithoutProfileSupply: 1,
    backlogHoursTotal: 341,
    backlogPeople: 1,
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  listExecutionCases.mockResolvedValue({ cases: [] });
  readExecutionResourcePlan.mockResolvedValue(PLAN);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const otworzPodglad = async () => {
  const uzytkownik = userEvent.setup();
  render(
    <MemoryRouter initialEntries={['/execution']}>
      <ExecutionResourcesSurface activePreset="osoby" />
    </MemoryRouter>
  );
  const komorka = await screen.findAllByText(/Piotr Wiśniewski/);
  await uzytkownik.click(komorka[0]);
  await screen.findByText('Backlog');
  return uzytkownik;
};

describe('Zasoby — podgląd osoby nazywa okno liczby zadań (DEC-453)', () => {
  it('nie stawia gołej etykiety „Zadania" obok zaległości 341 h', async () => {
    await otworzPodglad();

    expect(screen.getAllByText('341 h').length).toBeGreaterThan(0);
    expect(screen.queryByText('Tasks')).not.toBeInTheDocument();
    expect(screen.getByText('Tasks this week')).toBeInTheDocument();
  });

  it('pokazuje, z ilu zadań zaległość jest policzona', async () => {
    await otworzPodglad();

    expect(screen.getByText('Overdue tasks')).toBeInTheDocument();
    expect(screen.getByText('102')).toBeInTheDocument();
  });
});
