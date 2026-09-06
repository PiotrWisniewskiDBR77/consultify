/**
 * useDesktopPreviewOverlay — P1 DEC-397 (§4.3 "Budżet szerokości").
 *
 * `TableWithPreviewLayout.tsx` already implements the "panel floats above
 * the table below 1440 px, zero reflow" mechanic (`desktopPreviewOverlay` /
 * `automatycznaNakladka`, `PANEL_INLINE_CONTAINER_WIDTH = 1184`,
 * `PANEL_RESIZE_HYSTERESIS = 24`). `JedenPrawyPanel.tsx` (rodzina B — a
 * bespoke `<StandardPreview>` next to a `<StandardTable>`, e.g.
 * `ExecutionHub.tsx`, `InboxContent.tsx`, `InterviewHub.tsx`) has no
 * equivalent: it always renders as a fixed-width flex sibling, so below
 * 1440 px the table loses `PREVIEW_PANE_WIDTH` of space (measured: 294 px
 * left for the Skrzynka table at 1280 px — the exact defect from the P1
 * audit, §3 point 3).
 *
 * This hook duplicates the SAME threshold/hysteresis numbers rather than
 * editing the frozen-adjacent `JedenPrawyPanel.tsx` contract or touching
 * `ExecutionHub.tsx` (module `06_EXECUTION`, frozen, out of scope for this
 * work order): every existing `JedenPrawyPanel` consumer keeps rendering
 * byte-for-byte as before (this hook is opt-in, called only from the two
 * screens this work order touches), while the overlay wrapper markup at the
 * call site matches `TableWithPreviewLayout.tsx`'s own overlay classes
 * 1:1 (`pointer-events-none absolute inset-y-0 right-0 z-40 …`), so the
 * visual result is identical to the rodzina A pattern.
 */
import { type RefObject, useEffect, useRef, useState } from 'react';

import { useDeviceType } from '@/hooks/useDeviceType';

/** Mirrors `TableWithPreviewLayout.PANEL_INLINE_CONTAINER_WIDTH` — content
 * width (viewport minus expanded sidebar) below which the panel becomes an
 * overlay. 1184 px content ⇒ 1440 px viewport per §4.3's budget table. */
const PANEL_INLINE_CONTAINER_WIDTH = 1184;
/** Mirrors `TableWithPreviewLayout.PANEL_RESIZE_HYSTERESIS` — prevents the
 * panel from flapping between overlay/inline right at the threshold. */
const PANEL_RESIZE_HYSTERESIS = 24;

export interface UseDesktopPreviewOverlayResult {
  /** Attach to the flex row that holds the table + the panel; must carry
   * `position: relative` (e.g. Tailwind `relative`) for the overlay to
   * anchor to its right edge instead of escaping to a further ancestor. */
  containerRef: RefObject<HTMLDivElement>;
  /** `true` below the threshold (and not on mobile, which already has its
   * own full-screen drawer) — wrap the panel in the overlay classes. */
  overlayMode: boolean;
}

export function useDesktopPreviewOverlay(): UseDesktopPreviewOverlayResult {
  const { isMobile } = useDeviceType();
  const containerRef = useRef<HTMLDivElement>(null);
  const [automatycznaNakladka, setAutomatycznaNakladka] = useState(false);

  useEffect(() => {
    const kontener = containerRef.current;
    if (!kontener || typeof ResizeObserver === 'undefined') return;

    let zainicjalizowany = false;
    const obserwator = new ResizeObserver(([wpis]) => {
      if (!wpis) return;
      const szerokosc = wpis.contentRect.width;
      setAutomatycznaNakladka((poprzednia) => {
        if (!zainicjalizowany) {
          zainicjalizowany = true;
          return szerokosc < PANEL_INLINE_CONTAINER_WIDTH;
        }
        if (poprzednia) return szerokosc < PANEL_INLINE_CONTAINER_WIDTH;
        return szerokosc < PANEL_INLINE_CONTAINER_WIDTH - PANEL_RESIZE_HYSTERESIS;
      });
    });
    obserwator.observe(kontener);
    return () => obserwator.disconnect();
  }, []);

  return { containerRef, overlayMode: automatycznaNakladka && !isMobile };
}

export default useDesktopPreviewOverlay;
