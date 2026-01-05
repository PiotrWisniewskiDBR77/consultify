
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PillNavigation } from '@/components/MyWork/PillNavigation';

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue
    })
}));

describe('PillNavigation', () => {
    const mockOnTabChange = vi.fn();
    const mockOnCreateNew = vi.fn();
    const mockCounts = { tasks: 5, decisions: 2 };

    it('renders all tabs and counts', () => {
        render(
            <PillNavigation
                activeTab="tasks"
                onTabChange={mockOnTabChange}
                counts={mockCounts}
                onCreateNew={mockOnCreateNew}
            />
        );

        expect(screen.getByText('Tasks')).toBeTruthy();
        expect(screen.getByText('5')).toBeTruthy();
        expect(screen.getByText('Decisions')).toBeTruthy();
        expect(screen.getByText('2')).toBeTruthy();
        expect(screen.getByText('Projects')).toBeTruthy();
        expect(screen.getByText('Soon')).toBeTruthy();
    });

    it('calls onTabChange when a tab is clicked', () => {
        render(
            <PillNavigation
                activeTab="tasks"
                onTabChange={mockOnTabChange}
                counts={mockCounts}
                onCreateNew={mockOnCreateNew}
            />
        );

        fireEvent.click(screen.getByText('Decisions'));
        expect(mockOnTabChange).toHaveBeenCalledWith('decisions');
    });

    it('disables the Projects tab (Coming Soon)', () => {
        render(
            <PillNavigation
                activeTab="tasks"
                onTabChange={mockOnTabChange}
                counts={mockCounts}
                onCreateNew={mockOnCreateNew}
            />
        );

        const projectsBtn = screen.getByText('Projects').closest('button');
        expect(projectsBtn?.disabled).toBe(true);

        fireEvent.click(screen.getByText('Projects'));
        expect(mockOnTabChange).not.toHaveBeenCalledWith('projects');
    });

    it('shows correct button label for tasks tab', () => {
        render(
            <PillNavigation
                activeTab="tasks"
                onTabChange={mockOnTabChange}
                counts={mockCounts}
                onCreateNew={mockOnCreateNew}
            />
        );

        expect(screen.getByText('New Task')).toBeTruthy();
        fireEvent.click(screen.getByText('New Task'));
        expect(mockOnCreateNew).toHaveBeenCalled();
    });

    it('shows correct button label for decisions tab', () => {
        render(
            <PillNavigation
                activeTab="decisions"
                onTabChange={mockOnTabChange}
                counts={mockCounts}
                onCreateNew={mockOnCreateNew}
            />
        );

        expect(screen.getByText('New Decision')).toBeTruthy();
        fireEvent.click(screen.getByText('New Decision'));
        expect(mockOnCreateNew).toHaveBeenCalled();
    });

    it('hides create button on projects tab', () => {
        render(
            <PillNavigation
                activeTab="projects"
                onTabChange={mockOnTabChange}
                counts={mockCounts}
                onCreateNew={mockOnCreateNew}
            />
        );

        expect(screen.queryByText('New Task')).toBeNull();
        expect(screen.queryByText('New Decision')).toBeNull();
        expect(screen.queryByText('New')).toBeNull();
    });
});
