/**
 * MYW-PHOTO-006 (P2) — zero-count quick filters must read as "available,
 * currently nothing matches", not as disabled/broken controls.
 *
 * Before this fix, `QuickFilterBar` set `disabled` plus
 * `cursor-not-allowed opacity-50` on any non-`all` filter whose count was 0
 * — visually identical to a genuinely locked control, and the click handler
 * never fired for it. This regression test locks in: the button stays
 * enabled and clickable, it renders its zero count instead of hiding it, and
 * it does not carry the disabled-looking classes.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { QuickFilterBar } from '../QuickFilterBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

describe('QuickFilterBar — available-zero vs disabled', () => {
  it('keeps a zero-count filter enabled and clickable', () => {
    const onFilterChange = vi.fn();
    render(
      <QuickFilterBar
        activeFilter="all"
        onFilterChange={onFilterChange}
        counts={{ overdue: 0, today: 3, week: 5, urgent: 0 }}
      />
    );

    const overdueButton = screen.getByRole('button', { name: /Overdue/i });
    expect(overdueButton).not.toBeDisabled();
    expect(overdueButton.className).not.toContain('cursor-not-allowed');
    expect(overdueButton.className).not.toContain('opacity-50');

    fireEvent.click(overdueButton);
    expect(onFilterChange).toHaveBeenCalledWith('overdue');
  });

  it('renders the zero count instead of hiding it', () => {
    render(
      <QuickFilterBar
        activeFilter="all"
        onFilterChange={vi.fn()}
        counts={{ overdue: 0, today: 3, week: 5, urgent: 0 }}
      />
    );

    const overdueButton = screen.getByRole('button', { name: /Overdue/i });
    expect(overdueButton).toHaveTextContent('0');
  });

  it('gives available-zero a distinct look from a non-zero available filter', () => {
    render(
      <QuickFilterBar
        activeFilter="all"
        onFilterChange={vi.fn()}
        counts={{ overdue: 0, today: 3, week: 5, urgent: 0 }}
      />
    );

    const overdueButton = screen.getByRole('button', { name: /Overdue/i });
    const todayButton = screen.getByRole('button', { name: /Today/i });
    expect(overdueButton.className).not.toEqual(todayButton.className);
  });
});
