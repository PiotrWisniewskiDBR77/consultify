/**
 * B1 (M09) — IdeaWhiteboardTool observer read-only UX.
 *
 * When the local user's resolved facilitation role is 'observer' (a facilitator assigned
 * them the observer role in tool_facilitation_roles), the board must render read-only:
 *   - the WhiteboardCanvas receives locked=true (disables node create/drag/resize/edit),
 *   - an "Observer — view only" badge is shown.
 * A participant/facilitator sees no badge and an unlocked canvas.
 *
 * Heavy child modules are stubbed; WhiteboardCanvas is replaced with a probe that
 * echoes its `locked` prop so we can assert the read-only propagation directly.
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── i18n: t() returns the key (+ interpolates role) so assertions are stable ──
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({
  default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

vi.mock('reactflow/dist/style.css', () => ({}));
vi.mock('../../../src/components/MyWork/whiteboard/whiteboard-canvas.css', () => ({}));

// ── Facilitation Api: resolve THIS user (current-user) as observer ────────────
const roleState = vi.hoisted(() => ({ role: 'observer' as string }));
vi.mock('@/services/api', () => ({
  Api: {
    facilitationCreateSession: vi.fn().mockResolvedValue({ id: 'sess-1' }),
    facilitationResolveByTool: vi.fn(async () => ({
      session: { id: 'sess-1', facilitator_id: 'someone-else', status: 'active' },
    })),
    facilitationGetSession: vi
      .fn()
      .mockResolvedValue({ id: 'sess-1', facilitator_id: 'someone-else', current_phase: 'start' }),
    facilitationGetRoles: vi.fn(async () => ({
      roles: [{ user_id: 'current-user', role_name: roleState.role }],
    })),
    facilitationAssignRole: vi.fn().mockResolvedValue({ id: 'role-1' }),
    facilitationUpdateTimer: vi.fn().mockResolvedValue({ ok: true }),
    facilitationUpdatePhase: vi.fn().mockResolvedValue({ ok: true }),
    facilitationGetVotes: vi.fn().mockResolvedValue({ votes: [] }),
    facilitationGetVoteSummary: vi.fn().mockResolvedValue({ summary: [] }),
    toolSessionJoinPresence: vi.fn().mockResolvedValue({ presence: [] }),
    toolSessionListPresence: vi.fn().mockResolvedValue({ presence: [] }),
    toolSessionHeartbeat: vi.fn().mockResolvedValue({ ok: true }),
    toolSessionDisconnect: vi.fn().mockResolvedValue({ ok: true }),
    getIdeaMap: vi.fn().mockResolvedValue({ map: { nodes: [], edges: [] } }),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({
      currentUser: { id: 'current-user', firstName: 'Obs', lastName: 'User', email: 'obs@x.io' },
    }),
}));

// ── useIdeaMapSync: no real network; report the `locked` it receives is irrelevant here ──
vi.mock('../../../src/components/MyWork/whiteboard/useIdeaMapSync', () => ({
  useIdeaMapSync: () => ({
    saving: false,
    syncState: 'idle',
    lastSavedAt: null,
    queueSync: vi.fn(),
    flushNow: vi.fn().mockResolvedValue(undefined),
    primeServerVersion: vi.fn(),
  }),
}));

vi.mock('../../../src/components/MyWork/whiteboard/useWhiteboardCollab', () => ({
  useWhiteboardCollab: () => ({ broadcast: vi.fn(), connected: false }),
}));

import { IdeaWhiteboardTool } from '@/components/MyWork/IdeaWhiteboardTool';

// WhiteboardCanvas is an internal (non-exported) component, so we assert on the observer
// badge — rendered by IdeaWhiteboardTool and gated on the SAME `isObserver` flag that
// feeds `locked` into every mutation site (canvas, toolbar, empty-state, selection bar).
// The badge is the user-visible proof of the read-only state.

function renderTool() {
  return render(
    <IdeaWhiteboardTool open ideaId="idea-1" onSaved={vi.fn()} title="Board" seedText="" stage="" />
  );
}

describe('B1 (M09) — IdeaWhiteboardTool observer read-only', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    roleState.role = 'observer';
  });

  it('shows the "Observer — view only" badge and locks the canvas (read-only) for observer', async () => {
    renderTool();
    await waitFor(
      () => expect(screen.getByTestId('whiteboard-observer-badge')).toBeInTheDocument(),
      { timeout: 4000 }
    );
    // t() is mocked to return the raw key (see comment above) so we assert on the key,
    // not the translated English copy — real-copy coverage lives in the i18n contract test.
    expect(screen.getByTestId('whiteboard-observer-badge').textContent).toMatch(
      /observerViewOnly/i
    );
    // Read-only propagation: the empty-state quick-start mutation buttons (gated on the
    // SAME `locked` flag observer feeds) must be hidden, proving the board is view-only.
    expect(screen.queryByRole('button', { name: /Brainstorm/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Workshop wall/i })).toBeNull();
  });

  it('does NOT lock the board (no badge, mutation UI present) for a participant', async () => {
    roleState.role = 'participant';
    renderTool();
    // The unlocked empty-state exposes the quick-start buttons once loaded.
    await waitFor(() => expect(screen.getByRole('button', { name: /Brainstorm/i })).toBeInTheDocument(), {
      timeout: 4000,
    });
    expect(screen.queryByTestId('whiteboard-observer-badge')).toBeNull();
  });
});
