
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DueDateIndicator, DueDateText } from '@/components/MyWork/shared/DueDateIndicator';

// Mock i18next
vi.mock('react-i18next', () => ({
    useTranslation: () => ({
        t: (key: string, defaultValue: string) => defaultValue
    })
}));

describe('DueDateIndicator', () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 10);

    it('renders "Completed" state', () => {
        render(<DueDateIndicator isCompleted={true} />);
        expect(screen.getByText('Completed')).toBeTruthy();
    });

    it('renders "No date" state', () => {
        render(<DueDateIndicator />);
        expect(screen.getByText('No date')).toBeTruthy();
    });

    it('renders "Today" correctly', () => {
        render(<DueDateIndicator dueDate={today.toISOString()} />);
        expect(screen.getByText('Today')).toBeTruthy();
    });

    it('renders "Yesterday" correctly', () => {
        render(<DueDateIndicator dueDate={yesterday.toISOString()} />);
        expect(screen.getByText('Yesterday')).toBeTruthy();
    });

    it('renders "Tomorrow" correctly', () => {
        render(<DueDateIndicator dueDate={tomorrow.toISOString()} />);
        expect(screen.getByText('Tomorrow')).toBeTruthy();
    });

    it('renders "weeks overdue" correctly', () => {
        render(<DueDateIndicator dueDate={lastWeek.toISOString()} />);
        expect(screen.getByText('1 weeks overdue')).toBeTruthy();
    });

    it('renders with time if provided', () => {
        render(<DueDateIndicator dueDate={today.toISOString()} dueTime="14:00" />);
        expect(screen.getByText(/Today • 14:00/)).toBeTruthy();
    });

    it('renders absolute date if showRelative is false', () => {
        const specificDate = new Date('2025-12-25');
        render(<DueDateIndicator dueDate={specificDate.toISOString()} showRelative={false} />);
        expect(screen.getByText(specificDate.toLocaleDateString())).toBeTruthy();
    });
});

describe('DueDateText', () => {
    it('renders correctly', () => {
        const today = new Date();
        render(<DueDateText dueDate={today.toISOString()} />);
        expect(screen.getByText('Today')).toBeTruthy();
    });

    it('renders null if no dueDate and not completed', () => {
        const { container } = render(<DueDateText />);
        expect(container.firstChild).toBeNull();
    });
});
