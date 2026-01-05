
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { EmptyState, EmptyStateInline } from '@/components/MyWork/shared/EmptyState';

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue
    })
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
    motion: {
        div: ({ children, ...props }: any) => <div {...props}>{children}</div>
    }
}));

describe('EmptyState', () => {
    it('renders with default values for a given type', () => {
        render(<EmptyState type="tasks" />);
        expect(screen.getByText('No Tasks')).toBeTruthy();
        expect(screen.getByText('Create a task to get started with your work.')).toBeTruthy();
    });

    it('renders with custom title and description', () => {
        render(<EmptyState type="generic" title="Custom Title" description="Custom Description" />);
        expect(screen.getByText('Custom Title')).toBeTruthy();
        expect(screen.getByText('Custom Description')).toBeTruthy();
    });

    it('shows and handles primary action', () => {
        const mockAction = vi.fn();
        render(<EmptyState type="tasks" actionLabel="Create" onAction={mockAction} />);

        const btn = screen.getByText('Create');
        fireEvent.click(btn);
        expect(mockAction).toHaveBeenCalled();
    });

    it('shows and handles secondary action', () => {
        const mockAction = vi.fn();
        render(<EmptyState type="tasks" secondaryActionLabel="Learn More" onSecondaryAction={mockAction} />);

        const btn = screen.getByText('Learn More');
        fireEvent.click(btn);
        expect(mockAction).toHaveBeenCalled();
    });

    it('shows and handles AI suggestion', () => {
        const mockAction = vi.fn();
        render(<EmptyState type="tasks" showAISuggestion={true} onAISuggestion={mockAction} />);

        const btn = screen.getByText('AI Suggest');
        fireEvent.click(btn);
        expect(mockAction).toHaveBeenCalled();
    });
});

describe('EmptyStateInline', () => {
    it('renders message and handle action', () => {
        const mockAction = vi.fn();
        render(<EmptyStateInline message="Empty here" actionLabel="Fix" onAction={mockAction} />);

        expect(screen.getByText('Empty here')).toBeTruthy();
        const btn = screen.getByText('Fix');
        fireEvent.click(btn);
        expect(mockAction).toHaveBeenCalled();
    });
});
