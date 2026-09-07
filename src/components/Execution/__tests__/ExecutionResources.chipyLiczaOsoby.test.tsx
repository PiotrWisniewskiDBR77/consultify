/**
 * @vitest-environment jsdom
 *
 * [ODMROZENIE 06_EXECUTION DEC-453] P16-R0 (§3 pkt 3, §4 D7).
 *
 * ZMIERZONY DEFEKT (`ExecutionResourcesSurface.tsx:409-411` przed naprawą):
 * chipy Menu 3 liczyły `tableItems` — wiersze OSOBA×TYDZIEŃ (jeden na osobę
 * na każdy z 8 tygodni) — obok paska podsumowania, który liczy OSOBY. Na
 * DBR77 to dawało „Osoby 72" przy napisie „osób 9" na tym samym ekranie.
 * `role` filtrował po `job_title` (0/31 — pole bywa puste), `konflikty`
 * liczył WIERSZE z przeciążeniem, nie OSOBY z przeciążeniem.
 *
 * KONTRAKT PO NAPRAWIE: trzy chipy, każdy liczony PO OSOBIE (`personSummaries`,
 * jeden wpis na `userId`, nie na wiersz):
 *  - `osoby`     = wszystkie osoby z planu (3 w tym fixture, NIE 6 wierszy);
 *  - `przeciazeni` = osoba ma choć jeden tydzień z obłożeniem > 100 %
 *    (Anna: 160 % w tygodniu 1 -> licz; Julia: 120 % w tygodniu 2 -> licz;
 *    Marek: 50 %/60 % -> nie licz) = 2, NIE liczba wierszy przeciążonych;
 *  - trzeci chip: do P16-R0 `bez-stanowiska` (osoba bez `role`), od P16-R1
 *    `z-zalegloscia` (osoba z pracą po terminie — Marek, `backlogHours: 6`) = 1.
 * Filtr chipa `przeciazeni` zawęża TABELĘ do wierszy tych dwóch osób (4
 * wiersze z 6), nie do pojedynczych przeciążonych wierszy.
 *
 * DOWÓD MUTACYJNY: przywrócenie starego `matches()` (liczenie po `tableItems`
 * zamiast po `personSummaries` w `countExecutionPresets`) daje chip „Osoby"
 * = 6 (liczba wierszy) zamiast 3 (liczba osób) -> test „chip Osoby liczy
 * OSOBY..." czerwony.
 */
import { act, render, screen, waitFor } from '@testing-library/react';
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

const {
  listExecutionCases,
  readExecutionWork,
  readOperationalAllocations,
  readExecutionCase,
} = vi.hoisted(() => ({
  listExecutionCases: vi.fn(),
  readExecutionWork: vi.fn(),
  readOperationalAllocations: vi.fn(),
  readExecutionCase: vi.fn(),
}));

const { readExecutionResourcePlan, saveUserCapacity } = vi.hoisted(() => ({
  readExecutionResourcePlan: vi.fn(),
  saveUserCapacity: vi.fn(),
}));

vi.mock('@/services/execution/resourcePlanApi', () => ({
  readExecutionResourcePlan,
  saveUserCapacity,
  // P16-R1: powierzchnia woła też trzy akcje rozliczenia zaległości.
  przeniesZadanieNaTermin: vi.fn(),
  zamknijZadanieZaleglosci: vi.fn(),
  zmniejszZakresZadania: vi.fn(),
}));

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

const CASES = { cases: [] };

// Trzy osoby, dwa tygodnie. Anna i Julia mają choć jeden tydzień >100%
// (przeciążeni = 2 OSOBY, nie 3 przeciążone WIERSZE — Anna ma jeden
// przeciążony tydzień z dwóch). Marek ma pustą rolę (bez-stanowiska = 1).
const PLAN = {
  asOf: '2026-09-07T10:00:00.000Z',
  weeks: ['2026-09-07', '2026-09-14'],
  rows: [
    {
      userId: 'u-anna',
      name: 'Anna Kowalska',
      role: 'Konsultant',
      weekStart: '2026-09-07',
      demandHours: 64,
      supplyHours: 40,
      utilizationPercent: 160,
      gapHours: -24,
      overdueHours: 12,
      taskCount: 5,
      supplySource: 'DOMYSLNA' as const,
    },
    {
      userId: 'u-anna',
      name: 'Anna Kowalska',
      role: 'Konsultant',
      weekStart: '2026-09-14',
      demandHours: 20,
      supplyHours: 40,
      utilizationPercent: 50,
      gapHours: 20,
      overdueHours: 0,
      taskCount: 2,
      supplySource: 'DOMYSLNA' as const,
    },
    {
      userId: 'u-marek',
      name: 'Marek Nowak',
      role: '',
      weekStart: '2026-09-07',
      demandHours: 10,
      supplyHours: 20,
      utilizationPercent: 50,
      gapHours: 10,
      overdueHours: 0,
      taskCount: 2,
      supplySource: 'PROFIL' as const,
    },
    {
      userId: 'u-marek',
      name: 'Marek Nowak',
      role: '',
      weekStart: '2026-09-14',
      demandHours: 12,
      supplyHours: 20,
      utilizationPercent: 60,
      gapHours: 8,
      overdueHours: 0,
      taskCount: 2,
      supplySource: 'PROFIL' as const,
    },
    {
      userId: 'u-julia',
      name: 'Julia Zielińska',
      role: 'Analityk',
      weekStart: '2026-09-07',
      demandHours: 14,
      supplyHours: 20,
      utilizationPercent: 70,
      gapHours: 6,
      overdueHours: 0,
      taskCount: 1,
      supplySource: 'PROFIL' as const,
    },
    {
      userId: 'u-julia',
      name: 'Julia Zielińska',
      role: 'Analityk',
      weekStart: '2026-09-14',
      demandHours: 24,
      supplyHours: 20,
      utilizationPercent: 120,
      gapHours: -4,
      overdueHours: 4,
      taskCount: 3,
      supplySource: 'PROFIL' as const,
    },
  ],
  people: [
    {
      userId: 'u-anna',
      name: 'Anna Kowalska',
      role: 'Konsultant',
      weeklyCapacityHours: 40,
      availabilityPercent: 100,
      supplySource: 'DOMYSLNA' as const,
      backlogHours: 0,
      unscheduledHours: 0,
      backlogTaskIds: [] as string[],
      backlogTasks: [] as never[],
    },
    {
      userId: 'u-marek',
      name: 'Marek Nowak',
      role: '',
      weeklyCapacityHours: 20,
      availabilityPercent: 100,
      supplySource: 'PROFIL' as const,
      backlogHours: 6,
      unscheduledHours: 0,
      backlogTaskIds: ['t-marek-1'],
      backlogTasks: [
        {
          taskId: 't-marek-1',
          title: 'Raport tygodniowy',
          status: 'todo',
          dueDate: '2026-09-02',
          daysOverdue: 5,
          estimatedHours: 6,
          remainingHours: 6,
        },
      ],
    },
    {
      userId: 'u-julia',
      name: 'Julia Zielińska',
      role: 'Analityk',
      weeklyCapacityHours: 20,
      availabilityPercent: 100,
      supplySource: 'PROFIL' as const,
      backlogHours: 0,
      unscheduledHours: 0,
      backlogTaskIds: [] as string[],
      backlogTasks: [] as never[],
    },
  ],
  summary: {
    peopleCount: 3,
    demandHours: 144,
    supplyHours: 160,
    gapHours: 16,
    utilizationPercent: 90,
    overloadedCount: 2,
    peopleWithoutProfileSupply: 0,
    backlogHoursTotal: 6,
    backlogPeople: 1,
  },
};

const renderSurface = (props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter initialEntries={['/execution']}>
      <ExecutionResourcesSurface activePreset="osoby" {...(props as any)} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  listExecutionCases.mockResolvedValue(CASES);
  readExecutionResourcePlan.mockResolvedValue(PLAN);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Zasoby — chipy liczą osoby, nie wiersze (P16-R0)', () => {
  it('chip "Osoby" liczy OSOBY (3), nie wiersze osoba×tydzień (6)', async () => {
    const onCountsChange = vi.fn();
    renderSurface({ onCountsChange });

    await waitFor(() => expect(screen.getAllByText(/Anna Kowalska/).length).toBeGreaterThan(0));
    await waitFor(() => expect(onCountsChange).toHaveBeenCalled());

    const lastCounts = onCountsChange.mock.calls.at(-1)?.[0];
    expect(lastCounts.osoby).toBe(3);
    expect(lastCounts.osoby).not.toBe(PLAN.rows.length);
  });

  it('chip "Przeciążeni" liczy 2 osoby (Anna, Julia), nie 2 przeciążone wiersze z 6', async () => {
    const onCountsChange = vi.fn();
    renderSurface({ onCountsChange });

    await waitFor(() => expect(screen.getAllByText(/Anna Kowalska/).length).toBeGreaterThan(0));
    await waitFor(() => expect(onCountsChange).toHaveBeenCalled());

    const lastCounts = onCountsChange.mock.calls.at(-1)?.[0];
    expect(lastCounts.przeciazeni).toBe(2);
  });

  it('chip "Z zaległością" liczy 1 osobę (Marek, backlogHours 6)', async () => {
    const onCountsChange = vi.fn();
    renderSurface({ onCountsChange });

    await waitFor(() => expect(screen.getAllByText(/Anna Kowalska/).length).toBeGreaterThan(0));
    await waitFor(() => expect(onCountsChange).toHaveBeenCalled());

    const lastCounts = onCountsChange.mock.calls.at(-1)?.[0];
    expect(lastCounts['z-zalegloscia']).toBe(1);
  });

  it('preset "przeciazeni" filtruje wiersze do osób z przeciążeniem (Anna + Julia = 4 wiersze z 6, bez Marka)', async () => {
    renderSurface({ activePreset: 'przeciazeni' });

    await waitFor(() => expect(screen.getAllByText(/Anna Kowalska/).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/Julia Zielińska/).length).toBeGreaterThan(0);
    expect(screen.queryAllByText(/Marek Nowak/).length).toBe(0);
  });

  it('preset "z-zalegloscia" filtruje wiersze do Marka (jedyna zaległość), bez Anny/Julii', async () => {
    renderSurface({ activePreset: 'z-zalegloscia' });

    await waitFor(() => expect(screen.getAllByText(/Marek Nowak/).length).toBeGreaterThan(0));
    expect(screen.queryAllByText(/Anna Kowalska/).length).toBe(0);
    expect(screen.queryAllByText(/Julia Zielińska/).length).toBe(0);
  });
});
