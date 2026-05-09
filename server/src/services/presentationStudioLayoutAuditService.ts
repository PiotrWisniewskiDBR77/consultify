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
  | 'unsupported_intent_for_pptx_export'
  | 'unsupported_intent_for_pdf_export';

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
// Per-template-family slot capacity OVERRIDES (Sprint S11 — closes R-S10-1).
//
// When a template family's master extends a slot beyond the canonical
// 16:9 budget, the override map raises the cap for that family only.
// This is a partial map: families that are absent fall back to the
// canonical `DENSITY_BUDGETS` above. Each entry is also partial — only
// the densities that differ from the canonical baseline are listed.
//
// The values below are calibrated against the actual master pages /
// recipe blocks declared in `presentationTemplateRuntimeService` and the
// PPTX `report/pptx` masters. If a family adds or removes a slot in a
// future revision, update the override here in the same change.
// ---------------------------------------------------------------------------

type DensityKey = 'visual' | 'balanced' | 'document';
type SlotCapacityOverride = Partial<Record<DensityKey, Partial<SlotCapacity>>>;

/**
 * Map raw deck-type strings (as returned by `resolveTemplateFamilyFromSetup`)
 * to canonical TemplateFamily display names. Mirrors `FAMILY_BY_DECK_TYPE`
 * in `presentationTemplateRuntimeService`. Duplicated here to keep the
 * audit decoupled from the runtime's import graph; the unit test guards
 * drift by enumerating both maps.
 */
const FAMILY_ALIAS_BY_DECK_TYPE: Readonly<Record<string, string>> = {
  digital_transformation_read_deck: 'Digital Transformation Read Deck',
  transformation_read_deck: 'Digital Transformation Read Deck',
  board_decision_deck: 'Board Decision Deck',
  assessment_summary: 'DRD Diagnostic Deck',
  tool_workshop: 'Initiative Kickoff Deck',
  steering_committee: 'Steering Committee Deck',
  program_update: 'Steering Committee Deck',
};

const TEMPLATE_FAMILY_BUDGET_OVERRIDES: Readonly<Record<string, SlotCapacityOverride>> = {
  // Steering Committee Deck uses an extended 3-line title band on the
  // executive summary master and a wider body frame for the program
  // pulse table. Raise the balanced/document caps modestly.
  'Steering Committee Deck': {
    balanced: { titleMaxChars: 110, keyMessageMaxChars: 280, blocksMax: 7 },
    document: { titleMaxChars: 130, keyMessageMaxChars: 420, blocksMax: 10 },
  },
  // Board Decision Deck explicitly favours a denser hero panel on
  // recommendation_single + risk_management slides — the master uses a
  // 2-line hero title with a generous body frame.
  'Board Decision Deck': {
    balanced: { titleMaxChars: 100, keyMessageMaxChars: 280, blocksMax: 6 },
  },
  // DRD Diagnostic Deck assessment slides ship a longer narrative body
  // (the diagnostic prose is the point), so we raise the document cap.
  'DRD Diagnostic Deck': {
    document: { titleMaxChars: 110, keyMessageMaxChars: 480, blocksMax: 9 },
  },
};

function normalizeTemplateFamily(family: string | null | undefined): string | null {
  if (!family) return null;
  const trimmed = String(family).trim();
  if (!trimmed) return null;
  // Canonical display names pass through untouched.
  if (Object.prototype.hasOwnProperty.call(TEMPLATE_FAMILY_BUDGET_OVERRIDES, trimmed)) {
    return trimmed;
  }
  // Raw deck-type aliases get normalized to canonical names.
  return FAMILY_ALIAS_BY_DECK_TYPE[trimmed] ?? trimmed;
}

function resolveSlotCapacity(
  density: DensityKey,
  templateFamily: string | null | undefined
): SlotCapacity {
  const baseline = DENSITY_BUDGETS[density];
  const normalized = normalizeTemplateFamily(templateFamily);
  if (!normalized) return baseline;
  const override = TEMPLATE_FAMILY_BUDGET_OVERRIDES[normalized];
  if (!override) return baseline;
  const densityOverride = override[density];
  if (!densityOverride) return baseline;
  return {
    titleMaxChars: densityOverride.titleMaxChars ?? baseline.titleMaxChars,
    keyMessageMaxChars: densityOverride.keyMessageMaxChars ?? baseline.keyMessageMaxChars,
    blocksMax: densityOverride.blocksMax ?? baseline.blocksMax,
  };
}

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
// PDF export-supported intents (Sprint S11). Today the presentation PDF
// path runs through the PPTX pipeline (PPTX -> PDF via the deck export
// service), so this set MUST mirror the PPTX set 1:1. We track it as a
// separate constant — instead of aliasing — so a future divergence (e.g.
// a native HTML->PDF deck renderer that omits a slide intent) is caught
// by the audit at the moment the divergence is introduced, not at the
// moment a customer sees a blank slide in the exported PDF.
//
// The unit test asserts both sets stay symmetric until we explicitly
// allow them to diverge (i.e. by changing the test).
// ---------------------------------------------------------------------------

const PDF_SUPPORTED_INTENTS = new Set<string>([
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
  unsupported_intent_for_pdf_export: 'intent is not natively renderable by the PDF export pipeline',
};

function densityFor(item: OutlineItem): DensityKey {
  return (item.density as DensityKey) || 'balanced';
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
    unsupported_intent_for_pdf_export: 0,
  };
}

export interface PresentationStudioOutlineLayoutAuditOptions {
  /**
   * Template family resolved by the orchestrator (e.g. "Steering
   * Committee Deck"). When provided, the audit consults a per-family
   * override map to raise slot capacities only for the families whose
   * masters declare extended slots. Unknown / unset family => canonical
   * `DENSITY_BUDGETS` apply.
   */
  templateFamily?: string | null;
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
  outline: ReadonlyArray<OutlineItem>,
  opts: PresentationStudioOutlineLayoutAuditOptions = {}
): PresentationStudioOutlineLayoutAudit {
  const flagCounts = emptyFlagCounts();
  const slideAudits: PresentationStudioSlideLayoutAudit[] = [];
  const warnings: string[] = [];
  const templateFamily = opts.templateFamily ?? null;

  outline.forEach((item, index) => {
    const intent = String(item?.intent || '').trim();
    const flags: LayoutAuditFlag[] = [];

    // Disabled slides do not export, so don't audit them.
    if (item?.enabled === false) {
      slideAudits.push({ index, intent, flags });
      return;
    }

    const budget = resolveSlotCapacity(densityFor(item), templateFamily);

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

    // 4. PDF export parity (Sprint S11). Today the PDF path runs through
    // the PPTX pipeline, so the supported set is identical. We still
    // raise this flag separately so a future divergence is visible.
    if (intent && !PDF_SUPPORTED_INTENTS.has(intent)) {
      flags.push('unsupported_intent_for_pdf_export');
      warnings.push(
        `[unsupported_intent_for_pdf_export] Slide ${index + 1}: ${FLAG_LABELS.unsupported_intent_for_pdf_export} (intent="${intent}").`
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

/**
 * Test-only helper (Sprint S11). Returns the PDF-supported intents set.
 * Today this mirrors the PPTX set (PDF flows through the PPTX pipeline);
 * the test asserts symmetry until a future divergence is explicitly
 * introduced.
 */
export function _pdfSupportedIntentsForTests(): ReadonlySet<string> {
  return PDF_SUPPORTED_INTENTS;
}

/**
 * Test-only helper (Sprint S11). Returns the registered template-family
 * override map. Tests use this to guard against accidental drift between
 * the audit's family list and the runtime's actual `TemplateFamily` enum.
 */
export function _templateFamilyOverridesForTests(): Readonly<Record<string, SlotCapacityOverride>> {
  return TEMPLATE_FAMILY_BUDGET_OVERRIDES;
}

/**
 * Test-only helper (Sprint S11). Returns the raw-deck-type → canonical
 * TemplateFamily alias map used to normalize override lookups. The unit
 * test asserts every value is a registered override key.
 */
export function _familyAliasByDeckTypeForTests(): Readonly<Record<string, string>> {
  return FAMILY_ALIAS_BY_DECK_TYPE;
}
