/**
 * @vitest-environment jsdom
 *
 * NIGHT_SWEEP_A_REPORT_20260826.md P0 #5 (the "⚠ Status: draft" duplicate
 * banner half of the DRD Interview finding — the two-stage-navigator half
 * of #5 is a separate, out-of-scope "Interview rebuild" tracked as
 * ASM-OWN-016 / PROTOTYPE_REQUIRED, not touched here).
 *
 * Before the fix, `DrdMethodWorkspaceScreen`'s `degradedMessage` prop
 * rendered `Status: ${session.state}` for any non-active session — e.g. a
 * freshly-created (draft) session showed BOTH the header's own status pill
 * ("Szkic") AND a second full-width "⚠ Status: draft" banner underneath,
 * repeating the exact same fact `MethodWorkspaceShell`'s header already
 * displays unconditionally. This proves the duplicate banner is gone while
 * the header pill still honestly reports the session's real state.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';

import { createDrdDemoSession } from '@/method-core/methods/drd/drdSessionRuntime';

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

describe('DrdMethodWorkspaceScreen — no duplicate draft-status banner', () => {
  it('a freshly-created draft session reports its state ONLY in the header pill, never a second banner', () => {
    const storage = makeMemoryStorage();
    // Deliberately bypass `seedTo` (which always transitions the session to
    // 'active') so this session stays in its real, freshly-created 'draft'
    // state — the exact state the report's screenshot captured.
    const runtime = createDrdDemoSession({
      organizationId: 'org-demo',
      projectId: 'project-demo',
      ownerUserId: 'owner-demo',
      storage,
    });
    runtime.assignRole('owner-demo', 'owner');
    runtime.assignRole('owner-demo', 'lead_assessor');
    expect(runtime.getSession().state).toBe('draft');

    render(
      <DrdMethodWorkspaceScreen
        storage={storage}
        demoSessionId={runtime.sessionId}
        initialActorUserId="owner-demo"
      />
    );

    // Header pill: single source of truth for session state.
    expect(screen.getByText('Szkic')).toBeInTheDocument();
    // The removed duplicate banner must not reappear.
    expect(screen.queryByTestId('method-workspace-degraded-banner')).not.toBeInTheDocument();
    expect(screen.queryByText(/Status: draft/)).not.toBeInTheDocument();
  });
});
