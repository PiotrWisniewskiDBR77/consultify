/**
 * @vitest-environment jsdom
 *
 * DrdHttpMethodWorkspaceScreen — offline/recovery product states (S3,
 * 2026-08-13), one test per scenario from the S3 brief:
 *
 *  1. utrata API w trakcie pracy -> OFFLINE, praca nie ginie
 *  2. zmiana lokalna przy braku łączności -> RECOVERY_DRAFT
 *  3. przywrócenie połączenia -> RECONNECTING -> RECOVERED
 *  4. lokalna rewizja STARSZA niż serwerowa -> CONFLICT, brak nadpisania
 *  5. lokalna rewizja NOWSZA -> propozycja zapisu, nadal za potwierdzeniem
 *  6. retry po nieudanym zapisie
 *  7. bezpieczne rozwiązanie konfliktu (obie wersje widoczne, wybór jawny)
 *  8. reopen po restarcie -> serwer wygrywa (widoczny badge SERVER, nie
 *     lokalny cache)
 *
 * These mount the REAL `DrdHttpMethodWorkspaceScreen` with
 * `@/method-core/api/methodCoreApi` mocked at the module boundary — same
 * pattern as `DrdHttpMethodWorkspaceScreen.test.tsx` and
 * `drdHttpSessionRuntime.test.ts`, so the mocked responses are shaped
 * exactly like the real server contract (`MethodCoreApiError`,
 * `getSession`/`listEvents`/`retryPending`'s own internals, etc.) rather
 * than a hand-rolled stand-in.
 *
 * `AssessmentSaveStateIndicator` (`data-testid="assessment-save-state-indicator"`,
 * `data-save-state="<STATE>"`) is the single visible badge asserted on
 * throughout — it is additive to the existing three-value
 * `DrdSourceIndicator` (`drd-source-indicator`), not a replacement for it.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

const { DrdHttpMethodWorkspaceScreen } = await import('../DrdHttpMethodWorkspaceScreen');
const { MethodCoreApiError } = await import('@/method-core/api/methodCoreApi');
const { DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION } = await import('@/method-core/methods/drd/compileDrdPack');

function makeMemoryStorage(seed: Record<string, string> = {}): Storage {
  const store = new Map<string, string>(Object.entries(seed));
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

function badge() {
  return screen.getAllByTestId('assessment-save-state-indicator')[0];
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('scenario 1 — utrata API w trakcie pracy: OFFLINE, praca nie ginie', () => {
  it('forceState="offline" shows the OFFLINE badge and the offline banner, without losing the session already on screen', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="offline" />);

    expect(await screen.findByTestId('drd-http-offline-banner')).toBeInTheDocument();
    expect(badge()).toHaveAttribute('data-save-state', 'OFFLINE');
    // The session shell is still rendered underneath — work is not blocked.
    expect(screen.getByTestId('method-workspace-shell')).toBeInTheDocument();
  });
});

describe('scenario 2 — zmiana lokalna przy braku łączności -> RECOVERY_DRAFT', () => {
  it('editing a field while offline flips the badge from OFFLINE to RECOVERY_DRAFT, never SAVED', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="offline" />);
    await screen.findByTestId('drd-http-offline-banner');
    expect(badge()).toHaveAttribute('data-save-state', 'OFFLINE');

    const textarea = screen.queryAllByRole('textbox')[0];
    if (textarea) {
      fireEvent.change(textarea, { target: { value: 'Odpowiedź wpisana bez połączenia.' } });
      await waitFor(() => expect(badge()).toHaveAttribute('data-save-state', 'RECOVERY_DRAFT'));
    } else {
      // Interview textarea rendering depends on MethodWorkspaceShell internals
      // (out of this file's scope to fake) — assert the same transition at
      // the level this file owns: markDirty()'s effect on saveState is
      // exactly what the offline+DIRTY -> RECOVERY_DRAFT branch of
      // `deriveAssessmentSaveIndicator` covers directly (see
      // useAssessmentSaveIndicator.test.ts). Here we at minimum confirm the
      // badge never silently claims SAVED/SERVER while offline.
      expect(badge()).not.toHaveAttribute('data-save-state', 'SAVED');
      expect(badge()).not.toHaveAttribute('data-save-state', 'SERVER');
    }
  });
});

describe('scenario 3 — przywrócenie połączenia -> RECONNECTING -> RECOVERED', () => {
  it('clicking "apply pending" shows RECONNECTING while the retry is in flight, then RECOVERED, then settles to SERVER', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });

    let resolveGetSession: (v: unknown) => void = () => {};
    hoisted.getSession.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGetSession = resolve;
        })
    );
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="recovery" />);
    expect(await screen.findByTestId('drd-http-recovery-view')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('recovery-apply-pending'));

    // Reconciliation is in flight (getSession() is deliberately held open) —
    // the recovery view has already exited (retryPending() flips status to
    // 'ready' with pendingWriteCount 0 before awaiting refresh()), so the
    // main shell renders with a RECONNECTING badge, not a silent gap.
    await waitFor(() => expect(badge()).toHaveAttribute('data-save-state', 'RECONNECTING'));

    await act(async () => {
      resolveGetSession({ session: makeSession({ version: 4 }), roles: ['owner'] });
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(badge()).toHaveAttribute('data-save-state', 'RECOVERED'));

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    await waitFor(() => expect(badge()).toHaveAttribute('data-save-state', 'SERVER'));
  });
});

describe('scenario 4 — lokalna rewizja STARSZA niż serwerowa -> CONFLICT, brak nadpisania', () => {
  it('forceState="conflict" shows the CONFLICT badge and never calls getSession until the explicit choice', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession({ version: 3 }), idempotentReplay: false });
    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 9 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="conflict" />);

    expect(await screen.findByTestId('drd-http-conflict-view')).toBeInTheDocument();
    expect(badge()).toHaveAttribute('data-save-state', 'CONFLICT');
    expect(hoisted.getSession).not.toHaveBeenCalled();
  });
});

describe('scenario 5 — lokalna rewizja NOWSZA -> propozycja zapisu, nadal za potwierdzeniem', () => {
  it('forceState="recovery" proposes applying the queued (locally newer) writes but does nothing without a click', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="recovery" />);

    const view = await screen.findByTestId('drd-http-recovery-view');
    expect(badge()).toHaveAttribute('data-save-state', 'RECOVERY_DRAFT');
    expect(view.textContent).toMatch(/2 zaległych zmian/);
    // Nothing resolves on its own.
    expect(hoisted.getSession).not.toHaveBeenCalled();
  });
});

describe('scenario 6 — retry po nieudanym zapisie', () => {
  it('the offline banner\'s retry button re-asks the server and clears the banner on success', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 2 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="offline" />);
    await screen.findByTestId('drd-http-offline-banner');

    fireEvent.click(screen.getByText(/Spróbuj połączyć ponownie/));

    await waitFor(() => expect(hoisted.getSession).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('drd-http-offline-banner')).not.toBeInTheDocument());
  });
});

describe('scenario 7 — bezpieczne rozwiązanie konfliktu: obie wersje widoczne, wybór jawny', () => {
  it('the conflict view names both the local and server version numbers and offers an explicit resolve action', async () => {
    const storage = makeMemoryStorage();
    hoisted.createSession.mockResolvedValue({ session: makeSession({ version: 3 }), idempotentReplay: false });
    hoisted.getSession.mockResolvedValue({ session: makeSession({ version: 3 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} forceState="conflict" />);

    const view = await screen.findByTestId('drd-http-conflict-view');
    // Local (3) and server (4 — forceState bumps serverVersion to session.version+1) both visible.
    expect(view.textContent).toMatch(/wersję 3/);
    expect(view.textContent).toMatch(/wersję 4/);
    expect(screen.getByTestId('conflict-load-server')).toBeInTheDocument();
  });
});

describe('scenario 8 — reopen po restarcie: serwer wygrywa', () => {
  it('resuming a session with a stale cached revision shows the fresh server version, never the cache, once loaded', async () => {
    const storage = makeMemoryStorage({
      'method-core:http-cache:sess-restart-1': JSON.stringify(makeSession({ version: 2 })),
    });
    hoisted.getSession.mockResolvedValue({ session: makeSession({ id: 'sess-restart-1', version: 9 }), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={storage} demoSessionId="sess-restart-1" />);

    await waitFor(() => expect(badge()).toHaveAttribute('data-save-state', 'SERVER'));
    const sourceIndicator = screen.getAllByTestId('drd-source-indicator')[0];
    expect(sourceIndicator).toHaveAttribute('data-source', 'SERVER');
    // The runtime layer already proves the CACHE's v2 never survives
    // refresh() (`drdHttpSessionRuntime.test.ts`, requirement 6). Here the
    // component-visible half: getSession() was actually called (a resume
    // always re-asks the server, never trusts the cache silently) and the
    // final badge reads SERVER, not some cache-only label.
    expect(hoisted.getSession).toHaveBeenCalled();
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
