/**
 * CommentPinBadge across whiteboard node types.
 *
 * Verifies the B3 "comments are visible on every node" feature: the shared
 * CommentPinBadge shows on TextBlockNode and ShapeNode when a node has
 * comments, stays hidden when it has none, and — when clicked — dispatches the
 * exact same `idea-node-open-detail` event the sticky note has always used to
 * open IdeaNodeDetailDrawer. No new comment UI is asserted here; only presence
 * + the open-drawer wiring.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock React Flow (Handle / Position / NodeResizer are the only pieces the
// node components use at render time).
vi.mock('reactflow', () => ({
  Handle: ({ type, position }: any) => <div data-testid={`handle-${type}-${position}`} />,
  NodeResizer: () => <div data-testid="node-resizer" />,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

// Import after mocks.
import { ShapeNode } from '../../../../src/components/MyWork/whiteboard/nodes/ShapeNode';
import { TextBlockNode } from '../../../../src/components/MyWork/whiteboard/nodes/TextBlockNode';

const baseProps = {
  type: 'node',
  selected: false,
  isConnectable: true,
  xPos: 0,
  yPos: 0,
  zIndex: 0,
  dragging: false,
} as const;

const BADGE = 'comment-pin-badge';

describe.each([
  { name: 'TextBlockNode', Node: TextBlockNode, id: 'tb-1' },
  { name: 'ShapeNode', Node: ShapeNode, id: 'sh-1' },
])('CommentPinBadge on $name', ({ Node, id }) => {
  it('renders the pin when the node has comments', () => {
    render(
      <Node
        {...(baseProps as any)}
        id={id}
        data={{ label: 'x', comments: [{ id: 'c1' }, { id: 'c2' }] }}
      />
    );
    const badge = screen.getByTestId(BADGE);
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('2');
  });

  it('does NOT render the pin when commentCount is 0', () => {
    render(<Node {...(baseProps as any)} id={id} data={{ label: 'x', comments: [] }} />);
    expect(screen.queryByTestId(BADGE)).toBeNull();
  });

  it('does NOT render the pin when comments is undefined', () => {
    render(<Node {...(baseProps as any)} id={id} data={{ label: 'x' }} />);
    expect(screen.queryByTestId(BADGE)).toBeNull();
  });

  describe('click opens the shared detail drawer', () => {
    let handler: ReturnType<typeof vi.fn>;
    beforeEach(() => {
      handler = vi.fn();
      window.addEventListener('idea-node-open-detail', handler as EventListener);
    });
    afterEach(() => {
      window.removeEventListener('idea-node-open-detail', handler as EventListener);
    });

    it('dispatches idea-node-open-detail with the node id', () => {
      render(
        <Node
          {...(baseProps as any)}
          id={id}
          data={{ label: 'x', comments: [{ id: 'c1' }] }}
        />
      );
      fireEvent.click(screen.getByTestId(BADGE));
      expect(handler).toHaveBeenCalledTimes(1);
      const evt = handler.mock.calls[0][0] as CustomEvent;
      expect(evt.detail).toEqual({ nodeId: id });
    });
  });
});
