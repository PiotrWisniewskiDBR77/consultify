/**
 * Chat V9 / ADMIN AG1 v1 — tests for the URL-triggered overlay.
 *
 * Coverage:
 *   - Returns null without the `?v9flags=1` query or the open event.
 *   - Opens on query (`?v9flags=1`, alias `=true`).
 *   - Closes on Escape and via the panel close button.
 *   - Backdrop click dismisses.
 *   - External `CustomEvent("chat-v9-flags:open"/"close")` wiring works.
 *   - Role gate: non-admins never see the overlay even with the query.
 *   - `isV9FlagsOverlayAuthorized` recognises SUPERADMIN/OWNER/ADMIN
 *     with mixed case and rejects USER / missing / empty roles.
 *
 * The existing activation tests pass `isAuthorized` explicitly so they
 * don't depend on the real app store — coupling those tests to the
 * store would retest Zustand, not the overlay.
 */

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { User } from '../../../types';
import { UserRole } from '../../../types/core';
import { ChatV9FlagsOverlay, isV9FlagsOverlayAuthorized } from '../ChatV9FlagsOverlay';

/**
 * `tests/setup.ts` replaces `window.location` with a plain object so
 * that `location.assign/replace/reload` can be stubbed cleanly. A side
 * effect of that replacement is that `history.replaceState(..., url)`
 * no longer updates `window.location.search` (the object is detached
 * from jsdom's live URL). The production code path reads
 * `window.location.search` directly, so tests must mutate the same
 * property the real readers see.
 */
function setQuery(search: string) {
  Object.defineProperty(window.location, 'search', {
    value: search,
    configurable: true,
    writable: true,
  });
}

/**
 * Render helper that always passes `isAuthorized` explicitly so the
 * overlay never depends on app-store state in tests. Flip the flag to
 * `false` to exercise the role gate.
 */
function renderOverlay(isAuthorized = true) {
  return render(<ChatV9FlagsOverlay isAuthorized={isAuthorized} />);
}

describe('ChatV9FlagsOverlay', () => {
  beforeEach(() => setQuery(''));
  afterEach(() => setQuery(''));

  it('renders null when inactive', () => {
    const { container } = renderOverlay();
    expect(container.firstChild).toBeNull();
  });

  it('opens when `?v9flags=1` is present on mount', () => {
    setQuery('?v9flags=1');
    renderOverlay();
    expect(screen.getByTestId('chat-v9-flags-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('chat-v9-flags-panel')).toBeInTheDocument();
  });

  it('accepts `?v9flags=true` as an alias', () => {
    setQuery('?v9flags=true');
    renderOverlay();
    expect(screen.getByTestId('chat-v9-flags-overlay')).toBeInTheDocument();
  });

  it('closes on Escape', () => {
    setQuery('?v9flags=1');
    renderOverlay();
    expect(screen.getByTestId('chat-v9-flags-overlay')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('chat-v9-flags-overlay')).not.toBeInTheDocument();
  });

  it('closes when the panel fires its close button', () => {
    setQuery('?v9flags=1');
    renderOverlay();
    fireEvent.click(screen.getByTestId('chat-v9-flags-close'));
    expect(screen.queryByTestId('chat-v9-flags-overlay')).not.toBeInTheDocument();
  });

  it('closes on backdrop click', () => {
    setQuery('?v9flags=1');
    renderOverlay();
    const overlay = screen.getByTestId('chat-v9-flags-overlay');
    fireEvent.click(overlay);
    expect(screen.queryByTestId('chat-v9-flags-overlay')).not.toBeInTheDocument();
  });

  it('opens when the external `chat-v9-flags:open` event fires', () => {
    renderOverlay();
    expect(screen.queryByTestId('chat-v9-flags-overlay')).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new CustomEvent('chat-v9-flags:open'));
    });
    expect(screen.getByTestId('chat-v9-flags-overlay')).toBeInTheDocument();
  });

  it('closes when the external `chat-v9-flags:close` event fires', () => {
    setQuery('?v9flags=1');
    renderOverlay();
    act(() => {
      window.dispatchEvent(new CustomEvent('chat-v9-flags:close'));
    });
    expect(screen.queryByTestId('chat-v9-flags-overlay')).not.toBeInTheDocument();
  });

  describe('role gate', () => {
    it('returns null for an unauthorised user even with `?v9flags=1`', () => {
      setQuery('?v9flags=1');
      const { container } = renderOverlay(false);
      expect(container.firstChild).toBeNull();
    });

    it('ignores the external open event for an unauthorised user', () => {
      const { container } = renderOverlay(false);
      act(() => {
        window.dispatchEvent(new CustomEvent('chat-v9-flags:open'));
      });
      expect(container.firstChild).toBeNull();
    });

    it('still renders the overlay when `isAuthorized` is true', () => {
      setQuery('?v9flags=1');
      renderOverlay(true);
      expect(screen.getByTestId('chat-v9-flags-overlay')).toBeInTheDocument();
    });
  });
});

describe('isV9FlagsOverlayAuthorized', () => {
  const userWith = (role: string | undefined | null): User =>
    ({
      id: 'u1',
      email: 't@t.io',
      name: 't',
      role: role as unknown as string,
      isAuthenticated: true,
    }) as unknown as User;

  it.each([
    [UserRole.SUPERADMIN, true],
    [UserRole.OWNER, true],
    [UserRole.ADMIN, true],
    [UserRole.USER, false],
    [UserRole.MANAGER, false],
    [UserRole.VIEWER, false],
  ])('role "%s" → %s', (role, expected) => {
    expect(isV9FlagsOverlayAuthorized(userWith(role))).toBe(expected);
  });

  it('normalises mixed-case roles ("Admin", "owner")', () => {
    expect(isV9FlagsOverlayAuthorized(userWith('Admin'))).toBe(true);
    expect(isV9FlagsOverlayAuthorized(userWith('owner'))).toBe(true);
    expect(isV9FlagsOverlayAuthorized(userWith('  SuperAdmin  '))).toBe(true);
  });

  it('rejects null / undefined / missing role', () => {
    expect(isV9FlagsOverlayAuthorized(null)).toBe(false);
    expect(isV9FlagsOverlayAuthorized(undefined)).toBe(false);
    expect(isV9FlagsOverlayAuthorized(userWith(undefined))).toBe(false);
    expect(isV9FlagsOverlayAuthorized(userWith(null))).toBe(false);
    expect(isV9FlagsOverlayAuthorized(userWith(''))).toBe(false);
  });
});
