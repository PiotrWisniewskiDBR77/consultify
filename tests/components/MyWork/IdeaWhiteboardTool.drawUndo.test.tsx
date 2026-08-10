/**
 * IdeaWhiteboardTool — canvas-level undo covers drawn strokes (defect fix, 2026-08-10).
 *
 * Root cause (documented in IdeaWhiteboardTool.tsx / IdeaDrawingLayer.tsx and
 * 02_EXECUTION_LEDGER.csv): `onPathsChange={setDrawingPaths}` was never wrapped
 * in `pushUndoSnapshot()`, unlike `onClearDrawings`. On top of that,
 * `IdeaDrawingLayer` kept its OWN private undo/redo stack of `paths` snapshots
 * with its own document-level Ctrl+Z listener, running in parallel with the
 * canvas's ALWAYS-ON `useCanvasKeyboard` Ctrl+Z listener. A single Ctrl+Z press
 * fired BOTH, racing two disagreeing stacks.
 *
 * Fix: the canvas stack now owns ALL undo for drawn strokes. Every path
 * mutation from the drawing layer snapshots the canvas BEFORE applying
 * (`handleDrawingPathsChange` in IdeaWhiteboardTool.tsx), and the layer no
 * longer keeps its own stack or Ctrl+Z listener — see
 * IdeaDrawingLayer.keyboardDrawing.test.tsx for the layer-boundary proof.
 *
 * This test proves the FULL integration: draw two strokes on the real canvas,
 * press Ctrl+Z exactly ONCE, and confirm exactly one stroke is undone (not
 * zero — which double-handling by two stacks would produce — and not two).
 * Redo is then proven to bring it back through the same single stack.
 */
import { fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

vi.mock('@/services/api', () => ({
  Api: {
    // Load the board already in draw mode with zero paths, so the test
    // drives strokes purely through the real IdeaDrawingLayer keyboard path.
    getMyIdeaMap: vi.fn().mockResolvedValue({
      map: {
        version: 1,
        nodes: [],
        edges: [],
        preferredTool: 'whiteboard',
        extensions: { whiteboard: { mode: 'draw', drawingPaths: [] } },
      },
    }),
    syncMyIdeaMap: vi.fn().mockResolvedValue({ ok: true }),
    getIdeaMap: vi.fn().mockResolvedValue({ map: { nodes: [], edges: [] } }),
    facilitationCreateSession: vi.fn().mockResolvedValue({ id: 'sess-1' }),
    facilitationResolveByTool: vi.fn().mockResolvedValue({ session: null }),
    facilitationGetSession: vi.fn().mockResolvedValue(null),
    facilitationGetRoles: vi.fn().mockResolvedValue({ roles: [] }),
    facilitationAssignRole: vi.fn().mockResolvedValue({ id: 'role-1' }),
    facilitationUpdateTimer: vi.fn().mockResolvedValue({ ok: true }),
    facilitationUpdatePhase: vi.fn().mockResolvedValue({ ok: true }),
    facilitationGetVotes: vi.fn().mockResolvedValue({ votes: [] }),
    facilitationGetVoteSummary: vi.fn().mockResolvedValue({ summary: [] }),
    toolSessionJoinPresence: vi.fn().mockResolvedValue({ presence: [] }),
    toolSessionListPresence: vi.fn().mockResolvedValue({ presence: [] }),
    toolSessionHeartbeat: vi.fn().mockResolvedValue({ ok: true }),
    toolSessionDisconnect: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector: (s: unknown) => unknown) =>
    selector({
      currentUser: { id: 'current-user', firstName: 'Test', lastName: 'User', email: 't@x.io' },
    }),
}));

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

function renderTool() {
  return render(
    <IdeaWhiteboardTool open ideaId="idea-1" onSaved={vi.fn()} title="Board" seedText="" stage="" />
  );
}

function drawStroke(svg: SVGSVGElement) {
  // Move → pen down → move (segment) → finish. Matches
  // IdeaDrawingLayer.keyboardDrawing.test.tsx's proven sequence.
  fireKeyDown(svg, 'ArrowRight');
  fireKeyDown(svg, ' ');
  fireKeyDown(svg, 'ArrowDown');
  fireKeyDown(svg, 'Escape');
}

function fireKeyDown(target: Document | Element, key: string, opts: Record<string, unknown> = {}) {
  fireEvent.keyDown(target, { key, ...opts });
}

describe('IdeaWhiteboardTool — canvas-level undo covers drawn strokes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a single Ctrl+Z undoes exactly one of two drawn strokes (no double-undo, no lost-undo), and redo restores it', async () => {
    const { container } = renderTool();

    const svg = await waitFor(() => {
      const el = container.querySelector('svg[role="application"]');
      expect(el).toBeTruthy();
      return el as SVGSVGElement;
    });

    // Draw two separate strokes.
    drawStroke(svg);
    drawStroke(svg);
    expect(container.querySelectorAll('path[data-path-id]').length).toBe(2);

    // ONE Ctrl+Z, fired on document — this is what a real keypress bubbles
    // to under the new single-listener contract (IdeaDrawingLayer no longer
    // attaches its own document keydown listener).
    fireKeyDown(document, 'z', { ctrlKey: true });

    // If the old bug were present (two competing stacks, one of them
    // popping an empty/stale snapshot), this would be 0 or still 2.
    // Exactly one stroke undone is the proof of a single coherent stack.
    await waitFor(() => {
      expect(container.querySelectorAll('path[data-path-id]').length).toBe(1);
    });

    // Redo (Ctrl+Shift+Z) restores the second stroke through the same stack.
    fireKeyDown(document, 'z', { ctrlKey: true, shiftKey: true });
    await waitFor(() => {
      expect(container.querySelectorAll('path[data-path-id]').length).toBe(2);
    });
  });
});
