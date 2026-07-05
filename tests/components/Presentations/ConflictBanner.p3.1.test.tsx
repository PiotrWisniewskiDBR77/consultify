/**
 * P3.1 — ConflictBanner (deck collaboration conflict resolution).
 *
 * When autosave gets a 409 VERSION_CONFLICT (a collaborator saved the deck),
 * DeckBuilder now shows this banner instead of silently overwriting local
 * edits. This suite proves the banner renders a clear message and wires both
 * resolution choices:
 *   1. "Reload latest" → onReload
 *   2. "Keep my version" → onKeepMine
 *   3. Shows the server version when known.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string, opts?: Record<string, unknown>) => {
      if (fallback && opts && typeof opts.version !== 'undefined') {
        return fallback.replace('{{version}}', String(opts.version));
      }
      return fallback ?? _key;
    },
  }),
}));

import { ConflictBanner } from '../../../src/components/Presentations/DeckBuilder/ConflictBanner';

describe('ConflictBanner (P3.1)', () => {
  it('renders an alert with a visible conflict message and both actions', () => {
    render(<ConflictBanner serverVersion={7} onReload={vi.fn()} onKeepMine={vi.fn()} />);
    const banner = screen.getByTestId('deck-conflict-banner');
    expect(banner).toHaveAttribute('role', 'alert');
    expect(banner.textContent).toMatch(/changed in another session/i);
    expect(banner.textContent).toContain('v7');
    expect(screen.getByTestId('deck-conflict-reload')).toBeInTheDocument();
    expect(screen.getByTestId('deck-conflict-keep-mine')).toBeInTheDocument();
  });

  it('fires onReload when "Reload latest" is clicked', async () => {
    const onReload = vi.fn();
    const user = userEvent.setup();
    render(<ConflictBanner serverVersion={2} onReload={onReload} onKeepMine={vi.fn()} />);
    await user.click(screen.getByTestId('deck-conflict-reload'));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('fires onKeepMine when "Keep my version" is clicked', async () => {
    const onKeepMine = vi.fn();
    const user = userEvent.setup();
    render(<ConflictBanner serverVersion={null} onReload={vi.fn()} onKeepMine={onKeepMine} />);
    await user.click(screen.getByTestId('deck-conflict-keep-mine'));
    expect(onKeepMine).toHaveBeenCalledTimes(1);
  });
});
