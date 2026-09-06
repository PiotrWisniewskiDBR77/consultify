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

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, fallback?: unknown) => (typeof fallback === 'string' ? fallback : k),
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
vi.mock('@/services/api', () => ({ Api: { getTasks } }));

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
    expect(screen.getByText('Poślizg (dni)')).toBeInTheDocument();
  });

  it('kolumna „Poślizg (dni)" liczy dni po terminie dla zadań przeterminowanych', async () => {
    zamontuj();
    await waitFor(() => expect(screen.getByText('Zadanie realne 0')).toBeInTheDocument());
    const wiersz = wierszeTabeli().find((tr) => (tr.textContent || '').includes('Zadanie realne 3'));
    expect(wiersz).toBeTruthy();
    // Zadanie 3 ma termin 5 dni wstecz.
    expect(within(wiersz as HTMLElement).getByText('+5')).toBeInTheDocument();
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
