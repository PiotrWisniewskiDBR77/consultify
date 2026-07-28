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
 *
 * ★ 2026-07-28: cel portalu przepina się na element pełnoekranowy
 * (`useFullscreenPortalTarget`). Bez tego menu kontekstowe płótna było w pełnym
 * ekranie NIEWIDOCZNE — przeglądarka rysuje wyłącznie poddrzewo elementu
 * pełnoekranowego, a `body` jest jego rodzicem, nie potomkiem.
 */
import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { useFullscreenPortalTarget } from '@/hooks/useFullscreenPortalTarget';

export function ContextMenuPortal({ children }: { children: ReactNode }) {
  const target = useFullscreenPortalTarget();
  if (typeof document === 'undefined' || !target) return null;
  return createPortal(children, target);
}

export default ContextMenuPortal;
