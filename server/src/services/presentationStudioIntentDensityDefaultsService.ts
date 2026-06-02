/**
 * Presentation Studio Intent Density Defaults (Sprint S14).
 *
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *   - WP-06 carry / R-S12-1.
 *
 * Closes the consumer-side of S12's `slotDensities` story.
 *
 * The audit (S12) became capable of resolving capacity caps per-slot
 * within a single slide, but no generator path emitted `slotDensities`
 * — so in practice every slide still routed through one slide-level
 * `density`. S14 wires the generators to emit:
 *
 *   - a sensible slide-level `density` per `intent`, and
 *   - a `slotDensities` override for intents whose canonical layout
 *     mixes densities (e.g. comparison slides have a sparse hero title
 *     above dense bullet cells).
 *
 * Both are advisory: any caller that already set its own `density` or
 * `slotDensities` keeps those values. `applyIntentDensityDefaults`
 * NEVER overrides — it only fills in missing fields.
 *
 * The mapping below is deliberately conservative. We only attach a
 * `slotDensities` entry when the canonical 16:9 layout for that intent
 * is documented to mix densities; otherwise we leave `slotDensities`
 * undefined and let the slide-level density govern.
 */

import type { OutlineItem } from './presentationGeneratorService.js';

export type DensityKey = 'visual' | 'balanced' | 'document';

export interface IntentDensityDefaults {
  /**
   * The slide-level density baseline for this intent. Defaults to
   * `'balanced'` when an intent is not registered here, mirroring the
   * audit's own slide-level fallback.
   */
  density: DensityKey;
  /**
   * Optional per-slot overrides applied by `applyIntentDensityDefaults`
   * when the caller hasn't set their own `slotDensities`. Each field is
   * itself optional — only document the slots that demonstrably differ
   * from the slide-level density.
   */
  slotDensities?: {
    title?: DensityKey;
    keyMessage?: DensityKey;
    blocks?: DensityKey;
  };
}

// ---------------------------------------------------------------------------
// Canonical defaults
//
// These intents come from `report/pptx/types.ts::SlideIntent`. The
// numbers here are calibrated against the masters declared in
// `presentationBrandLayoutService` and the recipe blocks in
// `presentationTemplateRuntimeService`. If a future renderer revision
// changes the layout shape, update the corresponding entry below in the
// same change.
// ---------------------------------------------------------------------------

const INTENT_DENSITY_DEFAULTS: Readonly<Record<string, IntentDensityDefaults>> = {
  // Cover slides keep little text on screen. The hero title sits in a
  // large 80pt frame; no mixed-density cells.
  cover: { density: 'visual' },

  // Executive summary mixes a short hero thesis (balanced) with a
  // dense bullet/KPI band below — bullets are document-density.
  executive_summary: {
    density: 'balanced',
    slotDensities: { blocks: 'document' },
  },

  // Section intro is a visual marker between sections — sparse.
  section_intro: { density: 'visual' },

  // Key messages: balanced hero with 3-6 bullets that themselves can
  // run long ("decision required because…"); bullets are document.
  key_messages: {
    density: 'balanced',
    slotDensities: { blocks: 'document' },
  },

  // Performance overview: balanced narrative + dense KPI grid cells.
  performance_overview: {
    density: 'balanced',
    slotDensities: { blocks: 'document' },
  },

  // Single insight slides are deliberately sparse — one big number,
  // one short callout. No density mix.
  single_insight: { density: 'visual' },

  // Comparison: short visual hero ("A vs B") above dense table cells.
  // Title is intentionally tighter than the slide-level density.
  comparison: {
    density: 'balanced',
    slotDensities: { title: 'visual', blocks: 'document' },
  },

  // Assessment slides are long narrative by design. The whole slide
  // sits in document density; no per-slot override.
  assessment: { density: 'document' },

  // Root cause: balanced framing thesis + dense supporting bullets.
  root_cause: {
    density: 'balanced',
    slotDensities: { blocks: 'document' },
  },

  // Recommendation single: hero title is the recommendation itself
  // (kept tight = visual) above a balanced rationale + dense bullets.
  recommendation_single: {
    density: 'balanced',
    slotDensities: { title: 'visual', blocks: 'document' },
  },

  // Recommendation portfolio: dense bullet cells per recommendation.
  recommendation_portfolio: {
    density: 'balanced',
    slotDensities: { blocks: 'document' },
  },

  // Initiative portfolio: same shape as recommendation portfolio —
  // dense per-initiative cells under a balanced framing title.
  initiative_portfolio: {
    density: 'balanced',
    slotDensities: { blocks: 'document' },
  },

  // Prioritization matrix: visual hero ("Impact vs Effort") with
  // dense quadrant labels.
  prioritization_matrix: {
    density: 'balanced',
    slotDensities: { title: 'visual', blocks: 'document' },
  },

  // Roadmap: balanced narrative + dense timeline cells / swimlane labels.
  roadmap: {
    density: 'balanced',
    slotDensities: { blocks: 'document' },
  },

  // Risk management: balanced thesis + dense RAID cells.
  risk_management: {
    density: 'balanced',
    slotDensities: { blocks: 'document' },
  },

  // Next steps: balanced; bullets stay short ("approve by", "next
  // meeting"), no document override.
  next_steps: { density: 'balanced' },

  // Appendix: long text by design. Document density across the slide.
  appendix: { density: 'document' },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the registered defaults for a given intent, or `undefined`
 * if no entry exists. Unknown intents intentionally produce
 * `undefined` rather than a fabricated default so the caller can
 * decide whether to fall back to slide-level `'balanced'` or leave
 * the field unset.
 */
export function intentDensityDefaultsFor(
  intent: OutlineItem['intent'] | string | undefined
): IntentDensityDefaults | undefined {
  if (!intent || typeof intent !== 'string') return undefined;
  const entry = INTENT_DENSITY_DEFAULTS[intent];
  if (!entry) return undefined;
  return {
    density: entry.density,
    slotDensities: entry.slotDensities ? { ...entry.slotDensities } : undefined,
  };
}

/**
 * Returns a NEW outline item with `density` and `slotDensities` filled
 * in from the registered defaults for `item.intent`. Caller-provided
 * values are preserved verbatim — this function never overrides:
 *
 *   - if `item.density` is already set, the slide-level density is kept.
 *   - if `item.slotDensities.title` (or `keyMessage` / `blocks`) is
 *     already set, that per-slot override is kept; only the unset
 *     slots get the registered default.
 *
 * Unknown intents pass through with no changes (returns the original
 * fields plus a stable spread). The function is intentionally pure:
 * no I/O, no state, no globals — safe to call from any generator.
 */
export function applyIntentDensityDefaults(item: OutlineItem): OutlineItem {
  const defaults = intentDensityDefaultsFor(item.intent);
  if (!defaults) return { ...item };

  const nextDensity = item.density ?? defaults.density;

  // Build the merged slotDensities. Caller wins per-slot; defaults
  // only fill the gaps. We omit `slotDensities` entirely if neither
  // the caller nor the defaults provided any per-slot entries — keeps
  // the wire payload tight.
  const callerSlots = item.slotDensities;
  const defaultSlots = defaults.slotDensities;

  let mergedSlots: OutlineItem['slotDensities'];
  if (callerSlots || defaultSlots) {
    const merged: NonNullable<OutlineItem['slotDensities']> = {};
    const titleVal = callerSlots?.title ?? defaultSlots?.title;
    const keyMessageVal = callerSlots?.keyMessage ?? defaultSlots?.keyMessage;
    const blocksVal = callerSlots?.blocks ?? defaultSlots?.blocks;
    if (titleVal) merged.title = titleVal;
    if (keyMessageVal) merged.keyMessage = keyMessageVal;
    if (blocksVal) merged.blocks = blocksVal;
    if (Object.keys(merged).length > 0) mergedSlots = merged;
  }

  return {
    ...item,
    density: nextDensity,
    ...(mergedSlots ? { slotDensities: mergedSlots } : {}),
  };
}

/**
 * Test-only helper. Returns the full registered map so tests can
 * assert no drift between this module and the SlideIntent canonical
 * set.
 */
export function _intentDensityDefaultsForTests(): Readonly<Record<string, IntentDensityDefaults>> {
  return INTENT_DENSITY_DEFAULTS;
}
