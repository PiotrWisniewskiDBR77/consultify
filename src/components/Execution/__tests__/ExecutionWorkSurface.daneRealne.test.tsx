/**
 * @vitest-environment jsdom
 *
 * 1.12-R1 (B) — zakładka „Praca" czyta REALNE ZADANIA ORGANIZACJI.
 *
 * POMIAR 06.09 (org DBR77, API 127.0.0.1:4100):
 *   · `runtime-v1/execution-cases` → 0 realizacji, więc `…/work` → 0 zadań,
 *   · `/api/tasks`                 → 84 zadania (82 z terminem, 64 z inicjatywą).
 * Zakładka czytała wyłącznie pierwsze źródło i była pusta przy 84 rekordach obok.
 *
 * MUTACJE, na które ten plik reaguje (dowód wykonany, patrz meldunek):
 *   (1) przywrócenie źródła wyłącznie z `runtime-v1` (usunięcie `Api.getTasks`
 *       z `loadCases`) → „tabela ma tyle wierszy, ile zwróciło API" pada,
 *   (2) przywrócenie kolumny „Termin / SLA" → test o pustym SLA pada.
 *
 * Test montuje powierzchnię w `MemoryRouter` — inaczej `useLocation` w
 * `TableWithPreviewLayout` wywraca render (to jest przyczyna zastanych
 * czerwonych w `ExecutionSurfaces.hangingCase` / `.ownerNames`, których ten
 * plik świadomie NIE dziedziczy).
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import plTranslation from '../../../../public/locales/pl/translation.json';

// Rozwiązuje klucz i18n z PRAWDZIWEGO katalogu pl, tak jak zrobiłby to realny
// react-i18next z i18n.language = 'pl' — literał-fallback z wywołania t(key,
// fallback) w kodzie jest po angielsku (patrz ExecutionWorkSurface.tsx),
// więc naiwny mock „t: (k, fallback) => fallback" renderował angielski
// tekst nagłówka i test szukający polskiego „Dni po terminie" nigdy nie
// mógł przejść, mimo że realny użytkownik zawsze widzi tłumaczenie z
// katalogu (klucz w pl istnieje).
const resolvePlKey = (key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      plTranslation as unknown
    );
  return typeof value === 'string' ? value : undefined;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => {
      const resolved = resolvePlKey(k);
      if (resolved !== undefined) return resolved;
      return typeof fallback === 'string' ? fallback : k;
    },
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (store: unknown) => unknown) =>
    selector({ currentUser: { id: 'user-1' }, currentOrganization: { id: 'org-1' } }),
}));

vi.mock('@/services/api/organizations.api', () => ({
  OrganizationApi: { getOrganizationMembers: vi.fn().mockResolvedValue([]) },
}));

const { getTasks } = vi.hoisted(() => ({ getTasks: vi.fn() }));
vi.mock('@/services/api', () => ({
  Api: {
    getTasks,
    getInitiatives: vi.fn().mockResolvedValue([]),
    // P16-R2: powierzchnia czyta słownik statusów zadania z serwera
    // (`GET /api/tasks/workflow-config`) — bez tej atrapy `Api.get` nie
    // istnieje i efekt wywraca render zanim tabela zdąży się pojawić.
    get: vi.fn().mockResolvedValue({ data: { statuses: [], transitions: {} } }),
    updateTask: vi.fn(),
    post: vi.fn(),
  },
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

import { ExecutionWorkSurface } from '../ExecutionWorkSurface';

const dzien = (przesuniecie: number) =>
  new Date(Date.now() + przesuniecie * 86_400_000).toISOString();

const NORTHWIND_PROJECT = 'Operational Excellence Programme';
const NORTHWIND_TASK_TITLE = 'Agree the shuttle safety case with the works council';
const NORTHWIND_TASK_DESCRIPTION =
  'The council asked for a written position on manual intervention inside the shuttle aisle.';
const NORTHWIND_RUNTIME_TITLE = 'Runtime task without an assignee';

/** 24 zadania — tyle, żeby „ile zwróciło API, tyle jest wierszy" było twierdzeniem, nie zbiegiem. */
const ZADANIA = Array.from({ length: 24 }, (_, i) => ({
  id: `task-${i}`,
  title: `Zadanie realne ${i}`,
  status: i % 4 === 0 ? 'BLOCKED' : 'IN_PROGRESS',
  assigneeId: `osoba-${i % 3}`,
  initiativeId: `init-${i % 5}`,
  initiativeName: `Inicjatywa ${i % 5}`,
  // Co trzecie po terminie: 8 z 24.
  dueDate: i % 3 === 0 ? dzien(-(i + 2)) : dzien(30),
}));

beforeEach(() => {
  vi.clearAllMocks();
  getTasks.mockResolvedValue(ZADANIA);
  // Rzeczywistość DBR77: zero realizacji w kanonicznym rejestrze.
  listExecutionCases.mockResolvedValue({ cases: [] });
  readExecutionWork.mockResolvedValue({ tasks: [], decisions: [] });
});

const zamontuj = (preset = 'all', onCountsChange?: (c: Record<string, number>) => void) =>
  render(
    <MemoryRouter>
      <ExecutionWorkSurface activePreset={preset} onCountsChange={onCountsChange} />
    </MemoryRouter>
  );

const wierszeTabeli = () => {
  const tabela = document.querySelector('table');
  if (!tabela) return [];
  return Array.from(tabela.querySelectorAll('tbody tr')).filter((tr) =>
    (tr.textContent || '').includes('Zadanie realne')
  );
};

describe('1.12-R1 (B) — źródło danych zakładki Praca', () => {
  it('tabela ma tyle wierszy, ile zadań zwróciło /api/tasks (24), mimo 0 realizacji runtime', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie realne 0')).toBeInTheDocument());
    expect(getTasks).toHaveBeenCalled();
    expect(wierszeTabeli()).toHaveLength(24);
  });

  it('pokazuje nazwę inicjatywy w osobnej kolumnie', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie realne 1')).toBeInTheDocument());
    expect(screen.getAllByText('Inicjatywa 1').length).toBeGreaterThan(0);
  });

  it('NIE ma kolumny „Termin / SLA" ani napisu „SLA" w wierszach', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie realne 0')).toBeInTheDocument());
    expect(screen.queryByText('Termin / SLA')).toBeNull();
    expect(screen.queryByText('Due / SLA')).toBeNull();
    expect(document.body.textContent).not.toContain('SLA brak');
    // P16-R2: kolumna nazwana uczciwie — liczy „dziś − termin", nie odchylenie
    // od planu bazowego. Poślizg wobec baseline wraca z R3 (metodyka).
    expect(screen.getByText('Dni po terminie')).toBeInTheDocument();
    expect(screen.queryByText('Poślizg (dni)')).toBeNull();
  });

  it('kolumna „Dni po terminie" liczy dni po terminie dla zadań przeterminowanych', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie realne 0')).toBeInTheDocument());
    const wiersz = wierszeTabeli().find((tr) => (tr.textContent || '').includes('Zadanie realne 3'));
    expect(wiersz).toBeTruthy();
    // Zadanie 3 ma termin 5 dni wstecz.
    expect(within(wiersz as HTMLElement).getByText('+5')).toBeInTheDocument();
  });

  it('nie wywraca zakładki Praca dla zadania Northwind z pustym właścicielem i pustym źródłem', async () => {
    listExecutionCases.mockResolvedValue({
      cases: [
        {
          executionCaseId: 'northwind-case',
          initiativeId: 'northwind-init',
          initiativeTitle: 'Northwind readiness',
        },
      ],
    });
    readExecutionWork.mockResolvedValue({
      tasks: [
        {
          taskId: 'northwind-runtime-task',
          title: NORTHWIND_RUNTIME_TITLE,
          status: 'OPEN',
          assigneeId: null,
          dueAt: '2026-08-15T10:00:00.000Z',
          version: 1,
          evidenceRefs: [],
        },
      ],
      decisions: [],
    });
    getTasks.mockResolvedValue([
      {
        id: 'f9c386c1-8b09-5276-a5a0-4452f1e283b8',
        projectId: '6174636d-c4f2-552d-9a5a-d2695738f9bc',
        projectName: NORTHWIND_PROJECT,
        organizationId: '468b234c-66c4-54e1-b626-5e0fb3a92f6a',
        title: NORTHWIND_TASK_TITLE,
        source: 'manual',
        sourceType: null,
        sourceId: null,
        description: NORTHWIND_TASK_DESCRIPTION,
        status: 'blocked',
        priority: 'critical',
        assigneeId: null,
        backupAssigneeId: null,
        assignee: null,
        reporterId: '08c54d75-5260-57b1-9db6-a30aed89a587',
        reporter: {
          id: '08c54d75-5260-57b1-9db6-a30aed89a587',
          firstName: 'James',
          lastName: 'Whitfield',
          avatarUrl: null,
        },
        dueDate: '2026-08-14T17:00:00.000Z',
        startedAt: null,
        estimatedHours: 36,
        checklist: [],
        attachments: [],
        tags: [],
        customStatusId: null,
        createdAt: '2026-08-03T08:00:00.000Z',
        updatedAt: '2026-09-11T19:09:55.694Z',
        completedAt: null,
        taskType: 'execution',
        budgetAllocated: 0,
        budgetSpent: 0,
        riskRating: 'high',
        acceptanceCriteria: 'Safety case signed by the works council chair.',
        blockingIssues: '',
        stepPhase: 'design',
        why: '',
        ownerId: null,
      },
    ]);

    zamontuj();

    await waitFor(() => expect(screen.getByText(NORTHWIND_TASK_TITLE)).toBeInTheDocument());
    expect(screen.getByText(NORTHWIND_RUNTIME_TITLE)).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('RouteErrorBoundary');
    expect(document.body.textContent).not.toContain('Cannot read properties of null');
  });

  it('preset „Po terminie" zawęża tabelę do 8 zadań, a nie do wszystkich', async () => {
    zamontuj('overdue');
    await waitFor(() => expect(screen.getByText('Zadanie realne 0')).toBeInTheDocument());
    expect(wierszeTabeli()).toHaveLength(8);
  });

  it('preset „Zablokowane" zawęża do zadań ze statusem BLOCKED (6)', async () => {
    zamontuj('blocked');
    await waitFor(() => expect(screen.getByText('Zadanie realne 0')).toBeInTheDocument());
    expect(wierszeTabeli()).toHaveLength(6);
  });

  it('liczniki Menu 3 dostają TRZY presety z realnymi liczbami', async () => {
    const onCountsChange = vi.fn();
    zamontuj('all', onCountsChange);
    await waitFor(() => expect(screen.getByText('Zadanie realne 0')).toBeInTheDocument());
    await waitFor(() =>
      expect((onCountsChange.mock.calls.at(-1)?.[0] as Record<string, number>)?.all).toBe(24)
    );
    const ostatnie = onCountsChange.mock.calls.at(-1)?.[0] as Record<string, number>;
    expect(Object.keys(ostatnie).sort()).toEqual(['all', 'blocked', 'overdue']);
    expect(ostatnie.all).toBe(24);
    expect(ostatnie.overdue).toBe(8);
    expect(ostatnie.blocked).toBe(6);
  });

  it('gdy runtime-v1 padnie, realne zadania ZOSTAJĄ na ekranie (nie ekran błędu)', async () => {
    listExecutionCases.mockRejectedValue(new Error('runtime niedostępny'));
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie realne 0')).toBeInTheDocument());
    expect(wierszeTabeli()).toHaveLength(24);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
