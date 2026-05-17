/**
 * Presentation Studio Slide Audit Decorator (Sprint S15).
 *
 * Source of truth:
 *   - .cursor/MODULE_DELIVERY_CONTRACT_STANDARD.md
 *   - consultify/docs/product/CONSULTIFY_PRESENTATION_STUDIO_100_PERCENT_IMPLEMENTATION_CONTRACT_2026-05-08.md
 *   - WP-06 carry / R-S13-4.
 *
 * Pure helper that bridges the layout audit's per-slide findings into
 * the renderer-facing `UnifiedSlide.auditFlags` field. Lives in its own
 * module (rather than inline inside `presentationGeneratorService` or
 * the orchestrator) so it can be unit-tested without touching the DB,
 * the narrative engine, or the visuals pipeline.
 *
 * Contract:
 *   - Input: the FULL outline (the audit's own `slideAudits[].index`
 *     refers to indices in the full outline, not the enabled subset),
 *     the enabled-only `UnifiedSlide[]` produced by the generator,
 *     and the audit result itself.
 *   - Output: a NEW array of `UnifiedSlide` objects with `auditFlags`
 *     populated for every enabled slide whose corresponding outline
 *     index has flags. Slides whose outline entry has no flags pass
 *     through with their existing `auditFlags` intact (so a caller
 *     that pre-populated flags is not clobbered).
 *
 * The helper is order-preserving — `slides[i]` corresponds to the
 * i-th enabled outline item — and it is purely additive: caller-set
 * `auditFlags` win when the audit produced no flags for that slide.
 */

import type { OutlineItem } from './presentationGeneratorService.js';
import type { PresentationStudioOutlineLayoutAudit } from './presentationStudioLayoutAuditService.js';
import type { UnifiedSlide } from './report/pptx/types.js';

export interface DecorateSlidesInput {
  /** Full outline as audited (includes disabled slides). */
  outline: OutlineItem[];
  /** Enabled-only UnifiedSlides as produced by the generator. */
  slides: UnifiedSlide[];
  /** Result from `auditPresentationStudioOutlineLayout`. */
  audit: PresentationStudioOutlineLayoutAudit;
}

export interface DecorateSlidesResult {
  /** New `UnifiedSlide[]` array with `auditFlags` populated. */
  slides: UnifiedSlide[];
  /** Number of slides that received at least one new flag. */
  decoratedCount: number;
  /**
   * Number of audit `slideAudits` that mapped to a disabled outline
   * entry (and therefore did NOT decorate any UnifiedSlide). This is
   * informational — disabled slides are skipped intentionally because
   * they will not be rendered.
   */
  skippedDisabledCount: number;
}

/**
 * Attach audit flags to the matching UnifiedSlide for each enabled
 * outline item. See module docstring for contract.
 */
export function decorateSlidesWithAuditFlags(input: DecorateSlidesInput): DecorateSlidesResult {
  const { outline, slides, audit } = input;

  // Build a lookup: outlineIndex → flag list. Only entries with at
  // least one flag are inserted.
  const flagsByOutlineIndex = new Map<number, string[]>();
  for (const slideAudit of audit.slideAudits) {
    if (!slideAudit.flags || slideAudit.flags.length === 0) continue;
    flagsByOutlineIndex.set(slideAudit.index, [...slideAudit.flags]);
  }

  // Walk the outline in order; for every enabled item, take the next
  // UnifiedSlide off the list and decorate. Disabled items consume an
  // outline index but no UnifiedSlide.
  const out: UnifiedSlide[] = [];
  let slideCursor = 0;
  let decoratedCount = 0;
  let skippedDisabledCount = 0;

  for (let i = 0; i < outline.length; i++) {
    const item = outline[i];
    if (!item.enabled) {
      if (flagsByOutlineIndex.has(i)) skippedDisabledCount += 1;
      continue;
    }
    const slide = slides[slideCursor];
    slideCursor += 1;
    if (!slide) continue; // defensive: enabled outline length > slides length is a bug elsewhere
    const flags = flagsByOutlineIndex.get(i);
    if (flags && flags.length > 0) {
      out.push({ ...slide, auditFlags: dedupePreserve(flags) });
      decoratedCount += 1;
    } else {
      // Preserve any pre-existing auditFlags the caller may have set.
      out.push({ ...slide });
    }
  }

  return {
    slides: out,
    decoratedCount,
    skippedDisabledCount,
  };
}

function dedupePreserve(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== 'string' || !v) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}
