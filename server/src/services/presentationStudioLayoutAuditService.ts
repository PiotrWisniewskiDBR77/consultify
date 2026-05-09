/**
 * Presentation Studio Layout Audit Service (Sprint S10)
 *
 * Module: Consultify Presentation Studio.
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *   - WP-06 (Visual Layout Engine Hardening) / MT-PRES-037 / MT-PRES-038.
 *
 * Pure, dependency-free audit pass over a Studio outline. Surfaces three
 * classes of layout-quality flags as warning strings on the existing
 * `validationWarnings[]` channel:
 *   1. Text density vs slot capacity — title, key message, suggested
 *      block count exceed canonical PPTX 16:9 budgets for the slide's
 *      density mode.
 *   2. Missing-source placeholder discipline — slide intents that the
 *      contract requires to be evidence-backed (assessment, root_cause,
 *      recommendation_*, performance_overview, risk_management) carry no
 *      `sourceRef` / `sourceRefs` despite being enabled.
 *   3. PPTX export parity — slide intent is not in the canonical
 *      `SlideIntent` set understood by the PPTX renderer; the deck would
 *      render but the slide intent would silently fall back. We surface
 *      this as a warning so the fallback is visible, never hidden.
 *
 * Disabled slides (`enabled === false`) are skipped — they will not be
 * exported, so flagging them would be noise.
 *
 * The service is dependency-free. No DB, no clock, no external services.
 * It reads only the outline shape produced by the orchestrator's preview
 * surface and the real generator's output. Tests can run in milliseconds.
 */

import type { OutlineItem } from './presentationGeneratorService.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type LayoutAuditFlag =
  | 'layout_overflow_title'
  | 'layout_overflow_key_message'
  | 'layout_overflow_blocks'
  | 'missing_source_for_evidence_intent'
  | 'unsupported_intent_for_pptx_export';

export interface PresentationStudioSlideLayoutAudit {
  /** Zero-based index of the audited slide in the outline. */
  index: number;
  intent: string;
  /** Stable, machine-readable flag ids (one per finding on this slide). */
  flags: LayoutAuditFlag[];
}

export interface PresentationStudioOutlineLayoutAudit {
  /** Human-readable warning lines, one per (slide, flag) tuple. */
  warnings: string[];
  /** Per-slide audit results. Slides with no findings are still listed for diffability. */
  slideAudits: PresentationStudioSlideLayoutAudit[];
  /** Aggregate finding counts keyed by flag id. */
  flagCounts: Record<LayoutAuditFlag, number>;
}

// ---------------------------------------------------------------------------
// Slot capacity model — canonical PPTX 16:9 (13.333" x 7.5").
//
// These budgets are intentionally conservative. They are NOT meant to mirror
// the exact pixel layout (renderer-specific) but to flag obvious overflows
// the user can fix at outline time. The numbers came from auditing the
// existing `presentationBrandLayoutService` and `report/pptx` layouts and
// rounding down to the nearest typographically safe character count. If a
// future renderer extends a slot, raise the cap here and re-test.
// ---------------------------------------------------------------------------

interface SlotCapacity {
  titleMaxChars: number;
  /**
   * `keyMessage` budget. For multi-line keymessages we count total
   * characters; an explicit per-line cap is renderer-specific and lives in
   * the renderer.
   */
  keyMessageMaxChars: number;
  /** Maximum number of suggested blocks (bullets, content tiles) on the slide. */
  blocksMax: number;
}

/**
 * Per-density slot capacities. `density` is set by the generator on each
 * outline item (`visual` | `balanced` | `document`). When the generator
 * does not set a density, we default to `balanced`.
 */
const DENSITY_BUDGETS: Record<'visual' | 'balanced' | 'document', SlotCapacity> = {
  // Visual-heavy slides (covers, single-insight, comparison) keep little
  // text on screen. A user-typed title above 80 chars almost always wraps
  // beyond two lines on a 16:9 master.
  visual: { titleMaxChars: 80, keyMessageMaxChars: 160, blocksMax: 4 },
  // Balanced slides (executive summary, key messages, performance overview)
  // mix a hero message with 3-6 supporting points.
  balanced: { titleMaxChars: 90, keyMessageMaxChars: 240, blocksMax: 6 },
  // Document-density slides (assessment, recommendation_portfolio, appendix)
  // tolerate longer prose but still cap at body-frame heights.
  document: { titleMaxChars: 110, keyMessageMaxChars: 360, blocksMax: 8 },
};

// ---------------------------------------------------------------------------
// Evidence rule set
//
// Slide intents that the methodology contract explicitly grounds in source
// artifacts. Missing source references on these intents produce a warning,
// not a block: the generator may still emit a placeholder, but the
// reviewer must see that the placeholder exists.
// ---------------------------------------------------------------------------

const EVIDENCE_REQUIRED_INTENTS = new Set<string>([
  'assessment',
  'root_cause',
  'recommendation_single',
  'recommendation_portfolio',
  'initiative_portfolio',
  'performance_overview',
  'risk_management',
  'roadmap',
  'prioritization_matrix',
  'comparison',
]);

// ---------------------------------------------------------------------------
// Canonical PPTX export-supported intents. Mirrors the `SlideIntent` union
// in `report/pptx/types.ts`. We duplicate the list here intentionally so
// the audit service stays decoupled from the PPTX module's import graph;
// any drift is caught by the regression test that asserts both lists match.
// ---------------------------------------------------------------------------

const PPTX_SUPPORTED_INTENTS = new Set<string>([
  'cover',
  'executive_summary',
  'section_intro',
  'key_messages',
  'performance_overview',
  'single_insight',
  'comparison',
  'assessment',
  'root_cause',
  'recommendation_single',
  'recommendation_portfolio',
  'initiative_portfolio',
  'prioritization_matrix',
  'roadmap',
  'risk_management',
  'next_steps',
  'appendix',
]);

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

const FLAG_LABELS: Record<LayoutAuditFlag, string> = {
  layout_overflow_title: 'title exceeds canonical PPTX 16:9 cap',
  layout_overflow_key_message: 'key message exceeds canonical PPTX 16:9 cap',
  layout_overflow_blocks: 'too many suggested blocks for the canonical slot',
  missing_source_for_evidence_intent: 'evidence-backed intent has no source reference',
  unsupported_intent_for_pptx_export:
    'intent is not natively renderable by the PPTX export pipeline',
};

function densityFor(item: OutlineItem): 'visual' | 'balanced' | 'document' {
  return (item.density as 'visual' | 'balanced' | 'document') || 'balanced';
}

function slideHasSourceReference(item: OutlineItem): boolean {
  if (item.sourceRef && String(item.sourceRef).trim().length > 0) return true;
  if (
    Array.isArray(item.sourceRefs) &&
    item.sourceRefs.some((ref) => String(ref).trim().length > 0)
  ) {
    return true;
  }
  return false;
}

function emptyFlagCounts(): Record<LayoutAuditFlag, number> {
  return {
    layout_overflow_title: 0,
    layout_overflow_key_message: 0,
    layout_overflow_blocks: 0,
    missing_source_for_evidence_intent: 0,
    unsupported_intent_for_pptx_export: 0,
  };
}

/**
 * Audit a Studio outline. Pure function. Returns aggregate warning strings,
 * a per-slide audit map, and a flag counter so the orchestrator can route
 * downstream behaviour off counts (e.g. surface "5 layout warnings" in the
 * UI without re-parsing strings).
 *
 * The function does NOT throw. Malformed outline items (missing intent,
 * non-string title) simply skip the per-field check that doesn't apply.
 */
export function auditPresentationStudioOutlineLayout(
  outline: ReadonlyArray<OutlineItem>
): PresentationStudioOutlineLayoutAudit {
  const flagCounts = emptyFlagCounts();
  const slideAudits: PresentationStudioSlideLayoutAudit[] = [];
  const warnings: string[] = [];

  outline.forEach((item, index) => {
    const intent = String(item?.intent || '').trim();
    const flags: LayoutAuditFlag[] = [];

    // Disabled slides do not export, so don't audit them.
    if (item?.enabled === false) {
      slideAudits.push({ index, intent, flags });
      return;
    }

    const budget = DENSITY_BUDGETS[densityFor(item)];

    // 1. Slot capacity
    if (typeof item?.title === 'string' && item.title.length > budget.titleMaxChars) {
      flags.push('layout_overflow_title');
      warnings.push(
        `[layout_overflow_title] Slide ${index + 1} (${intent || 'unknown'}): title is ${item.title.length} chars; ${FLAG_LABELS.layout_overflow_title} (~${budget.titleMaxChars}).`
      );
    }
    if (
      typeof item?.keyMessage === 'string' &&
      item.keyMessage.length > budget.keyMessageMaxChars
    ) {
      flags.push('layout_overflow_key_message');
      warnings.push(
        `[layout_overflow_key_message] Slide ${index + 1} (${intent || 'unknown'}): key message is ${item.keyMessage.length} chars; ${FLAG_LABELS.layout_overflow_key_message} (~${budget.keyMessageMaxChars}).`
      );
    }
    if (Array.isArray(item?.suggestedBlocks) && item.suggestedBlocks.length > budget.blocksMax) {
      flags.push('layout_overflow_blocks');
      warnings.push(
        `[layout_overflow_blocks] Slide ${index + 1} (${intent || 'unknown'}): ${item.suggestedBlocks.length} suggested blocks; ${FLAG_LABELS.layout_overflow_blocks} (max ${budget.blocksMax}).`
      );
    }

    // 2. Evidence discipline
    if (intent && EVIDENCE_REQUIRED_INTENTS.has(intent) && !slideHasSourceReference(item)) {
      flags.push('missing_source_for_evidence_intent');
      warnings.push(
        `[missing_source_for_evidence_intent] Slide ${index + 1} (${intent}): ${FLAG_LABELS.missing_source_for_evidence_intent} — outline has neither sourceRef nor sourceRefs.`
      );
    }

    // 3. PPTX export parity
    if (intent && !PPTX_SUPPORTED_INTENTS.has(intent)) {
      flags.push('unsupported_intent_for_pptx_export');
      warnings.push(
        `[unsupported_intent_for_pptx_export] Slide ${index + 1}: ${FLAG_LABELS.unsupported_intent_for_pptx_export} (intent="${intent}").`
      );
    }

    for (const flag of flags) flagCounts[flag] += 1;
    slideAudits.push({ index, intent, flags });
  });

  return { warnings, slideAudits, flagCounts };
}

/**
 * Test-only helper. Returns the canonical PPTX-supported intents set used
 * by the audit. The unit test asserts this matches the SlideIntent union
 * in `report/pptx/types.ts`, guarding against drift.
 */
export function _pptxSupportedIntentsForTests(): ReadonlySet<string> {
  return PPTX_SUPPORTED_INTENTS;
}
