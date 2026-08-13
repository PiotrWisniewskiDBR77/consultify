/**
 * canvasFocusScope — G4-KBD-P0 (F-K1, 2026-08-11).
 *
 * Shared focus-containment check for the Ideas workspace canvas tools
 * (Mind Map / Process Flow / Whiteboard). Each tool's keydown grammar
 * (Tab=add child/step, Enter=add sibling, Ctrl+Z/S/D/…) must only fire when
 * the keydown genuinely originates inside THAT tool's own canvas — not
 * globally.
 *
 * Before this fix, `useIdeasToolKeyboard.ts` (Process Flow + Whiteboard) had
 * a `containerRef` parameter neither caller actually passed, so its listener
 * fell back to `document` with only an input/textarea/select/contentEditable
 * exclusion — buttons, links and tabs (exactly what a keyboard user tabs
 * between) were NOT excluded, so Tab never moved focus anywhere on the page
 * while either tool was open. `IdeaRecommendationMap.tsx` (Mind Map) had an
 * analogous defect via a different route: a `noRealFocus` fallback that
 * treated `document.activeElement === document.body` as "inside the map" —
 * true everywhere on the page before anything else has been focused.
 *
 * Read fresh on every keydown (never captured once at effect-setup time) so
 * it self-corrects regardless of whether the canvas container has mounted
 * yet — Process Flow/Whiteboard render a loading skeleton in place of the
 * real canvas container while their idea map is still hydrating, so the ref
 * can still be null on the very first keydown after the tool opens.
 */
export function isElementWithinCanvas(
  container: HTMLElement | null | undefined,
  target: EventTarget | null,
  activeElement: Element | null
): boolean {
  if (!container) return false;
  if (target instanceof Node && container.contains(target)) return true;
  if (activeElement instanceof Node && container.contains(activeElement)) return true;
  return false;
}
