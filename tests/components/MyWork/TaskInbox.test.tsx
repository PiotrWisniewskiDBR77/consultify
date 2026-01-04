import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test-utils';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskInbox } from '../../../../src/components/MyWork/TaskInbox';
import { Api } from '../../../../src/services/api';

// Mock dependencies
vi.mock('../../../../src/services/api', () => ({
    Api: {
        getTasks: vi.fn(),
        updateTask: vi.fn(),
        deleteTask: vi.fn()
    }
}));

const mockUsePMOStore = vi.fn();
vi.mock('../../../../src/store/usePMOStore', () => ({
    usePMOStore: (selector: any) => mockUsePMOStore(selector),
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

// Mock react-virtuoso - render items directly
vi.mock('react-virtuoso', () => ({
    Virtuoso: ({ data, itemContent, components }: any) => {
        const List = components?.List || 'div';
        const Item = components?.Item || 'div';
        return (
            <List data-testid="virtuoso-list">
                {data && data.map((item: any, index: number) => (
                    <Item key={item?.id || index}>
                        {itemContent(index, item)}
                    </Item>
                ))}
            </List>
        );
    }
}));

/**
 * TaskInbox Component Tests
 * Tests for task inbox component with full integration
 * CRITICAL FOR ENTERPRISE TASK MANAGEMENT UI
 */
describe('TaskInbox Component', () => {
    const mockOnEditTask = vi.fn();
    const mockOnCreateTask = vi.fn();

    const mockTasks = [
        {
            id: '1',
            title: 'High Priority Task',
            status: 'todo',
            priority: 'high',
            dueDate: new Date(Date.now() + 86400000).toISOString(),
            description: 'This is a high priority task'
        },
        {
            id: '2',
            title: 'Completed Task',
            status: 'completed',
            priority: 'medium',
            description: 'This task is already completed'
        },
        {
            id: '3',
            title: 'Overdue Task',
            status: 'todo',
            priority: 'low',
            dueDate: new Date(Date.now() - 86400000).toISOString(),
            description: 'This task is overdue'
        }
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
                getTaskLabel: () => ({ color: '#007bff', text: 'Task' })
            };
            return selector(state);
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('Rendering', () => {
        it('should render task inbox with tasks', async () => {
            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId('virtuoso-list')).toBeInTheDocument();
            });

            // Check if tasks are rendered
            expect(screen.getByText('High Priority Task')).toBeInTheDocument();
            expect(screen.getByText('Completed Task')).toBeInTheDocument();
            expect(screen.getByText('Overdue Task')).toBeInTheDocument();
        });

        it('should display task priorities correctly', async () => {
            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('High Priority Task')).toBeInTheDocument();
            });

            // Check priority indicators (assuming they exist)
            const highPriorityTask = screen.getByText('High Priority Task').closest('[data-priority]');
            expect(highPriorityTask).toHaveAttribute('data-priority', 'high');
        });

        it('should show due dates', async () => {
            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('High Priority Task')).toBeInTheDocument();
            });

            // Check if due dates are displayed (format may vary)
            expect(screen.getByText(/Due:/)).toBeInTheDocument();
        });
    });

    describe('Interactions', () => {
        it('should call onEditTask when edit button is clicked', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('High Priority Task')).toBeInTheDocument();
            });

            // Find and click edit button (assuming it exists)
            const editButton = screen.getByRole('button', { name: /edit/i });
            await user.click(editButton);

            expect(mockOnEditTask).toHaveBeenCalledWith(mockTasks[0]);
        });

        it('should mark task as completed when checkbox is clicked', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('High Priority Task')).toBeInTheDocument();
            });

            // Find and click completion checkbox
            const checkbox = screen.getByRole('checkbox', { name: /complete/i });
            await user.click(checkbox);

            expect(Api.updateTask).toHaveBeenCalledWith('1', { status: 'completed' });
        });

        it('should delete task when delete button is clicked', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('High Priority Task')).toBeInTheDocument();
            });

            // Find and click delete button
            const deleteButton = screen.getByRole('button', { name: /delete/i });
            await user.click(deleteButton);

            expect(Api.deleteTask).toHaveBeenCalledWith('1');
        });
    });

    describe('Filtering and Sorting', () => {
        it('should filter tasks by status', async () => {
            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                    initialFilter={{ status: 'completed' }}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Completed Task')).toBeInTheDocument();
            });

            // Only completed task should be visible
            expect(screen.queryByText('High Priority Task')).not.toBeInTheDocument();
            expect(screen.getByText('Completed Task')).toBeInTheDocument();
        });

        it('should sort tasks by priority', async () => {
            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                    initialSort={{ field: 'priority', direction: 'desc' }}
                />
            );

            await waitFor(() => {
                expect(screen.getByTestId('virtuoso-list')).toBeInTheDocument();
            });

            // High priority task should appear first
            const taskElements = screen.getAllByRole('article'); // Assuming tasks are in article elements
            expect(taskElements[0]).toHaveTextContent('High Priority Task');
        });
    });

    describe('Loading and Error States', () => {
        it('should show loading state initially', () => {
            (Api.getTasks as any).mockImplementation(() => new Promise(() => {})); // Never resolves

            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            expect(screen.getByText(/loading/i)).toBeInTheDocument();
        });

        it('should show error state when API fails', async () => {
            (Api.getTasks as any).mockRejectedValue(new Error('API Error'));

            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/error/i)).toBeInTheDocument();
            });
        });
    });

    describe('Empty States', () => {
        it('should show empty state when no tasks', async () => {
            (Api.getTasks as any).mockResolvedValue([]);

            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/no tasks/i)).toBeInTheDocument();
            });
        });

        it('should show call-to-action for creating first task', async () => {
            (Api.getTasks as any).mockResolvedValue([]);

            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                const createButton = screen.getByRole('button', { name: /create/i });
                expect(createButton).toBeInTheDocument();
            });
        });
    });

    describe('Accessibility', () => {
        it('should have proper ARIA labels', async () => {
            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('High Priority Task')).toBeInTheDocument();
            });

            // Check for proper accessibility attributes
            expect(screen.getByRole('main')).toHaveAttribute('aria-label', 'Task Inbox');
        });

        it('should support keyboard navigation', async () => {
            const user = userEvent.setup();

            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('High Priority Task')).toBeInTheDocument();
            });

            // Tab to first task
            await user.tab();
            expect(screen.getByText('High Priority Task')).toHaveFocus();
        });
    });

    describe('Performance', () => {
        it('should render large task lists efficiently', async () => {
            const largeTaskList = Array.from({ length: 100 }, (_, i) => ({
                id: `task-${i}`,
                title: `Task ${i}`,
                status: 'todo',
                priority: 'medium',
                description: `Description for task ${i}`
            }));

            (Api.getTasks as any).mockResolvedValue(largeTaskList);

            const startTime = performance.now();

            renderWithProviders(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Task 0')).toBeInTheDocument();
            });

            const endTime = performance.now();
            const renderTime = endTime - startTime;

            // Should render within reasonable time (< 500ms for 100 items)
            expect(renderTime).toBeLessThan(500);
        });
    });
});
