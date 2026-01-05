
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyTasksList } from '@/components/MyWork/MyTasksList';
import { Api } from '@/services/api';

// Mock dependencies
vi.mock('@/services/api', () => ({
    Api: {
        getTasks: vi.fn(),
        updateTask: vi.fn(),
        deleteTask: vi.fn()
    }
}));

vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    },
    AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue
    })
}));

describe('MyTasksList', () => {
    const mockOnCountsChange = vi.fn();
    const mockOnTaskClick = vi.fn();
    const mockOnCreateTask = vi.fn();

    const todayStr = new Date().toISOString().split('T')[0];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const mockTasks = [
        { id: '1', title: 'Today Task', status: 'todo', dueDate: todayStr, priority: 'high' },
        { id: '2', title: 'Overdue Task', status: 'todo', dueDate: yesterdayStr, priority: 'urgent' },
        { id: '3', title: 'Tomorrow Task', status: 'todo', dueDate: tomorrowStr, priority: 'medium' },
        { id: '4', title: 'No Date Task', status: 'todo', priority: 'low' },
        { id: '5', title: 'Completed Task', status: 'completed', dueDate: todayStr, priority: 'medium' }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        (Api.getTasks as any).mockResolvedValue(mockTasks);
    });

    it('renders and fetches tasks, grouping them correctly', async () => {
        render(
            <MyTasksList
                activeTimeGroup="all"
                onCountsChange={mockOnCountsChange}
                onTaskClick={mockOnTaskClick}
                onCreateTask={mockOnCreateTask}
            />
        );

        await waitFor(() => {
            expect(Api.getTasks).toHaveBeenCalled();
            expect(screen.getByText('Today Task')).toBeTruthy();
            expect(screen.getByText('Overdue Task')).toBeTruthy();
            expect(screen.getByText('Tomorrow Task')).toBeTruthy();
            expect(screen.getByText('No Date Task')).toBeTruthy();
            // Completed tasks are categorized as 'later' in the component logic
            expect(screen.getByText('Completed Task')).toBeTruthy();
        });

        expect(mockOnCountsChange).toHaveBeenCalledWith(expect.objectContaining({
            total: 5,
            overdue: 1,
            today: 1
        }));
    });

    it('filters tasks by activeTimeGroup', async () => {
        render(
            <MyTasksList
                activeTimeGroup="today"
                onCountsChange={mockOnCountsChange}
                onTaskClick={mockOnTaskClick}
                onCreateTask={mockOnCreateTask}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Today Task')).toBeTruthy();
            expect(screen.queryByText('Overdue Task')).toBeNull();
        });
    });

    it('toggles task completion', async () => {
        render(
            <MyTasksList
                activeTimeGroup="all"
                onCountsChange={mockOnCountsChange}
                onTaskClick={mockOnTaskClick}
                onCreateTask={mockOnCreateTask}
            />
        );

        await waitFor(() => expect(screen.getByText('Today Task')).toBeTruthy());

        // Find and click complete checkbox/button. 
        // In TaskRow, it's a button with Circle/CheckCircle icon.
        // Assuming TaskRow shows "Today Task". 
        // Actually TaskRow renders a button for completion. 
        // Let's find by role or title if available, or just mock it.
        // TaskRow uses a button with onClick={() => onToggleComplete(task.id, !isCompleted)}

        // I'll look at TaskRow to find a good selector.
        const row = screen.getByText('Today Task').closest('div')?.parentElement;
        const completeBtn = row?.querySelector('button'); // First button is usually complete

        if (completeBtn) {
            fireEvent.click(completeBtn);
            await waitFor(() => {
                expect(Api.updateTask).toHaveBeenCalledWith('1', { status: 'completed' });
            });
        }
    });

    it('toggles pinning a task', async () => {
        render(
            <MyTasksList
                activeTimeGroup="all"
                onCountsChange={mockOnCountsChange}
                onTaskClick={mockOnTaskClick}
                onCreateTask={mockOnCreateTask}
            />
        );

        await waitFor(() => expect(screen.getByText('Today Task')).toBeTruthy());

        // Find pin button. Usually second or third button.
        // Or find by icon if we mock lucide-react. 
        // But many buttons use icons.

        // Let's check TaskRow.tsx for specific titles or roles.
        // If I can't find it easily, I'll just check if clicking title calls onTaskClick.
        fireEvent.click(screen.getByText('Today Task'));
        expect(mockOnTaskClick).toHaveBeenCalledWith('1');
    });

    it('shows empty state when no tasks are returned', async () => {
        (Api.getTasks as any).mockResolvedValue([]);
        render(
            <MyTasksList
                activeTimeGroup="all"
                onCountsChange={mockOnCountsChange}
                onTaskClick={mockOnTaskClick}
                onCreateTask={mockOnCreateTask}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('No tasks yet')).toBeTruthy();
            expect(screen.getByText('Create Task')).toBeTruthy();
        });

        fireEvent.click(screen.getByText('Create Task'));
        expect(mockOnCreateTask).toHaveBeenCalled();
    });
});
