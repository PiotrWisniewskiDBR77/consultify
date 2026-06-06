/**
 * usePopoverPosition — shared portal-popover positioning logic.
 *
 * Replicates the canonical pattern from
 * `src/components/shared/ModuleHub/TableSettingsPopover.tsx`:
 * computes a fixed position from the trigger's getBoundingClientRect(),
 * clamps to the viewport, auto-flips up when there isn't room below, and
 * keeps the panel aligned on scroll/resize. The panel is meant to be
 * rendered via `createPortal` to `document.body` so it is NEVER clipped by
 * an ancestor's `overflow`.
 */

import { type RefObject, useCallback, useEffect, useLayoutEffect, useState } from 'react';

const GAP = 6;
const VIEWPORT_MARGIN = 8;

export interface PopoverPosition {
  top: number;
  left: number;
  width: number;
}

export interface UsePopoverPositionOptions {
  /** Whether the popover is currently open (position only tracked while open). */
  open: boolean;
  /** Ref to the trigger element (used for the anchor rect). */
  triggerRef: RefObject<HTMLElement | null>;
  /** Ref to the portaled panel element (used to measure its height for flip). */
  panelRef: RefObject<HTMLElement | null>;
  /**
   * Panel width strategy:
   * - 'trigger': match the trigger's width (good for selects)
   * - a number: a fixed px width (good for calendars / menus)
   */
  width?: 'trigger' | number;
}

export function usePopoverPosition({
  open,
  triggerRef,
  panelRef,
  width = 'trigger',
}: UsePopoverPositionOptions): PopoverPosition {
  const [pos, setPos] = useState<PopoverPosition>({ top: 0, left: 0, width: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const panelHeight = panelRef.current?.offsetHeight ?? 320;
    const panelWidth = width === 'trigger' ? rect.width : width;

    const spaceBelow = window.innerHeight - rect.bottom;
    const flipUp = spaceBelow < panelHeight + GAP && rect.top > spaceBelow;

    let left = rect.left;
    left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(left, window.innerWidth - panelWidth - VIEWPORT_MARGIN)
    );
    const top = flipUp
      ? Math.max(VIEWPORT_MARGIN, rect.top - panelHeight - GAP)
      : rect.bottom + GAP;

    setPos({ top, left, width: panelWidth });
  }, [triggerRef, panelRef, width]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  return pos;
}

/**
 * useDismiss — closes a popover on outside pointer-down (trigger OR panel) and
 * on Escape. Mirrors the TableSettingsPopover behaviour.
 */
export function useDismiss(
  open: boolean,
  onClose: () => void,
  refs: Array<RefObject<HTMLElement | null>>
): void {
  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: MouseEvent) => {
      const target = event.target as Node;
      const inside = refs.some((ref) => ref.current?.contains(target));
      if (!inside) onClose();
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
    // refs array identity is stable per render in practice; intentionally
    // depending only on open/onClose to avoid re-subscribing each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose]);
}
