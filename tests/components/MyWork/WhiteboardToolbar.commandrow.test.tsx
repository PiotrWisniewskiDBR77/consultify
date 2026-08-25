/**
 * WhiteboardToolbar — STREFA GÓRNA command-row hierarchy (Editor Shell Canon §2).
 *
 * Locks the primary / secondary / overflow structure for the M09 Whiteboard
 * command row:
 *   - primary (visible): Create · Draw · Save
 *   - secondary (visible): Undo · Redo
 *   - overflow "…": voting / role / follow / export / shortcuts / background
 *
 * Guards against regressing back to the old flat ~10-button row and asserts the
 * overflow menu is closed until opened (no "three flat layers").
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WhiteboardToolbar } from '../../../src/components/MyWork/whiteboard/WhiteboardToolbar';

function makeProps(over: Partial<React.ComponentProps<typeof WhiteboardToolbar>> = {}) {
  return {
    isPl: false,
    locked: false,
    saving: false,
    loading: false,
    whiteboardMode: 'board' as const,
    sessionState: { votingOpen: false, followMe: false } as any,
    sharePolicy: {} as any,
    presenceUsers: [],
    bgPattern: 'dots' as const,
    drawingPathCount: 0,
    saveStatusLabel: '',
    shortcutsHelpOpen: false,
    canUndo: true,
    canRedo: true,
    whiteboardModeCopy: { toggleLabel: 'Draw', modeLabel: '', exitHint: '', helper: '' },
    onAddElement: vi.fn(),
    onSetBoardMode: vi.fn(),
    onClearDrawings: vi.fn(),
    onToggleVoting: vi.fn(),
    onCycleRole: vi.fn(),
    onToggleFollow: vi.fn(),
    onExport: vi.fn(),
    onToggleShortcuts: vi.fn(),
    onSetBgPattern: vi.fn(),
    onSave: vi.fn(),
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    ...over,
  };
}

describe('WhiteboardToolbar — command-row hierarchy', () => {
  it('keeps Save as a visible primary action', () => {
    render(<WhiteboardToolbar {...makeProps()} />);
    expect(screen.getByRole('button', { name: /myWork\.whiteboard\.toolbar\.save/i })).toBeInTheDocument();
  });

  // 2026-07-28 (Zadanie C, src/utils/canvasUndoInRailOnlyFlag.ts): the owner
  // reviewed the real screens and accepted removing the Undo/Redo pair from
  // this horizontal toolbar row — the same action stays live in the LEFT rail
  // (`wb_undo`/`wb_redo` slots), the Ctrl/Cmd+Z shortcuts, and the right
  // panel's History section ("ZERO UTRATY FUNKCJI"). `ff_canvasUndoInRailOnly`
  // now defaults ON, so this toolbar no longer renders its own Undo/Redo
  // buttons by default — this test previously asserted the pre-acceptance
  // layout and had gone stale. The flag's escape hatch (`?ff_canvasUndoInRailOnly=0`)
  // still exists for the legacy in-toolbar rendering; that path is exercised
  // directly against the flag module, not here.
  it('does not duplicate Undo/Redo in the toolbar row (rail-only by default)', () => {
    render(<WhiteboardToolbar {...makeProps()} />);
    expect(screen.queryByRole('button', { name: /myWork\.whiteboard\.toolbar\.undo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /myWork\.whiteboard\.toolbar\.redo/i })).toBeNull();
  });

  it('collapses secondary tools behind a single overflow "…" (no flat row)', () => {
    render(<WhiteboardToolbar {...makeProps()} />);
    // The overflow trigger exists…
    expect(screen.getByTestId('whiteboard-toolbar-overflow')).toBeInTheDocument();
    // …and its menu is closed until clicked (voting/export/shortcuts are NOT
    // sitting flat in the row).
    expect(screen.queryByTestId('whiteboard-toolbar-overflow-menu')).toBeNull();
    expect(
      screen.queryByRole('button', { name: /myWork\.whiteboard\.toolbar\.export/i })
    ).toBeNull();
  });

  it('reveals the secondary tools when the overflow is opened', () => {
    const props = makeProps();
    render(<WhiteboardToolbar {...props} />);
    fireEvent.click(screen.getByTestId('whiteboard-toolbar-overflow'));
    const menu = screen.getByTestId('whiteboard-toolbar-overflow-menu');
    expect(menu).toBeInTheDocument();
    // Export lives in the overflow now.
    const exportItem = screen.getByRole('menuitem', {
      name: /myWork\.whiteboard\.toolbar\.export/i,
    });
    fireEvent.click(exportItem);
    expect(props.onExport).toHaveBeenCalledTimes(1);
  });

  it('routes voting/follow through the overflow to the right handlers', () => {
    const props = makeProps();
    render(<WhiteboardToolbar {...props} />);
    fireEvent.click(screen.getByTestId('whiteboard-toolbar-overflow'));
    fireEvent.click(
      screen.getByRole('menuitem', { name: /myWork\.whiteboard\.toolbar\.voting/i })
    );
    expect(props.onToggleVoting).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('whiteboard-toolbar-overflow'));
    fireEvent.click(
      screen.getByRole('menuitem', { name: /myWork\.whiteboard\.toolbarExtra\.follow/i })
    );
    expect(props.onToggleFollow).toHaveBeenCalledTimes(1);
  });
});
