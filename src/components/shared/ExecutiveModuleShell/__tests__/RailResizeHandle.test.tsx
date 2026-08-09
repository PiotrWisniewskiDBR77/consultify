/**
 * @vitest-environment jsdom
 *
 * Tests for `<RailResizeHandle>` (EPIC-T16 D7).
 *
 * Coverage:
 *   * Renders separator role + aria-orientation=vertical.
 *   * Pointer drag on the LEFT side: moving right grows width.
 *   * Pointer drag on the RIGHT side: moving right shrinks width.
 *   * Pointer up stops the drag — subsequent moves are ignored.
 *   * Arrow Right increments left width by step (default 16 px).
 *   * Arrow Right decrements right width by step.
 *   * Arrow Left mirrors the above.
 *   * Pointer button !== 0 does not start the drag.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { RailResizeHandle } from '../RailResizeHandle';

function setupPointerCapture() {
  // jsdom doesn't implement set/release pointer capture by default.
  if (!('setPointerCapture' in HTMLElement.prototype)) {
    Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
      value: () => undefined,
      configurable: true,
    });
    Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
      value: () => undefined,
      configurable: true,
    });
  }
}

describe('RailResizeHandle', () => {
  setupPointerCapture();

  it('renders a separator role with vertical orientation', () => {
    render(<RailResizeHandle side="left" currentWidth={280} onResize={vi.fn()} />);
    const handle = screen.getByRole('separator');
    expect(handle).toBeInTheDocument();
    expect(handle.getAttribute('aria-orientation')).toBe('vertical');
    expect(handle.getAttribute('aria-valuemin')).toBe('0');
    expect(handle.getAttribute('aria-valuemax')).toBe('2000');
    expect(handle.getAttribute('aria-valuenow')).toBe('280');
    expect(handle.getAttribute('data-mels-resize')).toBe('left');
  });

  it('announces caller-provided width limits', () => {
    render(
      <RailResizeHandle
        side="right"
        currentWidth={400}
        minWidth={320}
        maxWidth={480}
        onResize={vi.fn()}
      />
    );
    const handle = screen.getByRole('separator');
    expect(handle.getAttribute('aria-valuemin')).toBe('320');
    expect(handle.getAttribute('aria-valuemax')).toBe('480');
  });

  it('LEFT drag: moving pointer right grows width', () => {
    const onResize = vi.fn();
    render(<RailResizeHandle side="left" currentWidth={280} onResize={onResize} />);
    const handle = screen.getByTestId('mels-rail-resize-left');
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 150, pointerId: 1 });
    expect(onResize).toHaveBeenCalledWith(330);
  });

  it('RIGHT drag: moving pointer right shrinks width', () => {
    const onResize = vi.fn();
    render(<RailResizeHandle side="right" currentWidth={400} onResize={onResize} />);
    const handle = screen.getByTestId('mels-rail-resize-right');
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 160, pointerId: 1 });
    expect(onResize).toHaveBeenCalledWith(340);
  });

  it('pointer up stops the drag', () => {
    const onResize = vi.fn();
    render(<RailResizeHandle side="left" currentWidth={280} onResize={onResize} />);
    const handle = screen.getByTestId('mels-rail-resize-left');
    fireEvent.pointerDown(handle, { button: 0, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 150, pointerId: 1 });
    fireEvent.pointerUp(handle, { clientX: 150, pointerId: 1 });
    onResize.mockClear();
    fireEvent.pointerMove(handle, { clientX: 200, pointerId: 1 });
    expect(onResize).not.toHaveBeenCalled();
  });

  it('Arrow Right increments LEFT width by step', () => {
    const onResize = vi.fn();
    render(<RailResizeHandle side="left" currentWidth={280} onResize={onResize} step={16} />);
    fireEvent.keyDown(screen.getByTestId('mels-rail-resize-left'), { key: 'ArrowRight' });
    expect(onResize).toHaveBeenCalledWith(296);
  });

  it('Arrow Right decrements RIGHT width by step', () => {
    const onResize = vi.fn();
    render(<RailResizeHandle side="right" currentWidth={400} onResize={onResize} step={16} />);
    fireEvent.keyDown(screen.getByTestId('mels-rail-resize-right'), { key: 'ArrowRight' });
    expect(onResize).toHaveBeenCalledWith(384);
  });

  it('Arrow Left mirrors the increments', () => {
    const onResize = vi.fn();
    render(<RailResizeHandle side="left" currentWidth={280} onResize={onResize} />);
    fireEvent.keyDown(screen.getByTestId('mels-rail-resize-left'), { key: 'ArrowLeft' });
    expect(onResize).toHaveBeenCalledWith(264);
  });

  it('non-primary pointer button does not start the drag', () => {
    const onResize = vi.fn();
    render(<RailResizeHandle side="left" currentWidth={280} onResize={onResize} />);
    const handle = screen.getByTestId('mels-rail-resize-left');
    fireEvent.pointerDown(handle, { button: 2, clientX: 100, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 200, pointerId: 1 });
    expect(onResize).not.toHaveBeenCalled();
  });
});
