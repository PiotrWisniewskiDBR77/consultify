import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuickFilterBar } from '@/components/MyWork/QuickFilterBar';

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue: string) => defaultValue,
  }),
}));

describe('QuickFilterBar', () => {
  const mockOnFilterChange = vi.fn();
  const mockCounts = { overdue: 3, today: 1, week: 5, urgent: 2 };

  it('renders correctly when visible', () => {
    render(
      <QuickFilterBar
        activeFilter="all"
        onFilterChange={mockOnFilterChange}
        counts={mockCounts}
        visible={true}
      />
    );

    expect(screen.getByText('Show:')).toBeTruthy();
    expect(screen.getByText('All')).toBeTruthy();
    expect(screen.getByText('Overdue')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('Today')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('This Week')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('Urgent')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('returns null when not visible', () => {
    const { container } = render(
      <QuickFilterBar
        activeFilter="all"
        onFilterChange={mockOnFilterChange}
        counts={mockCounts}
        visible={false}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('calls onFilterChange when a filter chip is clicked', () => {
    render(
      <QuickFilterBar
        activeFilter="all"
        onFilterChange={mockOnFilterChange}
        counts={mockCounts}
        visible={true}
      />
    );

    fireEvent.click(screen.getByText('Overdue'));
    expect(mockOnFilterChange).toHaveBeenCalledWith('overdue');
  });

  it('keeps zero-count filter chips available and marks their count state', () => {
    const zeroCounts = { overdue: 0, today: 0, week: 0, urgent: 0 };
    render(
      <QuickFilterBar
        activeFilter="all"
        onFilterChange={mockOnFilterChange}
        counts={zeroCounts}
        visible={true}
      />
    );

    const overdueBtn = screen.getByText('Overdue').closest('button');
    expect(overdueBtn?.disabled).toBe(false);
    expect(overdueBtn).toHaveAttribute('data-count-state', 'available-zero');

    const allBtn = screen.getByText('All').closest('button');
    expect(allBtn?.disabled).toBe(false);
  });

  it('highlights the active filter', () => {
    render(
      <QuickFilterBar
        activeFilter="today"
        onFilterChange={mockOnFilterChange}
        counts={mockCounts}
        visible={true}
      />
    );

    const todayBtn = screen.getByText('Today').closest('button');
    expect(todayBtn?.className).toContain('bg-slate-700');
  });
});
