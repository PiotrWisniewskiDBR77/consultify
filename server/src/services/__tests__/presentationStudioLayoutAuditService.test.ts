/**
 * Unit tests for `presentationStudioLayoutAuditService` (Sprint S10).
 *
 * The audit is dependency-free — no mocks needed. We assert the three
 * categories of findings (slot capacity, evidence discipline, PPTX
 * parity), the disabled-slide skip rule, and the SlideIntent
 * canonical-set drift guard.
 */

import { describe, expect, it } from 'vitest';

import type { OutlineItem } from '../presentationGeneratorService';
import {
  _familyAliasByDeckTypeForTests,
  _pdfSupportedIntentsForTests,
  _pptxSupportedIntentsForTests,
  _templateFamilyOverridesForTests,
  auditPresentationStudioOutlineLayout,
} from '../presentationStudioLayoutAuditService';
// Type-only import: the canonical SlideIntent union we want to keep in
// sync with the audit's PPTX-supported set.
import type { SlideIntent } from '../report/pptx/types';

function slide(partial: Partial<OutlineItem>): OutlineItem {
  return {
    intent: 'cover',
    title: 'A',
    enabled: true,
    ...partial,
  } as OutlineItem;
}

describe('presentationStudioLayoutAuditService', () => {
  it('returns a clean audit for a small healthy outline', () => {
    const outline = [
      slide({ intent: 'cover', title: 'Q3 readiness review' }),
      slide({
        intent: 'executive_summary',
        title: 'Executive thesis',
        keyMessage: 'Approve transformation budget for Q3.',
        density: 'balanced',
        suggestedBlocks: ['kpi_band', 'bullets', 'visual'],
        sourceRef: 'assessment:a-1',
      }),
      slide({
        intent: 'next_steps',
        title: 'Next steps',
        keyMessage: 'Decision required by 2026-06-01.',
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.warnings).toEqual([]);
    expect(audit.slideAudits).toHaveLength(3);
    expect(audit.slideAudits.every((s) => s.flags.length === 0)).toBe(true);
    expect(audit.flagCounts.layout_overflow_title).toBe(0);
  });

  it('flags an overlong title against the visual density budget', () => {
    const longTitle = 'Steering committee preview '.repeat(8); // > 80 chars
    const outline = [slide({ intent: 'cover', title: longTitle, density: 'visual' })];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.layout_overflow_title).toBe(1);
    expect(audit.warnings[0]).toContain('Slide 1');
    expect(audit.warnings[0]).toContain('title is');
  });

  it('flags an overlong key message against the balanced density budget', () => {
    const longMessage = 'Transformation rationale and decision context '.repeat(8);
    const outline = [
      slide({
        intent: 'executive_summary',
        title: 'Executive thesis',
        keyMessage: longMessage,
        density: 'balanced',
        sourceRef: 'assessment:a-1',
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.layout_overflow_key_message).toBe(1);
    expect(audit.warnings.join('\n')).toContain('key message is');
  });

  it('flags too many suggested blocks for a visual slide', () => {
    const outline = [
      slide({
        intent: 'single_insight',
        title: 'Insight',
        density: 'visual',
        suggestedBlocks: ['a', 'b', 'c', 'd', 'e'], // > 4 cap
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.layout_overflow_blocks).toBe(1);
  });

  it('flags an evidence-required intent that has no source reference', () => {
    const outline = [slide({ intent: 'recommendation_single', title: 'Recommendation' })];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.missing_source_for_evidence_intent).toBe(1);
    expect(audit.warnings[0]).toContain('missing_source_for_evidence_intent');
    expect(audit.warnings[0]).toContain('recommendation_single');
  });

  it('does NOT flag missing-source when sourceRefs is non-empty', () => {
    const outline = [
      slide({
        intent: 'recommendation_single',
        title: 'Recommendation',
        sourceRefs: ['assessment:a-1', 'interview:i-3'],
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.missing_source_for_evidence_intent).toBe(0);
  });

  it('flags an intent that is not natively supported by the PPTX export', () => {
    const outline = [
      slide({
        intent: 'custom_widget' as unknown as OutlineItem['intent'],
        title: 'Custom',
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.unsupported_intent_for_pptx_export).toBe(1);
  });

  it('skips disabled slides entirely', () => {
    const outline = [
      slide({
        intent: 'recommendation_single',
        title: 'X'.repeat(200),
        enabled: false,
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.warnings).toEqual([]);
    expect(audit.slideAudits[0].flags).toEqual([]);
  });

  it('aggregates multiple flags on the same slide', () => {
    const outline = [
      slide({
        intent: 'recommendation_single',
        title: 'X'.repeat(200), // overflow
        keyMessage: 'Y'.repeat(800), // overflow
        density: 'document',
        suggestedBlocks: Array.from({ length: 20 }, () => 'b'), // overflow
        // no sourceRef -> evidence flag
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.slideAudits[0].flags).toEqual(
      expect.arrayContaining([
        'layout_overflow_title',
        'layout_overflow_key_message',
        'layout_overflow_blocks',
        'missing_source_for_evidence_intent',
      ])
    );
    expect(audit.warnings.length).toBeGreaterThanOrEqual(4);
  });

  it('keeps the PPTX-supported intent set in sync with the canonical SlideIntent union', () => {
    // Type-level enumeration of every SlideIntent literal. If the union
    // changes, this list must change too — and the audit set must follow.
    const allSlideIntents: ReadonlyArray<SlideIntent> = [
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
    ];
    const supported = _pptxSupportedIntentsForTests();
    for (const intent of allSlideIntents) {
      expect(supported.has(intent)).toBe(true);
    }
    // And the audit set must not contain anything beyond the canonical
    // union (otherwise the parity check would silently approve something
    // the renderer does not actually support).
    expect(supported.size).toBe(allSlideIntents.length);
  });

  // ------------------------------------------------------------------
  // Sprint S11 — per-template-family slot capacity overrides + PDF
  // export parity flag.
  // ------------------------------------------------------------------

  it('does NOT flag a Steering Committee Deck title that fits the override but exceeds the canonical balanced cap (S11)', () => {
    // 100-char title sits above the canonical balanced cap (90) but below
    // the Steering-Committee override (110). With the override applied
    // the title should NOT trip the overflow flag.
    const longTitle = 'X'.repeat(100);
    const outline = [slide({ intent: 'executive_summary', title: longTitle, density: 'balanced' })];

    const without = auditPresentationStudioOutlineLayout(outline);
    expect(without.flagCounts.layout_overflow_title).toBe(1);

    const withOverride = auditPresentationStudioOutlineLayout(outline, {
      templateFamily: 'Steering Committee Deck',
    });
    expect(withOverride.flagCounts.layout_overflow_title).toBe(0);
  });

  it('accepts raw deck-type aliases and normalizes them to canonical family names (S11)', () => {
    const longTitle = 'X'.repeat(100);
    const outline = [slide({ intent: 'executive_summary', title: longTitle, density: 'balanced' })];
    // Raw deck-type alias (e.g. body sets `deckType: 'steering_committee'`).
    const audit = auditPresentationStudioOutlineLayout(outline, {
      templateFamily: 'steering_committee',
    });
    expect(audit.flagCounts.layout_overflow_title).toBe(0);
  });

  it('still flags overflow on families with no override (S11)', () => {
    const longTitle = 'X'.repeat(100);
    const outline = [slide({ intent: 'executive_summary', title: longTitle, density: 'balanced' })];
    const audit = auditPresentationStudioOutlineLayout(outline, {
      templateFamily: 'Initiative Kickoff Deck', // no override registered
    });
    expect(audit.flagCounts.layout_overflow_title).toBe(1);
  });

  it('keeps the override map keyed only by canonical TemplateFamily display names (S11)', () => {
    const overrides = _templateFamilyOverridesForTests();
    const aliases = _familyAliasByDeckTypeForTests();
    const knownCanonicalNames = new Set([
      'Digital Transformation Read Deck',
      'Board Decision Deck',
      'DRD Diagnostic Deck',
      'Initiative Kickoff Deck',
      'Steering Committee Deck',
    ]);
    for (const key of Object.keys(overrides)) {
      expect(knownCanonicalNames.has(key)).toBe(true);
    }
    // Every alias must resolve to a known canonical name (so the
    // normalize step never produces a dead key).
    for (const value of Object.values(aliases)) {
      expect(knownCanonicalNames.has(value)).toBe(true);
    }
  });

  it('exposes a PDF-supported intent set that mirrors the PPTX set (S11)', () => {
    const pptx = _pptxSupportedIntentsForTests();
    const pdf = _pdfSupportedIntentsForTests();
    // Today both pipelines support exactly the same intent set.
    expect(pdf.size).toBe(pptx.size);
    for (const intent of pptx) {
      expect(pdf.has(intent)).toBe(true);
    }
  });

  it('flags an unsupported intent for PDF export alongside the PPTX flag (S11)', () => {
    const outline = [
      slide({
        intent: 'mystery_intent' as unknown as OutlineItem['intent'],
        title: 'Mystery slide',
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.unsupported_intent_for_pptx_export).toBe(1);
    expect(audit.flagCounts.unsupported_intent_for_pdf_export).toBe(1);
    expect(audit.warnings.some((w) => w.startsWith('[unsupported_intent_for_pdf_export]'))).toBe(
      true
    );
  });

  it('does NOT flag PDF parity for a canonical SlideIntent (S11)', () => {
    const outline = [
      slide({ intent: 'cover', title: 'Cover' }),
      slide({ intent: 'executive_summary', title: 'Summary' }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.unsupported_intent_for_pdf_export).toBe(0);
    expect(audit.flagCounts.unsupported_intent_for_pptx_export).toBe(0);
  });
});
