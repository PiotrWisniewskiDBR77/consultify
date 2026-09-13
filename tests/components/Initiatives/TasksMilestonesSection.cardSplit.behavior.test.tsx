/** @vitest-environment jsdom */
import React, { useEffect, useMemo, useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import toast from 'react-hot-toast';

import { INITIATIVE_CARD_KEYS } from '@/contracts/initiatives-execution/cardRegistry';
import { DEFINITION_CONTENT_CARD_KEYS } from '@/components/Initiatives/DefinitionCardContent';
import { canonicalInitiativeSections } from '@/components/Initiatives/canonicalInitiativeSections';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: any) => <>{children}</>,
  motion: new Proxy({}, { get: (_target, tag: string) => (props: any) => React.createElement(tag, props) }),
}));
vi.mock('react-hot-toast', () => ({ default: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/components/shared/NModeBlocks', () => ({
  Callout: ({ children }: any) => <div>{children}</div>,
  EmptyStateInline: ({ message }: any) => <div>{message}</div>,
}));

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPut = vi.fn();
const apiDelete = vi.fn();
vi.mock('@/services/api', () => ({
  Api: {
    get: (...args: any[]) => apiGet(...args),
    post: (...args: any[]) => apiPost(...args),
    put: (...args: any[]) => apiPut(...args),
    delete: (...args: any[]) => apiDelete(...args),
  },
}));

const context: any = {
  tasks: [{ id: 'task-1', title: 'Task record one', status: 'todo', priority: 'medium', source: 'manual' }],
  setTasks: vi.fn(),
  tasksDone: 0,
  isPolish: false,
  onOpenTask: vi.fn(),
  users: [],
  initiative: { id: 'init-1', name: 'Split initiative', status: 'PLANNING' },
  showCreateTask: false,
  setShowCreateTask: vi.fn(),
  tasksAiRequest: null,
  clearTasksAiRequest: vi.fn(),
};
vi.mock('@/components/Initiatives/sections/InitiativeContext', () => ({
  useInitiativeContext: () => context,
}));

import { TasksMilestonesSection } from '@/components/Initiatives/sections/TasksMilestonesSection';

const sectionProps = { sectionType: {} as any, expanded: true, onToggle: vi.fn(), readonly: false };

describe('native Tasks / Milestones card split', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    context.showCreateTask = false;
    context.tasksAiRequest = null;
    window.history.replaceState(null, '', '/initiatives?mode=doc&open=init-1&card=tasks');
    apiGet.mockResolvedValue({
      milestones: [{ id: 'ms-1', name: 'Milestone record one', targetDate: '2026-10-01', status: 'PENDING' }],
    });
  });

  it('renders only the milestone owner in milestones mode', async () => {
    context.showCreateTask = true;
    context.tasksAiRequest = { nonce: 1, mode: 'addOne' };
    render(<TasksMilestonesSection {...sectionProps} presentation="milestones" />);
    expect(await screen.findByText('Milestone record one')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Milestones' })).toBeVisible();
    expect(screen.queryByText('Task record one')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Tasks' })).not.toBeInTheDocument();
    expect(screen.queryByText('Add task')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Filter tasks by status')).not.toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith('/initiatives/init-1/milestones');
    expect(context.setShowCreateTask).not.toHaveBeenCalled();
    expect(context.clearTasksAiRequest).not.toHaveBeenCalled();
    expect(apiPost).not.toHaveBeenCalled();
    expect(apiPut).not.toHaveBeenCalled();
    expect(apiDelete).not.toHaveBeenCalled();
  });

  it('renders task actions only and does not start the milestone reader in tasks mode', async () => {
    render(<TasksMilestonesSection {...sectionProps} presentation="tasks" />);
    expect(screen.getByText('Task record one')).toBeVisible();
    expect(screen.getByText('initiatives.tasksMilestonesSection.addTask')).toBeVisible();
    expect(screen.queryByText('Add milestone')).not.toBeInTheDocument();
    expect(screen.queryByText('Milestone record one')).not.toBeInTheDocument();
    await waitFor(() => expect(apiGet).not.toHaveBeenCalled());
  });

  it('keeps combined as the legacy default presentation', async () => {
    render(<TasksMilestonesSection {...sectionProps} />);
    expect(screen.getByText('Task record one')).toBeVisible();
    expect(await screen.findByText('Milestone record one')).toBeVisible();
    expect(screen.getByText('initiatives.tasksMilestonesSection.addTask')).toBeVisible();
    expect(screen.getByText('Add milestone')).toBeVisible();
  });

  it('switches canonical adapter projections, updates URL identity, and performs no writes', async () => {
    function Workspace() {
      const native = useMemo(() => [
        { id: 'tasks', icon: (() => null) as any, label: { en: 'Tasks', pl: 'Zadania' }, component: <TasksMilestonesSection {...sectionProps} presentation="tasks" /> },
        { id: 'milestones', icon: (() => null) as any, label: { en: 'Milestones', pl: 'Kamienie milowe' }, component: <TasksMilestonesSection {...sectionProps} presentation="milestones" /> },
      ], []);
      const cards = useMemo(() => canonicalInitiativeSections(native, () => null, (_key, fallback) => fallback), [native]);
      const [card, setCard] = useState('tasks');
      useEffect(() => {
        const search = `?mode=doc&open=init-1&card=${card}`;
        window.history.replaceState(null, '', `/initiatives${search}`);
        Object.assign(window.location, { href: `http://localhost:3000/initiatives${search}`, search });
      }, [card]);
      return <><button onClick={() => setCard('tasks')}>Tasks card</button><button onClick={() => setCard('milestones')}>Milestones card</button>{cards.find(item => item.id === card)?.component}</>;
    }

    const user = userEvent.setup();
    render(<Workspace />);
    expect(screen.getByText('Task record one')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Milestones card' }));
    expect(await screen.findByText('Milestone record one')).toBeVisible();
    await waitFor(() => expect(new URL(window.location.href).searchParams.get('card')).toBe('milestones'));
    expect(screen.queryByText('Task record one')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tasks card' }));
    expect(screen.getByText('Task record one')).toBeVisible();
    await waitFor(() => expect(new URL(window.location.href).searchParams.get('card')).toBe('tasks'));
    expect(screen.queryByText('Milestone record one')).not.toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
    expect(apiPut).not.toHaveBeenCalled();
    expect(apiDelete).not.toHaveBeenCalled();
  });

  it('keeps the exact 26-card denominator and the existing eight Definition cards', () => {
    const native = [
      { id: 'tasks', icon: (() => null) as any, label: { en: 'Tasks', pl: 'Zadania' }, component: <div data-testid="tasks-source" /> },
      { id: 'milestones', icon: (() => null) as any, label: { en: 'Milestones', pl: 'Kamienie milowe' }, component: <div data-testid="milestones-source" /> },
    ];
    const cards = canonicalInitiativeSections(native, () => null, (_key, fallback) => fallback);
    expect(INITIATIVE_CARD_KEYS).toHaveLength(26);
    expect(INITIATIVE_CARD_KEYS).toEqual([
      'summary-scope', 'strategic-fit', 'success-criteria', 'outcomes-benefits', 'kpi',
      'options', 'financial-analysis', 'financial-impact', 'people-team', 'roles-raci',
      'stakeholders', 'resources-capacity', 'dependencies', 'risk-raid', 'milestones',
      'timeline', 'tasks', 'decisions', 'gates-approvals', 'feasibility-completeness',
      'change-adoption', 'communication-engagement', 'capabilities-training',
      'technical-specification', 'attachments-materials', 'comments-activity-history',
    ]);
    expect(DEFINITION_CONTENT_CARD_KEYS).toHaveLength(8);
    expect(DEFINITION_CONTENT_CARD_KEYS).toEqual([
      'summary-scope',
      'strategic-fit',
      'success-criteria',
      'outcomes-benefits',
      'options',
      'people-team',
      'roles-raci',
      'stakeholders',
    ]);
    expect(cards.filter(item => INITIATIVE_CARD_KEYS.includes(item.id as any))).toHaveLength(26);
    expect(cards.filter(item => item.id === 'tasks')).toHaveLength(1);
    expect(cards.filter(item => item.id === 'milestones')).toHaveLength(1);
    expect(cards.slice(26).map(item => item.id)).not.toContain('tasks');
    expect(cards.slice(26).map(item => item.id)).not.toContain('milestones');
  });

  it('retains milestone create identity and keeps a failed create out of the mounted list', async () => {
    const user = userEvent.setup();
    apiPost.mockResolvedValueOnce({ milestone: { id: 'server-ms-2', name: 'Server milestone', targetDate: null, status: 'PENDING' } });
    const view = render(<TasksMilestonesSection {...sectionProps} presentation="milestones" />);
    await screen.findByText('Milestone record one');
    await user.click(screen.getByText('Add milestone'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Go-live approved'), { target: { value: 'Server milestone' } });
    await user.click(screen.getByText('Create milestone'));
    expect((await screen.findByText('Server milestone')).closest('li')).toHaveAttribute('data-milestone-id', 'server-ms-2');
    expect(apiPost).toHaveBeenCalledWith('/initiatives/init-1/milestones', expect.objectContaining({ name: 'Server milestone' }));

    view.unmount();
    apiPost.mockRejectedValueOnce(new Error('create failed'));
    render(<TasksMilestonesSection {...sectionProps} presentation="milestones" />);
    await screen.findByText('Milestone record one');
    await user.click(screen.getByText('Add milestone'));
    fireEvent.change(screen.getByPlaceholderText('e.g. Go-live approved'), { target: { value: 'Phantom milestone' } });
    await user.click(screen.getByText('Create milestone'));
    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('Phantom milestone')).not.toBeInTheDocument();
    expect(toast.error).toHaveBeenCalledWith('Failed to create milestone');
  });
});
