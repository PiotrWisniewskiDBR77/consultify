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
  _pptxSupportedIntentsForTests,
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
});
