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
import {
  _snapshotRegistryForTests,
  normalizeTemplateFamily as registryNormalizeTemplateFamily,
  resolveSlotCapacity as registryResolveSlotCapacity,
} from './presentationStudioLayoutCapacityRegistryService.js';

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
// Slot capacity model
//
// Sprint S13: capacity numbers + per-family overrides + raw-deck-type
// aliases moved into `presentationStudioLayoutCapacityRegistryService`.
// The audit consults the registry through `resolveSlotCapacity`, which
// reads the live state (canonical defaults + any runtime overrides
// applied via `applyOverrides`). The `DensityKey` alias stays here as
// the audit's local type because it is also referenced by `densityFor`
// and `densityForSlot` below.
// ---------------------------------------------------------------------------

type DensityKey = 'visual' | 'balanced' | 'document';

// Re-export the registry resolver under the local name the audit uses.
const resolveSlotCapacity = registryResolveSlotCapacity;
// `normalizeTemplateFamily` is consumed exclusively by `resolveSlotCapacity`
// inside the registry; the audit no longer needs to call it directly. We
// reference the import once so dependency-pruning lint rules see it.
void registryNormalizeTemplateFamily;

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

/**
 * Sprint S12 — resolve the density for a specific slot. When the outline
 * item declares `slotDensities[slot]` we use that; otherwise we fall back
 * to the slide-level `density` (and ultimately to `'balanced'`). Closes
 * R-S10-2 by allowing real layouts that mix densities within a slide
 * (e.g. dense bullets + sparse hero) to be audited per slot.
 */
type SlotKey = 'title' | 'keyMessage' | 'blocks';

function densityForSlot(item: OutlineItem, slot: SlotKey): DensityKey {
  const slotDensities = item.slotDensities;
  if (slotDensities) {
    const override = slotDensities[slot];
    if (override === 'visual' || override === 'balanced' || override === 'document') {
      return override;
    }
  }
  return densityFor(item);
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

    // Sprint S12 — resolve slot capacities per-slot. When the outline
    // item declares `slotDensities[slot]` we use that density's budget;
    // otherwise we fall back to the slide-level `density`. The
    // template-family override applies inside `resolveSlotCapacity` so
    // S11 + S12 compose cleanly.
    const titleBudget = resolveSlotCapacity(densityForSlot(item, 'title'), templateFamily);
    const keyMessageBudget = resolveSlotCapacity(
      densityForSlot(item, 'keyMessage'),
      templateFamily
    );
    const blocksBudget = resolveSlotCapacity(densityForSlot(item, 'blocks'), templateFamily);

    // 1. Slot capacity
    if (typeof item?.title === 'string' && item.title.length > titleBudget.titleMaxChars) {
      flags.push('layout_overflow_title');
      warnings.push(
        `[layout_overflow_title] Slide ${index + 1} (${intent || 'unknown'}): title is ${item.title.length} chars; ${FLAG_LABELS.layout_overflow_title} (~${titleBudget.titleMaxChars}).`
      );
    }
    if (
      typeof item?.keyMessage === 'string' &&
      item.keyMessage.length > keyMessageBudget.keyMessageMaxChars
    ) {
      flags.push('layout_overflow_key_message');
      warnings.push(
        `[layout_overflow_key_message] Slide ${index + 1} (${intent || 'unknown'}): key message is ${item.keyMessage.length} chars; ${FLAG_LABELS.layout_overflow_key_message} (~${keyMessageBudget.keyMessageMaxChars}).`
      );
    }
    if (
      Array.isArray(item?.suggestedBlocks) &&
      item.suggestedBlocks.length > blocksBudget.blocksMax
    ) {
      flags.push('layout_overflow_blocks');
      warnings.push(
        `[layout_overflow_blocks] Slide ${index + 1} (${intent || 'unknown'}): ${item.suggestedBlocks.length} suggested blocks; ${FLAG_LABELS.layout_overflow_blocks} (max ${blocksBudget.blocksMax}).`
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
 * Test-only helper (Sprint S11; updated S13). Returns the live
 * template-family override map snapshot from the capacity registry.
 * Tests use this to guard against accidental drift between the audit's
 * family list and the runtime's actual `TemplateFamily` enum.
 */
export function _templateFamilyOverridesForTests(): Readonly<Record<string, unknown>> {
  return _snapshotRegistryForTests().templateFamilyOverrides;
}

/**
 * Test-only helper (Sprint S11; updated S13). Returns the live
 * raw-deck-type → canonical TemplateFamily alias snapshot from the
 * capacity registry. The unit test asserts every value is a registered
 * override key.
 */
export function _familyAliasByDeckTypeForTests(): Readonly<Record<string, string>> {
  return _snapshotRegistryForTests().familyAliasByDeckType;
}
