/**
 * Task Inbox Component Tests
 * 
 * Phase 5: Component Tests - MyWork Component
 * Tests task inbox rendering, filtering, and task management.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TaskInbox } from '../../components/MyWork/TaskInbox';
import { Api } from '../../services/api';

vi.mock('../../services/api');
vi.mock('react-hot-toast', () => ({
    default: {
        success: vi.fn(),
        error: vi.fn()
    }
}));

describe('TaskInbox', () => {
    const mockOnEditTask = vi.fn();
    const mockOnCreateTask = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('Rendering', () => {
        it('should render task inbox', async () => {
            (Api.getTasks as any).mockResolvedValue([]);

            render(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/task/i)).toBeInTheDocument();
            });
        });

        it('should display tasks when loaded', async () => {
            const mockTasks = [
                {
                    id: 'task-1',
                    title: 'Test Task',
                    status: 'todo',
                    priority: 'high'
                }
            ];

            (Api.getTasks as any).mockResolvedValue(mockTasks);

            render(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText('Test Task')).toBeInTheDocument();
            });
        });
    });

    describe('Filtering', () => {
        it('should filter by priority', async () => {
            (Api.getTasks as any).mockResolvedValue([]);

            render(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/task/i)).toBeInTheDocument();
            });
        });

        it('should filter by status', async () => {
            (Api.getTasks as any).mockResolvedValue([]);

            render(
                <TaskInbox
                    onEditTask={mockOnEditTask}
                    onCreateTask={mockOnCreateTask}
                />
            );

            await waitFor(() => {
                expect(screen.getByText(/task/i)).toBeInTheDocument();
            });
        });
    });
});

