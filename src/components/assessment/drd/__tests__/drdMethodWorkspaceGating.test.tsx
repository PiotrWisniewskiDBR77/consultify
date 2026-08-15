/**
 * @vitest-environment jsdom
 *
 * Canonical cutover gate and explicit rollback coverage.
 *
 * `AssessmentSessionEditorView` is a 2700+ line view wired to a live store
 * and several API modules — mounting it in a unit test would require
 * mocking most of that surface and would mostly test the mocks. Instead:
 *
 *  1. `shouldMountDrdCanonicalWorkspace` is the EXACT boolean the view's real
 *     early-return branches on (see AssessmentSessionEditorView.tsx) —
 *     tested directly, exhaustively.
 *  2. `DrdMethodWorkspaceScreen` (what that branch renders when true) is
 *     mounted directly here and asserted to render the REAL
 *     `MethodWorkspaceShell` (data-testid="method-workspace-shell"), proving
 *     the ON path genuinely reaches A5's shell, not a stand-in.
 *
 * The OFF path's "legacy editor untouched" claim is a structural one: the
 * early return sits BEFORE `renderEditor()`/`DRDForm`/`DRDAssessmentEditor`/
 * `DRDMatrixSession` are ever referenced (see the view's source) — when the
 * gate is false, none of this file's code runs at all.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import {
  isDrdCanonicalHttpWorkspaceBuildEnabled,
  shouldMountDrdCanonicalWorkspace,
} from '../drdCanonicalCutover';
import { DrdMethodWorkspaceScreen } from '../DrdMethodWorkspaceScreen';

function makeMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

describe('shouldMountDrdCanonicalWorkspace — build cutover gate', () => {
  it('mounts canonical DRD by default', () => {
    expect(shouldMountDrdCanonicalWorkspace('drd')).toBe(true);
  });

  it('false when the build rollback is explicit, even for drd', () => {
    expect(shouldMountDrdCanonicalWorkspace('drd', false)).toBe(false);
    expect(isDrdCanonicalHttpWorkspaceBuildEnabled('false')).toBe(false);
    expect(isDrdCanonicalHttpWorkspaceBuildEnabled(undefined)).toBe(true);
  });

  it('false for every other framework — this slice is DRD-only', () => {
    expect(shouldMountDrdCanonicalWorkspace('siri', true)).toBe(false);
    expect(shouldMountDrdCanonicalWorkspace('adma', true)).toBe(false);
    expect(shouldMountDrdCanonicalWorkspace('cmmi', true)).toBe(false);
    expect(shouldMountDrdCanonicalWorkspace('lean', true)).toBe(false);
    expect(shouldMountDrdCanonicalWorkspace(undefined, true)).toBe(false);
  });
});

describe('DrdMethodWorkspaceScreen (the ON-path render target) mounts the REAL MethodWorkspaceShell', () => {
  it('renders data-testid="method-workspace-shell" — not a stand-in, the actual A5 component', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" forceHttpSourceOfTruth={false} />);
    expect(screen.getByTestId('method-workspace-shell')).toBeInTheDocument();
  });

  it('shows the explicit demo-bypass banner (never a silent override of pack readiness)', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" forceHttpSourceOfTruth={false} />);
    expect(screen.getByText(/SESJA DEMONSTRACYJNA/i)).toBeInTheDocument();
  });
});
