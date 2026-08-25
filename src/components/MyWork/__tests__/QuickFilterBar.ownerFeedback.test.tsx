/**
 * MYW-PHOTO-006 (P2) — zero-count quick filters must read as "available,
 * currently nothing matches", not as disabled/broken controls.
 *
 * Before this fix, `QuickFilterBar` set `disabled` plus
 * `cursor-not-allowed opacity-50` on any non-`all` filter whose count was 0
 * — visually identical to a genuinely locked control, and the click handler
 * never fired for it, and the count badge was hidden entirely. This
 * regression test locks in: the button stays enabled and clickable, it
 * renders its zero count instead of hiding it, it carries a distinct
 * `data-count-state="available-zero"` marker instead of the disabled-looking
 * classes, and it's visually distinguishable from a non-zero filter chip.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { QuickFilterBar } from '../QuickFilterBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
    i18n: { language: 'en' },
  }),
}));

describe('QuickFilterBar owner feedback (MYW-PHOTO-006)', () => {
  const counts = { overdue: 0, today: 3, week: 0, urgent: 0 };

  it('never disables a zero-count filter chip', () => {
    render(<QuickFilterBar activeFilter="all" onFilterChange={vi.fn()} counts={counts} />);

    const overdue = screen.getByRole('button', { name: /overdue/i });
    expect(overdue).not.toBeDisabled();
    expect(overdue).not.toHaveAttribute('disabled');
    expect(overdue.className).not.toContain('cursor-not-allowed');
    expect(overdue.className).not.toContain('opacity-50');
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

  it('renders the zero count instead of hiding it', () => {
    render(<QuickFilterBar activeFilter="all" onFilterChange={vi.fn()} counts={counts} />);

    const overdue = screen.getByRole('button', { name: /overdue/i });
    expect(overdue).toHaveTextContent('0');
  });

  it('gives available-zero a distinct look from a non-zero available filter', () => {
    render(<QuickFilterBar activeFilter="all" onFilterChange={vi.fn()} counts={counts} />);

    const overdue = screen.getByRole('button', { name: /overdue/i });
    const today = screen.getByRole('button', { name: /today/i });
    expect(overdue.className).not.toEqual(today.className);
  });
});
