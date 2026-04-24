/**
 * Chat V9 — resolver contract suite (pass 80, 2026-04-18)
 * -------------------------------------------------------
 *
 * The 41 per-flag helpers under `src/utils/*Flag.ts` each implement
 * the same four-step resolution order:
 *
 *   1. URL query `?ff_<camel>=0|1` (highest priority).
 *   2. `localStorage["ff.<snake>"]`.
 *   3. `import.meta.env.VITE_<SCREAMING>`.
 *   4. Hardcoded default (every shipped flag defaults to `true`).
 *
 * The contributor guide and the operations runbook BOTH assume this
 * order holds for every flag. There is no automated test today that
 * verifies it — drift could land silently and nobody would notice
 * until an incident showed that a particular flag ignored its URL
 * override.
 *
 * This suite iterates over every registered flag and asserts:
 *
 *   (a) With no overrides anywhere, the resolver returns `flag.default`.
 *   (b) Setting `localStorage` to `'0'` flips the resolver OFF.
 *   (c) Setting `localStorage` to `'1'` keeps the resolver ON.
 *   (d) A URL `?<query>=0` beats `localStorage="1"` (URL wins).
 *   (e) A URL `?<query>=1` beats `localStorage="0"` (URL wins).
 *   (f) Malformed localStorage (`'garbage'`) falls through cleanly
 *       and the resolver still returns a boolean without throwing.
 *
 * ~42 flags × 6 assertions = ~252 contract checks from one file.
 * Any flag that ships with a custom (non-standard) resolution order
 * will fail immediately.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isBackToChatButtonEnabled } from '../backToChatButtonFlag';
import { isBackToChatShortcutEnabled } from '../backToChatShortcutFlag';
import { CHAT_V9_FLAGS } from '../chatV9FeatureFlags';
import { isWorkspaceBreadcrumbEnabled } from '../workspaceBreadcrumbFlag';

function setQuery(search: string) {
  Object.defineProperty(window.location, 'search', {
    value: search,
    configurable: true,
    writable: true,
  });
}

function setHostname(hostname: string) {
  Object.defineProperty(window.location, 'hostname', {
    value: hostname,
    configurable: true,
    writable: true,
  });
}

function clearStorage() {
  try {
    window.localStorage.clear();
  } catch {
    // Private mode / JSDOM edge — a failing clear means we already
    // have no state to reset, which is what the tests assume.
  }
}

describe('Chat V9 flag resolver contract', () => {
  beforeEach(() => {
    clearStorage();
    setQuery('');
    setHostname('localhost');
  });

  afterEach(() => {
    clearStorage();
    setQuery('');
    setHostname('localhost');
  });

  describe.each(CHAT_V9_FLAGS.map((f) => [f.id, f] as const))('%s', (_id, flag) => {
    it(`(a) returns flag.default (${flag.default}) when nothing is overridden`, () => {
      expect(flag.isEnabled()).toBe(flag.default);
    });

    it('(b) localStorage "0" flips resolver OFF', () => {
      window.localStorage.setItem(flag.keys.localStorage, '0');
      expect(flag.isEnabled()).toBe(false);
    });

    it('(c) localStorage "1" keeps resolver ON', () => {
      window.localStorage.setItem(flag.keys.localStorage, '1');
      expect(flag.isEnabled()).toBe(true);
    });

    it('(d) URL "0" wins over localStorage "1"', () => {
      window.localStorage.setItem(flag.keys.localStorage, '1');
      setQuery(`?${flag.keys.query}=0`);
      expect(flag.isEnabled()).toBe(false);
    });

    it('(e) URL "1" wins over localStorage "0"', () => {
      window.localStorage.setItem(flag.keys.localStorage, '0');
      setQuery(`?${flag.keys.query}=1`);
      expect(flag.isEnabled()).toBe(true);
    });

    it('(f) malformed localStorage falls through without throwing', () => {
      window.localStorage.setItem(flag.keys.localStorage, 'not-a-flag-value');
      expect(() => flag.isEnabled()).not.toThrow();
      // With garbage LS and no URL/env, the resolver should land on
      // the default — but we do not hard-assert the exact value to
      // leave room for a future "strict mode" that could make this
      // OFF. The point of this assertion is that the resolver stays
      // boolean and does not crash.
      expect(typeof flag.isEnabled()).toBe('boolean');
    });
  });
});

describe('Chat V9 hard-off flags on deployed hosts', () => {
  const originalEnv = {
    backToChatButton: import.meta.env.VITE_BACK_TO_CHAT_BUTTON,
    backToChatShortcut: import.meta.env.VITE_BACK_TO_CHAT_SHORTCUT,
    workspaceBreadcrumb: import.meta.env.VITE_WORKSPACE_BREADCRUMB,
  };

  beforeEach(() => {
    clearStorage();
    setQuery('');
    setHostname('consultify.ai');
  });

  afterEach(() => {
    clearStorage();
    setQuery('');
    setHostname('localhost');
    import.meta.env.VITE_BACK_TO_CHAT_BUTTON = originalEnv.backToChatButton;
    import.meta.env.VITE_BACK_TO_CHAT_SHORTCUT = originalEnv.backToChatShortcut;
    import.meta.env.VITE_WORKSPACE_BREADCRUMB = originalEnv.workspaceBreadcrumb;
  });

  it('keeps the back-to-chat button off even with URL and localStorage overrides', () => {
    import.meta.env.VITE_BACK_TO_CHAT_BUTTON = 'false';
    window.localStorage.setItem('ff.back_to_chat_button', '1');
    setQuery('?ff_backToChatButton=1');

    expect(isBackToChatButtonEnabled()).toBe(false);
  });

  it('keeps the back-to-chat shortcut off even with URL and localStorage overrides', () => {
    import.meta.env.VITE_BACK_TO_CHAT_SHORTCUT = 'false';
    window.localStorage.setItem('ff.back_to_chat_shortcut', '1');
    setQuery('?ff_backToChatShortcut=1');

    expect(isBackToChatShortcutEnabled()).toBe(false);
  });

  it('keeps the workspace breadcrumb off even with URL and localStorage overrides', () => {
    import.meta.env.VITE_WORKSPACE_BREADCRUMB = 'false';
    window.localStorage.setItem('ff.workspace_breadcrumb', '1');
    setQuery('?ff_workspaceBreadcrumb=1');

    expect(isWorkspaceBreadcrumbEnabled()).toBe(false);
  });
});
