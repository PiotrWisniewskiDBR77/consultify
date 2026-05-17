/**
 * Shared layout-audit flag priority decision (Sprint S16).
 *
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *   - WP-06 carry / R-S15-1.
 *
 * Extracted from `report/pptx/composites/LayoutTruncationMarker` so the
 * PDF renderer (S16) and the PPTX renderer (S15) consult the SAME
 * priority logic. Without this extraction, a future audit flag
 * addition could be wired into one renderer and silently ignored by
 * the other — exactly the drift this module exists to prevent.
 *
 * Pure: no I/O, no clock, no globals. Tests call it directly.
 */

// ---------------------------------------------------------------------------
// Constants — kept in sync with `LayoutAuditFlag` in
// `presentationStudioLayoutAuditService`. The drift guard test asserts
// that adding a flag without updating these sets fails CI.
// ---------------------------------------------------------------------------

/**
 * Audit flags the renderer markers recognize. Anything outside this
 * set is filtered out by `decideLayoutAuditMarker`.
 */
export const KNOWN_FLAGS: ReadonlySet<string> = new Set([
  'layout_overflow_title',
  'layout_overflow_key_message',
  'layout_overflow_blocks',
  'missing_source_for_evidence_intent',
  'unsupported_intent_for_pptx_export',
  'unsupported_intent_for_pdf_export',
]);

/**
 * High-priority flags warrant a higher-contrast marker tone (rose
 * instead of amber) and an auto-expanded banner on the canvas. The
 * S12 banner uses the SAME set so canvas + rendered-artifact
 * priorities stay in sync.
 */
export const HIGH_PRIORITY_FLAGS: ReadonlySet<string> = new Set([
  'missing_source_for_evidence_intent',
  'unsupported_intent_for_pptx_export',
  'unsupported_intent_for_pdf_export',
]);

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

export interface LayoutAuditMarkerDecision {
  /** Whether the marker should render. */
  shouldRender: boolean;
  /** Resolved priority tier; only meaningful when `shouldRender` is true. */
  priority: 'high' | 'advisory' | 'none';
  /** Number of recognized, deduped flags driving the marker. */
  recognizedFlagCount: number;
  /** Recognized flags, deduped + sorted for stable test/render output. */
  recognizedFlags: string[];
}

/**
 * Decide whether a slide / card warrants a marker, and at what
 * priority. Pure: returns the decision so callers (renderers, tests,
 * future banner ports) can reason about the marker without pulling in
 * any rendering code.
 *
 * Behaviour:
 *   - returns `{ shouldRender: false, priority: 'none', ... }` when
 *     `flags` is null / undefined / empty / contains only unrecognized
 *     strings.
 *   - returns `priority: 'high'` when ANY recognized flag is in
 *     `HIGH_PRIORITY_FLAGS`.
 *   - returns `priority: 'advisory'` for the remaining flags (the
 *     three overflow classes).
 */
export function decideLayoutAuditMarker(
  flags: ReadonlyArray<string> | null | undefined
): LayoutAuditMarkerDecision {
  if (!flags || flags.length === 0) {
    return {
      shouldRender: false,
      priority: 'none',
      recognizedFlagCount: 0,
      recognizedFlags: [],
    };
  }
  const recognized = Array.from(
    new Set(flags.filter((f): f is string => typeof f === 'string' && KNOWN_FLAGS.has(f)))
  ).sort();
  if (recognized.length === 0) {
    return {
      shouldRender: false,
      priority: 'none',
      recognizedFlagCount: 0,
      recognizedFlags: [],
    };
  }
  const isHigh = recognized.some((f) => HIGH_PRIORITY_FLAGS.has(f));
  return {
    shouldRender: true,
    priority: isHigh ? 'high' : 'advisory',
    recognizedFlagCount: recognized.length,
    recognizedFlags: recognized,
  };
}

// ---------------------------------------------------------------------------
// Test-only helpers
// ---------------------------------------------------------------------------

export function _highPriorityFlagsForTests(): ReadonlySet<string> {
  return HIGH_PRIORITY_FLAGS;
}

export function _knownFlagsForTests(): ReadonlySet<string> {
  return KNOWN_FLAGS;
}
