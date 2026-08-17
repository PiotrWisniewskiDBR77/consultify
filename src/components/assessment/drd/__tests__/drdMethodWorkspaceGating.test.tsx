/**
 * @vitest-environment jsdom
 *
 * A6 vertical slice — checkpoint test requirement 1: "flaga OFF -> stara
 * ścieżka bez zmian; flaga ON -> MethodWorkspaceShell".
 *
 * `AssessmentSessionEditorView` is a 2700+ line view wired to a live store
 * and several API modules — mounting it in a unit test would require
 * mocking most of that surface and would mostly test the mocks. Instead:
 *
 *  1. `shouldMountDrdMethodWorkspace` is the EXACT boolean the view's real
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
import { beforeEach, describe, expect, it, vi } from 'vitest';

const featureGate = vi.hoisted(() => ({ enabled: false }));

vi.mock('@/contexts/FeatureFlagsContext', () => ({
  useFeatureFlagsContext: () => ({
    isEnabled: (id: string) => id === 'drdHttpSourceOfTruthV1' && featureGate.enabled,
  }),
}));

// Deliberately opposite to the provider value. This catches a regression to
// the isolated bare hook, which ignores the application provider's resolved
// overrides and previously sent this nested screen down the legacy path.
vi.mock('@/hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({ isEnabled: () => false }),
}));

vi.mock('../DrdHttpMethodWorkspaceScreen', () => ({
  DrdHttpMethodWorkspaceScreen: () => <div data-testid="drd-http-provider-path" />,
}));

import { shouldMountDrdMethodWorkspace } from '@/views/AssessmentSessionEditorView';
import { DrdMethodWorkspaceScreen } from '../DrdMethodWorkspaceScreen';

beforeEach(() => {
  featureGate.enabled = false;
});

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

describe('shouldMountDrdMethodWorkspace — the exact gate the view branches on', () => {
  it('true only for framework === "drd" AND the flag enabled', () => {
    expect(shouldMountDrdMethodWorkspace('drd', true)).toBe(true);
  });

  it('false when the flag is OFF, even for drd — legacy editor stays reachable', () => {
    expect(shouldMountDrdMethodWorkspace('drd', false)).toBe(false);
  });

  it('false for every other framework, flag ON or OFF — this slice is DRD-only', () => {
    expect(shouldMountDrdMethodWorkspace('siri', true)).toBe(false);
    expect(shouldMountDrdMethodWorkspace('adma', true)).toBe(false);
    expect(shouldMountDrdMethodWorkspace('cmmi', true)).toBe(false);
    expect(shouldMountDrdMethodWorkspace('lean', true)).toBe(false);
    expect(shouldMountDrdMethodWorkspace(undefined, true)).toBe(false);
  });
});

describe('DrdMethodWorkspaceScreen (the ON-path render target) mounts the REAL MethodWorkspaceShell', () => {
  it('renders data-testid="method-workspace-shell" — not a stand-in, the actual A5 component', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" />);
    expect(screen.getByTestId('method-workspace-shell')).toBeInTheDocument();
  });

  it('shows the explicit demo-bypass banner (never a silent override of pack readiness)', () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" />);
    expect(screen.getByText(/SESJA DEMONSTRACYJNA/i)).toBeInTheDocument();
  });

  it('uses the application provider decision instead of an isolated bare-hook default', () => {
    featureGate.enabled = true;
    render(<DrdMethodWorkspaceScreen storage={makeMemoryStorage()} />);

    expect(screen.getByTestId('drd-http-provider-path')).toBeInTheDocument();
    expect(screen.queryByText(/SESJA DEMONSTRACYJNA/i)).not.toBeInTheDocument();
  });
});
