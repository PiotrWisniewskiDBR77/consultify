/**
 * `useScrollEdges` — reports whether a horizontally-scrollable element has
 * content hidden off either edge (start/end), recomputed on scroll, on
 * resize, and whenever `deps` change (e.g. the row's own content changes).
 *
 * MYW-PHOTO-003 (P1) — extracted from `MyWorkNav.tsx` (the two-level nav
 * redesign, still behind `isMyWorkTwoLevelNavEnabled()` — default OFF, never
 * mounted anywhere: `grep -rn '<MyWorkNav' src/` = 0 hits outside its own
 * file). The acceptance doc's evidence for "ScrollAffordance was added"
 * (`MyWorkNav.tsx:285–286`/`333–334`) pointed at that dead code — the nav bar
 * that actually ships (`MyWorkHub.tsx`'s single-row `tabs.map` bar, default
 * flag OFF path) has NO scroll affordance at all, just a plain thin
 * `app-table-scrollbar`. This hook is the same measurement logic, pulled out
 * so both `MyWorkNav` (if ever flipped on) and the live `MyWorkHub` bar can
 * share it instead of duplicating it a third time.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

export interface ScrollEdges {
  scrollable: boolean;
  atStart: boolean;
  atEnd: boolean;
}

export function useScrollEdges(deps: unknown[] = []): [RefObject<HTMLDivElement | null>, ScrollEdges] {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState<ScrollEdges>({
    scrollable: false,
    atStart: true,
    atEnd: true,
  });

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // 1px tolerance: fractional layout widths otherwise report a permanent
    // "not at end" and the affordance would never switch off.
    const maxScroll = el.scrollWidth - el.clientWidth;
    setEdges({
      scrollable: maxScroll > 1,
      atStart: el.scrollLeft <= 1,
      atEnd: el.scrollLeft >= maxScroll - 1,
    });
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    if (!el) return;
    el.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return [ref, edges];
}

export default useScrollEdges;
