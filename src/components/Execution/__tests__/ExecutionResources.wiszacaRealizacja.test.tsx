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
      <ExecutionResourcesSurface activePreset="all" {...(props as any)} />
    </MemoryRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  listExecutionCases.mockResolvedValue(CASES);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Zasoby — realizacja, która nie odpowiada', () => {
  it('renderuje wiersze pozostałych realizacji, NIE czekając na wiszącą', async () => {
    readOperationalAllocations.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) return new Promise(() => {});
      return OK_ALLOCATIONS;
    });
    readExecutionWork.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) return new Promise(() => {});
      return OK_WORK;
    });

    renderSurface();

    // Limit jednej realizacji to 12 s. Wiersz ma byc DUZO wczesniej — realny
    // czas tego oczekiwania to setki milisekund, nie 12 000 ms.
    await waitFor(() => expect(screen.getByText('Anna Kowalska')).toBeInTheDocument(), {
      timeout: 3000,
    });
    expect(screen.queryByTestId('execution-resources-loading')).not.toBeInTheDocument();
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

  it('wybór wiszącej realizacji kończy się polskim „nie odpowiada", nie wiecznym szkieletem', async () => {
    readOperationalAllocations.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) return new Promise(() => {});
      return OK_ALLOCATIONS;
    });
    readExecutionWork.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) return new Promise(() => {});
      return OK_WORK;
    });
    readExecutionCase.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) return new Promise(() => {});
      return { version: 1 };
    });
    const registerFilterControl = vi.fn();

    renderSurface({ onRegisterFilterControl: registerFilterControl });
    await waitFor(() => expect(screen.getByText('Anna Kowalska')).toBeInTheDocument(), {
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
    expect(screen.queryByTestId('execution-resources-loading')).not.toBeInTheDocument();
  });
});
