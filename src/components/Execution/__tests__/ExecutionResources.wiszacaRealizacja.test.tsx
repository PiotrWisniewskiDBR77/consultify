/**
 * @vitest-environment jsdom
 *
 * Zasoby wobec realizacji, ktora NIE ODPOWIADA WCALE (never-resolving fetch).
 *
 * ZMIERZONY DEFEKT (1.12-R2, 2026-09-06) — trzy warstwy, dwie z nich tutaj:
 *  (2) `fanOutExecutionCases` konczyl sie dopiero po NAJWOLNIEJSZEJ realizacji
 *      (`Promise.all`), czyli po pelnych 12 s — pierwszy wiersz tabeli czekal
 *      12 s, chociaz dane pozostalych realizacji byly gotowe po ~200 ms;
 *  (3) `load(id)` (wybor jednej realizacji z Menu 2) szedl golym `Promise.all`
 *      BEZ `AbortSignal` i BEZ limitu — klikniecie w wiszaca realizacje
 *      dawalo szkielet, potem `ErrorState variant="timeout"` po 15 s.
 *
 * KONTRAKT:
 *  · lista renderuje wiersze pozostalych realizacji szybciej niz limit
 *    (test: przed uplywem 12 s zegara),
 *  · realizacja, ktora nie odpowiedziala, jest OZNACZONA na liscie wyboru,
 *  · wybor wiszacej realizacji konczy sie polskim stanem „nie odpowiada",
 *    a nie wiecznym szkieletem.
 *
 * DOWOD MUTACYJNY: zdjecie limitu z `load(id)` (goly `Promise.all`) ->
 * test „wybor wiszacej realizacji…" na czerwono (stan zostaje LOADING).
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

const HANGING_CASE = 'a3e05d4a-5397-419d-b486-8e44366c0063--acceptance--execution-case';

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

const CASES = {
  cases: [
    { executionCaseId: 'case-ok', initiativeId: 'init-ok', initiativeTitle: 'Realizacja OEE' },
    { executionCaseId: HANGING_CASE, initiativeId: 'init-hang', initiativeTitle: 'Akceptacja ACO' },
  ],
};

const OK_WORK = {
  tasks: [{ taskId: 'task-1', title: 'Walidacja danych dostawców', version: 3 }],
  decisions: [],
};

const PLAN = {
  asOf: '2026-09-06T10:00:00.000Z',
  weeks: ['2026-08-31', '2026-09-07'],
  rows: [
    {
      userId: 'u-anna',
      name: 'Anna Kowalska',
      role: 'Konsultant',
      weekStart: '2026-08-31',
      demandHours: 64,
      supplyHours: 40,
      utilizationPercent: 160,
      gapHours: -24,
      overdueHours: 12,
      taskCount: 5,
      supplySource: 'DOMYSLNA' as const,
    },
    {
      userId: 'u-marek',
      name: 'Marek Nowak',
      role: '',
      weekStart: '2026-08-31',
      demandHours: 10,
      supplyHours: 20,
      utilizationPercent: 50,
      gapHours: 10,
      overdueHours: 0,
      taskCount: 2,
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
    },
    {
      userId: 'u-marek',
      name: 'Marek Nowak',
      role: '',
      weeklyCapacityHours: 40,
      availabilityPercent: 50,
      supplySource: 'PROFIL' as const,
      backlogHours: 6,
    },
  ],
  summary: {
    peopleCount: 2,
    demandHours: 74,
    supplyHours: 60,
    gapHours: -14,
    utilizationPercent: 123,
    overloadedCount: 1,
    peopleWithoutProfileSupply: 1,
  },
};

const OK_ALLOCATIONS = {
  items: [
    {
      allocationId: 'alloc-1',
      taskId: 'task-1',
      assigneeName: 'Anna Kowalska',
      status: 'CONFIRMED',
      version: 2,
      demand: {},
    },
  ],
};

const renderSurface = (props: Record<string, unknown> = {}) =>
  render(
    <MemoryRouter initialEntries={['/execution']}>
      {/* NAPRAWA odbioru 06.09 (DEC-441): preset 'all' zastąpiony 'osoby' —
          Menu 3 tej zakładki zawężony do 3 chipów (Osoby · Role · Konflikty),
          patrz ExecutionResourcesSurface.tsx (matches()) i ExecutionHub.tsx
          (getExecutionMenu3). */}
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

describe('Zasoby — realizacja, która nie odpowiada', () => {
  const wiszaceRealizacje = () => {
    readOperationalAllocations.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) return new Promise(() => {});
      return OK_ALLOCATIONS;
    });
    readExecutionWork.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) return new Promise(() => {});
      return OK_WORK;
    });
  };

  it('renderuje tabelę obłożenia, NIE czekając na wiszącą realizację', async () => {
    wiszaceRealizacje();

    renderSurface();

    // Limit jednej realizacji to 12 s. Wiersze maja byc DUZO wczesniej —
    // plan zasobow nie zalezy od realizacji i nie moze na nia czekac.
    await waitFor(() => expect(screen.getByText(/Anna Kowalska/)).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.queryByTestId('execution-resources-loading')).not.toBeInTheDocument();
  });

  it('pokazuje kolumny popytu, podaży, obłożenia i luki z realnymi liczbami', async () => {
    wiszaceRealizacje();

    renderSurface();

    await waitFor(() => expect(screen.getByText(/Anna Kowalska/)).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.getByText('Popyt (h)')).toBeInTheDocument();
    expect(screen.getByText('Podaż (h)')).toBeInTheDocument();
    expect(screen.getByText('Obłożenie %')).toBeInTheDocument();
    expect(screen.getByText('Luka (h)')).toBeInTheDocument();
    expect(screen.getByText('64 h')).toBeInTheDocument();
    expect(screen.getByText('160 %')).toBeInTheDocument();
    expect(screen.getByText('-24 h')).toBeInTheDocument();
    // Nie ma szkieletu i nie ma pustego ekranu — sa wiersze.
    expect(
      screen.queryByText(/Brak osób z pracą w najbliższych 8 tygodniach/)
    ).not.toBeInTheDocument();
  });

  it('oznacza wiszącą realizację na liście wyboru, gdy minie limit', async () => {
    readOperationalAllocations.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) throw new Error('backend nie odpowiada');
      return OK_ALLOCATIONS;
    });
    readExecutionWork.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) throw new Error('backend nie odpowiada');
      return OK_WORK;
    });
    const registerFilterControl = vi.fn();

    renderSurface({ onRegisterFilterControl: registerFilterControl });

    await waitFor(() =>
      expect(screen.getByText(/Nie udało się pobrać zasobów z 1 realizacji/)).toBeInTheDocument()
    );
    const lastNode = registerFilterControl.mock.calls.at(-1)?.[0];
    const registered = render(<MemoryRouter>{lastNode as React.ReactNode}</MemoryRouter>);
    expect(registered.getByText('Akceptacja ACO — nie odpowiada')).toBeInTheDocument();
  });

  it('zgłasza realizację bez odpowiedzi NATYCHMIAST, nie po zamknięciu całego wachlarza', async () => {
    // „case-ok" wisi (nigdy nie odpowie), „HANGING_CASE" pada od razu.
    // Bez renderu przyrostowego komunikat czekalby na koniec Promise.all,
    // czyli pelne 12 s.
    readOperationalAllocations.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) throw new Error('backend nie odpowiada');
      return new Promise(() => {});
    });
    readExecutionWork.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) throw new Error('backend nie odpowiada');
      return new Promise(() => {});
    });

    renderSurface();

    await waitFor(
      () => expect(screen.getByText(/Nie udało się pobrać zasobów z 1 realizacji/)).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });

  it('wybór wiszącej realizacji kończy się polskim „nie odpowiada", nie wiecznym szkieletem', async () => {
    wiszaceRealizacje();
    readExecutionCase.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) return new Promise(() => {});
      return { version: 1 };
    });
    const registerFilterControl = vi.fn();

    renderSurface({ onRegisterFilterControl: registerFilterControl });
    await waitFor(() => expect(screen.getByText(/Anna Kowalska/)).toBeInTheDocument(), {
      timeout: 3000,
    });

    // Wybór wiszącej realizacji z Menu 2 — sciezka `load(id)`.
    const lastNode = registerFilterControl.mock.calls.at(-1)?.[0] as any;
    const onChange = lastNode.props.children[0].props.onChange as (e: any) => void;
    vi.useFakeTimers();
    act(() => onChange({ target: { value: HANGING_CASE } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(12_000);
    });
    vi.useRealTimers();

    await waitFor(() =>
      expect(screen.getByTestId('execution-resources-case-unreachable')).toBeInTheDocument()
    );
    expect(screen.getByText(/Ta realizacja nie odpowiada: Akceptacja ACO/)).toBeInTheDocument();
  });

  it('CTA „Dodaj dostępność" zapisuje etat i przelicza plan', async () => {
    wiszaceRealizacje();
    saveUserCapacity.mockResolvedValue({
      userId: 'u-anna',
      weeklyCapacityHours: 32,
      availabilityPercent: 80,
    });
    const registerFilterControl = vi.fn();

    renderSurface({ onRegisterFilterControl: registerFilterControl });
    await waitFor(() => expect(screen.getByText(/Anna Kowalska/)).toBeInTheDocument(), {
      timeout: 3000,
    });

    const lastNode = registerFilterControl.mock.calls.at(-1)?.[0] as React.ReactNode;
    const registered = render(<MemoryRouter>{lastNode}</MemoryRouter>);
    await act(async () => {
      registered.getByTestId('execution-resources-add-availability').click();
    });

    const dialog = await screen.findByTestId('execution-resources-capacity-dialog');
    expect(dialog).toHaveTextContent('Anna Kowalska');
    const zapisz = [...dialog.querySelectorAll('button')].find(
      (b) => b.textContent === 'Zapisz'
    ) as HTMLButtonElement;
    await act(async () => {
      zapisz.click();
    });

    expect(saveUserCapacity).toHaveBeenCalledWith('u-anna', {
      weeklyCapacityHours: 40,
      availabilityPercent: 100,
    });
    // Po zapisie plan jest czytany PONOWNIE — inaczej tabela pokazywalaby
    // stara podaz mimo zmienionego etatu.
    expect(readExecutionResourcePlan).toHaveBeenCalledTimes(2);
  });
});
