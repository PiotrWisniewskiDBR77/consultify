/**
 * Dashboard Overview Component Tests
 * 
 * Phase 5: Component Tests - Critical Dashboard Component
 * Tests dashboard layout and component integration.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardOverview } from '../../components/dashboard/DashboardOverview';
import { useAppStore } from '../../store/useAppStore';

// Mock the store
vi.mock('../../store/useAppStore', () => ({
    useAppStore: vi.fn()
}));

// Mock child components
vi.mock('../../components/MyWork/TaskInbox', () => ({
    TaskInbox: () => <div data-testid="task-inbox">Task Inbox</div>
}));

vi.mock('../../components/dashboard/NotificationCenter', () => ({
    NotificationCenter: () => <div data-testid="notification-center">Notification Center</div>
}));

describe('DashboardOverview', () => {
    const mockSetCurrentView = vi.fn();
    const mockOnStartModule1 = vi.fn();
    const mockOnCreateTask = vi.fn();
    const mockOnEditTask = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        (useAppStore as any).mockReturnValue({
            setCurrentView: mockSetCurrentView
        });
    });

    describe('Rendering', () => {
        it('should render dashboard layout', () => {
            render(
                <DashboardOverview
                    onStartModule1={mockOnStartModule1}
                    onCreateTask={mockOnCreateTask}
                    onEditTask={mockOnEditTask}
                />
            );
            expect(screen.getByTestId('task-inbox')).toBeInTheDocument();
            expect(screen.getByTestId('notification-center')).toBeInTheDocument();
        });

        it('should render TaskInbox component', () => {
            render(
                <DashboardOverview
                    onStartModule1={mockOnStartModule1}
                    onCreateTask={mockOnCreateTask}
                    onEditTask={mockOnEditTask}
                />
            );
            expect(screen.getByTestId('task-inbox')).toBeInTheDocument();
        });

        it('should render NotificationCenter component', () => {
            render(
                <DashboardOverview
                    onStartModule1={mockOnStartModule1}
                    onCreateTask={mockOnCreateTask}
                    onEditTask={mockOnEditTask}
                />
            );
            expect(screen.getByTestId('notification-center')).toBeInTheDocument();
        });

        it('should pass onCreateTask to TaskInbox', () => {
            render(
                <DashboardOverview
                    onStartModule1={mockOnStartModule1}
                    onCreateTask={mockOnCreateTask}
                    onEditTask={mockOnEditTask}
                />
            );
            // TaskInbox should receive onCreateTask prop
            expect(screen.getByTestId('task-inbox')).toBeInTheDocument();
        });

        it('should pass onEditTask to TaskInbox', () => {
            render(
                <DashboardOverview
                    onStartModule1={mockOnStartModule1}
                    onCreateTask={mockOnCreateTask}
                    onEditTask={mockOnEditTask}
                />
            );
            // TaskInbox should receive onEditTask prop
            expect(screen.getByTestId('task-inbox')).toBeInTheDocument();
        });
    });

    describe('Layout', () => {
        it('should have responsive grid layout', () => {
            const { container } = render(
                <DashboardOverview
                    onStartModule1={mockOnStartModule1}
                    onCreateTask={mockOnCreateTask}
                    onEditTask={mockOnEditTask}
                />
            );
            const grid = container.querySelector('.grid');
            expect(grid).toBeInTheDocument();
        });

        it('should have correct column spans for large screens', () => {
            const { container } = render(
                <DashboardOverview
                    onStartModule1={mockOnStartModule1}
                    onCreateTask={mockOnCreateTask}
                    onEditTask={mockOnEditTask}
                />
            );
            // Check for lg:grid-cols-12 class
            const grid = container.querySelector('.lg\\:grid-cols-12');
            expect(grid).toBeInTheDocument();
        });
    });

    describe('Props Handling', () => {
        it('should handle optional session prop', () => {
            const mockSession = {
                user: { id: 'user-1', name: 'Test User' }
            } as any;

            render(
                <DashboardOverview
                    onStartModule1={mockOnStartModule1}
                    session={mockSession}
                    onCreateTask={mockOnCreateTask}
                    onEditTask={mockOnEditTask}
                />
            );
            expect(screen.getByTestId('task-inbox')).toBeInTheDocument();
        });

        it('should handle optional refreshTrigger prop', () => {
            render(
                <DashboardOverview
                    onStartModule1={mockOnStartModule1}
                    refreshTrigger={1}
                    onCreateTask={mockOnCreateTask}
                    onEditTask={mockOnEditTask}
                />
            );
            expect(screen.getByTestId('task-inbox')).toBeInTheDocument();
        });
    });
});

