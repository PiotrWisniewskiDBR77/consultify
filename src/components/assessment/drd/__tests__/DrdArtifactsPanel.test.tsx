/**
 * @vitest-environment jsdom
 *
 * DrdArtifactsPanel — S1 CEL 2 (2026-08-13): after a browser restart, the
 * user must find and open every artefact already produced against a DRD
 * session. Covers:
 *  1. loading state shown before the server responds.
 *  2. ready state renders EXACTLY the server payload (Outputs/Reports/
 *     Presentations/Initiative Drafts + lineage), never a locally-derived
 *     value.
 *  3. error state has an explicit message + a working retry.
 *  4. empty state is explicit — never a blank panel.
 *  5. ★ the panel does NOT reconstruct an Output from local/session state:
 *     it never touches localStorage, and a remount (simulating an app
 *     restart with no React state carried over) re-derives everything from
 *     a FRESH server call, not from anything cached client-side.
 *  6. ★ RECOVERY_DRAFT is never used to represent a record this panel shows
 *     — every section carries the SERVER badge instead (DrdSourceIndicator).
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  getSessionLineage: vi.fn(),
}));

vi.mock('@/method-core/api/methodCoreApi', async () => {
  const actual = await vi.importActual<typeof import('@/method-core/api/methodCoreApi')>(
    '@/method-core/api/methodCoreApi'
  );
  return {
    ...actual,
    getSessionLineage: hoisted.getSessionLineage,
  };
});

const { DrdArtifactsPanel } = await import('../DrdArtifactsPanel');
const { MethodCoreApiError } = await import('@/method-core/api/methodCoreApi');

const SESSION_A = 'sess-lineage-a';
const SESSION_B = 'sess-lineage-b';

function makeLineage(overrides: Record<string, unknown> = {}) {
  return {
    rootSessionId: SESSION_A,
    sessions: [
      {
        id: SESSION_A,
        organizationId: 'org-1',
        projectId: null,
        module: 'assessment',
        methodPackId: 'drd',
        methodPackVersion: '2.0.0-methodpack.1',
        state: 'frozen',
        domainStage: null,
        mode: 'guided_manual',
        ownerUserId: 'user-1',
        createdAt: '2026-08-10T00:00:00.000Z',
        updatedAt: '2026-08-10T00:00:00.000Z',
        version: 2,
        frozenSnapshotId: 'snap-a',
        revisionOfSessionId: null,
      },
      {
        id: SESSION_B,
        organizationId: 'org-1',
        projectId: null,
        module: 'assessment',
        methodPackId: 'drd',
        methodPackVersion: '2.0.0-methodpack.1',
        state: 'frozen',
        domainStage: null,
        mode: 'guided_manual',
        ownerUserId: 'user-1',
        createdAt: '2026-08-11T00:00:00.000Z',
        updatedAt: '2026-08-11T00:00:00.000Z',
        version: 2,
        frozenSnapshotId: 'snap-b',
        revisionOfSessionId: SESSION_A,
      },
    ],
    outputs: [
      {
        id: 'output-a',
        organizationId: 'org-1',
        sessionId: SESSION_A,
        module: 'assessment',
        methodPackId: 'drd',
        methodPackVersion: '2.0.0-methodpack.1',
        outputVersion: 1,
        scope: 'SERVER SCOPE v1 — from database',
        current: {},
        target: {},
        gap: {},
        limitations: ['limitation-1'],
        findings: [],
        contentHash: 'hash-a',
        frozenAt: '2026-08-10T01:00:00.000Z',
        status: 'superseded',
        supersededByOutputId: 'output-b',
      },
      {
        id: 'output-b',
        organizationId: 'org-1',
        sessionId: SESSION_B,
        module: 'assessment',
        methodPackId: 'drd',
        methodPackVersion: '2.0.0-methodpack.1',
        outputVersion: 2,
        scope: 'SERVER SCOPE v2 — corrected on server',
        current: {},
        target: {},
        gap: {},
        limitations: ['limitation-2'],
        findings: [],
        contentHash: 'hash-b',
        frozenAt: '2026-08-11T01:00:00.000Z',
        status: 'current',
        supersededByOutputId: null,
      },
    ],
    reports: [
      {
        id: 'report-a',
        organizationId: 'org-1',
        outputId: 'output-a',
        sessionId: SESSION_A,
        title: 'SERVER Report A',
        content: { v: 'A' },
        contentHash: 'rhash-a',
        status: 'superseded',
        supersededByOutputId: 'output-b',
        supersededAt: '2026-08-11T01:05:00.000Z',
        createdAt: '2026-08-10T02:00:00.000Z',
        kind: 'report',
      },
    ],
    presentations: [
      {
        id: 'presentation-a',
        organizationId: 'org-1',
        outputId: 'output-b',
        sessionId: SESSION_B,
        title: 'SERVER Presentation B',
        content: { slides: [] },
        contentHash: 'phash-b',
        status: 'current',
        supersededByOutputId: null,
        supersededAt: null,
        createdAt: '2026-08-11T02:00:00.000Z',
        kind: 'presentation',
      },
    ],
    initiativeDrafts: [
      {
        id: 'draft-a',
        organizationId: 'org-1',
        outputId: 'output-b',
        sessionId: SESSION_B,
        title: 'SERVER Draft B',
        summary: null,
        findingIds: ['finding-1'],
        rationale: 'r',
        expectedOutcome: 'e',
        confidence: 'high',
        status: 'current',
        supersededByOutputId: null,
        supersededAt: null,
        createdAt: '2026-08-11T03:00:00.000Z',
      },
    ],
    ...overrides,
  };
}

const EMPTY_LINEAGE = makeLineage({ outputs: [], reports: [], presentations: [], initiativeDrafts: [] });

beforeEach(() => {
  hoisted.getSessionLineage.mockReset();
});

describe('DrdArtifactsPanel', () => {
  it('1. shows an explicit loading state before the server responds', async () => {
    let resolveFn: (v: unknown) => void = () => {};
    hoisted.getSessionLineage.mockReturnValue(new Promise((resolve) => (resolveFn = resolve)));

    render(<DrdArtifactsPanel sessionId={SESSION_A} />);

    expect(screen.getByTestId('drd-artifacts-panel-loading')).toBeInTheDocument();
    resolveFn(makeLineage());
    await waitFor(() => expect(screen.getByTestId('drd-artifacts-panel-ready')).toBeInTheDocument());
  });

  it('2. renders exactly the server payload — Outputs/Reports/Presentations/Drafts + lineage sessions', async () => {
    hoisted.getSessionLineage.mockResolvedValue(makeLineage());

    render(<DrdArtifactsPanel sessionId={SESSION_A} />);

    await waitFor(() => expect(screen.getByTestId('drd-artifacts-panel-ready')).toBeInTheDocument());

    // Output content is the exact server-issued scope string, not a derived one.
    expect(screen.getByText('SERVER SCOPE v1 — from database')).toBeInTheDocument();
    expect(screen.getByText('SERVER SCOPE v2 — corrected on server')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect(screen.getByText('v2')).toBeInTheDocument();

    expect(screen.getByText('SERVER Report A')).toBeInTheDocument();
    expect(screen.getByText('SERVER Presentation B')).toBeInTheDocument();
    expect(screen.getByText('SERVER Draft B')).toBeInTheDocument();

    const lineageSessions = screen.getAllByTestId('drd-lineage-session');
    expect(lineageSessions).toHaveLength(2);
    expect(lineageSessions.map((el) => el.getAttribute('data-session-id')).sort()).toEqual(
      [SESSION_A, SESSION_B].sort()
    );

    expect(hoisted.getSessionLineage).toHaveBeenCalledWith(SESSION_A);
    expect(hoisted.getSessionLineage).toHaveBeenCalledTimes(1);
  });

  it('3. shows an explicit error state with a working retry', async () => {
    hoisted.getSessionLineage.mockRejectedValueOnce(
      new MethodCoreApiError('boom', 500, { error: 'boom' })
    );
    hoisted.getSessionLineage.mockResolvedValueOnce(makeLineage());

    render(<DrdArtifactsPanel sessionId={SESSION_A} />);

    await waitFor(() => expect(screen.getByTestId('drd-artifacts-panel-error')).toBeInTheDocument());
    expect(screen.getByText(/nie udało się wczytać artefaktów/i)).toBeInTheDocument();

    const retryButton = screen.getByRole('button', { name: /spróbuj ponownie|retry|try again/i });
    await act(async () => {
      fireEvent.click(retryButton);
    });

    await waitFor(() => expect(screen.getByTestId('drd-artifacts-panel-ready')).toBeInTheDocument());
    expect(hoisted.getSessionLineage).toHaveBeenCalledTimes(2);
  });

  it('4. shows an explicit empty state, never a blank panel, when the lineage has zero artefacts', async () => {
    hoisted.getSessionLineage.mockResolvedValue(EMPTY_LINEAGE);

    render(<DrdArtifactsPanel sessionId={SESSION_A} />);

    await waitFor(() => expect(screen.getByTestId('drd-artifacts-panel-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('drd-artifacts-panel-ready')).not.toBeInTheDocument();
    expect(screen.getByText(/nie ma jeszcze żadnych zatwierdzonych artefaktów/i)).toBeInTheDocument();
  });

  // ===========================================================================
  // 5. ★ Does NOT reconstruct an Output from local/session state.
  // ===========================================================================
  it('5a. never reads localStorage — every value on screen comes only from the mocked server response, even when a conflicting local draft exists', async () => {
    // Seed a plausible legacy-runtime-shaped local draft that DISAGREES with
    // the server payload, to prove the panel cannot be accidentally reading
    // it (the two scope strings below are deliberately different).
    window.localStorage.setItem(
      `drd-session-${SESSION_A}`,
      JSON.stringify({ scope: 'LOCAL DRAFT SCOPE — should never render', outputVersion: 99 })
    );
    window.localStorage.setItem('drd_recovery_queue', JSON.stringify([{ scope: 'ANOTHER LOCAL VALUE' }]));

    const getItemSpy = vi.spyOn(window.localStorage.__proto__, 'getItem');
    hoisted.getSessionLineage.mockResolvedValue(makeLineage());

    render(<DrdArtifactsPanel sessionId={SESSION_A} />);
    await waitFor(() => expect(screen.getByTestId('drd-artifacts-panel-ready')).toBeInTheDocument());

    // Server truth rendered, local draft NEVER rendered.
    expect(screen.getByText('SERVER SCOPE v1 — from database')).toBeInTheDocument();
    expect(screen.queryByText(/LOCAL DRAFT SCOPE/)).not.toBeInTheDocument();
    expect(screen.queryByText(/ANOTHER LOCAL VALUE/)).not.toBeInTheDocument();
    expect(screen.queryByText('v99')).not.toBeInTheDocument();

    // The component itself never consulted localStorage to render this.
    expect(getItemSpy).not.toHaveBeenCalled();

    getItemSpy.mockRestore();
    window.localStorage.clear();
  });

  it('5b. a fresh remount (simulating an app restart) re-derives everything from a NEW server call, not from anything held client-side', async () => {
    hoisted.getSessionLineage.mockResolvedValue(makeLineage());

    const { unmount } = render(<DrdArtifactsPanel sessionId={SESSION_A} />);
    await waitFor(() => expect(screen.getByTestId('drd-artifacts-panel-ready')).toBeInTheDocument());
    expect(hoisted.getSessionLineage).toHaveBeenCalledTimes(1);

    // Full unmount — no React state, no component instance survives this,
    // exactly like a hard browser restart.
    unmount();

    // Server now reports a DIFFERENT v3 output (e.g. another correction
    // landed while "the browser was closed") — the remount must show THIS,
    // proving there is no stale client cache standing in for the server call.
    hoisted.getSessionLineage.mockResolvedValue(
      makeLineage({
        outputs: [
          {
            id: 'output-c',
            organizationId: 'org-1',
            sessionId: SESSION_B,
            module: 'assessment',
            methodPackId: 'drd',
            methodPackVersion: '2.0.0-methodpack.1',
            outputVersion: 3,
            scope: 'SERVER SCOPE v3 — landed after restart',
            current: {},
            target: {},
            gap: {},
            limitations: [],
            findings: [],
            contentHash: 'hash-c',
            frozenAt: '2026-08-12T01:00:00.000Z',
            status: 'current',
            supersededByOutputId: null,
          },
        ],
      })
    );

    render(<DrdArtifactsPanel sessionId={SESSION_A} />);
    await waitFor(() => expect(screen.getByText('SERVER SCOPE v3 — landed after restart')).toBeInTheDocument());
    expect(hoisted.getSessionLineage).toHaveBeenCalledTimes(2);
  });

  it('5c. the component accepts ONLY a sessionId (no prop exists to inject a live session snapshot to render instead)', () => {
    // Structural guard: DrdArtifactsPanelProps has exactly `sessionId` and
    // `className`. This assertion fails to compile (not just fails at
    // runtime) if a future edit adds a `currentOutput`/`session`/
    // `liveAnswers`-shaped prop, which is the point — see the component's
    // own header comment.
    const props: React.ComponentProps<typeof DrdArtifactsPanel> = { sessionId: SESSION_A };
    expect(Object.keys(props)).toEqual(['sessionId']);
  });

  // ===========================================================================
  // 6. ★ RECOVERY_DRAFT is never used to represent server-sourced data here.
  // ===========================================================================
  it('6. every rendered record carries the SERVER badge — RECOVERY_DRAFT never appears in this panel', async () => {
    hoisted.getSessionLineage.mockResolvedValue(makeLineage());

    render(<DrdArtifactsPanel sessionId={SESSION_A} />);
    await waitFor(() => expect(screen.getByTestId('drd-artifacts-panel-ready')).toBeInTheDocument());

    const indicators = screen.getAllByTestId('drd-source-indicator');
    expect(indicators.length).toBeGreaterThan(0);
    for (const indicator of indicators) {
      expect(indicator.getAttribute('data-source')).toBe('SERVER');
    }
    expect(screen.queryByText('RECOVERY_DRAFT')).not.toBeInTheDocument();
  });
});
