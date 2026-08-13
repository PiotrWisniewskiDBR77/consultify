/**
 * mindmapKeyboardScope — G4-KBD-P0 fix (2026-08-11, F-K1/F-K2).
 *
 * Pure resolution logic for IdeaRecommendationMap.tsx's canvas keydown
 * grammar (Tab=add child, Enter=add sibling, ...). Extracted out of the
 * component's keydown listener so the exact same logic that runs in
 * production is what the tests below exercise — same pattern as
 * `resolveKeyboardContextMenuTarget.ts` in this folder.
 *
 * F-K1 (Mind Map instance): the previous `isWithinMap` check in
 * IdeaRecommendationMap.tsx had a `noRealFocus` fallback that treated
 * `document.activeElement === document.body` as "inside the map" — true
 * EVERYWHERE on the page before anything has been focused yet, not just
 * this canvas, so a bare Tab keypress anywhere hijacked focus/added a node.
 * The canvas container is already given real, legitimate DOM focus on
 * mount (see the `containerRef.current?.focus({ preventScroll: true })`
 * call in IdeaRecommendationMap.tsx's viewport-restore effect) specifically
 * so "select a branch and press Tab" works from a fresh load — the body
 * fallback was therefore both redundant AND unsafe. `isCanvasKeyboardScope`
 * requires REAL containment: the event target or the live activeElement
 * must be the container itself or one of its descendants. document.body/
 * documentElement are never treated as "inside".
 *
 * F-K2: `resolveMindMapGrammarAction` requires `!e.shiftKey` for the Tab →
 * add-child mapping (the production code was missing it), matching how the
 * rest of this same grammar already excludes the modifier (Enter+Shift is
 * handled as its own case in the component; ArrowLeft/Right promote/demote
 * elsewhere explicitly gate on modifiers too). Without the guard, Shift+Tab
 * — a pure focus-navigation key — silently created a real empty child node
 * with its inline editor open.
 *
 * The containment check itself now lives in `canvasFocusScope.ts`, shared
 * with `useIdeasToolKeyboard.ts` (Process Flow + Whiteboard's analogous
 * F-K1 fix) — re-exported here under its original name so
 * IdeaRecommendationMap.tsx's import and this file's own tests don't need
 * to change.
 */
export { isElementWithinCanvas as isCanvasKeyboardScope } from './canvasFocusScope';

export type MindMapGrammarAction = 'add_child' | 'add_sibling' | null;

/**
 * NOTE: only the Tab branch is in scope for F-K2. Plain `Enter` (regardless
 * of Shift) resolves to `add_sibling` here, matching current production
 * behavior exactly (Shift+Enter reaching this point — i.e. NOT already
 * intercepted by the isEditing/isInput guard upstream — is a separate,
 * pre-existing latent gap, not touched by this fix).
 */
export function resolveMindMapGrammarAction(
  e: Pick<KeyboardEvent, 'key' | 'shiftKey'>
): MindMapGrammarAction {
  if (e.key === 'Tab' && !e.shiftKey) return 'add_child';
  if (e.key === 'Enter') return 'add_sibling';
  return null;
}
