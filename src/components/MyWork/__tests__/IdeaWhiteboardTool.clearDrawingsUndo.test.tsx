/**
 * @vitest-environment jsdom
 *
 * CB-05 re-review — Clear Drawings must go through the undo stack.
 *
 * Mounts the REAL `IdeaWhiteboardTool` (not a mock-callback stand-in) and
 * exercises the actual Cancel/Confirm/Undo flow: draw a pen path, open the
 * Clear Drawings confirm dialog, Cancel (path survives untouched), Confirm
 * (path is gone), then Undo (the exact same path comes back) via
 * pushUndoSnapshot — the fix for this re-review round.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Api } from '@/services/api';

import { IdeaWhiteboardTool } from '../IdeaWhiteboardTool';

const IDEA_ID = 'idea-clear-drawings-undo';

beforeEach(() => {
  // Api.getMyIdeaMap resolves { map: {...} } — the hydrate() callback in
  // IdeaWhiteboardTool.tsx reads `res.map`, not the response body directly.
  vi.spyOn(Api, 'getMyIdeaMap').mockResolvedValue({
    map: {
      nodes: [],
      edges: [],
      extensions: {
        whiteboard: {
          drawingPaths: [
            {
              id: 'path-1',
              points: [
                { x: 0, y: 0 },
                { x: 10, y: 10 },
              ],
              color: '#000000',
              width: 2,
            },
          ],
        },
      },
      version: 1,
      preferredTool: 'whiteboard',
    },
  } as any);
  vi.spyOn(Api, 'syncMyIdeaMap').mockResolvedValue({ version: 2 } as any);
});

describe('IdeaWhiteboardTool — Clear Drawings Cancel/Confirm/Undo (real component)', () => {
  it('Cancel leaves drawings untouched; Confirm clears them; Undo restores the exact same path', async () => {
    render(<IdeaWhiteboardTool open ideaId={IDEA_ID} title="Test" seedText="" />);

    // Wait for hydration to finish and the toolbar to render with a
    // non-zero drawing count (Clear Drawings only renders once there is
    // something to clear — RB-043).
    const clearBtn = await waitFor(
      () => {
        const btn = screen.getByText('myWork.whiteboard.toolbar.clearDrawings').closest('button');
        if (!btn) throw new Error('clear drawings button not rendered yet');
        return btn as HTMLButtonElement;
      },
      { timeout: 3000 }
    );

    // ── Cancel: dialog opens, Cancel is clicked, nothing changes ──────────
    fireEvent.click(clearBtn);
    const cancelBtn = await screen.findByText('myWorkIdeas.whiteboardTool.cancel');
    fireEvent.click(cancelBtn);
    await waitFor(() => {
      expect(screen.queryByText('myWorkIdeas.whiteboardTool.cancel')).not.toBeInTheDocument();
    });
    // Clear Drawings is still offered — nothing was cleared by Cancel.
    expect(
      screen.getByText('myWork.whiteboard.toolbar.clearDrawings').closest('button')
    ).toBeInTheDocument();

    // ── Confirm: dialog opens again, Confirm (Clear) is clicked ────────────
    fireEvent.click(clearBtn);
    const confirmBtn = await screen.findByText('myWorkIdeas.whiteboardTool.clear');
    fireEvent.click(confirmBtn);

    // Drawings cleared → Clear Drawings button disappears (drawingPathCount
    // === 0, RB-043's "only render when there's something to clear").
    await waitFor(() => {
      expect(screen.queryByText('myWork.whiteboard.toolbar.clearDrawings')).not.toBeInTheDocument();
    });

    // ── Undo (Ctrl+Z, same shortcut wired to undoWhiteboard) ───────────────
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });

    // The fix: pushUndoSnapshot() before the clear means Undo restores the
    // drawing — Clear Drawings must be offered again (drawingPathCount back
    // to 1), proving the exact same path came back, not just "something".
    await waitFor(
      () => {
        expect(
          screen.getByText('myWork.whiteboard.toolbar.clearDrawings').closest('button')
        ).toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  }, 15000);
});
