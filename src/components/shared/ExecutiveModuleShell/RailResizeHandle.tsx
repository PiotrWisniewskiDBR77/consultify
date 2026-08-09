/**
 * RailResizeHandle — pointer-driven width drag handle for left + right
 * rails (MELS § 2.B + 2.D · EPIC-T16 D7).
 *
 * Renders a 4 px hit-target on the rail's resize edge (right edge for
 * the left rail, left edge for the right rail panel). Captures the
 * pointer on `pointerdown` and emits `onResize(nextWidth)` on every
 * `pointermove`. The hook does NOT clamp — clamping is owned by
 * `useRailState` so width persistence stays consistent.
 *
 * Keyboard fallback (Arrow Left / Arrow Right) is provided per MELS
 * accessibility § 3.4: non-mouse users can step the rail width by 16 px
 * increments.
 *
 * Constraints:
 *   - Hit target is 4 px wide but the visual indicator only appears
 *     on hover or active drag — keeps the rail clean by default.
 *   - DBR77 monochrome — only Tailwind tokens.
 *   - Pointer events are captured + released on the handle element so
 *     a fast drag outside the bounds doesn't lose the gesture.
 */

import React, { useCallback, useEffect, useRef } from 'react';

export type RailResizeSide = 'left' | 'right';

interface RailResizeHandleProps {
  /**
   * Which rail this handle belongs to:
   *   - `left`  → drags the *right edge* of the left rail; pointer X
   *               grows → left width grows.
   *   - `right` → drags the *left edge* of the right rail panel;
   *               pointer X grows → right width shrinks.
   */
  side: RailResizeSide;
  /** Current rail width — used as the drag origin. */
  currentWidth: number;
  /** Called with the proposed next width (unclamped). */
  onResize: (nextWidth: number) => void;
  /** Optional aria-label; defaults to a localised string. */
  ariaLabel?: string;
  /** Step size for Arrow Left/Right keyboard fallback. */
  step?: number;
  /** Optional `data-testid`. */
  testId?: string;
}

export const RailResizeHandle: React.FC<RailResizeHandleProps> = ({
  side,
  currentWidth,
  onResize,
  ariaLabel,
  step = 16,
  testId,
}) => {
  const draggingRef = useRef(false);
  const originXRef = useRef(0);
  const originWidthRef = useRef(0);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const target = event.currentTarget;
      target.setPointerCapture(event.pointerId);
      draggingRef.current = true;
      originXRef.current = event.clientX;
      originWidthRef.current = currentWidth;
      event.preventDefault();
    },
    [currentWidth]
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      const dx = event.clientX - originXRef.current;
      const next = side === 'left' ? originWidthRef.current + dx : originWidthRef.current - dx;
      onResize(next);
    },
    [onResize, side]
  );

  const stopDrag = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore — capture may have been released by the browser */
    }
  }, []);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onResize(side === 'left' ? currentWidth - step : currentWidth + step);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        onResize(side === 'left' ? currentWidth + step : currentWidth - step);
      }
    },
    [currentWidth, onResize, side, step]
  );

  // Defensive: if the host unmounts mid-drag, release capture.
  useEffect(() => {
    return () => {
      draggingRef.current = false;
    };
  }, []);

  const positionClass =
    side === 'left'
      ? 'absolute top-0 right-0 h-full w-1 -mr-0.5 cursor-col-resize'
      : 'absolute top-0 left-0 h-full w-1 -ml-0.5 cursor-col-resize';

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel ?? (side === 'left' ? 'Resize left rail' : 'Resize right rail')}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onKeyDown={onKeyDown}
      className={`${positionClass} group hover:bg-c-focus/40 active:bg-c-focus/60 transition-colors focus-visible:outline-none focus-visible:bg-c-focus/60 z-10`}
      data-testid={testId ?? `mels-rail-resize-${side}`}
      data-mels-resize={side}
    >
      <span aria-hidden="true" className="block w-full h-full" />
    </div>
  );
};

export default RailResizeHandle;
