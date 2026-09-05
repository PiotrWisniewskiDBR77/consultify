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

    await waitFor(() => {
      const last = onCountsChange.mock.calls.at(-1)?.[0] as Record<string, number> | undefined;
      expect(last?.all).toBe(1);
    });
    const last = onCountsChange.mock.calls.at(-1)?.[0] as Record<string, number>;
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

/**
 * Etykiety zmierzone na zrzucie PO (05.09) — trzy rzeczy, które właściciel
 * zobaczyłby od razu po naprawie ładowania:
 *  · surowy `IN_PROGRESS` obok polskich statusów w tej samej tabeli,
 *  · angielskie „UNKNOWN" w każdym wierszu kolumny „Termin / SLA",
 *  · UUID przerobiony na coś, co WYGLĄDA jak imię i nazwisko.
 *
 * DOWÓD MUTACYJNY (wykonany 2026-09-05): przywrócenie `IN_PROGRESS` poza mapą
 * etykiet, `return 'UNKNOWN'` w `formatDateTime` i zamiany UUID-a na Title Case
 * → każdy z trzech testów pada osobno.
 */
describe('Praca — etykiety realnych danych', () => {
  const REAL_ROW = {
    tasks: [
      {
        taskId: 'task-real',
        title: 'Wdrożenie i pomiar efektu pierwszego etapu',
        status: 'IN_PROGRESS',
        assigneeId: 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2',
        dueAt: '2026-09-17T06:01:00.000Z',
        slaAt: null,
        version: 1,
        evidenceRefs: [],
      },
    ],
    decisions: [],
  };

  beforeEach(() => {
    listExecutionCases.mockResolvedValue({
      cases: [{ executionCaseId: 'case-ok', initiativeId: 'init-ok' }],
    });
    readExecutionWork.mockResolvedValue(REAL_ROW);
  });

  it('tłumaczy IN_PROGRESS zamiast pokazywać surowy status', async () => {
    render(<ExecutionWorkSurface activePreset="all" />);
    await waitFor(() => expect(screen.getByText('W toku')).toBeInTheDocument());
    expect(screen.queryByText('IN_PROGRESS')).not.toBeInTheDocument();
  });

  it('nie pisze angielskiego UNKNOWN w kolumnie Termin / SLA', async () => {
    render(<ExecutionWorkSurface activePreset="all" />);
    await waitFor(() => expect(screen.getByText('W toku')).toBeInTheDocument());
    expect(document.body.textContent).not.toContain('UNKNOWN');
    expect(document.body.textContent).toContain('SLA brak');
  });

  it('nie robi z UUID-a imienia i nazwiska', async () => {
    render(<ExecutionWorkSurface activePreset="all" />);
    await waitFor(() => expect(screen.getByText('W toku')).toBeInTheDocument());
    expect(
      screen.getByText('d2b6a316-08c5-47cf-9bf7-4ba50311d5a2')
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('D2b6a316 08c5');
  });
});
