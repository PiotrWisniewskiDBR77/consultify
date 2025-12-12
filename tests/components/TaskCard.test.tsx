import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TaskCard } from '../../components/TaskCard';
import { Task } from '../../types';

describe('Component Test: TaskCard', () => {
    const mockTask: Task = {
        id: 'task-1',
        title: 'Test Task',
        status: 'in_progress',
        priority: 'high',
        why: 'Test reason',
    } as Task;

    it('renders task title', () => {
        render(<TaskCard task={mockTask} onClick={vi.fn()} />);
        expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('calls onClick when card is clicked', () => {
        const handleClick = vi.fn();
        render(<TaskCard task={mockTask} onClick={handleClick} />);

        const card = screen.getByText('Test Task').closest('div');
        if (card) {
            fireEvent.click(card);
            expect(handleClick).toHaveBeenCalledTimes(1);
        }
    });

    it('displays status badge', () => {
        render(<TaskCard task={mockTask} onClick={vi.fn()} />);
        expect(screen.getByText(/In Progress/i)).toBeInTheDocument();
    });

    it('displays priority badge', () => {
        render(<TaskCard task={mockTask} onClick={vi.fn()} />);
        expect(screen.getByText(/high/i)).toBeInTheDocument();
    });

    it('displays why text when present', () => {
        render(<TaskCard task={mockTask} onClick={vi.fn()} />);
        expect(screen.getByText(/Test reason/)).toBeInTheDocument();
    });

    it('displays assignee when present', () => {
        const taskWithAssignee: Task = {
            ...mockTask,
            assignee: {
                id: 'user-1',
                firstName: 'John',
                lastName: 'Doe',
            } as any,
        };

        render(<TaskCard task={taskWithAssignee} onClick={vi.fn()} />);
        expect(screen.getByText(/Doe/)).toBeInTheDocument();
    });

    it('displays unassigned when no assignee', () => {
        render(<TaskCard task={mockTask} onClick={vi.fn()} />);
        expect(screen.getByText(/Unassigned/)).toBeInTheDocument();
    });

    it('displays due date when present', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7);
        const taskWithDueDate: Task = {
            ...mockTask,
            dueDate: futureDate.toISOString(),
        };

        render(<TaskCard task={taskWithDueDate} onClick={vi.fn()} />);
        expect(screen.getByText(/\d{1,2}\/\d{1,2}/)).toBeInTheDocument();
    });

    it('displays checklist progress when present', () => {
        const taskWithChecklist: Task = {
            ...mockTask,
            checklist: [
                { id: '1', text: 'Check 1', completed: true },
                { id: '2', text: 'Check 2', completed: false },
            ],
        } as Task;

        render(<TaskCard task={taskWithChecklist} onClick={vi.fn()} />);
        // Checklist progress bar should be rendered
        const progressBar = document.querySelector('[style*="width"]');
        expect(progressBar).toBeInTheDocument();
    });

    it('handles different status values', () => {
        const statuses: Array<Task['status']> = [
            'not_started',
            'in_progress',
            'completed',
            'blocked',
        ];

        statuses.forEach(status => {
            const { unmount } = render(
                <TaskCard task={{ ...mockTask, status }} onClick={vi.fn()} />
            );
            expect(screen.getByText(mockTask.title)).toBeInTheDocument();
            unmount();
        });
    });
});

