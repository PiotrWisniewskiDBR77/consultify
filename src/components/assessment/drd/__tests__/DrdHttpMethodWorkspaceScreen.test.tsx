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

describe('requirement 1 — flag OFF: legacy runtime, zero HTTP calls', () => {
  it('mounts without forceHttpSourceOfTruth and never touches methodCoreApi', async () => {
    const storage = makeMemoryStorage();
    render(<DrdMethodWorkspaceScreen storage={storage} seedTo="interview" />);

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

  it.each([
    [401, 'auth_required'],
    [403, 'missing_permission'],
    [404, 'session_not_found'],
  ])('keeps a canonical resume %s fail-closed with retry and no workspace', async (status, code) => {
    hoisted.getSession.mockRejectedValue(new MethodCoreApiError(code, status, { error: code }));
    render(<DrdHttpMethodWorkspaceScreen storage={makeMemoryStorage()} demoSessionId="sess-http-1" />);

    const errorView = await screen.findByTestId('drd-http-error-view');
    expect(errorView).toHaveTextContent(code);
    expect(screen.getByTestId('error-retry')).toBeEnabled();
    expect(screen.queryByTestId('method-workspace-shell')).not.toBeInTheDocument();
  });
});

describe('canonical cold reopen identity and read-only contract', () => {
  it('renders exact session/method versions and disables writes without a write role', async () => {
    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 7 }), roles: [] });
    hoisted.listEvents.mockResolvedValue([]);
    render(<DrdHttpMethodWorkspaceScreen storage={makeMemoryStorage()} demoSessionId="sess-http-1" />);

    expect(await screen.findByText('ID: sess-http-1')).toBeInTheDocument();
    expect(screen.getByText(`method: ${DRD_METHOD_PACK_ID}@${DRD_METHOD_PACK_VERSION}`)).toBeInTheDocument();
    expect(screen.getByText('session: v7')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapisz teraz' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pracuję samodzielnie' })).toBeDisabled();
  });
});

describe('requirement 3 — a 409 on write shows an explicit conflict screen, never a silent overwrite', () => {
  it('keeps Freeze disabled for an in-review owner without the approver process role', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({
      session: makeSession({ state: 'in_review', version: 4 }),
      roles: ['owner'],
    });
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} demoSessionId="sess-http-1" />);

    expect(await screen.findByTestId('freeze-button')).toBeDisabled();
    expect(hoisted.freeze).not.toHaveBeenCalled();
  });

  it('turns a real stale transition 409 into ConflictView without painting false success', async () => {
    const storage = makeMemoryStorage();
    hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'active', version: 3 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);
    hoisted.transition.mockRejectedValue(
      new MethodCoreApiError('version conflict', 409, { error: 'version_conflict', currentVersion: 4 })
    );

    render(<DrdHttpMethodWorkspaceScreen storage={storage} demoSessionId="sess-http-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Wyślij do przeglądu/i }));

    expect(await screen.findByTestId('drd-http-conflict-view')).toBeInTheDocument();
    expect(screen.queryByTestId('drd-http-frozen-output-view')).not.toBeInTheDocument();
    expect(hoisted.freeze).not.toHaveBeenCalled();
  });

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

describe('Interview Focus advances with real progress — regression for the focus-level bug', () => {
  it('after confirming levels 1 and 2, the focus level follows the real blocker (3), not always level 1', async () => {
    const storage = makeMemoryStorage();
    const events: Array<Record<string, unknown>> = [];
    let evtSeq = 0;

    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
    hoisted.transition.mockResolvedValue(makeSession({ state: 'active' }));
    hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'active' }), roles: ['owner', 'lead_assessor', 'assessor', 'approver'] });
    hoisted.appendEvent.mockImplementation((_sessionId: string, evt: Record<string, unknown>) => {
      evtSeq += 1;
      events.push({
        id: `evt-${evtSeq}`,
        organizationId: 'org-1',
        sessionId: 'sess-http-1',
        actorKind: 'human',
        actorUserId: 'user-1',
        methodPackVersion: DRD_METHOD_PACK_VERSION,
        occurredAt: '2026-08-13T00:00:00.000Z',
        ...evt,
      });
      return Promise.resolve({ id: `evt-${evtSeq}`, type: evt.type });
    });
    hoisted.listEvents.mockImplementation(() => Promise.resolve([...events]));

    render(<DrdHttpMethodWorkspaceScreen storage={storage} seedTo="interview" />);

    await screen.findByTestId('method-workspace-shell');

    // The fixture area (1A) has levels 1..7 — seedTo="interview" confirms 1
    // and 2, so the real blocker (first unconfirmed level) is 3. Before the
    // fix this screen ignored progression entirely and always showed level 1.
    await waitFor(() => expect(screen.getByTestId('question-progress')).toHaveTextContent('Pytanie 3 z 7'));
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
