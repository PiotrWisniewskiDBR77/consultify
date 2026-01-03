
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskInbox } from '../../../../components/MyWork/TaskInbox';
import { Api } from '../../../../services/api';

// Mock dependencies
vi.mock('../../../../services/api', () => ({
    Api: {
        getTasks: vi.fn(),
        updateTask: vi.fn(),
        deleteTask: vi.fn()
    }
}));

vi.mock('../../../../store/usePMOStore', () => ({
    usePMOStore: (selector: any) => {
        // Mock getTaskLabel selector
        if (selector.toString().includes('getTaskLabel')) {
            return () => [];
        }
        return {};
    },
    PMOTaskLabel: {}
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

// Mock framer-motion to avoid animation issues
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

describe('TaskInbox', () => {
    const mockOnEditTask = vi.fn();
    const mockOnCreateTask = vi.fn();

    const mockTasks = [
        { id: '1', title: 'Task 1', status: 'todo', priority: 'high', dueDate: new Date(Date.now() + 86400000).toISOString() }, // Future
        { id: '2', title: 'Task 2', status: 'completed', priority: 'medium' },
        { id: '3', title: 'Overdue Task', status: 'todo', priority: 'low', dueDate: '2020-01-01' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getTasks as any).mockResolvedValue(mockTasks);
    });

    it('renders and fetches tasks', async () => {
        render(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

        // Check loading state or directly wait for result
        await waitFor(() => {
            expect(screen.getByText('Task 1')).toBeTruthy();
            expect(screen.getByText('Task 2')).toBeTruthy();
            expect(Api.getTasks).toHaveBeenCalled();
        });
    });

    it('shows empty state when no tasks', async () => {
        (Api.getTasks as any).mockResolvedValue([]);
        render(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

        await waitFor(() => {
            expect(screen.getByText('No tasks found')).toBeTruthy();
        });
    });

    it('filters tasks by Quick Filter (Overdue)', async () => {
        render(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

        await waitFor(() => expect(screen.getByText('Task 1')).toBeTruthy());

        // Open filter dropdown
        const filterBtn = screen.getByText('All Tasks');
        fireEvent.click(filterBtn);

        const overdueOption = screen.getByText('Overdue');
        fireEvent.click(overdueOption);

        await waitFor(() => {
            expect(screen.queryByText('Task 1')).toBeNull(); // Should be hidden
            expect(screen.getByText('Overdue Task')).toBeTruthy(); // Should show
        });
    });

    it('calls onEditTask when clicking a task', async () => {
        render(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

        await waitFor(() => expect(screen.getByText('Task 1')).toBeTruthy());

        fireEvent.click(screen.getByText('Task 1'));
        expect(mockOnEditTask).toHaveBeenCalledWith('1');
    });

    it('calls onCreateTask when new task button clicked', async () => {
        render(<TaskInbox onEditTask={mockOnEditTask} onCreateTask={mockOnCreateTask} />);

        await waitFor(() => expect(screen.getByText('New Task')).toBeTruthy());

        fireEvent.click(screen.getByText('New Task'));
        expect(mockOnCreateTask).toHaveBeenCalled();
    });
});
