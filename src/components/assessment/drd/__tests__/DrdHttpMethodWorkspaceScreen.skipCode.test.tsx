/**
 * @vitest-environment jsdom
 *
 * DrdHttpMethodWorkspaceScreen — "Pomiń z uzasadnieniem" skip-code write path
 * (FIX P1-2, day-27 acceptance fix-up).
 *
 * `handleSkip` in `DrdHttpMethodWorkspaceScreen.tsx` performs TWO real writes
 * over TWO different HTTP surfaces, in this order:
 *  1. `runtime.recordAnswer(...)` — the kernel event contract
 *     (`@/method-core/api/methodCoreApi#appendEvent`, mocked at the module
 *     boundary here like every other HTTP-runtime test in this directory) —
 *     carries `justification: formatSkipJustification(reasonCode)`.
 *  2. `recordAssessmentSkipReason(sessionId, input, idempotencyKey)` — the
 *     assessment-owned skip-reason endpoint (`POST /api/method/sessions/
 *     :sessionId/assessment-skip-reasons`). This function is NOT mocked —
 *     it is the real implementation from `methodCoreApi.ts`, so it goes
 *     through the real `fetchWithRetry`/`getHeaders` plumbing and hits
 *     `global.fetch`, which THIS file controls directly. That is the only
 *     way to observe the real request shape (URL, body, Idempotency-Key
 *     header) and the real client-side retry loop (`for (attempt < 2)` in
 *     `handleSkip`), neither of which the module-mock in the sibling test
 *     files (`DrdHttpMethodWorkspaceScreen.test.tsx` /
 *     `...offlineRecovery.test.tsx`) exercises — this file plugs that gap.
 *
 * Six scenarios, one per requirement from the day-27 acceptance fix brief:
 *  (a) happy path — recordAnswer carries the formatted justification AND the
 *      skip-reasons POST carries the chosen skipCode.
 *  (b) call order — recordAnswer (appendEvent) happens strictly before the
 *      skip-reasons POST (`mock.invocationCallOrder`).
 *  (c) a 200 response (idempotent replay on the server) is treated as
 *      success, same as 201 — no error banner. This file never asserts a
 *      literal `=== 201`, on purpose.
 *  (d) a network error on the first attempt is retried by `handleSkip`'s own
 *      loop, reusing the SAME Idempotency-Key, and `recordAnswer`
 *      (appendEvent) is invoked exactly once regardless.
 *  (e) a 403 is NOT retryable — exactly one fetch call, the warning banner
 *      (`role="alert"`) is shown, and `handleUnitNav(1)` still runs (the
 *      workspace advances to the next unit either way).
 *  (f) the skip-reasons POST body never carries `organizationId` — the
 *      server's tenant-mismatch guard
 *      (`method-core.routes.ts` `assessment-skip-reasons`) only fires when
 *      the client sends a MISMATCHED value; the client should never send
 *      the field at all.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    // recordAssessmentSkipReason, newIdempotencyKey, formatSkipJustification (re-exported),
    // isOfflineError, MethodCoreApiError all stay REAL (from `actual`) — this
    // file's whole point is to exercise their real behavior over a
    // controlled `global.fetch`.
  };
});

const { DrdHttpMethodWorkspaceScreen } = await import('../DrdHttpMethodWorkspaceScreen');
const { DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION } =
  await import('@/method-core/methods/drd/compileDrdPack');
const { DRD_STRUCTURE } = await import('@/services/drdStructure');
const { SKIP_REASON_OPTIONS, formatSkipJustification } =
  await import('@/components/method-workspace/skipReasonCodes');

const AREA_1A_ID = DRD_STRUCTURE[0].areas[0].id;
const SKIP_URL_RE = /\/api\/method\/sessions\/sess-http-1\/assessment-skip-reasons$/;

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

function jsonResponse(body: unknown, status: number): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

/** Renders the HTTP DRD workspace, seeds it to the interview focus screen
 * (level 3 for area 1A — same blocked-level regression proven in
 * `DrdHttpMethodWorkspaceScreen.test.tsx`), and clears the write mocks so
 * every assertion below is scoped to the skip action itself, not the seed. */
async function renderAtInterviewFocus(): Promise<{ storage: Storage }> {
  const storage = makeMemoryStorage();
  const events: Array<Record<string, unknown>> = [];
  let evtSeq = 0;

  hoisted.createSession.mockResolvedValue({ session: makeSession(), idempotentReplay: false });
  hoisted.transition.mockResolvedValue(makeSession({ state: 'active' }));
  hoisted.getSession.mockResolvedValue({
    session: makeSession({ state: 'active' }),
    roles: ['owner', 'lead_assessor', 'assessor', 'approver'],
  });
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
  await waitFor(() =>
    expect(screen.getByTestId('question-progress')).toHaveTextContent('Pytanie 3 z 7')
  );

  // Scope every assertion below to the skip action — the seed above already
  // made its own real appendEvent calls.
  hoisted.appendEvent.mockClear();
  hoisted.getSession.mockClear();
  hoisted.listEvents.mockClear();

  return { storage };
}

/** Opens the skip picker, chooses `code`, and clicks "Potwierdź" — the exact
 * DOM path proven for the legacy screen in
 * `DrdMethodWorkspaceScreen.skipAndResolution.test.tsx`. */
function triggerSkip(code: string): void {
  fireEvent.click(screen.getByRole('button', { name: /Pomiń z uzasadnieniem/i }));
  fireEvent.change(screen.getByTestId('skip-reason-select'), { target: { value: code } });
  fireEvent.click(screen.getByRole('button', { name: /Potwierdź/i }));
}

function breadcrumbText(): string {
  return screen.getByRole('navigation', { name: /Ścieżka pytania/i }).textContent ?? '';
}

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('(a) happy path — recordAnswer carries the justification, the POST carries skipCode', () => {
  it('sends the formatted justification via recordAnswer and skipCode via the skip-reasons POST', async () => {
    await renderAtInterviewFocus();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ skipReason: { id: 'sr-1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);

    const code = SKIP_REASON_OPTIONS[0].code;
    triggerSkip(code);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // 1. recordAnswer (appendEvent) carried the formatted justification.
    expect(hoisted.appendEvent).toHaveBeenCalledTimes(1);
    const [, answerEvent] = hoisted.appendEvent.mock.calls[0];
    expect((answerEvent.payload as Record<string, unknown>).justification).toBe(
      formatSkipJustification(code)
    );
    expect(answerEvent.unitId).toBe(AREA_1A_ID);
    expect(answerEvent.level).toBe(3);

    // 2. the skip-reasons POST carried the chosen skipCode against the same
    // unit/level/question.
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toMatch(SKIP_URL_RE);
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ unitId: AREA_1A_ID, level: 3, skipCode: code });
    expect(typeof body.questionId).toBe('string');
    expect(body.questionId.length).toBeGreaterThan(0);
  });
});

describe('(b) order — recordAnswer happens before the skip-reasons POST', () => {
  it('appendEvent is invoked strictly before fetch, per mock.invocationCallOrder', async () => {
    await renderAtInterviewFocus();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ skipReason: { id: 'sr-1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);

    triggerSkip(SKIP_REASON_OPTIONS[0].code);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(hoisted.appendEvent).toHaveBeenCalledTimes(1);

    const appendOrder = hoisted.appendEvent.mock.invocationCallOrder[0];
    const fetchOrder = fetchMock.mock.invocationCallOrder[0];
    expect(appendOrder).toBeLessThan(fetchOrder);
  });
});

describe('(c) a 200 response is a success — no error banner (never asserts === 201)', () => {
  it('treats status 200 (idempotent replay) as success, same as a fresh 201 would be', async () => {
    await renderAtInterviewFocus();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ skipReason: { id: 'sr-1' } }, 200));
    vi.stubGlobal('fetch', fetchMock);

    const before = breadcrumbText();
    triggerSkip(SKIP_REASON_OPTIONS[0].code);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    // The workspace still advances on success.
    await waitFor(() => expect(breadcrumbText()).not.toEqual(before));

    expect(screen.queryByText(/assessment\.reportView\.skipWriteError/)).not.toBeInTheDocument();
  });
});

describe('(d) network error then retry succeeds — same Idempotency-Key, recordAnswer called once', () => {
  it('retries recordAssessmentSkipReason once on a network failure, reusing the Idempotency-Key', async () => {
    await renderAtInterviewFocus();
    const fetchMock = vi
      .fn()
      // First attempt: a genuine network-level rejection (not a TypeError /
      // "Failed to fetch" message, so baseClient's OWN internal one-shot
      // retry does not also fire here — this isolates the COMPONENT's
      // `handleSkip` retry loop from the transport layer's retry).
      .mockRejectedValueOnce(new Error('network unreachable'))
      .mockResolvedValueOnce(jsonResponse({ skipReason: { id: 'sr-1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);

    triggerSkip(SKIP_REASON_OPTIONS[0].code);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const key1 = (fetchMock.mock.calls[0][1].headers as Record<string, string>)['Idempotency-Key'];
    const key2 = (fetchMock.mock.calls[1][1].headers as Record<string, string>)['Idempotency-Key'];
    expect(key1).toBeTruthy();
    expect(key1).toBe(key2);

    // recordAnswer (appendEvent) is only invoked once by handleSkip,
    // regardless of how many times the skip-reasons POST itself retries.
    expect(hoisted.appendEvent).toHaveBeenCalledTimes(1);

    expect(screen.queryByText(/assessment\.reportView\.skipWriteError/)).not.toBeInTheDocument();
  });
});

describe('(e) 403 — no retries, banner shown, navigation still happens', () => {
  it('makes exactly one fetch call, shows the alert banner, and still runs handleUnitNav(1)', async () => {
    await renderAtInterviewFocus();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ error: 'missing_permission', requiredRole: 'assessor' }, 403)
      );
    vi.stubGlobal('fetch', fetchMock);

    const before = breadcrumbText();
    triggerSkip(SKIP_REASON_OPTIONS[0].code);

    const banner = await screen.findByText(/assessment\.reportView\.skipWriteError/);
    expect(banner.closest('[role="alert"]')).toBeInTheDocument();

    // Zero retries on a non-retryable client error.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The workspace still advances — handleUnitNav(1) runs unconditionally
    // after the write attempt, success or failure.
    await waitFor(() => expect(breadcrumbText()).not.toEqual(before));
  });
});

describe('(f) the skip-reasons POST body never carries organizationId', () => {
  it('omits organizationId from the request body entirely', async () => {
    await renderAtInterviewFocus();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ skipReason: { id: 'sr-1' } }, 201));
    vi.stubGlobal('fetch', fetchMock);

    triggerSkip(SKIP_REASON_OPTIONS[0].code);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect(Object.prototype.hasOwnProperty.call(body, 'organizationId')).toBe(false);
  });
});
