import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  handlers: {} as Record<string, (event: any) => void>,
  task: {
    id: 'task-k26',
    title: 'Restore supplier feed',
    status: 'todo',
    priority: 'high',
    versionToken: 'v1',
    createdAt: '2026-09-17T00:00:00.000Z',
    updatedAt: '2026-09-17T00:00:00.000Z',
  },
  getPersonalTasks: vi.fn(),
  getTaskWorkflowConfig: vi.fn(),
  updatePersonalTask: vi.fn(),
  translate: (_key: string, fallback?: string, values?: Record<string, unknown>) =>
    String(fallback || _key).replace(/\{\{(\w+)\}\}/g, (_m, name) => String(values?.[name] ?? '')),
}));

vi.mock('@/services/api', () => ({
  Api: {
    getPersonalTasks: harness.getPersonalTasks,
    getTaskWorkflowConfig: harness.getTaskWorkflowConfig,
    updatePersonalTask: harness.updatePersonalTask,
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: harness.translate,
  }),
}));

vi.mock('@/i18n', () => ({
  default: { language: 'en', t: (_key: string, fallback: string) => fallback },
}));

vi.mock('@/components/standard', () => ({
  StandardKanbanCard: ({ card }: { card: { id: string; title: string } }) => (
    <div data-testid={`standard-kanban-card-${card.id}`}>{card.title}</div>
  ),
}));

vi.mock('@dnd-kit/core', () => ({
  closestCenter: vi.fn(),
  defaultDropAnimationSideEffects: () => vi.fn(),
  DndContext: (props: any) => {
    harness.handlers.start = props.onDragStart;
    harness.handlers.over = props.onDragOver;
    harness.handlers.end = props.onDragEnd;
    return <>{props.children}</>;
  },
  DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  KeyboardSensor: function KeyboardSensor() {},
  MeasuringStrategy: { Always: 'always' },
  PointerSensor: function PointerSensor() {},
  pointerWithin: () => [],
  rectIntersection: () => [],
  useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  useSensor: () => ({}),
  useSensors: () => [],
}));

vi.mock('@dnd-kit/sortable', () => ({
  arrayMove: (items: string[]) => items,
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
  }),
  verticalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/utilities', () => ({ CSS: { Transform: { toString: () => undefined } } }));

import {
  isKanbanTransitionAllowed,
  normalizeKanbanWorkflowStatus,
  TasksKanbanBoard,
} from '../TasksKanbanBoard';

const props = {
  activeFilter: 'all' as const,
  searchQuery: '',
  onTaskClick: vi.fn(),
  onCreateTask: vi.fn(),
  onCountsChange: vi.fn(),
};

async function dragTaskToBlocked() {
  await screen.findByTestId('standard-kanban-card-task-k26');
  act(() => harness.handlers.start({ active: { id: 'task-k26' } }));
  act(() =>
    harness.handlers.over({
      active: { id: 'task-k26', rect: { current: { translated: { top: 0 } } } },
      over: { id: 'blocked', rect: { top: 0, height: 100 } },
    })
  );
  await waitFor(() => expect(harness.handlers.end).toBeTypeOf('function'));
  await act(async () => {
    await harness.handlers.end({ active: { id: 'task-k26' }, over: { id: 'blocked' } });
  });
}

describe('TasksKanbanBoard — K-26 governed transitions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.getPersonalTasks.mockResolvedValue([{ ...harness.task }]);
    harness.getTaskWorkflowConfig.mockResolvedValue({
      statuses: ['todo', 'in_progress', 'blocked', 'done'],
      transitions: { todo: ['in_progress', 'blocked'], in_progress: ['blocked', 'done'] },
    });
    harness.updatePersonalTask.mockImplementation(async (_id: string, patch: any) => ({
      ...harness.task,
      ...patch,
      versionToken: 'v2',
    }));
  });

  it('normalizes only documented aliases and uses the server transition graph', () => {
    expect(normalizeKanbanWorkflowStatus('in_review')).toBe('review');
    expect(normalizeKanbanWorkflowStatus('validated')).toBe('done');
    expect(isKanbanTransitionAllowed('todo', 'blocked', { todo: ['in_progress', 'blocked'] })).toBe(
      true
    );
    expect(isKanbanTransitionAllowed('done', 'blocked', { done: ['todo'] })).toBe(false);
    expect(isKanbanTransitionAllowed('todo', 'blocked', null)).toBe(false);
  });

  it('asks for a reason before blocking and sends the trimmed reason with the CAS token', async () => {
    render(<TasksKanbanBoard {...props} />);
    await waitFor(() => expect(harness.getTaskWorkflowConfig).toHaveBeenCalledTimes(1));

    await dragTaskToBlocked();

    expect(await screen.findByRole('dialog', { name: 'Why is this task blocked?' })).toBeVisible();
    expect(harness.updatePersonalTask).not.toHaveBeenCalled();
    const confirm = screen.getByRole('button', { name: 'Block task' });
    expect(confirm).toBeDisabled();

    fireEvent.change(screen.getByTestId('kanban-block-reason-input'), {
      target: { value: '  Waiting for vendor approval  ' },
    });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(harness.updatePersonalTask).toHaveBeenCalledWith('task-k26', {
        status: 'blocked',
        blockedReason: 'Waiting for vendor approval',
        expectedVersionToken: 'v1',
      })
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Why is this task blocked?' })).toBeNull()
    );
  });

  it('cancelling the reason dialog does not write a status', async () => {
    render(<TasksKanbanBoard {...props} />);
    await waitFor(() => expect(harness.getTaskWorkflowConfig).toHaveBeenCalledTimes(1));
    await dragTaskToBlocked();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(harness.updatePersonalTask).not.toHaveBeenCalled();
  });

  it('fails closed when workflow configuration cannot be loaded', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    harness.getTaskWorkflowConfig.mockRejectedValueOnce(new Error('offline'));
    render(<TasksKanbanBoard {...props} />);
    await waitFor(() => expect(harness.getTaskWorkflowConfig).toHaveBeenCalledTimes(1));

    await dragTaskToBlocked();

    expect(harness.updatePersonalTask).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    consoleError.mockRestore();
  });

  it('rejects a drop absent from the server transition graph without calling the API', async () => {
    harness.getTaskWorkflowConfig.mockResolvedValueOnce({
      statuses: ['todo', 'in_progress', 'blocked'],
      transitions: { todo: ['in_progress'] },
    });
    render(<TasksKanbanBoard {...props} />);
    await waitFor(() => expect(harness.getTaskWorkflowConfig).toHaveBeenCalledTimes(1));

    await dragTaskToBlocked();

    expect(harness.updatePersonalTask).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the reason dialog open with an error when the governed write fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    harness.updatePersonalTask.mockRejectedValueOnce({ status: 409 });
    render(<TasksKanbanBoard {...props} />);
    await waitFor(() => expect(harness.getTaskWorkflowConfig).toHaveBeenCalledTimes(1));
    await dragTaskToBlocked();

    fireEvent.change(screen.getByTestId('kanban-block-reason-input'), {
      target: { value: 'Waiting for vendor approval' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Block task' }));

    expect(
      await screen.findByText(
        'The task was not blocked. Review the reason or refresh the board and try again.'
      )
    ).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Why is this task blocked?' })).toBeVisible();
    consoleError.mockRestore();
  });
});
