/**
 * @vitest-environment jsdom
 *
 * Golden-path accessibility (Harvard #108).
 *
 * Covers the two most important clickable-card components on the
 * Chat -> Ideas -> Initiatives -> Outputs golden path:
 *   - InitiativeCard          (src/components/InitiativeCard.tsx)
 *   - InitiativeGridCard      (src/components/Portfolio/InitiativeGridCard.tsx)
 *
 * Both were `<div onClick>` with no keyboard affordance. These assertions lock
 * in the fix: role="button" + tabIndex + Enter/Space activation + aria-label.
 * No axe dependency is available in this repo, so we assert roles/aria manually.
 */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mimic the app's t(): return the interpolated default string so aria-labels
// are human-readable in assertions (key, defaultValue, options) => defaultValue.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, defaultValue?: string, opts?: Record<string, unknown>) => {
      let out = defaultValue ?? _key;
      if (opts) {
        for (const [k, v] of Object.entries(opts)) {
          out = out.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v));
        }
      }
      return out;
    },
    i18n: { language: 'en' },
  }),
}));

import { InitiativeCard } from '../../../src/components/InitiativeCard';
import { InitiativeGridCard } from '../../../src/components/Portfolio/InitiativeGridCard';
import { InitiativeStatus } from '../../../src/types';

describe('InitiativeCard — golden-path a11y', () => {
  const onClick = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  const initiative = {
    id: 'init-1',
    name: 'Automate invoicing',
    status: InitiativeStatus.DRAFT,
  } as any;

  it('exposes the card as a keyboard-focusable button with an accessible name', () => {
    render(<InitiativeCard initiative={initiative} onClick={onClick} />);

    const card = screen.getByRole('button', { name: /Open initiative: Automate invoicing/i });
    expect(card).toBeTruthy();
    expect(card.getAttribute('tabindex')).toBe('0');
  });

  it('activates on Enter and Space (not only mouse click)', () => {
    render(<InitiativeCard initiative={initiative} onClick={onClick} />);
    const card = screen.getByRole('button', { name: /Open initiative/i });

    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onClick).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(card, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);

    // A non-activating key must not fire.
    fireEvent.keyDown(card, { key: 'Tab' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('labels the icon-only quick-action buttons', () => {
    render(
      <InitiativeCard
        initiative={initiative}
        onClick={onClick}
        onQuickAdvance={vi.fn()}
        onQuickAssign={vi.fn()}
        onQuickFlag={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Advance to next status' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Assign owners' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Flag for attention' })).toBeTruthy();
  });
});

describe('InitiativeGridCard — golden-path a11y', () => {
  const onClick = vi.fn();

  beforeEach(() => vi.clearAllMocks());

  const initiative = {
    id: 'grid-1',
    name: 'Consolidate vendors',
    status: InitiativeStatus.DRAFT,
    priority: 'medium',
  } as any;

  it('exposes the grid card as a keyboard-focusable button with an accessible name', () => {
    render(<InitiativeGridCard initiative={initiative} onClick={onClick} />);

    const card = screen.getByRole('button', { name: /Open initiative: Consolidate vendors/i });
    expect(card).toBeTruthy();
    expect(card.getAttribute('tabindex')).toBe('0');
  });

  it('activates on Enter and Space', () => {
    render(<InitiativeGridCard initiative={initiative} onClick={onClick} />);
    const card = screen.getByRole('button', { name: /Open initiative/i });

    fireEvent.keyDown(card, { key: 'Enter' });
    fireEvent.keyDown(card, { key: ' ' });
    expect(onClick).toHaveBeenCalledTimes(2);
  });
});
