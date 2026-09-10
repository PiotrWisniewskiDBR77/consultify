/**
 * @vitest-environment jsdom
 *
 * E1b/R1 (2026-09-10) — kebab „Otwórz zadanie" dla wiersza z tabeli zastanej
 * `/api/tasks` (Realizacja → Praca) nie może już nawigować do `/my-work`.
 *
 * POMIAR na kopii `consultify_kopia_e1b` (port API 4221, konto ADMIN
 * `audyt@dbr77.local`, zadanie `t_interview_c724711d-…` przypisane do Anny
 * Kowalskiej — NIE do oglądającego):
 *   · GET /api/my-work/personal-tasks/:id  → 404 {"code":"TASK_NOT_FOUND"}
 *     (server/src/routes/my-work.routes.ts, buildPersonalTaskOwnerScope:
 *     `assignee_id = wołający` — filtr WŁAŚCICIELA, nie organizacji);
 *   · GET /api/tasks/:id (kanoniczne)      → 200, bez filtra właściciela.
 * `openWorkspace()` w `ExecutionWorkSurface.tsx` nawigował
 * `getArtifactPath('task', id)` → `/my-work?artifact=task:<id>` →
 * `TaskDetailView` → `Api.getPersonalTask` → dokładnie ten 404 dla KAŻDEGO
 * zadania nieprzypisanego do oglądającego (a w Praca oglądający to zwykle
 * PM/ADMIN patrzący na cudze zadania — 74/115 wierszy demo ma osobę INNĄ niż
 * oglądający).
 *
 * NAPRAWA: dla wiersza `origin === 'tasks'` „Otwórz zadanie" (i „Otwórz
 * podgląd", i podwójny klik — jeden handler `openWorkspace`) zostaje w
 * module `/execution` i otwiera wbudowany panel podglądu wiersza (czyta/
 * zapisuje przez kanoniczne `GET`/`PUT /api/tasks/:id` — zero filtra
 * właściciela, już zmierzone w P16-R2). Zero nawigacji, zero 404.
 *
 * MUTACJA (do ręcznej weryfikacji regresji): przywrócenie
 * `navigate(getArtifactPath('task', row.id))` w miejscu naprawy → ten test
 * czerwony (navigateSpy wywołany).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_k: string, fallback?: unknown) =>
      typeof fallback === 'string' ? fallback : _k,
    i18n: { language: 'pl' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const { navigateSpy } = vi.hoisted(() => ({ navigateSpy: vi.fn() }));
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

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
    ]),
  },
}));

// Świadomie BEZ `getPersonalTask`/`getTask` w atrapie: gdyby naprawa
// zregresowała i handler znów spróbował otworzyć kartę przez `TaskDetailView`
// (Api.getPersonalTask), test wybuchnie „is not a function", nie cichym 404.
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

import { ExecutionWorkSurface } from '../ExecutionWorkSurface';

const SLOWNIK = {
  statuses: ['todo', 'in_progress', 'done'],
  transitions: { todo: ['in_progress'], in_progress: ['done'], done: [] },
};

const ZADANIE_CUDZE = {
  id: 't_interview_c724711d',
  title: 'Zadanie cudzego wykonawcy',
  status: 'todo',
  assigneeId: 'osoba-1',
  initiativeId: null,
  dueDate: new Date(Date.now() + 86_400_000).toISOString(),
};

beforeEach(() => {
  vi.clearAllMocks();
  getTasks.mockResolvedValue([ZADANIE_CUDZE]);
  getInitiatives.mockResolvedValue([]);
  apiGet.mockResolvedValue({ data: SLOWNIK });
  listExecutionCases.mockResolvedValue({ cases: [] });
  readExecutionWork.mockResolvedValue({ tasks: [], decisions: [] });
});

const zamontuj = () =>
  render(
    <MemoryRouter>
      <ExecutionWorkSurface activePreset="all" />
    </MemoryRouter>
  );

const wiersz = (tytul: string) =>
  Array.from(document.querySelectorAll('table tbody tr')).find((tr) =>
    (tr.textContent || '').includes(tytul)
  ) as HTMLElement;

describe('E1b/R1 — „Otwórz zadanie" (wiersz z /api/tasks) nie ucieka do /my-work', () => {
  it('kebab „Otwórz zadanie" otwiera podgląd w miejscu, bez nawigacji i bez 404', async () => {
    zamontuj();
    await waitFor(() =>
      expect(screen.getByText('Zadanie cudzego wykonawcy')).toBeInTheDocument()
    );

    const wierszCudzy = wiersz('Zadanie cudzego wykonawcy');
    const przyciskKebab = within(wierszCudzy).getByLabelText('Row actions');
    fireEvent.click(przyciskKebab);

    const pozycjaOtworz = await screen.findByRole('menuitem', { name: 'Open task' });
    fireEvent.click(pozycjaOtworz);

    // Panel podglądu wiersza (StandardPreview embedded) pokazuje się W
    // MIEJSCU — treść karty (rekomendacja, właściwości) widoczna bez żadnej
    // nawigacji poza `/execution`, zero 404.
    await waitFor(() =>
      expect(screen.getByText('Check completeness and the next step.')).toBeInTheDocument()
    );
    expect(screen.getByText('Without initiative')).toBeInTheDocument();
    expect(navigateSpy).not.toHaveBeenCalled();
    // Gdyby handler nadal próbował ładować kartę przez `TaskDetailView` →
    // `Api.getPersonalTask`, ta metoda nie istnieje w atrapie i wywołanie
    // rzuciłoby błąd (niezłapany w tym teście) zamiast cichego 404.
  });
});
