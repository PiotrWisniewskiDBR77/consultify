/**
 * @vitest-environment jsdom
 *
 * DEC-146/148 (owner accept 27.08, ekran raportu Oceny dzień 27 po
 * FIX-ach): Piotr's explicit requirement was that Assessment keeps BOTH
 * the matrix and the narrative report — flipping `ff_assessmentReportView`
 * to default ON must not hide or replace the MACIERZ tab. This suite mounts
 * the real `MethodWorkspaceShell` tab structure and proves both view modes
 * are present and independently renderable with no flag override.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetAssessmentReportViewFlagCache } from '@/utils/assessmentReportViewFlag';

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
  getAssessmentReportContract: vi.fn(),
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
    getAssessmentReportContract: hoisted.getAssessmentReportContract,
  };
});

const { DrdHttpMethodWorkspaceScreen } = await import('../DrdHttpMethodWorkspaceScreen');
const { DRD_METHOD_PACK_ID, DRD_METHOD_PACK_VERSION } = await import(
  '@/method-core/methods/drd/compileDrdPack'
);

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

describe('DEC-148 — Report tab present and Matrix tab still reachable (default ON, no override)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetAssessmentReportViewFlagCache();
    // At least one chapter — an empty `chapters` array renders the report
    // view's own EmptyState instead of the contract-view test id; this
    // suite only needs to prove the "ready" branch is reachable at all.
    hoisted.getAssessmentReportContract.mockResolvedValue({
      contractVersion: 'assessment-report-contract-v1',
      sessionId: 'sess-http-1',
      outputId: null,
      revision: 0,
      generatedAt: '2026-08-27T10:00:00.000Z',
      methodVersion: 'drd-v1',
      chapters: [
        {
          axisId: 1,
          axisName: 'Axis 1',
          axisNamePL: 'Oś 1',
          maxLevel: 5,
          introduction: { content: null, minWords: 120, maxWords: 180 },
          matrix: { caption: { content: null, minWords: 30, maxWords: 60 }, areas: [] },
          areaComments: [],
          conclusion: {
            content: null,
            minWords: 180,
            maxWords: 260,
            decisionLine: { direction: null, priority: null, horizon: null, successCondition: null },
          },
        },
      ],
    });
  });

  afterEach(() => {
    localStorage.clear();
    resetAssessmentReportViewFlagCache();
  });

  it('renders both the Matrix and Report tabs, and each mode paints its own content', async () => {
    hoisted.getSession.mockResolvedValue({ session: makeSession(), roles: ['owner'] });
    hoisted.listEvents.mockResolvedValue([]);

    render(<DrdHttpMethodWorkspaceScreen storage={makeMemoryStorage()} demoSessionId="sess-http-1" />);

    const shell = await screen.findByTestId('method-workspace-shell');
    const tablist = within(shell).getByRole('tablist', { name: 'Tryb widoku' });

    const matrixTab = within(tablist).getByTestId('view-mode-matrix');
    const reportTab = within(tablist).getByTestId('view-mode-report');
    expect(matrixTab).toBeInTheDocument();
    expect(reportTab).toBeInTheDocument();

    // Matrix mode — its own dedicated view, not gated by the report flag.
    fireEvent.click(matrixTab);
    expect(matrixTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('method-report-workspace')).not.toBeInTheDocument();

    // Report mode — with no flag override, the new contract view renders
    // (default ON) instead of the legacy inline fallback.
    fireEvent.click(reportTab);
    expect(reportTab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() =>
      expect(screen.getByTestId('method-report-workspace')).toBeInTheDocument()
    );
    await waitFor(() =>
      expect(hoisted.getAssessmentReportContract).toHaveBeenCalledWith('sess-http-1')
    );
    await screen.findByTestId('assessment-report-contract-view');

    // Switching back to Matrix keeps it independently reachable — the
    // report flag never hides or replaces it (DEC-148).
    fireEvent.click(matrixTab);
    expect(matrixTab).toHaveAttribute('aria-selected', 'true');
    expect(reportTab).toHaveAttribute('aria-selected', 'false');
  });
});
