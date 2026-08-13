/**
 * @vitest-environment jsdom
 *
 * SiriHttpMethodWorkspaceScreen — component-visible half of the CEL 9 test
 * list (S5, 2026-08-13). Complements the runtime-mechanics tests in
 * `siriHttpSessionRuntime.test.ts` and the pure-logic tests in
 * `siriWorkspaceView.test.ts`:
 *
 *  - SERVER source indicator shows once the session is confirmed 'ready'.
 *  - Matrix renders exactly 16 rows x 6 Bands (96 cells).
 *  - Selecting a leapfrog-blocked cell shows the explicit refusal message,
 *    and Propose/Confirm are disabled until it clears.
 *  - EVIDENCE_MISSING -> "Help content unavailable" — SIRI has zero
 *    dedicated per-dimension question content, so the Interview panel's
 *    `QuestionHelpDisclosure` must render the honest fallback, never a
 *    fabricated explanation.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MethodEvent, MethodSession } from '@/method-core/contracts';

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

const { SiriHttpMethodWorkspaceScreen } = await import('../SiriHttpMethodWorkspaceScreen');

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

function makeSession(overrides: Partial<MethodSession> = {}): MethodSession {
  return {
    id: 'siri-screen-1',
    organizationId: 'test-org-id',
    projectId: null,
    module: 'assessment',
    methodPackId: 'siri',
    methodPackVersion: '0.1.0-draft',
    state: 'active',
    domainStage: null,
    mode: 'guided_manual',
    ownerUserId: 'test-user-id',
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    version: 1,
    frozenSnapshotId: null,
    revisionOfSessionId: null,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<MethodEvent>): MethodEvent {
  return {
    id: `ev-${Math.random().toString(36).slice(2)}`,
    type: 'ANSWER_CONFIRMED',
    organizationId: 'test-org-id',
    sessionId: 'siri-screen-1',
    actorKind: 'human',
    actorUserId: 'test-user-id',
    methodPackVersion: '0.1.0-draft',
    occurredAt: '2026-08-13T00:00:00.000Z',
    payload: {},
    ...overrides,
  };
}

// A fixed, already-confirmed state for `strategy_governance` (Band 0+1) —
// `vertical_integration` is left with ZERO events on purpose so a Band 4
// click there is genuinely leapfrog-blocked. Confirmed Bands are
// ANSWER_CONFIRMED events (matches `siriHttpSessionRuntime.ts`'s
// `confirmBand()` and the server's `EventDerivedOutputBridge`).
const FIXED_EVENTS: MethodEvent[] = [
  makeEvent({
    unitId: 'strategy_governance',
    level: 0,
    payload: { questionId: 'siri-generic:strategy_governance:0', answerState: 'confirmed', text: 'Potwierdzone.', confirmedByActor: 'participant' },
  }),
  makeEvent({
    unitId: 'strategy_governance',
    level: 0,
    type: 'EVIDENCE_ATTACHED',
    payload: { evidenceId: 'e1', evidenceType: 'document', strength: 'E2' },
  }),
];

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.createSession.mockResolvedValue({ session: makeSession({ state: 'draft' }), idempotentReplay: false });
  hoisted.getSession.mockResolvedValue({ session: makeSession({ state: 'active' }), roles: ['owner'] });
  hoisted.listEvents.mockResolvedValue(FIXED_EVENTS);
  hoisted.transition.mockResolvedValue(makeSession({ state: 'active' }));
  hoisted.appendEvent.mockResolvedValue(makeEvent({}));
});

describe('boot — SERVER source indicator', () => {
  it('shows SERVER once the session is confirmed ready', async () => {
    render(<SiriHttpMethodWorkspaceScreen storage={makeMemoryStorage()} initialViewMode="matrix" />);

    await waitFor(() => {
      const indicator = screen.getByTestId('siri-source-indicator');
      expect(indicator.getAttribute('data-source')).toBe('SERVER');
    });
  });
});

describe('matrix — 16 rows x 6 Bands, no orphan / no missing row', () => {
  it('renders exactly 96 matrix cells', async () => {
    render(<SiriHttpMethodWorkspaceScreen storage={makeMemoryStorage()} initialViewMode="matrix" />);

    await waitFor(() => {
      expect(screen.getAllByTestId('matrix-cell')).toHaveLength(16 * 6);
    });
  });
});

describe('no-leapfrog — blocked cell shows an explicit, visible refusal', () => {
  it('selecting Band 4 for a unit with zero confirmed levels shows the no-leapfrog message and disables the action buttons', async () => {
    render(<SiriHttpMethodWorkspaceScreen storage={makeMemoryStorage()} initialViewMode="matrix" />);

    await waitFor(() => {
      expect(screen.getAllByTestId('matrix-cell')).toHaveLength(96);
      expect(screen.getByTestId('siri-source-indicator').getAttribute('data-source')).toBe('SERVER');
    });

    const cell = document.querySelector('[data-unit-id="vertical_integration"][data-level="4"]') as HTMLElement;
    expect(cell).toBeTruthy();
    await act(async () => {
      fireEvent.click(cell);
    });

    await waitFor(() => {
      const message = screen.getByTestId('siri-no-leapfrog-message');
      expect(message.textContent).toMatch(/Band 4/);
      expect(message.textContent).toMatch(/no-leapfrog/i);
    });

    const proposeButton = screen.getByTestId('siri-propose-band') as HTMLButtonElement;
    const confirmButton = screen.getByTestId('siri-confirm-band') as HTMLButtonElement;
    expect(proposeButton.disabled).toBe(true);
    expect(confirmButton.disabled).toBe(true);
  });

  it('rationale is required — Propose stays disabled with only whitespace text', async () => {
    // `demoSessionId` makes the screen RESUME an existing session (a single
    // `refresh()` on boot, no seeding transitions) — the deterministic way
    // to get `FIXED_EVENTS` (Band 0 for strategy_governance already
    // confirmed) actually reflected before interacting with the matrix.
    render(<SiriHttpMethodWorkspaceScreen storage={makeMemoryStorage()} initialViewMode="matrix" demoSessionId="siri-screen-1" />);
    await waitFor(() => {
      const band0Cell = document.querySelector('[data-unit-id="strategy_governance"][data-level="0"]');
      expect(band0Cell?.getAttribute('aria-label')).toMatch(/, osiągnięty,/);
    });

    // Band 1 for strategy_governance IS open (Band 0 already confirmed by FIXED_EVENTS).
    const cell = document.querySelector('[data-unit-id="strategy_governance"][data-level="1"]') as HTMLElement;
    await act(async () => {
      fireEvent.click(cell);
    });

    const proposeButton = await screen.findByTestId('siri-propose-band');
    expect((proposeButton as HTMLButtonElement).disabled).toBe(true); // empty rationale

    const textarea = screen.getByTestId('siri-rationale-input');
    await act(async () => {
      fireEvent.change(textarea, { target: { value: '   ' } });
    });
    expect((screen.getByTestId('siri-propose-band') as HTMLButtonElement).disabled).toBe(true); // whitespace-only

    await act(async () => {
      fireEvent.change(textarea, { target: { value: 'Realny dowód zebrany.' } });
    });
    expect((screen.getByTestId('siri-propose-band') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('EVIDENCE_MISSING -> "Help content unavailable"', () => {
  it('the Interview panel shows the honest fallback since SIRI has zero dedicated question content', async () => {
    render(<SiriHttpMethodWorkspaceScreen storage={makeMemoryStorage()} initialViewMode="split" />);

    await waitFor(() => {
      expect(screen.getByTestId('question-help-unavailable')).toBeTruthy();
    });
    expect(screen.getByTestId('question-help-unavailable').textContent).toMatch(/Help content unavailable/);
  });
});

describe('TIER — unreachable except via the explicit post-freeze button', () => {
  it('no TIER surface exists anywhere while the session is active', async () => {
    render(<SiriHttpMethodWorkspaceScreen storage={makeMemoryStorage()} initialViewMode="matrix" />);
    await waitFor(() => expect(screen.getAllByTestId('matrix-cell')).toHaveLength(96));
    expect(screen.queryByTestId('siri-open-tier')).toBeNull();
    expect(screen.queryByTestId('siri-tier-screen')).toBeNull();
  });
});
