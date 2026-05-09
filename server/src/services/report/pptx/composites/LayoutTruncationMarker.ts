/**
 * Composite: Layout Truncation / Review Marker (Sprint S15).
 *
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *   - WP-06 carry / R-S13-4.
 *
 * Closes the renderer-side gap left by S10–S14: when the layout audit
 * flags a slide (overflowing title, missing evidence source, unsupported
 * intent for the chosen export target), the audit warning shows up on
 * the Studio canvas via the `PresentationStudioLayoutAuditBanner` (S11)
 * — but the rendered PPTX could still silently truncate the offending
 * text. The S15 marker makes the rendered artifact honest about the
 * warning so the reviewer who only sees the deck (not the Studio canvas)
 * still gets a visible signal that "this slide needs a layout review".
 *
 * The component is intentionally small, top-right, language-neutral
 * (icon + counter) and color-tiered:
 *   - amber   for advisory flags (the four overflow flags),
 *   - rose    when ANY high-priority flag is present
 *             (`missing_source_for_evidence_intent`,
 *              `unsupported_intent_for_pptx_export`,
 *              `unsupported_intent_for_pdf_export`).
 *
 * The marker is non-blocking — it does not prevent the slide from
 * rendering. It is purely a visible badge so the reviewer cannot say
 * "I didn't see the warning". This mirrors the S12 high-priority
 * semantics in the banner so a reviewer reading the deck sees the same
 * priority class as a reviewer reading the Studio canvas.
 *
 * Pure function: no I/O, no clock, no globals. Tests call it directly
 * with a mocked `UnifiedSlide` and assert the returned shape.
 */

import type { DesignTokens, RenderedElement, UnifiedSlide } from '../types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Audit flags that the S12 banner classifies as high-priority. Mirrored
 * here so the renderer marker uses the same semantics. If a future flag
 * class is added, update both `HIGH_PRIORITY_FLAGS` here AND in
 * `PresentationStudioLayoutAuditBanner.tsx` to keep the priority story
 * consistent across canvas and rendered artifact.
 */
const HIGH_PRIORITY_FLAGS: ReadonlySet<string> = new Set([
  'missing_source_for_evidence_intent',
  'unsupported_intent_for_pptx_export',
  'unsupported_intent_for_pdf_export',
]);

/**
 * Audit flags the marker recognizes. Anything outside this set is
 * ignored — defensive guard against future audit-only flags that
 * shouldn't trigger a renderer marker. Keep in sync with
 * `LayoutAuditFlag` in `presentationStudioLayoutAuditService`.
 */
const KNOWN_FLAGS: ReadonlySet<string> = new Set([
  'layout_overflow_title',
  'layout_overflow_key_message',
  'layout_overflow_blocks',
  'missing_source_for_evidence_intent',
  'unsupported_intent_for_pptx_export',
  'unsupported_intent_for_pdf_export',
]);

// 16:9 slide is 10in x 5.625in (LAYOUT_16x9). Marker sits in the
// top-right corner, vertically aligned with the slide title band but
// shifted slightly inward so it never overlaps a long title.
const MARKER_POSITION = {
  x: 8.45,
  y: 0.12,
  w: 1.4,
  h: 0.22,
};

// Color palette. We derive the hex codes locally (rather than from
// `tokens.colors.*`) because the marker has fixed semantic meaning
// regardless of the brand theme — an amber warning must read as amber
// even on a corporate-blue brand override.
const MARKER_COLORS = {
  amberFill: 'D97706', // tailwind amber-600
  amberText: 'FFFBEB', // tailwind amber-50
  roseFill: 'BE123C', // tailwind rose-700
  roseText: 'FFF1F2', // tailwind rose-50
} as const;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface LayoutTruncationMarkerDecision {
  /** Whether the marker should render. */
  shouldRender: boolean;
  /** Resolved priority tier; only meaningful when `shouldRender` is true. */
  priority: 'high' | 'advisory' | 'none';
  /** Number of recognized flags driving the marker. */
  recognizedFlagCount: number;
  /** Recognized flags, deduped + sorted for stable test output. */
  recognizedFlags: string[];
}

/**
 * Decide whether a slide warrants a marker, and at what priority.
 * Pure: returns the decision so callers (including tests) can reason
 * about the marker without going through the renderer.
 *
 * Behaviour:
 *   - returns `{ shouldRender: false, priority: 'none', ... }` when
 *     `slide.auditFlags` is undefined, empty, or contains only
 *     unrecognized strings.
 *   - returns `priority: 'high'` when ANY recognized flag is in
 *     `HIGH_PRIORITY_FLAGS`.
 *   - returns `priority: 'advisory'` for the remaining flags (the
 *     three overflow classes).
 */
export function decideLayoutTruncationMarker(slide: UnifiedSlide): LayoutTruncationMarkerDecision {
  const raw = slide.auditFlags;
  if (!raw || raw.length === 0) {
    return {
      shouldRender: false,
      priority: 'none',
      recognizedFlagCount: 0,
      recognizedFlags: [],
    };
  }
  // Dedupe + filter to recognized + sort for determinism.
  const recognized = Array.from(
    new Set(raw.filter((f): f is string => typeof f === 'string' && KNOWN_FLAGS.has(f)))
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

/**
 * Build the rendered marker for a slide, or `null` when the slide
 * does not warrant one. The returned `RenderedElement` follows the
 * standard PPTX-module shape (`{ kind, apply }`), so the pipeline
 * applies it identically to atomics / composites returned by
 * individual layouts.
 *
 * The marker is a small rounded rect with `⚠ <count>` centered.
 * Language-neutral: the icon + numeral conveys the meaning without
 * depending on the deck's language (the audit banner on the Studio
 * canvas is the authoritative human-readable explanation).
 */
export function buildLayoutTruncationMarker(
  slide: UnifiedSlide,
  // `tokens` is accepted for API symmetry with atomics/composites and
  // for forward-compat (e.g. when we honour brand-mode dark themes).
  // Unused today — fixed semantic colors override brand tokens.
  _tokens: DesignTokens
): RenderedElement | null {
  const decision = decideLayoutTruncationMarker(slide);
  if (!decision.shouldRender) return null;

  const fill = decision.priority === 'high' ? MARKER_COLORS.roseFill : MARKER_COLORS.amberFill;
  const textColor = decision.priority === 'high' ? MARKER_COLORS.roseText : MARKER_COLORS.amberText;
  const label = `⚠ ${decision.recognizedFlagCount}`;

  return {
    kind: 'shape',
    apply(slide: unknown) {
      const s = slide as {
        addShape: (kind: string, opts: unknown) => void;
        addText: (text: string, opts: unknown) => void;
      };
      s.addShape('roundRect', {
        x: MARKER_POSITION.x,
        y: MARKER_POSITION.y,
        w: MARKER_POSITION.w,
        h: MARKER_POSITION.h,
        fill: { color: fill },
        line: { color: fill, width: 0 },
        rectRadius: 0.08,
      });
      s.addText(label, {
        x: MARKER_POSITION.x,
        y: MARKER_POSITION.y,
        w: MARKER_POSITION.w,
        h: MARKER_POSITION.h,
        fontSize: 9,
        bold: true,
        color: textColor,
        align: 'center',
        valign: 'middle',
        margin: 0,
      });
    },
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

export function _markerPositionForTests(): typeof MARKER_POSITION {
  return MARKER_POSITION;
}

export function _markerColorsForTests(): typeof MARKER_COLORS {
  return MARKER_COLORS;
}
