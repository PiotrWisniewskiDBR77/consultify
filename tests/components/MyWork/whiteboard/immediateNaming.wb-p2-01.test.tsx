/**
 * WB-P2-01 (docs/qa/ideas-manual-audit-2026-08-09/08_P1_P3_EXECUTION_PLAN_
 * FOR_CLAUDE.md §6 Whiteboard): "newly created sticky/text objects enter
 * inline naming immediately... (today a first-time user must somehow know
 * to double-click)". Exercises the real node components the way
 * `IdeaWhiteboardTool.createNode` actually wires them: a brand-new object
 * carries `data._isNew` + `data.onConsumeAutoEdit`, exactly as stamped by
 * `addElement` for a rail/toolbar "Add sticky"/"Add text" with no explicit
 * label.
 */
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('reactflow', () => ({
  Handle: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  NodeResizer: () => null,
}));

import { StickyNoteNode } from '../../../../src/components/MyWork/whiteboard/nodes/StickyNoteNode';
import { TextBlockNode } from '../../../../src/components/MyWork/whiteboard/nodes/TextBlockNode';

describe('StickyNoteNode — immediate naming (WB-P2-01)', () => {
  it('opens straight into the inline editor (textarea) when data._isNew is true — no double-click needed', () => {
    render(
      <StickyNoteNode
        id="n1"
        selected
        data={{ label: 'New note', _isNew: true, onConsumeAutoEdit: vi.fn() }}
      />
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('does NOT auto-open the editor for an existing (not-new) note', () => {
    render(<StickyNoteNode id="n1" selected data={{ label: 'New note' }} />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('consumes (clears) `_isNew` exactly once, right after mount', () => {
    const onConsumeAutoEdit = vi.fn();
    render(
      <StickyNoteNode
        id="n1"
        selected
        data={{ label: 'New note', _isNew: true, onConsumeAutoEdit }}
      />
    );
    expect(onConsumeAutoEdit).toHaveBeenCalledTimes(1);
  });
});

describe('TextBlockNode — immediate naming (WB-P2-01)', () => {
  it('opens straight into the inline editor (textarea) when data._isNew is true', () => {
    render(
      <TextBlockNode
        id="t1"
        selected
        data={{ label: 'Text', _isNew: true, onConsumeAutoEdit: vi.fn() }}
      />
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('does NOT auto-open the editor for an existing (not-new) text block', () => {
    render(<TextBlockNode id="t1" selected data={{ label: 'Text' }} />);
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
