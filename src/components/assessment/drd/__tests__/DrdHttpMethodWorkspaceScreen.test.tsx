/**
 * @vitest-environment jsdom
 *
 * DrdMethodWorkspaceScreen — `drdHttpSourceOfTruthV1` flag gate (P0C,
 * 2026-08-13). Covers the component-visible half of the P0C brief's 8 test
 * requirements:
 *  1. flag OFF -> legacy `DrdSessionRuntime`, ZERO calls into
 *     `@/method-core/api/methodCoreApi`.
 *  2. flag ON -> `DrdHttpSessionRuntime`, source indicator shows SERVER.
 *  3. a 409 on write shows an explicit conflict screen, never a silent
 *     overwrite.
 *  5. the recovery-queue screen requires an explicit click (apply/discard)
 *     — nothing resolves it on its own.
 *  7. loading and error each have their own visible state, never a blank
 *     page.
 * (Requirements 4, 6, 8 are covered at the runtime layer in
 * `drdHttpSessionRuntime.test.ts`, which this suite deliberately does not
 * re-derive — mocking a full offline/reconnect HTTP sequence through the
 * UI would mostly re-test the same mock.)
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getSession: vi.fn(),
  listEvents: vi.fn(),
  createSession: vi.fn(),
  appendEvent: vi.fn(),
  transition: vi.fn(),
  freeze: vi.fn(),
  getOutput: vi.fn(),
  teresaPreview: vi.fn(),
  teresaCommit: vi.fn(),
  createReport: vi.fn(),
  createInitiativeDraft: vi.fn(),
  getSessionLineage: vi.fn(),
  listRoles: vi.fn(),
  roleHistory: vi.fn(),
  approvalTrail: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return {
    ...actual,
    getSession: hoisted.getSession,
    listEvents: hoisted.listEvents,
    createSession: hoisted.createSession,
    appendEvent: hoisted.appendEvent,
    transition: hoisted.transition,
    freeze: hoisted.freeze,
    getOutput: hoisted.getOutput,
    teresaPreview: hoisted.teresaPreview,
    teresaCommit: hoisted.teresaCommit,
    createReport: hoisted.createReport,
    createInitiativeDraft: hoisted.createInitiativeDraft,
    getSessionLineage: hoisted.getSessionLineage,
  };
});

// DrdRolesPanel (S2) talks to a SEPARATE api module — mocked independently
// so "panel roles reachable and works" tests never touch a real network
// call either, matching this whole file's pattern.
vi.mock('@/method-core/api/methodCoreRolesApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreRolesApi')>(
    '@/method-core/api/methodCoreRolesApi'
  );
  return {
    ...actual,
    listRoles: hoisted.listRoles,
    roleHistory: hoisted.roleHistory,
    approvalTrail: hoisted.approvalTrail,
  };
});

const { DrdMethodWorkspaceScreen } = await import('../DrdMethodWorkspaceScreen');
const { DrdHttpMethodWorkspaceScreen } = await import('../DrdHttpMethodWorkspaceScreen');
const { MethodCoreApiError } = await import('@/method-core/api/methodCoreApi');
const { DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION } = await import('@/method-core/methods/drd/compileDrdPack');

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

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sess-http-1',
    organizationId: 'org-1',
    projectId: null,
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    state: 'active',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: 'user-1',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    version: 1,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('explicit rollback: legacy runtime, zero HTTP calls', () => {
  it('mounts with forceHttpSourceOfTruth=false and never touches methodCoreApi', async () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" forceHttpSourceOfTruth={false} />);

    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();
    expect(hoisted.createSession).not.toHaveBeenCalled();
    expect(hoisted.getSession).not.toHaveBeenCalled();
    expect(hoisted.listEvents).not.toHaveBeenCalled();
    expect(hoisted.appendEvent).not.toHaveBeenCalled();

    // The legacy path's own indicator — proves which store actually backed
    // this paint (DEMO_LOCAL), not merely "no HTTP mock was hit by luck".
    const indicator = screen.getAllByTestId('drd-source-indicator')[0];
    expect(indicator).toHaveAttribute('data-source', 'DEMO_LOCAL');
  });
});

describe('requirement 2 — flag ON: DrdHttpSessionRuntime, indicator shows SERVER', () => {
  it('creates a session over HTTP and renders the SERVER indicator once ready', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });

    render(<DrdMethodWorkspaceScreen storage={storage} forceHttpSourceOfTruth />);

    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();
    expect(hoisted.createSession).toHaveBeenCalledTimes(1);

    const indicator = await screen.findByTestId('drd-source-indicator');
    expect(indicator).toHaveAttribute('data-source', 'SERVER');
  });

  it('anchors a legacy assessment route to one canonical session without demo bypass', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: true });

    render(
      <DrdMethodWorkspaceScreen
        storage={storage}
        legacyAssessmentId="assessment-123"
        forceHttpSourceOfTruth
      />
    );

    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();
    expect(hoisted.createSession).toHaveBeenCalledWith(
      expect.not.objectContaining({ demoBypass: true }),
      'drd-ui-cutover:assessment-123'
    );
  });
});

describe('requirement 7 — loading and error each have their own visible state', () => {
  it('shows a non-blank bootstrap loading state before create() resolves', async () => {
    const storage = makeMemoryStorage();
    let resolveCreate: (v: unknown) => void = () => {};
    hoisted.createSession.mockReturnValue(new Promise((resolve) => (resolveCreate = resolve)));

    render(<DrdHttpMethodWorkspaceScreen storage={storage} />);

    expect(screen.getByTestId('drd-http-bootstrap-loading')).toBeInTheDocument();
    expect(screen.getByTestId('drd-http-bootstrap-loading').textContent).not.toBe('');
    await act(async () => {
      resolveCreate({ session: makeSession(), idempotentReplay: false });
      await Promise.resolve();
    });
  });

  it('shows a non-blank error+retry state when session creation fails', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockRejectedValue(new Error('boom: server unreachable'));

    render(<DrdHttpMethodWorkspaceScreen storage={storage} />);

    const errorView = await screen.findByTestId('drd-http-error-view');
    expect(errorView.textContent).toMatch(/boom: server unreachable/);
  });
});

describe('requirement 3 — a 409 on write shows an explicit conflict screen, never a silent overwrite', () => {
  it('forceState="conflict" renders the conflict view with the server version and an explicit reload action', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession({ version: 3 }), idempotentReplay: false });
    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 9 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="conflict" />);

    const conflictView = await screen.findByTestId('drd-http-conflict-view');
    expect(conflictView.textContent).toMatch(/zmieniła się na serwerze/i);

    // Nothing auto-resolves the conflict — getSession must NOT have been
    // called again until the explicit button is clicked.
    expect(hoisted.getSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('conflict-load-server'));

    await waitFor(() => expect(hoisted.getSession).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('drd-http-conflict-view')).not.toBeInTheDocument());
  });
});

describe('requirement 5 — recovery queue requires an explicit choice, never auto-resolves', () => {
  it('forceState="recovery" shows apply/discard actions and does nothing until one is clicked', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="recovery" />);

    const recoveryView = await screen.findByTestId('drd-http-recovery-view');
    expect(recoveryView.textContent).toMatch(/2 zaległych zmian/);
    expect(hoisted.getSession).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('recovery-discard-pending'));

    await waitFor(() => expect(hoisted.getSession).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('drd-http-recovery-view')).not.toBeInTheDocument());
  });
});

describe('sanity — MethodCoreApiError is the real class (mock did not replace error semantics)', () => {
  it('constructs with status/body/isNetworkError intact', () => {
    const err = new MethodCoreApiError('nope', 409, { error: 'version_conflict', currentVersion: 4 });
    expect(err.status).toBe(409);
    expect(err.body.currentVersion).toBe(4);
    expect(err.isNetworkError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CEL 4 (S3, 2026-08-13) — component-visible half of the eight-state offline
// / recovery model. Each `forceState` value below is the SAME deterministic
// escape hatch requirement 3/5 above already rely on (`debugForceState`) —
// see `DrdHttpSessionRuntime`'s own header for why no production path ever
// reaches it.
// ---------------------------------------------------------------------------
describe('CEL 4 — OFFLINE vs RECOVERY_DRAFT are visibly distinct, never conflated', () => {
  it('forceState="offline" (nothing queued) shows the OFFLINE badge and banner, workspace stays usable', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="offline" />);

    const banner = await screen.findByTestId('drd-http-offline-banner');
    expect(banner.textContent).not.toMatch(/niezapisan/i);

    const indicator = await screen.findByTestId('drd-source-indicator');
    expect(indicator).toHaveAttribute('data-source', 'OFFLINE');
    // The workspace itself is still there — offline never blocks the screen.
    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();
  });

  it('forceState="recovery_draft" (offline WITH a queued write) shows the RECOVERY_DRAFT badge, distinct from plain OFFLINE', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="recovery_draft" />);

    const banner = await screen.findByTestId('drd-http-offline-banner');
    expect(banner.textContent).toMatch(/niezapisan.*RECOVERY_DRAFT|RECOVERY_DRAFT/i);

    const indicator = await screen.findByTestId('drd-source-indicator');
    expect(indicator).toHaveAttribute('data-source', 'RECOVERY_DRAFT');
  });
});

describe('CEL 4 — RECONNECTING is its own visible, non-blocking-forever state', () => {
  it('forceState="reconnecting" shows a dedicated transient view with the RECONNECTING badge', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="reconnecting" />);

    const view = await screen.findByTestId('drd-http-reconnecting-view');
    const indicator = await screen.findByTestId('drd-source-indicator');
    expect(indicator).toHaveAttribute('data-source', 'RECONNECTING');
    expect(view.textContent).toMatch(/sprawdzam serwer/i);
  });
});

describe('CEL 4 — RECOVERED is a dismissible confirmation, not a silent auto-clear', () => {
  it('forceState="recovered" shows the success banner + badge, and dismissing it settles on SERVER', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="recovered" />);

    expect(await screen.findByTestId('drd-http-recovered-banner')).toBeInTheDocument();
    let indicator = await screen.findByTestId('drd-source-indicator');
    expect(indicator).toHaveAttribute('data-source', 'RECOVERED');

    fireEvent.click(screen.getByText('OK'));

    await waitFor(() => expect(screen.queryByTestId('drd-http-recovered-banner')).not.toBeInTheDocument());
    indicator = await screen.findByTestId('drd-source-indicator');
    expect(indicator).toHaveAttribute('data-source', 'SERVER');
  });
});

describe('CEL 4 — SAVING / SAVED render as in-workspace badges, never a blocking screen', () => {
  it('forceState="saving" keeps the workspace visible with a SAVING badge', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="saving" />);

    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();
    const indicator = await screen.findByTestId('drd-source-indicator');
    expect(indicator).toHaveAttribute('data-source', 'SAVING');
  });

  it('forceState="saved" keeps the workspace visible with a SAVED badge', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="saved" />);

    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();
    const indicator = await screen.findByTestId('drd-source-indicator');
    expect(indicator).toHaveAttribute('data-source', 'SAVED');
  });
});

describe('CEL 4 — ★ hard rule regression guard: a frozen session with no local Output pointer is SERVER, never RECOVERY_DRAFT', () => {
  it('resuming a frozen session (demoSessionId) with an uncached Output pointer shows SERVER, not RECOVERY_DRAFT', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'frozen' }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} demoSessionId="sess-http-1" />);

    const view = await screen.findByTestId('drd-http-frozen-output-view');
    const indicator = view.querySelector('[data-testid="drd-source-indicator"]');
    expect(indicator).toHaveAttribute('data-source', 'SERVER');
    expect(hoisted.getOutput).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Panel integration (S3, 2026-08-13) — DrdArtifactsPanel (S1) and
// DrdRolesPanel (S2) wired into the utilities layer of this screen (see
// this file's own `UtilityLauncherButtons`/`UtilityDrawer` header comment).
// Neither panel's OWN internals are re-tested here (that is
// DrdArtifactsPanel.test.tsx / DrdRolesPanel.test.tsx's job) — only the
// INTEGRATION SEAM: reachable from a working session, real server data,
// the workspace's own SERVER badge never mutated by opening a panel, empty
// state visible, and data still there after a simulated "restart".
// ---------------------------------------------------------------------------
function makeLineageFixture(overrides: Record<string, unknown> = {}) {
  const sess = makeSession();
  return {
    rootSessionId: sess.id,
    sessions: [sess],
    outputs: [],
    reports: [],
    presentations: [],
    initiativeDrafts: [],
    ...overrides,
  };
}

function makeOutputListItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'out-1',
    organizationId: 'org-1',
    sessionId: 'sess-http-1',
    module: 'assessment',
    methodPackId: DRD_METHOD_PACK_ID,
    methodPackVersion: DRD_METHOD_PACK_VERSION,
    outputVersion: 1,
    scope: 'full',
    current: {},
    target: {},
    gap: {},
    limitations: [],
    findings: [],
    contentHash: 'hash-1',
    frozenAt: '2026-08-13T00:00:00.000Z',
    status: 'current',
    supersededByOutputId: null,
    ...overrides,
  };
}

describe('DRD panel integration — Artefakty panel reachable, real server data, SERVER badge unchanged', () => {
  it('the "Artefakty" button opens a drawer that fetches and renders REAL lineage data, and the main header badge stays SERVER', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
    hoisted.getSessionLineage.mockResolvedValue(makeLineageFixture({ outputs: [makeOutputListItem()] }));

    render(<DrdMethodWorkspaceScreen storage={storage} forceHttpSourceOfTruth />);
    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();

    const badgeBefore = screen.getAllByTestId('drd-source-indicator')[0];
    expect(badgeBefore).toHaveAttribute('data-source', 'SERVER');

    fireEvent.click(screen.getByTestId('drd-open-artifacts'));

    await waitFor(() => expect(hoisted.getSessionLineage).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('drd-artifacts-panel-ready')).toBeInTheDocument();
    // Real server payload rendered, not a mock/placeholder count.
    expect(screen.getByText('Outputy (1)')).toBeInTheDocument();

    // ★ The requirement: entering the artifacts panel must NOT flip the
    // workspace's own source-of-truth badge to RECOVERY_DRAFT (or anything
    // else) — it is still the FIRST indicator in DOM order (the drawer's own
    // per-section SERVER badges come after it).
    const badgeAfter = screen.getAllByTestId('drd-source-indicator')[0];
    expect(badgeAfter).toHaveAttribute('data-source', 'SERVER');
  });

  it('shows the explicit empty state when the session has no artefacts yet — never a blank panel', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
    hoisted.getSessionLineage.mockResolvedValue(makeLineageFixture());

    render(<DrdMethodWorkspaceScreen storage={storage} forceHttpSourceOfTruth />);
    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('drd-open-artifacts'));

    expect(await screen.findByTestId('drd-artifacts-panel-empty')).toBeInTheDocument();
  });

  it('after a simulated restart (fresh mount, demoSessionId resume) the artefacts panel is still reachable and still shows server data', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.getSessionLineage.mockResolvedValue(makeLineageFixture({ outputs: [makeOutputListItem()] }));

    // A brand new component mount resuming an EXISTING session id — the
    // closest thing to "the browser restarted" this test harness can do
    // without a real page reload.
    render(<DrdHttpMethodWorkspaceScreen storage={storage} demoSessionId="sess-http-1" />);
    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('drd-open-artifacts'));

    await waitFor(() => expect(hoisted.getSessionLineage).toHaveBeenCalledWith('sess-http-1'));
    expect(await screen.findByTestId('drd-artifacts-panel-ready')).toBeInTheDocument();
    expect(screen.getByText('Outputy (1)')).toBeInTheDocument();
  });

  it('closing the drawer (X button) removes it and does not leave a stray badge behind', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
    hoisted.getSessionLineage.mockResolvedValue(makeLineageFixture());

    render(<DrdMethodWorkspaceScreen storage={storage} forceHttpSourceOfTruth />);
    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('drd-open-artifacts'));
    expect(await screen.findByTestId('drd-utility-drawer')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('drd-utility-drawer-close'));
    await waitFor(() => expect(screen.queryByTestId('drd-utility-drawer')).not.toBeInTheDocument());
  });
});

describe('DRD panel integration — Role panel reachable and functional on real server data', () => {
  it('the "Role" button opens the roles panel and renders REAL server role data', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
    hoisted.listRoles.mockResolvedValue([
      { userId: 'test-user-id', role: 'owner', createdAt: '2026-08-13T00:00:00.000Z' },
    ]);
    hoisted.roleHistory.mockResolvedValue([]);
    hoisted.approvalTrail.mockResolvedValue([]);

    render(<DrdMethodWorkspaceScreen storage={storage} forceHttpSourceOfTruth />);
    expect(await screen.findByTestId('method-workspace-shell')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('drd-open-roles'));

    await waitFor(() => expect(hoisted.listRoles).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId('drd-roles-panel')).toBeInTheDocument();
    expect(screen.getByText('test-user-id')).toBeInTheDocument();

    // The workspace's own badge is unaffected by opening the roles panel either.
    const badge = screen.getAllByTestId('drd-source-indicator')[0];
    expect(badge).toHaveAttribute('data-source', 'SERVER');
  });

  it('is also reachable from the frozen-Output view (approval trail matters most post-freeze)', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'frozen' }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.listRoles.mockResolvedValue([]);
    hoisted.roleHistory.mockResolvedValue([]);
    hoisted.approvalTrail.mockResolvedValue([
      { eventId: 'evt-1', occurredAt: '2026-08-13T00:00:00.000Z', type: 'DECISION_APPROVED', version: 2, actorUserId: 'test-user-id', rationale: 'ok' },
    ]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} demoSessionId="sess-http-1" />);
    expect(await screen.findByTestId('drd-http-frozen-output-view')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('drd-open-roles'));

    expect(await screen.findByTestId('drd-roles-panel')).toBeInTheDocument();
    await waitFor(() => expect(hoisted.approvalTrail).toHaveBeenCalled());
  });
});
