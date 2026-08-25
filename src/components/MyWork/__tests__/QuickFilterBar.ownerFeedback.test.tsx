import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { QuickFilterBar } from '../QuickFilterBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

// MYW-PHOTO-006: zero-count filters previously rendered `disabled`, indistinguishable
// from a genuinely unavailable control. They must stay clickable and carry a distinct
// "available-zero" visual/state marker instead of being disabled.
describe('QuickFilterBar owner feedback (MYW-PHOTO-006)', () => {
  const counts = { overdue: 0, today: 3, week: 0, urgent: 0 };

  it('never disables a zero-count filter chip', () => {
    render(<QuickFilterBar activeFilter="all" onFilterChange={vi.fn()} counts={counts} />);

    const overdue = screen.getByRole('button', { name: /overdue/i });
    expect(overdue).not.toBeDisabled();
    expect(overdue).not.toHaveAttribute('disabled');
  });

  it('marks zero-count chips with a distinct available-zero state, not the active/available states', () => {
    render(<QuickFilterBar activeFilter="all" onFilterChange={vi.fn()} counts={counts} />);

    const overdue = screen.getByRole('button', { name: /overdue/i });
    const today = screen.getByRole('button', { name: /today/i });

    expect(overdue).toHaveAttribute('data-count-state', 'available-zero');
    expect(today).toHaveAttribute('data-count-state', 'available');
  });

  it('still invokes onFilterChange when a zero-count chip is clicked', () => {
    const onFilterChange = vi.fn();
    render(<QuickFilterBar activeFilter="all" onFilterChange={onFilterChange} counts={counts} />);

    fireEvent.click(screen.getByRole('button', { name: /overdue/i }));

    expect(onFilterChange).toHaveBeenCalledWith('overdue');
  });
});
