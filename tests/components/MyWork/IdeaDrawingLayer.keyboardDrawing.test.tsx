/**
 * @vitest-environment jsdom
 *
 * P1.5 (WB-P1-04) — Whiteboard freehand drawing was drag-only / pointer-only,
 * which fails "core work possible without raw-coordinate drag" (doc 09 §11.7,
 * doc 11 DoD §3.8). This exercises the keyboard drawing mode added to
 * `IdeaDrawingLayer`: create a stroke with arrow keys + Space/Enter + Escape
 * (no pointer coordinates), change color/width, undo/redo it, and confirm the
 * AX surface (aria-live announcements, roles) identifies mode + completion.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { IdeaDrawingLayer, type DrawingPath } from '../../../src/components/MyWork/IdeaDrawingLayer';

function Harness({ onClose }: { onClose?: () => void }) {
  const [paths, setPaths] = React.useState<DrawingPath[]>([]);
  return (
    <IdeaDrawingLayer
      active
      onClose={onClose ?? (() => {})}
      paths={paths}
      onPathsChange={setPaths}
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
