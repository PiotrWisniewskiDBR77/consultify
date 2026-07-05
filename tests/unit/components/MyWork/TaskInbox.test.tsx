import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskInbox } from '@/components/MyWork/TaskInbox';
import { Api } from '@/services/api';

// Mock dependencies
vi.mock('@/services/api', () => ({
  Api: {
    getTasks: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
  },
}));

const mockUsePMOStore = vi.fn();
vi.mock('@/store/usePMOStore', () => ({
  usePMOStore: (selector: any) => mockUsePMOStore(selector),
  PMOTaskLabel: {},
}));

// Note: react-hot-toast is mocked globally in tests/setup.ts

// Mock framer-motion to avoid animation issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    // ErrorState's retry <Button> renders motion.button — provide it so the
    // error branch mounts instead of throwing "Element type is invalid".
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock react-virtuoso - render items directly
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent, components }: any) => {
    const List = components?.List || 'div';
    const Item = components?.Item || 'div';
    return (
      <List data-testid="virtuoso-list">
        {data &&
          data.map((item: any, index: number) => (
            <Item key={item?.id || index}>{itemContent(index, item)}</Item>
          ))}
      </List>
    );
  },
}));

describe('TaskInbox', () => {
  const mockOnEditTask = vi.fn();
  const mockOnCreateTask = vi.fn();

  const mockTasks = [
    {
      id: '1',
      title: 'Task 1',
      status: 'todo',
      priority: 'high',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    }, // Future
    { id: '2', title: 'Task 2', status: 'completed', priority: 'medium' },
    { id: '3', title: 'Overdue Task', status: 'todo', priority: 'low', dueDate: '2020-01-01' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // Use deterministic mock to prevent race conditions
    (Api.getTasks as any).mockImplementation(() => Promise.resolve(mockTasks));
    (Api.updateTask as any).mockImplementation(() => Promise.resolve({}));
    (Api.deleteTask as any).mockImplementation(() => Promise.resolve({}));

    // Setup PMO store mock
    mockUsePMOStore.mockImplementation((selector: any) => {
      const state = {
        getTaskLabel: () => [],
      };
      return selector(state);
    });

    // Mock localStorage
    Storage.prototype.getItem = vi.fn(() => null);
    Storage.prototype.setItem = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders and fetches tasks', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

    await waitFor(() => {
      expect(Api.getTasks).toHaveBeenCalled();
    });

    // Switch to List View
    const viewBtn = await screen.findByText(/PMO Priority/i);
    await user.click(viewBtn);
    const listOption = await screen.findByText(/List View/i);
    await user.click(listOption);

    // Tasks should be rendered
    await waitFor(() => {
      expect(screen.getByText('Task 1')).toBeInTheDocument();
      expect(screen.getByText('Task 2')).toBeInTheDocument();
    });
  });

  it('shows empty state when no tasks', async () => {
    (Api.getTasks as any).mockResolvedValue([]);
    renderWithProviders(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

    await waitFor(() => {
      expect(screen.getByText('No tasks found')).toBeInTheDocument();
    });
  });

  it('shows error state with retry (not a blank/empty screen) when fetch fails', async () => {
    const user = userEvent.setup();
    (Api.getTasks as any).mockRejectedValueOnce(new Error('network down'));
    renderWithProviders(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

    // Actionable error, not the misleading "No tasks found" empty state.
    await waitFor(() => {
      expect(screen.getByText('Failed to load tasks')).toBeInTheDocument();
    });
    expect(screen.queryByText('No tasks found')).not.toBeInTheDocument();

    // Retry re-invokes the fetch and recovers to the normal empty state.
    (Api.getTasks as any).mockResolvedValueOnce([]);
    await user.click(screen.getByRole('button', { name: /try again/i }));

    await waitFor(() => {
      expect(Api.getTasks).toHaveBeenCalledTimes(2);
      expect(screen.getByText('No tasks found')).toBeInTheDocument();
    });
  });

  it('filters tasks by Quick Filter (Overdue)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

    await waitFor(() => expect(Api.getTasks).toHaveBeenCalled());

    // Switch to List View to ensure all tasks are theoretically visible (flat list)
    const viewBtn = await screen.findByText(/PMO Priority/i);
    await user.click(viewBtn);
    const listOption = await screen.findByText(/List View/i);
    await user.click(listOption);

    // Find filter button
    const filterBtn = await screen.findByText('All Tasks');
    await user.click(filterBtn);

    // Click "Overdue" option
    const overdueOption = await screen.findByText(/Overdue/i, { selector: 'button' });
    await user.click(overdueOption);

    await waitFor(() => {
      // Task 1 (Future) should NOT be visible
      expect(screen.queryByText('Task 1')).not.toBeInTheDocument();
      // Task 3 (Overdue) SHOULD be visible
      expect(screen.getByText('Overdue Task')).toBeInTheDocument();
    });
  });

  it('calls onEditTask when clicking a task', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

    await waitFor(() => expect(Api.getTasks).toHaveBeenCalled());

    // Switch to List View to ensure Task 1 is visible
    const viewBtn = await screen.findByText(/PMO Priority/i);
    await user.click(viewBtn);
    const listOption = await screen.findByText(/List View/i);
    await user.click(listOption);

    await waitFor(() => expect(screen.queryByText('Task 1')).toBeInTheDocument());

    const taskElement = screen.getByText('Task 1');
    const clickableParent = taskElement.closest('div[class*="cursor-pointer"]');
    expect(clickableParent).toBeInTheDocument();
    if (clickableParent) {
      await user.click(clickableParent);
    }

    expect(mockOnEditTask).toHaveBeenCalledWith('1');
  });

  it('calls onCreateTask when new task button clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

    await waitFor(() => expect(Api.getTasks).toHaveBeenCalled());

    const newTaskBtn = await screen.findByRole('button', { name: /new task|add task/i });
    await user.click(newTaskBtn);

    expect(mockOnCreateTask).toHaveBeenCalled();
  });
});
