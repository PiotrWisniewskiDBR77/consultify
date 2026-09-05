/**
 * Odbiór na żywo 05.09 (`evidence/odbior-zywo-20260905/16-kanon/wyniki.json`,
 * id `standard-kanban-card`, ROZNI_SIE): realna karta kanban w Zadaniach
 * (/my-work → Kanban) była bespoke — NIE renderowała się przez
 * `StandardKanbanCard` (#75b, JEDYNY dozwolony renderer, kanon A9). Skutki:
 * priorytet wychodził jako „tekst z kropką" zamiast cichej pigułki, a nazwy
 * kolumn zostawały po angielsku (To Do/In Progress/Blocked/Done) w polskim
 * interfejsie.
 *
 * Ten test renderuje `TasksKanbanBoard` z PRAWDZIWYM i18n (zasoby `pl`) i
 * dowodzi mutacyjnie: (1) każda karta ma `data-testid="standard-kanban-card-…"`
 * — ten testid istnieje WYŁĄCZNIE w `StandardKanbanCard`, więc jego obecność
 * jest niepodważalnym dowodem, że karta idzie przez kanoniczny renderer, nie
 * przez bespoke JSX; (2) nagłówki kolumn są po polsku; (3) priorytet renderuje
 * się jako cicha pigułka (`MetaChip`) z polską etykietą, nie jako goły tekst.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import i18next, { type i18n } from 'i18next';
import React from 'react';
import { I18nextProvider, initReactI18next } from 'react-i18next';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import plTranslation from '../../../../public/locales/pl/translation.json';

vi.unmock('react-i18next');

const { apiMock } = vi.hoisted(() => {
  const task = {
    id: 'task-1',
    projectId: 'proj-1',
    projectName: 'Digital Sales',
    organizationId: 'org-1',
    title: 'Wdrożenie CRM dla zespołu sprzedaży',
    description: 'Migracja z arkuszy do jednego źródła prawdy.',
    status: 'todo',
    priority: 'high',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    taskType: 'general',
  };
  return {
    apiMock: {
      getPersonalTasks: vi.fn(async () => [task]),
      updatePersonalTask: vi.fn(async (_id: string, patch: Record<string, unknown>) => ({
        ...task,
        ...patch,
      })),
    },
  };
});

vi.mock('@/services/api', () => ({ Api: apiMock }));

// dnd-kit's real DnD wiring needs layout/pointer APIs jsdom doesn't provide;
// this test only exercises the rendered card/column chrome, so the sortable
// context is mocked to a plain pass-through (no drag behavior asserted here).
vi.mock('@dnd-kit/sortable', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/sortable')>('@dnd-kit/sortable');
  return {
    ...actual,
    useSortable: () => ({
      attributes: {},
      listeners: {},
      setNodeRef: () => {},
      transform: null,
      transition: undefined,
      isDragging: false,
    }),
  };
});

import { TasksKanbanBoard } from '../TasksKanbanBoard';

describe('TasksKanbanBoard renders through the canonical StandardKanbanCard (kanon A9)', () => {
  let testI18n: i18n;

  beforeAll(async () => {
    testI18n = i18next.createInstance();
    await testI18n.use(initReactI18next).init({
      lng: 'pl',
      fallbackLng: false,
      resources: { pl: { translation: plTranslation } },
      interpolation: { escapeValue: false },
    });
  });

  it('uses the StandardKanbanCard renderer, Polish column labels, and a quiet priority chip', async () => {
    render(
      <I18nextProvider i18n={testI18n}>
        <TasksKanbanBoard
          activeFilter="all"
          searchQuery=""
          onTaskClick={() => {}}
          onCreateTask={() => {}}
          onCountsChange={() => {}}
        />
      </I18nextProvider>
    );

    // Proof #1 — the card comes from the canonical renderer, not a bespoke
    // component: this testid is only emitted by StandardKanbanCard.
    const card = await screen.findByTestId('standard-kanban-card-task-1');

    // Proof #2 — column headers are Polish (execution/kanban parity), not
    // the English "To Do / In Progress / Blocked / Done" the bespoke board
    // hard-coded.
    expect(screen.getByText('Do zrobienia')).toBeInTheDocument();
    expect(screen.getByText('W trakcie')).toBeInTheDocument();
    expect(screen.getByText('Zablokowane')).toBeInTheDocument();
    expect(screen.getByText('Ukończone')).toBeInTheDocument();
    expect(screen.queryByText('To Do')).not.toBeInTheDocument();
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();

    // Proof #3 — priority is a quiet chip with a Polish label ("Wysoki" for
    // 'high'), matching kanon A9 ("ciche chipy priorytet+typ"), not the old
    // literal-English "High" text-plus-dot.
    expect(within(card).getByText('Wysoki')).toBeInTheDocument();
    expect(within(card).queryByText('High')).not.toBeInTheDocument();

    await waitFor(() => expect(apiMock.getPersonalTasks).toHaveBeenCalled());
  });
});
