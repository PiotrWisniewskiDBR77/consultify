/**
 * useAccessibleMenu — CB-05 shared accessible context-menu contract.
 *
 * One keyboard behavior for every canvas context menu (node/edge/background,
 * Mind Map/Whiteboard/Process Flow):
 * - Real roving tabIndex: exactly ONE `role="menuitem"` has `tabindex="0"`
 *   at any moment (the "active" one), every other one is `tabindex="-1"` —
 *   the standard WAI-ARIA menu pattern, not just imperative `.focus()` calls
 *   that leave every button independently Tab-reachable.
 * - Focus moves into the first enabled menuitem when the menu opens.
 * - ArrowUp/ArrowDown/Home/End move the roving-tabindex "active" item and
 *   DOM focus together, in lockstep, so Tab (if used instead of arrows)
 *   still lands on the last-active item, not the first.
 * - Focus returns to whatever triggered the menu (pointer right-click
 *   target or the keyboard-focused node/edge) once the menu closes —
 *   Escape is handled by each menu's own existing close listener, which
 *   unmounts the menu and runs this hook's cleanup.
 *
 * DOM-queries `[role="menuitem"]:not(:disabled)` inside the container
 * instead of threading refs through each menu's (dynamically filtered)
 * item list — keeps this generic across menus with different item shapes.
 */
import { useEffect, useRef } from 'react';

export function useAccessibleMenu<T extends HTMLElement = HTMLDivElement>(active: boolean) {
  const containerRef = useRef<T>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    const items = () =>
      Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'));

    /** Roving tabIndex: sets `tabindex="0"` on exactly `activeEl` and
     * `tabindex="-1"` on every other menuitem. Does NOT move DOM focus by
     * itself — callers pair this with `.focus()` so the two never drift
     * apart (a roving index pointing at an unfocused element is a broken
     * implementation of the pattern, not a partial one). */
    const applyRovingTabIndex = (activeEl: HTMLElement | undefined) => {
      items().forEach((it) => it.setAttribute('tabindex', it === activeEl ? '0' : '-1'));
    };

    const moveTo = (el: HTMLElement | undefined) => {
      if (!el) return;
      applyRovingTabIndex(el);
      el.focus();
    };

    // Roving tabIndex is applied SYNCHRONOUSLY (not deferred), so there is
    // never a frame where every menuitem is independently tabbable — only
    // the first one ever enters the natural Tab order.
    applyRovingTabIndex(items()[0]);

    // Focus entry itself is deferred one frame: the menu's position may
    // still be settling from the click/keyboard event that opened it, and
    // focusing before layout finishes can jump the viewport under it.
    const focusFrame = requestAnimationFrame(() => {
      items()[0]?.focus();
    });

    const onKeyDown = (e: KeyboardEvent) => {
      const list = items();
      if (list.length === 0) return;
      const currentIndex = list.indexOf(document.activeElement as HTMLElement);
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        moveTo(list[(currentIndex + 1 + list.length) % list.length]);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        moveTo(list[(currentIndex - 1 + list.length) % list.length]);
      } else if (e.key === 'Home') {
        e.preventDefault();
        moveTo(list[0]);
      } else if (e.key === 'End') {
        e.preventDefault();
        moveTo(list[list.length - 1]);
      }
    };
    container.addEventListener('keydown', onKeyDown);

    return () => {
      cancelAnimationFrame(focusFrame);
      container.removeEventListener('keydown', onKeyDown);
      // Focus return: only steal focus back if it's still where the menu put
      // it (or nowhere/body) — if the triggered action already moved focus
      // somewhere meaningful (e.g. opened another dialog), leave it alone.
      const active = document.activeElement;
      const stillOwnedByMenu = !active || active === document.body || container.contains(active);
      if (stillOwnedByMenu) previouslyFocusedRef.current?.focus?.();
    };
  }, [active]);

  return containerRef;
}
