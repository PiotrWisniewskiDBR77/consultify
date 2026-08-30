import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { api, toastError } = vi.hoisted(() => ({
  api: {
    getTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    put: vi.fn(),
    get: vi.fn(),
  },
  toastError: vi.fn(),
}));

vi.mock('react-hot-toast', () => ({ default: { error: toastError, success: vi.fn() } }));
vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({ t: (key: string, fallback?: string) => fallback || key }),
}));
vi.mock('@/services/api', () => ({ Api: api }));
vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ currentUser: { id: 'user-1' }, currentProjectId: 'project-1' }),
}));
vi.mock('@/components/TaskDetailModal', () => ({
  TaskDetailModal: ({ isOpen, onSave }: { isOpen: boolean; onSave: (task: any) => void }) =>
    isOpen
      ? React.createElement(
          'button',
          {
            onClick: () =>
              onSave({ id: 'task-1', title: 'Task', status: 'todo', priority: 'medium' }),
          },
          'Save mocked task'
        )
      : null,
}));
vi.mock('@/components/MyWork/DecisionDetailModal', () => ({ DecisionDetailModal: () => null }));

import { InitiativeTasksTab } from '@/components/InitiativeTasksTab';
import { InitiativeCalendar } from '@/components/Initiatives/calendar/InitiativeCalendar';
import { InitiativeSidePanel } from '@/components/Portfolio/InitiativeSidePanel';
import { UserTaskList } from '@/components/dashboard/UserTaskList';
import type { ScheduleItem } from '@/types/initiativeSchedule';

const task = { id: 'task-1', title: 'Task', status: 'todo', priority: 'medium', taskType: 'task' };

class FakeDataTransfer {
  private store = new Map<string, string>();
  setData(type: string, value: string) {
    this.store.set(type, value);
  }
  getData(type: string) {
    return this.store.get(type) || '';
  }
}
class FakeDragEvent extends Event {
  dataTransfer: FakeDataTransfer;
  constructor(type: string, dataTransfer: FakeDataTransfer) {
    super(type, { bubbles: true, cancelable: true });
    this.dataTransfer = dataTransfer;
  }
}

describe('day173 visible task mutation failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.getTasks.mockResolvedValue([task]);
    api.get.mockResolvedValue({});
    api.createTask.mockRejectedValue(
      Object.assign(new Error('canonical writer required'), { status: 409 })
    );
    api.updateTask.mockRejectedValue(
      Object.assign(new Error('canonical writer required'), { status: 409 })
    );
    api.put.mockRejectedValue(
      Object.assign(new Error('canonical writer required'), { status: 409 })
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('shows an error when InitiativeTasksTab create receives 409', async () => {
    render(React.createElement(InitiativeTasksTab, { initiativeId: 'initiative-1' }));
    fireEvent.click(await screen.findByText('Add Task'));
    fireEvent.click(await screen.findByText('Save mocked task'));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to create task'));
  });

  it('shows an error when UserTaskList create receives 409', async () => {
    render(React.createElement(UserTaskList, { onNavigate: vi.fn() }));
    fireEvent.click(await screen.findByText('Add Task'));
    fireEvent.click(await screen.findByText('Save mocked task'));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Failed to save task'));
  });

  it('shows a translated error when InitiativeSidePanel update receives 409', async () => {
    render(
      React.createElement(InitiativeSidePanel, {
        initiative: {
          id: 'initiative-1',
          name: 'Initiative',
          axis: 'processes',
          status: 'planning',
          priority: 'medium',
          progress: 0,
          budget: 0,
          spent: 0,
        },
        isOpen: true,
        onClose: vi.fn(),
        onUpdate: vi.fn(),
      })
    );
    fireEvent.click(await screen.findByText('Tasks'));
    fireEvent.click(await screen.findByText('Task'));
    fireEvent.click(await screen.findByText('Save mocked task'));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith('Nie udało się zapisać zadania'));
  });

  it('shows a translated error when InitiativeCalendar reschedule receives 409', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T12:00:00.000Z'));
    const item: ScheduleItem = {
      id: 'task:1',
      type: 'task',
      title: 'Calendar task',
      start: '2026-06-15',
      end: '2026-06-17',
      sourceId: '1',
      sourceKind: 'task',
    };
    render(React.createElement(InitiativeCalendar, { items: [item], onReschedule: vi.fn() }));
    const chip = document.querySelector('[title^="Calendar task"]') as HTMLElement;
    const target = Array.from(document.querySelectorAll('[data-day]')).find(
      (node) => node.getAttribute('data-day') !== '2026-06-15'
    ) as HTMLElement;
    const transfer = new FakeDataTransfer();
    await act(async () => {
      chip.dispatchEvent(new FakeDragEvent('dragstart', transfer));
      target.dispatchEvent(new FakeDragEvent('drop', transfer));
      await Promise.resolve();
    });
    expect(toastError).toHaveBeenCalledWith('Nie udało się zapisać terminu');
    vi.useRealTimers();
  });
});
