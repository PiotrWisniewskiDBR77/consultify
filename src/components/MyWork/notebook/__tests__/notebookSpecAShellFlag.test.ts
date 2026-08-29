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

  it('is fail-closed by default', () => {
    expect(ENABLE_NOTEBOOK_SPEC_A_SHELL).toBe(false);
    expect(isNotebookSpecAShellEnabled()).toBe(false);
  });

  it('allows an explicit screenshot-review local override', () => {
    window.localStorage.setItem('ff.ENABLE_NOTEBOOK_SPEC_A_SHELL', 'true');
    expect(isNotebookSpecAShellEnabled()).toBe(true);
  });

  it('fails closed for an invalid explicit local override', () => {
    window.localStorage.setItem('ff.ENABLE_NOTEBOOK_SPEC_A_SHELL', 'invalid');
    expect(isNotebookSpecAShellEnabled()).toBe(false);
  });
});
