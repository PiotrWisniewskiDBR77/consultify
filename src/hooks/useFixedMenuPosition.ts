import { useLayoutEffect, useRef, useState } from 'react';

/**
 * useFixedMenuPosition — shared viewport-aware positioning for `position: fixed`
 * dropdowns/context menus (My Work bug pass #6k/#6o/#22 — canvas "⋯" menu, Mind Map
 * node PPM context menu, notebook row actions all ran off-screen and got clipped
 * with no way to reach the cut-off items).
 *
 * Measures the menu's *actual* rendered size after mount/resize and:
 *  - flips it above the anchor when there isn't enough room below (and there IS
 *    enough room above) instead of letting it run off the bottom of the screen;
 *  - clamps left/top so it never starts off-screen on any edge;
 *  - returns `maxHeight` so an oversized menu scrolls internally (with
 *    `overflow-y: auto`) instead of being cut off when neither side fits it fully.
 *
 * Two entry points share the same math: `usePointFixedMenuPosition` for menus
 * anchored to a mouse/click point (context menus), and `useAnchorFixedMenuPosition`
 * for menus anchored to a trigger element's rect (dropdown buttons).
 */

export interface FixedMenuStyle {
  position: 'fixed';
  top: number;
  left: number;
  maxHeight: number;
}

interface Anchor {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

const MARGIN = 8;
const HIDDEN_STYLE: FixedMenuStyle = { position: 'fixed', top: -9999, left: -9999, maxHeight: 480 };

function computePosition(anchor: Anchor, width: number, height: number): FixedMenuStyle {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spaceBelow = vh - anchor.bottom - MARGIN;
  const spaceAbove = anchor.top - MARGIN;
  const flipUp = height > spaceBelow && spaceAbove > spaceBelow;

  const top = flipUp ? Math.max(MARGIN, anchor.top - height) : Math.max(MARGIN, anchor.bottom);
  const maxHeight = Math.max(160, Math.floor(flipUp ? spaceAbove : spaceBelow));

  let left = anchor.left;
  if (left + width > vw - MARGIN) left = anchor.right - width; // prefer right-aligning to the anchor
  left = Math.min(Math.max(MARGIN, left), Math.max(MARGIN, vw - width - MARGIN));

  return { position: 'fixed', top, left, maxHeight };
}

/** Anchor a fixed-position menu to a viewport point (e.g. a right-click / context-menu event). */
export function usePointFixedMenuPosition(x: number, y: number, open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<FixedMenuStyle>(HIDDEN_STYLE);

  useLayoutEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const anchor: Anchor = { top: y, bottom: y, left: x, right: x };

    const recompute = () => {
      const rect = el.getBoundingClientRect();
      setStyle(computePosition(anchor, rect.width || 240, rect.height || 200));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener('resize', recompute);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
    };
  }, [open, x, y]);

  return { ref, style };
}

/** Anchor a fixed-position menu to a trigger element's rect (e.g. a dropdown button). */
export function useAnchorFixedMenuPosition(
  anchorEl: HTMLElement | null,
  open: boolean
) {
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<FixedMenuStyle>(HIDDEN_STYLE);

  useLayoutEffect(() => {
    if (!open || !anchorEl) return;
    const el = ref.current;
    if (!el) return;

    const recompute = () => {
      const anchorRect = anchorEl.getBoundingClientRect();
      const anchor: Anchor = {
        top: anchorRect.top,
        bottom: anchorRect.bottom + 4,
        left: anchorRect.left,
        right: anchorRect.right,
      };
      const rect = el.getBoundingClientRect();
      setStyle(computePosition(anchor, rect.width || 220, rect.height || 200));
    };

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', recompute, true);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', recompute);
      window.removeEventListener('scroll', recompute, true);
    };
  }, [open, anchorEl]);

  return { ref, style };
}
