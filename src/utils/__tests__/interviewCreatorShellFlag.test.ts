/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  INTERVIEW_CREATOR_SHELL_FLAG_KEYS as KEYS,
  isInterviewCreatorShellEnabled,
} from '../interviewCreatorShellFlag';

const ORIGINAL_LOCATION = window.location;

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...ORIGINAL_LOCATION, search },
  });
}

describe('isInterviewCreatorShellEnabled (DEC-2026-08-25-67)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  afterEach(() => {
    window.localStorage.clear();
    setLocationSearch('');
  });

  it('defaults to ON everywhere when no override exists (DEC 03.09 wieczór A4)', () => {
    expect(isInterviewCreatorShellEnabled()).toBe(true);
  });

  it('honours an explicit local override that disables it (awaryjny wyłącznik CLAUDE.md §8)', () => {
    window.localStorage.setItem(KEYS.localStorage, '0');
    expect(isInterviewCreatorShellEnabled()).toBe(false);
  });

  it('lets the URL override localStorage', () => {
    window.localStorage.setItem(KEYS.localStorage, '0');
    setLocationSearch(`?${KEYS.query}=1`);
    expect(isInterviewCreatorShellEnabled()).toBe(true);
  });

  it('falls through to the ON default for unknown values (no longer "fails closed" — the default itself is now ON)', () => {
    window.localStorage.setItem(KEYS.localStorage, 'unexpected');
    expect(isInterviewCreatorShellEnabled()).toBe(true);
  });

  it('keeps the three rollout keys stable', () => {
    expect(KEYS).toEqual({
      localStorage: 'ff.interview_creator_shell',
      query: 'ff_interviewCreatorShell',
      env: 'VITE_INTERVIEW_CREATOR_SHELL',
    });
  });
});
