/**
 * @vitest-environment jsdom
 *
 * ★ Gate E FIXA — DEFEKT 3: `EmptyStateInline`'s action link used the `primary`
 * color token (shade 500 / hover shade 600) — `primary` in this repo's
 * Tailwind config IS crimson (`#85182F`), reserved EXCLUSIVELY for critical
 * semantics (CLAUDE.md: "primary w tailwind = crimson — zakazany jako kolor
 * UI"). Using it for a plain navigation/CTA link (e.g. "Wróć do listy" on
 * every one of the ID-bridge's 14 screenshotted empty-state screens) misuses
 * the repo's one reserved-for-danger color for routine chrome. The link also
 * had a HARD-CODED "+ " prefix, correct for creation CTAs ("+ Nowy") but
 * wrong for back-navigation/retry ("+ Wróć do listy" reads as "create a new
 * back-to-list", which makes no sense).
 *
 * This component is shared across ~26 files well outside Finance (MyWork,
 * Initiatives, Interview, docs, ...). Per the FIXA brief: the crimson→neutral
 * color swap is a pure CSS-class change with NO signature/behavior change,
 * consistent with CLAUDE.md's repo-wide canon — safe everywhere. The "+"
 * prefix, however, required a signature change; it was made OPT-OUT via a
 * new `action.showPrefix` field defaulting to `true` (today's always-on
 * behavior), which is additive and changes nothing for any of the ~26
 * existing call sites that don't pass it.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmptyStateInline } from '../EmptyStateInline';

describe('EmptyStateInline — honest neutral color + optional "+" prefix (Gate E FIXA, defekt 3)', () => {
  it('action link does NOT use the crimson `primary` token, and uses the repo-wide neutral action-link token', () => {
    render(<EmptyStateInline message="Brak danych." action={{ label: 'Wróć do listy', onClick: vi.fn() }} />);
    const button = screen.getByRole('button', { name: /Wróć do listy/i });
    expect(button.className).not.toMatch(/text-primary-\d/);
    expect(button.className).toMatch(/text-c-focus-solid/);
  });

  it('default behavior (no `showPrefix`) still prepends "+ " — every existing caller keeps its current look', () => {
    render(<EmptyStateInline message="Brak elementów." action={{ label: 'Nowy element', onClick: vi.fn() }} />);
    expect(screen.getByRole('button', { name: '+ Nowy element' })).toBeInTheDocument();
  });

  it('`showPrefix: false` renders the label WITHOUT the "+ " prefix — for back-navigation/retry actions', () => {
    render(<EmptyStateInline message="Nie można otworzyć." action={{ label: 'Wróć do listy', onClick: vi.fn(), showPrefix: false }} />);
    expect(screen.getByRole('button', { name: 'Wróć do listy' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+ Wróć do listy' })).not.toBeInTheDocument();
  });

  it('KONTROLA NEGATYWNA (dokumentacyjna): `showPrefix: true` explicit renders the same as default (prefix present)', () => {
    render(<EmptyStateInline message="Brak elementów." action={{ label: 'Nowy element', onClick: vi.fn(), showPrefix: true }} />);
    expect(screen.getByRole('button', { name: '+ Nowy element' })).toBeInTheDocument();
  });
});
