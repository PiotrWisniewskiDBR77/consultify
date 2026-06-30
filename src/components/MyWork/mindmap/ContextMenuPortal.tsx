/**
 * ContextMenuPortal — renders canvas context menus into document.body (D-I §3 z-index).
 *
 * Why: the Ideas canvas context menus use `position: fixed; z-index: 100`, but they
 * are mounted inside the editor subtree. A transformed/filtered ancestor (ReactFlow
 * viewport, backdrop-blur chrome) becomes the containing block for `fixed` AND opens a
 * local stacking context, so the menu could render *under* canvas nodes (UI-L15 — Piotr:
 * „context menu pod węzłem"). Portaling to <body> removes it from any such ancestor so
 * `fixed`+z-index resolve against the viewport, above all canvas content.
 *
 * Editor Shell Canon §3: `app-chrome > overlay-menu > canvas-nodes > canvas-bg`.
 */
import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function ContextMenuPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

export default ContextMenuPortal;
