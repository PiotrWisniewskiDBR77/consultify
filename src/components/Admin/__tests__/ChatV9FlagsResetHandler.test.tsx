/**
 * Chat V9 / ADMIN AG1 v1.3 — tests for the URL reset one-liner
 * handler.
 *
 * Coverage:
 *   - Happy path: authorised user + `?v9flags=reset` → reset fires,
 *     URL is rewritten to `?v9flags=1`, open event is dispatched.
 *   - Non-admin: reset is NOT called, URL is still cleaned.
 *   - Flag OFF: handler is a no-op (URL untouched, no reset).
 *   - Wrong query value (`?v9flags=1`, absent, random): no reset.
 *   - Reset runs exactly once per mount even if the component
 *     re-renders.
 *   - Thrown reset errors do not crash the handler and the URL
 *     still gets rewritten.
 *   - Preserves other query params when rewriting / stripping.
 */

import { render } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatV9FlagsResetHandler } from '../ChatV9FlagsResetHandler';

type AppStoreState = {
  currentUser?: unknown;
};

let mockAppState: AppStoreState = {};

vi.mock('../../../store/useAppStore', () => ({
  useAppStore: (selector: (state: AppStoreState) => unknown) => selector(mockAppState),
}));

const resetAllMock = vi.fn();
vi.mock('../../../utils/chatV9FeatureFlags', async () => {
  const actual = await vi.importActual<typeof import('../../../utils/chatV9FeatureFlags')>(
    '../../../utils/chatV9FeatureFlags'
  );
  return {
    ...actual,
    resetAllChatV9FlagOverrides: (...args: unknown[]) => resetAllMock(...args),
  };
});

function setQuery(search: string): void {
  // Tests setup replaces `window.location` with a plain object; make
  // `search` directly assignable so `new URLSearchParams(...)` reads
  // the latest value on each tick.
  Object.defineProperty(window.location, 'search', {
    configurable: true,
    writable: true,
    value: search,
  });
  Object.defineProperty(window.location, 'pathname', {
    configurable: true,
    writable: true,
    value: '/some/route',
  });
  Object.defineProperty(window.location, 'hash', {
    configurable: true,
    writable: true,
    value: '',
  });
}

describe('ChatV9FlagsResetHandler', () => {
  const replaceStateSpy = vi.fn();

  beforeEach(() => {
    resetAllMock.mockReset();
    replaceStateSpy.mockReset();
    mockAppState = {};

    // Install a spy that mutates `window.location.search` in sync
    // with the replaceState call so subsequent reads see the
    // rewritten URL — matches the real browser contract.
    window.history.replaceState = ((
      _state: unknown,
      _unused: string,
      url?: string | URL | null
    ) => {
      replaceStateSpy(_state, _unused, url);
      if (typeof url === 'string') {
        const qIdx = url.indexOf('?');
        const hashIdx = url.indexOf('#');
        const search = qIdx === -1 ? '' : url.slice(qIdx, hashIdx === -1 ? undefined : hashIdx);
        setQuery(search);
      }
    }) as typeof window.history.replaceState;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('happy path: authorised admin with ?v9flags=reset → reset + URL rewrite + open event', () => {
    setQuery('?v9flags=reset');
    mockAppState = { currentUser: { role: 'ADMIN' } };

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    render(<ChatV9FlagsResetHandler />);

    expect(resetAllMock).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalled();
    const rewrittenUrl = replaceStateSpy.mock.calls.at(-1)?.[2];
    expect(rewrittenUrl).toContain('v9flags=1');
    expect(rewrittenUrl).not.toContain('v9flags=reset');

    const openDispatched = dispatchSpy.mock.calls.some(
      ([event]) => event instanceof Event && event.type === 'chat-v9-flags:open'
    );
    expect(openDispatched).toBe(true);
  });

  it('non-admin: reset NOT called, URL still cleaned so query does not persist', () => {
    setQuery('?v9flags=reset');
    mockAppState = { currentUser: { role: 'USER' } };

    render(<ChatV9FlagsResetHandler />);

    expect(resetAllMock).not.toHaveBeenCalled();
    expect(replaceStateSpy).toHaveBeenCalled();
    const rewrittenUrl = replaceStateSpy.mock.calls.at(-1)?.[2];
    expect(rewrittenUrl).not.toContain('v9flags=reset');
    expect(rewrittenUrl).not.toContain('v9flags=1');
  });

  it('flag OFF: handler is a no-op (no reset, URL untouched)', () => {
    setQuery('?v9flags=reset');
    mockAppState = { currentUser: { role: 'SUPERADMIN' } };

    render(<ChatV9FlagsResetHandler isEnabled={() => false} />);

    expect(resetAllMock).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('no reset when ?v9flags=1 (overlay open, not a reset request)', () => {
    setQuery('?v9flags=1');
    mockAppState = { currentUser: { role: 'OWNER' } };

    render(<ChatV9FlagsResetHandler />);

    expect(resetAllMock).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('no reset when the query is absent entirely', () => {
    setQuery('');
    mockAppState = { currentUser: { role: 'ADMIN' } };

    render(<ChatV9FlagsResetHandler />);

    expect(resetAllMock).not.toHaveBeenCalled();
    expect(replaceStateSpy).not.toHaveBeenCalled();
  });

  it('runs exactly once even if the component re-renders', () => {
    setQuery('?v9flags=reset');
    mockAppState = { currentUser: { role: 'ADMIN' } };

    const { rerender } = render(<ChatV9FlagsResetHandler />);
    rerender(<ChatV9FlagsResetHandler />);
    rerender(<ChatV9FlagsResetHandler />);

    expect(resetAllMock).toHaveBeenCalledTimes(1);
  });

  it('swallows a thrown reset error and still rewrites the URL', () => {
    setQuery('?v9flags=reset');
    mockAppState = { currentUser: { role: 'ADMIN' } };
    const performReset = vi.fn(() => {
      throw new Error('simulated ls quota exceeded');
    });

    expect(() => render(<ChatV9FlagsResetHandler performReset={performReset} />)).not.toThrow();
    expect(performReset).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalled();
    const rewrittenUrl = replaceStateSpy.mock.calls.at(-1)?.[2];
    expect(rewrittenUrl).toContain('v9flags=1');
  });

  it('preserves other query params when rewriting (authorised path)', () => {
    setQuery('?utm_source=ops&v9flags=reset&lang=pl');
    mockAppState = { currentUser: { role: 'ADMIN' } };

    render(<ChatV9FlagsResetHandler />);

    const rewrittenUrl: string = replaceStateSpy.mock.calls.at(-1)?.[2] as string;
    expect(rewrittenUrl).toContain('utm_source=ops');
    expect(rewrittenUrl).toContain('lang=pl');
    expect(rewrittenUrl).toContain('v9flags=1');
    expect(rewrittenUrl).not.toContain('v9flags=reset');
  });

  it('preserves other query params when stripping (unauthorised path)', () => {
    setQuery('?utm_source=ops&v9flags=reset&lang=pl');
    mockAppState = { currentUser: { role: 'USER' } };

    render(<ChatV9FlagsResetHandler />);

    const rewrittenUrl: string = replaceStateSpy.mock.calls.at(-1)?.[2] as string;
    expect(rewrittenUrl).toContain('utm_source=ops');
    expect(rewrittenUrl).toContain('lang=pl');
    expect(rewrittenUrl).not.toContain('v9flags');
  });

  it('renders nothing (headless)', () => {
    setQuery('');
    mockAppState = { currentUser: { role: 'ADMIN' } };

    const { container } = render(<ChatV9FlagsResetHandler />);
    expect(container.firstChild).toBeNull();
  });

  it('treats `RESET` (upper-case) as a reset request (case-insensitive match)', () => {
    setQuery('?v9flags=RESET');
    mockAppState = { currentUser: { role: 'ADMIN' } };

    render(<ChatV9FlagsResetHandler />);

    expect(resetAllMock).toHaveBeenCalledTimes(1);
  });
});
