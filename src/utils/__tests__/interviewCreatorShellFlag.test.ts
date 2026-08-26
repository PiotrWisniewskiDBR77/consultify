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

  it('defaults to OFF everywhere when no override exists', () => {
    expect(isInterviewCreatorShellEnabled()).toBe(false);
  });

  it('honours the explicit local preview override', () => {
    window.localStorage.setItem(KEYS.localStorage, '1');
    expect(isInterviewCreatorShellEnabled()).toBe(true);
  });

  it('lets the URL override localStorage', () => {
    window.localStorage.setItem(KEYS.localStorage, '1');
    setLocationSearch(`?${KEYS.query}=0`);
    expect(isInterviewCreatorShellEnabled()).toBe(false);
  });

  it('fails closed for unknown values', () => {
    window.localStorage.setItem(KEYS.localStorage, 'unexpected');
    expect(isInterviewCreatorShellEnabled()).toBe(false);
  });

  it('keeps the three rollout keys stable', () => {
    expect(KEYS).toEqual({
      localStorage: 'ff.interview_creator_shell',
      query: 'ff_interviewCreatorShell',
      env: 'VITE_INTERVIEW_CREATOR_SHELL',
    });
  });
});
