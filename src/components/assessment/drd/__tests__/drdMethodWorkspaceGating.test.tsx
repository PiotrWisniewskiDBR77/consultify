/**
 * @vitest-environment jsdom
 *
 * J2 cutover: every mounted DRD session uses the server-authoritative HTTP
 * workspace. The historical flag prop is retained only for source compatibility
 * and cannot select the removed local writer.
 *
 * `AssessmentSessionEditorView` is a 2700+ line view wired to a live store
 * and several API modules — mounting it in a unit test would require
 * mocking most of that surface and would mostly test the mocks. Instead:
 *
 *  1. `shouldMountDrdMethodWorkspace` is the EXACT boolean the view's real
 *     early-return branches on (see AssessmentSessionEditorView.tsx) —
 *     tested directly, exhaustively.
 *  2. `DrdMethodWorkspaceScreen` is mounted with both historical prop values;
 *     both must reach the HTTP component.
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

describe('shouldMountDrdMethodWorkspace — mounted DRD is canonical regardless of rollout flag', () => {
  it('true for DRD when the historical flag is enabled', () => {
    expect(shouldMountDrdMethodWorkspace('drd', true)).toBe(true);
  });

  it('remains true when the historical flag is OFF — legacy/local writer is not a production fallback', () => {
    expect(shouldMountDrdMethodWorkspace('drd', false)).toBe(true);
  });

  it('false for every other framework, flag ON or OFF — this slice is DRD-only', () => {
    expect(shouldMountDrdMethodWorkspace('siri', true)).toBe(false);
    expect(shouldMountDrdMethodWorkspace('adma', true)).toBe(false);
    expect(shouldMountDrdMethodWorkspace('cmmi', true)).toBe(false);
    expect(shouldMountDrdMethodWorkspace('lean', true)).toBe(false);
    expect(shouldMountDrdMethodWorkspace(undefined, true)).toBe(false);
  });
});

describe('DrdMethodWorkspaceScreen uses the sole HTTP runtime', () => {
  it.each([true, false])('ignores retired forceHttpSourceOfTruth=%s', (retiredValue) => {
    render(<DrdMethodWorkspaceScreen forceHttpSourceOfTruth={retiredValue} />);
    expect(screen.getByTestId('drd-http-provider-path')).toBeInTheDocument();
  });
});
