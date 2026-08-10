/**
 * Unit tests for `presentationStudioLayoutAuditService` (Sprint S10).
 *
 * The audit is dependency-free — no mocks needed. We assert the three
 * categories of findings (slot capacity, evidence discipline, PPTX
 * parity), the disabled-slide skip rule, and the SlideIntent
 * canonical-set drift guard.
 */

import { afterEach, describe, expect, it } from 'vitest';

import type { OutlineItem } from '../presentationGeneratorService.js';
import {
  _familyAliasByDeckTypeForTests,
  _pdfSupportedIntentsForTests,
  _pptxSupportedIntentsForTests,
  _templateFamilyOverridesForTests,
  auditPresentationStudioOutlineLayout,
} from '../presentationStudioLayoutAuditService.js';
import {
  applyOverrides as applyCapacityOverrides,
  resetToDefaults as resetCapacityRegistry,
} from '../presentationStudioLayoutCapacityRegistryService.js';
// Type-only import: the canonical SlideIntent union we want to keep in
// sync with the audit's PPTX-supported set.
import type { SlideIntent } from '../report/pptx/types.js';

function slide(partial: Partial<OutlineItem>): OutlineItem {
  return {
    intent: 'cover',
    title: 'A',
    enabled: true,
    ...partial,
  } as OutlineItem;
}

describe('presentationStudioLayoutAuditService', () => {
  // S13: the audit now reads slot capacities from the layout-capacity
  // registry. Reset after every test so a registry override applied in
  // one test does not bleed into the next.
  afterEach(() => {
    resetCapacityRegistry();
  });

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

  // ------------------------------------------------------------------
  // Sprint S12 — per-slot density override (closes R-S10-2).
  // ------------------------------------------------------------------

  it('falls back to slide-level density when slotDensities is absent (S12)', () => {
    // 100-char title is over the canonical balanced cap (90) but under
    // the canonical document cap (110). With slide-level `document` and
    // no override, the audit must NOT flag.
    const outline = [
      slide({
        intent: 'assessment',
        title: 'X'.repeat(100),
        density: 'document',
        sourceRef: 'assessment:a-1',
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.layout_overflow_title).toBe(0);
  });

  it('uses the per-slot title density when slotDensities.title is set (S12)', () => {
    // Slide-level density is `document` (cap 110). slotDensities.title
    // overrides to `visual` (cap 80). 90-char title should now flag.
    const outline = [
      slide({
        intent: 'cover',
        title: 'X'.repeat(90),
        density: 'document',
        slotDensities: { title: 'visual' },
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.layout_overflow_title).toBe(1);
    // keyMessage + blocks are not present, so no other flags.
    expect(audit.flagCounts.layout_overflow_key_message).toBe(0);
    expect(audit.flagCounts.layout_overflow_blocks).toBe(0);
  });

  it('uses the per-slot key-message density when slotDensities.keyMessage is set (S12)', () => {
    // Slide-level density is `visual` (keyMessage cap 160). Override
    // raises just keyMessage to `document` (cap 360). 200-char message
    // should NOT flag.
    const outline = [
      slide({
        intent: 'single_insight',
        title: 'Insight',
        density: 'visual',
        keyMessage: 'M'.repeat(200),
        slotDensities: { keyMessage: 'document' },
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.layout_overflow_key_message).toBe(0);
  });

  it('uses the per-slot blocks density when slotDensities.blocks is set (S12)', () => {
    // Slide-level density `visual` allows max 4 blocks. Override raises
    // just blocks to `document` (max 8). 6 blocks should NOT flag.
    const outline = [
      slide({
        intent: 'recommendation_portfolio',
        title: 'Portfolio',
        density: 'visual',
        suggestedBlocks: ['a', 'b', 'c', 'd', 'e', 'f'],
        sourceRef: 'assessment:a-1',
        slotDensities: { blocks: 'document' },
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.layout_overflow_blocks).toBe(0);
  });

  it('mixes per-slot density overrides on the same slide (S12)', () => {
    // The classic R-S10-2 case: dense bullets + sparse hero + balanced
    // body. slotDensities.title='visual' (cap 80), slotDensities.blocks
    // ='document' (max 8), slotDensities.keyMessage stays slide-level.
    // 90-char title overflows; 6 blocks fit; 250-char keyMessage at
    // slide-level 'balanced' (cap 240) overflows.
    const outline = [
      slide({
        intent: 'comparison',
        title: 'X'.repeat(90),
        density: 'balanced',
        keyMessage: 'M'.repeat(250),
        suggestedBlocks: ['a', 'b', 'c', 'd', 'e', 'f'],
        sourceRef: 'assessment:a-1',
        slotDensities: { title: 'visual', blocks: 'document' },
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.layout_overflow_title).toBe(1);
    expect(audit.flagCounts.layout_overflow_blocks).toBe(0);
    expect(audit.flagCounts.layout_overflow_key_message).toBe(1);
  });

  it('ignores invalid slotDensities values and falls back to slide-level density (S12)', () => {
    const outline = [
      slide({
        intent: 'cover',
        title: 'X'.repeat(100),
        density: 'document',
        // Unknown override token must not crash and must fall through
        // to the slide-level density (cap 110), so no flag.
        slotDensities: { title: 'compact' as unknown as 'visual' },
      }),
    ];
    const audit = auditPresentationStudioOutlineLayout(outline);
    expect(audit.flagCounts.layout_overflow_title).toBe(0);
  });

  it('composes per-slot density with template-family override (S11+S12)', () => {
    // Slide-level density `balanced` (canonical cap 90). With Steering
    // Committee Deck override the balanced cap rises to 110. A 100-char
    // title should NOT flag. Then add slotDensities.title='visual' —
    // the visual cap (80) is the family override default (visual is
    // not overridden under Steering Committee), so 100 chars SHOULD flag.
    const titleOnlyOverride = [
      slide({
        intent: 'executive_summary',
        title: 'X'.repeat(100),
        density: 'balanced',
        sourceRef: 'assessment:a-1',
      }),
    ];
    const auditNoSlot = auditPresentationStudioOutlineLayout(titleOnlyOverride, {
      templateFamily: 'Steering Committee Deck',
    });
    expect(auditNoSlot.flagCounts.layout_overflow_title).toBe(0);

    const slotVisual = [
      slide({
        intent: 'executive_summary',
        title: 'X'.repeat(100),
        density: 'balanced',
        sourceRef: 'assessment:a-1',
        slotDensities: { title: 'visual' },
      }),
    ];
    const auditWithSlot = auditPresentationStudioOutlineLayout(slotVisual, {
      templateFamily: 'Steering Committee Deck',
    });
    expect(auditWithSlot.flagCounts.layout_overflow_title).toBe(1);
  });

  // -------------------------------------------------------------------------
  // Sprint S13: runtime registry override
  //
  // The audit must consult the live capacity registry, not a hardcoded
  // map. We assert two directions:
  //
  //   (a) raise the visual title cap → a previously-flagging slide
  //       passes without any code change to the audit module.
  //   (b) lower the visual title cap → a previously-clean slide
  //       starts flagging.
  //
  // If either branch fails, it means the audit is reading stale
  // numbers — i.e. the registry plumbing has regressed.
  // -------------------------------------------------------------------------

  it('honours a runtime visual title cap RAISE applied via the capacity registry (S13)', () => {
    const longTitle = 'X'.repeat(120); // exceeds canonical visual cap 80
    const outline = [slide({ intent: 'cover', title: longTitle, density: 'visual' })];

    // Default registry → flags.
    expect(auditPresentationStudioOutlineLayout(outline).flagCounts.layout_overflow_title).toBe(1);

    // Operator pushes a hot-reload override raising the cap to 200.
    const result = applyCapacityOverrides({
      densityBudgets: { visual: { titleMaxChars: 200 } },
    });
    expect(result.ok).toBe(true);

    // Same outline, same audit code → now clean. Proves the cap came
    // from the registry, not a static map.
    expect(auditPresentationStudioOutlineLayout(outline).flagCounts.layout_overflow_title).toBe(0);
  });

  it('honours a runtime per-family cap LOWER applied via the capacity registry (S13)', () => {
    const outline = [
      slide({
        intent: 'executive_summary',
        title: 'X'.repeat(100),
        density: 'balanced',
        sourceRef: 'assessment:a-1',
      }),
    ];
    // Default Steering Committee balanced cap is 110 → no flag.
    expect(
      auditPresentationStudioOutlineLayout(outline, {
        templateFamily: 'Steering Committee Deck',
      }).flagCounts.layout_overflow_title
    ).toBe(0);

    // Operator tightens the Steering family cap to 80.
    applyCapacityOverrides({
      templateFamilyOverrides: {
        'Steering Committee Deck': {
          balanced: { titleMaxChars: 80 },
        },
      },
    });

    expect(
      auditPresentationStudioOutlineLayout(outline, {
        templateFamily: 'Steering Committee Deck',
      }).flagCounts.layout_overflow_title
    ).toBe(1);
  });

  it('honours a runtime alias REGISTRATION via the capacity registry (S13)', () => {
    // Register a brand new raw deck-type that maps to Steering family.
    applyCapacityOverrides({
      familyAliasByDeckType: { product_strategy_deck: 'Steering Committee Deck' },
    });

    const outline = [
      slide({
        intent: 'executive_summary',
        title: 'X'.repeat(100),
        density: 'balanced',
        sourceRef: 'assessment:a-1',
      }),
    ];

    // The raw alias is normalised → Steering balanced cap 110 → clean.
    expect(
      auditPresentationStudioOutlineLayout(outline, {
        templateFamily: 'product_strategy_deck',
      }).flagCounts.layout_overflow_title
    ).toBe(0);
  });

  it('honours tenant-scoped capacity overrides when organizationId is supplied (S23)', () => {
    applyCapacityOverrides({ densityBudgets: { balanced: { titleMaxChars: 20 } } }, 'org-A');
    const outline = [
      slide({
        intent: 'executive_summary',
        title: 'This title is intentionally longer than twenty chars',
        density: 'balanced',
        sourceRef: 'assessment:a-1',
      }),
    ];

    const tenantAudit = auditPresentationStudioOutlineLayout(outline, {
      organizationId: 'org-A',
    });
    const otherTenantAudit = auditPresentationStudioOutlineLayout(outline, {
      organizationId: 'org-B',
    });

    expect(tenantAudit.flagCounts.layout_overflow_title).toBe(1);
    expect(otherTenantAudit.flagCounts.layout_overflow_title).toBe(0);
  });
});
