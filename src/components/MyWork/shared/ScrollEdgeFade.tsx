/**
 * `ScrollEdgeFade` — gradient + chevron end-of-scroll affordance for a
 * horizontally-scrolling row. Pairs with `useScrollEdges`. Render it as a
 * sibling of the scrollable row, inside a `relative` wrapper.
 *
 * MYW-PHOTO-003 (P1): see `useScrollEdges.ts` for why this exists as a
 * shared primitive instead of living only inside the unmounted
 * `MyWorkNav.tsx`.
 */
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const ScrollEdgeFade: React.FC<{ side: 'start' | 'end'; visible: boolean }> = ({
  side,
  visible,
}) =>
  visible ? (
    <span
      aria-hidden
      data-scroll-affordance={side}
      className={`pointer-events-none absolute top-0 bottom-0 flex w-10 items-center ${
        side === 'end'
          ? 'right-0 justify-end bg-gradient-to-l from-white via-white dark:from-navy-900 dark:via-navy-900'
          : 'left-0 justify-start bg-gradient-to-r from-white via-white dark:from-navy-900 dark:via-navy-900'
      }`}
    >
      {/* The chevron sits on its own solid chip: over a plain gradient it
          reads as part of the clipped word behind it rather than as an edge
          marker (same fix shape as MyWorkNav.tsx's original). */}
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 dark:bg-navy-800 dark:text-slate-300 dark:ring-white/10">
        {side === 'end' ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </span>
    </span>
  ) : null;

ScrollEdgeFade.displayName = 'ScrollEdgeFade';

export default ScrollEdgeFade;
