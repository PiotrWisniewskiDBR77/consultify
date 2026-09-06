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
 * 1440 px the table loses `PREVIEW_PANE_WIDTH` of space (measured live:
 * 838 px left for the Skrzynka table at a real 1280 px viewport — the exact
 * defect from the P1 audit, §3 point 3).
 *
 * WHY THIS DOES **NOT** REUSE `PANEL_INLINE_CONTAINER_WIDTH = 1184` VERBATIM
 * (measured live 2026-09-06, not assumed): `TableWithPreviewLayout`'s 1184
 * is calibrated for ITS OWN `containerRef` — placed at a specific nesting
 * depth, under the §4.3 budget table's ASSUMED **expanded** 256 px sidebar.
 * `InboxContent.tsx`/`InterviewHub.tsx` nest their own flex row one level
 * differently, and the live account measured here has the sidebar
 * **collapsed** (64 px rail) — at a real 1280 px viewport this hook's
 * `containerRef` measures 1184 px of CONTENT width (not 1024 px as the
 * budget table assumes), so borrowing 1184 as the OVERLAY THRESHOLD would
 * never trigger overlay at 1280 px in this environment — verified live:
 * table container measured 838 px (< the 1000 px floor this work order
 * requires) with the borrowed threshold, before this fix.
 *
 * INSTEAD: the threshold is DERIVED analytically from the same
 * `CANON_PREVIEW` constants `PREVIEW_PANE_WIDTH` itself is built from,
 * solving "table width stays ≥ `MIN_TABLE_WIDTH_PX`" for the measured
 * container width `C`, in the ratio-clamped regime where the panel sits at
 * `preferredRatio · C` (340–480 px): `C − preferredRatio·C − gapFromTable ≥
 * MIN_TABLE_WIDTH_PX` ⇒ `C ≥ (MIN_TABLE_WIDTH_PX + gapFromTable) / (1 −
 * preferredRatio)`. This is self-calibrating — correct regardless of this
 * hook's exact nesting depth or the sidebar's collapsed/expanded state,
 * because it reasons from the SAME measured `C` the panel's own width
 * formula uses, not a number borrowed from a different measurement point.
 */
import { type RefObject, useEffect, useRef, useState } from 'react';

import { CANON_PREVIEW } from '@/contracts/tableSurface/canon';
import { useDeviceType } from '@/hooks/useDeviceType';

/** ZLECENIE 1.2 §10: "Skrzynka 1280: szerokość elementu table ≥ 1000 px" —
 * this work order's own floor, not a wider canon constant. */
const MIN_TABLE_WIDTH_PX = 1000;

/** `C ≥ (MIN_TABLE_WIDTH_PX + gapFromTable) / (1 − preferredRatio)` — see
 * module comment. ≈ 1397.2 px with today's canon numbers (1000+6)/(1-0.28). */
const OVERLAY_CONTAINER_THRESHOLD =
  (MIN_TABLE_WIDTH_PX + CANON_PREVIEW.gapFromTable) / (1 - CANON_PREVIEW.preferredRatio);

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
          return szerokosc < OVERLAY_CONTAINER_THRESHOLD;
        }
        if (poprzednia) return szerokosc < OVERLAY_CONTAINER_THRESHOLD;
        return szerokosc < OVERLAY_CONTAINER_THRESHOLD - PANEL_RESIZE_HYSTERESIS;
      });
    });
    obserwator.observe(kontener);
    return () => obserwator.disconnect();
  }, []);

  return { containerRef, overlayMode: automatycznaNakladka && !isMobile };
}

export default useDesktopPreviewOverlay;
