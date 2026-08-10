/**
 * Unit tests for `presentationStudioSlideAuditDecoratorService` (Sprint S15).
 *
 * Verifies the bridge that copies audit findings onto the renderer's
 * `UnifiedSlide.auditFlags` field. We use synthetic outline + slides +
 * audit fixtures (no DB, no audit-service call) so failures isolate
 * the bridge.
 */

import { describe, expect, it } from 'vitest';

import type { OutlineItem } from '../presentationGeneratorService.js';
import type { PresentationStudioOutlineLayoutAudit } from '../presentationStudioLayoutAuditService.js';
import { decorateSlidesWithAuditFlags } from '../presentationStudioSlideAuditDecoratorService.js';
import type { UnifiedSlide } from '../report/pptx/types.js';

function outlineEntry(partial: Partial<OutlineItem> & Pick<OutlineItem, 'intent'>): OutlineItem {
  return {
    title: 'A',
    enabled: true,
    ...partial,
  } as OutlineItem;
}

function unifiedSlide(intent: UnifiedSlide['intent']): UnifiedSlide {
  return {
    intent,
    key_message: 'm',
    content: { title: 'A' } as unknown as UnifiedSlide['content'],
  };
}

function emptyFlagCounts(): PresentationStudioOutlineLayoutAudit['flagCounts'] {
  return {
    layout_overflow_title: 0,
    layout_overflow_key_message: 0,
    layout_overflow_blocks: 0,
    missing_source_for_evidence_intent: 0,
    unsupported_intent_for_pptx_export: 0,
    unsupported_intent_for_pdf_export: 0,
  };
}

describe('presentationStudioSlideAuditDecoratorService', () => {
  it('returns a clean copy when the audit has no findings', () => {
    const outline = [outlineEntry({ intent: 'cover' }), outlineEntry({ intent: 'next_steps' })];
    const slides = [unifiedSlide('cover'), unifiedSlide('next_steps')];
    const audit: PresentationStudioOutlineLayoutAudit = {
      warnings: [],
      slideAudits: [
        { index: 0, intent: 'cover', flags: [] },
        { index: 1, intent: 'next_steps', flags: [] },
      ],
      flagCounts: emptyFlagCounts(),
    };
    const result = decorateSlidesWithAuditFlags({ outline, slides, audit });
    expect(result.decoratedCount).toBe(0);
    expect(result.skippedDisabledCount).toBe(0);
    expect(result.slides).toHaveLength(2);
    expect(result.slides[0].auditFlags).toBeUndefined();
    expect(result.slides[1].auditFlags).toBeUndefined();
  });

  it('attaches flags to the matching enabled slide', () => {
    const outline = [outlineEntry({ intent: 'cover' }), outlineEntry({ intent: 'comparison' })];
    const slides = [unifiedSlide('cover'), unifiedSlide('comparison')];
    const audit: PresentationStudioOutlineLayoutAudit = {
      warnings: ['[layout_overflow_title] Slide 2 …'],
      slideAudits: [
        { index: 0, intent: 'cover', flags: [] },
        { index: 1, intent: 'comparison', flags: ['layout_overflow_title'] },
      ],
      flagCounts: { ...emptyFlagCounts(), layout_overflow_title: 1 },
    };
    const result = decorateSlidesWithAuditFlags({ outline, slides, audit });
    expect(result.decoratedCount).toBe(1);
    expect(result.slides[0].auditFlags).toBeUndefined();
    expect(result.slides[1].auditFlags).toEqual(['layout_overflow_title']);
  });

  it('skips disabled outline entries and aligns the slides cursor correctly', () => {
    // Outline indexes:  [0 cover (enabled)] [1 risk_management (DISABLED)] [2 next_steps (enabled)]
    // The audit flags slide index 2 (next_steps). The decorator must
    // attach to slides[1] (the second enabled slide), not slides[2].
    const outline = [
      outlineEntry({ intent: 'cover' }),
      outlineEntry({ intent: 'risk_management', enabled: false }),
      outlineEntry({ intent: 'next_steps' }),
    ];
    const slides = [unifiedSlide('cover'), unifiedSlide('next_steps')];
    const audit: PresentationStudioOutlineLayoutAudit = {
      warnings: [],
      slideAudits: [
        { index: 0, intent: 'cover', flags: [] },
        // Disabled slide audit MAY be empty in real audits, but if it
        // had flags they would be skipped. We model both cases below.
        { index: 1, intent: 'risk_management', flags: [] },
        { index: 2, intent: 'next_steps', flags: ['layout_overflow_blocks'] },
      ],
      flagCounts: { ...emptyFlagCounts(), layout_overflow_blocks: 1 },
    };
    const result = decorateSlidesWithAuditFlags({ outline, slides, audit });
    expect(result.slides).toHaveLength(2);
    expect(result.slides[0].auditFlags).toBeUndefined();
    expect(result.slides[1].auditFlags).toEqual(['layout_overflow_blocks']);
    expect(result.skippedDisabledCount).toBe(0);
  });

  it('counts skippedDisabledCount when a disabled outline entry has flags in the audit', () => {
    const outline = [
      outlineEntry({ intent: 'cover' }),
      outlineEntry({ intent: 'assessment', enabled: false }),
      outlineEntry({ intent: 'next_steps' }),
    ];
    const slides = [unifiedSlide('cover'), unifiedSlide('next_steps')];
    const audit: PresentationStudioOutlineLayoutAudit = {
      warnings: [],
      slideAudits: [
        { index: 0, intent: 'cover', flags: [] },
        // Disabled but audit has flags — must be SKIPPED.
        { index: 1, intent: 'assessment', flags: ['missing_source_for_evidence_intent'] },
        { index: 2, intent: 'next_steps', flags: [] },
      ],
      flagCounts: { ...emptyFlagCounts(), missing_source_for_evidence_intent: 1 },
    };
    const result = decorateSlidesWithAuditFlags({ outline, slides, audit });
    expect(result.skippedDisabledCount).toBe(1);
    // Neither output slide should have the disabled-slide flags.
    expect(result.slides.every((s) => !s.auditFlags)).toBe(true);
  });

  it('dedupes repeated flag ids on a single slide', () => {
    const outline = [outlineEntry({ intent: 'comparison' })];
    const slides = [unifiedSlide('comparison')];
    const audit: PresentationStudioOutlineLayoutAudit = {
      warnings: [],
      slideAudits: [
        {
          index: 0,
          intent: 'comparison',
          // Real audit emits unique flags, but the decorator must
          // defend against accidental duplication upstream.
          flags: ['layout_overflow_title', 'layout_overflow_title', 'layout_overflow_blocks'],
        },
      ],
      flagCounts: {
        ...emptyFlagCounts(),
        layout_overflow_title: 2,
        layout_overflow_blocks: 1,
      },
    };
    const result = decorateSlidesWithAuditFlags({ outline, slides, audit });
    expect(result.slides[0].auditFlags).toEqual([
      'layout_overflow_title',
      'layout_overflow_blocks',
    ]);
  });

  it('does not mutate the input slides array', () => {
    const outline = [outlineEntry({ intent: 'comparison' })];
    const inputSlide = unifiedSlide('comparison');
    const slides = [inputSlide];
    const audit: PresentationStudioOutlineLayoutAudit = {
      warnings: [],
      slideAudits: [{ index: 0, intent: 'comparison', flags: ['layout_overflow_title'] }],
      flagCounts: { ...emptyFlagCounts(), layout_overflow_title: 1 },
    };
    const result = decorateSlidesWithAuditFlags({ outline, slides, audit });
    // Caller's slide reference is untouched (no auditFlags assigned to it).
    expect(inputSlide.auditFlags).toBeUndefined();
    // The output slide is a NEW object with auditFlags assigned.
    expect(result.slides[0].auditFlags).toEqual(['layout_overflow_title']);
    expect(result.slides[0]).not.toBe(inputSlide);
  });

  it('preserves caller-set auditFlags when the audit produced none for that slide', () => {
    const outline = [outlineEntry({ intent: 'cover' })];
    const slides: UnifiedSlide[] = [
      { ...unifiedSlide('cover'), auditFlags: ['operator_set_flag'] },
    ];
    const audit: PresentationStudioOutlineLayoutAudit = {
      warnings: [],
      slideAudits: [{ index: 0, intent: 'cover', flags: [] }],
      flagCounts: emptyFlagCounts(),
    };
    const result = decorateSlidesWithAuditFlags({ outline, slides, audit });
    // Caller's flag passes through unchanged.
    expect(result.slides[0].auditFlags).toEqual(['operator_set_flag']);
  });
});
