/**
 * @vitest-environment jsdom
 *
 * P1.5 (WB-P1-04) — Whiteboard freehand drawing was drag-only / pointer-only,
 * which fails "core work possible without raw-coordinate drag" (doc 09 §11.7,
 * doc 11 DoD §3.8). This exercises the keyboard drawing mode added to
 * `IdeaDrawingLayer`: create a stroke with arrow keys + Space/Enter + Escape
 * (no pointer coordinates), change color/width, undo/redo it, and confirm the
 * AX surface (aria-live announcements, roles) identifies mode + completion.
 *
 * Undo ownership (defect fix, 2026-08-10): `IdeaDrawingLayer` no longer owns
 * any undo/redo state or Ctrl+Z/Ctrl+Y listener of its own — the canvas
 * (`IdeaWhiteboardTool`) now owns the single undo stack for the whole board,
 * including drawn strokes, and drives the layer's Undo/Redo buttons via the
 * `onUndo`/`onRedo`/`canUndo`/`canRedo` props. The Harness below plays the
 * canvas's role (an external paths-only undo stack) so these tests still
 * prove the buttons work, under the NEW contract instead of the old
 * self-contained one. See IdeaWhiteboardTool.drawUndo.test.tsx for the
 * single-stack / no-double-handling proof at the canvas level.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaDrawingLayer, type DrawingPath } from '../../../src/components/MyWork/IdeaDrawingLayer';

function Harness({ onClose }: { onClose?: () => void }) {
  const [paths, setPaths] = React.useState<DrawingPath[]>([]);
  const undoStack = React.useRef<DrawingPath[][]>([]);
  const redoStack = React.useRef<DrawingPath[][]>([]);
  const [, forceRender] = React.useState(0);

  const onPathsChange = (next: DrawingPath[]) => {
    undoStack.current = [...undoStack.current, paths];
    redoStack.current = [];
    setPaths(next);
  };
  const onUndo = () => {
    if (undoStack.current.length === 0) return;
    const prev = undoStack.current[undoStack.current.length - 1];
    undoStack.current = undoStack.current.slice(0, -1);
    redoStack.current = [paths, ...redoStack.current];
    setPaths(prev);
    forceRender((n) => n + 1);
  };
  const onRedo = () => {
    if (redoStack.current.length === 0) return;
    const next = redoStack.current[0];
    redoStack.current = redoStack.current.slice(1);
    undoStack.current = [...undoStack.current, paths];
    setPaths(next);
    forceRender((n) => n + 1);
  };

  return (
    <IdeaDrawingLayer
      active
      onClose={onClose ?? (() => {})}
      paths={paths}
      onPathsChange={onPathsChange}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo={undoStack.current.length > 0}
      canRedo={redoStack.current.length > 0}
    />
  );
}

describe('IdeaDrawingLayer — keyboard drawing mode (WB-P1-04)', () => {
  it('creates a visible stroke using only arrow keys + Space + Escape, no pointer coordinates', () => {
    const { container } = render(<Harness />);
    const svg = container.querySelector('svg[role="application"]') as SVGSVGElement;
    expect(svg).toBeTruthy();

    // Move the keyboard cursor (auto-activates keyboard mode on first arrow key).
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    // Pen down (Space), draw a short line, pen stays down.
    fireEvent.keyDown(svg, { key: ' ' });
    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    // Finish the stroke.
    fireEvent.keyDown(svg, { key: 'Escape' });

    // A committed path element (not the transient current-path) must exist.
    const committedPaths = container.querySelectorAll('path[data-path-id]');
    expect(committedPaths.length).toBe(1);
    expect(committedPaths[0].getAttribute('d')).toMatch(/^M .* L /);
  });

  it('does not close the overlay on Escape while a keyboard stroke is in progress', () => {
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    const svg = container.querySelector('svg[role="application"]') as SVGSVGElement;

    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: ' ' }); // pen down — path now non-empty
    fireEvent.keyDown(svg, { key: 'Escape' }); // must finish the stroke, not close

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes the overlay on Escape when no stroke is in progress (pre-existing behavior preserved)', () => {
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    const svg = container.querySelector('svg[role="application"]') as SVGSVGElement;

    fireEvent.keyDown(svg, { key: 'ArrowRight' }); // moves cursor, no pen-down, no path
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('undo removes the keyboard-drawn stroke and redo brings it back', () => {
    const { container } = render(<Harness />);
    const svg = container.querySelector('svg[role="application"]') as SVGSVGElement;

    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: ' ' });
    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    fireEvent.keyDown(svg, { key: 'Escape' });

    expect(container.querySelectorAll('path[data-path-id]').length).toBe(1);

    const undoBtn = screen.getByLabelText('myWorkIdeas.drawingLayer.undo');
    fireEvent.click(undoBtn);
    expect(container.querySelectorAll('path[data-path-id]').length).toBe(0);

    const redoBtn = screen.getByLabelText('myWorkIdeas.drawingLayer.redo');
    fireEvent.click(redoBtn);
    expect(container.querySelectorAll('path[data-path-id]').length).toBe(1);
  });

  it('color and stroke width can be changed via the (keyboard-operable) toolbar before drawing', () => {
    const { container } = render(<Harness />);
    const svg = container.querySelector('svg[role="application"]') as SVGSVGElement;

    // Pick a distinct color and bump stroke width, then draw with the keyboard.
    const colorBtn = screen.getByLabelText(/myWorkIdeas.drawingLayer.color #f43f5e/);
    fireEvent.click(colorBtn);
    const increaseBtn = screen.getByLabelText('myWorkIdeas.drawingLayer.increaseStrokeWidth');
    fireEvent.click(increaseBtn);
    fireEvent.click(increaseBtn);

    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: ' ' });
    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    fireEvent.keyDown(svg, { key: 'Escape' });

    const committed = container.querySelector('path[data-path-id]');
    expect(committed?.getAttribute('stroke')).toBe('#f43f5e');
    expect(committed?.getAttribute('stroke-width')).toBe('5');
  });

  it('announces drawing-mode state changes for screen readers via a live region', () => {
    const { container } = render(<Harness />);
    const svg = container.querySelector('svg[role="application"]') as SVGSVGElement;
    const live = container.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;
    expect(live).toBeTruthy();

    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    expect(live.textContent).toBe('myWorkIdeas.drawingLayer.kbModeEntered');

    fireEvent.keyDown(svg, { key: ' ' });
    expect(live.textContent).toBe('myWorkIdeas.drawingLayer.kbPenDown');

    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(live.textContent).toBe('myWorkIdeas.drawingLayer.kbStrokeCompleted');
  });

  it('discards a too-short keyboard stroke on Escape (pen down, no movement) without crashing', () => {
    const { container } = render(<Harness />);
    const svg = container.querySelector('svg[role="application"]') as SVGSVGElement;
    const live = container.querySelector('[role="status"][aria-live="polite"]') as HTMLElement;

    fireEvent.keyDown(svg, { key: ' ' }); // pen down at cursor, no movement
    fireEvent.keyDown(svg, { key: 'Escape' });

    expect(container.querySelectorAll('path[data-path-id]').length).toBe(0);
    expect(live.textContent).toBe('myWorkIdeas.drawingLayer.kbStrokeDiscarded');
  });
});

describe('IdeaDrawingLayer — undo ownership (defect fix, 2026-08-10)', () => {
  it('does not handle Ctrl+Z/Ctrl+Y itself — a stroke is unaffected unless the external onUndo/onRedo prop is invoked', () => {
    // Harness whose onUndo/onRedo are spies that deliberately do nothing,
    // simulating "the canvas listener never fires" so we can prove the
    // layer itself does not also react to the keypress (no second stack).
    function NoopUndoHarness() {
      const [paths, setPaths] = React.useState<DrawingPath[]>([]);
      return (
        <IdeaDrawingLayer
          active
          onClose={() => {}}
          paths={paths}
          onPathsChange={setPaths}
          onUndo={() => {}}
          onRedo={() => {}}
          canUndo
          canRedo
        />
      );
    }
    const { container } = render(<NoopUndoHarness />);
    const svg = container.querySelector('svg[role="application"]') as SVGSVGElement;

    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: ' ' });
    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(container.querySelectorAll('path[data-path-id]').length).toBe(1);

    // Ctrl+Z on the SVG itself: the layer has NO internal 'z' handling left
    // (see handleCanvasKeyDown / the removed document keydown effect), so
    // with a no-op onUndo the stroke must survive untouched — proof there
    // is no second, layer-local undo stack silently acting behind the
    // canvas's back.
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true });
    expect(container.querySelectorAll('path[data-path-id]').length).toBe(1);
  });

  it('a single Ctrl+Z reaches an external (canvas-level) document listener exactly once, whether or not the SVG has focus — no double-handling in either context', () => {
    const { container } = render(<Harness />);
    const svg = container.querySelector('svg[role="application"]') as SVGSVGElement;

    fireEvent.keyDown(svg, { key: 'ArrowRight' });
    fireEvent.keyDown(svg, { key: ' ' });
    fireEvent.keyDown(svg, { key: 'ArrowDown' });
    fireEvent.keyDown(svg, { key: 'Escape' });
    expect(container.querySelectorAll('path[data-path-id]').length).toBe(1);

    // Simulate IdeaWhiteboardTool's single, always-on, document-level
    // useCanvasKeyboard Ctrl+Z listener (the one true undo stack owner).
    const canvasUndo = vi.fn();
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') canvasUndo();
    });

    // Focus context 1: keypress originates inside the drawing SVG (drawing
    // in progress). It must bubble to the single document listener exactly
    // once — the layer no longer intercepts/preventDefaults 'z'.
    fireEvent.keyDown(svg, { key: 'z', ctrlKey: true, bubbles: true });
    expect(canvasUndo).toHaveBeenCalledTimes(1);

    // Focus context 2: keypress originates outside the layer entirely
    // (e.g. focus is on the canvas background, not the drawing overlay).
    // Same single listener, same single call — coherent regardless of
    // where focus was when the user pressed Ctrl+Z.
    fireEvent.keyDown(document, { key: 'z', ctrlKey: true });
    expect(canvasUndo).toHaveBeenCalledTimes(2);
  });
});
