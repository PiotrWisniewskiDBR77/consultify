import { afterEach, describe, expect, it } from 'vitest';

import {
  ENABLE_NOTEBOOK_SPEC_A_SHELL,
  isNotebookSpecAShellEnabled,
} from '../notebookSpecAShellFlag';

describe('ENABLE_NOTEBOOK_SPEC_A_SHELL', () => {
  afterEach(() => {
    window.history.replaceState({}, '', '/');
    window.localStorage.clear();
  });

  it('is ON by default (DEC 03.09 wieczór R-11, MYW-NBK-CORE-001 — 8/8 zrzutów zaliczone)', () => {
    expect(ENABLE_NOTEBOOK_SPEC_A_SHELL).toBe(true);
    expect(isNotebookSpecAShellEnabled()).toBe(true);
  });

  it('allows an explicit local override to disable it (awaryjny wyłącznik CLAUDE.md §8)', () => {
    window.localStorage.setItem('ff.ENABLE_NOTEBOOK_SPEC_A_SHELL', 'false');
    expect(isNotebookSpecAShellEnabled()).toBe(false);
  });

  it('falls through to the ON default for an invalid explicit local override', () => {
    window.localStorage.setItem('ff.ENABLE_NOTEBOOK_SPEC_A_SHELL', 'invalid');
    expect(isNotebookSpecAShellEnabled()).toBe(true);
  });
});
