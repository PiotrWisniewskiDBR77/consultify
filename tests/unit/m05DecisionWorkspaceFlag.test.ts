/**
 * MW-06 — m05DecisionWorkspaceFlag: default ON for MVP (Codex review
 * acceptance), with an instant kill-switch via query/localStorage/env
 * overrides. Mirrors the same override-resolution test pattern as
 * tests/unit/mindmap/mindmapExportFlags.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isM05DecisionWorkspaceEnabled } from '../../src/utils/m05DecisionWorkspaceFlag';

const originalLocation = window.location;

function setSearch(search: string) {
  // jsdom's `history.replaceState` does not reliably update `window.location.search`
  // in this test environment, so stub `window.location` directly instead.
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...originalLocation, search },
  });
}

describe('isM05DecisionWorkspaceEnabled (REAL)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setSearch('');
  });

  afterEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('defaults to ON (DecisionWorkspace) with no query/localStorage/env override', () => {
    expect(isM05DecisionWorkspaceEnabled()).toBe(true);
  });

  it('explicit URL query "0" is an instant kill-switch back to OFF', () => {
    setSearch('?ff_m05DecisionWorkspace=0');
    expect(isM05DecisionWorkspaceEnabled()).toBe(false);
  });

  it('explicit URL query "off" is an instant kill-switch back to OFF', () => {
    setSearch('?ff_m05DecisionWorkspace=off');
    expect(isM05DecisionWorkspaceEnabled()).toBe(false);
  });

  it('explicit localStorage "false" overrides the ON default', () => {
    window.localStorage.setItem('ff.m05_decision_workspace', 'false');
    expect(isM05DecisionWorkspaceEnabled()).toBe(false);
  });

  it('URL query overrides a localStorage override', () => {
    window.localStorage.setItem('ff.m05_decision_workspace', 'false');
    setSearch('?ff_m05DecisionWorkspace=1');
    expect(isM05DecisionWorkspaceEnabled()).toBe(true);
  });
});
