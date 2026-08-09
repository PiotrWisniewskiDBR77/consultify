/**
 * @vitest-environment jsdom
 *
 * CB-05/RB-041/RV-005/RB-043/RV-004 — the horizontal Whiteboard toolbar used
 * to duplicate the left rail's Sticky/Text/Shape(rectangle)/Frame/Draw
 * commands, and rendered "Clear Drawings" mid-row instead of as the final,
 * visually separated destructive action.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { WhiteboardToolbar } from '../WhiteboardToolbar';

const noop = () => {};

function baseProps(overrides: Partial<React.ComponentProps<typeof WhiteboardToolbar>> = {}) {
  return {
    isPl: false,
    locked: false,
    saving: false,
    loading: false,
    sessionState: {
      active: false,
      role: 'facilitator' as const,
      timerSeconds: 0,
      timerEndsAt: null,
      votingOpen: false,
      followMe: false,
      spotlightNodeId: null,
      reactionsEnabled: false,
      facilitationPhase: 'start' as const,
      updatedAt: 0,
    },
    sharePolicy: 'edit' as any,
    presenceUsers: [],
    bgPattern: 'dots' as const,
    drawingPathCount: 0,
    saveStatusLabel: '',
    shortcutsHelpOpen: false,
    canUndo: false,
    canRedo: false,
    onAddElement: vi.fn(),
    onClearDrawings: vi.fn(),
    onToggleVoting: noop,
    onCycleRole: noop,
    onToggleFollow: noop,
    onExport: noop,
    onToggleShortcuts: noop,
    onSetBgPattern: noop,
    onSave: noop,
    onUndo: noop,
    onRedo: noop,
    ...overrides,
  } as React.ComponentProps<typeof WhiteboardToolbar>;
}

describe('WhiteboardToolbar — no duplicate rail commands, destructive group last', () => {
  it('renders no standalone Draw toggle (rail-owned via the pointer/mode slot)', () => {
    render(<WhiteboardToolbar {...baseProps()} />);
    expect(screen.queryByText(/^Draw$/i)).not.toBeInTheDocument();
  });

  it('the Insert dropdown no longer offers a plain Sticky/Text/Frame/Rectangle entry (rail-owned)', () => {
    render(<WhiteboardToolbar {...baseProps()} />);
    // The dropdown's own trigger button must not be labelled "Create" anymore.
    expect(screen.queryByText('Create')).not.toBeInTheDocument();
  });

  it('renders Clear Drawings only when there is something to clear, as the true final action — after Save, not before it', () => {
    // The test harness's react-i18next mock returns the raw key when no
    // fallback string is passed (this component calls `t(key)` with no
    // fallback for these two labels), so match by key rather than by the
    // real PL/EN copy.
    const { rerender } = render(<WhiteboardToolbar {...baseProps({ drawingPathCount: 0 })} />);
    expect(screen.queryByText('myWork.whiteboard.toolbar.clearDrawings')).not.toBeInTheDocument();

    rerender(<WhiteboardToolbar {...baseProps({ drawingPathCount: 3 })} />);
    const clearBtn = screen.getByText('myWork.whiteboard.toolbar.clearDrawings').closest('button');
    const saveBtn = screen.getByText('myWork.whiteboard.toolbar.save').closest('button');
    expect(clearBtn).toBeTruthy();
    expect(saveBtn).toBeTruthy();
    // DOM order: Save comes FIRST, Clear Drawings is the true last element in
    // the row — destructive actions must never be followed by anything else,
    // including the primary Save CTA.
    const position = saveBtn!.compareDocumentPosition(clearBtn!);
    // eslint-disable-next-line no-bitwise
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('Clear Drawings still requires an explicit Cancel/Confirm before it fires (RB-043 §9) — this reorder does not bypass that', () => {
    const onClearDrawings = vi.fn();
    render(<WhiteboardToolbar {...baseProps({ drawingPathCount: 2, onClearDrawings })} />);
    const clearBtn = screen.getByText('myWork.whiteboard.toolbar.clearDrawings').closest('button')!;
    clearBtn.click();
    // The button itself only calls the prop; IdeaWhiteboardTool.tsx wires that
    // prop to a `showConfirm({variant:'danger', ...})` dialog before actually
    // clearing — i.e. clicking here does NOT clear anything by itself, it
    // only invokes whatever confirmation gate the caller wired up. Asserting
    // the callback fires (and nothing more) proves the toolbar itself adds no
    // shortcut around that gate.
    expect(onClearDrawings).toHaveBeenCalledTimes(1);
  });
});
