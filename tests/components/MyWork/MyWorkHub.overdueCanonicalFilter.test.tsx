/**
 * @vitest-environment jsdom
 *
 * FEEDBACK-1/1g: the production hub used to show the Overdue count while its
 * table still rendered all 57 rows. This mounts the real MyWorkHub and its
 * real task renderers. The Menu 3 pill must narrow the list, and switching to
 * Kanban must preserve exactly the same two-task selection.
 */
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

import { installFetchStub, renderHub } from '../smoke/hubSmokeHarness';

const day = (offset: number): string => {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + offset);
  return value.toISOString();
};

const buildHubTasks = () =>
  Array.from({ length: 57 }, (_, index) => ({
    id: `hub-task-${index + 1}`,
    title: `Hub task ${index + 1}`,
    description: `Task fixture ${index + 1}`,
    status: 'todo',
    priority: 'medium',
    dueDate: index < 2 ? day(-(index + 1)) : index === 2 ? day(0) : day(30 + index),
    createdAt: day(-60),
    updatedAt: day(-1),
    taskType: 'personal',
    versionToken: `v-${index + 1}`,
  }));

beforeEach(() => {
  installFetchStub();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('MyWorkHub — canonical Overdue filter', () => {
  it('narrows 57 real hub rows to two and keeps them in Table, Kanban, and Calendar', async () => {
    const tasks = buildHubTasks();
    vi.spyOn(Api, 'getPersonalTasks').mockResolvedValue(tasks as any);
    vi.spyOn(Api, 'get').mockImplementation(async (path: string) => {
      if (path.startsWith('/my-work/calendar?')) return { tasks } as any;
      if (path === '/my-work/focus/state') return { data: { items: [] } } as any;
      return {} as any;
    });
    const { MyWorkHub } = await import('@/components/MyWork/MyWorkHub');

    renderHub(<MyWorkHub />, '/my-work?tab=tasks');

    await waitFor(() => expect(screen.getByText('Hub task 57')).toBeInTheDocument());
    expect(screen.getAllByText(/^Hub task \d+$/)).toHaveLength(57);

    fireEvent.click(screen.getByTitle('Overdue'));

    await waitFor(() => expect(screen.getAllByText(/^Hub task \d+$/)).toHaveLength(2));
    expect(screen.getByText('Hub task 1')).toBeInTheDocument();
    expect(screen.getByText('Hub task 2')).toBeInTheDocument();
    expect(screen.queryByText('Hub task 3')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mywork-tasks-view-kanban'));

    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid^="standard-kanban-card-"]')).toHaveLength(2);
    });
    expect(screen.getByText('Hub task 1')).toBeInTheDocument();
    expect(screen.getByText('Hub task 2')).toBeInTheDocument();
    expect(screen.queryByText('Hub task 57')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('mywork-tasks-view-calendar'));

    await waitFor(() => expect(screen.getByText('Hub task 1')).toBeInTheDocument());
    expect(screen.getByText('Hub task 2')).toBeInTheDocument();
    expect(screen.queryByText('Hub task 57')).not.toBeInTheDocument();
  });
});
