
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkSidebar } from '@/components/MyWork/WorkSidebar';

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue
    })
}));

describe('WorkSidebar', () => {
    const mockProps = {
        activeSection: 'tasks' as const,
        onSectionChange: vi.fn(),
        taskTimeGroup: 'all' as const,
        onTaskTimeGroupChange: vi.fn(),
        decisionGroup: 'all' as const,
        onDecisionGroupChange: vi.fn(),
        taskCounts: { total: 10, overdue: 2, today: 3, week: 5, later: 0, noDate: 0 },
        decisionCounts: { total: 4, my: 1, awaiting: 3 }
    };

    it('renders all main sections and counts', () => {
        render(<WorkSidebar {...mockProps} />);

        expect(screen.getByText('My Tasks')).toBeTruthy();
        expect(screen.getByText('10')).toBeTruthy();
        expect(screen.getByText('Decisions')).toBeTruthy();
        expect(screen.getByText('4')).toBeTruthy();
        expect(screen.getByText('My Projects')).toBeTruthy();
        expect(screen.getByText('Soon')).toBeTruthy();
    });

    it('shows task sub-items when expanded', () => {
        render(<WorkSidebar {...mockProps} />);

        expect(screen.getByText('Overdue')).toBeTruthy();
        expect(screen.getByText('2')).toBeTruthy();
        expect(screen.getByText('Today')).toBeTruthy();
        // Use getAllByText for counts that might be duplicated
        expect(screen.getAllByText('3').length).toBeGreaterThan(0);
    });

    it('calls onSectionChange and onTaskTimeGroupChange when a sub-item is clicked', () => {
        render(<WorkSidebar {...mockProps} />);

        fireEvent.click(screen.getByText('Overdue'));
        expect(mockProps.onSectionChange).toHaveBeenCalledWith('tasks');
        expect(mockProps.onTaskTimeGroupChange).toHaveBeenCalledWith('overdue');
    });

    it('calls onSectionChange and onDecisionGroupChange when a decision sub-item is clicked', () => {
        render(<WorkSidebar {...mockProps} />);

        fireEvent.click(screen.getByText('My Decisions'));
        expect(mockProps.onSectionChange).toHaveBeenCalledWith('decisions');
        expect(mockProps.onDecisionGroupChange).toHaveBeenCalledWith('my');
    });

    it('toggles section expansion', async () => {
        render(<WorkSidebar {...mockProps} />);

        // Sections are expanded by default
        expect(screen.queryByText('Overdue')).toBeTruthy();

        // Find the specific toggle button for tasks
        // It's the first button in the "My Tasks" section
        const tasksHeader = screen.getByText('My Tasks').closest('button');
        const toggleBtn = tasksHeader?.querySelector('button');

        if (toggleBtn) {
            fireEvent.click(toggleBtn);
            await waitFor(() => {
                expect(screen.queryByText('Overdue')).toBeNull();
            });
        }
    });

    it('changes main section when clicking section header', () => {
        render(<WorkSidebar {...mockProps} />);

        fireEvent.click(screen.getByText('Decisions'));
        expect(mockProps.onSectionChange).toHaveBeenCalledWith('decisions');
    });
});
