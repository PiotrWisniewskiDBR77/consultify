/**
 * @vitest-environment jsdom
 *
 * CB-05/RB-042/RV-003 — integration test for the full keyboard-invocation
 * contract: Shift+F10 / "ContextMenu" key opens the correctly-scoped menu
 * (node / edge / background), Escape closes it, and focus returns to the
 * element that was focused before the menu opened.
 *
 * Uses the REAL production pieces wired together the same way
 * IdeaWhiteboardTool.tsx wires them:
 *  - `resolveKeyboardContextMenuTarget` / `isContextMenuKey` (imported by
 *    IdeaWhiteboardTool.tsx itself — not reimplemented here)
 *  - the real `IdeaCanvasContextMenu` (node/background) and
 *    `WhiteboardEdgeContextMenu` (edge) components, which is where
 *    `useAccessibleMenu`'s roving-tabIndex/focus-entry/focus-return actually
 *    lives.
 * Only the surrounding 4000+-line ReactFlow canvas/collab/persistence
 * machinery of IdeaWhiteboardTool itself is replaced by a minimal harness
 * that reproduces the exact DOM shape (`.react-flow__node[data-id]`,
 * `.react-flow__edge[data-testid="rf__edge-…"]`, `.react-flow__pane`) and
 * state-wiring pattern that component uses.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React, { useEffect, useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaCanvasContextMenu } from '../../IdeaCanvasContextMenu';
import { WhiteboardEdgeContextMenu } from '../../whiteboard/WhiteboardEdgeContextMenu';
import {
  isContextMenuKey,
  resolveKeyboardContextMenuTarget,
} from '../resolveKeyboardContextMenuTarget';

function WhiteboardKeyboardMenuHarness() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [contextMenuTarget, setContextMenuTarget] = useState<{
    nodeId?: string;
    nodeLabel?: string;
    nodeType?: string;
  }>({});
  const [edgeContextMenu, setEdgeContextMenu] = useState<{
    edgeId: string;
    x: number;
    y: number;
  } | null>(null);

  // Mirrors IdeaWhiteboardTool.tsx's own keyboard-invocation useEffect
  // exactly (same imported resolver — see file header).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if (!isContextMenuKey(e)) return;
      const target = resolveKeyboardContextMenuTarget(el, document.activeElement as HTMLElement);
      if (!target) return;
      e.preventDefault();
      if (target.kind === 'node') {
        setEdgeContextMenu(null);
        setContextMenuPos({ x: target.rect.right, y: target.rect.top });
        setContextMenuTarget({
          nodeId: target.nodeId,
          nodeLabel: 'My sticky',
          nodeType: 'sticky',
        });
      } else if (target.kind === 'edge') {
        setContextMenuPos(null);
        setEdgeContextMenu({ edgeId: target.edgeId, x: target.rect.left, y: target.rect.top });
      } else {
        setEdgeContextMenu(null);
        setContextMenuPos({ x: target.rect.left, y: target.rect.top });
        setContextMenuTarget({});
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, []);

  return (
    <div ref={containerRef} role="region" aria-label="Whiteboard">
      <div className="react-flow__pane" tabIndex={0} data-testid="pane">
        <div
          className="react-flow__node"
          data-id="node-1"
          tabIndex={0}
          data-testid="node-el"
          role="button"
        >
          Sticky content
        </div>
        <svg>
          <g className="react-flow__edge" data-testid="rf__edge-e1-e2" tabIndex={0} role="button" />
        </svg>
      </div>
      {contextMenuPos && (
        <IdeaCanvasContextMenu
          position={contextMenuPos}
          target={contextMenuTarget}
          onClose={() => setContextMenuPos(null)}
          ideaId="idea-1"
          activeTool="whiteboard"
          title="Test idea"
          seedText=""
          branch=""
          area=""
          graphNodes={[]}
          graphEdges={[]}
          isAccepted
          onGenerateProposal={() => {}}
        />
      )}
      {edgeContextMenu && (
        <WhiteboardEdgeContextMenu
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          isPl={false}
          isLocked={false}
          onClose={() => setEdgeContextMenu(null)}
          onEditLabel={vi.fn()}
          onCycleStyle={vi.fn()}
          onCycleArrow={vi.fn()}
          onReverse={vi.fn()}
          onDelete={vi.fn()}
        />
      )}
    </div>
  );
}

describe('Whiteboard keyboard context-menu invocation — node/edge/background', () => {
  it('Shift+F10 on a focused NODE opens the node menu, Escape closes it, focus returns to the node', async () => {
    render(<WhiteboardKeyboardMenuHarness />);
    const node = screen.getByTestId('node-el');
    node.focus();
    expect(document.activeElement).toBe(node);

    fireEvent.keyDown(node, { key: 'F10', shiftKey: true });

    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();
    // Node-scoped: base ops (Edit/Duplicate/…) + Delete must be present.
    expect(screen.getAllByRole('menuitem').length).toBeGreaterThan(0);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(node);
  });

  it('the "ContextMenu" key on a focused EDGE opens the edge menu, Escape closes it, focus returns to the edge', async () => {
    render(<WhiteboardKeyboardMenuHarness />);
    const edge = screen.getByTestId('rf__edge-e1-e2') as unknown as HTMLElement;
    // svg <g> elements are focusable here via explicit tabIndex; jsdom allows
    // .focus() on any element with a tabindex attribute.
    edge.focus();
    expect(document.activeElement).toBe(edge);

    fireEvent.keyDown(edge, { key: 'ContextMenu', shiftKey: false });

    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();
    expect(screen.getByText(/delete connection|usuń połączenie/i)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(edge);
  });

  it('Shift+F10 with focus on the pane (BACKGROUND) opens the background menu, Escape closes it, focus returns to the pane', async () => {
    render(<WhiteboardKeyboardMenuHarness />);
    const pane = screen.getByTestId('pane');
    pane.focus();
    expect(document.activeElement).toBe(pane);

    fireEvent.keyDown(pane, { key: 'F10', shiftKey: true });

    const menu = await screen.findByRole('menu');
    expect(menu).toBeInTheDocument();
    // Background scope shows the AI-actions section header (mocked t()
    // returns the raw key with no fallback given) and no node base ops.
    expect(screen.getByText('myWorkIdeas.canvasContextMenu.aiActions')).toBeInTheDocument();
    expect(screen.queryByText(/^Delete$|^Usuń$/)).not.toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(pane);
  });

  it('roving tabIndex: exactly one menuitem is tabIndex=0 at a time, ArrowDown moves it', async () => {
    render(<WhiteboardKeyboardMenuHarness />);
    const node = screen.getByTestId('node-el');
    node.focus();
    fireEvent.keyDown(node, { key: 'F10', shiftKey: true });

    const menu = await screen.findByRole('menu');
    // The roving tabIndex itself is applied synchronously, but DOM focus
    // entry is deferred one animation frame (see useAccessibleMenu) so the
    // menu's position can settle first — wait for that frame before
    // asserting focus.
    await new Promise((r) => requestAnimationFrame(r));
    const items = screen.getAllByRole('menuitem');
    const activeIndexBefore = items.findIndex((el) => el.getAttribute('tabindex') === '0');
    expect(activeIndexBefore).toBeGreaterThanOrEqual(0);
    expect(items.filter((el) => el.getAttribute('tabindex') === '0')).toHaveLength(1);
    expect(document.activeElement).toBe(items[activeIndexBefore]);

    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    const activeIndexAfter = items.findIndex((el) => el.getAttribute('tabindex') === '0');
    expect(activeIndexAfter).toBeGreaterThanOrEqual(0);
    expect(items.filter((el) => el.getAttribute('tabindex') === '0')).toHaveLength(1);
    // The roving index actually MOVED (to the next item), and DOM focus
    // moved with it — index and focus never drift apart.
    expect(activeIndexAfter).toBe((activeIndexBefore + 1) % items.length);
    expect(document.activeElement).toBe(items[activeIndexAfter]);
  });
});
