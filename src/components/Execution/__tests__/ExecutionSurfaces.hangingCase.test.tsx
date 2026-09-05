/**
 * @vitest-environment jsdom
 *
 * Zakładki Praca i Zasoby wobec JEDNEJ realizacji, która nie odpowiada.
 *
 * ZMIERZONY DEFEKT (odbiór na żywo 05.09, staging b852ade6):
 * `/api/initiatives/runtime-v1/execution-cases/a3e05d4a-…--acceptance--execution-case/work`
 * nie zwraca odpowiedzi w ogóle (curl -m 30 → http=000, pozostałe 5 realizacji 200).
 * Obie powierzchnie pobierały dane przez `await Promise.all(cases.map(...))`, więc:
 *   · Praca wisiała na „Loading canonical work" z licznikami Menu 3 na zerach,
 *   · Zasoby renderowały PUSTY obszar (ta powierzchnia nie miała gałęzi dla LOADING).
 *
 * DOWÓD MUTACYJNY (wykonany 2026-09-05): przywrócenie `Promise.all` w
 * `fanOutExecutionCases` → testy „…mimo realizacji, która nie odpowiada" i
 * „…mimo realizacji, która zwraca błąd" padają (Praca zostaje na komunikacie
 * ładowania, Zasoby renderują pustkę). Mutacja celuje w SAM MECHANIZM
 * ODPORNOŚCI wachlarza, nie w mapowanie danych.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : k),
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({ currentUser: { id: 'user-anna' } }),
}));

const HANGING_CASE = 'a3e05d4a-5397-419d-b486-8e44366c0063--acceptance--execution-case';

const { listExecutionCases, readExecutionWork, readOperationalAllocations } = vi.hoisted(() => ({
  listExecutionCases: vi.fn(),
  readExecutionWork: vi.fn(),
  readOperationalAllocations: vi.fn(),
}));

vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases,
  readExecutionWork,
  readOperationalAllocations,
  readExecutionCase: vi.fn(),
  readExecutionMilestones: vi.fn(),
  createExecutionTask: vi.fn(),
  updateExecutionTask: vi.fn(),
  completeExecutionTask: vi.fn(),
  createExecutionDecision: vi.fn(),
  requestExecutionDecision: vi.fn(),
  decideExecutionDecision: vi.fn(),
  createExecutionMilestone: vi.fn(),
  proposeOperationalAllocation: vi.fn(),
  simulateOperationalAllocation: vi.fn(),
  acceptResourceCommitment: vi.fn(),
  requestResourceCommitment: vi.fn(),
  decideResourceCommitment: vi.fn(),
  assessOperationalAllocation: vi.fn(),
  confirmOperationalAllocation: vi.fn(),
  releaseOperationalAllocation: vi.fn(),
}));

import { ExecutionResourcesSurface } from '../ExecutionResourcesSurface';
import { ExecutionWorkSurface } from '../ExecutionWorkSurface';

const CASES = {
  cases: [
    { executionCaseId: 'case-ok', initiativeId: 'init-ok', initiativeTitle: 'Realizacja OEE' },
    { executionCaseId: HANGING_CASE, initiativeId: 'init-hang', initiativeTitle: 'Akceptacja' },
  ],
};

const OK_WORK = {
  tasks: [
    {
      taskId: 'task-1',
      title: 'Walidacja danych dostawców',
      status: 'OPEN',
      assigneeId: 'anna-kowalska',
      dueAt: '2026-09-20T10:00:00.000Z',
      slaAt: '2026-09-21T10:00:00.000Z',
      version: 3,
      evidenceRefs: [],
    },
  ],
  decisions: [],
};

const OK_ALLOCATIONS = {
  items: [
    {
      allocationId: 'alloc-1',
      taskId: 'task-1',
      assigneeId: 'anna-kowalska',
      status: 'CONFIRMED',
      demand: {},
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  listExecutionCases.mockResolvedValue(CASES);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Praca (ExecutionWorkSurface)', () => {
  it('pokazuje pracę pozostałych realizacji mimo realizacji, która zwraca błąd', async () => {
    readExecutionWork.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) throw new Error('backend nie odpowiada');
      return OK_WORK;
    });

    render(<ExecutionWorkSurface activePreset="all" />);

    await waitFor(() =>
      expect(screen.getByText('Walidacja danych dostawców')).toBeInTheDocument()
    );
    expect(screen.queryByText(/Wczytuję kanoniczny rejestr pracy/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Nie udało się pobrać pracy z 1 realizacji/)
    ).toBeInTheDocument();
  });

  it('nie wisi w nieskończoność, gdy realizacja NIE ODPOWIADA WCALE', async () => {
    readExecutionWork.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) return new Promise(() => {});
      return OK_WORK;
    });

    render(<ExecutionWorkSurface activePreset="all" />);

    // Domyślny limit wachlarza to 12 s (EXECUTION_CASE_FANOUT_TIMEOUT_MS).
    await waitFor(
      () => expect(screen.getByText('Walidacja danych dostawców')).toBeInTheDocument(),
      { timeout: 20000 }
    );
    expect(screen.queryByText(/Wczytuję kanoniczny rejestr pracy/)).not.toBeInTheDocument();
  }, 30000);

  it('liczniki Menu 3 dostają realne liczby, a nie zera', async () => {
    readExecutionWork.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) throw new Error('backend nie odpowiada');
      return OK_WORK;
    });
    const onCountsChange = vi.fn();

    render(<ExecutionWorkSurface activePreset="all" onCountsChange={onCountsChange} />);

    await waitFor(() => expect(onCountsChange).toHaveBeenCalled());
    const last = onCountsChange.mock.calls.at(-1)?.[0] as Record<string, number>;
    expect(last.all).toBe(1);
    expect(last.tasks).toBe(1);
  });
});

describe('Zasoby (ExecutionResourcesSurface)', () => {
  it('renderuje komunikat ładowania zamiast pustego, białego obszaru', () => {
    readOperationalAllocations.mockImplementation(() => new Promise(() => {}));
    readExecutionWork.mockImplementation(() => new Promise(() => {}));

    render(<ExecutionResourcesSurface activePreset="all" />);

    expect(screen.getByText(/Wczytuję kanoniczny rejestr zasobów/)).toBeInTheDocument();
  });

  it('pokazuje zasoby pozostałych realizacji mimo realizacji, która zwraca błąd', async () => {
    readExecutionWork.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) throw new Error('backend nie odpowiada');
      return OK_WORK;
    });
    readOperationalAllocations.mockImplementation(async (caseId: string) => {
      if (caseId === HANGING_CASE) throw new Error('backend nie odpowiada');
      return OK_ALLOCATIONS;
    });

    render(<ExecutionResourcesSurface activePreset="all" />);

    await waitFor(() =>
      expect(
        screen.getByText(/Nie udało się pobrać zasobów z 1 realizacji/)
      ).toBeInTheDocument()
    );
    expect(screen.queryByText(/Nie udało się załadować rejestru zasobów/)).not.toBeInTheDocument();
  });
});
